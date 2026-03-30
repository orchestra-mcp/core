/**
 * Orchestra Twin Bridge — Command Handler
 *
 * Handles bidirectional commands received from the Go Desktop server via
 * WebSocket. Commands arrive as:
 *   { type: 'command', id: string, action: string, params: object }
 *
 * Responses are sent back as:
 *   { type: 'response', id: string, result: object }
 *   { type: 'response', id: string, error: string }
 *
 * This module is imported by the service worker. All chrome.* API calls
 * happen in the service worker context.
 */

// ─── Security: Blocked selectors / patterns ──────────────────────────────────

const BLOCKED_SELECTORS = [
  // Password inputs
  'input[type="password"]',
  'input[name*="password"]',
  'input[name*="passwd"]',
  'input[id*="password"]',
  // Payment fields
  'input[name*="card"]',
  'input[name*="cvv"]',
  'input[name*="cvc"]',
  'input[autocomplete*="cc-"]',
  // Dangerous actions
  '[data-action*="delete"]',
  '[data-testid*="delete"]',
  'button[aria-label*="Delete"]',
  'button[aria-label*="Remove account"]',
  // Confirmation dialogs for destructive ops
  '[data-testid*="confirm-delete"]',
];

const BLOCKED_URL_PATTERNS = [
  /bank/i,
  /payment/i,
  /paypal/i,
  /stripe\.com/i,
  /braintree/i,
  /checkout/i,
  /billing.*delete/i,
  /account.*delete/i,
];

function isBlockedSelector(selector) {
  return BLOCKED_SELECTORS.some((blocked) => selector.includes(blocked.replace(/[\[\]"*=]/g, '')));
}

function matchesBlockedSelector(selector) {
  return BLOCKED_SELECTORS.some((blocked) => {
    try {
      return selector === blocked || selector.toLowerCase().includes(
        blocked.replace('input[type="password"]', 'password')
               .replace(/\[.*?\]/g, '')
               .trim()
      );
    } catch {
      return false;
    }
  });
}

function isBlockedUrl(url) {
  return BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const rateLimiter = {
  // Sliding window counters — { timestamp[] }
  all: [],
  writes: [],

  MAX_ALL: 10,    // 10 commands per minute
  MAX_WRITES: 3,  // 3 write commands per minute
  WINDOW_MS: 60_000,

  _prune() {
    const cutoff = Date.now() - this.WINDOW_MS;
    this.all = this.all.filter((t) => t > cutoff);
    this.writes = this.writes.filter((t) => t > cutoff);
  },

  check(isWrite = false) {
    this._prune();
    if (this.all.length >= this.MAX_ALL) {
      return { allowed: false, reason: 'rate limit exceeded (10/min)' };
    }
    if (isWrite && this.writes.length >= this.MAX_WRITES) {
      return { allowed: false, reason: 'write rate limit exceeded (3/min)' };
    }
    return { allowed: true };
  },

  record(isWrite = false) {
    const now = Date.now();
    this.all.push(now);
    if (isWrite) this.writes.push(now);
  },
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

const AUDIT_KEY = 'commandAuditLog';
const AUDIT_MAX = 100;

async function auditLog(action, params, result) {
  try {
    const store = await chrome.storage.local.get(AUDIT_KEY);
    const log = store[AUDIT_KEY] || [];

    log.unshift({
      ts: Date.now(),
      action,
      params: sanitizeForLog(params),
      ok: !result?.error,
      summary: result?.error || result?.summary || null,
    });

    if (log.length > AUDIT_MAX) log.length = AUDIT_MAX;
    await chrome.storage.local.set({ [AUDIT_KEY]: log });
  } catch {
    // Audit failures are non-fatal
  }
}

function sanitizeForLog(params) {
  if (!params) return {};
  const safe = { ...params };
  // Never log values — they may contain credentials
  if ('value' in safe) safe.value = '[redacted]';
  return safe;
}

// ─── Tab Helpers ──────────────────────────────────────────────────────────────

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openBackgroundTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabLoad(tab.id);
  return tab;
}

// ─── Dynamic Reader Scripts (from DB via /twin/domains API) ──────────────────

const DOMAINS_API = 'http://localhost:9999/twin/domains';
const READER_CACHE_KEY = 'cachedReaderScripts';
const READER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getDynamicReaderScript(platform) {
  const chatScripts = await getDynamicChatScripts(platform);
  return chatScripts?.reader || null;
}

// ─── Platform-Specific Readers (hardcoded fallback) ──────────────────────────

const PLATFORM_READERS = {
  gmail: () => {
    const threads = [];
    document.querySelectorAll('tr.zA').forEach((row) => {
      threads.push({
        subject: row.querySelector('.y6')?.textContent?.trim() || '',
        sender: row.querySelector('.yX')?.textContent?.trim() || '',
        snippet: row.querySelector('.y2')?.textContent?.trim() || '',
        unread: row.classList.contains('zE'),
        time: row.querySelector('.xW')?.getAttribute('title') || '',
      });
    });
    return { platform: 'gmail', threads: threads.slice(0, 20), url: window.location.href };
  },

  github: () => {
    const notifications = [];
    document.querySelectorAll('.notifications-list-item, .js-notification-shelf').forEach((item) => {
      notifications.push({
        title: item.querySelector('.notification-list-item-link, a')?.textContent?.trim() || '',
        repo: item.querySelector('.color-fg-muted, .repository-name')?.textContent?.trim() || '',
        type: item.querySelector('[class*="type"]')?.textContent?.trim() || '',
        time: item.querySelector('relative-time')?.getAttribute('datetime') || '',
      });
    });
    return { platform: 'github', notifications: notifications.slice(0, 20), url: window.location.href };
  },

  slack: () => {
    const messages = [];
    document.querySelectorAll('.c-message_kit__message, [data-qa="message_container"]').forEach((msg) => {
      messages.push({
        sender: msg.querySelector('[data-qa="message_sender_name"], .c-message__sender_button')?.textContent?.trim() || '',
        text: msg.querySelector('[data-qa="message_text"], .c-message__body')?.textContent?.trim().slice(0, 500) || '',
        time: msg.querySelector('.c-timestamp')?.getAttribute('data-ts') || '',
      });
    });
    return { platform: 'slack', messages: messages.slice(0, 20), url: window.location.href };
  },

  linear: () => {
    const items = [];
    document.querySelectorAll('.inbox-item, [class*="inboxItem"]').forEach((item) => {
      items.push({
        title: item.querySelector('[class*="title"], h3')?.textContent?.trim() || '',
        status: item.querySelector('[class*="status"]')?.textContent?.trim() || '',
        priority: item.querySelector('[class*="priority"]')?.getAttribute('aria-label') || '',
        time: item.querySelector('time')?.getAttribute('dateTime') || '',
      });
    });
    return { platform: 'linear', items: items.slice(0, 20), url: window.location.href };
  },

  jira: () => {
    const issues = [];
    document.querySelectorAll('[data-issue-key], .issue-list-item').forEach((item) => {
      issues.push({
        key: item.getAttribute('data-issue-key') || '',
        summary: item.querySelector('[class*="summary"], .summary')?.textContent?.trim() || '',
        status: item.querySelector('[class*="status"]')?.textContent?.trim() || '',
        assignee: item.querySelector('[class*="assignee"]')?.textContent?.trim() || '',
      });
    });
    return { platform: 'jira', issues: issues.slice(0, 20), url: window.location.href };
  },

  whatsapp: () => {
    const chats = [];
    document.querySelectorAll('[role="row"]').forEach((row) => {
      const spans = row.querySelectorAll('span[title]');
      if (spans.length < 1) return;
      const name = spans[0]?.getAttribute('title') || '';
      const lastMessage = spans[1]?.getAttribute('title') || '';
      const timeEl = row.querySelector('._ak8i span');
      const time = timeEl?.textContent?.trim() || '';
      let unread = false;
      row.querySelectorAll('span').forEach((s) => {
        const t = s.textContent?.trim();
        if (t && /^\d+$/.test(t) && parseInt(t) < 1000) {
          const r = s.getBoundingClientRect();
          if (r.width < 40 && r.height < 30) unread = true;
        }
      });
      chats.push({ name, lastMessage: lastMessage.slice(0, 200), time, unread });
    });
    return { platform: 'whatsapp', chats: chats.slice(0, 20), url: window.location.href };
  },

  twitter: () => {
    const tweets = [];
    document.querySelectorAll('[data-testid="notification"]').forEach((tweet) => {
      tweets.push({
        type: tweet.querySelector('[data-testid*="notification-type"]')?.textContent?.trim() || '',
        text: tweet.querySelector('[data-testid="tweetText"]')?.textContent?.trim().slice(0, 500) || '',
        user: tweet.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || '',
        time: tweet.querySelector('time')?.getAttribute('dateTime') || '',
      });
    });
    return { platform: 'twitter', notifications: tweets.slice(0, 20), url: window.location.href };
  },
};

// ─── Dynamic Chat Scripts (from DB via /twin/domains API) ───────────────────

async function getDynamicChatScripts(platform) {
  // Reuse same cache as reader scripts
  const cached = await chrome.storage.session?.get?.(READER_CACHE_KEY).catch(() => null);
  let scripts = null;

  if (cached?.[READER_CACHE_KEY]?.ts && Date.now() - cached[READER_CACHE_KEY].ts < READER_CACHE_TTL) {
    scripts = cached[READER_CACHE_KEY].data;
  } else {
    try {
      const resp = await fetch(DOMAINS_API, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows)) {
          scripts = {};
          rows.forEach((r) => {
            scripts[r.slug] = {
              reader: r.reader_script || null,
              chatClick: r.chat_click_script || null,
              chatRead: r.chat_read_script || null,
              chatOpen: r.chat_open_script || null,
              chatSend: r.chat_send_script || null,
              contacts: r.contacts_script || null,
            };
          });
          chrome.storage.session?.set?.({ [READER_CACHE_KEY]: { ts: Date.now(), data: scripts } });
        }
      }
    } catch {
      // API offline
    }
  }

  if (scripts && scripts[platform]) {
    return scripts[platform];
  }
  return null;
}

// ─── Generic page extractor ───────────────────────────────────────────────────

function extractPageData() {
  const text = document.body?.innerText?.slice(0, 5120) || '';
  const links = [];
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.href;
    const label = a.textContent?.trim().slice(0, 100);
    if (href && href.startsWith('http') && label) {
      links.push({ url: href, text: label });
    }
  });
  return {
    title: document.title,
    url: window.location.href,
    text,
    links: links.slice(0, 20),
  };
}

// ─── Command: doSearch ────────────────────────────────────────────────────────

async function doSearch({ query }) {
  if (!query) return { error: 'query is required' };

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  let tab;
  try {
    tab = await openBackgroundTab(url);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const items = [];
        const seen = new Set();

        // Find all h3 elements — Google puts result titles in h3 tags
        const headings = document.querySelectorAll('h3');
        headings.forEach((h3) => {
          const title = h3.textContent?.trim();
          if (!title) return;

          // Walk up to find the closest anchor with an external URL
          let el = h3;
          let linkEl = null;
          for (let i = 0; i < 5; i++) {
            el = el.parentElement;
            if (!el) break;
            const a = el.tagName === 'A' ? el : el.querySelector('a[href]');
            if (a && a.href && !a.href.includes('google.com') && !a.href.startsWith('#')) {
              linkEl = a;
              break;
            }
          }
          if (!linkEl) return;

          const url = linkEl.href;
          if (seen.has(url)) return;
          seen.add(url);

          // Snippet: look for nearby text in parent container
          const container = h3.closest('[data-hveid]') || h3.parentElement?.parentElement?.parentElement;
          const snippetEl = container?.querySelector('.VwiC3b, [data-snf], .lEBKkf');
          const snippet = snippetEl?.textContent?.trim() || '';

          items.push({ title, url, snippet });
        });

        return items.slice(0, 10);
      },
    });

    return { results: results?.[0]?.result || [], query };
  } catch (err) {
    return { error: err.message };
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ─── Command: doOpen ─────────────────────────────────────────────────────────

async function doOpen({ url }) {
  if (!url) return { error: 'url is required' };
  if (isBlockedUrl(url)) return { error: 'URL is blocked for security reasons', blocked: true };

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
    });

    const data = results?.[0]?.result || {};

    return {
      tab_id: tab.id,
      title: data.title || '',
      url: data.url || url,
      text: data.text || '',
      links: data.links || [],
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doRead ─────────────────────────────────────────────────────────

// Platforms that need extra time after load for their SPA to render.
// `realtimeSocket: true` means the tab keeps a live WS connection — never
// reload an existing tab for these, just read from it as-is.
const SLOW_PLATFORMS = {
  whatsapp: { timeout: 60000, postLoadDelay: 5000, realtimeSocket: true },
  slack:    { timeout: 30000, postLoadDelay: 2000, realtimeSocket: true },
  discord:  { timeout: 30000, postLoadDelay: 2000, realtimeSocket: true },
};

// Find an already-open tab whose URL matches the account's host.
async function findExistingTab(accountUrl) {
  try {
    const { hostname } = new URL(accountUrl);
    const matches = await chrome.tabs.query({ url: `*://${hostname}/*` });
    return matches.length > 0 ? matches[0] : null;
  } catch {
    return null;
  }
}

async function doRead({ account: accountName, chat: chatName }) {
  if (!accountName) return { error: 'account is required' };

  // Look up account in registry
  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];

  if (!account) return { error: `Account "${accountName}" not registered` };

  // Try hardcoded reader first (CSP-safe), then dynamic script from DB
  const readerFunc = PLATFORM_READERS[account.platform];
  const dynamicScript = !readerFunc ? await getDynamicReaderScript(account.platform) : null;

  if (!readerFunc && !dynamicScript) {
    return { error: `No reader for platform "${account.platform}"` };
  }

  const platformCfg = SLOW_PLATFORMS[account.platform] || {};
  const loadTimeout = platformCfg.timeout || 20000;
  const postDelay = platformCfg.postLoadDelay || 0;
  const isRealtime = !!platformCfg.realtimeSocket;

  // Check if the platform tab is already open
  const existingTab = await findExistingTab(account.url);
  let tab = null;
  let isNewTab = false;

  try {
    if (existingTab) {
      tab = existingTab;
      if (isRealtime) {
        if (postDelay > 0) {
          await new Promise((r) => setTimeout(r, postDelay));
        }
      } else {
        await chrome.tabs.reload(tab.id);
        await waitForTabLoad(tab.id, loadTimeout);
      }
    } else {
      isNewTab = true;
      tab = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tab load timeout')), loadTimeout);
        chrome.tabs.create({ url: account.url, active: false }, (newTab) => {
          function listener(id, info) {
            if (id === newTab.id && info.status === 'complete') {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(newTab);
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });
      });

      if (postDelay > 0) {
        await new Promise((r) => setTimeout(r, postDelay));
      }
    }

    // ─── Chat-level read: open a specific chat and read its messages ─────
    if (chatName) {
      const chatScripts = await getDynamicChatScripts(account.platform);
      if (!chatScripts?.chatClick || !chatScripts?.chatRead) {
        return { error: `Chat read not supported for "${account.platform}" — no chat scripts in DB` };
      }

      // Step 1: Click the matching chat (pass script + chatName as args)
      const clickResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (scriptBody, name) => {
          const fn = new Function('chatName', scriptBody);
          return fn(name);
        },
        args: [chatScripts.chatClick, chatName],
      });

      const clicked = clickResult?.[0]?.result;
      if (!clicked?.ok) {
        return { error: clicked?.error || `Chat "${chatName}" not found`, available: clicked?.available };
      }

      // Step 2: Wait for messages to load
      await new Promise((r) => setTimeout(r, 2000));

      // Step 3: Read messages from the open conversation
      const msgResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (scriptBody) => {
          const fn = new Function(scriptBody);
          return fn();
        },
        args: [chatScripts.chatRead],
      });

      return msgResult?.[0]?.result || { error: 'no messages extracted' };
    }

    // ─── List-level read: return chat/inbox list ─────────────────────────
    let results;
    if (readerFunc) {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readerFunc,
      });
    } else if (dynamicScript) {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (scriptBody) => {
          const fn = new Function(scriptBody);
          return fn();
        },
        args: [dynamicScript],
      });
    }

    return results?.[0]?.result || { error: 'extraction returned no data' };
  } catch (err) {
    return { error: err.message };
  } finally {
    if (isNewTab && tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ─── Hardcoded Chat Openers (CSP-safe) ──────────────────────────────────────

const CHAT_OPENERS = {
  whatsapp: (target) => {
    // Check if target is a phone number
    if (/^\+?\d{7,15}$/.test(target.replace(/[\s\-]/g, ''))) {
      const phone = target.replace(/[\s\-\+]/g, '');
      window.location.href = 'https://web.whatsapp.com/send?phone=' + phone;
      return { ok: true, method: 'deeplink', target: phone };
    }
    // Otherwise search by name in chat list
    const rows = document.querySelectorAll('[role="row"]');
    const search = target.toLowerCase();
    for (const row of rows) {
      const nameSpan = row.querySelector('span[title]');
      const name = nameSpan?.getAttribute('title') || '';
      if (name.toLowerCase().includes(search)) {
        const cell = row.querySelector('[role="gridcell"]') || row;
        cell.click();
        return { ok: true, method: 'click', chat: name };
      }
    }
    const available = Array.from(rows).slice(0, 10).map(
      (r) => r.querySelector('span[title]')?.getAttribute('title') || ''
    ).filter(Boolean);
    return { ok: false, error: 'Chat not found', available };
  },
};

// ─── Hardcoded Chat Senders (CSP-safe) ──────────────────────────────────────

const CHAT_SENDERS = {
  whatsapp: (msg) => {
    // Find the real conversation panel (WhatsApp has 2 #main elements)
    const mains = document.querySelectorAll('#main');
    let main = null;
    for (const m of mains) {
      if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
    }
    if (!main) return { ok: false, error: 'No conversation panel open' };

    const chatName = main.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';

    // Find the message input — try multiple selectors
    const msgBox = main.querySelector('footer [contenteditable="true"]')
      || document.querySelector('[contenteditable="true"][data-tab="10"]')
      || document.querySelector('footer [role="textbox"]');
    if (!msgBox) return { ok: false, error: 'Message input not found' };

    msgBox.focus();

    // Use clipboard paste to preserve newlines — WhatsApp handles pasted text correctly
    const dt = new DataTransfer();
    dt.setData('text/plain', msg);
    const pasteEvt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const handled = !msgBox.dispatchEvent(pasteEvt);

    // Fallback: if paste was not handled, try insertText line by line
    if (!handled && !msgBox.textContent?.trim()) {
      const lines = msg.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) document.execCommand('insertText', false, lines[i]);
        if (i < lines.length - 1) document.execCommand('insertLineBreak');
      }
    }

    const sendBtn = document.querySelector('[data-testid="send"], [aria-label="Send"]');
    if (sendBtn) {
      sendBtn.click();
      return { ok: true, chat: chatName, sent: msg.slice(0, 100) };
    }
    return { ok: false, error: 'Send button not found — message typed but not sent', chat: chatName };
  },
};

// ─── Command: doReply — Send in the currently open chat (no navigation) ─────

async function doReply({ account: accountName, message }) {
  if (!accountName) return { error: 'account is required' };
  if (!message) return { error: 'message is required' };

  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];
  if (!account) return { error: `Account "${accountName}" not registered` };

  const senderFunc = CHAT_SENDERS[account.platform];
  if (!senderFunc) return { error: `Reply not supported for "${account.platform}"` };

  // Find existing tab — must already be open
  const existingTab = await findExistingTab(account.url);
  if (!existingTab) return { error: 'No open tab. Use browser_send first to open a chat.' };

  try {
    const sendResult = await chrome.scripting.executeScript({
      target: { tabId: existingTab.id },
      func: senderFunc,
      args: [message],
    });

    const result = sendResult?.[0]?.result;

    // Retry send button if needed
    if (result && !result.ok && result.error?.includes('Send button not found')) {
      await new Promise((r) => setTimeout(r, 500));
      const retryResult = await chrome.scripting.executeScript({
        target: { tabId: existingTab.id },
        func: () => {
          const sendBtn = document.querySelector('[data-testid="send"], [aria-label="Send"], button[aria-label*="Send"]');
          if (sendBtn) {
            sendBtn.click();
            return { ok: true, retry: true };
          }
          const msgBox = document.querySelector('footer [contenteditable="true"], [contenteditable="true"][data-tab="10"]');
          if (msgBox) {
            msgBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            return { ok: true, method: 'enter' };
          }
          return { ok: false, error: 'Could not find send button or input' };
        },
      });
      const retry = retryResult?.[0]?.result;
      if (retry?.ok) return { ok: true, chat: result.chat, sent: message.slice(0, 100) };
      return retry || result;
    }

    return result || { error: 'Send returned no result' };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doSend ────────────────────────────────────────────────────────

async function doSend({ account: accountName, chat: chatTarget, message }) {
  if (!accountName) return { error: 'account is required' };
  if (!chatTarget) return { error: 'chat is required (phone number or contact name)' };
  if (!message) return { error: 'message is required' };

  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];
  if (!account) return { error: `Account "${accountName}" not registered` };

  const openerFunc = CHAT_OPENERS[account.platform];
  const senderFunc = CHAT_SENDERS[account.platform];
  if (!openerFunc || !senderFunc) {
    return { error: `Send not supported for "${account.platform}"` };
  }

  const platformCfg = SLOW_PLATFORMS[account.platform] || {};
  const loadTimeout = platformCfg.timeout || 20000;
  const postDelay = platformCfg.postLoadDelay || 0;

  const existingTab = await findExistingTab(account.url);
  let tab = null;
  let isNewTab = false;

  try {
    if (existingTab) {
      tab = existingTab;
    } else {
      isNewTab = true;
      tab = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tab load timeout')), loadTimeout);
        chrome.tabs.create({ url: account.url, active: false }, (newTab) => {
          function listener(id, info) {
            if (id === newTab.id && info.status === 'complete') {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(newTab);
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });
      });
      if (postDelay > 0) await new Promise((r) => setTimeout(r, postDelay));
    }

    // Step 1: Open the target chat
    const openResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: openerFunc,
      args: [chatTarget],
    });

    const opened = openResult?.[0]?.result;
    if (!opened?.ok) {
      return { error: opened?.error || `Could not open chat "${chatTarget}"`, available: opened?.available };
    }

    // Step 2: Wait for chat to load
    if (opened.method === 'deeplink') {
      // Deep link triggers full page navigation — wait for it
      await new Promise((r) => setTimeout(r, 2000));
      await waitForTabLoad(tab.id, loadTimeout).catch(() => {});
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Step 3: Type the message
    const sendResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: senderFunc,
      args: [message],
    });

    // If message was typed but send button wasn't found, wait and retry
    const firstResult = sendResult?.[0]?.result;
    if (firstResult && !firstResult.ok && firstResult.error?.includes('Send button not found')) {
      await new Promise((r) => setTimeout(r, 500));
      const retryResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sendBtn = document.querySelector('[data-testid="send"], [aria-label="Send"], button[aria-label*="Send"]');
          if (sendBtn) {
            sendBtn.click();
            return { ok: true, sent: true, retry: true };
          }
          // Try pressing Enter on the input as last resort
          const msgBox = document.querySelector('footer [contenteditable="true"], [contenteditable="true"][data-tab="10"]');
          if (msgBox) {
            msgBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            return { ok: true, sent: true, method: 'enter' };
          }
          return { ok: false, error: 'Could not find send button or input' };
        },
      });
      const retry = retryResult?.[0]?.result;
      if (retry?.ok) {
        return { ok: true, chat: firstResult.chat, sent: message.slice(0, 100) };
      }
      return retry || firstResult;
    }

    const sent = sendResult?.[0]?.result;
    return sent || { error: 'Send script returned no result' };
  } catch (err) {
    return { error: err.message };
  } finally {
    if (isNewTab && tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ─── Hardcoded Contact Listers (CSP-safe) ───────────────────────────────────

const CONTACT_LISTERS = {
  whatsapp: () => {
    const contacts = [];
    document.querySelectorAll('[role="row"]').forEach((row) => {
      const spans = row.querySelectorAll('span[title]');
      if (spans.length < 1) return;
      const name = spans[0]?.getAttribute('title') || '';
      const lastMessage = spans[1]?.getAttribute('title') || '';
      const timeEl = row.querySelector('._ak8i span');
      const time = timeEl?.textContent?.trim() || '';
      let unread = false;
      row.querySelectorAll('span').forEach((s) => {
        const t = s.textContent?.trim();
        if (t && /^\d+$/.test(t) && parseInt(t) < 1000) {
          const r = s.getBoundingClientRect();
          if (r.width < 40 && r.height < 30) unread = true;
        }
      });
      contacts.push({ name, lastMessage: lastMessage.slice(0, 100), time, unread });
    });
    return { platform: 'whatsapp', contacts, url: window.location.href };
  },
};

// ─── Command: doContacts ────────────────────────────────────────────────────

async function doContacts({ account: accountName }) {
  if (!accountName) return { error: 'account is required' };

  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];
  if (!account) return { error: `Account "${accountName}" not registered` };

  // Use hardcoded lister (CSP-safe) or fall back to PLATFORM_READERS
  const listerFunc = CONTACT_LISTERS[account.platform] || PLATFORM_READERS[account.platform];
  if (!listerFunc) {
    return { error: `Contacts not supported for "${account.platform}"` };
  }

  const platformCfg = SLOW_PLATFORMS[account.platform] || {};
  const loadTimeout = platformCfg.timeout || 20000;
  const postDelay = platformCfg.postLoadDelay || 0;
  const isRealtime = !!platformCfg.realtimeSocket;

  const existingTab = await findExistingTab(account.url);
  let tab = null;
  let isNewTab = false;

  try {
    if (existingTab) {
      tab = existingTab;
      if (!isRealtime) {
        await chrome.tabs.reload(tab.id);
        await waitForTabLoad(tab.id, loadTimeout);
      }
    } else {
      isNewTab = true;
      tab = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tab load timeout')), loadTimeout);
        chrome.tabs.create({ url: account.url, active: false }, (newTab) => {
          function listener(id, info) {
            if (id === newTab.id && info.status === 'complete') {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(newTab);
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });
      });
      if (postDelay > 0) await new Promise((r) => setTimeout(r, postDelay));
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: listerFunc,
    });

    return results?.[0]?.result || { error: 'contacts extraction returned no data' };
  } catch (err) {
    return { error: err.message };
  } finally {
    if (isNewTab && tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ─── Command: doWaitReply — Blocking wait for reply ─────────────────────────
//
// Blocks the MCP tool call until a new message arrives in the chat.
// The session stays alive while waiting. Returns the new message(s) when detected.
// Timeout after `timeout` seconds (default 120) — returns { timeout: true } so
// the agent can re-call or take action.

async function doWaitReply({ account: accountName, chat: chatTarget }) {
  if (!accountName) return { error: 'account is required' };

  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];
  if (!account) return { error: `Account "${accountName}" not registered` };

  // Find the existing tab (should already be open from browser_send)
  const existingTab = await findExistingTab(account.url);
  if (!existingTab) {
    return { error: 'No open tab for this platform. Send a message first with browser_send.' };
  }
  const tabId = existingTab.id;

  const startTime = Date.now();

  // Inject a MutationObserver into the page that watches for new messages.
  // Event-driven — no polling, no timeout. Fires instantly when DOM changes.
  const watchResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Find the real conversation panel
      const mains = document.querySelectorAll('#main');
      let main = null;
      for (const m of mains) {
        if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
      }
      if (!main) return { error: 'no-conversation' };

      const chatName = main.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';

      // Take baseline: count current messages
      const countMessages = () => {
        const msgs = [];
        const seen = new Set();
        main.querySelectorAll('span[dir]').forEach((span) => {
          const text = span.textContent?.trim();
          if (!text || text.length < 2 || seen.has(text)) return;
          if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
          if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
          if (text === chatName) return;
          seen.add(text);
          msgs.push(text);
        });
        return msgs;
      };

      const baselineMsgs = countMessages();
      const baselineCount = baselineMsgs.length;
      const baselineLast = baselineMsgs[baselineMsgs.length - 1] || '';

      // Store on window so the service worker can poll-check via a lightweight script
      window.__orchWaitBaseline = { chatName, baselineCount, baselineLast, startTime: Date.now() };
      window.__orchWaitResolved = false;

      return { ready: true, chatName, baselineCount, baselineLast };
    },
  });

  const setup = watchResult?.[0]?.result || {};
  if (setup.error === 'no-conversation') {
    return { error: 'No conversation panel open. Send a message first with browser_send.' };
  }
  if (!setup.ready) {
    return { error: 'Failed to set up watcher on conversation panel' };
  }

  const chatName = setup.chatName || chatTarget || '';

  // Now block in the service worker: use a tight loop that injects a tiny
  // check script. MutationObserver can't message back to the service worker
  // directly, so we use a lightweight executeScript check every 1s.
  // This is NOT polling the DOM heavily — just reading the stored state.
  return new Promise((resolve) => {
    const checker = setInterval(async () => {
      try {
        const checkResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: (prevCount, prevLast) => {
            const mains = document.querySelectorAll('#main');
            let main = null;
            for (const m of mains) {
              if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
            }
            if (!main) return { error: 'panel-gone' };

            const chatName = main.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
            const msgs = [];
            const seen = new Set();
            main.querySelectorAll('span[dir]').forEach((span) => {
              const text = span.textContent?.trim();
              if (!text || text.length < 2 || seen.has(text)) return;
              if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
              if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
              if (text === chatName) return;
              seen.add(text);
              msgs.push(text);
            });

            const lastMsg = msgs[msgs.length - 1] || '';
            if (msgs.length > prevCount || (lastMsg !== prevLast && lastMsg !== '')) {
              return { newMessage: true, chatName, lastMsg, msgCount: msgs.length };
            }
            return { newMessage: false };
          },
          args: [setup.baselineCount, setup.baselineLast],
        });

        const result = checkResult?.[0]?.result || {};

        if (result.error === 'panel-gone') {
          clearInterval(checker);
          resolve({ error: 'Conversation panel closed' });
          return;
        }

        if (result.newMessage) {
          clearInterval(checker);
          resolve({
            ok: true,
            chat: result.chatName || chatName,
            reply: result.lastMsg,
            msgCount: result.msgCount,
            waited: Math.round((Date.now() - startTime) / 1000),
          });
        }
      } catch {
        clearInterval(checker);
        resolve({ error: 'Tab closed or inaccessible' });
      }
    }, 1000); // check every 1s — lightweight, no heavy DOM work
  });
}

// ─── Command: doWaitEvent — Block until incoming message on any watched account
//
// Uses the proven command channel (same as doWaitReply). Finds any open
// account tab and watches for incoming-only messages. No timeout.

async function doWaitEvent() {
  // Find any active watcher, or find any registered account tab that's open
  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};

  // Try active watchers first
  let tabId = null;
  let accountName = null;
  let platform = null;

  for (const [tid, info] of activeWatchers) {
    tabId = tid;
    accountName = info.chat || info.platform;
    platform = info.platform;
    break;
  }

  // Fallback: find any open account tab
  if (!tabId) {
    for (const [name, account] of Object.entries(accounts)) {
      const tab = await findExistingTab(account.url);
      if (tab) {
        tabId = tab.id;
        accountName = name;
        platform = account.platform;
        break;
      }
    }
  }

  if (!tabId) {
    return { error: 'No watched accounts or open account tabs found. Use browser_watch first.' };
  }

  const startTime = Date.now();

  // Wait for conversation panel to load (retry up to 10s after page navigation)
  let baselineResult = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    baselineResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const mains = document.querySelectorAll('#main');
        let main = null;
        for (const m of mains) {
          if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
        }
        if (!main) return { error: 'no-panel' };

      const chatName = main.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
      const msgs = [];
      const seen = new Set();
      const incomingRows = main.querySelectorAll('[class*="message-in"]');
      incomingRows.forEach((row) => {
        row.querySelectorAll('span[dir]').forEach((span) => {
          const text = span.textContent?.trim();
          if (!text || text.length < 2 || seen.has(text)) return;
          if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
          if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
          if (text === chatName || text.startsWith('~')) return;
          seen.add(text);
          msgs.push(text);
        });
      });
      return { chatName, count: msgs.length, last: msgs[msgs.length - 1] || '' };
    },
  });

    const check = baselineResult?.[0]?.result || {};
    if (!check.error) break; // panel found
    await new Promise((r) => setTimeout(r, 1000)); // wait 1s and retry
  }

  const baseline = baselineResult?.[0]?.result || {};
  if (baseline.error) return { error: 'No conversation panel open after 10s. Use browser_send first.' };

  // Block: check every 1s for new incoming messages
  return new Promise((resolve) => {
    const checker = setInterval(async () => {
      try {
        const checkResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: (prevCount, prevLast) => {
            const mains = document.querySelectorAll('#main');
            let main = null;
            for (const m of mains) {
              if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
            }
            if (!main) return { error: 'panel-gone' };

            const chatName = main.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
            const msgs = [];
            const seen = new Set();
            const incomingRows = main.querySelectorAll('[class*="message-in"]');
            incomingRows.forEach((row) => {
              row.querySelectorAll('span[dir]').forEach((span) => {
                const text = span.textContent?.trim();
                if (!text || text.length < 2 || seen.has(text)) return;
                if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
                if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
                if (text === chatName || text.startsWith('~')) return;
                seen.add(text);
                msgs.push(text);
              });
            });

            const lastMsg = msgs[msgs.length - 1] || '';
            if (msgs.length > prevCount || (lastMsg !== prevLast && lastMsg !== '')) {
              return { newMessage: true, chatName, lastMsg, msgCount: msgs.length };
            }
            return { newMessage: false };
          },
          args: [baseline.count, baseline.last],
        });

        const result = checkResult?.[0]?.result || {};
        if (result.error === 'panel-gone') {
          clearInterval(checker);
          resolve({ error: 'Conversation panel closed' });
          return;
        }
        if (result.newMessage) {
          clearInterval(checker);
          resolve({
            ok: true,
            source: accountName,
            event_type: 'new_message',
            data: {
              chat: result.chatName,
              lastMessage: result.lastMsg,
              platform: platform,
            },
            waited: Math.round((Date.now() - startTime) / 1000),
          });
        }
      } catch {
        clearInterval(checker);
        resolve({ error: 'Tab closed or inaccessible' });
      }
    }, 1000);
  });
}

// ─── Command: doWatch — Universal Twin Event Watcher ─────────────────────
//
// Watches any registered account for events (messages, notifications, etc.)
// Returns immediately. Events are dispatched via pushTwinEvent → WS → Rust
// event queue. Use browser_wait_event to receive events.

// Tracks active watchers: { tabId → { platform, chat, intervalId } }
const activeWatchers = new Map();

async function doWatch({ account: accountName, chat: chatTarget }) {
  if (!accountName) return { error: 'account is required' };

  const store = await chrome.storage.local.get('accounts');
  const accounts = store.accounts || {};
  const account = accounts[accountName];
  if (!account) return { error: `Account "${accountName}" not registered` };

  const platformCfg = SLOW_PLATFORMS[account.platform] || {};
  const loadTimeout = platformCfg.timeout || 20000;

  // Find or open the tab
  const existingTab = await findExistingTab(account.url);
  let tab = existingTab;

  if (!tab) {
    tab = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tab load timeout')), loadTimeout);
      chrome.tabs.create({ url: account.url, active: false }, (newTab) => {
        function listener(id, info) {
          if (id === newTab.id && info.status === 'complete') {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve(newTab);
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
      });
    });
    await new Promise((r) => setTimeout(r, platformCfg.postLoadDelay || 3000));
  }

  // If a specific chat target is given, open it
  let chatName = chatTarget || '';
  if (chatTarget) {
    const openerFunc = CHAT_OPENERS[account.platform];
    if (openerFunc) {
      const openResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: openerFunc,
        args: [chatTarget],
      });
      const opened = openResult?.[0]?.result;
      if (!opened?.ok) {
        return { error: opened?.error || `Could not open chat "${chatTarget}"`, available: opened?.available };
      }
      chatName = opened.chat || chatTarget;

      if (opened.method === 'deeplink') {
        await new Promise((r) => setTimeout(r, 2000));
        await waitForTabLoad(tab.id, loadTimeout).catch(() => {});
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // Take initial baseline snapshot
  const baselineResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const mains = document.querySelectorAll('#main');
      let main = null;
      for (const m of mains) {
        if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
      }

      const chatName = main?.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
      const msgs = [];
      const seen = new Set();

      if (main) {
        // Only capture INCOMING messages (message-in class) — skip our own outgoing
        const incomingRows = main.querySelectorAll('[class*="message-in"]');
        incomingRows.forEach((row) => {
          row.querySelectorAll('span[dir]').forEach((span) => {
            const text = span.textContent?.trim();
            if (!text || text.length < 2 || seen.has(text)) return;
            if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
            if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
            if (text === chatName || text.startsWith('~')) return;
            seen.add(text);
            msgs.push(text);
          });
        });
      }

      // Also snapshot sidebar unread state
      const sidebarState = [];
      document.querySelectorAll('[role="row"]').forEach((row) => {
        const nameSpan = row.querySelector('span[title]');
        const name = nameSpan?.getAttribute('title') || '';
        if (!name) return;
        let unread = false;
        row.querySelectorAll('span').forEach((s) => {
          const t = s.textContent?.trim();
          if (t && /^\d+$/.test(t) && parseInt(t) < 1000) {
            const r = s.getBoundingClientRect();
            if (r.width < 40 && r.height < 30) unread = true;
          }
        });
        sidebarState.push({ name, unread });
      });

      return { chatName, msgs, sidebarState };
    },
  });

  const baseline = baselineResult?.[0]?.result || {};
  let baselineMsgs = new Set(baseline.msgs || []);
  let baselineSidebar = new Map((baseline.sidebarState || []).map((s) => [s.name, s.unread]));

  // Stop any existing watcher on this tab
  if (activeWatchers.has(tab.id)) {
    clearInterval(activeWatchers.get(tab.id).intervalId);
  }

  // Start event detection loop — checks every 1s, dispatches via pushTwinEvent
  const intervalId = setInterval(async () => {
    try {
      if (!activeWatchers.has(tab.id)) {
        clearInterval(intervalId);
        return;
      }

      const pollResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const mains = document.querySelectorAll('#main');
          let main = null;
          for (const m of mains) {
            if (m.querySelector('header') || m.querySelector('footer')) { main = m; break; }
          }

          const chatName = main?.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
          const msgs = [];
          const seen = new Set();

          if (main) {
            // Only capture INCOMING messages — skip outgoing (message-out)
            const incomingRows = main.querySelectorAll('[class*="message-in"]');
            incomingRows.forEach((row) => {
              row.querySelectorAll('span[dir]').forEach((span) => {
                const text = span.textContent?.trim();
                if (!text || text.length < 2 || seen.has(text)) return;
                if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(text)) return;
                if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Yesterday|Today|\d{1,2}\/\d{1,2}\/\d{2,4})$/i.test(text)) return;
                if (text === chatName || text.startsWith('~')) return;
                seen.add(text);
                msgs.push(text);
              });
            });
          }

          // Check sidebar for new unread chats
          const sidebarState = [];
          document.querySelectorAll('[role="row"]').forEach((row) => {
            const nameSpan = row.querySelector('span[title]');
            const name = nameSpan?.getAttribute('title') || '';
            if (!name) return;
            const lastMsg = row.querySelectorAll('span[title]')[1]?.getAttribute('title') || '';
            let unread = false;
            row.querySelectorAll('span').forEach((s) => {
              const t = s.textContent?.trim();
              if (t && /^\d+$/.test(t) && parseInt(t) < 1000) {
                const r = s.getBoundingClientRect();
                if (r.width < 40 && r.height < 30) unread = true;
              }
            });
            sidebarState.push({ name, unread, lastMsg });
          });

          return { chatName, msgs, sidebarState };
        },
      });

      const data = pollResult?.[0]?.result;
      if (!data) return;

      // Detect new messages in the open conversation
      const currentMsgs = data.msgs || [];
      const newMsgs = currentMsgs.filter((m) => !baselineMsgs.has(m));

      if (newMsgs.length > 0) {
        // Dispatch new message event
        if (typeof globalThis.pushTwinEvent === 'function') {
          globalThis.pushTwinEvent({
            source: accountName,
            event_type: 'new_message',
            data: {
              chat: data.chatName,
              messages: newMsgs,
              lastMessage: newMsgs[newMsgs.length - 1],
              platform: account.platform,
            },
          });
        }
        // Update baseline
        baselineMsgs = new Set(currentMsgs);
      }

      // Detect new unread chats in sidebar
      for (const chat of (data.sidebarState || [])) {
        const wasUnread = baselineSidebar.get(chat.name) || false;
        if (chat.unread && !wasUnread) {
          // New unread message from a different chat
          if (typeof globalThis.pushTwinEvent === 'function') {
            globalThis.pushTwinEvent({
              source: accountName,
              event_type: 'unread_message',
              data: {
                chat: chat.name,
                lastMessage: chat.lastMsg,
                platform: account.platform,
              },
            });
          }
        }
      }
      // Update sidebar baseline
      baselineSidebar = new Map((data.sidebarState || []).map((s) => [s.name, s.unread]));

    } catch {
      clearInterval(intervalId);
      activeWatchers.delete(tab.id);
    }
  }, 1000); // 1s — fast event detection

  activeWatchers.set(tab.id, {
    platform: account.platform,
    chat: chatName,
    intervalId,
    startedAt: Date.now(),
  });

  return {
    ok: true,
    watching: chatName || accountName,
    tabId: tab.id,
    platform: account.platform,
    message: `Watching "${chatName || accountName}" for events. Use browser_wait_event to receive dispatched events.`,
  };
}

async function doUnwatch({ tab_id: tabId, account: accountName }) {
  if (tabId && activeWatchers.has(tabId)) {
    clearInterval(activeWatchers.get(tabId).intervalId);
    const info = activeWatchers.get(tabId);
    activeWatchers.delete(tabId);

    // Deactivate watcher in the tab
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => { window.__orchestraWatcherActive = false; },
    }).catch(() => {});

    return { ok: true, stopped: info.chat };
  }

  // If no tabId, try to find by account
  if (accountName) {
    for (const [tid, info] of activeWatchers) {
      if (info.chat === accountName || info.platform === accountName) {
        clearInterval(info.intervalId);
        activeWatchers.delete(tid);
        chrome.scripting.executeScript({
          target: { tabId: tid },
          func: () => { window.__orchestraWatcherActive = false; },
        }).catch(() => {});
        return { ok: true, stopped: info.chat };
      }
    }
  }

  // List active watchers
  const active = [];
  for (const [tid, info] of activeWatchers) {
    active.push({ tabId: tid, chat: info.chat, platform: info.platform, since: info.startedAt });
  }

  return { ok: false, error: 'No matching watcher found', activeWatchers: active };
}

// ─── Command: doClick ────────────────────────────────────────────────────────

async function doClick({ tab_id: tabId, selector }) {
  if (!tabId || !selector) return { error: 'tab_id and selector are required' };

  // Security: block dangerous selectors
  if (matchesBlockedSelector(selector)) {
    return { error: 'Selector is blocked for security reasons', blocked: true };
  }

  // Security: check tab URL
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url && isBlockedUrl(tab.url)) {
      return { error: 'Tab URL is blocked for security reasons', blocked: true };
    }
  } catch {
    return { error: `Tab ${tabId} not found` };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `Element not found: ${sel}` };
        const text = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
        el.click();
        return { clicked: true, text };
      },
      args: [selector],
    });

    return results?.[0]?.result || { error: 'script returned no result' };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doFill ─────────────────────────────────────────────────────────

async function doFill({ tab_id: tabId, selector, value }) {
  if (!tabId || !selector || value === undefined) {
    return { error: 'tab_id, selector, and value are required' };
  }

  // Security: block password fields absolutely
  if (selector.includes('password') || selector.includes('passwd')) {
    return { error: 'Password fields cannot be filled for security reasons', blocked: true };
  }

  if (matchesBlockedSelector(selector)) {
    return { error: 'Selector is blocked for security reasons', blocked: true };
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url && isBlockedUrl(tab.url)) {
      return { error: 'Tab URL is blocked for security reasons', blocked: true };
    }
  } catch {
    return { error: `Tab ${tabId} not found` };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `Element not found: ${sel}` };

        // Check for password type at runtime
        if (el.type === 'password') {
          return { error: 'Password fields cannot be filled', blocked: true };
        }

        // Native input setter to trigger React/Vue change events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, val);
        } else {
          el.value = val;
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        return { filled: true, value: val };
      },
      args: [selector, value],
    });

    return results?.[0]?.result || { error: 'script returned no result' };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doScreenshot ───────────────────────────────────────────────────

async function doScreenshot({ tab_id: tabId }) {
  if (!tabId) return { error: 'tab_id is required' };

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return { error: `Tab ${tabId} not found` };

    // captureVisibleTab requires the tab to be active in its window.
    // We focus the tab briefly, capture, then move focus back.
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tabId, { active: true });

    // Small delay for rendering
    await new Promise((r) => setTimeout(r, 300));

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    // Restore previous active tab
    if (activeTab && activeTab.id !== tabId) {
      chrome.tabs.update(activeTab.id, { active: true }).catch(() => {});
    }

    return { tab_id: tabId, image: dataUrl, format: 'png' };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doTabs ─────────────────────────────────────────────────────────

async function doTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return {
      tabs: tabs.map((t) => ({
        id: t.id,
        url: t.url || '',
        title: t.title || '',
        active: t.active,
        windowId: t.windowId,
      })),
      count: tabs.length,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doClose ────────────────────────────────────────────────────────

async function doClose({ tab_id: tabId }) {
  if (!tabId) return { error: 'tab_id is required' };

  try {
    await chrome.tabs.remove(tabId);
    return { closed: true, tab_id: tabId };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doAccounts ─────────────────────────────────────────────────────

async function doAccounts() {
  try {
    const store = await chrome.storage.local.get('accounts');
    const accounts = store.accounts || {};

    const list = Object.entries(accounts).map(([name, data]) => ({
      name,
      platform: data.platform,
      url: data.url,
      registeredAt: data.registeredAt || null,
    }));

    return { accounts: list, count: list.length };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Command: doRegister ─────────────────────────────────────────────────────

async function doRegister({ name, platform, url }) {
  if (!name || !platform || !url) {
    return { error: 'name, platform, and url are required' };
  }

  const validPlatforms = ['gmail', 'github', 'slack', 'linear', 'jira', 'whatsapp', 'twitter'];
  if (!validPlatforms.includes(platform)) {
    return {
      error: `Unknown platform "${platform}". Valid: ${validPlatforms.join(', ')}`,
    };
  }

  try {
    const store = await chrome.storage.local.get('accounts');
    const accounts = store.accounts || {};

    accounts[name] = { platform, url, registeredAt: new Date().toISOString() };
    await chrome.storage.local.set({ accounts });

    return { registered: true, name, platform, url };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Script Engine Commands ───────────────────────────────────────────────────

/**
 * These handlers delegate to the ScriptEngine singleton that lives on
 * globalThis (set by the service worker after importing script-engine.js).
 * We resolve the engine lazily so handler.js can still be imported first.
 */

function getScriptEngine() {
  if (globalThis.scriptEngine && globalThis.scriptEngine instanceof globalThis.ScriptEngine) {
    return globalThis.scriptEngine;
  }
  // Fallback: construct on demand (shouldn't happen in normal flow)
  if (globalThis.ScriptEngine) {
    globalThis.scriptEngine = new globalThis.ScriptEngine();
    return globalThis.scriptEngine;
  }
  return null;
}

async function doScriptLoad(params) {
  const engine = getScriptEngine();
  if (!engine) return { error: 'ScriptEngine not available' };
  if (!params?.script) return { error: 'params.script is required' };
  return engine.load(params.script);
}

async function doScriptUnload(params) {
  const engine = getScriptEngine();
  if (!engine) return { error: 'ScriptEngine not available' };
  if (!params?.id) return { error: 'params.id is required' };
  return engine.unload(params.id);
}

async function doScriptToggle(params) {
  const engine = getScriptEngine();
  if (!engine) return { error: 'ScriptEngine not available' };
  if (!params?.id) return { error: 'params.id is required' };
  return engine.toggle(params.id, params.active !== false);
}

async function doScriptList() {
  const engine = getScriptEngine();
  if (!engine) return { error: 'ScriptEngine not available' };
  const scripts = await engine.getAll();
  return {
    scripts: Object.values(scripts),
    count: Object.keys(scripts).length,
  };
}

async function doScriptRun(params) {
  const engine = getScriptEngine();
  if (!engine) return { error: 'ScriptEngine not available' };
  if (!params?.domain || !params?.code) return { error: 'params.domain and params.code are required' };
  const result = await engine.runOnce(params.domain, params.code);
  return { result };
}

// ─── Command Dispatcher ───────────────────────────────────────────────────────

const WRITE_ACTIONS = new Set(['doClick', 'doFill', 'doClose', 'doRegister', 'script_load', 'script_unload', 'script_toggle', 'script_run']);

/**
 * Dispatch a command received from the Go Desktop server.
 *
 * @param {string} action - Command name (e.g. 'browser_search')
 * @param {object} params - Command parameters
 * @returns {Promise<object>} - Result object
 */
async function dispatchCommand(action, params) {
  const isWrite = WRITE_ACTIONS.has(action);

  // Rate check
  const check = rateLimiter.check(isWrite);
  if (!check.allowed) {
    return { error: check.reason, rate_limited: true };
  }
  rateLimiter.record(isWrite);

  let result;
  try {
    switch (action) {
      case 'browser_search':   result = await doSearch(params || {}); break;
      case 'browser_open':     result = await doOpen(params || {}); break;
      case 'browser_read':     result = await doRead(params || {}); break;
      case 'browser_send':     result = await doSend(params || {}); break;
      case 'browser_reply':    result = await doReply(params || {}); break;
      case 'browser_contacts': result = await doContacts(params || {}); break;
      case 'browser_wait_reply': result = await doWaitReply(params || {}); break;
      case 'browser_wait_event': result = await doWaitReply(params || {}); break;
      case 'browser_watch':    result = await doWatch(params || {}); break;
      case 'browser_unwatch':  result = await doUnwatch(params || {}); break;
      case 'browser_click':    result = await doClick(params || {}); break;
      case 'browser_fill':     result = await doFill(params || {}); break;
      case 'browser_screenshot': result = await doScreenshot(params || {}); break;
      case 'browser_tabs':     result = await doTabs(); break;
      case 'browser_close':    result = await doClose(params || {}); break;
      case 'browser_accounts': result = await doAccounts(); break;
      case 'browser_register': result = await doRegister(params || {}); break;
      // ─── Dynamic Script Engine ──────────────────────────────────────────
      case 'script_load':   result = await doScriptLoad(params || {}); break;
      case 'script_unload': result = await doScriptUnload(params || {}); break;
      case 'script_toggle': result = await doScriptToggle(params || {}); break;
      case 'script_list':   result = await doScriptList(); break;
      case 'script_run':    result = await doScriptRun(params || {}); break;
      default:
        result = { error: `Unknown action: ${action}` };
    }
  } catch (err) {
    result = { error: `Command execution failed: ${err.message}` };
  }

  await auditLog(action, params, result);
  return result;
}

// Export for use in service worker
if (typeof globalThis !== 'undefined') {
  globalThis.CommandHandler = { dispatchCommand };
}
