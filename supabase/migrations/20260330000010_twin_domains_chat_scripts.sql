-- Add chat_click_script and chat_read_script columns to twin_domains
-- chat_click_script: JS to click/open a specific chat by name
-- chat_read_script: JS to read messages from an open conversation

ALTER TABLE public.twin_domains
  ADD COLUMN IF NOT EXISTS chat_click_script TEXT,
  ADD COLUMN IF NOT EXISTS chat_read_script TEXT;

-- WhatsApp chat clicker
UPDATE public.twin_domains SET chat_click_script = '
  const rows = document.querySelectorAll(''[role="row"]'');
  const target = chatName.toLowerCase();
  for (const row of rows) {
    const nameSpan = row.querySelector(''span[title]'');
    const name = nameSpan?.getAttribute(''title'') || '''';
    if (name.toLowerCase().includes(target)) {
      const cell = row.querySelector(''[role="gridcell"]'') || row;
      cell.click();
      return { ok: true, chat: name };
    }
  }
  const available = Array.from(rows).slice(0, 10).map(
    (r) => r.querySelector(''span[title]'')?.getAttribute(''title'') || ''''
  ).filter(Boolean);
  return { ok: false, error: "Chat not found", available };
' WHERE slug = 'whatsapp';

-- WhatsApp chat reader
UPDATE public.twin_domains SET chat_read_script = '
  const mains = document.querySelectorAll(''#main'');
  const main = mains.length > 1 ? mains[1] : mains[0];
  if (!main) return { error: ''No conversation panel found'' };

  const chatName = main.querySelector(''header span[dir="auto"]'')?.textContent?.trim() || '''';
  const messages = [];
  const seen = new Set();
  let currentSender = '''';
  let currentDay = '''';

  main.querySelectorAll(''span[dir]'').forEach((span) => {
    const text = span.textContent?.trim();
    if (!text || text.length < 2 || seen.has(text)) return;
    if (text === chatName) return;
    seen.add(text);

    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) {
      currentDay = text;
      return;
    }

    if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) {
      if (messages.length > 0 && !messages[messages.length - 1].time) {
        messages[messages.length - 1].time = text;
      }
      return;
    }

    if (text.startsWith(''~ '') || text.startsWith(''~'')) {
      currentSender = text.replace(/^~\s*/, '''');
      return;
    }

    if (text.includes(''added'') && text.includes(''+20'')) return;
    if (text.includes(''secure service from Meta'')) return;

    messages.push({ sender: currentSender, text: text.slice(0, 500), time: '''', day: currentDay });
  });

  return { platform: ''whatsapp'', chatName, messages: messages.slice(-30), url: window.location.href };
' WHERE slug = 'whatsapp';

-- Slack chat clicker
UPDATE public.twin_domains SET chat_click_script = '
  const target = chatName.toLowerCase();
  const channels = document.querySelectorAll(''[data-qa="channel_sidebar_name_button"], [class*="channel"]'');
  for (const ch of channels) {
    const name = ch.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target)) {
      ch.click();
      return { ok: true, chat: name };
    }
  }
  return { ok: false, error: "Channel not found" };
' WHERE slug = 'slack';

-- Slack chat reader
UPDATE public.twin_domains SET chat_read_script = '
  const messages = [];
  document.querySelectorAll(''.c-message_kit__message, [data-qa="message_container"]'').forEach((msg) => {
    messages.push({
      sender: msg.querySelector(''[data-qa="message_sender_name"], .c-message__sender_button'')?.textContent?.trim() || '''',
      text: msg.querySelector(''[data-qa="message_text"], .c-message__body'')?.textContent?.trim().slice(0, 500) || '''',
      time: msg.querySelector(''.c-timestamp'')?.getAttribute(''data-ts'') || '''',
    });
  });
  const channel = document.querySelector(''[data-qa="channel_name"]'')?.textContent?.trim() || '''';
  return { platform: ''slack'', chatName: channel, messages: messages.slice(-30), url: window.location.href };
' WHERE slug = 'slack';

-- Discord chat clicker
UPDATE public.twin_domains SET chat_click_script = '
  const target = chatName.toLowerCase();
  const channels = document.querySelectorAll(''[class*="channel"] [class*="name"]'');
  for (const ch of channels) {
    const name = ch.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target)) {
      const link = ch.closest(''a, [role="link"]'');
      if (link) link.click(); else ch.click();
      return { ok: true, chat: name };
    }
  }
  return { ok: false, error: "Channel not found" };
' WHERE slug = 'discord';

-- Discord chat reader
UPDATE public.twin_domains SET chat_read_script = '
  const messages = [];
  document.querySelectorAll(''li[id^="chat-messages-"]'').forEach((msg) => {
    messages.push({
      sender: msg.querySelector(''[class*="username"]'')?.textContent?.trim() || '''',
      text: msg.querySelector(''[id^="message-content-"]'')?.textContent?.trim().slice(0, 500) || '''',
      time: msg.querySelector(''time'')?.getAttribute(''datetime'') || '''',
    });
  });
  const channel = document.querySelector(''[class*="title-"]'')?.textContent?.trim() || '''';
  return { platform: ''discord'', chatName: channel, messages: messages.slice(-30), url: window.location.href };
' WHERE slug = 'discord';

-- Telegram chat clicker
UPDATE public.twin_domains SET chat_click_script = '
  const target = chatName.toLowerCase();
  const chats = document.querySelectorAll(''.chatlist-chat, .Chat, [class*="ListItem"]'');
  for (const chat of chats) {
    const name = chat.querySelector(''.peer-title, .title, h3'')?.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target)) {
      chat.click();
      return { ok: true, chat: name };
    }
  }
  return { ok: false, error: "Chat not found" };
' WHERE slug = 'telegram';

-- Telegram chat reader
UPDATE public.twin_domains SET chat_read_script = '
  const messages = [];
  document.querySelectorAll(''.message, .Message'').forEach((msg) => {
    messages.push({
      sender: msg.querySelector(''.message-title, .peer-title'')?.textContent?.trim() || '''',
      text: msg.querySelector(''.message-text, .text-content'')?.textContent?.trim().slice(0, 500) || '''',
      time: msg.querySelector(''.message-time, .time'')?.textContent?.trim() || '''',
    });
  });
  return { platform: ''telegram'', messages: messages.slice(-30), url: window.location.href };
' WHERE slug = 'telegram';
