ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'sonnet' CHECK (model IN ('opus', 'sonnet', 'haiku'));

-- Set correct models for existing agents based on role
UPDATE public.agents SET model = 'opus' WHERE slug IN ('cto', 'ceo', 'coo', 'cao', 'tech-leader', 'product-owner', 'software-architect');
UPDATE public.agents SET model = 'haiku' WHERE slug IN ('technical-writer', 'brand-manager', 'marketing-manager', 'sales-engineer', 'community-manager');
-- All others stay 'sonnet' (default)
