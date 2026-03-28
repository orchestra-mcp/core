-- 20260328000005_workflows_tasks.sql

-- ── Workflows ──
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    states JSONB NOT NULL DEFAULT '[
        {"name":"backlog","color":"#6B7280","order":0,"type":"start"},
        {"name":"todo","color":"#3B82F6","order":1,"type":"start"},
        {"name":"in_progress","color":"#F59E0B","order":2,"type":"progress"},
        {"name":"in_review","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"done","color":"#10B981","order":4,"type":"done"},
        {"name":"cancelled","color":"#EF4444","order":5,"type":"cancelled"}
    ]',
    transitions JSONB NOT NULL DEFAULT '[
        {"from":"backlog","to":"todo"},
        {"from":"todo","to":"in_progress"},
        {"from":"in_progress","to":"blocked"},
        {"from":"in_progress","to":"in_review"},
        {"from":"in_review","to":"done"},
        {"from":"in_review","to":"in_progress"},
        {"from":"blocked","to":"in_progress"},
        {"from":"*","to":"cancelled"}
    ]',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

DROP TRIGGER IF EXISTS on_workflows_updated ON public.workflows;
CREATE TRIGGER on_workflows_updated BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_default ON public.workflows(organization_id) WHERE is_default = true;

-- ── Tasks ──
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    assigned_user_id UUID,
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    body TEXT,
    type task_type DEFAULT 'task',
    status task_status DEFAULT 'backlog',
    priority task_priority DEFAULT 'medium',
    estimate TEXT CHECK (estimate IN ('XS', 'S', 'M', 'L', 'XL')),
    labels TEXT[] DEFAULT '{}',
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_tasks_updated ON public.tasks;
CREATE TRIGGER on_tasks_updated BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON public.tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON public.tasks(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_labels ON public.tasks USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority, created_at);

-- Auto-set started_at / completed_at on status change
CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.started_at IS NULL THEN
        NEW.started_at = now();
    END IF;
    IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_task_status_change ON public.tasks;
CREATE TRIGGER on_task_status_change BEFORE UPDATE OF status ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_task_status_change();

-- ── Task Dependencies ──
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    type dependency_type DEFAULT 'blocks',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON public.task_dependencies(depends_on_id);
