// Twin Dispatch — Auto-spawn Claude Code agents on incoming events
//
// Architecture:
//   Chrome Extension (watcher) → TWIN_EVENT via WS → Rust event queue
//   → Dispatch loop receives event → spawns Claude Code via bridge
//   → Claude processes (reads message, replies, etc.) → finishes
//   → Dispatch loop waits for next event → repeat
//
// No Claude Code CLI session needed. No blocking. No token waste.
// Each event = one Claude Code subprocess with full MCP tool access.

use crate::digital_twin::ws_bridge;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

// ── Dispatch config ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchConfig {
    /// Which account to watch (e.g. "whatsapp")
    pub account: String,
    /// Agent slug to spawn for each event (default: "twin-responder")
    pub agent_slug: String,
    /// Model to use (default: "sonnet")
    pub model: String,
    /// System prompt for the spawned agent
    pub system_prompt: String,
    /// Provider (default: "claude")
    pub provider: String,
}

impl Default for DispatchConfig {
    fn default() -> Self {
        Self {
            account: "whatsapp".to_string(),
            agent_slug: "twin-responder".to_string(),
            model: "claude-sonnet-4-5".to_string(),
            system_prompt: default_system_prompt(),
            provider: "claude".to_string(),
        }
    }
}

fn default_system_prompt() -> String {
    r#"You are Orchestra Twin — an AI assistant that responds to messages on behalf of the user.

You received a new message via the Twin Bridge. Your job:
1. Read the message carefully
2. Respond appropriately using browser_reply
3. Keep responses natural, concise, and in the same language as the message
4. Use WhatsApp formatting: *bold*, _italic_ (NOT markdown **)
5. If the message asks you to do something (check email, search, etc.), do it using available MCP tools and report back

You have full access to MCP tools: browser_reply, browser_read, browser_search, etc.
Do NOT ask for permission — just act."#.to_string()
}

// ── Global state ────────────────────────────────────────────────────────────

static DISPATCH_RUNNING: AtomicBool = AtomicBool::new(false);
static DISPATCH_CONFIG: OnceLock<Mutex<Option<DispatchConfig>>> = OnceLock::new();
/// Persistent session ID — all events share the same Claude conversation
static SESSION_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn config_store() -> &'static Mutex<Option<DispatchConfig>> {
    DISPATCH_CONFIG.get_or_init(|| Mutex::new(None))
}

fn session_id_store() -> &'static Mutex<Option<String>> {
    SESSION_ID.get_or_init(|| Mutex::new(None))
}

// ── Stats ───────────────────────────────────────────────────────────────────

static DISPATCH_STATS: OnceLock<Mutex<DispatchStats>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DispatchStats {
    pub events_received: u64,
    pub agents_spawned: u64,
    pub agents_completed: u64,
    pub agents_failed: u64,
    pub last_event_at: Option<String>,
    pub last_agent_pid: Option<u32>,
}

fn stats() -> &'static Mutex<DispatchStats> {
    DISPATCH_STATS.get_or_init(|| Mutex::new(DispatchStats::default()))
}

// ── Public API ──────────────────────────────────────────────────────────────

/// Start the twin dispatch loop. Returns immediately.
/// Events from the queue will auto-spawn Claude Code agents.
pub fn start(config: DispatchConfig) -> Result<String, String> {
    if DISPATCH_RUNNING.load(Ordering::SeqCst) {
        return Err("Twin dispatch already running. Stop it first.".to_string());
    }

    let account = config.account.clone();
    *config_store().lock().unwrap() = Some(config.clone());
    DISPATCH_RUNNING.store(true, Ordering::SeqCst);

    // Send a confirmation message on the watched account so user knows it's active
    let confirm_account = account.clone();
    std::thread::spawn(move || {
        let confirm_args = serde_json::json!({
            "account": confirm_account,
            "message": "🤖 *Orchestra Twin Dispatch مفعّل*\n\nأنا شغال دلوقتي وبراقب الرسايل.\nابعتلي أي حاجة وهرد عليك تلقائياً!"
        });
        let _ = ws_bridge::execute_command("browser_reply", confirm_args);
    });

    // Start the event loop in a background thread
    std::thread::spawn(move || {
        log::info!("[TwinDispatch] Started — watching for events on '{}'", account);

        let cfg = config_store().lock().unwrap().clone().unwrap_or_default();

        // Resolve workspace
        let workspace = std::env::var("ORCHESTRA_WORKSPACE")
            .ok()
            .or_else(|| {
                let mut dir = std::env::current_dir().ok()?;
                for _ in 0..5 {
                    if dir.join(".mcp.json").exists() {
                        return Some(dir.to_string_lossy().to_string());
                    }
                    dir = dir.parent()?.to_path_buf();
                }
                None
            })
            .unwrap_or_else(|| "/Users/fadymondy/Sites/orch".to_string());

        let mcp_config = format!("{}/.mcp.json", workspace);

        // ── Event loop: spawn claude per event, resume session ──────────
        // Pattern from orchestra-tasks Go bridge:
        //   claude --print - --output-format stream-json --resume <sid>
        // Prompt via STDIN, structured output parsed line by line.

        loop {
            if !DISPATCH_RUNNING.load(Ordering::SeqCst) {
                log::info!("[TwinDispatch] Stopped by user");
                break;
            }

            // Block on event queue
            match ws_bridge::wait_for_event() {
                Ok(event) => {
                    let event_type = event.get("event_type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");

                    // Skip stop signals
                    if event_type == "dispatch_stop" { break; }

                    log::info!("[TwinDispatch] Event received: {}", event_type);

                    {
                        let mut s = stats().lock().unwrap();
                        s.events_received += 1;
                        s.last_event_at = Some(chrono_now());
                    }

                    // Filter by account
                    let source = event.get("source")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");

                    if !cfg.account.is_empty() && source != cfg.account {
                        continue;
                    }

                    // Build prompt from event
                    let prompt = build_instruction(&event);

                    // Build command: claude --print - --output-format stream-json
                    let mut cmd = std::process::Command::new("claude");
                    cmd.arg("--print")
                        .arg("-")  // read prompt from stdin
                        .arg("--output-format")
                        .arg("stream-json")
                        .arg("--dangerously-skip-permissions")
                        .arg("--model")
                        .arg(&cfg.model)
                        .arg("--allowedTools")
                        .arg("*")
                        .arg("--mcp-config")
                        .arg(&mcp_config);

                    // Resume session for context (if we have one)
                    let session_id = session_id_store().lock().unwrap().clone();
                    if let Some(ref sid) = session_id {
                        cmd.arg("--resume").arg(sid);
                        log::info!("[TwinDispatch] Resuming session {}", &sid[..8.min(sid.len())]);
                    } else {
                        // First message — include system prompt
                        cmd.arg("--system-prompt").arg(&cfg.system_prompt);
                        log::info!("[TwinDispatch] Starting new session");
                    }

                    cmd.current_dir(&workspace)
                        .stdin(std::process::Stdio::piped())
                        .stdout(std::process::Stdio::piped())
                        .stderr(std::process::Stdio::piped());

                    // Spawn process
                    let mut child = match cmd.spawn() {
                        Ok(c) => c,
                        Err(e) => {
                            log::error!("[TwinDispatch] Failed to spawn claude: {}", e);
                            let mut s = stats().lock().unwrap();
                            s.agents_failed += 1;
                            continue;
                        }
                    };

                    let pid = child.id();
                    {
                        let mut s = stats().lock().unwrap();
                        s.agents_spawned += 1;
                        s.last_agent_pid = Some(pid);
                    }
                    log::info!("[TwinDispatch] Claude PID {} started", pid);

                    // Write prompt to stdin (orchestra-tasks pattern: --print -)
                    if let Some(mut stdin) = child.stdin.take() {
                        use std::io::Write;
                        let _ = stdin.write_all(prompt.as_bytes());
                        drop(stdin); // close stdin so claude starts processing
                    }

                    // Read stream-json output line by line
                    if let Some(stdout) = child.stdout.take() {
                        use std::io::BufRead;
                        let reader = std::io::BufReader::new(stdout);
                        for line in reader.lines() {
                            let line = match line {
                                Ok(l) => l,
                                Err(_) => break,
                            };
                            if line.trim().is_empty() { continue; }

                            if let Ok(msg) = serde_json::from_str::<Value>(&line) {
                                let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

                                match msg_type {
                                    "system" => {
                                        // Extract session_id for resumption
                                        if let Some(sid) = msg.get("session_id").and_then(|v| v.as_str()) {
                                            *session_id_store().lock().unwrap() = Some(sid.to_string());
                                            log::info!("[TwinDispatch] Session ID: {}", &sid[..8.min(sid.len())]);
                                        }
                                    }
                                    "assistant" => {
                                        // Parse content blocks for tool_use and text
                                        let content = msg.get("message")
                                            .and_then(|m| m.get("content"))
                                            .or_else(|| msg.get("content"));

                                        if let Some(blocks) = content.and_then(|c| c.as_array()) {
                                            for block in blocks {
                                                let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                                match block_type {
                                                    "text" => {
                                                        let text = block.get("text").and_then(|v| v.as_str()).unwrap_or("");
                                                        if !text.is_empty() {
                                                            log::info!("[TwinDispatch] Response: {}", text.chars().take(200).collect::<String>());
                                                        }
                                                    }
                                                    "tool_use" => {
                                                        let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("");
                                                        log::info!("[TwinDispatch] Tool: {}", name);
                                                    }
                                                    _ => {}
                                                }
                                            }
                                        }
                                    }
                                    "result" => {
                                        // Extract session_id from result too
                                        if let Some(sid) = msg.get("session_id").and_then(|v| v.as_str()) {
                                            *session_id_store().lock().unwrap() = Some(sid.to_string());
                                        }
                                        log::info!("[TwinDispatch] Turn complete");
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }

                    // Wait for process to finish
                    match child.wait() {
                        Ok(status) => {
                            let mut s = stats().lock().unwrap();
                            if status.success() {
                                s.agents_completed += 1;
                                log::info!("[TwinDispatch] Agent completed (PID {})", pid);
                            } else {
                                s.agents_failed += 1;
                                log::error!("[TwinDispatch] Agent failed (PID {})", pid);
                            }
                        }
                        Err(e) => {
                            let mut s = stats().lock().unwrap();
                            s.agents_failed += 1;
                            log::error!("[TwinDispatch] Agent wait error: {}", e);
                        }
                    }

                    log::info!("[TwinDispatch] Ready for next event");
                }
                Err(e) => {
                    if DISPATCH_RUNNING.load(Ordering::SeqCst) {
                        log::error!("[TwinDispatch] Event queue error: {}", e);
                        // Brief pause before retrying
                        std::thread::sleep(std::time::Duration::from_secs(1));
                    } else {
                        break;
                    }
                }
            }
        }

        log::info!("[TwinDispatch] Event loop exited");
    });

    Ok(format!("Twin dispatch started — watching '{}', spawning '{}' agents with model '{}'",
        config.account, config.agent_slug, config.model))
}

/// Stop the dispatch loop.
pub fn stop() -> Result<String, String> {
    if !DISPATCH_RUNNING.load(Ordering::SeqCst) {
        return Err("Twin dispatch is not running".to_string());
    }

    DISPATCH_RUNNING.store(false, Ordering::SeqCst);

    // Push a dummy event to unblock wait_for_event
    ws_bridge::push_event_public(json!({"event_type": "dispatch_stop", "source": "system"}));

    Ok("Twin dispatch stopped".to_string())
}

/// Get dispatch status and stats.
pub fn status() -> Value {
    let running = DISPATCH_RUNNING.load(Ordering::SeqCst);
    let cfg = config_store().lock().unwrap().clone();
    let s = stats().lock().unwrap().clone();

    json!({
        "running": running,
        "config": cfg,
        "stats": s,
    })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Build a Claude instruction from a TWIN_EVENT.
fn build_instruction(event: &Value) -> String {
    let source = event.get("source").and_then(|v| v.as_str()).unwrap_or("unknown");
    let event_type = event.get("event_type").and_then(|v| v.as_str()).unwrap_or("event");
    let data = event.get("data").cloned().unwrap_or(Value::Null);

    let chat = data.get("chat").and_then(|v| v.as_str()).unwrap_or("unknown");
    let message = data.get("lastMessage").and_then(|v| v.as_str())
        .or_else(|| data.get("messages").and_then(|v| v.as_array())
            .and_then(|a| a.last())
            .and_then(|v| v.as_str()))
        .unwrap_or("");
    let platform = data.get("platform").and_then(|v| v.as_str()).unwrap_or(source);

    match event_type {
        "new_message" => {
            format!(
                "New {} message from \"{}\":\n\n\"{}\"\n\nReply using browser_reply(account: \"{}\", message: \"your reply\").",
                platform, chat, message, source
            )
        }
        "unread_message" => {
            format!(
                "New unread message on {} from \"{}\": \"{}\"\n\nUse browser_read to check the full conversation, then reply if appropriate.",
                platform, chat, message,
            )
        }
        _ => {
            format!(
                "Twin event from {} (type: {}): {}\n\nProcess this event and take appropriate action.",
                source, event_type, serde_json::to_string_pretty(&data).unwrap_or_default()
            )
        }
    }
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", now)
}
