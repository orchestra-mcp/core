// Vision: Window Management — cross-platform implementation using xcap + platform commands

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_on_screen: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenSize {
    pub width: f64,
    pub height: f64,
}

/// List all visible windows using xcap::Window.
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    let windows =
        xcap::Window::all().map_err(|e| format!("Failed to list windows: {}", e))?;

    let mut result = Vec::new();
    for win in &windows {
        let id = win.id().unwrap_or(0);
        let title = win.title().unwrap_or_default();
        let app_name = win.app_name().unwrap_or_default();
        let x = win.x().unwrap_or(0) as f64;
        let y = win.y().unwrap_or(0) as f64;
        let width = win.width().unwrap_or(0) as f64;
        let height = win.height().unwrap_or(0) as f64;
        let is_minimized = win.is_minimized().unwrap_or(false);

        // Skip windows with no title or that are minimized
        if title.is_empty() && app_name.is_empty() {
            continue;
        }

        result.push(WindowInfo {
            id,
            title,
            app_name,
            x,
            y,
            width,
            height,
            is_on_screen: !is_minimized,
        });
    }

    Ok(result)
}

/// Focus a window by app name and optional window title.
/// Uses platform-specific commands: `open -a` on macOS, `xdotool` on Linux.
pub fn focus_window(app_name: &str, window_title: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return focus_window_macos(app_name, window_title);

    #[cfg(target_os = "linux")]
    return focus_window_linux(app_name, window_title);

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    Err("Window focus not supported on this platform".to_string())
}

#[cfg(target_os = "macos")]
fn focus_window_macos(app_name: &str, window_title: &str) -> Result<(), String> {
    use std::process::Command;

    // Primary: use `open -a` which launches if not running and brings to
    // front reliably — even over fullscreen windows on macOS.
    let open_result = Command::new("open")
        .args(["-a", app_name])
        .output()
        .map_err(|e| format!("Failed to run `open -a`: {}", e))?;

    if open_result.status.success() {
        // Wait for the window to appear / activate
        std::thread::sleep(std::time::Duration::from_millis(500));

        // If a specific window title was requested, try to raise it via
        // AppleScript (best-effort — the app is already frontmost).
        if !window_title.is_empty() {
            let raise_script = format!(
                r#"tell application "System Events"
                    tell process "{}"
                        try
                            set win to (first window whose name contains "{}")
                            perform action "AXRaise" of win
                        end try
                    end tell
                end tell"#,
                app_name, window_title
            );
            let _ = Command::new("osascript")
                .arg("-e")
                .arg(&raise_script)
                .output();
        }

        // Verify the app is frontmost
        let verify_script =
            r#"tell application "System Events" to return name of first process whose frontmost is true"#;
        if let Ok(output) = Command::new("osascript")
            .arg("-e")
            .arg(verify_script)
            .output()
        {
            let frontmost = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !frontmost.eq_ignore_ascii_case(app_name) {
                log::warn!(
                    "focus_window: expected '{}' frontmost but got '{}'",
                    app_name,
                    frontmost
                );
            }
        }

        return Ok(());
    }

    // Fallback: full AppleScript approach (handles edge cases where `open`
    // doesn't recognise the app name but AppleScript does).
    let script = format!(
        r#"tell application "{}" to activate
        tell application "System Events"
            tell process "{}"
                try
                    set frontmost to true
                    set win to (first window whose name contains "{}")
                    perform action "AXRaise" of win
                end try
            end tell
        end tell"#,
        app_name, app_name, window_title
    );

    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to focus window: {}", e))?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn focus_window_linux(app_name: &str, window_title: &str) -> Result<(), String> {
    use std::process::Command;

    // Use xdotool to search for and activate the window
    let search_term = if !window_title.is_empty() {
        window_title
    } else {
        app_name
    };

    let output = Command::new("xdotool")
        .args(["search", "--name", search_term])
        .output()
        .map_err(|e| format!("Failed to run xdotool: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Some(window_id) = stdout.lines().next() {
        Command::new("xdotool")
            .args(["windowactivate", window_id])
            .output()
            .map_err(|e| format!("Failed to activate window: {}", e))?;
        Ok(())
    } else {
        Err(format!("Window '{}' not found", search_term))
    }
}

/// Get the screen size of the primary monitor using xcap.
pub fn get_screen_size() -> ScreenSize {
    match xcap::Monitor::all() {
        Ok(monitors) => {
            let monitor = monitors
                .iter()
                .find(|m| m.is_primary().unwrap_or(false))
                .or_else(|| monitors.first());

            match monitor {
                Some(m) => ScreenSize {
                    width: m.width().unwrap_or(1920) as f64,
                    height: m.height().unwrap_or(1080) as f64,
                },
                None => ScreenSize {
                    width: 1920.0,
                    height: 1080.0,
                },
            }
        }
        Err(_) => ScreenSize {
            width: 1920.0,
            height: 1080.0,
        },
    }
}
