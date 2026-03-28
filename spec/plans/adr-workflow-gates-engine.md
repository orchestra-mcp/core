# ADR: Workflow Gates Engine

**Date:** 2026-03-28
**Author:** Bassem Fouad Ghali, Software Architect
**Status:** Proposed
**Reviewers:** Youssef Amr El-Tawil (CTO), Ahmad Hazem El-Naggar (Tech Leader)

---

## Context

The current workflow system (PRD Migration 005) defines workflows as JSONB arrays of `states` and `transitions` on the `workflows` table. Tasks reference a `workflow_id` and store a `status` enum. Transitions are validated only structurally --- the system checks that a `from -> to` pair exists in the workflow's `transitions` array, but there is no mechanism to enforce preconditions before a transition is allowed to proceed.

This ADR introduces a **Gates Engine** that attaches typed preconditions to workflow transitions. A gate is a checkpoint that must be satisfied before a task can move from one state to another. This enables enforcing process discipline (code review before done, QA sign-off before release, required fields before progress) without relying on human diligence alone.

---

## 1. Gate Type Validation Logic

Five gate types are defined. Each gate record stores a `gate_type` enum and a `config` JSONB column containing type-specific parameters.

### 1.1 `required_fields`

**Purpose:** Ensure the task record has specified fields populated (non-null and non-empty) before the transition is allowed.

**Config schema:**
```json
{
  "fields": ["assigned_agent_id", "description", "estimate"]
}
```

**Validation logic (in `gate_check`):**
1. Load the task record.
2. For each field in `config.fields`, check that the corresponding column on `public.tasks` is NOT NULL. For text columns (`description`, `body`, `title`), additionally check that `trim(value) != ''`.
3. If any field fails, return `{passed: false, missing: ["description"]}`.

**Implementation note:** Only columns that exist on the `tasks` table are valid. The Go tool validates the field list against a hardcoded allowlist (`title`, `description`, `body`, `type`, `priority`, `estimate`, `labels`, `due_date`, `assigned_agent_id`, `assigned_user_id`, `project_id`) at gate creation time.

### 1.2 `evidence_upload`

**Purpose:** Require that an artifact (screenshot, test report, document, URL) has been attached as evidence for this gate before the transition proceeds.

**Config schema:**
```json
{
  "description": "Attach test results or QA report",
  "required_types": ["file", "url"],
  "min_count": 1
}
```
- `required_types` (optional): restrict accepted evidence to `file`, `url`, `text`, or `image`. If omitted, any type is accepted.
- `min_count` (optional, default 1): minimum number of evidence records required.

**Validation logic:**
1. Query `gate_evidence` for records matching `task_id` + `gate_id` + `evidence_type = 'upload'`.
2. If `required_types` is set, filter to only matching types.
3. If `count >= min_count`, gate passes.

### 1.3 `approval`

**Purpose:** Require explicit approval from a user who holds one of the specified roles within the organization.

**Config schema:**
```json
{
  "roles": ["cto", "tech-leader", "product-owner"],
  "min_approvals": 1,
  "allow_self_approval": false
}
```
- `roles`: list of agent/team `role` strings. The approver must be a `team_member` whose linked agent or direct role matches one of these values.
- `min_approvals` (optional, default 1): number of distinct approvers required.
- `allow_self_approval` (optional, default false): whether the task assignee can approve their own transition.

**Validation logic:**
1. Query `gate_evidence` for records matching `task_id` + `gate_id` + `evidence_type = 'approval'`.
2. For each evidence record, verify the `submitted_by` user holds a qualifying role:
   - Check `team_members` where `user_id = submitted_by` and the team belongs to the task's `organization_id`.
   - Check the user's linked agent role OR the `team_members.role` field.
   - The qualifying role check uses a mapping: `owner` and `admin` team_roles satisfy any approval gate. Agent-specific roles (`cto`, `tech-leader`, etc.) are matched against the `agents.role` column for the agent linked to that user via `agents.linked_user_id`.
3. If `allow_self_approval` is false, exclude evidence where `submitted_by` equals `task.assigned_user_id` or the user linked to `task.assigned_agent_id`.
4. If qualifying distinct approvers `>= min_approvals`, gate passes.

### 1.4 `automated`

**Purpose:** Call an internal or external check endpoint and compare the result against a threshold or expected value.

**Config schema:**
```json
{
  "check": "ci_status",
  "params": {
    "repo": "{{project.repo_url}}",
    "branch": "{{task.metadata.branch}}"
  },
  "expected": "success",
  "timeout_seconds": 30
}
```

**Supported built-in checks:**
| Check Name | Description | Expected Values |
|------------|-------------|-----------------|
| `ci_status` | Query GitHub Actions status for the task's branch | `success`, `pending`, `failure` |
| `test_coverage` | Query coverage percentage from CI metadata | Numeric threshold, e.g., `>= 80` |
| `no_blockers` | Verify no blocking task dependencies remain open | `true` / `false` |
| `branch_merged` | Check if the PR for this task's branch has been merged | `true` / `false` |

**Interface for custom checks (future extension):**
```go
type GateChecker interface {
    Check(ctx context.Context, task Task, gate Gate) (GateCheckResult, error)
}

type GateCheckResult struct {
    Passed  bool              `json:"passed"`
    Value   interface{}       `json:"value"`
    Details map[string]string `json:"details"`
}
```

**Validation logic:**
1. Resolve template variables in `params` using the task record and its associated project.
2. Dispatch to the appropriate built-in checker based on `config.check`.
3. Compare the returned value against `config.expected`. For numeric comparisons, support `>=`, `<=`, `>`, `<`, `==` operators.
4. If the check times out (per `timeout_seconds`), the gate fails with a timeout reason.
5. Results are cached in `gate_evidence` with `evidence_type = 'automated_check'` so repeated calls within a short window do not re-execute.

### 1.5 `manual`

**Purpose:** Simple manual confirmation. A human or agent explicitly confirms the gate is satisfied by submitting a confirmation record.

**Config schema:**
```json
{
  "prompt": "Confirm that the deployment was verified in staging",
  "require_comment": true
}
```

**Validation logic:**
1. Query `gate_evidence` for records matching `task_id` + `gate_id` + `evidence_type = 'manual_confirmation'`.
2. If `require_comment` is true, the evidence record must have a non-empty `comment` field.
3. If at least one qualifying record exists, gate passes.

---

## 2. Schema Additions

The following new tables and modifications are required on top of the existing PRD schema.

### 2.1 New Enum

```sql
CREATE TYPE gate_type AS ENUM (
    'required_fields',
    'evidence_upload',
    'approval',
    'automated',
    'manual'
);

CREATE TYPE gate_evidence_type AS ENUM (
    'upload',
    'approval',
    'automated_check',
    'manual_confirmation',
    'override'
);
```

### 2.2 `workflow_gates` Table

```sql
CREATE TABLE IF NOT EXISTS public.workflow_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    gate_type gate_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workflow_gates_workflow ON public.workflow_gates(workflow_id);
CREATE INDEX idx_workflow_gates_transition ON public.workflow_gates(workflow_id, from_state, to_state);

CREATE TRIGGER on_workflow_gates_updated BEFORE UPDATE ON public.workflow_gates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

A gate is scoped to a specific transition (`from_state -> to_state`) within a workflow. Multiple gates can exist per transition; they are evaluated in `order`. If `is_required` is false, the gate is advisory --- it is evaluated and logged but does not block the transition.

### 2.3 `gate_evidence` Table

```sql
CREATE TABLE IF NOT EXISTS public.gate_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    gate_id UUID NOT NULL REFERENCES public.workflow_gates(id) ON DELETE CASCADE,
    evidence_type gate_evidence_type NOT NULL,
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_by_agent UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    passed BOOLEAN NOT NULL,
    value JSONB DEFAULT '{}',
    comment TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gate_evidence_task_gate ON public.gate_evidence(task_id, gate_id);
CREATE INDEX idx_gate_evidence_task ON public.gate_evidence(task_id);

-- Immutability trigger: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION public.prevent_gate_evidence_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'gate_evidence is append-only. Updates and deletes are not permitted.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gate_evidence_immutable_update
    BEFORE UPDATE ON public.gate_evidence
    FOR EACH ROW EXECUTE FUNCTION public.prevent_gate_evidence_mutation();

CREATE TRIGGER gate_evidence_immutable_delete
    BEFORE DELETE ON public.gate_evidence
    FOR EACH ROW EXECUTE FUNCTION public.prevent_gate_evidence_mutation();
```

### 2.4 `workflow_instances` Table

A workflow instance binds a workflow to a project. Tasks within that project are then subject to the workflow's gates.

```sql
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    activated_by UUID NOT NULL REFERENCES auth.users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    activated_at TIMESTAMPTZ DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    UNIQUE(project_id, workflow_id)
);

CREATE INDEX idx_workflow_instances_project ON public.workflow_instances(project_id) WHERE is_active = true;
```

**Constraint: One active workflow per project.** Enforced by a partial unique index:

```sql
CREATE UNIQUE INDEX idx_one_active_workflow_per_project
    ON public.workflow_instances(project_id) WHERE is_active = true;
```

### 2.5 RLS Policies

```sql
ALTER TABLE public.workflow_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_gates_access ON public.workflow_gates
    FOR ALL USING (
        workflow_id IN (
            SELECT id FROM public.workflows
            WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY gate_evidence_access ON public.gate_evidence
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM public.tasks
            WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

-- Insert-only for non-admin users (immutability enforced at trigger level too)
CREATE POLICY gate_evidence_insert ON public.gate_evidence
    FOR INSERT WITH CHECK (
        task_id IN (
            SELECT id FROM public.tasks
            WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY workflow_instances_access ON public.workflow_instances
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects
            WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );
```

---

## 3. Override Escalation Flow

### 3.1 Role Hierarchy for Overrides

Not every gate failure should be a hard stop. An override allows a sufficiently privileged user to bypass a failed gate with a documented reason. The override itself becomes an immutable record in `gate_evidence`.

**Override authority hierarchy (highest to lowest):**

| Level | Roles | Can Override |
|-------|-------|-------------|
| 1 | Organization owner | All gates |
| 2 | `cto`, `ceo` (agent roles linked to users) | All gates |
| 3 | `tech-leader`, `product-owner` | All gates except those with `config.override_level = 1` |
| 4 | `admin` team_role | Non-approval gates only |
| 5 | `member` team_role | Cannot override |

### 3.2 Override Mechanism

Overrides are submitted via the `task_transition` tool with an `override` parameter:

```
task_transition(
    task_id: "...",
    to_state: "done",
    override: {
        gate_ids: ["gate-uuid-1"],
        reason: "Hotfix — bypassing QA gate per CTO directive"
    }
)
```

**Flow:**
1. `task_transition` evaluates all gates for the requested transition.
2. If any required gate fails AND no override is provided, the tool returns an error listing the failed gates with their details.
3. If an override is provided:
   a. Verify the calling user has sufficient authority per the hierarchy above.
   b. For each overridden gate, insert a `gate_evidence` record with `evidence_type = 'override'`, `passed = true`, the reason, and the overrider's identity.
   c. If authority is insufficient, return an error: `"User role 'member' cannot override gate 'qa-approval'. Required: tech-leader or above."`
4. Re-evaluate gates. Overridden gates now have passing evidence. If all gates pass, the transition proceeds.

**There is no separate override request/approval workflow.** The override is atomic within `task_transition`. This avoids introducing a secondary approval queue that would add complexity without proportional value. The immutable audit trail in `gate_evidence` provides full accountability.

### 3.3 Override Alerting

Every override inserts an `activity_log` entry with `action = 'gate_override'` and full details. This enables:
- Dashboard alerts for overrides
- Realtime notifications to org owners
- Audit reports filtering by override frequency

---

## 4. Immutability Enforcement

### 4.1 `gate_evidence` Is Append-Only

The `gate_evidence` table is the audit trail. Its integrity is non-negotiable.

**Enforcement layers:**

1. **Database trigger** (Section 2.3): A `BEFORE UPDATE` and `BEFORE DELETE` trigger raises an exception on any attempt to mutate or remove rows. This is the authoritative enforcement.

2. **RLS policy**: The RLS policies only grant `SELECT` and `INSERT`. No `UPDATE` or `DELETE` policy exists.

3. **Application layer**: The Go MCP server never issues UPDATE or DELETE queries against `gate_evidence`. The Supabase REST client should not expose these operations.

### 4.2 Separate Audit Log vs. `gate_evidence`

**Decision: `gate_evidence` IS the audit log for gate operations.** A separate `audit_log` table is not required for the following reasons:

- `gate_evidence` is already immutable and timestamped.
- Every gate evaluation (pass, fail, override) creates a record.
- The `value` JSONB column stores the full evaluation context (which fields were missing, what the automated check returned, etc.).
- The existing `activity_log` table captures the higher-level event (`task_transition`, `gate_override`) with a reference to the task.

A separate audit table would duplicate data without adding queryable dimensions. If future requirements demand a cross-cutting audit log (covering schema changes, RLS bypasses, etc.), that is a different concern and should be addressed at the database level (e.g., `pgaudit` extension), not within the gates engine.

### 4.3 Correction Mechanism

If a gate evaluation was wrong (e.g., an automated check returned stale data), the correct approach is to submit **new** evidence, not modify old evidence. The gate re-evaluates based on the latest qualifying evidence record. Old records remain for the audit trail.

---

## 5. `task_update` vs. `task_transition`

### 5.1 The Problem

Currently, `task_update` allows setting any field on a task, including `status`. When a project has an active workflow instance with gates, allowing a raw `status` update would bypass the entire gates engine.

### 5.2 Options Considered

**Option A: Block `status` in `task_update` when workflow is active.**
- `task_update` rejects any payload containing `status` if the task's project has an active `workflow_instance`.
- Users must call `task_transition` to change status.
- Pro: Clear separation. No ambiguity.
- Con: Breaking change for existing callers. Requires the caller to know whether a workflow is active.

**Option B: `task_update` internally delegates to `task_transition`.**
- If `task_update` receives a `status` field and the task's project has an active workflow, it internally calls `task_transition`.
- Pro: Transparent to callers. Single entry point.
- Con: Muddled responsibility. `task_update` becomes a god function. Error messages from gate failures appear in an unexpected context.

**Option C: `task_update` warns but allows, `task_transition` enforces.**
- `task_update` allows status changes but logs a warning and skips gates.
- Pro: Non-breaking.
- Con: Defeats the purpose of gates entirely.

### 5.3 Recommendation: Option A (Block + Redirect)

`task_update` MUST NOT accept `status` changes when the task belongs to a project with an active workflow instance. The tool returns a clear error:

```json
{
  "error": "status_change_requires_transition",
  "message": "This task belongs to project 'orchestra-core' which has an active workflow. Use task_transition to change status.",
  "current_status": "in_progress",
  "available_transitions": ["blocked", "in_review", "cancelled"]
}
```

**Rationale:**
- Gates exist to enforce process. A backdoor undermines trust.
- The error message is self-documenting --- it tells the caller exactly what to do.
- AI agents (the primary callers) can easily adapt to calling the correct tool.
- Projects without active workflows are unaffected; `task_update` works as before.

**Implementation detail:** The check is a single query:

```sql
SELECT EXISTS (
    SELECT 1 FROM public.workflow_instances wi
    WHERE wi.project_id = $1 AND wi.is_active = true
) AS has_active_workflow;
```

If true and the update payload contains `status`, reject.

---

## 6. Edge Cases

### 6.1 Task Created Before Workflow Applied

**Scenario:** A project has 50 existing tasks. An admin activates a workflow on the project.

**Decision: No retroactive enforcement.**

Existing tasks remain in their current states. The gates engine only applies to **transitions** --- it does not validate the current state of a task, only the act of moving between states. Therefore:
- A task already in `done` is not re-evaluated.
- A task in `in_progress` that wants to move to `in_review` must satisfy the gates for that transition.
- A task in `backlog` is unaffected until someone tries to transition it.

This is the correct behavior because gates enforce process going forward. Retroactive enforcement would create an impossible migration problem where dozens of tasks are suddenly "stuck" because they lack historical evidence.

### 6.2 Task Moved Between Projects

**Scenario:** A task is moved from Project A (no workflow) to Project B (active workflow with gates).

**Decision: The destination project's workflow governs from the moment of transfer.**

When `task_update` changes `project_id`:
1. If the destination project has an active workflow, validate that the task's current `status` is a valid state in that workflow.
2. If the status is not valid in the destination workflow, reject the transfer with an error: `"Task status 'fixing' is not a valid state in workflow 'Default Software Development'. Change status before transferring."`
3. If valid, the task is now subject to the destination workflow's gates for all future transitions.
4. No retroactive gate evaluation occurs.

The `workflow_id` field on the task record is updated to match the destination project's active workflow instance.

### 6.3 Multiple Workflows on Same Project

**Decision: NOT allowed. One active workflow per project.**

**Rationale:**
- Multiple workflows create ambiguity: which workflow's gates apply to a given transition?
- State names across workflows may conflict.
- The `task_status` enum is shared; mixing workflows that define different state semantics is unsound.
- The partial unique index `idx_one_active_workflow_per_project` enforces this at the database level.

**Workflow switching is allowed:** Deactivate the current workflow instance (sets `is_active = false`, `deactivated_at = now()`), then activate a new one. Existing tasks retain their current status. If the new workflow does not contain the task's current status as a valid state, the task is flagged and must be manually resolved.

### 6.4 Deleting a Workflow with Active Instances

**Decision: Prevent deletion. Require deactivation first.**

The `workflow_instances` table uses `ON DELETE RESTRICT` on `workflow_id`. Attempting to delete a workflow that has any instance (active or historical) will fail with a foreign key violation.

**Correct sequence:**
1. Deactivate all workflow instances referencing this workflow.
2. If no instances exist, the workflow can be deleted.
3. If historical instances exist, the workflow can only be archived (soft-delete via a `deleted_at` column to be added to `workflows`).

**Rationale:** Historical `gate_evidence` records reference `workflow_gates`, which reference `workflows`. Deleting the workflow would orphan the audit trail. The `ON DELETE RESTRICT` constraint preserves referential integrity.

### 6.5 Workflow States vs. `task_status` Enum

**Current problem:** The `task_status` enum in Migration 001 is hardcoded (`backlog`, `todo`, `in_progress`, `blocked`, `in_review`, `done`, `cancelled`). Custom workflows may define different states (e.g., `reported`, `fixing`, `testing`, `resolved` in the Bug Tracking template).

**Decision: Decouple workflow states from the database enum.**

Add a `workflow_state` TEXT column to `tasks`:

```sql
ALTER TABLE public.tasks ADD COLUMN workflow_state TEXT;
```

When a task has a `workflow_id`, `workflow_state` holds the current position in the workflow (e.g., `testing`). The `status` enum column is kept for backward compatibility and as a coarse-grained status that maps to one of the universal categories: `start`, `progress`, `done`, `cancelled` (from the workflow state's `type` field).

The mapping is maintained by a trigger:
```sql
CREATE OR REPLACE FUNCTION public.sync_workflow_state_to_status()
RETURNS TRIGGER AS $$
DECLARE
    state_type TEXT;
BEGIN
    IF NEW.workflow_state IS NOT NULL AND NEW.workflow_id IS NOT NULL THEN
        SELECT s->>'type' INTO state_type
        FROM public.workflows w,
             jsonb_array_elements(w.states) s
        WHERE w.id = NEW.workflow_id
          AND s->>'name' = NEW.workflow_state;

        NEW.status = CASE state_type
            WHEN 'start' THEN 'backlog'::task_status
            WHEN 'progress' THEN 'in_progress'::task_status
            WHEN 'done' THEN 'done'::task_status
            WHEN 'cancelled' THEN 'cancelled'::task_status
            ELSE 'backlog'::task_status
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_workflow_state
    BEFORE INSERT OR UPDATE OF workflow_state ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.sync_workflow_state_to_status();
```

This approach means:
- Existing queries filtering by `status` continue to work.
- Workflow-specific states are stored in `workflow_state`.
- The coarse `status` enum gives a universal view across all workflows.

---

## 7. New MCP Tools

### 7.1 `task_transition`

```
task_transition(
    task_id: UUID,
    to_state: string,
    comment?: string,
    override?: {
        gate_ids: UUID[],
        reason: string
    }
)
```

**Returns on success:**
```json
{
  "task_id": "...",
  "from_state": "in_progress",
  "to_state": "in_review",
  "gates_evaluated": [
    {"gate_id": "...", "name": "Required Fields", "passed": true},
    {"gate_id": "...", "name": "CI Green", "passed": true}
  ],
  "transitioned_at": "2026-03-28T14:30:00Z"
}
```

**Returns on gate failure:**
```json
{
  "error": "gates_not_satisfied",
  "task_id": "...",
  "from_state": "in_progress",
  "to_state": "in_review",
  "failed_gates": [
    {
      "gate_id": "...",
      "name": "QA Approval",
      "gate_type": "approval",
      "is_required": true,
      "details": {"required_roles": ["qa-engineer"], "current_approvals": 0}
    }
  ],
  "passed_gates": [
    {"gate_id": "...", "name": "Required Fields", "passed": true}
  ]
}
```

### 7.2 `gate_submit_evidence`

```
gate_submit_evidence(
    task_id: UUID,
    gate_id: UUID,
    evidence_type: "upload" | "approval" | "manual_confirmation",
    comment?: string,
    file_url?: string,
    value?: object
)
```

Inserts a record into `gate_evidence`. Does not trigger a transition --- the caller must separately call `task_transition` after submitting evidence.

### 7.3 `gate_check`

```
gate_check(
    task_id: UUID,
    to_state: string
)
```

Dry-run evaluation. Returns the same structure as a failed `task_transition` but never mutates state. Useful for AI agents to check what gates remain before attempting a transition.

---

## 8. Decision

### Recommendation

Implement the Workflow Gates Engine as described above with the following key decisions:

1. **Five gate types** (`required_fields`, `evidence_upload`, `approval`, `automated`, `manual`) with the validation logic specified in Section 1.

2. **Overrides are atomic within `task_transition`**, not a separate request/approval queue. Authority is determined by role hierarchy. Every override is immutably recorded.

3. **`gate_evidence` is append-only**, enforced by database triggers. No separate audit table. The existing `activity_log` handles higher-level event tracking.

4. **`task_update` blocks status changes** when a workflow is active (Option A). The error response tells the caller to use `task_transition`.

5. **No retroactive enforcement.** Gates apply to transitions, not existing states.

6. **One active workflow per project.** Enforced by partial unique index.

7. **Workflow deletion is prevented** while instances exist. Soft-delete via archival.

8. **Decouple workflow states from enum** via `workflow_state` TEXT column with a sync trigger to maintain the coarse `status` enum.

### Rationale

This design prioritizes:
- **Auditability**: Every gate evaluation and override is permanently recorded.
- **Simplicity**: No secondary approval queues, no complex state machines for the gates themselves.
- **Backward compatibility**: Existing `status`-based queries work unchanged. Projects without workflows are unaffected.
- **Extensibility**: The `GateChecker` interface allows adding new automated checks without schema changes. New gate types can be added to the enum.

### Risks

| Risk | Mitigation |
|------|-----------|
| Gate evaluation adds latency to transitions | Gates are evaluated in-process. Automated checks have timeouts. Cache results in `gate_evidence`. |
| Override abuse | Immutable audit trail + activity_log alerts + dashboard reporting. Override frequency is a health metric. |
| Workflow state drift from status enum | The sync trigger keeps them aligned. The `status` column is derived, never set directly when a workflow is active. |
| Complex gate configs causing runtime errors | Validate config schema at gate creation time in the Go tool layer. Reject malformed configs before they reach the database. |

### Migration Sequence

This should be implemented as Migration 011:

```
20260328000011_workflow_gates.sql
```

Containing:
1. New enums (`gate_type`, `gate_evidence_type`)
2. `workflow_gates` table
3. `gate_evidence` table with immutability triggers
4. `workflow_instances` table with partial unique index
5. `tasks.workflow_state` column
6. `sync_workflow_state_to_status` trigger
7. `workflows.deleted_at` column for soft-delete
8. RLS policies for all new tables
9. Realtime publication for `gate_evidence`

### Go Implementation Files

```
spec/mcp-server/internal/tools/
    transitions.go       # task_transition tool
    gates.go             # gate_check, gate_submit_evidence tools
    gate_checkers.go     # GateChecker interface + built-in checkers
```

---

## Appendix A: Full `task_transition` Flow

```
1. Caller invokes task_transition(task_id, to_state, override?)
2. Load task record, verify ownership (org_id check)
3. Load active workflow_instance for task.project_id
   - If no active workflow: update task.status directly (legacy path), return
4. Validate transition exists in workflow.transitions
   - Check from_state = task.workflow_state, to_state = requested
   - Also check wildcard transitions (from: "*")
   - If no valid transition exists: return error
5. Load all workflow_gates for this (from_state, to_state) pair, ordered by "order"
6. For each gate:
   a. Evaluate based on gate_type (Section 1 logic)
   b. Insert gate_evidence record with result
   c. If gate fails and is_required:
      - Check if gate_id is in override.gate_ids
      - If yes: verify caller authority, insert override evidence
      - If no: add to failed_gates list
7. If any required gate failed without override: return error with failed_gates
8. All gates passed: update task.workflow_state = to_state
   - sync trigger updates task.status automatically
   - handle_task_status_change trigger sets started_at / completed_at
9. Insert activity_log entry for the transition
10. Return success with gate evaluation summary
```
