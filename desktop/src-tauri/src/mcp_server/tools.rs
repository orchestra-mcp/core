// MCP Server — Tool Registry and Execution
//
// Each tool maps to an existing vision/workspace function.
// Tools are defined with JSON Schema input descriptions per MCP spec.

use base64::Engine;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::SystemTime;

use super::helpers::format_markdown;
use super::types::{ContentItem, ToolCallResult, ToolDefinition};

/// Return the full list of tool definitions exposed by this MCP server.
pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        // ── Vision: Capture ──────────────────────────────────────
        ToolDefinition {
            name: "screen_capture".to_string(),
            description: "Capture the full screen as a compressed JPEG image (max 1280px wide). Returns base64-encoded image data."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        // ── Vision: OCR ──────────────────────────────────────────
        ToolDefinition {
            name: "screen_ocr".to_string(),
            description: "Run OCR on a screen region and extract recognized text. Coordinates are in screen pixels."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "X coordinate of the region (pixels)" },
                    "y": { "type": "number", "description": "Y coordinate of the region (pixels)" },
                    "width": { "type": "number", "description": "Width of the region (pixels)" },
                    "height": { "type": "number", "description": "Height of the region (pixels)" }
                },
                "required": ["x", "y", "width", "height"]
            }),
        },
        // ── Vision: Input ────────────────────────────────────────
        ToolDefinition {
            name: "mouse_click".to_string(),
            description: "Click the mouse at the given screen coordinates."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "X coordinate (pixels)" },
                    "y": { "type": "number", "description": "Y coordinate (pixels)" },
                    "button": { "type": "string", "description": "Mouse button: 'left' or 'right'", "default": "left" }
                },
                "required": ["x", "y"]
            }),
        },
        ToolDefinition {
            name: "keyboard_type".to_string(),
            description: "Type text via simulated keyboard events, character by character."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "Text to type" }
                },
                "required": ["text"]
            }),
        },
        // ── Vision: Window ───────────────────────────────────────
        ToolDefinition {
            name: "window_list".to_string(),
            description: "List all visible windows on the desktop with their positions and sizes."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        ToolDefinition {
            name: "window_focus".to_string(),
            description: "Bring a window to the foreground by app name and optional window title."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "app_name": { "type": "string", "description": "Application name (e.g. 'Safari', 'Terminal')" },
                    "window_title": { "type": "string", "description": "Window title substring to match", "default": "" }
                },
                "required": ["app_name"]
            }),
        },
        // ── Vision: Compound ─────────────────────────────────────
        ToolDefinition {
            name: "screen_scan".to_string(),
            description: "Scan all displays and windows. Returns displays, windows (with center coordinates and display assignment), active app name, a cache timestamp, and a compressed JPEG screenshot of the full screen."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        ToolDefinition {
            name: "screen_action".to_string(),
            description: concat!(
                "Execute a sequence of screen actions. Accepts an array of action objects. ",
                "Action types: ",
                "focus {app} — bring app window to front; ",
                "click {x, y, button?} — click at coordinates; ",
                "type {text} — type text via keyboard; ",
                "key {keys: [\"Return\", \"Cmd+T\", ...]} — press special keys or combos; ",
                "wait {ms} — sleep for milliseconds; ",
                "capture — screenshot, returns base64 PNG; ",
                "ocr {x, y, width, height} — OCR a screen region. ",
                "Returns an array of result objects, one per action."
            ).to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "actions": {
                        "type": "array",
                        "description": "Ordered list of actions to execute",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {
                                    "type": "string",
                                    "enum": ["focus", "click", "type", "key", "wait", "capture", "ocr"],
                                    "description": "Action type"
                                },
                                "app": { "type": "string", "description": "App name (for focus)" },
                                "x": { "type": "number", "description": "X coordinate (for click, ocr)" },
                                "y": { "type": "number", "description": "Y coordinate (for click, ocr)" },
                                "width": { "type": "number", "description": "Width (for ocr)" },
                                "height": { "type": "number", "description": "Height (for ocr)" },
                                "button": { "type": "string", "description": "Mouse button: left or right (for click)", "default": "left" },
                                "text": { "type": "string", "description": "Text to type (for type)" },
                                "keys": {
                                    "type": "array",
                                    "items": { "type": "string" },
                                    "description": "Key names or combos like 'Return', 'Cmd+T' (for key)"
                                },
                                "ms": { "type": "number", "description": "Milliseconds to wait (for wait)" }
                            },
                            "required": ["type"]
                        }
                    }
                },
                "required": ["actions"]
            }),
        },
        // ── Workspace ────────────────────────────────────────────
        ToolDefinition {
            name: "workspace_list_files".to_string(),
            description: "List all markdown and code files in the workspace directory."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the workspace directory" }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "workspace_read_file".to_string(),
            description: "Read the contents of a file from the workspace."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the file to read" }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "workspace_write_file".to_string(),
            description: "Write content to a file in the workspace. Creates parent directories if needed."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the file to write" },
                    "content": { "type": "string", "description": "Content to write to the file" }
                },
                "required": ["path", "content"]
            }),
        },
        // ── Agent Spawn ──────────────────────────────────────────
        // ── Accessibility (Headless UI) ──────────────────────────
        ToolDefinition {
            name: "accessibility_read".to_string(),
            description: "Read UI element tree from an app WITHOUT moving mouse. Returns buttons, text fields, labels.".to_string(),
            input_schema: json!({"type":"object","properties":{"app_name":{"type":"string","description":"Application name"}},"required":["app_name"]}),
        },
        ToolDefinition {
            name: "accessibility_click".to_string(),
            description: "Click a UI element headlessly via accessibility API. No mouse movement.".to_string(),
            input_schema: json!({"type":"object","properties":{"app_name":{"type":"string"},"role":{"type":"string","description":"Element role (button, text field, link)"},"title":{"type":"string","description":"Element title to match"}},"required":["app_name","role","title"]}),
        },
        ToolDefinition {
            name: "accessibility_set_value".to_string(),
            description: "Set value of a text field headlessly. No keyboard simulation.".to_string(),
            input_schema: json!({"type":"object","properties":{"app_name":{"type":"string"},"role":{"type":"string"},"title":{"type":"string"},"value":{"type":"string"}},"required":["app_name","role","title","value"]}),
        },
        // ── RAG (Local Knowledge Base) ──────────────────────────
        ToolDefinition {
            name: "rag_index".to_string(),
            description: "Index a file or directory into the local RAG knowledge base for semantic search.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File or directory path to index" },
                    "source_type": { "type": "string", "description": "Type: file, markdown, code, meeting, task, message (default: auto-detect)" }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "rag_search".to_string(),
            description: "Search the local RAG knowledge base for relevant content.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query" },
                    "top_k": { "type": "integer", "description": "Number of results (default 10)" }
                },
                "required": ["query"]
            }),
        },
        ToolDefinition {
            name: "rag_status".to_string(),
            description: "Get the status of the local RAG knowledge base — indexed sources, chunk count, storage size.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        },
        // ── Browser Control (Chrome Extension) ──────────────────
        ToolDefinition {
            name: "browser_search".to_string(),
            description: "Search Google from the user's browser and return the top 10 results (title, url, snippet). Requires Chrome extension to be connected.".to_string(),
            input_schema: json!({"type":"object","properties":{"query":{"type":"string","description":"Search query to submit to Google"}},"required":["query"]}),
        },
        ToolDefinition {
            name: "browser_open".to_string(),
            description: "Open a URL in a background browser tab. Returns tab_id, page title, first 5KB of text content, and up to 20 links. Tab stays open for follow-up actions.".to_string(),
            input_schema: json!({"type":"object","properties":{"url":{"type":"string","description":"URL to open in a new background tab"}},"required":["url"]}),
        },
        ToolDefinition {
            name: "browser_read".to_string(),
            description: "Read structured data from a registered account. Without chat param: returns chat/inbox list. With chat param: opens that chat and returns its messages.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name to read (see browser_accounts)"},"chat":{"type":"string","description":"Optional: open a specific chat/channel by name and read its messages (supports whatsapp, slack, discord, telegram)"}},"required":["account"]}),
        },
        ToolDefinition {
            name: "browser_send".to_string(),
            description: "Send a message to a chat/channel. Opens the chat (by phone number or contact name), types the message, and sends it. Supports whatsapp, slack, discord, telegram.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp, slack)"},"chat":{"type":"string","description":"Chat/channel to send to — phone number (e.g. +201207860084) or contact name"},"message":{"type":"string","description":"Message text to send"}},"required":["account","chat","message"]}),
        },
        ToolDefinition {
            name: "browser_reply".to_string(),
            description: "Reply in the currently open chat without navigating away. Use after browser_send or browser_wait_reply when you're already in the right chat. Faster than browser_send — no page reload.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp)"},"message":{"type":"string","description":"Message to send in the currently open chat"}},"required":["account","message"]}),
        },
        ToolDefinition {
            name: "browser_contacts".to_string(),
            description: "List all contacts, chats, or channels from a registered account. Returns names, last messages, and unread status.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp, slack)"}},"required":["account"]}),
        },
        ToolDefinition {
            name: "browser_wait_reply".to_string(),
            description: "Block and wait for a reply in the currently open chat. No timeout — blocks forever until a message arrives, then returns immediately. Event-driven. Use after browser_send.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp)"},"chat":{"type":"string","description":"Optional: chat identifier for context"}},"required":["account"]}),
        },
        ToolDefinition {
            name: "browser_watch".to_string(),
            description: "Start watching an account for new events (messages, notifications, mentions). Returns immediately — events dispatch to event queue. Use browser_wait_event to receive. Use browser_unwatch to stop.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp, slack, twitter)"},"chat":{"type":"string","description":"Optional: specific chat/channel to watch. Omit to watch all."}},"required":["account"]}),
        },
        ToolDefinition {
            name: "browser_wait_event".to_string(),
            description: "Block until a twin event arrives from any watched account. No timeout — waits forever until dispatched. Returns event with source, event_type, and data. Use after browser_watch.".to_string(),
            input_schema: json!({"type":"object","properties":{"account":{"type":"string","description":"Registered account name (e.g. whatsapp)"}},"required":["account"]}),
        },
        ToolDefinition {
            name: "browser_unwatch".to_string(),
            description: "Stop watching a chat for new messages. Pass tab_id or account to identify which watcher to stop.".to_string(),
            input_schema: json!({"type":"object","properties":{"tab_id":{"type":"integer","description":"Tab ID returned by browser_watch"},"account":{"type":"string","description":"Account name to stop watching"}},"required":[]}),
        },
        ToolDefinition {
            name: "browser_click".to_string(),
            description: "Click an element in an open browser tab using a CSS selector. Blocked on password, payment, and destructive UI elements.".to_string(),
            input_schema: json!({"type":"object","properties":{"tab_id":{"type":"integer","description":"Chrome tab ID"},"selector":{"type":"string","description":"CSS selector of the element to click"}},"required":["tab_id","selector"]}),
        },
        ToolDefinition {
            name: "browser_fill".to_string(),
            description: "Fill an input field in an open browser tab. Password fields are always blocked.".to_string(),
            input_schema: json!({"type":"object","properties":{"tab_id":{"type":"integer"},"selector":{"type":"string","description":"CSS selector of the input field"},"value":{"type":"string","description":"Value to enter"}},"required":["tab_id","selector","value"]}),
        },
        ToolDefinition {
            name: "browser_screenshot".to_string(),
            description: "Capture a screenshot of a browser tab and return it as a base64 PNG data URL.".to_string(),
            input_schema: json!({"type":"object","properties":{"tab_id":{"type":"integer","description":"Chrome tab ID to capture"}},"required":["tab_id"]}),
        },
        ToolDefinition {
            name: "browser_tabs".to_string(),
            description: "List all open browser tabs with their id, url, title, and active state.".to_string(),
            input_schema: json!({"type":"object","properties":{}}),
        },
        ToolDefinition {
            name: "browser_close".to_string(),
            description: "Close a browser tab by its tab_id.".to_string(),
            input_schema: json!({"type":"object","properties":{"tab_id":{"type":"integer","description":"Chrome tab ID to close"}},"required":["tab_id"]}),
        },
        ToolDefinition {
            name: "browser_accounts".to_string(),
            description: "List all registered browser accounts (name, platform, url).".to_string(),
            input_schema: json!({"type":"object","properties":{}}),
        },
        ToolDefinition {
            name: "browser_register".to_string(),
            description: "Register a new browser account so it can be read with browser_read. Platforms: gmail, github, slack, linear, jira, whatsapp, twitter.".to_string(),
            input_schema: json!({"type":"object","properties":{"name":{"type":"string","description":"Unique account name (e.g. 'work-gmail')"},"platform":{"type":"string","enum":["gmail","github","slack","linear","jira","whatsapp","twitter"]},"url":{"type":"string","description":"URL to open when reading this account"}},"required":["name","platform","url"]}),
        },
        // ── Twin Dispatch (auto-spawn agents on events) ─────────
        ToolDefinition {
            name: "twin_dispatch_start".to_string(),
            description: "Start auto-dispatching Claude Code agents when twin events arrive. Events from browser_watch trigger automatic agent spawns that process and respond. No manual intervention needed.".to_string(),
            input_schema: json!({"type":"object","properties":{
                "account":{"type":"string","description":"Account to watch (e.g. whatsapp, slack). Events from other accounts are ignored."},
                "model":{"type":"string","description":"Model for spawned agents (default: claude-sonnet-4-5)"},
                "system_prompt":{"type":"string","description":"Custom system prompt for the agent. Default handles WhatsApp replies."},
                "agent_slug":{"type":"string","description":"Agent slug from catalogue (default: twin-responder)"}
            },"required":["account"]}),
        },
        ToolDefinition {
            name: "twin_dispatch_stop".to_string(),
            description: "Stop the twin dispatch loop. No more agents will be auto-spawned.".to_string(),
            input_schema: json!({"type":"object","properties":{}}),
        },
        ToolDefinition {
            name: "twin_dispatch_status".to_string(),
            description: "Get twin dispatch status — running state, config, event/agent counts.".to_string(),
            input_schema: json!({"type":"object","properties":{}}),
        },
    ]
    .into_iter()
    .chain(crate::agent_spawn::tool_definitions())
    .chain(crate::digital_twin::alerts::tool_definitions())
    .collect()
}

/// Execute a tool call by name with the given arguments.
/// Returns a ToolCallResult with content items.
pub fn execute_tool(name: &str, args: &Value) -> ToolCallResult {
    match name {
        "screen_capture" => exec_screen_capture(),
        "screen_ocr" => exec_screen_ocr(args),
        "mouse_click" => exec_mouse_click(args),
        "keyboard_type" => exec_keyboard_type(args),
        "window_list" => exec_window_list(),
        "window_focus" => exec_window_focus(args),
        "screen_scan" => exec_screen_scan(),
        "screen_action" => exec_screen_action(args),
        "workspace_list_files" => exec_workspace_list_files(args),
        "workspace_read_file" => exec_workspace_read_file(args),
        "workspace_write_file" => exec_workspace_write_file(args),
        // Agent spawn tools
        "agent_spawn"   => crate::agent_spawn::exec_agent_spawn(args),
        "agent_status"  => crate::agent_spawn::exec_agent_status(args),
        "agent_result"  => crate::agent_spawn::exec_agent_result(args),
        "agent_kill"    => crate::agent_spawn::exec_agent_kill(args),
        // Account pool tools
        "account_add"    => crate::agent_spawn::accounts::exec_account_add(args),
        "account_list"   => crate::agent_spawn::accounts::exec_account_list(args),
        "account_remove" => crate::agent_spawn::accounts::exec_account_remove(args),
        // Agent chain tools
        "agent_chain"   => crate::agent_spawn::chain::exec_agent_chain(args),
        "chain_status"  => crate::agent_spawn::chain::exec_chain_status(args),
        // Digital twin tools
        "twin_start" | "twin_stop" | "twin_alerts" | "twin_status"
            => crate::digital_twin::alerts::execute_tool(name, args),
        // Twin dispatch (auto-spawn agents on events)
        "twin_dispatch_start" => exec_dispatch_start(args),
        "twin_dispatch_stop" => exec_dispatch_stop(),
        "twin_dispatch_status" => exec_dispatch_status(),
        // Accessibility tools
        "accessibility_read"      => exec_accessibility_read(args),
        "accessibility_click"     => exec_accessibility_click(args),
        "accessibility_set_value" => exec_accessibility_set_value(args),
        // RAG tools
        "rag_index"  => exec_rag_index(args),
        "rag_search" => exec_rag_search(args),
        "rag_status" => exec_rag_status(args),
        // Browser control tools (via Chrome extension WS bridge)
        "browser_search" | "browser_open" | "browser_read" | "browser_click"
        | "browser_fill" | "browser_screenshot" | "browser_tabs" | "browser_close"
        | "browser_accounts" | "browser_register"
        | "browser_send" | "browser_contacts"
        | "browser_reply" | "browser_wait_reply"
        | "browser_watch" | "browser_unwatch"
        | "browser_wait_event" => exec_browser_command(name, args),
        _ => tool_error(format!("Unknown tool: {}", name)),
    }
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

fn exec_screen_capture() -> ToolCallResult {
    match crate::vision::capture::capture_screen() {
        Ok(result) => {
            // Compress: downscale to max 1280px wide, JPEG quality 70
            let compressed = match crate::vision::capture::compress_capture(result, 1280, 70) {
                Ok(c) => c,
                Err(e) => return tool_error(format!("Screenshot compression failed: {}", e)),
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(&compressed.data);
            let summary = format_markdown(
                &[
                    ("tool", "screen_capture"),
                    ("status", "ok"),
                    ("format", "image/jpeg"),
                    ("width", &compressed.width.to_string()),
                    ("height", &compressed.height.to_string()),
                ],
                "Screenshot captured and attached as image below.",
                &[
                    ("Run OCR on a region", "screen_ocr"),
                    ("Interact with the screen", "screen_action"),
                    ("Full scan with window list", "screen_scan"),
                ],
            );
            ToolCallResult {
                content: vec![
                    ContentItem::Text { text: summary },
                    ContentItem::Image {
                        data: b64,
                        mime_type: "image/jpeg".to_string(),
                    },
                ],
                is_error: None,
            }
        }
        Err(e) => tool_error(format!("Screen capture failed: {}", e)),
    }
}

fn exec_screen_ocr(args: &Value) -> ToolCallResult {
    let x = args.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let y = args.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let w = args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let h = args.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let region_label = if w <= 0.0 || h <= 0.0 {
        "full-screen".to_string()
    } else {
        format!("({}, {}, {}x{})", x, y, w, h)
    };

    let ocr_result = if w <= 0.0 || h <= 0.0 {
        crate::vision::ocr::screen_ocr_full()
    } else {
        crate::vision::ocr::screen_ocr(x, y, w, h)
    };

    match ocr_result {
        Ok(result) => {
            let body = format!(
                "## Extracted Text\n\n```\n{}\n```\n\n**Matches found:** {}",
                result.full_text,
                result.matches.len()
            );
            let md = format_markdown(
                &[
                    ("tool", "screen_ocr"),
                    ("status", "ok"),
                    ("region", &region_label),
                    ("match_count", &result.matches.len().to_string()),
                ],
                &body,
                &[
                    ("Interact with recognized element", "screen_action"),
                    ("Capture screenshot for context", "screen_capture"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("OCR failed: {}", e)),
    }
}

fn exec_mouse_click(args: &Value) -> ToolCallResult {
    let x = args.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let y = args.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let button = args
        .get("button")
        .and_then(|v| v.as_str())
        .unwrap_or("left");

    match crate::vision::input::mouse_click(x, y, button) {
        Ok(()) => {
            let body = format!(
                "Clicked **{}** button at coordinates **({}, {})**.",
                button, x, y
            );
            let md = format_markdown(
                &[
                    ("tool", "mouse_click"),
                    ("status", "ok"),
                    ("button", button),
                    ("x", &x.to_string()),
                    ("y", &y.to_string()),
                ],
                &body,
                &[
                    ("Verify result", "screen_capture"),
                    ("Run OCR on click target", "screen_ocr"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Mouse click failed: {}", e)),
    }
}

fn exec_keyboard_type(args: &Value) -> ToolCallResult {
    let text = args
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if text.is_empty() {
        return tool_error("Missing required parameter: text".to_string());
    }

    match crate::vision::input::keyboard_type(text) {
        Ok(()) => {
            let preview = if text.len() > 80 {
                format!("{}...", &text[..80])
            } else {
                text.to_string()
            };
            let body = format!(
                "Typed **{} characters** via keyboard.\n\n**Text:** `{}`",
                text.len(),
                preview
            );
            let md = format_markdown(
                &[
                    ("tool", "keyboard_type"),
                    ("status", "ok"),
                    ("chars", &text.len().to_string()),
                ],
                &body,
                &[
                    ("Verify typed text", "screen_capture"),
                    ("Press Enter or special key", "screen_action"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Keyboard type failed: {}", e)),
    }
}

fn exec_window_list() -> ToolCallResult {
    match crate::vision::window::list_windows() {
        Ok(windows) => {
            let mut table = String::from(
                "## Windows\n\n| # | App | Title | Position | Size | On Screen |\n|---|-----|-------|----------|------|-----------|\n",
            );
            for (i, w) in windows.iter().enumerate() {
                table.push_str(&format!(
                    "| {} | {} | {} | ({}, {}) | {}x{} | {} |\n",
                    i + 1,
                    w.app_name,
                    w.title,
                    w.x, w.y,
                    w.width, w.height,
                    if w.is_on_screen { "yes" } else { "no" },
                ));
            }
            let md = format_markdown(
                &[
                    ("tool", "window_list"),
                    ("status", "ok"),
                    ("count", &windows.len().to_string()),
                ],
                &table,
                &[
                    ("Focus a window", "window_focus"),
                    ("Full scan with screenshot", "screen_scan"),
                    ("Click on a window", "screen_action"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Window list failed: {}", e)),
    }
}

fn exec_window_focus(args: &Value) -> ToolCallResult {
    let app_name = args
        .get("app_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let window_title = args
        .get("window_title")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if app_name.is_empty() {
        return tool_error("Missing required parameter: app_name".to_string());
    }

    match crate::vision::window::focus_window(app_name, window_title) {
        Ok(()) => {
            let title_info = if window_title.is_empty() {
                String::new()
            } else {
                format!(" (title: \"{}\")", window_title)
            };
            let body = format!("Focused window **{}**{}.", app_name, title_info);
            let md = format_markdown(
                &[
                    ("tool", "window_focus"),
                    ("status", "ok"),
                    ("app", app_name),
                    ("title", if window_title.is_empty() { "(any)" } else { window_title }),
                ],
                &body,
                &[
                    ("Capture the focused window", "screen_capture"),
                    ("Interact with the window", "screen_action"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Window focus failed: {}", e)),
    }
}

fn exec_screen_scan() -> ToolCallResult {
    // 1. Gather displays
    let displays = match crate::vision::capture::list_displays() {
        Ok(d) => d,
        Err(e) => return tool_error(format!("Failed to list displays: {}", e)),
    };

    // 2. Gather windows and enrich with center + display_id
    let windows = match crate::vision::window::list_windows() {
        Ok(w) => w,
        Err(e) => return tool_error(format!("Failed to list windows: {}", e)),
    };

    // 3. Active app = frontmost (first window, or AppleScript fallback)
    let active_app = windows
        .first()
        .map(|w| w.app_name.clone())
        .unwrap_or_else(|| "Unknown".to_string());

    // 4. Timestamp (ISO 8601 UTC)
    let cached_at = {
        let duration = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default();
        let secs = duration.as_secs();
        let days_since_epoch = secs / 86400;
        let time_of_day = secs % 86400;
        let hours = time_of_day / 3600;
        let minutes = (time_of_day % 3600) / 60;
        let seconds = time_of_day % 60;
        let (year, month, day) = days_to_ymd(days_since_epoch);
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            year, month, day, hours, minutes, seconds
        )
    };

    // 5. Capture a compressed screenshot
    let screenshot_b64: Option<String> = crate::vision::capture::capture_screen()
        .ok()
        .and_then(|cap| crate::vision::capture::compress_capture(cap, 1280, 70).ok())
        .map(|compressed| base64::engine::general_purpose::STANDARD.encode(&compressed.data));

    let has_screenshot = screenshot_b64.is_some();

    // Build markdown body
    let mut body = String::new();

    // Displays table
    body.push_str("## Displays\n\n| ID | Position | Size | Main |\n|----|-----------|----- |------|\n");
    for d in &displays {
        body.push_str(&format!(
            "| {} | ({}, {}) | {}x{} | {} |\n",
            d.id, d.x, d.y, d.width, d.height,
            if d.is_main { "yes" } else { "no" },
        ));
    }

    // Windows table
    body.push_str(&format!(
        "\n## Windows ({})\n\n| # | App | Title | Display | Center | Size |\n|---|-----|-------|---------|--------|------|\n",
        windows.len()
    ));
    for (i, w) in windows.iter().enumerate() {
        let center_x = w.x + w.width / 2.0;
        let center_y = w.y + w.height / 2.0;
        let display_id = displays
            .iter()
            .find(|d| {
                center_x >= d.x
                    && center_x < d.x + d.width
                    && center_y >= d.y
                    && center_y < d.y + d.height
            })
            .map(|d| d.id)
            .unwrap_or_else(|| displays.first().map(|d| d.id).unwrap_or(0));

        body.push_str(&format!(
            "| {} | {} | {} | {} | ({}, {}) | {}x{} |\n",
            i + 1,
            w.app_name, w.title, display_id,
            center_x, center_y,
            w.width, w.height,
        ));
    }

    body.push_str(&format!(
        "\n**Active app:** {}  \n**Screenshot attached:** {}\n",
        active_app,
        if has_screenshot { "yes" } else { "no" },
    ));

    let md = format_markdown(
        &[
            ("tool", "screen_scan"),
            ("status", "ok"),
            ("displays", &displays.len().to_string()),
            ("windows", &windows.len().to_string()),
            ("active_app", &active_app),
            ("cached_at", &cached_at),
        ],
        &body,
        &[
            ("Interact with a window", "screen_action"),
            ("Focus a specific app", "window_focus"),
            ("Run OCR on a region", "screen_ocr"),
        ],
    );

    if let Some(img_b64) = screenshot_b64 {
        ToolCallResult {
            content: vec![
                ContentItem::Text { text: md },
                ContentItem::Image {
                    data: img_b64,
                    mime_type: "image/jpeg".to_string(),
                },
            ],
            is_error: None,
        }
    } else {
        tool_text(md)
    }
}

fn exec_screen_action(args: &Value) -> ToolCallResult {
    let actions = match args.get("actions").and_then(|v| v.as_array()) {
        Some(a) => a,
        None => return tool_error("Missing required parameter: actions (must be an array)".to_string()),
    };

    let mut lines: Vec<String> = Vec::new();
    let mut content_items: Vec<ContentItem> = Vec::new();
    let mut ok_count: usize = 0;
    let mut err_count: usize = 0;

    for (i, action) in actions.iter().enumerate() {
        let step = i + 1;
        let action_type = action
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match action_type {
            "focus" => {
                let app = action.get("app").and_then(|v| v.as_str()).unwrap_or("");
                if app.is_empty() {
                    err_count += 1;
                    lines.push(format!("{}. **focus** -- FAIL: missing `app` field", step));
                } else {
                    match crate::vision::window::focus_window(app, "") {
                        Ok(()) => {
                            ok_count += 1;
                            lines.push(format!("{}. **focus** `{}` -- OK", step, app));
                        }
                        Err(e) => {
                            err_count += 1;
                            lines.push(format!("{}. **focus** `{}` -- FAIL: {}", step, app, e));
                        }
                    }
                }
            }
            "click" => {
                let x = action.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y = action.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let button = action
                    .get("button")
                    .and_then(|v| v.as_str())
                    .unwrap_or("left");
                match crate::vision::input::mouse_click(x, y, button) {
                    Ok(()) => {
                        ok_count += 1;
                        lines.push(format!("{}. **click** {} at ({}, {}) -- OK", step, button, x, y));
                    }
                    Err(e) => {
                        err_count += 1;
                        lines.push(format!("{}. **click** ({}, {}) -- FAIL: {}", step, x, y, e));
                    }
                }
            }
            "type" => {
                let text = action.get("text").and_then(|v| v.as_str()).unwrap_or("");
                if text.is_empty() {
                    err_count += 1;
                    lines.push(format!("{}. **type** -- FAIL: missing `text` field", step));
                } else {
                    match crate::vision::input::keyboard_type(text) {
                        Ok(()) => {
                            ok_count += 1;
                            lines.push(format!("{}. **type** {} chars -- OK", step, text.len()));
                        }
                        Err(e) => {
                            err_count += 1;
                            lines.push(format!("{}. **type** -- FAIL: {}", step, e));
                        }
                    }
                }
            }
            "key" => {
                let keys = action
                    .get("keys")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let mut all_ok = true;
                let mut key_names: Vec<String> = Vec::new();
                for key_val in &keys {
                    let key_str = key_val.as_str().unwrap_or("");
                    match crate::vision::input::keyboard_press(key_str) {
                        Ok(()) => key_names.push(format!("`{}`", key_str)),
                        Err(e) => {
                            all_ok = false;
                            key_names.push(format!("`{}` (FAIL: {})", key_str, e));
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(30));
                }
                if all_ok {
                    ok_count += 1;
                    lines.push(format!("{}. **key** {} -- OK", step, key_names.join(", ")));
                } else {
                    err_count += 1;
                    lines.push(format!("{}. **key** {} -- PARTIAL FAIL", step, key_names.join(", ")));
                }
            }
            "wait" => {
                let ms = action.get("ms").and_then(|v| v.as_u64()).unwrap_or(100);
                let capped = ms.min(30_000);
                std::thread::sleep(std::time::Duration::from_millis(capped));
                ok_count += 1;
                lines.push(format!("{}. **wait** {}ms -- OK", step, capped));
            }
            "capture" => {
                match crate::vision::capture::capture_screen() {
                    Ok(capture) => {
                        match crate::vision::capture::compress_capture(capture, 1280, 70) {
                            Ok(compressed) => {
                                let b64 = base64::engine::general_purpose::STANDARD.encode(&compressed.data);
                                ok_count += 1;
                                lines.push(format!(
                                    "{}. **capture** {}x{} JPEG -- OK (image attached)",
                                    step, compressed.width, compressed.height
                                ));
                                content_items.push(ContentItem::Image {
                                    data: b64,
                                    mime_type: "image/jpeg".to_string(),
                                });
                            }
                            Err(e) => {
                                err_count += 1;
                                lines.push(format!("{}. **capture** -- FAIL: compression: {}", step, e));
                            }
                        }
                    }
                    Err(e) => {
                        err_count += 1;
                        lines.push(format!("{}. **capture** -- FAIL: {}", step, e));
                    }
                }
            }
            "ocr" => {
                let x = action.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y = action.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w = action.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let h = action.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let ocr_result = if w <= 0.0 || h <= 0.0 {
                    crate::vision::ocr::screen_ocr_full()
                } else {
                    crate::vision::ocr::screen_ocr(x, y, w, h)
                };
                match ocr_result {
                    Ok(result) => {
                        ok_count += 1;
                        let preview = if result.full_text.len() > 120 {
                            format!("{}...", &result.full_text[..120])
                        } else {
                            result.full_text.clone()
                        };
                        lines.push(format!(
                            "{}. **ocr** ({} matches) -- OK\n   > {}",
                            step, result.matches.len(), preview
                        ));
                    }
                    Err(e) => {
                        err_count += 1;
                        lines.push(format!("{}. **ocr** -- FAIL: {}", step, e));
                    }
                }
            }
            unknown => {
                err_count += 1;
                lines.push(format!("{}. **{}** -- FAIL: unknown action type", step, unknown));
            }
        };
    }

    let total = ok_count + err_count;
    let status = if err_count == 0 { "ok" } else { "partial_error" };

    let body = format!(
        "## Action Results\n\n{}\n\n**Summary:** {}/{} succeeded",
        lines.join("\n"),
        ok_count,
        total,
    );

    let md = format_markdown(
        &[
            ("tool", "screen_action"),
            ("status", status),
            ("total", &total.to_string()),
            ("ok", &ok_count.to_string()),
            ("errors", &err_count.to_string()),
        ],
        &body,
        &[
            ("Refresh screen state", "screen_scan"),
            ("Capture current screen", "screen_capture"),
        ],
    );

    // Prepend the text content, then append any captured images
    let mut all_content = vec![ContentItem::Text { text: md }];
    all_content.append(&mut content_items);

    ToolCallResult {
        content: all_content,
        is_error: if err_count > 0 { Some(false) } else { None },
    }
}

fn exec_workspace_list_files(args: &Value) -> ToolCallResult {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if path.is_empty() {
        return tool_error("Missing required parameter: path".to_string());
    }

    let root = PathBuf::from(path);
    if !root.is_dir() {
        return tool_error(format!("Not a directory: {}", path));
    }

    // Walk the directory and collect file entries
    let mut files: Vec<Value> = Vec::new();
    collect_files_recursive(&root, &root, &mut files);

    // Build a markdown table of files
    let mut table = String::from(
        "## Files\n\n| # | Path | Extension | Size |\n|---|------|-----------|------|\n",
    );
    for (i, f) in files.iter().enumerate() {
        let rel = f.get("relative_path").and_then(|v| v.as_str()).unwrap_or("?");
        let ext = f.get("extension").and_then(|v| v.as_str()).unwrap_or("");
        let size = f.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        table.push_str(&format!(
            "| {} | `{}` | {} | {} B |\n",
            i + 1, rel, ext, size,
        ));
    }

    let md = format_markdown(
        &[
            ("tool", "workspace_list_files"),
            ("status", "ok"),
            ("directory", path),
            ("file_count", &files.len().to_string()),
        ],
        &table,
        &[
            ("Read a file", "workspace_read_file"),
            ("Write a file", "workspace_write_file"),
        ],
    );
    tool_text(md)
}

fn exec_workspace_read_file(args: &Value) -> ToolCallResult {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if path.is_empty() {
        return tool_error("Missing required parameter: path".to_string());
    }

    match std::fs::read_to_string(path) {
        Ok(content) => {
            let line_count = content.lines().count();
            let ext = std::path::Path::new(path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("txt");
            let body = format!(
                "## Content of `{}`\n\n```{}\n{}\n```",
                path, ext, content,
            );
            let md = format_markdown(
                &[
                    ("tool", "workspace_read_file"),
                    ("status", "ok"),
                    ("path", path),
                    ("lines", &line_count.to_string()),
                    ("bytes", &content.len().to_string()),
                ],
                &body,
                &[
                    ("Write changes back", "workspace_write_file"),
                    ("List sibling files", "workspace_list_files"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Failed to read file: {}", e)),
    }
}

fn exec_workspace_write_file(args: &Value) -> ToolCallResult {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if path.is_empty() {
        return tool_error("Missing required parameter: path".to_string());
    }

    let file_path = PathBuf::from(path);

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return tool_error(format!("Failed to create directories: {}", e));
        }
    }

    match std::fs::write(&file_path, content) {
        Ok(()) => {
            let body = format!(
                "Written **{} bytes** to `{}`.",
                content.len(), path,
            );
            let md = format_markdown(
                &[
                    ("tool", "workspace_write_file"),
                    ("status", "ok"),
                    ("path", path),
                    ("bytes_written", &content.len().to_string()),
                ],
                &body,
                &[
                    ("Read it back", "workspace_read_file"),
                    ("List directory", "workspace_list_files"),
                ],
            );
            tool_text(md)
        }
        Err(e) => tool_error(format!("Failed to write file: {}", e)),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn tool_text(text: String) -> ToolCallResult {
    ToolCallResult {
        content: vec![ContentItem::Text { text }],
        is_error: None,
    }
}

fn tool_error(message: String) -> ToolCallResult {
    ToolCallResult {
        content: vec![ContentItem::Text { text: message }],
        is_error: Some(true),
    }
}

/// Convert days since Unix epoch to (year, month, day).
/// Civil calendar computation (Gregorian).
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d)
}

/// Extensions considered "code files" for workspace listing.
const CODE_EXTENSIONS: &[&str] = &[
    "md", "mdx", "markdown", "rs", "go", "py", "js", "ts", "tsx", "jsx",
    "json", "yaml", "yml", "toml", "php", "sh", "bash", "zsh", "swift",
    "dart", "html", "css", "scss", "sql", "graphql", "proto", "txt",
];

/// Directories to skip during workspace traversal.
const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next", ".nuxt",
    "vendor", "__pycache__", ".dart_tool", ".pub-cache", ".gradle",
];

fn collect_files_recursive(dir: &std::path::Path, root: &std::path::Path, files: &mut Vec<Value>) {
    let read_dir = match std::fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            let should_scan = !SKIP_DIRS.contains(&file_name.as_str())
                && (!file_name.starts_with('.')
                    || file_name == ".claude"
                    || file_name == ".plans"
                    || file_name == ".requests");
            if should_scan {
                collect_files_recursive(&path, root, files);
            }
            continue;
        }

        // Check extension
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !CODE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        files.push(json!({
            "path": path.to_string_lossy(),
            "relative_path": relative,
            "name": file_name,
            "extension": ext,
            "size": size,
        }));
    }
}

// ---------------------------------------------------------------------------
// Accessibility Tool Implementations
// ---------------------------------------------------------------------------

fn exec_accessibility_read(args: &Value) -> ToolCallResult {
    let app = args.get("app_name").and_then(|v| v.as_str()).unwrap_or("");
    if app.is_empty() {
        return tool_error("app_name is required".to_string());
    }

    match crate::vision::accessibility::read_app_ui(app) {
        Ok(result) => {
            let mut table = String::from("| # | Role | Title | Value | Position | Size | Focused |\n|---|------|-------|-------|----------|------|---------|\n");
            for (i, e) in result.elements.iter().enumerate() {
                let title_short = if e.title.len() > 30 { format!("{}...", &e.title[..27]) } else { e.title.clone() };
                let value_short = if e.value.len() > 30 { format!("{}...", &e.value[..27]) } else { e.value.clone() };
                table.push_str(&format!("| {} | {} | {} | {} | ({},{}) | {}x{} | {} |\n",
                    i+1, e.role, title_short, value_short,
                    e.position.0 as i32, e.position.1 as i32,
                    e.size.0 as i32, e.size.1 as i32,
                    if e.is_focused { "yes" } else { "" }));
            }

            let md = format_markdown(
                &[("type", "accessibility"), ("app", app), ("elements", &result.elements.len().to_string())],
                &format!("# UI Elements: {}\n\n**Elements found:** {}\n\n{}", app, result.elements.len(), table),
                &[
                    ("Click element", &format!("accessibility_click(app_name: \"{}\", role: \"button\", title: \"...\")", app)),
                    ("Set value", &format!("accessibility_set_value(app_name: \"{}\", role: \"text field\", title: \"...\", value: \"...\")", app)),
                ],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => tool_error(format!("Accessibility read failed: {}", e)),
    }
}

fn exec_accessibility_click(args: &Value) -> ToolCallResult {
    let app = args.get("app_name").and_then(|v| v.as_str()).unwrap_or("");
    let role = args.get("role").and_then(|v| v.as_str()).unwrap_or("");
    let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("");

    if app.is_empty() || role.is_empty() || title.is_empty() {
        return tool_error("app_name, role, and title are required".to_string());
    }

    match crate::vision::accessibility::click_element(app, role, title) {
        Ok(result) => {
            let md = format_markdown(
                &[("type", "accessibility_click"), ("app", app), ("status", "clicked")],
                &format!("# Clicked: {} `{}` in {}\n\nResult: {}", role, title, app, result),
                &[("Read UI", &format!("accessibility_read(app_name: \"{}\")", app))],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => tool_error(format!("Click failed: {}", e)),
    }
}

fn exec_accessibility_set_value(args: &Value) -> ToolCallResult {
    let app = args.get("app_name").and_then(|v| v.as_str()).unwrap_or("");
    let role = args.get("role").and_then(|v| v.as_str()).unwrap_or("");
    let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("");
    let value = args.get("value").and_then(|v| v.as_str()).unwrap_or("");

    if app.is_empty() || role.is_empty() || title.is_empty() {
        return tool_error("app_name, role, title, and value are required".to_string());
    }

    match crate::vision::accessibility::set_value(app, role, title, value) {
        Ok(result) => {
            let md = format_markdown(
                &[("type", "accessibility_set_value"), ("app", app), ("status", "set")],
                &format!("# Set Value: {} `{}` in {}\n\n**Value:** {}\n**Result:** {}", role, title, app, value, result),
                &[("Read UI", &format!("accessibility_read(app_name: \"{}\")", app))],
            );
            ToolCallResult { content: vec![ContentItem::Text { text: md }], is_error: None }
        }
        Err(e) => tool_error(format!("Set value failed: {}", e)),
    }
}

// ---------------------------------------------------------------------------
// RAG Tool Implementations
// ---------------------------------------------------------------------------

fn exec_rag_index(args: &Value) -> ToolCallResult {
    let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
    if path.is_empty() {
        return tool_error("path is required".to_string());
    }

    let source_type = args.get("source_type").and_then(|v| v.as_str()).unwrap_or("auto");
    let config = crate::rag::RagConfig::default();

    let store = match crate::rag::store::RagStore::open(config.clone()) {
        Ok(s) => s,
        Err(e) => return tool_error(format!("Failed to open RAG store: {}", e)),
    };

    let path_obj = std::path::Path::new(path);
    let (count, source_desc) = if path_obj.is_dir() {
        match crate::rag::indexer::index_directory(&store, &config, path) {
            Ok(c) => (c, "directory"),
            Err(e) => return tool_error(format!("Index failed: {}", e)),
        }
    } else {
        let st = if source_type == "auto" { "file" } else { source_type };
        match crate::rag::indexer::index_file(&store, &config, path, st) {
            Ok(c) => (c, "file"),
            Err(e) => return tool_error(format!("Index failed: {}", e)),
        }
    };

    let total = store.count().unwrap_or(0);
    let md = format_markdown(
        &[("type", "rag_index"), ("status", "indexed"), ("chunks", &count.to_string())],
        &format!("# RAG Index Complete\n\n**Source:** `{}`\n**Type:** {}\n**Chunks created:** {}\n**Total chunks in store:** {}", path, source_desc, count, total),
        &[
            ("Search", "rag_search(query: \"...\")"),
            ("Index more", "rag_index(path: \"...\")"),
            ("Status", "rag_status()"),
        ],
    );

    ToolCallResult {
        content: vec![ContentItem::Text { text: md }],
        is_error: None,
    }
}

fn exec_rag_search(args: &Value) -> ToolCallResult {
    let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
    if query.is_empty() {
        return tool_error("query is required".to_string());
    }

    let top_k = args.get("top_k").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
    let config = crate::rag::RagConfig::default();

    let store = match crate::rag::store::RagStore::open(config) {
        Ok(s) => s,
        Err(e) => return tool_error(format!("Failed to open RAG store: {}", e)),
    };

    match crate::rag::query::search(&store, query, top_k) {
        Ok((_results, md)) => ToolCallResult {
            content: vec![ContentItem::Text { text: md }],
            is_error: None,
        },
        Err(e) => tool_error(format!("Search failed: {}", e)),
    }
}

fn exec_rag_status(args: &Value) -> ToolCallResult {
    let _ = args;
    let config = crate::rag::RagConfig::default();

    let store = match crate::rag::store::RagStore::open(config.clone()) {
        Ok(s) => s,
        Err(e) => return tool_error(format!("Failed to open RAG store: {}", e)),
    };

    let count = store.count().unwrap_or(0);
    let sources = store.list_sources().unwrap_or_default();

    let mut sources_table = String::from("| Source | Type | Chunks |\n|--------|------|--------|\n");
    for (source, stype, chunks) in &sources {
        let short = if source.len() > 50 {
            format!("...{}", &source[source.len()-47..])
        } else {
            source.clone()
        };
        sources_table.push_str(&format!("| `{}` | {} | {} |\n", short, stype, chunks));
    }

    let md = format_markdown(
        &[("type", "rag_status"), ("chunks", &count.to_string()), ("sources", &sources.len().to_string())],
        &format!(
            "# RAG Knowledge Base Status\n\n**Data directory:** `{}`\n**Total chunks:** {}\n**Indexed sources:** {}\n\n## Sources\n\n{}",
            config.data_dir, count, sources.len(), sources_table
        ),
        &[
            ("Index files", "rag_index(path: \"/path/to/dir\")"),
            ("Search", "rag_search(query: \"...\")"),
        ],
    );

    ToolCallResult {
        content: vec![ContentItem::Text { text: md }],
        is_error: None,
    }
}

// ---------------------------------------------------------------------------
// Browser Control — Chrome Extension (via WS bridge on port 9997)
// ---------------------------------------------------------------------------

fn exec_browser_command(action: &str, args: &Value) -> ToolCallResult {
    use crate::digital_twin::ws_bridge;

    if !ws_bridge::is_connected() {
        return tool_error(
            "No Chrome extension connected. Install the Orchestra Twin Bridge extension and enable it."
                .to_string(),
        );
    }

    match ws_bridge::execute_command(action, args.clone()) {
        Ok(result) => {
            let text = serde_json::to_string_pretty(&result).unwrap_or_else(|_| result.to_string());
            ToolCallResult {
                content: vec![ContentItem::Text { text }],
                is_error: None,
            }
        }
        Err(e) => tool_error(format!("browser command failed: {}", e)),
    }
}

// ---------------------------------------------------------------------------
// Twin Dispatch — Auto-spawn agents on events
// ---------------------------------------------------------------------------

fn exec_dispatch_start(args: &Value) -> ToolCallResult {
    use crate::digital_twin::dispatch;

    let account = args.get("account").and_then(|v| v.as_str()).unwrap_or("whatsapp").to_string();
    let model = args.get("model").and_then(|v| v.as_str()).unwrap_or("claude-sonnet-4-5").to_string();
    let agent_slug = args.get("agent_slug").and_then(|v| v.as_str()).unwrap_or("twin-responder").to_string();
    let system_prompt = args.get("system_prompt").and_then(|v| v.as_str()).map(|s| s.to_string());

    let mut config = dispatch::DispatchConfig::default();
    config.account = account;
    config.model = model;
    config.agent_slug = agent_slug;
    if let Some(prompt) = system_prompt {
        config.system_prompt = prompt;
    }

    match dispatch::start(config) {
        Ok(msg) => ToolCallResult {
            content: vec![ContentItem::Text { text: msg }],
            is_error: None,
        },
        Err(e) => tool_error(e),
    }
}

fn exec_dispatch_stop() -> ToolCallResult {
    use crate::digital_twin::dispatch;
    match dispatch::stop() {
        Ok(msg) => ToolCallResult {
            content: vec![ContentItem::Text { text: msg }],
            is_error: None,
        },
        Err(e) => tool_error(e),
    }
}

fn exec_dispatch_status() -> ToolCallResult {
    use crate::digital_twin::dispatch;
    let status = dispatch::status();
    let text = serde_json::to_string_pretty(&status).unwrap_or_else(|_| status.to_string());
    ToolCallResult {
        content: vec![ContentItem::Text { text }],
        is_error: None,
    }
}
