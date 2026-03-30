/**
 * Orchestra Twin Bridge — Popup Controller
 *
 * Handles:
 * - Connection status display
 * - Stats (active monitors, alerts today)
 * - Per-domain permission toggles
 * - Privacy mode toggle
 * - Pause / Disconnect actions
 */

// ─── Domain fallback (used if API is unreachable) ────────────────────────────
const DOMAINS_FALLBACK = [
  { id: 'gmail',      name: 'Gmail',           host: 'mail.google.com',          origin: '*://mail.google.com/*',          icon_url: 'https://www.google.com/s2/favicons?domain=mail.google.com&sz=64',     category: 'Messaging' },
  { id: 'slack',      name: 'Slack',           host: 'app.slack.com',            origin: '*://app.slack.com/*',            icon_url: 'https://www.google.com/s2/favicons?domain=slack.com&sz=64',           category: 'Messaging' },
  { id: 'whatsapp',   name: 'WhatsApp',        host: 'web.whatsapp.com',         origin: '*://web.whatsapp.com/*',         icon_url: 'https://www.google.com/s2/favicons?domain=web.whatsapp.com&sz=64',    category: 'Messaging' },
  { id: 'discord',    name: 'Discord',         host: 'discord.com',              origin: '*://discord.com/*',              icon_url: 'https://www.google.com/s2/favicons?domain=discord.com&sz=64',         category: 'Messaging' },
  { id: 'telegram',   name: 'Telegram',        host: 'web.telegram.org',         origin: '*://web.telegram.org/*',         icon_url: 'https://www.google.com/s2/favicons?domain=telegram.org&sz=64',        category: 'Messaging' },
  { id: 'twitter',    name: 'X / Twitter',     host: 'x.com',                    origin: '*://x.com/*',                    icon_url: 'https://www.google.com/s2/favicons?domain=x.com&sz=64',               category: 'Messaging' },
  { id: 'github',     name: 'GitHub',          host: 'github.com',               origin: '*://github.com/*',               icon_url: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',          category: 'Productivity' },
  { id: 'linear',     name: 'Linear',          host: 'linear.app',               origin: '*://linear.app/*',               icon_url: 'https://www.google.com/s2/favicons?domain=linear.app&sz=64',          category: 'Productivity' },
  { id: 'jira',       name: 'Jira',            host: '*.atlassian.net',          origin: '*://*.atlassian.net/*',          icon_url: 'https://www.google.com/s2/favicons?domain=atlassian.net&sz=64',       category: 'Productivity' },
  { id: 'gcal',       name: 'Google Calendar', host: 'calendar.google.com',      origin: '*://calendar.google.com/*',      icon_url: 'https://www.google.com/s2/favicons?domain=calendar.google.com&sz=64', category: 'Productivity' },
  { id: 'calcom',     name: 'Cal.com',         host: 'app.cal.com',              origin: '*://app.cal.com/*',              icon_url: 'https://www.google.com/s2/favicons?domain=cal.com&sz=64',             category: 'Productivity' },
  { id: 'gmeet',      name: 'Google Meet',     host: 'meet.google.com',          origin: '*://meet.google.com/*',          icon_url: 'https://www.google.com/s2/favicons?domain=meet.google.com&sz=64',     category: 'Productivity' },
  { id: 'zoom',       name: 'Zoom',            host: 'app.zoom.us',              origin: '*://app.zoom.us/*',              icon_url: 'https://www.google.com/s2/favicons?domain=zoom.us&sz=64',             category: 'Productivity' },
  { id: 'gcp',        name: 'GCP Billing',     host: 'console.cloud.google.com', origin: '*://console.cloud.google.com/*', icon_url: 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',    category: 'Cost Tracking' },
  { id: 'claude',     name: 'Claude.ai',       host: 'claude.ai',                origin: '*://claude.ai/*',                icon_url: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=64',           category: 'Cost Tracking' },
  { id: 'openai',     name: 'OpenAI Platform', host: 'platform.openai.com',      origin: '*://platform.openai.com/*',      icon_url: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64',          category: 'Cost Tracking' },
  { id: 'perplexity', name: 'Perplexity',      host: 'perplexity.ai',            origin: '*://perplexity.ai/*',            icon_url: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64',       category: 'Cost Tracking' },
  { id: 'x-premium',  name: 'X Premium',       host: 'x.com (Premium)',          origin: '*://x.com/*',                    icon_url: 'https://www.google.com/s2/favicons?domain=x.com&sz=64',               category: 'Cost Tracking' },
];

// Active domains list — populated from API on init, falls back to DOMAINS_FALLBACK
let DOMAINS = DOMAINS_FALLBACK;

const DOMAINS_API = 'http://localhost:9999/twin/domains';
const DOMAINS_CACHE_KEY = 'cachedDomains';
const DOMAINS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadDomains() {
  // Try in-memory cache first (from previous fetch this session)
  const cached = await chrome.storage.session?.get?.(DOMAINS_CACHE_KEY).catch(() => null);
  if (cached?.[DOMAINS_CACHE_KEY]?.ts && Date.now() - cached[DOMAINS_CACHE_KEY].ts < DOMAINS_CACHE_TTL) {
    DOMAINS = cached[DOMAINS_CACHE_KEY].data;
    return;
  }

  try {
    const resp = await fetch(DOMAINS_API, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const rows = await resp.json();
    if (Array.isArray(rows) && rows.length > 0) {
      // Normalize DB rows to same shape as DOMAINS_FALLBACK (slug → id)
      DOMAINS = rows.map((r) => ({ ...r, id: r.slug }));
      // Cache in session storage
      chrome.storage.session?.set?.({ [DOMAINS_CACHE_KEY]: { ts: Date.now(), data: DOMAINS } });
    }
  } catch (e) {
    // Go server offline — stick with fallback, no crash
    console.warn('[TwinBridge:Popup] Could not load domains from API, using fallback:', e.message);
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  connected: false,
  paused: false,
  activeMonitors: 0,
  alertsToday: 0,
  privacyMode: false,
  grantedOrigins: new Set(),
  // Dynamic scripts
  dynamicScriptCount: 0,
  scripts: {},
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadDomains();       // fetch from DB first (falls back to static if unavailable)
  await loadStatus();
  await loadPermissions();
  await loadScripts();
  renderDomainList();
  renderScriptList();
  bindEvents();

  // Poll status every 2s while popup is open
  setInterval(async () => {
    await loadStatus();
    await loadScripts();
    renderScriptList();
  }, 2000);
}

async function loadStatus() {
  const response = await sendToSW({ type: 'POPUP_REQUEST', action: 'getStatus' });
  if (!response?.ok) return;

  const { data } = response;

  state.connected = !!data.wsConnected;
  state.activeMonitors = Array.isArray(data.activeMonitors) ? data.activeMonitors.length : 0;
  state.alertsToday = data.alertsToday || 0;
  state.privacyMode = !!data.privacyMode;
  state.dynamicScriptCount = data.dynamicScriptCount || 0;

  renderStatus();
}

async function loadPermissions() {
  const response = await sendToSW({ type: 'POPUP_REQUEST', action: 'getPermissions' });
  if (response?.ok) {
    state.grantedOrigins = new Set(response.data || []);
  }
}

async function loadScripts() {
  const response = await sendToSW({ type: 'POPUP_REQUEST', action: 'getScripts' });
  if (response?.ok) {
    state.scripts = response.data || {};
    state.dynamicScriptCount = Object.keys(state.scripts).length;
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderStatus() {
  // Connection badge
  const dot = document.getElementById('connectionDot');
  const label = document.getElementById('connectionLabel');

  if (state.paused) {
    dot.className = 'dot connecting';
    label.textContent = 'Paused';
  } else if (state.connected) {
    dot.className = 'dot connected';
    label.textContent = 'Connected';
  } else {
    dot.className = 'dot disconnected';
    label.textContent = 'Disconnected';
  }

  // Stats
  document.getElementById('activeMonitors').textContent = state.activeMonitors;
  document.getElementById('alertsToday').textContent = state.alertsToday;
  document.getElementById('scriptCount').textContent = state.dynamicScriptCount;

  // Privacy toggle
  document.getElementById('privacyToggle').checked = state.privacyMode;

  // Pause button state
  const pauseBtn = document.getElementById('pauseBtn');
  if (state.paused) {
    pauseBtn.textContent = '▶ Resume';
    pauseBtn.classList.add('active');
  } else {
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.classList.remove('active');
  }
}

function renderDomainList() {
  const list = document.getElementById('domainList');
  list.innerHTML = '';

  // Group domains by category
  const categories = {};
  DOMAINS.forEach((domain) => {
    const cat = domain.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(domain);
  });

  Object.entries(categories).forEach(([category, domains]) => {
    // Category heading
    const heading = document.createElement('div');
    heading.className = 'domain-category-heading';
    heading.textContent = category;
    list.appendChild(heading);

    domains.forEach((domain) => {
      const granted = isDomainGranted(domain);
      const item = document.createElement('div');
      item.className = `domain-item ${granted ? 'granted' : ''}`;
      item.dataset.id = domain.id;

      const iconHtml = domain.icon_url
        ? `<img class="domain-icon" src="${domain.icon_url}" alt="${domain.name}" width="20" height="20" onerror="this.style.display='none'">`
        : `<span class="domain-icon">${domain.icon || '🌐'}</span>`;

      item.innerHTML = `
        <div class="domain-info">
          ${iconHtml}
          <div>
            <div class="domain-name">${domain.name}</div>
            <div class="domain-host">${domain.host}</div>
          </div>
        </div>
        <button class="domain-toggle-btn ${granted ? 'revoke' : 'grant'}" data-origin="${domain.origin}">
          ${granted ? 'Active' : 'Enable'}
        </button>
      `;

      const btn = item.querySelector('button');
      btn.addEventListener('click', () => handleDomainToggle(domain, granted, item, btn));

      list.appendChild(item);
    });
  });
}

function isDomainGranted(domain) {
  // Exact match against user-enabled origins stored in chrome.storage.
  return state.grantedOrigins.has(domain.origin);
}

function renderScriptList() {
  const list = document.getElementById('scriptList');
  const empty = document.getElementById('scriptEmpty');
  const scripts = Object.values(state.scripts);

  if (scripts.length === 0) {
    if (empty) empty.style.display = '';
    // Remove any previously-rendered script items
    list.querySelectorAll('.script-item').forEach((el) => el.remove());
    return;
  }

  if (empty) empty.style.display = 'none';

  // Build a set of currently-rendered IDs so we only add/update, not duplicate
  const rendered = new Set(
    [...list.querySelectorAll('.script-item')].map((el) => el.dataset.id)
  );

  // Remove items that no longer exist
  list.querySelectorAll('.script-item').forEach((el) => {
    if (!state.scripts[el.dataset.id]) el.remove();
  });

  // Add or update items
  for (const script of scripts) {
    let item = list.querySelector(`.script-item[data-id="${script.id}"]`);

    if (!item) {
      item = document.createElement('div');
      item.className = 'script-item';
      item.dataset.id = script.id;
      list.appendChild(item);
    }

    // Keep active class in sync
    item.classList.toggle('script-active', !!script.active);

    item.innerHTML = `
      <div class="script-info">
        <div class="script-name">${escapeHtml(script.name)}</div>
        <div class="script-domain">${escapeHtml(script.domain)}</div>
      </div>
      <div class="script-controls">
        <label class="toggle" title="${script.active ? 'Disable script' : 'Enable script'}">
          <input type="checkbox" class="script-toggle-cb" data-id="${script.id}" ${script.active ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <button class="script-unload-btn" data-id="${script.id}" title="Uninstall script">✕</button>
      </div>
    `;

    // Toggle active state
    item.querySelector('.script-toggle-cb').addEventListener('change', async (e) => {
      const active = e.target.checked;
      await sendToSW({ type: 'POPUP_REQUEST', action: 'toggleScript', scriptId: script.id, active });
      state.scripts[script.id].active = active;
      item.classList.toggle('script-active', active);
    });

    // Unload / remove script
    item.querySelector('.script-unload-btn').addEventListener('click', async () => {
      if (!confirm(`Remove script "${script.name}"?`)) return;
      await sendToSW({ type: 'POPUP_REQUEST', action: 'unloadScript', scriptId: script.id });
      delete state.scripts[script.id];
      state.dynamicScriptCount = Object.keys(state.scripts).length;
      document.getElementById('scriptCount').textContent = state.dynamicScriptCount;
      item.remove();
      if (Object.keys(state.scripts).length === 0 && empty) empty.style.display = '';
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function bindEvents() {
  // Privacy mode toggle
  document.getElementById('privacyToggle').addEventListener('change', async (e) => {
    state.privacyMode = e.target.checked;
    await sendToSW({ type: 'POPUP_REQUEST', action: 'setPrivacyMode', value: state.privacyMode });
  });

  // Kill all dynamic scripts
  document.getElementById('killScriptsBtn').addEventListener('click', async () => {
    const count = Object.keys(state.scripts).length;
    if (count === 0) return;
    if (!confirm(`Disable all ${count} dynamic script${count === 1 ? '' : 's'}?`)) return;

    await sendToSW({ type: 'POPUP_REQUEST', action: 'disableAllScripts' });

    // Update local state
    for (const id of Object.keys(state.scripts)) {
      state.scripts[id].active = false;
    }
    renderScriptList();
  });

  // Pause button
  document.getElementById('pauseBtn').addEventListener('click', async () => {
    state.paused = !state.paused;
    await sendToSW({
      type: 'POPUP_REQUEST',
      action: 'setEnabled',
      value: !state.paused,
    });
    renderStatus();
  });

  // Disconnect button
  document.getElementById('disconnectBtn').addEventListener('click', async () => {
    const confirmed = confirm('Disconnect Orchestra Twin Bridge from the server?');
    if (!confirmed) return;

    await sendToSW({ type: 'POPUP_REQUEST', action: 'setEnabled', value: false });
    state.connected = false;
    state.paused = false;
    renderStatus();
  });
}

async function handleDomainToggle(domain, currentlyGranted, item, btn) {
  btn.disabled = true;
  btn.textContent = '…';

  if (currentlyGranted) {
    const response = await sendToSW({
      type: 'POPUP_REQUEST',
      action: 'revokePermission',
      origin: domain.origin,
    });

    if (response?.ok && response.removed) {
      state.grantedOrigins.delete(domain.origin);
      item.classList.remove('granted');
      btn.className = 'domain-toggle-btn grant';
      btn.textContent = 'Enable';
    } else {
      btn.textContent = 'Active';
    }
  } else {
    const response = await sendToSW({
      type: 'POPUP_REQUEST',
      action: 'grantPermission',
      origin: domain.origin,
    });

    if (response?.ok && response.granted) {
      state.grantedOrigins.add(domain.origin);
      item.classList.add('granted');
      btn.className = 'domain-toggle-btn revoke';
      btn.textContent = 'Active';
    } else {
      btn.textContent = 'Enable';
    }
  }

  btn.disabled = false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendToSW(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
