-- Add send and contacts scripts to twin_domains
-- chat_send_script: JS to type and send a message in an open chat
-- contacts_script: JS to list all contacts/channels/chats
-- chat_open_script: JS to open a chat by phone number or identifier (deep link approach)

ALTER TABLE public.twin_domains
  ADD COLUMN IF NOT EXISTS chat_send_script TEXT,
  ADD COLUMN IF NOT EXISTS contacts_script TEXT,
  ADD COLUMN IF NOT EXISTS chat_open_script TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WhatsApp
-- ═══════════════════════════════════════════════════════════════════════════════

-- WhatsApp: open chat by phone number or name
-- Receives: target (phone number like "201207860084" or contact name)
-- Uses deep link for phone numbers, sidebar click for names
UPDATE public.twin_domains SET chat_open_script = '
  if (/^\+?\d{7,15}$/.test(target.replace(/[\s\-]/g, ''''))) {
    const phone = target.replace(/[\s\-\+]/g, '''');
    window.location.href = ''https://web.whatsapp.com/send?phone='' + phone;
    return { ok: true, method: ''deeplink'', target: phone };
  }
  const rows = document.querySelectorAll(''[role="row"]'');
  const search = target.toLowerCase();
  for (const row of rows) {
    const nameSpan = row.querySelector(''span[title]'');
    const name = nameSpan?.getAttribute(''title'') || '''';
    if (name.toLowerCase().includes(search)) {
      const cell = row.querySelector(''[role="gridcell"]'') || row;
      cell.click();
      return { ok: true, method: ''click'', chat: name };
    }
  }
  const available = Array.from(rows).slice(0, 10).map(
    (r) => r.querySelector(''span[title]'')?.getAttribute(''title'') || ''''
  ).filter(Boolean);
  return { ok: false, error: ''Chat not found'', available };
' WHERE slug = 'whatsapp';

-- WhatsApp: send message in the currently open chat
-- Receives: message (string)
UPDATE public.twin_domains SET chat_send_script = '
  const mains = document.querySelectorAll(''#main'');
  const main = mains.length > 1 ? mains[1] : mains[0];
  if (!main) return { ok: false, error: ''No conversation panel open'' };

  const chatName = main.querySelector(''header span[dir="auto"]'')?.textContent?.trim() || '''';
  const footer = main.querySelector(''footer'') || main;
  const msgBox = footer.querySelector(''[contenteditable="true"][data-tab="10"], [role="textbox"][contenteditable="true"]'');
  if (!msgBox) return { ok: false, error: ''Message input not found'' };

  msgBox.focus();
  document.execCommand(''insertText'', false, message);

  await new Promise(r => setTimeout(r, 300));

  const sendBtn = document.querySelector(''[data-testid="send"], [aria-label="Send"]'');
  if (sendBtn) {
    sendBtn.click();
    return { ok: true, chat: chatName, sent: message.slice(0, 100) };
  }
  return { ok: false, error: ''Send button not found — message typed but not sent'', chat: chatName };
' WHERE slug = 'whatsapp';

-- WhatsApp: list all contacts/chats
UPDATE public.twin_domains SET contacts_script = '
  const contacts = [];
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
    contacts.push({ name, lastMessage: lastMessage.slice(0, 100), time, unread });
  });
  return { platform: ''whatsapp'', contacts, url: window.location.href };
' WHERE slug = 'whatsapp';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Slack
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.twin_domains SET chat_open_script = '
  const target_lower = target.toLowerCase();
  const channels = document.querySelectorAll(''[data-qa="channel_sidebar_name_button"], [class*="p-channel_sidebar__channel"]'');
  for (const ch of channels) {
    const name = ch.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target_lower)) {
      ch.click();
      return { ok: true, method: ''click'', chat: name };
    }
  }
  return { ok: false, error: ''Channel not found'' };
' WHERE slug = 'slack';

UPDATE public.twin_domains SET chat_send_script = '
  const msgBox = document.querySelector(''[data-qa="message_input"] [contenteditable="true"], .ql-editor[contenteditable="true"]'');
  if (!msgBox) return { ok: false, error: ''Message input not found'' };
  msgBox.focus();
  document.execCommand(''insertText'', false, message);
  await new Promise(r => setTimeout(r, 300));
  const sendBtn = document.querySelector(''[data-qa="texty_send_button"], [aria-label="Send now"]'');
  if (sendBtn) {
    sendBtn.click();
    return { ok: true, sent: message.slice(0, 100) };
  }
  msgBox.dispatchEvent(new KeyboardEvent(''keydown'', { key: ''Enter'', code: ''Enter'', keyCode: 13, bubbles: true }));
  return { ok: true, sent: message.slice(0, 100), method: ''enter'' };
' WHERE slug = 'slack';

UPDATE public.twin_domains SET contacts_script = '
  const channels = [];
  document.querySelectorAll(''[data-qa="channel_sidebar_name_button"]'').forEach((ch) => {
    channels.push({ name: ch.textContent?.trim() || '''', type: ''channel'' });
  });
  document.querySelectorAll(''[data-qa="im_browser_row"]'').forEach((dm) => {
    channels.push({ name: dm.textContent?.trim() || '''', type: ''dm'' });
  });
  return { platform: ''slack'', contacts: channels, url: window.location.href };
' WHERE slug = 'slack';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Discord
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.twin_domains SET chat_open_script = '
  const target_lower = target.toLowerCase();
  const channels = document.querySelectorAll(''[class*="channel"] [class*="name"], [data-list-item-id]'');
  for (const ch of channels) {
    const name = ch.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target_lower)) {
      const link = ch.closest(''a, [role="link"]'');
      if (link) link.click(); else ch.click();
      return { ok: true, method: ''click'', chat: name };
    }
  }
  return { ok: false, error: ''Channel not found'' };
' WHERE slug = 'discord';

UPDATE public.twin_domains SET chat_send_script = '
  const msgBox = document.querySelector(''[role="textbox"][data-slate-editor="true"], [class*="slateTextArea"]'');
  if (!msgBox) return { ok: false, error: ''Message input not found'' };
  msgBox.focus();
  document.execCommand(''insertText'', false, message);
  await new Promise(r => setTimeout(r, 300));
  msgBox.dispatchEvent(new KeyboardEvent(''keydown'', { key: ''Enter'', code: ''Enter'', keyCode: 13, bubbles: true }));
  return { ok: true, sent: message.slice(0, 100) };
' WHERE slug = 'discord';

UPDATE public.twin_domains SET contacts_script = '
  const channels = [];
  document.querySelectorAll(''[class*="channel"] [class*="name"]'').forEach((ch) => {
    channels.push({ name: ch.textContent?.trim() || '''', type: ''channel'' });
  });
  return { platform: ''discord'', contacts: channels, url: window.location.href };
' WHERE slug = 'discord';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Telegram
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.twin_domains SET chat_open_script = '
  const target_lower = target.toLowerCase();
  const chats = document.querySelectorAll(''.chatlist-chat, .Chat, [class*="ListItem"]'');
  for (const chat of chats) {
    const name = chat.querySelector(''.peer-title, .title, h3'')?.textContent?.trim() || '''';
    if (name.toLowerCase().includes(target_lower)) {
      chat.click();
      return { ok: true, method: ''click'', chat: name };
    }
  }
  return { ok: false, error: ''Chat not found'' };
' WHERE slug = 'telegram';

UPDATE public.twin_domains SET chat_send_script = '
  const msgBox = document.querySelector(''.input-message-input[contenteditable="true"], [id="editable-message-text"]'');
  if (!msgBox) return { ok: false, error: ''Message input not found'' };
  msgBox.focus();
  document.execCommand(''insertText'', false, message);
  await new Promise(r => setTimeout(r, 300));
  const sendBtn = document.querySelector(''.send-btn, .Button.send, button[class*="send"]'');
  if (sendBtn) {
    sendBtn.click();
    return { ok: true, sent: message.slice(0, 100) };
  }
  msgBox.dispatchEvent(new KeyboardEvent(''keydown'', { key: ''Enter'', code: ''Enter'', keyCode: 13, bubbles: true }));
  return { ok: true, sent: message.slice(0, 100), method: ''enter'' };
' WHERE slug = 'telegram';

UPDATE public.twin_domains SET contacts_script = '
  const contacts = [];
  document.querySelectorAll(''.chatlist-chat, .Chat, [class*="ListItem"]'').forEach((chat) => {
    const name = chat.querySelector(''.peer-title, .title, h3'')?.textContent?.trim() || '''';
    const msg = chat.querySelector(''.last-message, .subtitle'')?.textContent?.trim()?.slice(0, 100) || '''';
    if (name) contacts.push({ name, lastMessage: msg });
  });
  return { platform: ''telegram'', contacts, url: window.location.href };
' WHERE slug = 'telegram';
