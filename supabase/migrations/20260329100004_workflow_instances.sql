-- Workflow instances table (tracks active workflows per project)
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id),
    workflow_id UUID REFERENCES public.workflows(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_org ON public.workflow_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_project ON public.workflow_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_active ON public.workflow_instances(is_active);

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "workflow_instances_access" ON public.workflow_instances
        FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
