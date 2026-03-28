-- 20260328000004_projects_agents_skills.sql

-- ── Projects ──
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,
    repo_default_branch TEXT DEFAULT 'main',
    workspace_path TEXT,
    status project_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

DROP TRIGGER IF EXISTS on_projects_updated ON public.projects;
CREATE TRIGGER on_projects_updated BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON public.projects(team_id);

-- ── Skills ──
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    content TEXT,                   -- skill prompt/instructions
    category TEXT,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_skills_updated ON public.skills;
CREATE TRIGGER on_skills_updated BEFORE UPDATE ON public.skills
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_skills_org ON public.skills(organization_id);
CREATE INDEX IF NOT EXISTS idx_skills_public ON public.skills(is_public) WHERE is_public = true;

-- ── Agents ──
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type agent_type NOT NULL DEFAULT 'ai',
    role TEXT,                      -- CEO, Developer, QA, PM, etc.
    persona TEXT,                   -- personality for system prompt
    system_prompt TEXT,             -- full system prompt
    avatar_url TEXT,
    status agent_status DEFAULT 'active',
    linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

DROP TRIGGER IF EXISTS on_agents_updated ON public.agents;
CREATE TRIGGER on_agents_updated BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_agents_org ON public.agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_team ON public.agents(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_linked ON public.agents(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- ── Agent Skills (M2M) ──
CREATE TABLE IF NOT EXISTS public.agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    proficiency skill_proficiency DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON public.agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill ON public.agent_skills(skill_id);
