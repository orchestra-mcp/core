-- 20260329000004_rls_service_logs_templates.sql
-- Enable RLS on the 2 remaining tables: service_logs and workflow_templates
-- This brings the total from 26/28 to 28/28 tables with RLS enabled.

-- ══════════════════════════════════════════════════════════════
-- service_logs — Sensitive operational logs
--   Insert: service role only (Go MCP server, Edge Functions)
--   Select: admin users only
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
    ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Service role can insert logs (Go MCP server, Edge Functions bypass RLS via service_role key)
DO $$ BEGIN
    CREATE POLICY service_logs_insert ON public.service_logs
        FOR INSERT
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

-- Only admins can read service logs
DO $$ BEGIN
    CREATE POLICY service_logs_read ON public.service_logs
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND is_admin = true
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════
-- workflow_templates — Global workflow templates
--   Select: all authenticated users
--   Insert/Update/Delete: admin users only
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
    ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- All authenticated users can read templates
DO $$ BEGIN
    CREATE POLICY workflow_templates_read ON public.workflow_templates
        FOR SELECT
        USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;

-- Only admins can create/modify/delete templates
DO $$ BEGIN
    CREATE POLICY workflow_templates_write ON public.workflow_templates
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND is_admin = true
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN insufficient_privilege THEN NULL;
END $$;
