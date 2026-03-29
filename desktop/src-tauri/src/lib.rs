// Orchestra Desktop — Tauri 2.x Library Entry Point

pub mod bridge;
pub mod cloud;
pub mod commands;
pub mod vision;

use tauri::Manager;

/// Greet command — basic IPC example
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Orchestra Desktop.", name)
}

/// Get app version from Cargo.toml
#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            log::info!("Orchestra Desktop v{} started", env!("CARGO_PKG_VERSION"));
            log::info!("Window label: {}", window.label());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Core
            greet,
            get_version,
            // Vision
            commands::screen_capture,
            commands::mouse_click,
            commands::keyboard_type,
            commands::keyboard_press,
            commands::list_windows,
            commands::get_screen_size,
            // Data
            commands::get_stats,
            commands::get_agents,
            commands::get_recent_activity,
            commands::create_entity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orchestra Desktop");
}
