-- Universal MCP Marketplace
-- Marketplace items (agents, skills, companies, plugins, workflows)
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  author_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agent', 'skill', 'company', 'plugin', 'workflow')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  long_description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  icon_url TEXT,
  version TEXT DEFAULT '1.0.0',
  content JSONB NOT NULL,
  readme TEXT,
  pricing TEXT DEFAULT 'free' CHECK (pricing IN ('free', 'paid', 'subscription')),
  price_cents INT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'flagged')),
  downloads INT DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  rating_count INT DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  version TEXT NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_type ON public.marketplace_items(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON public.marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_visibility ON public.marketplace_items(visibility);
CREATE INDEX IF NOT EXISTS idx_marketplace_slug ON public.marketplace_items(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_downloads ON public.marketplace_items(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_featured ON public.marketplace_items(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_author ON public.marketplace_items(author_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_org ON public.marketplace_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_user ON public.marketplace_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_item ON public.marketplace_installs(item_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_item ON public.marketplace_reviews(item_id);

-- RLS
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Public items visible to all authenticated users; private/team items visible within the org or to the author
DO $$ BEGIN
  CREATE POLICY marketplace_items_select ON public.marketplace_items FOR SELECT
    USING (
      visibility = 'public'
      OR organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
      OR author_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only the author can insert/update/delete their items
DO $$ BEGIN
  CREATE POLICY marketplace_items_insert ON public.marketplace_items FOR INSERT
    WITH CHECK (author_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_items_update ON public.marketplace_items FOR UPDATE
    USING (author_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_items_delete ON public.marketplace_items FOR DELETE
    USING (author_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Installs: users can manage their own installs
DO $$ BEGIN
  CREATE POLICY marketplace_installs_select ON public.marketplace_installs FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_installs_insert ON public.marketplace_installs FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_installs_delete ON public.marketplace_installs FOR DELETE
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reviews: visible to all, manageable by the reviewer
DO $$ BEGIN
  CREATE POLICY marketplace_reviews_select ON public.marketplace_reviews FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY marketplace_reviews_insert ON public.marketplace_reviews FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Function to increment download count (SECURITY DEFINER so callers cannot bypass RLS)
CREATE OR REPLACE FUNCTION public.marketplace_increment_downloads(item_uuid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.marketplace_items
  SET downloads = downloads + 1, updated_at = now()
  WHERE id = item_uuid;
END;
$$;

-- Trigger function to keep rating + rating_count in sync after review changes
CREATE OR REPLACE FUNCTION public.marketplace_recalculate_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _item_id UUID;
BEGIN
  -- Use OLD.item_id on DELETE, NEW.item_id otherwise
  _item_id := COALESCE(NEW.item_id, OLD.item_id);

  UPDATE public.marketplace_items SET
    rating = (
      SELECT COALESCE(AVG(rating::NUMERIC), 0)
      FROM public.marketplace_reviews
      WHERE item_id = _item_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM public.marketplace_reviews
      WHERE item_id = _item_id
    ),
    updated_at = now()
  WHERE id = _item_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS marketplace_review_rating ON public.marketplace_reviews;
CREATE TRIGGER marketplace_review_rating
AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_reviews
FOR EACH ROW EXECUTE FUNCTION public.marketplace_recalculate_rating();

-- ============================================================
-- Platform settings (idempotent — may already exist from
-- 20260329000003_platform_settings.sql and siblings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Service logs (idempotent — may already exist from
-- 20260328000011_service_logs.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_logs (
  id BIGSERIAL PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('laravel', 'go_mcp', 'studio', 'supabase')),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Activity log (idempotent — may already exist from
-- 20260328000006_memory_activity.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  summary TEXT,
  details JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_logs_service ON public.service_logs(service);
CREATE INDEX IF NOT EXISTS idx_service_logs_level ON public.service_logs(level);
CREATE INDEX IF NOT EXISTS idx_service_logs_created ON public.service_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
