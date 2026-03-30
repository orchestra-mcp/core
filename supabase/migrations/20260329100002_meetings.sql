-- 20260329100002_meetings.sql
-- Meetings system: meetings table, meeting_agents pivot, decisions.meeting_id FK

-- ── Meetings ──
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    topic TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'cancelled')),
    rounds INT DEFAULT 2,
    result TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_meetings_updated ON public.meetings;
CREATE TRIGGER on_meetings_updated BEFORE UPDATE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meetings_org ON public.meetings(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON public.meetings(project_id) WHERE project_id IS NOT NULL;

-- ── Meeting Agents (pivot) ──
CREATE TABLE IF NOT EXISTS public.meeting_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(meeting_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_agents_meeting ON public.meeting_agents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agents_agent ON public.meeting_agents(agent_id);

-- ── Add meeting_id to decisions ──
ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON public.decisions(meeting_id) WHERE meeting_id IS NOT NULL;

-- ── RLS ──
DO $$ BEGIN ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.meeting_agents ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY meetings_access ON public.meetings
        FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY meeting_agents_access ON public.meeting_agents
        FOR ALL USING (
            meeting_id IN (
                SELECT id FROM public.meetings WHERE organization_id IN (SELECT public.user_org_ids())
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant service_role full access
GRANT ALL ON public.meetings TO service_role;
GRANT ALL ON public.meeting_agents TO service_role;
