-- 20260330000001_meeting_messages.sql
-- Meeting messages: enables conversation threads within meetings

CREATE TABLE IF NOT EXISTS public.meeting_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    author_id UUID,
    author_agent_id UUID REFERENCES public.agents(id),
    author_type TEXT NOT NULL DEFAULT 'user' CHECK (author_type IN ('agent', 'user', 'system')),
    author_name TEXT,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meeting_messages_meeting ON public.meeting_messages(meeting_id);
CREATE INDEX idx_meeting_messages_org ON public.meeting_messages(organization_id);

ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY meeting_messages_access ON public.meeting_messages
        FOR ALL USING (
            organization_id IN (SELECT public.user_org_ids())
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant service_role full access
GRANT ALL ON public.meeting_messages TO service_role;
