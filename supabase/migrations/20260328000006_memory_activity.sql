-- 20260328000006_memory_activity.sql

-- ── Agent Memory (RAG via pgvector) ──
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID,
    source memory_source NOT NULL,
    source_ref TEXT,
    title TEXT,
    content TEXT NOT NULL,
    summary TEXT,
    embedding vector(1536),
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    tags TEXT[] DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_memories_updated ON public.memories;
CREATE TRIGGER on_memories_updated BEFORE UPDATE ON public.memories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON public.memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON public.memories(agent_id, source);
CREATE INDEX IF NOT EXISTS idx_memories_project ON public.memories(project_id, source);
CREATE INDEX IF NOT EXISTS idx_memories_org_time ON public.memories(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON public.memories USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_memories_fts ON public.memories USING gin(to_tsvector('english', coalesce(title,'') || ' ' || content));

-- ── Activity Log ──
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    session_id TEXT,
    machine_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_org_time ON public.activity_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_project ON public.activity_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_task ON public.activity_log(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_action ON public.activity_log(action);

-- ── Decisions ──
CREATE TABLE IF NOT EXISTS public.decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    made_by UUID,
    made_by_agent UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    context TEXT,
    decision TEXT NOT NULL,
    alternatives TEXT,
    outcome TEXT,
    tags TEXT[] DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_decisions_updated ON public.decisions;
CREATE TRIGGER on_decisions_updated BEFORE UPDATE ON public.decisions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_decisions_org ON public.decisions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON public.decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_embedding ON public.decisions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── Agent Sessions ──
CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    machine_id TEXT NOT NULL,
    status session_status DEFAULT 'active',
    current_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    current_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    session_metadata JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.agent_sessions(organization_id, status) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.agent_sessions(user_id, status);
