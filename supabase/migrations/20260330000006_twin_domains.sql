-- Twin Domains — dynamic site list for the Chrome extension popup
-- Replaces the hardcoded DOMAINS array in popup.js with DB-driven config.

CREATE TABLE IF NOT EXISTS public.twin_domains (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        NOT NULL UNIQUE,   -- e.g. 'gmail', 'slack'
  name         TEXT        NOT NULL,           -- display name: 'Gmail'
  host         TEXT        NOT NULL,           -- used in popup label: 'mail.google.com'
  origin       TEXT        NOT NULL,           -- Chrome permission pattern: '*://mail.google.com/*'
  icon_url     TEXT        NOT NULL,           -- favicon / logo URL
  category     TEXT        NOT NULL,           -- 'Messaging' | 'Productivity' | 'Cost Tracking'
  sort_order   INT         NOT NULL DEFAULT 0,
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_twin_domains_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER twin_domains_updated_at
  BEFORE UPDATE ON public.twin_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_twin_domains_updated_at();

-- Public read (no auth needed — extension reads this on startup)
ALTER TABLE public.twin_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "twin_domains_public_read" ON public.twin_domains
  FOR SELECT USING (true);

-- Seed — all 19 domains with Google favicon service icons
INSERT INTO public.twin_domains (slug, name, host, origin, icon_url, category, sort_order) VALUES
  -- ── Messaging ────────────────────────────────────────────────────────────────
  ('gmail',      'Gmail',           'mail.google.com',          '*://mail.google.com/*',          'https://www.google.com/s2/favicons?domain=mail.google.com&sz=64',          'Messaging',     10),
  ('slack',      'Slack',           'app.slack.com',            '*://app.slack.com/*',            'https://www.google.com/s2/favicons?domain=slack.com&sz=64',                'Messaging',     20),
  ('whatsapp',   'WhatsApp',        'web.whatsapp.com',         '*://web.whatsapp.com/*',         'https://www.google.com/s2/favicons?domain=web.whatsapp.com&sz=64',         'Messaging',     30),
  ('discord',    'Discord',         'discord.com',              '*://discord.com/*',              'https://www.google.com/s2/favicons?domain=discord.com&sz=64',              'Messaging',     40),
  ('telegram',   'Telegram',        'web.telegram.org',         '*://web.telegram.org/*',         'https://www.google.com/s2/favicons?domain=telegram.org&sz=64',             'Messaging',     50),
  ('twitter',    'X / Twitter',     'x.com',                    '*://x.com/*',                    'https://www.google.com/s2/favicons?domain=x.com&sz=64',                    'Messaging',     60),
  -- ── Productivity ─────────────────────────────────────────────────────────────
  ('github',     'GitHub',          'github.com',               '*://github.com/*',               'https://www.google.com/s2/favicons?domain=github.com&sz=64',               'Productivity',  70),
  ('linear',     'Linear',          'linear.app',               '*://linear.app/*',               'https://www.google.com/s2/favicons?domain=linear.app&sz=64',               'Productivity',  80),
  ('jira',       'Jira',            '*.atlassian.net',          '*://*.atlassian.net/*',          'https://www.google.com/s2/favicons?domain=atlassian.net&sz=64',            'Productivity',  90),
  ('gcal',       'Google Calendar', 'calendar.google.com',      '*://calendar.google.com/*',      'https://www.google.com/s2/favicons?domain=calendar.google.com&sz=64',      'Productivity', 100),
  ('calcom',     'Cal.com',         'app.cal.com',              '*://app.cal.com/*',              'https://www.google.com/s2/favicons?domain=cal.com&sz=64',                  'Productivity', 110),
  ('gmeet',      'Google Meet',     'meet.google.com',          '*://meet.google.com/*',          'https://www.google.com/s2/favicons?domain=meet.google.com&sz=64',          'Productivity', 120),
  ('zoom',       'Zoom',            'app.zoom.us',              '*://app.zoom.us/*',              'https://www.google.com/s2/favicons?domain=zoom.us&sz=64',                  'Productivity', 130),
  -- ── Cost Tracking ────────────────────────────────────────────────────────────
  ('gcp',        'GCP Billing',     'console.cloud.google.com', '*://console.cloud.google.com/*', 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',         'Cost Tracking', 140),
  ('claude',     'Claude.ai',       'claude.ai',                '*://claude.ai/*',                'https://www.google.com/s2/favicons?domain=claude.ai&sz=64',                'Cost Tracking', 150),
  ('openai',     'OpenAI Platform', 'platform.openai.com',      '*://platform.openai.com/*',      'https://www.google.com/s2/favicons?domain=openai.com&sz=64',               'Cost Tracking', 160),
  ('perplexity', 'Perplexity',      'perplexity.ai',            '*://perplexity.ai/*',            'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64',            'Cost Tracking', 170),
  ('x-premium',  'X Premium',       'x.com (Premium)',          '*://x.com/*',                    'https://www.google.com/s2/favicons?domain=x.com&sz=64',                    'Cost Tracking', 180),
  -- ── Developer ────────────────────────────────────────────────────────────────
  ('notion',     'Notion',          'notion.so',                '*://notion.so/*',                'https://www.google.com/s2/favicons?domain=notion.so&sz=64',                'Productivity',  85),
  ('figma',      'Figma',           'figma.com',                '*://figma.com/*',                'https://www.google.com/s2/favicons?domain=figma.com&sz=64',                'Productivity',  87)
ON CONFLICT (slug) DO NOTHING;
