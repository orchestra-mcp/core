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

// ─── OCR Commands ─────────────────────────────────────────────────

/// Run OCR on a screen region — captures the region and extracts text
#[tauri::command]
pub async fn screen_ocr(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<crate::vision::ocr::OcrResult, String> {
    crate::vision::ocr::screen_ocr(x, y, width, height)
}

/// Run OCR on the full screen — captures everything and extracts text
#[tauri::command]
pub async fn screen_ocr_full() -> Result<crate::vision::ocr::OcrResult, String> {
    crate::vision::ocr::screen_ocr_full()
}

/// Find text on screen — returns bounding boxes in pixel coordinates
/// for all observations containing the needle (case-insensitive)
#[tauri::command]
pub async fn screen_find_text(
    needle: String,
) -> Result<Vec<crate::vision::ocr::TextMatch>, String> {
    crate::vision::ocr::screen_find_text(&needle)
}

/// Run OCR on raw PNG image bytes (base64-encoded input)
#[tauri::command]
pub async fn ocr_extract(image_base64: String) -> Result<crate::vision::ocr::OcrResult, String> {
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&image_base64)
        .map_err(|e| format!("Invalid base64 image data: {}", e))?;
    crate::vision::ocr::ocr_extract(&image_data)
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

// ─── Local MCP Server Commands ───────────────────────────────────

/// Generate .mcp.json config for the local desktop MCP server
/// and write it to the workspace directory.
/// Returns the path to the written config file.
#[tauri::command]
pub async fn generate_mcp_config(workspace_path: String) -> Result<String, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is required".to_string());
    }
    let root = std::path::PathBuf::from(&workspace_path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", workspace_path));
    }
    crate::mcp_server::server::write_mcp_config(&workspace_path)
}

/// Get the MCP server config content as JSON string (preview, does not write).
#[tauri::command]
pub async fn preview_mcp_config(workspace_path: String) -> Result<String, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is required".to_string());
    }
    crate::mcp_server::server::generate_mcp_config(&workspace_path)
}

// ─── Shell Commands ──────────────────────────────────────────────

/// Execute a shell command in a given directory, returning combined stdout/stderr
#[tauri::command]
pub async fn run_shell_command(command: String, cwd: Option<String>) -> Result<serde_json::Value, String> {
    use std::process::Command;

    log::info!("Running shell command: {} (cwd: {:?})", command, cwd);

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let mut cmd = Command::new(shell);
    cmd.arg(flag).arg(&command);

    if let Some(ref dir) = cwd {
        let path = std::path::PathBuf::from(dir);
        if path.is_dir() {
            cmd.current_dir(&path);
        } else {
            return Err(format!("Directory not found: {}", dir));
        }
    }

    // Inherit PATH from environment
    if let Ok(path) = std::env::var("PATH") {
        cmd.env("PATH", path);
    }

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(serde_json::json!({
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code,
                "success": output.status.success(),
            }))
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}

/// Write content to a file at the given path, creating parent directories as needed
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = std::path::PathBuf::from(&path);

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

// ─── Tunnel Commands ────────────────────────────────────────────

/// Connect the cloud-desktop reverse WebSocket tunnel.
///
/// Establishes a persistent connection to the gateway. If auto_reconnect is true
/// (default), the tunnel will automatically reconnect with exponential backoff.
#[tauri::command]
pub async fn tunnel_connect(
    gateway_url: String,
    tunnel_id: String,
    connection_token: String,
    auto_reconnect: Option<bool>,
) -> Result<crate::tunnel::types::ConnectionStats, String> {
    let config = crate::tunnel::types::TunnelConfig {
        gateway_url,
        tunnel_id,
        connection_token,
        auto_reconnect: auto_reconnect.unwrap_or(true),
    };
    crate::tunnel::cmd_connect(config).await
}

/// Disconnect the cloud-desktop reverse WebSocket tunnel.
#[tauri::command]
pub async fn tunnel_disconnect() -> Result<(), String> {
    crate::tunnel::cmd_disconnect().await
}

/// Get the current tunnel connection status and statistics.
#[tauri::command]
pub async fn tunnel_status() -> Result<crate::tunnel::types::ConnectionStats, String> {
    crate::tunnel::cmd_status().await
}
