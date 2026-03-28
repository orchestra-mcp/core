-- 20260328000010_realtime_seeds.sql

-- Enable Supabase Realtime on sync-critical tables
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.specs;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

-- ── Seed: Default workflow template ──
-- This gets created per-org during onboarding, but we store a template
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    states JSONB NOT NULL,
    transitions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.workflow_templates (name, slug, description, states, transitions) VALUES
(
    'Default Software Development',
    'default-software',
    'Standard software development workflow with backlog, sprint, review, and done states',
    '[
        {"name":"backlog","color":"#6B7280","order":0,"type":"start"},
        {"name":"todo","color":"#3B82F6","order":1,"type":"start"},
        {"name":"in_progress","color":"#F59E0B","order":2,"type":"progress"},
        {"name":"in_review","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"done","color":"#10B981","order":4,"type":"done"},
        {"name":"cancelled","color":"#EF4444","order":5,"type":"cancelled"}
    ]',
    '[
        {"from":"backlog","to":"todo"},
        {"from":"todo","to":"in_progress"},
        {"from":"in_progress","to":"blocked"},
        {"from":"in_progress","to":"in_review"},
        {"from":"in_review","to":"done"},
        {"from":"in_review","to":"in_progress"},
        {"from":"blocked","to":"in_progress"},
        {"from":"*","to":"cancelled"}
    ]'
),
(
    'Kanban',
    'kanban',
    'Simple kanban board workflow',
    '[
        {"name":"todo","color":"#3B82F6","order":0,"type":"start"},
        {"name":"doing","color":"#F59E0B","order":1,"type":"progress"},
        {"name":"done","color":"#10B981","order":2,"type":"done"}
    ]',
    '[
        {"from":"todo","to":"doing"},
        {"from":"doing","to":"done"},
        {"from":"doing","to":"todo"},
        {"from":"done","to":"doing"}
    ]'
),
(
    'Bug Tracking',
    'bug-tracking',
    'Bug lifecycle from report to resolution',
    '[
        {"name":"reported","color":"#EF4444","order":0,"type":"start"},
        {"name":"confirmed","color":"#F59E0B","order":1,"type":"start"},
        {"name":"fixing","color":"#3B82F6","order":2,"type":"progress"},
        {"name":"testing","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"resolved","color":"#10B981","order":4,"type":"done"},
        {"name":"wont_fix","color":"#6B7280","order":5,"type":"cancelled"}
    ]',
    '[
        {"from":"reported","to":"confirmed"},
        {"from":"confirmed","to":"fixing"},
        {"from":"fixing","to":"testing"},
        {"from":"testing","to":"resolved"},
        {"from":"testing","to":"fixing"},
        {"from":"reported","to":"wont_fix"},
        {"from":"confirmed","to":"wont_fix"}
    ]'
)
ON CONFLICT (slug) DO NOTHING;
