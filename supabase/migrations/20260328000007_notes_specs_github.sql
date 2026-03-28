-- 20260328000007_notes_specs_github.sql

-- ── Notes ──
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    tags TEXT[] DEFAULT '{}',
    icon TEXT,
    color TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS on_notes_updated ON public.notes;
CREATE TRIGGER on_notes_updated BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_project ON public.notes(project_id) WHERE project_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_tags ON public.notes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_notes_fts ON public.notes USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));

-- ── Specs / Documents ──
CREATE TABLE IF NOT EXISTS public.specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status spec_status DEFAULT 'draft',
    github_path TEXT,
    parent_id UUID REFERENCES public.specs(id) ON DELETE SET NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, slug)
);

DROP TRIGGER IF EXISTS on_specs_updated ON public.specs;
CREATE TRIGGER on_specs_updated BEFORE UPDATE ON public.specs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_specs_project ON public.specs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_specs_embedding ON public.specs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── GitHub Connections ──
CREATE TABLE IF NOT EXISTS public.github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    github_user_id TEXT NOT NULL,
    github_username TEXT,
    access_token_encrypted TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    connected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- ── Project Repo Links ──
CREATE TABLE IF NOT EXISTS public.project_repos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    github_connection_id UUID NOT NULL REFERENCES public.github_connections(id) ON DELETE CASCADE,
    repo_full_name TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main',
    sync_specs BOOLEAN DEFAULT true,
    sync_claude_md BOOLEAN DEFAULT true,
    webhook_secret TEXT,
    webhook_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, repo_full_name)
);
