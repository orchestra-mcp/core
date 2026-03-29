-- Platform Settings table for Orchestra Studio admin configuration GUI
-- Stores MCP server config, auth keys, OAuth, SMTP, storage, and Cloudflare settings

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    is_secret BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admin users can read/write platform settings
-- This uses the is_admin flag from the profiles table
CREATE POLICY "Admins can read platform settings"
    ON public.platform_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can insert platform settings"
    ON public.platform_settings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER platform_settings_updated_at_trigger
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.platform_settings_updated_at();

-- Seed default settings
INSERT INTO public.platform_settings (key, value, is_secret) VALUES
    ('mcp_server_url', 'http://localhost:9999', false),
    ('mcp_server_port', '9999', false),
    ('storage_backend', 'file', false),
    ('github_enabled', 'false', false),
    ('google_enabled', 'false', false),
    ('email_confirmations_enabled', 'false', false)
ON CONFLICT (key) DO NOTHING;
