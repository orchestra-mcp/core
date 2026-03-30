-- Add reader_script column to twin_domains
-- Stores the JavaScript function body that scrapes each platform's DOM.
-- The extension fetches these scripts from /twin/domains and executes them dynamically.

ALTER TABLE public.twin_domains
  ADD COLUMN IF NOT EXISTS reader_script TEXT;

-- Seed reader scripts for all platforms that have them

UPDATE public.twin_domains SET reader_script = '
  const threads = [];
  document.querySelectorAll(''tr.zA'').forEach((row) => {
    threads.push({
      subject: row.querySelector(''.y6'')?.textContent?.trim() || '''',
      sender: row.querySelector(''.yX'')?.textContent?.trim() || '''',
      snippet: row.querySelector(''.y2'')?.textContent?.trim() || '''',
      unread: row.classList.contains(''zE''),
      time: row.querySelector(''.xW'')?.getAttribute(''title'') || '''',
    });
  });
  return { platform: ''gmail'', threads: threads.slice(0, 20), url: window.location.href };
' WHERE slug = 'gmail';

UPDATE public.twin_domains SET reader_script = '
  const notifications = [];
  document.querySelectorAll(''.notifications-list-item, .js-notification-shelf'').forEach((item) => {
    notifications.push({
      title: item.querySelector(''.notification-list-item-link, a'')?.textContent?.trim() || '''',
      repo: item.querySelector(''.color-fg-muted, .repository-name'')?.textContent?.trim() || '''',
      type: item.querySelector(''[class*="type"]'')?.textContent?.trim() || '''',
      time: item.querySelector(''relative-time'')?.getAttribute(''datetime'') || '''',
    });
  });
  return { platform: ''github'', notifications: notifications.slice(0, 20), url: window.location.href };
' WHERE slug = 'github';

UPDATE public.twin_domains SET reader_script = '
  const messages = [];
  document.querySelectorAll(''.c-message_kit__message, [data-qa="message_container"]'').forEach((msg) => {
    messages.push({
      sender: msg.querySelector(''[data-qa="message_sender_name"], .c-message__sender_button'')?.textContent?.trim() || '''',
      text: msg.querySelector(''[data-qa="message_text"], .c-message__body'')?.textContent?.trim().slice(0, 500) || '''',
      time: msg.querySelector(''.c-timestamp'')?.getAttribute(''data-ts'') || '''',
    });
  });
  return { platform: ''slack'', messages: messages.slice(0, 20), url: window.location.href };
' WHERE slug = 'slack';

UPDATE public.twin_domains SET reader_script = '
  const chats = [];
  document.querySelectorAll(''[role="row"]'').forEach((row) => {
    const spans = row.querySelectorAll(''span[title]'');
    if (spans.length < 1) return;
    const name = spans[0]?.getAttribute(''title'') || '''';
    const lastMessage = spans[1]?.getAttribute(''title'') || '''';
    const timeEl = row.querySelector(''._ak8i span'');
    const time = timeEl?.textContent?.trim() || '''';
    let unread = false;
    row.querySelectorAll(''span'').forEach((s) => {
      const t = s.textContent?.trim();
      if (t && /^\d+$/.test(t) && parseInt(t) < 1000) {
        const r = s.getBoundingClientRect();
        if (r.width < 40 && r.height < 30) unread = true;
      }
    });
    chats.push({ name, lastMessage: lastMessage.slice(0, 200), time, unread });
  });
  return { platform: ''whatsapp'', chats: chats.slice(0, 20), url: window.location.href };
' WHERE slug = 'whatsapp';

UPDATE public.twin_domains SET reader_script = '
  const items = [];
  document.querySelectorAll(''.inbox-item, [class*="inboxItem"]'').forEach((item) => {
    items.push({
      title: item.querySelector(''[class*="title"], h3'')?.textContent?.trim() || '''',
      status: item.querySelector(''[class*="status"]'')?.textContent?.trim() || '''',
      priority: item.querySelector(''[class*="priority"]'')?.getAttribute(''aria-label'') || '''',
      time: item.querySelector(''time'')?.getAttribute(''dateTime'') || '''',
    });
  });
  return { platform: ''linear'', items: items.slice(0, 20), url: window.location.href };
' WHERE slug = 'linear';

UPDATE public.twin_domains SET reader_script = '
  const issues = [];
  document.querySelectorAll(''[data-issue-key], .issue-list-item'').forEach((item) => {
    issues.push({
      key: item.getAttribute(''data-issue-key'') || '''',
      summary: item.querySelector(''[class*="summary"], .summary'')?.textContent?.trim() || '''',
      status: item.querySelector(''[class*="status"]'')?.textContent?.trim() || '''',
      assignee: item.querySelector(''[class*="assignee"]'')?.textContent?.trim() || '''',
    });
  });
  return { platform: ''jira'', issues: issues.slice(0, 20), url: window.location.href };
' WHERE slug = 'jira';

UPDATE public.twin_domains SET reader_script = '
  const tweets = [];
  document.querySelectorAll(''[data-testid="notification"]'').forEach((tweet) => {
    tweets.push({
      type: tweet.querySelector(''[data-testid*="notification-type"]'')?.textContent?.trim() || '''',
      text: tweet.querySelector(''[data-testid="tweetText"]'')?.textContent?.trim().slice(0, 500) || '''',
      user: tweet.querySelector(''[data-testid="User-Name"]'')?.textContent?.trim() || '''',
      time: tweet.querySelector(''time'')?.getAttribute(''dateTime'') || '''',
    });
  });
  return { platform: ''twitter'', notifications: tweets.slice(0, 20), url: window.location.href };
' WHERE slug = 'twitter';
