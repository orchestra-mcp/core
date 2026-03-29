// Orchestra Desktop — Tauri IPC Commands
//
// All commands invokable from the React frontend via `invoke()`.
// Organized into: Vision commands, Data commands (mock for now).

use base64::Engine;
use serde_json;

// ─── Vision Commands ───────────────────────────────────────────────

/// Capture the full screen, return base64-encoded PNG
#[tauri::command]
pub async fn screen_capture() -> Result<String, String> {
    let result = crate::vision::capture::capture_screen()?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&result.data))
}

/// Click the mouse at (x, y) with the given button ("left" or "right")
#[tauri::command]
pub async fn mouse_click(x: f64, y: f64, button: String) -> Result<(), String> {
    crate::vision::input::mouse_click(x, y, &button)
}

/// Type text character-by-character via simulated keyboard events
#[tauri::command]
pub async fn keyboard_type(text: String) -> Result<(), String> {
    crate::vision::input::keyboard_type(&text)
}

/// Press a key combo (e.g. "cmd+c", "ctrl+shift+a")
#[tauri::command]
pub async fn keyboard_press(keys: String) -> Result<(), String> {
    crate::vision::input::keyboard_press(&keys)
}

/// List all visible windows on the screen
#[tauri::command]
pub async fn list_windows() -> Result<Vec<crate::vision::window::WindowInfo>, String> {
    crate::vision::window::list_windows()
}

/// Get the main display's screen dimensions
#[tauri::command]
pub async fn get_screen_size() -> Result<crate::vision::window::ScreenSize, String> {
    Ok(crate::vision::window::get_screen_size())
}

// ─── MCP Bridge Commands ──────────────────────────────────────────

/// Test connection to the MCP server (initialize + tools/list)
#[tauri::command]
pub async fn mcp_test_connection(
    server_url: String,
    token: String,
) -> Result<crate::mcp_bridge::ConnectionTestResult, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    Ok(crate::mcp_bridge::test_connection(&url, &token).await)
}

/// Generate Claude Desktop config content (returns JSON string, does not write)
#[tauri::command]
pub async fn mcp_generate_claude_desktop_config(
    server_url: String,
    token: String,
) -> Result<String, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    Ok(crate::mcp_bridge::generate_claude_desktop_config(&url, &token))
}

/// Generate Claude Code .mcp.json config content (returns JSON string, does not write)
#[tauri::command]
pub async fn mcp_generate_claude_code_config(
    server_url: String,
    token: String,
) -> Result<String, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    Ok(crate::mcp_bridge::generate_claude_code_config(&url, &token))
}

/// Install MCP config for Claude Desktop (merges into existing config)
#[tauri::command]
pub async fn mcp_install_claude_desktop(
    server_url: String,
    token: String,
) -> Result<crate::mcp_bridge::ConfigGenerationResult, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    crate::mcp_bridge::write_claude_desktop_config(&url, &token)
}

/// Install MCP config for Claude Code globally (~/.claude/mcp.json)
#[tauri::command]
pub async fn mcp_install_claude_code_global(
    server_url: String,
    token: String,
) -> Result<crate::mcp_bridge::ConfigGenerationResult, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    crate::mcp_bridge::write_claude_code_global_config(&url, &token)
}

/// Install MCP config for Claude Code in a specific project directory
#[tauri::command]
pub async fn mcp_install_claude_code_project(
    project_path: String,
    server_url: String,
    token: String,
) -> Result<crate::mcp_bridge::ConfigGenerationResult, String> {
    let url = if server_url.is_empty() {
        "http://localhost:9999".to_string()
    } else {
        server_url
    };
    if project_path.is_empty() {
        return Err("Project path is required".to_string());
    }
    crate::mcp_bridge::write_claude_code_project_config(&project_path, &url, &token)
}

/// Get the default config file paths for Claude Desktop and Claude Code
#[tauri::command]
pub async fn mcp_get_config_paths() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "claude_desktop": crate::mcp_bridge::claude_desktop_config_path().to_string_lossy(),
        "claude_code_global": crate::mcp_bridge::claude_code_global_config_path().to_string_lossy(),
    }))
}

// ─── Data Commands (mock — will call Supabase later) ───────────────

/// Get dashboard stats
#[tauri::command]
pub async fn get_stats() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "active_tasks": 12,
        "agents_online": 6,
        "sessions": 3,
        "memories": 847
    }))
}

/// Get list of online agents
#[tauri::command]
pub async fn get_agents() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([
        { "id": "1", "name": "Omar El-Sayed", "role": "Laravel Developer", "status": "online" },
        { "id": "2", "name": "Mostafa Hassan", "role": "Go Developer", "status": "online" },
        { "id": "3", "name": "Yassin Farouk", "role": "Frontend Developer", "status": "busy" },
        { "id": "4", "name": "Mariam Helmy", "role": "QA Engineer", "status": "offline" }
    ]))
}

/// Get recent activity feed
#[tauri::command]
pub async fn get_recent_activity() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([
        { "id": "1", "action": "Created", "subject": "Phase 3 implementation plan", "timestamp": "2 min ago" },
        { "id": "2", "action": "Completed", "subject": "Docker Compose setup", "timestamp": "15 min ago" },
        { "id": "3", "action": "Assigned", "subject": "MCP server auth module", "timestamp": "1 hr ago" },
        { "id": "4", "action": "Reviewed", "subject": "Database migration #12", "timestamp": "2 hr ago" },
        { "id": "5", "action": "Deployed", "subject": "Edge function update", "timestamp": "3 hr ago" }
    ]))
}

/// Create a new entity via Smart Actions
#[tauri::command]
pub async fn create_entity(entity_type: String, title: String, content: String) -> Result<String, String> {
    log::info!("Creating entity: type={}, title={}, content_len={}", entity_type, title, content.len());
    // TODO: Wire to real MCP backend (note_create, agent_create, skill_create, etc.)
    Ok(format!("Created {} '{}' successfully", entity_type, title))
}
