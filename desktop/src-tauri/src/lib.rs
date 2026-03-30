// Orchestra Desktop — Tauri 2.x Library Entry Point

pub mod agent_spawn;
pub mod bridge;
pub mod cloud;
pub mod commands;
pub mod digital_twin;
pub mod mcp_bridge;
pub mod mcp_server;
pub mod rag;
pub mod tunnel;
pub mod vision;
pub mod workspace;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconEvent,
    Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

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
    let show = MenuItemBuilder::with_id("show", "Show Orchestra").build(app)?;
    let hide = MenuItemBuilder::with_id("hide", "Hide Orchestra").build(app)?;
    let dashboard = MenuItemBuilder::with_id("dashboard", "Dashboard").build(app)?;
    let workspace = MenuItemBuilder::with_id("workspace", "Workspace").build(app)?;
    let editor = MenuItemBuilder::with_id("editor", "Editor").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Orchestra").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&hide)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&dashboard)
        .item(&workspace)
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
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/dashboard'");
                }
            }
            "workspace" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/workspace'");
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

    // Handle tray icon click (left click) — always show and focus the window
    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button, .. } = event {
            if button == tauri::tray::MouseButton::Left {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }
    });

    log::info!("Tray icon configured with menu");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Define global hotkey shortcuts
    let shortcut_smart_actions = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyN);
    let shortcut_editor = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyO);
    let shortcut_dashboard = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyD);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["super+shift+n", "super+shift+o", "super+shift+d"])
                .expect("failed to register global shortcuts")
                .with_handler({
                    let sc_smart = shortcut_smart_actions;
                    let sc_editor = shortcut_editor;
                    let sc_dashboard = shortcut_dashboard;
                    move |app, shortcut, event| {
                        if event.state != ShortcutState::Pressed {
                            return;
                        }
                        let js = if shortcut == &sc_smart {
                            log::info!("Global hotkey: Cmd+Shift+N — Open Smart Actions");
                            "window.__openSmartActions()"
                        } else if shortcut == &sc_editor {
                            log::info!("Global hotkey: Cmd+Shift+O — Open Editor");
                            "window.__openEditor()"
                        } else if shortcut == &sc_dashboard {
                            log::info!("Global hotkey: Cmd+Shift+D — Open Dashboard");
                            "window.__openDashboard()"
                        } else {
                            return;
                        };

                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.eval(js);
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
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

            // Start MCP server (only activates if --mcp-stdio arg is present)
            mcp_server::start_mcp_server();

            // Start Twin Bridge WebSocket server (port 9997) — Chrome extension connects here
            digital_twin::ws_bridge::start();
            log::info!("[TwinBridge] Chrome extension bridge started on ws://localhost:9997/twin");

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept the close request — hide the window instead of quitting.
            // The only way to truly quit is via the "Quit Orchestra" tray menu item.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
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
            // OCR
            commands::screen_ocr,
            commands::screen_ocr_full,
            commands::screen_find_text,
            commands::ocr_extract,
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
            // Workspace
            workspace::scan_workspace,
            workspace::search_workspace,
            workspace::read_workspace_file,
            workspace::rename_workspace_file,
            workspace::delete_workspace_file,
            // Local MCP Server
            commands::generate_mcp_config,
            commands::preview_mcp_config,
            // Shell / Smart Actions
            commands::run_shell_command,
            commands::write_file,
            // Tunnel
            commands::tunnel_connect,
            commands::tunnel_disconnect,
            commands::tunnel_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orchestra Desktop");
}
