-- Add scope column to platform_settings for per-client feature flag targeting
-- Scope values: global (all clients), desktop (Claude Desktop), studio (Orchestra Studio), laravel (Laravel web app)

ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'
  CHECK (scope IN ('global','desktop','studio','laravel'));

CREATE INDEX IF NOT EXISTS idx_platform_settings_scope ON public.platform_settings(scope);
