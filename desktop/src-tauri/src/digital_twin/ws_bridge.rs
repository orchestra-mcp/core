// Digital Twin — Browser WebSocket Bridge
//
// Runs a WebSocket server on localhost:9997 that accepts connections from the
// Orchestra Twin Bridge Chrome extension.
//
// BIDIRECTIONAL:
//   Extension → Desktop  : browser events (Slack, Gmail, GitHub, …) streamed as JSON
//   Desktop   → Extension: browser commands (open, read, click, …) sent as JSON
//
// Architecture:
//   Chrome Extension ──WS localhost:9997/twin──► Desktop (this file)
//                      ◄── commands ────────────  ├─ stores alerts locally
//                      ──── responses ──────────►  └─ POST localhost:9999/twin/push
//
// Command protocol (Desktop → Extension):
//   { "type": "command", "id": "<uuid>", "action": "<action>", "params": {...} }
//
// Response protocol (Extension → Desktop):
//   { "type": "response", "id": "<uuid>", "result": {...} }
//   { "type": "response", "id": "<uuid>", "error": "<msg>" }

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub const WS_PORT: u16 = 9997;
const CLOUD_MCP_URL: &str = "http://localhost:9999/twin/push";
const CMD_TIMEOUT_SECS: u64 = 30;

// ── Global state ─────────────────────────────────────────────────────────────

/// Sender that delivers BrowserCmdReq values to the active connection handler.
/// None when no extension is connected.
static ACTIVE_TX: OnceLock<Mutex<Option<tokio::sync::mpsc::UnboundedSender<BrowserCmdReq>>>> =
    OnceLock::new();

/// In-flight commands waiting for a response from the extension.
/// Key: command id, Value: sync reply channel sender.
static PENDING: OnceLock<Mutex<HashMap<String, std::sync::mpsc::SyncSender<Result<Value, String>>>>> =
    OnceLock::new();

/// Event queue for twin events dispatched from browser watchers.
/// Events pushed here when extension sends "TWIN_EVENT" messages.
/// MCP tool `browser_wait_event` blocks on the receiver.
static EVENT_TX: OnceLock<std::sync::mpsc::SyncSender<Value>> = OnceLock::new();
static EVENT_RX: OnceLock<Mutex<std::sync::mpsc::Receiver<Value>>> = OnceLock::new();

fn active_tx() -> &'static Mutex<Option<tokio::sync::mpsc::UnboundedSender<BrowserCmdReq>>> {
    ACTIVE_TX.get_or_init(|| Mutex::new(None))
}

fn pending() -> &'static Mutex<HashMap<String, std::sync::mpsc::SyncSender<Result<Value, String>>>> {
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn init_event_queue() {
    // Buffered channel — holds up to 100 events before blocking
    let (tx, rx) = std::sync::mpsc::sync_channel::<Value>(100);
    let _ = EVENT_TX.set(tx);
    let _ = EVENT_RX.set(Mutex::new(rx));
}

fn push_event(event: Value) {
    if let Some(tx) = EVENT_TX.get() {
        tx.try_send(event).ok(); // non-blocking, drops if full
    }
}

/// Public version for dispatch stop signal.
pub fn push_event_public(event: Value) {
    push_event(event);
}

/// Block until a twin event arrives from any watched account.
/// Called by the MCP tool `browser_wait_event`. No timeout — waits forever.
pub fn wait_for_event() -> Result<Value, String> {
    let rx = EVENT_RX
        .get()
        .ok_or_else(|| "event queue not initialized".to_string())?;
    let guard = rx.lock().map_err(|_| "event queue lock poisoned".to_string())?;
    guard.recv().map_err(|_| "event queue closed".to_string())
}

// ── Command request passed from execute_command() to the WS handler ──────────

struct BrowserCmdReq {
    id: String,
    action: String,
    params: Value,
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Execute a browser command via the connected Chrome extension (synchronous).
///
/// Called from the Rust Desktop MCP server (tiny_http thread — no async context).
/// Blocks until the extension responds or the timeout expires.
pub fn execute_command(action: &str, params: Value) -> Result<Value, String> {
    // Determine timeout based on command type:
    // - browser_wait_reply: no timeout — blocks until user replies (24h cap)
    // - all browser_* commands: 60s (DOM operations can be slow)
    // - everything else: default 30s
    let timeout_secs = if action == "browser_wait_reply" || action == "browser_wait_event" {
        86400 // 24 hours — effectively no timeout, waits for dispatch
    } else if action.starts_with("browser_") {
        60
    } else {
        CMD_TIMEOUT_SECS
    };

    // Get the sender to the active WS connection.
    let tx = {
        let guard = active_tx().lock().unwrap();
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "no Chrome extension connected".to_string())?
    };

    let id = uuid::Uuid::new_v4().to_string();
    let (reply_tx, reply_rx) = std::sync::mpsc::sync_channel::<Result<Value, String>>(1);

    // Register the pending reply channel before sending the command.
    pending().lock().unwrap().insert(id.clone(), reply_tx);

    // Deliver the command request to the async WS handler.
    tx.send(BrowserCmdReq {
        id: id.clone(),
        action: action.to_string(),
        params,
    })
    .map_err(|_| {
        pending().lock().unwrap().remove(&id);
        "extension disconnected".to_string()
    })?;

    // Block waiting for the response (with timeout).
    reply_rx
        .recv_timeout(Duration::from_secs(timeout_secs))
        .map_err(|_| {
            pending().lock().unwrap().remove(&id);
            format!("command timed out after {}s", timeout_secs)
        })?
}

/// Returns true when a Chrome extension is currently connected.
pub fn is_connected() -> bool {
    active_tx().lock().unwrap().is_some()
}

// ── Server entry point ────────────────────────────────────────────────────────

/// Start the Twin Bridge WebSocket server on port 9997.
/// Spawns a dedicated OS thread with its own Tokio runtime — safe to call
/// before Tauri's runtime is fully initialised.
pub fn start() {
    init_event_queue();
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().expect("twin bridge: tokio runtime");
        rt.block_on(run_server());
    });
}

async fn run_server() {
    let addr: SocketAddr = format!("127.0.0.1:{}", WS_PORT).parse().unwrap();

    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => {
            log::info!(
                "[TwinBridge] WebSocket bridge listening on ws://localhost:{}/twin",
                WS_PORT
            );
            l
        }
        Err(e) => {
            log::error!("[TwinBridge] Failed to bind port {}: {}", WS_PORT, e);
            return;
        }
    };

    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                if !peer.ip().is_loopback() {
                    log::warn!("[TwinBridge] Rejected non-localhost connection from {}", peer);
                    continue;
                }
                tokio::spawn(handle_connection(stream, peer));
            }
            Err(e) => {
                log::error!("[TwinBridge] Accept error: {}", e);
            }
        }
    }
}

// ── Per-connection handler ────────────────────────────────────────────────────

/// Incoming message shape from the Chrome extension.
#[derive(Debug, Deserialize)]
struct ExtensionMessage {
    #[serde(rename = "type")]
    msg_type: String,
    // ── event / MONITOR_DATA fields ───
    source: Option<String>,
    #[serde(rename = "eventType")]
    event_type: Option<String>,
    data: Option<Value>,
    timestamp: Option<u64>,
    // ── auth fields ───────────────────
    #[allow(dead_code)]
    token: Option<String>,
    extension_id: Option<String>,
    // ── response fields ──────────────
    id: Option<String>,
    result: Option<Value>,
    error: Option<String>,
    // ── MONITOR_DATA extra ────────────
    #[allow(dead_code)]
    #[serde(rename = "tabId")]
    tab_id: Option<u32>,
}

/// Push payload forwarded to the Go Cloud MCP server.
#[derive(Debug, Serialize)]
struct CloudPushPayload {
    source: String,
    event_type: String,
    data: Value,
    timestamp: u64,
    origin: &'static str,
}

async fn handle_connection(stream: tokio::net::TcpStream, peer: SocketAddr) {
    log::info!("[TwinBridge] Extension connected from {}", peer);

    let ws = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::warn!("[TwinBridge] WebSocket handshake failed: {}", e);
            return;
        }
    };

    let (mut writer, mut reader) = ws.split();

    // ── Register this connection as the active command target ─────────────────
    let (cmd_tx, mut cmd_rx) = tokio::sync::mpsc::unbounded_channel::<BrowserCmdReq>();
    *active_tx().lock().unwrap() = Some(cmd_tx);

    // Send initial ack
    let _ = writer
        .send(Message::Text(json!({"type": "ack"}).to_string()))
        .await;

    // ── Main event loop (select on WS messages OR outgoing commands) ──────────
    loop {
        tokio::select! {
            // ── Incoming message from extension ───────────────────────────────
            msg_result = reader.next() => {
                let msg = match msg_result {
                    Some(Ok(m)) => m,
                    Some(Err(e)) => {
                        log::warn!("[TwinBridge] Read error: {}", e);
                        break;
                    }
                    None => break,
                };

                match msg {
                    Message::Text(text) => {
                        let parsed: ExtensionMessage = match serde_json::from_str(&text) {
                            Ok(m) => m,
                            Err(e) => {
                                log::debug!(
                                    "[TwinBridge] Unparseable message: {} — {}",
                                    e,
                                    &text[..text.len().min(80)]
                                );
                                continue;
                            }
                        };

                        match parsed.msg_type.as_str() {
                            // ── Keepalive ─────────────────────────────────────
                            "ping" => {
                                let _ = writer
                                    .send(Message::Text(json!({"type": "pong"}).to_string()))
                                    .await;
                            }

                            // ── Auth ──────────────────────────────────────────
                            "auth" => {
                                log::info!(
                                    "[TwinBridge] Authenticated extension: {:?}",
                                    parsed.extension_id
                                );
                                let _ = writer
                                    .send(Message::Text(json!({"type": "auth_ok"}).to_string()))
                                    .await;
                            }

                            // ── Command response from extension ───────────────
                            "response" => {
                                if let Some(id) = parsed.id {
                                    let reply = pending().lock().unwrap().remove(&id);
                                    if let Some(tx) = reply {
                                        let payload = if let Some(err) = parsed.error {
                                            Err(err)
                                        } else {
                                            Ok(parsed.result.unwrap_or(Value::Null))
                                        };
                                        tx.send(payload).ok();
                                    } else {
                                        log::debug!("[TwinBridge] Response for unknown id: {}", id);
                                    }
                                }
                            }

                            // ── Twin event dispatch (from watchers) ──────────
                            "TWIN_EVENT" => {
                                let event = json!({
                                    "source": parsed.source.clone().unwrap_or_else(|| "unknown".to_string()),
                                    "event_type": parsed.event_type.clone().unwrap_or_else(|| "message".to_string()),
                                    "data": parsed.data.clone().unwrap_or(Value::Null),
                                    "timestamp": parsed.timestamp.unwrap_or_else(unix_ms),
                                });
                                push_event(event.clone());
                                log::info!(
                                    "[TwinBridge] Twin event dispatched: {} / {}",
                                    parsed.source.as_deref().unwrap_or("?"),
                                    parsed.event_type.as_deref().unwrap_or("?"),
                                );
                                let _ = writer
                                    .send(Message::Text(json!({"type": "ack"}).to_string()))
                                    .await;
                            }

                            // ── Browser events / monitor data ─────────────────
                            "event" | "MONITOR_DATA" => {
                                let source = parsed
                                    .source
                                    .clone()
                                    .unwrap_or_else(|| "browser".to_string());
                                let event_type = parsed
                                    .event_type
                                    .clone()
                                    .unwrap_or_else(|| parsed.msg_type.clone());
                                let data = parsed.data.clone().unwrap_or(Value::Null);
                                let ts = parsed.timestamp.unwrap_or_else(unix_ms);

                                // Store locally
                                let alert = crate::digital_twin::Alert {
                                    id: new_id(),
                                    source: source.clone(),
                                    title: format!("[{}] {}", source, event_type),
                                    body: data.to_string(),
                                    sender: source.clone(),
                                    timestamp: ms_to_iso(ts),
                                    is_read: false,
                                    priority: infer_priority(&source, &event_type),
                                };
                                crate::digital_twin::push_alert(alert);

                                // Forward to Go Cloud MCP (fire-and-forget)
                                let payload = CloudPushPayload {
                                    source: source.clone(),
                                    event_type: event_type.clone(),
                                    data: data.clone(),
                                    timestamp: ts,
                                    origin: "desktop-bridge",
                                };
                                tokio::spawn(forward_to_cloud(payload));

                                log::debug!(
                                    "[TwinBridge] Event stored: {} / {}",
                                    source,
                                    event_type
                                );

                                let _ = writer
                                    .send(Message::Text(json!({"type": "ack"}).to_string()))
                                    .await;
                            }

                            other => {
                                log::debug!("[TwinBridge] Unhandled message type: {}", other);
                            }
                        }
                    }

                    Message::Close(_) => {
                        log::info!("[TwinBridge] Extension disconnected: {}", peer);
                        break;
                    }

                    Message::Ping(data) => {
                        let _ = writer.send(Message::Pong(data)).await;
                    }

                    _ => {}
                }
            }

            // ── Outgoing command to extension (from MCP tool call) ────────────
            Some(cmd) = cmd_rx.recv() => {
                let msg = json!({
                    "type": "command",
                    "id": cmd.id,
                    "action": cmd.action,
                    "params": cmd.params,
                });
                log::debug!("[TwinBridge] Sending command: {} (id={})", cmd.action, cmd.id);
                if let Err(e) = writer.send(Message::Text(msg.to_string())).await {
                    log::warn!("[TwinBridge] Failed to send command: {}", e);
                    // Fail the pending reply
                    if let Some(tx) = pending().lock().unwrap().remove(&cmd.id) {
                        tx.send(Err(format!("WS send failed: {}", e))).ok();
                    }
                }
            }
        }
    }

    // ── Cleanup on disconnect ─────────────────────────────────────────────────
    *active_tx().lock().unwrap() = None;

    // Fail all in-flight commands
    let remaining: Vec<_> = pending()
        .lock()
        .unwrap()
        .drain()
        .collect();
    for (_, tx) in remaining {
        tx.send(Err("extension disconnected".to_string())).ok();
    }

    log::info!("[TwinBridge] Connection cleanup done for {}", peer);
}

// ── Cloud sync ────────────────────────────────────────────────────────────────

async fn forward_to_cloud(payload: CloudPushPayload) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    match client.post(CLOUD_MCP_URL).json(&payload).send().await {
        Ok(resp) if resp.status().is_success() => {
            log::debug!(
                "[TwinBridge] Event forwarded to cloud MCP: {}",
                payload.source
            );
        }
        Ok(resp) => {
            log::warn!(
                "[TwinBridge] Cloud MCP returned {}: {}",
                resp.status(),
                payload.source
            );
        }
        Err(e) => {
            log::debug!(
                "[TwinBridge] Cloud MCP unreachable ({}): {}",
                e,
                payload.source
            );
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn ms_to_iso(ms: u64) -> String {
    let secs = ms / 1000;
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let days_since_epoch = secs / 86400;
    let year = 1970 + days_since_epoch / 365;
    let day_of_year = days_since_epoch % 365;
    let month = day_of_year / 30 + 1;
    let day = day_of_year % 30 + 1;
    format!(
        "{}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year,
        month.min(12),
        day.min(31),
        h,
        m,
        s
    )
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn infer_priority(source: &str, event_type: &str) -> String {
    let high_sources = ["slack", "whatsapp", "telegram", "discord"];
    let high_events = [
        "mention",
        "dm",
        "direct_message",
        "pr_review_requested",
        "calendar_soon",
    ];

    if high_sources.contains(&source)
        || high_events.iter().any(|e| event_type.contains(e))
    {
        "high".to_string()
    } else {
        "medium".to_string()
    }
}
