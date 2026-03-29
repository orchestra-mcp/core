// Orchestra Desktop — Tauri 2.x Library Entry Point

pub mod bridge;
pub mod cloud;
pub mod commands;
pub mod mcp_bridge;
pub mod vision;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconEvent,
    Manager,
};

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

/// Build the tray menu and wire up click handlers
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the tray icon that was created from tauri.conf.json
    let tray = app.tray_by_id("orchestra-tray").ok_or("tray not found")?;

    // Explicitly mark as macOS template image for proper dark/light mode support.
    // macOS will automatically invert the icon colors based on the menu bar appearance:
    // - Dark icon on light menu bar
    // - Light icon on dark menu bar
    // - Proper vibrancy effects applied automatically
    #[cfg(target_os = "macos")]
    let _ = tray.set_icon_as_template(true);

    // Build menu items
    let show_hide =
        MenuItemBuilder::with_id("show_hide", "Show/Hide Orchestra Desktop").build(app)?;
    let dashboard = MenuItemBuilder::with_id("dashboard", "Dashboard").build(app)?;
    let editor = MenuItemBuilder::with_id("editor", "Editor").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Orchestra").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&dashboard)
        .item(&editor)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&quit)
        .build()?;

    tray.set_menu(Some(menu))?;
    let _ = tray.set_show_menu_on_left_click(false);
    tray.set_tooltip(Some("Orchestra Desktop"))?;

    // Handle menu item clicks
    tray.on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "show_hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            "dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/dashboard'");
                }
            }
            "editor" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/editor'");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    });

    // Handle tray icon click (left click) — toggle window visibility
    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button, .. } = event {
            if button == tauri::tray::MouseButton::Left {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        }
    });

    log::info!("Tray icon configured with menu");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            log::info!("Orchestra Desktop v{} started", env!("CARGO_PKG_VERSION"));
            log::info!("Window label: {}", window.label());

            // Set up tray icon and menu
            if let Err(e) = setup_tray(app) {
                log::error!("Failed to setup tray: {}", e);
            }

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
            // MCP Bridge
            commands::mcp_test_connection,
            commands::mcp_generate_claude_desktop_config,
            commands::mcp_generate_claude_code_config,
            commands::mcp_install_claude_desktop,
            commands::mcp_install_claude_code_global,
            commands::mcp_install_claude_code_project,
            commands::mcp_get_config_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orchestra Desktop");
}
