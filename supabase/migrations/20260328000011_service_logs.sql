-- Service logs table for Go MCP server and Laravel log viewing
CREATE TABLE IF NOT EXISTS public.service_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT NOT NULL,        -- 'go_mcp', 'laravel', 'studio'
    level TEXT NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warning', 'error', 'fatal'
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    request_id TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_logs_service ON public.service_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_level ON public.service_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_time ON public.service_logs(created_at DESC);
