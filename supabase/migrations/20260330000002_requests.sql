CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    created_by UUID,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'in_progress', 'done', 'rejected')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    context TEXT,
    tags TEXT[] DEFAULT '{}',
    linked_task_id UUID REFERENCES public.tasks(id),
    linked_meeting_id UUID REFERENCES public.meetings(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_requests_org ON public.requests(organization_id);
CREATE INDEX idx_requests_status ON public.requests(status);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_access" ON public.requests FOR ALL USING (
    organization_id IN (SELECT public.user_org_ids())
);
