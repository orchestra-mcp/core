/**
 * Orchestra Twin Bridge — Offscreen WebSocket Bridge
 *
 * Runs in the offscreen document (persistent across service worker restarts).
 * Maintains a WebSocket connection to ws://localhost:9800/twin.
 *
 * IMPORTANT: chrome.storage is NOT available in offscreen documents.
 * All state is in-memory. Config is received via messages from service worker.
 *
 * Protocol:
 *   Auth:    → { type: 'auth', token, extension_id }
 *   Event:   → { type: 'event', source, data, timestamp }
 *   Control: → { type: 'ping' }
 *   Server:  ← { type: 'ack' | 'config' | 'alert' | 'pong', ... }
 */

const WS_URL = 'ws://localhost:9997/twin';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const PING_INTERVAL_MS = 25000;
const MAX_QUEUE_SIZE = 500;

let ws = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let pingTimer = null;
let isConnected = false;
let token = null;
let extensionId = chrome.runtime.id;

// In-memory offline queue (chrome.storage not available here)
let offlineQueue = [];

// ─── Initialization ───────────────────────────────────────────────────────────

function init() {
  // Request initial config from service worker
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_INIT' }, (response) => {
    if (response) {
      token = response.token || null;
      if (response.enabled !== false) {
        connect();
      }
    } else {
      // No response — connect anyway with no token
      connect();
    }
  });
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  console.log(`[TwinBridge:Offscreen] Connecting to ${WS_URL} (attempt ${reconnectAttempt + 1})`);

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.error('[TwinBridge:Offscreen] WebSocket creation failed:', err);
    scheduleReconnect();
    return;
  }

  ws.onopen = handleOpen;
  ws.onmessage = handleMessage;
  ws.onerror = handleError;
  ws.onclose = handleClose;
}

function handleOpen() {
  console.log('[TwinBridge:Offscreen] Connected');
  isConnected = true;
  reconnectAttempt = 0;

  // Notify service worker of connection status
  notifyServiceWorker('STATUS_UPDATE', { wsConnected: true });

  // Auth handshake
  send({ type: 'auth', token, extension_id: extensionId });

  // Start ping keepalive
  clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (isConnected) send({ type: 'ping' });
  }, PING_INTERVAL_MS);

  // Flush offline queue
  flushQueue();
}

function handleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    console.warn('[TwinBridge:Offscreen] Unparseable message:', event.data);
    return;
  }

  console.log('[TwinBridge:Offscreen] Received:', msg.type);

  switch (msg.type) {
    case 'ack':
      break;

    case 'config':
      // Forward config to service worker for storage
      notifyServiceWorker('SERVER_CONFIG', msg.data);
      break;

    case 'alert':
      // Forward alert to service worker for notification + counting
      notifyServiceWorker('ALERT', msg);
      break;

    case 'pong':
      break;

    case 'auth_ok':
      console.log('[TwinBridge:Offscreen] Auth successful');
      notifyServiceWorker('AUTH_STATUS', { status: 'authenticated' });
      break;

    case 'auth_fail':
      console.error('[TwinBridge:Offscreen] Auth failed:', msg.reason);
      notifyServiceWorker('AUTH_STATUS', { status: 'failed', error: msg.reason });
      break;

    case 'command':
      // Incoming command from the Go Desktop server.
      // Forward to service worker for execution, then send response back over WS.
      handleIncomingCommand(msg);
      break;

    // ── Script engine messages sent directly (not via generic command envelope) ──
    // These arrive as { type: 'script_load', script: {...} } etc. from the Desktop
    // and are re-routed as EXECUTE_COMMAND messages so the service worker can
    // handle them through the standard CommandHandler / ScriptEngine path.
    case 'script_load':
      handleIncomingCommand({ type: 'command', id: msg.id || `sl_${Date.now()}`, action: 'script_load', params: { script: msg.script } });
      break;

    case 'script_unload':
      handleIncomingCommand({ type: 'command', id: msg.id || `su_${Date.now()}`, action: 'script_unload', params: { id: msg.id } });
      break;

    case 'script_toggle':
      handleIncomingCommand({ type: 'command', id: msg.id || `st_${Date.now()}`, action: 'script_toggle', params: { id: msg.scriptId, active: msg.active } });
      break;

    case 'script_list':
      handleIncomingCommand({ type: 'command', id: msg.id || `sls_${Date.now()}`, action: 'script_list', params: {} });
      break;

    case 'script_run':
      handleIncomingCommand({ type: 'command', id: msg.id || `sr_${Date.now()}`, action: 'script_run', params: { domain: msg.domain, code: msg.code } });
      break;

    default:
      console.log('[TwinBridge:Offscreen] Unhandled message type:', msg.type);
  }
}

/**
 * Forward a command from the Go server to the service worker for execution.
 * When the service worker responds, send the result back over WebSocket.
 *
 * @param {{ type: 'command', id: string, action: string, params: object }} msg
 */
function handleIncomingCommand(msg) {
  const { id, action, params } = msg;
  if (!id || !action) {
    console.warn('[TwinBridge:Offscreen] Malformed command (missing id/action):', msg);
    return;
  }

  console.log(`[TwinBridge:Offscreen] Forwarding command to SW: ${action} (id=${id})`);

  chrome.runtime.sendMessage({
    type: 'EXECUTE_COMMAND',
    id,
    action,
    params: params || {},
  }).then((response) => {
    const result = response?.result ?? { error: 'No result from service worker' };
    send({ type: 'response', id, result });
  }).catch((err) => {
    console.error('[TwinBridge:Offscreen] Command dispatch error:', err);
    send({ type: 'response', id, result: { error: err.message || 'Service worker unavailable' } });
  });
}

function handleError() {
  console.error('[TwinBridge:Offscreen] WebSocket error');
}

function handleClose(event) {
  console.log(`[TwinBridge:Offscreen] Disconnected (code: ${event.code})`);
  isConnected = false;
  clearInterval(pingTimer);

  notifyServiceWorker('STATUS_UPDATE', { wsConnected: false });

  if (event.code !== 1000) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt),
    RECONNECT_MAX_MS
  );

  console.log(`[TwinBridge:Offscreen] Reconnecting in ${delay}ms`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt++;
    connect();
  }, delay);
}

function disconnect() {
  clearInterval(pingTimer);
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectAttempt = 0;

  if (ws) {
    ws.close(1000, 'User requested disconnect');
    ws = null;
  }
  isConnected = false;
}

// ─── Send with In-Memory Queue ──────────────────────────────────────────────

function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

function sendOrQueue(payload) {
  if (send(payload)) return;

  if (offlineQueue.length >= MAX_QUEUE_SIZE) {
    offlineQueue.shift();
  }

  offlineQueue.push({ ...payload, _queuedAt: Date.now() });
  console.log(`[TwinBridge:Offscreen] Queued event (queue size: ${offlineQueue.length})`);
}

function flushQueue() {
  if (offlineQueue.length === 0) return;

  console.log(`[TwinBridge:Offscreen] Flushing ${offlineQueue.length} queued events`);

  let sent = 0;
  for (const item of offlineQueue) {
    if (!send(item)) break;
    sent++;
  }

  offlineQueue = offlineQueue.slice(sent);

  if (sent > 0) {
    console.log(`[TwinBridge:Offscreen] Flushed ${sent} events, ${offlineQueue.length} remaining`);
  }
}

// ─── Notify Service Worker ──────────────────────────────────────────────────

function notifyServiceWorker(type, data) {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_EVENT', event: type, data }).catch(() => {
    // Service worker may not be awake — that's ok
  });
}

// ─── Message Router (from Service Worker) ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  const { payload } = message;

  if (payload.type === 'CONTROL') {
    if (payload.command === 'connect') connect();
    if (payload.command === 'disconnect') disconnect();
    if (payload.command === 'update_token') {
      token = payload.token;
      if (isConnected) {
        send({ type: 'auth', token, extension_id: extensionId });
      }
    }
    sendResponse({ ok: true });
    return;
  }

  // Twin log events from monitors — structured for the desktop twin log API
  if (payload.type === 'TWIN_LOG') {
    sendOrQueue({
      type: 'twin_log',
      source: payload.source,
      data: payload.data,
      timestamp: payload.timestamp || Date.now(),
    });
    sendResponse({ ok: true });
    return;
  }

  // Twin event dispatch — from browser_watch watchers → Rust event queue
  if (payload.type === 'TWIN_EVENT') {
    sendOrQueue({
      type: 'TWIN_EVENT',
      source: payload.source,
      eventType: payload.eventType,
      data: payload.data,
      timestamp: payload.timestamp || Date.now(),
    });
    sendResponse({ ok: true });
    return;
  }

  // Forward event to WebSocket
  sendOrQueue({
    type: 'event',
    source: payload._source || 'unknown',
    tabId: payload._tabId,
    eventType: payload.type,
    data: payload.data || payload,
    timestamp: payload.timestamp || Date.now(),
  });

  sendResponse({ ok: true });
  return;
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();
