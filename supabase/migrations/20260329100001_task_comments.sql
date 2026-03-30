-- Task comments: threaded conversation on tasks (agent + human authors)
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID,
    author_agent_id UUID REFERENCES public.agents(id),
    message TEXT NOT NULL,
    result TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_org ON public.task_comments(organization_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_access" ON public.task_comments FOR ALL USING (
    organization_id IN (SELECT public.user_org_ids())
);
