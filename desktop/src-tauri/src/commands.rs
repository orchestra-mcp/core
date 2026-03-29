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
