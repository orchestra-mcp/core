-- Add monitor configuration columns to twin_domains
-- Stores monitor scripts, intervals, and URLs so monitoring is fully dynamic.

ALTER TABLE public.twin_domains
  ADD COLUMN IF NOT EXISTS monitor_script TEXT,
  ADD COLUMN IF NOT EXISTS monitor_url TEXT,
  ADD COLUMN IF NOT EXISTS monitor_interval_min INT NOT NULL DEFAULT 0;

-- monitor_interval_min = 0 means monitoring is disabled for that domain.
-- When > 0, the extension creates a Chrome alarm that fires every N minutes.

-- Seed monitor configs for all platforms that had hardcoded monitoring

UPDATE public.twin_domains SET monitor_url = 'https://github.com/notifications', monitor_interval_min = 5, monitor_script = '
  const notifications = [];
  document.querySelectorAll(''.notifications-list-item, .js-notification-shelf'').forEach((item) => {
    notifications.push({
      title: item.querySelector(''.notification-list-item-link, a'')?.textContent?.trim() || '''',
      repo: item.querySelector(''.color-fg-muted, .repository-name'')?.textContent?.trim() || '''',
      type: item.querySelector(''[class*="type"]'')?.textContent?.trim() || '''',
      time: item.querySelector(''relative-time'')?.getAttribute(''datetime'') || '''',
    });
  });
  return { source: ''github'', notifications: notifications.slice(0, 20), url: window.location.href };
' WHERE slug = 'github';

UPDATE public.twin_domains SET monitor_url = 'https://linear.app/inbox', monitor_interval_min = 5, monitor_script = '
  const items = [];
  document.querySelectorAll(''.inbox-item, [class*="inboxItem"]'').forEach((item) => {
    items.push({
      title: item.querySelector(''[class*="title"], h3'')?.textContent?.trim() || '''',
      status: item.querySelector(''[class*="status"]'')?.textContent?.trim() || '''',
      priority: item.querySelector(''[class*="priority"]'')?.getAttribute(''aria-label'') || '''',
      time: item.querySelector(''time'')?.getAttribute(''dateTime'') || '''',
    });
  });
  return { source: ''linear'', items: items.slice(0, 20), url: window.location.href };
' WHERE slug = 'linear';

UPDATE public.twin_domains SET monitor_url = 'https://calendar.google.com', monitor_interval_min = 15, monitor_script = '
  const events = [];
  document.querySelectorAll(''[data-eventid], [data-eventchip]'').forEach((ev) => {
    events.push({
      title: ev.getAttribute(''aria-label'') || ev.textContent?.trim().slice(0, 200) || '''',
      time: ev.querySelector(''[data-datekey]'')?.textContent?.trim() || '''',
    });
  });
  return { source: ''gcal'', events: events.slice(0, 20), url: window.location.href };
' WHERE slug = 'gcal';

UPDATE public.twin_domains SET monitor_url = 'https://app.cal.com', monitor_interval_min = 15, monitor_script = '
  const bookings = [];
  document.querySelectorAll(''[data-testid*="booking"], .upcoming-booking, tr, li'').forEach((item) => {
    const text = item.textContent?.trim();
    if (text && text.length > 5 && text.length < 500) {
      bookings.push({ text: text.slice(0, 200) });
    }
  });
  return { source: ''calcom'', bookings: bookings.slice(0, 20), url: window.location.href };
' WHERE slug = 'calcom';

UPDATE public.twin_domains SET monitor_url = 'https://x.com/notifications', monitor_interval_min = 5, monitor_script = '
  const tweets = [];
  document.querySelectorAll(''[data-testid="notification"]'').forEach((tweet) => {
    tweets.push({
      type: tweet.querySelector(''[data-testid*="notification-type"]'')?.textContent?.trim() || '''',
      text: tweet.querySelector(''[data-testid="tweetText"]'')?.textContent?.trim().slice(0, 500) || '''',
      user: tweet.querySelector(''[data-testid="User-Name"]'')?.textContent?.trim() || '''',
      time: tweet.querySelector(''time'')?.getAttribute(''dateTime'') || '''',
    });
  });
  return { source: ''twitter'', notifications: tweets.slice(0, 20), url: window.location.href };
' WHERE slug = 'twitter';

UPDATE public.twin_domains SET monitor_url = 'https://console.cloud.google.com/billing', monitor_interval_min = 30, monitor_script = '
  const costs = [];
  document.querySelectorAll(''table tr, [class*="cost"], [class*="charge"]'').forEach((row) => {
    const text = row.textContent?.trim();
    if (text && text.length > 3 && text.length < 500) costs.push({ text: text.slice(0, 200) });
  });
  const total = document.querySelector(''[data-test-id="cost-summary-total"], .cfc-billing-account-overview-cost-amount'')?.textContent?.trim() || '''';
  return { source: ''gcp'', total, costs: costs.slice(0, 20), url: window.location.href };
' WHERE slug = 'gcp';

UPDATE public.twin_domains SET monitor_url = 'https://claude.ai/settings', monitor_interval_min = 15, monitor_script = '
  const info = {};
  const plan = document.querySelector(''[data-testid="plan-badge"], [class*="plan-badge"]'');
  info.plan = plan?.textContent?.trim() || '''';
  const usage = document.querySelector(''[data-testid="tokens-used"], [class*="tokens-used"], [class*="usage"]'');
  info.usage = usage?.textContent?.trim() || '''';
  return { source: ''claude'', ...info, url: window.location.href };
' WHERE slug = 'claude';

UPDATE public.twin_domains SET monitor_url = 'https://platform.openai.com/usage', monitor_interval_min = 15, monitor_script = '
  const info = {};
  const total = document.querySelector(''[data-testid="usage-total-cost"], .usage-total-cost'');
  info.totalCost = total?.textContent?.trim() || '''';
  const credit = document.querySelector(''[data-testid="credit-balance"], [class*="credit-balance"]'');
  info.creditBalance = credit?.textContent?.trim() || '''';
  return { source: ''openai'', ...info, url: window.location.href };
' WHERE slug = 'openai';

UPDATE public.twin_domains SET monitor_url = 'https://perplexity.ai/settings', monitor_interval_min = 30, monitor_script = '
  const info = {};
  const plan = document.querySelector(''[data-testid="plan-name"], [class*="plan-name"]'');
  info.plan = plan?.textContent?.trim() || '''';
  const queries = document.querySelector(''[data-testid="queries-remaining"], [class*="queries-remaining"]'');
  info.queriesRemaining = queries?.textContent?.trim() || '''';
  return { source: ''perplexity'', ...info, url: window.location.href };
' WHERE slug = 'perplexity';

UPDATE public.twin_domains SET monitor_url = 'https://x.com/i/premium_sign_up', monitor_interval_min = 60, monitor_script = '
  const info = {};
  const plan = document.querySelector(''[data-testid="premium-plan-name"], [data-testid="subscription-tier"]'');
  info.planName = plan?.textContent?.trim() || '''';
  const status = document.querySelector(''[data-testid="subscription-status"], [data-testid="premium-status"]'');
  info.status = status?.textContent?.trim() || '''';
  return { source: ''x-premium'', ...info, url: window.location.href };
' WHERE slug = 'x-premium';
