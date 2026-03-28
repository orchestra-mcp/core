-- 20260328000013_seed_workflow_templates.sql
-- Seed: 4 built-in workflow templates with pre-configured gates
--
-- Templates:
--   1. standard-dev   — Full software development lifecycle with quality gates
--   2. hotfix          — Fast-track bug fixes with minimal gates
--   3. research        — Exploration/spike work, no required gates
--   4. security-patch  — Standard-dev + mandatory CVE reference & security audit
--
-- Uses a "system" organization (00000000-...-000000000000) to store templates.
-- All IDs are fixed UUIDs for idempotency (re-running is safe via ON CONFLICT DO NOTHING).

-- ────────────────────────────────────────────────────────────────────────────────
-- 0. System Organization (sentinel row for built-in templates)
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.organizations (id, name, slug, owner_id, plan, description)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'System',
    '_system',
    '00000000-0000-0000-0000-000000000000',  -- no real owner
    'free',
    'Internal system organization for built-in workflow templates. Do not delete.'
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. STANDARD-DEV WORKFLOW
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflows (id, organization_id, name, slug, description, states, transitions, is_default)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'Standard Development',
    'standard-dev',
    'Full software development lifecycle with quality gates for assignment, code review, and approval.',
    '[
        {"name": "backlog",     "color": "#6B7280", "order": 0, "type": "start"},
        {"name": "todo",        "color": "#3B82F6", "order": 1, "type": "start"},
        {"name": "in_progress", "color": "#F59E0B", "order": 2, "type": "progress"},
        {"name": "in_review",   "color": "#8B5CF6", "order": 3, "type": "progress"},
        {"name": "done",        "color": "#10B981", "order": 4, "type": "done"},
        {"name": "cancelled",   "color": "#EF4444", "order": 5, "type": "cancelled"},
        {"name": "blocked",     "color": "#DC2626", "order": 6, "type": "progress"}
    ]'::jsonb,
    '[
        {"from": "backlog",     "to": "todo"},
        {"from": "todo",        "to": "in_progress"},
        {"from": "in_progress", "to": "in_review"},
        {"from": "in_review",   "to": "done"},
        {"from": "in_review",   "to": "in_progress"},
        {"from": "in_progress", "to": "blocked"},
        {"from": "blocked",     "to": "in_progress"},
        {"from": "*",           "to": "cancelled"}
    ]'::jsonb,
    false
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Gates for standard-dev
-- 1a. todo → in_progress: Assignment Check
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'todo', 'in_progress',
    'Assignment Check',
    'required_fields',
    '{"fields": ["assigned_agent_id"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 1b. in_progress → in_review: Quality Gate
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'in_progress', 'in_review',
    'Quality Gate',
    'evidence_upload',
    '{"required_evidence": ["test_results", "lint_output", "pr_link"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 1c. in_review → done: Review Gate
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'in_review', 'done',
    'Review Gate',
    'approval',
    '{"roles": ["tech-leader", "cto"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 1d. in_progress → blocked: Blocker Gate
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'in_progress', 'blocked',
    'Blocker Gate',
    'evidence_upload',
    '{"required_evidence": ["blocked_reason"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 1e. blocked → in_progress: Unblock Gate
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'blocked', 'in_progress',
    'Unblock Gate',
    'evidence_upload',
    '{"required_evidence": ["resolution"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. HOTFIX WORKFLOW
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflows (id, organization_id, name, slug, description, states, transitions, is_default)
VALUES (
    'a0000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'Hotfix',
    'hotfix',
    'Fast-track workflow for urgent bug fixes with minimal required gates.',
    '[
        {"name": "todo",        "color": "#3B82F6", "order": 0, "type": "start"},
        {"name": "in_progress", "color": "#F59E0B", "order": 1, "type": "progress"},
        {"name": "in_review",   "color": "#8B5CF6", "order": 2, "type": "progress"},
        {"name": "done",        "color": "#10B981", "order": 3, "type": "done"}
    ]'::jsonb,
    '[
        {"from": "todo",        "to": "in_progress"},
        {"from": "in_progress", "to": "in_review"},
        {"from": "in_review",   "to": "done"},
        {"from": "in_review",   "to": "in_progress"}
    ]'::jsonb,
    false
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Gates for hotfix
-- 2a. in_progress → in_review: PR Required
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'in_progress', 'in_review',
    'PR Required',
    'evidence_upload',
    '{"required_evidence": ["pr_link"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 2b. in_review → done: Fast-Track Approval
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'in_review', 'done',
    'Fast-Track Approval',
    'approval',
    '{"roles": ["tech-leader", "cto"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. RESEARCH WORKFLOW
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflows (id, organization_id, name, slug, description, states, transitions, is_default)
VALUES (
    'a0000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'Research',
    'research',
    'Exploration and spike work. All gates are advisory (non-blocking).',
    '[
        {"name": "backlog",     "color": "#6B7280", "order": 0, "type": "start"},
        {"name": "in_progress", "color": "#F59E0B", "order": 1, "type": "progress"},
        {"name": "in_review",   "color": "#8B5CF6", "order": 2, "type": "progress"},
        {"name": "done",        "color": "#10B981", "order": 3, "type": "done"}
    ]'::jsonb,
    '[
        {"from": "backlog",     "to": "in_progress"},
        {"from": "in_progress", "to": "in_review"},
        {"from": "in_review",   "to": "done"},
        {"from": "in_review",   "to": "in_progress"}
    ]'::jsonb,
    false
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- No required gates for research workflow.
-- Advisory-only gates can be added per-org at runtime.

-- ────────────────────────────────────────────────────────────────────────────────
-- 4. SECURITY-PATCH WORKFLOW
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflows (id, organization_id, name, slug, description, states, transitions, is_default)
VALUES (
    'a0000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'Security Patch',
    'security-patch',
    'Standard development gates plus mandatory CVE reference and security audit approval.',
    '[
        {"name": "backlog",     "color": "#6B7280", "order": 0, "type": "start"},
        {"name": "todo",        "color": "#3B82F6", "order": 1, "type": "start"},
        {"name": "in_progress", "color": "#F59E0B", "order": 2, "type": "progress"},
        {"name": "in_review",   "color": "#8B5CF6", "order": 3, "type": "progress"},
        {"name": "done",        "color": "#10B981", "order": 4, "type": "done"},
        {"name": "cancelled",   "color": "#EF4444", "order": 5, "type": "cancelled"},
        {"name": "blocked",     "color": "#DC2626", "order": 6, "type": "progress"}
    ]'::jsonb,
    '[
        {"from": "backlog",     "to": "todo"},
        {"from": "todo",        "to": "in_progress"},
        {"from": "in_progress", "to": "in_review"},
        {"from": "in_review",   "to": "done"},
        {"from": "in_review",   "to": "in_progress"},
        {"from": "in_progress", "to": "blocked"},
        {"from": "blocked",     "to": "in_progress"},
        {"from": "*",           "to": "cancelled"}
    ]'::jsonb,
    false
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Gates for security-patch (standard-dev gates + security-specific gates)

-- 4a. todo → in_progress: Assignment Check (same as standard-dev)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000020',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'todo', 'in_progress',
    'Assignment Check',
    'required_fields',
    '{"fields": ["assigned_agent_id"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 4b. todo → in_progress: CVE Reference (security-specific, order=1 so it runs after assignment check)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000021',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'todo', 'in_progress',
    'CVE Reference',
    'evidence_upload',
    '{"required_evidence": ["cve_id", "severity_assessment"]}'::jsonb,
    true, 1
)
ON CONFLICT (id) DO NOTHING;

-- 4c. in_progress → in_review: Quality Gate (same as standard-dev)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000022',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'in_progress', 'in_review',
    'Quality Gate',
    'evidence_upload',
    '{"required_evidence": ["test_results", "lint_output", "pr_link"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 4d. in_review → done: Review Gate (same as standard-dev)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000023',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'in_review', 'done',
    'Review Gate',
    'approval',
    '{"roles": ["tech-leader", "cto"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 4e. in_review → done: Security Audit (security-specific, order=1 so it runs after review gate)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000024',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'in_review', 'done',
    'Security Audit',
    'approval',
    '{"roles": ["security-engineer", "cto"]}'::jsonb,
    true, 1
)
ON CONFLICT (id) DO NOTHING;

-- 4f. in_progress → blocked: Blocker Gate (same as standard-dev)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000025',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'in_progress', 'blocked',
    'Blocker Gate',
    'evidence_upload',
    '{"required_evidence": ["blocked_reason"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- 4g. blocked → in_progress: Unblock Gate (same as standard-dev)
INSERT INTO public.workflow_gates (id, organization_id, workflow_id, from_state, to_state, name, gate_type, config, is_required, "order")
VALUES (
    'b0000000-0000-4000-8000-000000000026',
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000004',
    'blocked', 'in_progress',
    'Unblock Gate',
    'evidence_upload',
    '{"required_evidence": ["resolution"]}'::jsonb,
    true, 0
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────
-- Summary of seeded data
-- ────────────────────────────────────────────────────────────────────────────────
-- Organization: 00000000-0000-0000-0000-000000000000 (System)
--
-- Workflows:
--   a0..01  standard-dev    (5 gates)
--   a0..02  hotfix          (2 gates)
--   a0..03  research        (0 gates)
--   a0..04  security-patch  (7 gates)
--
-- Total: 4 workflows, 14 gates
