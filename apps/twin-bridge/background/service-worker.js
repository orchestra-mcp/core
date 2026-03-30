/**
 * Orchestra Twin Bridge — Service Worker (MV3)
 *
 * Responsibilities:
 * - Manage offscreen document lifecycle
 * - Route messages from content scripts to offscreen WebSocket bridge
 * - Run Active Monitor Manager for background tab polling
 * - Manage "Orchestra" tab group for active monitored tabs
 * - Execute bidirectional commands received from the Go Desktop server
 */

// Import the command handler (MV3 service workers support importScripts).
importScripts('../commands/handler.js');

// Import the dynamic script engine.
importScripts('../engine/script-engine.js');

// Singleton ScriptEngine instance shared across the service worker lifetime.
// Assigned to globalThis so commands/handler.js can resolve it via getScriptEngine().
const scriptEngine = new ScriptEngine();
globalThis.scriptEngine = scriptEngine;

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');
const ORCHESTRA_GROUP_TITLE = 'Orchestra';
const ORCHESTRA_GROUP_COLOR = 'purple';

// ─── Twin Event Push Bridge ─────────────────────────────────────────────────
// Allows handler.js (imported before this file) to push events through WS.
// Events go: handler.js → pushTwinEvent → offscreen → WS → Rust → event queue
globalThis.pushTwinEvent = (eventData) => {
  forwardToOffscreen({
    type: 'TWIN_EVENT',
    source: eventData.source || 'unknown',
    eventType: eventData.event_type || 'event',
    data: eventData.data || {},
    timestamp: Date.now(),
  }).catch((err) => {
    console.warn('[TwinBridge] Failed to push twin event:', err.message);
  });
};

// ─── Offscreen Document ───────────────────────────────────────────────────────

let offscreenCreating = null;

async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;

  // Prevent concurrent creation attempts
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['LOCAL_STORAGE'],
    justification: 'Maintain persistent WebSocket connection to Orchestra Twin server',
  });

  try {
    await offscreenCreating;
  } finally {
    offscreenCreating = null;
  }
}

// ─── Dynamic Script Auto-Injection ───────────────────────────────────────────

/**
 * Whenever a tab finishes loading, check whether any active dynamic scripts
 * match the tab's domain and inject them if needed.
 */
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;

  // Ignore internal / extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  let tabHost;
  try {
    tabHost = new URL(tab.url).hostname;
  } catch {
    return;
  }

  const scripts = await scriptEngine.getAll();
  for (const script of Object.values(scripts)) {
    if (script.active && tabHost.endsWith(script.domain)) {
      await scriptEngine.inject(tabId, script);
    }
  }
});

// ─── Install Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  console.log('[TwinBridge] Installed:', reason);
  await ensureOffscreenDocument();
  setupAlarms();

  // Initialize storage defaults
  const existing = await chrome.storage.local.get(['token', 'enabled', 'privacyMode']);
  if (existing.enabled === undefined) {
    await chrome.storage.local.set({ enabled: true, privacyMode: false, alertsToday: 0 });
  }
});

// Ensure offscreen doc on service worker wake-up
chrome.runtime.onStartup.addListener(async () => {
  await ensureOffscreenDocument();
  setupAlarms();
});

// ─── Meeting State ────────────────────────────────────────────────────────────

// Tracks active meeting sessions per source (gmeet / zoom).
// Captions accumulate here until meeting_ended, then the full log is forwarded.
const activeMeetings = new Map(); // meetingId → { source, title, platform, participants, captions, startedAt }

// Tracks which sources have user opt-in for caption monitoring.
// Stored in chrome.storage.local under 'meetingCaptionsEnabled'.
let meetingCaptionsEnabled = {};

// Load persisted caption opt-in state on SW wake
chrome.storage.local.get('meetingCaptionsEnabled', ({ meetingCaptionsEnabled: stored }) => {
  if (stored) meetingCaptionsEnabled = stored;
});

/**
 * Handle a meeting_detected event from a content script.
 * Shows the opt-in prompt via popup badge update (no real notification API in MV3 SW).
 * Stores the detected meeting so the popup can display it.
 */
async function handleMeetingDetected(message) {
  const { source, data } = message;
  const platform = data.platform || source;

  // Store pending opt-in request
  await chrome.storage.local.set({
    pendingMeetingOptIn: { source, platform, title: data.title, meetingId: data.meetingId, ts: Date.now() },
  });

  // Update badge to signal pending action
  chrome.action.setBadgeText({ text: '●' });
  chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
}

/**
 * Handle a meeting_started event from a content script.
 * Creates a new session tracking object.
 */
function handleMeetingStarted(message) {
  const { source, data } = message;
  const id = data.meetingId || `${source}_${Date.now()}`;

  activeMeetings.set(id, {
    source,
    platform: data.platform || source,
    title: data.title || null,
    participants: data.participants || [],
    captions: [],
    startedAt: Date.now(),
  });

  chrome.storage.local.set({ activeMeeting: { id, source, platform: data.platform, title: data.title } });
}

/**
 * Handle a caption event from a content script.
 * Appends to the active session's caption log, then forwards to offscreen.
 */
function handleCaption(message) {
  const { data } = message;
  const meetingId = data.meetingId;

  if (meetingId && activeMeetings.has(meetingId)) {
    activeMeetings.get(meetingId).captions.push({
      speaker: data.speaker,
      text: data.text,
      lang: data.lang,
      ts: data.ts,
    });
  }

  // Forward individual caption to offscreen for real-time processing
  forwardToOffscreen({ ...message }).catch(() => {});
}

/**
 * Handle a meeting_ended event from a content script.
 * Compiles the full caption log and forwards to offscreen for summary generation.
 */
async function handleMeetingEnded(message) {
  const { source, data } = message;
  const meetingId = data.meetingId;

  const session = meetingId ? activeMeetings.get(meetingId) : null;

  // Forward to offscreen with all accumulated captions
  await forwardToOffscreen({
    ...message,
    data: {
      ...data,
      captions: session?.captions ?? [],
      participants: session?.participants ?? [],
      title: session?.title ?? data.title ?? null,
      startedAt: session?.startedAt ?? null,
    },
  }).catch(() => {});

  // Clean up
  if (meetingId) activeMeetings.delete(meetingId);
  await chrome.storage.local.remove('activeMeeting');
  chrome.action.setBadgeText({ text: '' });
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Offscreen document requesting initial config
  if (message.type === 'OFFSCREEN_INIT') {
    chrome.storage.local.get(['token', 'enabled']).then((data) => {
      sendResponse({ token: data.token || null, enabled: data.enabled !== false });
    });
    return true;
  }

  // Offscreen document forwarding events back (status, alerts, auth)
  if (message.type === 'OFFSCREEN_EVENT') {
    handleOffscreenEvent(message.event, message.data);
    sendResponse({ ok: true });
    return;
  }

  // Command forwarded from offscreen — execute via CommandHandler and respond.
  if (message.type === 'EXECUTE_COMMAND') {
    const { id, action, params } = message;
    if (!globalThis.CommandHandler) {
      sendResponse({ result: { error: 'CommandHandler not loaded' } });
      return;
    }

    globalThis.CommandHandler.dispatchCommand(action, params)
      .then((result) => sendResponse({ result }))
      .catch((err) => sendResponse({ result: { error: err.message } }));

    return true; // async sendResponse
  }

  const source = sender.tab
    ? new URL(sender.tab.url || '').hostname
    : 'internal';

  console.log(`[TwinBridge] Message from ${source}:`, message.type);

  // ─── Meeting event routing ──────────────────────────────────────────────────

  if (message.type === 'meeting_detected') {
    handleMeetingDetected({ ...message, source }).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'meeting_started') {
    handleMeetingStarted({ ...message, source });
    // Also forward to offscreen for server-side recording
    forwardToOffscreen({ ...message, _source: source, _tabId: sender.tab?.id }).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'caption') {
    handleCaption({ ...message, source });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'meeting_ended') {
    handleMeetingEnded({ ...message, source }).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  // ─── Caption opt-in control (from popup) ───────────────────────────────────

  if (message.type === 'POPUP_REQUEST' && message.action === 'approveMeetingCaptions') {
    const { meetingSource } = message;
    (async () => {
      meetingCaptionsEnabled[meetingSource] = true;
      chrome.storage.local.set({ meetingCaptionsEnabled });

      // Notify all tabs for this source to start caption monitoring
      const tabs = await chrome.tabs.query({});
      tabs.forEach((tab) => {
        if (!tab.id) return;
        const isGMeet = meetingSource === 'gmeet' && tab.url?.includes('meet.google.com');
        const isZoom = meetingSource === 'zoom' && tab.url?.includes('app.zoom.us');
        if (isGMeet || isZoom) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'MEETING_CAPTIONS_ENABLED',
            source: meetingSource,
          }).catch(() => {});
        }
      });

      await chrome.storage.local.remove('pendingMeetingOptIn');
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    })();
    return true; // async sendResponse
  }

  if (message.type === 'POPUP_REQUEST' && message.action === 'denyMeetingCaptions') {
    chrome.storage.local.remove('pendingMeetingOptIn');
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return;
  }

  // ─── Forward all other content script events to offscreen ──────────────────

  // Forward content script events to offscreen WebSocket bridge
  if (message.type && message.type !== 'POPUP_REQUEST') {
    forwardToOffscreen({ ...message, _source: source, _tabId: sender.tab?.id })
      .catch((err) => {
        console.warn('[TwinBridge] Forward warning:', err.message);
      });
    // Respond immediately — don't wait for offscreen round-trip
    sendResponse({ ok: true });
    return;
  }

  // Popup requests
  if (message.type === 'POPUP_REQUEST') {
    handlePopupRequest(message, sendResponse);
    return true;
  }
});

async function handleOffscreenEvent(event, data) {
  switch (event) {
    case 'STATUS_UPDATE':
      await chrome.storage.local.set(data);
      break;
    case 'AUTH_STATUS':
      await chrome.storage.local.set({ authStatus: data.status, authError: data.error || null });
      break;
    case 'SERVER_CONFIG':
      await chrome.storage.local.set({ serverConfig: data });
      break;
    case 'ALERT':
      const store = await chrome.storage.local.get('alertsToday');
      await chrome.storage.local.set({ alertsToday: (store.alertsToday || 0) + 1 });
      break;
  }
}

async function forwardToOffscreen(payload) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ target: 'offscreen', payload });
}

async function handlePopupRequest(message, sendResponse) {
  const { action } = message;

  if (action === 'getStatus') {
    const data = await chrome.storage.local.get([
      'wsConnected', 'activeMonitors', 'alertsToday', 'enabled', 'privacyMode',
      'activeMeeting', 'pendingMeetingOptIn',
    ]);
    // Attach dynamic script count
    const allScripts = await scriptEngine.getAll();
    data.dynamicScriptCount = Object.keys(allScripts).length;
    sendResponse({ ok: true, data });
    return;
  }

  if (action === 'getScripts') {
    const scripts = await scriptEngine.getAll();
    sendResponse({ ok: true, data: scripts });
    return;
  }

  if (action === 'toggleScript') {
    const result = await scriptEngine.toggle(message.scriptId, message.active);
    sendResponse({ ok: true, data: result });
    return;
  }

  if (action === 'unloadScript') {
    const result = await scriptEngine.unload(message.scriptId);
    sendResponse({ ok: true, data: result });
    return;
  }

  if (action === 'disableAllScripts') {
    const scripts = await scriptEngine.getAll();
    for (const id of Object.keys(scripts)) {
      await scriptEngine.toggle(id, false);
    }
    sendResponse({ ok: true, disabled: Object.keys(scripts).length });
    return;
  }

  if (action === 'setEnabled') {
    await chrome.storage.local.set({ enabled: message.value });
    await forwardToOffscreen({ type: 'CONTROL', command: message.value ? 'connect' : 'disconnect' });
    sendResponse({ ok: true });
    return;
  }

  if (action === 'setPrivacyMode') {
    await chrome.storage.local.set({ privacyMode: message.value });
    sendResponse({ ok: true });
    return;
  }

  if (action === 'getPermissions') {
    // Return the user's explicitly enabled origins (stored in local storage).
    // We do NOT use chrome.permissions.getAll() because content_scripts
    // in the manifest make those origins non-removable by Chrome.
    const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
    sendResponse({ ok: true, data: enabledOrigins });
    return;
  }

  if (action === 'grantPermission') {
    // Try to request the Chrome permission (first-time grant, shows dialog).
    // For content_script-backed origins Chrome may silently succeed or already have it.
    let granted = true;
    try {
      granted = await chrome.permissions.request({ origins: [message.origin] });
    } catch (_) {
      granted = true; // already granted — not an error
    }
    if (granted) {
      const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
      if (!enabledOrigins.includes(message.origin)) {
        enabledOrigins.push(message.origin);
        await chrome.storage.local.set({ enabledOrigins });
      }
    }
    sendResponse({ ok: true, granted });
    return;
  }

  if (action === 'revokePermission') {
    // Remove from our enabled list — do NOT call chrome.permissions.remove()
    // because Chrome rejects removal of permissions backed by manifest content_scripts.
    const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
    const updated = enabledOrigins.filter((o) => o !== message.origin);
    await chrome.storage.local.set({ enabledOrigins: updated });
    sendResponse({ ok: true, removed: true });
    return;
  }

  sendResponse({ ok: false, error: 'Unknown action' });
}

// ─── Active Monitor Manager (Dynamic from DB) ──────────────────────────────

const MONITOR_API = 'http://localhost:9999/twin/domains';
const MONITOR_CACHE_KEY = 'cachedMonitorConfigs';
const MONITOR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch monitor configs from the API. Each domain with monitor_interval_min > 0
 * and a monitor_url becomes an active monitor.
 */
async function getMonitorConfigs() {
  // Try cache first
  const cached = await chrome.storage.session?.get?.(MONITOR_CACHE_KEY).catch(() => null);
  if (cached?.[MONITOR_CACHE_KEY]?.ts && Date.now() - cached[MONITOR_CACHE_KEY].ts < MONITOR_CACHE_TTL) {
    return cached[MONITOR_CACHE_KEY].data;
  }

  try {
    const resp = await fetch(MONITOR_API, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];

    const configs = rows
      .filter((r) => r.monitor_interval_min > 0 && r.monitor_url)
      .map((r) => ({
        id: r.slug,
        url: r.monitor_url,
        alarm: `monitor_${r.slug.replace(/-/g, '_')}`,
        intervalMin: r.monitor_interval_min,
        monitorScript: r.monitor_script || null,
      }));

    chrome.storage.session?.set?.({ [MONITOR_CACHE_KEY]: { ts: Date.now(), data: configs } });
    return configs;
  } catch {
    return [];
  }
}

async function setupAlarms() {
  const configs = await getMonitorConfigs();

  // Clear old alarms that no longer exist in DB
  const allAlarms = await chrome.alarms.getAll();
  const validAlarmNames = new Set(configs.map((c) => c.alarm));
  for (const alarm of allAlarms) {
    if (alarm.name.startsWith('monitor_') && !validAlarmNames.has(alarm.name)) {
      chrome.alarms.clear(alarm.name);
    }
  }

  // Create/update alarms from DB configs
  for (const { alarm, intervalMin } of configs) {
    const existing = await chrome.alarms.get(alarm);
    if (!existing) {
      chrome.alarms.create(alarm, { periodInMinutes: intervalMin, delayInMinutes: 0.5 });
    }
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const configs = await getMonitorConfigs();
  const config = configs.find((m) => m.alarm === alarm.name);
  if (!config) return;

  const { enabled, enabledOrigins = [] } = await chrome.storage.local.get(['enabled', 'enabledOrigins']);
  if (!enabled) return;

  // Only run background monitors for domains the user has explicitly enabled
  const origin = new URL(config.url).hostname;
  const isEnabled = enabledOrigins.some((pattern) => {
    const hostPart = pattern.replace(/^\*?:\/\//, '').replace(/\/.*$/, '');
    return hostPart.startsWith('*.') ? origin.endsWith(hostPart.slice(1)) : origin === hostPart;
  });
  if (!isEnabled) return;

  await runBackgroundMonitor(config);
});

/**
 * Background monitor lifecycle (tab reuse aware):
 * 1. Check if the platform tab is already open
 * 2. If open + realtime: read directly (no reload, no close)
 * 3. If open + standard: reload then read (no close)
 * 4. If not open: create tab, read, close
 * 5. Execute dynamic monitor script from DB
 * 6. Push to twin log via offscreen WS → Go desktop server → DB
 */
async function runBackgroundMonitor(config) {
  let tab = null;
  let isNewTab = false;

  // Check SLOW_PLATFORMS from handler.js for realtime config
  const realtimeSlugs = ['whatsapp', 'slack', 'discord', 'telegram'];
  const isRealtime = realtimeSlugs.includes(config.id);

  try {
    // Try to find an existing tab for this platform
    let existingTab = null;
    try {
      const { hostname } = new URL(config.url);
      const matches = await chrome.tabs.query({ url: `*://${hostname}/*` });
      if (matches.length > 0) existingTab = matches[0];
    } catch {}

    if (existingTab) {
      tab = existingTab;
      if (!isRealtime) {
        // Standard apps: refresh to get latest data
        await chrome.tabs.reload(tab.id);
        await waitForTabLoad(tab.id, 15000);
      }
      // Realtime apps: read directly from the live tab (don't reload)
    } else {
      // No existing tab — open one in the background
      isNewTab = true;
      tab = await chrome.tabs.create({ url: config.url, active: false });
      await waitForTabLoad(tab.id, 15000);
    }

    let results;
    if (config.monitorScript) {
      // Dynamic script from DB — pass as arg, eval in content script isolated world
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (scriptBody) => {
          const fn = new Function(scriptBody);
          return fn();
        },
        args: [config.monitorScript],
      });
    } else {
      // Fallback: generic page text extraction
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          source: document.title,
          text: document.body?.innerText?.slice(0, 2000) || '',
          url: window.location.href,
        }),
      });
    }

    const data = results?.[0]?.result;
    if (data) {
      // Push to twin log via offscreen WebSocket (reaches Go desktop server → DB)
      await forwardToOffscreen({
        type: 'TWIN_LOG',
        source: config.id,
        data,
        timestamp: Date.now(),
      });

      // Also push via MONITOR_DATA for backward compat
      await forwardToOffscreen({
        type: 'MONITOR_DATA',
        source: config.id,
        data,
        timestamp: Date.now(),
      });

      // Update active monitors count
      const store = await chrome.storage.local.get('activeMonitors');
      const monitors = new Set(store.activeMonitors || []);
      monitors.add(config.id);
      await chrome.storage.local.set({ activeMonitors: [...monitors] });
    }
  } catch (err) {
    console.error(`[TwinBridge] Monitor ${config.id} failed:`, err.message);
  } finally {
    // Only close the tab if we opened it ourselves
    if (isNewTab && tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
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

// Legacy extractMonitorData removed — monitor scripts are now dynamic from DB.

// ─── Tab Group Manager ────────────────────────────────────────────────────────

/**
 * Adds a tab to the "Orchestra" group (creates it if needed).
 * Collapses the group so it stays out of the way.
 */
async function addToOrchestraGroup(tabId) {
  try {
    const windows = await chrome.windows.getAll({ populate: false });
    const windowId = windows[0]?.id;
    if (!windowId) return;

    // Find existing Orchestra group in this window
    const groups = await chrome.tabGroups.query({ title: ORCHESTRA_GROUP_TITLE, windowId });
    let groupId;

    if (groups.length > 0) {
      groupId = groups[0].id;
    } else {
      groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, {
        title: ORCHESTRA_GROUP_TITLE,
        color: ORCHESTRA_GROUP_COLOR,
        collapsed: true,
      });
      return;
    }

    await chrome.tabs.group({ groupId, tabIds: [tabId] });
    await chrome.tabGroups.update(groupId, { collapsed: true });
  } catch (err) {
    // tabGroups API may not be available in all Chrome versions — silent fail
    console.warn('[TwinBridge] tabGroups error:', err.message);
  }
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { runBackgroundMonitor, waitForTabLoad, MONITOR_CONFIGS };
}
