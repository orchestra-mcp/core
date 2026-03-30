-- Add provider fields to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'claude' CHECK (provider IN ('claude', 'gemini', 'openai', 'deepseek', 'qwen', 'ollama'));
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}';

-- User config table for persistent preferences
CREATE TABLE IF NOT EXISTS public.user_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_configs_user ON public.user_configs(user_id);
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_configs_own" ON public.user_configs FOR ALL USING (
    user_id = auth.uid() OR organization_id IN (SELECT public.user_org_ids())
);
