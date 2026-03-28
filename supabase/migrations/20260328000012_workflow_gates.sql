-- 20260328000012_workflow_gates.sql
-- Workflow Gates Engine: gates, evidence, and workflow instances

-- ── Workflow Gates ──
-- Defines quality gates between workflow state transitions.
-- Each gate specifies what must be satisfied before a task can move
-- from one state to another (e.g. required fields, evidence, approval).
CREATE TABLE IF NOT EXISTS public.workflow_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    name TEXT NOT NULL,
    gate_type TEXT NOT NULL CHECK (gate_type IN (
        'required_fields',
        'evidence_upload',
        'approval',
        'automated',
        'manual'
    )),
    config JSONB NOT NULL DEFAULT '{}',
    is_required BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS on_workflow_gates_updated ON public.workflow_gates;
CREATE TRIGGER on_workflow_gates_updated BEFORE UPDATE ON public.workflow_gates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_workflow_gates_org ON public.workflow_gates(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_gates_workflow ON public.workflow_gates(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_gates_transition ON public.workflow_gates(workflow_id, from_state, to_state);

-- ── Gate Evidence ──
-- Immutable audit log of evidence submitted to satisfy workflow gates.
-- Once a row is inserted, it cannot be updated or deleted (enforced by trigger).
CREATE TABLE IF NOT EXISTS public.gate_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    gate_id UUID NOT NULL REFERENCES public.workflow_gates(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    submitted_by_user UUID REFERENCES auth.users(id),
    submitted_by_agent UUID REFERENCES public.agents(id),
    verified_by UUID REFERENCES auth.users(id),
    is_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    override_approved_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gate_evidence_org ON public.gate_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_gate_evidence_task ON public.gate_evidence(task_id);
CREATE INDEX IF NOT EXISTS idx_gate_evidence_gate ON public.gate_evidence(gate_id);
CREATE INDEX IF NOT EXISTS idx_gate_evidence_task_gate ON public.gate_evidence(task_id, gate_id);

-- Immutability trigger: prevent UPDATE and DELETE on gate_evidence rows
CREATE OR REPLACE FUNCTION public.gate_evidence_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'gate_evidence rows are immutable — UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_gate_evidence_no_update ON public.gate_evidence;
CREATE TRIGGER enforce_gate_evidence_no_update
    BEFORE UPDATE ON public.gate_evidence
    FOR EACH ROW EXECUTE FUNCTION public.gate_evidence_immutable();

DROP TRIGGER IF EXISTS enforce_gate_evidence_no_delete ON public.gate_evidence;
CREATE TRIGGER enforce_gate_evidence_no_delete
    BEFORE DELETE ON public.gate_evidence
    FOR EACH ROW EXECUTE FUNCTION public.gate_evidence_immutable();

-- ── Workflow Instances ──
-- Binds a workflow to a project. Only one active instance per workflow/project pair.
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_by UUID REFERENCES auth.users(id),
    UNIQUE(workflow_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_org ON public.workflow_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow ON public.workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_project ON public.workflow_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_active ON public.workflow_instances(project_id) WHERE is_active = true;

-- ── Row Level Security ──
DO $$ BEGIN ALTER TABLE public.workflow_gates ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gate_evidence ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- workflow_gates: org-scoped access
DO $$ BEGIN
    CREATE POLICY workflow_gates_access ON public.workflow_gates
        FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- gate_evidence: org-scoped SELECT only (INSERT handled separately, UPDATE/DELETE blocked by trigger)
DO $$ BEGIN
    CREATE POLICY gate_evidence_select ON public.gate_evidence
        FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY gate_evidence_insert ON public.gate_evidence
        FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- workflow_instances: org-scoped access
DO $$ BEGIN
    CREATE POLICY workflow_instances_access ON public.workflow_instances
        FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
