-- 20260328000008_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_repos ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org IDs
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID AS $$
    SELECT DISTINCT t.organization_id
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = auth.uid()
    UNION
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Profiles ──
CREATE POLICY profiles_own ON public.profiles
    FOR ALL USING (id = auth.uid());
CREATE POLICY profiles_read_org ON public.profiles
    FOR SELECT USING (
        id IN (SELECT user_id FROM public.team_members WHERE team_id IN (
            SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        ))
    );

-- ── Organizations ──
CREATE POLICY org_access ON public.organizations
    FOR ALL USING (id IN (SELECT public.user_org_ids()));

-- ── Teams ──
CREATE POLICY team_read ON public.teams
    FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY team_write ON public.teams
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE owner_id = auth.uid()
        )
    );

-- ── Team Members ──
CREATE POLICY tm_read ON public.team_members
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );
CREATE POLICY tm_manage ON public.team_members
    FOR ALL USING (
        team_id IN (
            SELECT t.id FROM public.teams t
            JOIN public.organizations o ON o.id = t.organization_id
            WHERE o.owner_id = auth.uid()
        )
    );

-- ── MCP Tokens ──
CREATE POLICY tokens_own ON public.mcp_tokens
    FOR ALL USING (user_id = auth.uid());

-- ── Org-scoped tables (projects, agents, skills, tasks, etc.) ──
-- All use the same pattern: org_id must be in user's org list

CREATE POLICY projects_access ON public.projects
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY skills_access ON public.skills
    FOR ALL USING (
        organization_id IN (SELECT public.user_org_ids())
        OR is_public = true
    );

CREATE POLICY agents_access ON public.agents
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY workflows_access ON public.workflows
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY tasks_access ON public.tasks
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY memories_access ON public.memories
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY activity_access ON public.activity_log
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY decisions_access ON public.decisions
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY sessions_access ON public.agent_sessions
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY notes_access ON public.notes
    FOR ALL USING (
        user_id = auth.uid()
        OR organization_id IN (SELECT public.user_org_ids())
        OR is_public = true
    );

CREATE POLICY specs_access ON public.specs
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY github_access ON public.github_connections
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY repos_access ON public.project_repos
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY agent_skills_access ON public.agent_skills
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM public.agents WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY task_deps_access ON public.task_dependencies
    FOR ALL USING (
        task_id IN (
            SELECT id FROM public.tasks WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );
