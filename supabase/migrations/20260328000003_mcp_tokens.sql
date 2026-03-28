-- 20260328000003_mcp_tokens.sql

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,       -- SHA-256 hash
    token_prefix TEXT NOT NULL,            -- "orch_xxxxxxxx" display prefix
    name TEXT DEFAULT 'default',
    scopes TEXT[] DEFAULT ARRAY['read', 'write'],
    last_used_at TIMESTAMPTZ,
    last_used_ip TEXT,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON public.mcp_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON public.mcp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_org ON public.mcp_tokens(organization_id);

-- Validate token and return user context
CREATE OR REPLACE FUNCTION public.validate_mcp_token(p_token_hash TEXT)
RETURNS TABLE (
    token_id UUID,
    user_id UUID,
    organization_id UUID,
    scopes TEXT[],
    plan org_plan,
    limits JSONB
) AS $$
BEGIN
    -- Update last used atomically
    UPDATE public.mcp_tokens t
    SET last_used_at = now(), usage_count = usage_count + 1
    WHERE t.token_hash = p_token_hash
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now());

    RETURN QUERY
    SELECT
        t.id AS token_id,
        t.user_id,
        t.organization_id,
        t.scopes,
        o.plan,
        o.limits
    FROM public.mcp_tokens t
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.token_hash = p_token_hash
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
