// Vision: Window Management — macOS implementation

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

#[cfg(target_os = "macos")]
pub mod macos {
    use super::*;
    use std::process::Command;

    pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
        // Use AppleScript to list windows (more reliable than CGWindowListCopyWindowInfo for titles)
        let script = r#"
            set windowList to ""
            tell application "System Events"
                set appProcesses to every process whose visible is true
                repeat with proc in appProcesses
                    set appName to name of proc
                    try
                        set appWindows to every window of proc
                        repeat with win in appWindows
                            set winName to name of win
                            set winPos to position of win
                            set winSize to size of win
                            set windowList to windowList & appName & "|" & winName & "|" & (item 1 of winPos) & "|" & (item 2 of winPos) & "|" & (item 1 of winSize) & "|" & (item 2 of winSize) & "\n"
                        end repeat
                    end try
                end repeat
            end tell
            return windowList
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut windows = Vec::new();
        let mut id = 1u32;

        for line in stdout.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                windows.push(WindowInfo {
                    id,
                    app_name: parts[0].to_string(),
                    title: parts[1].to_string(),
                    x: parts[2].parse().unwrap_or(0.0),
                    y: parts[3].parse().unwrap_or(0.0),
                    width: parts[4].parse().unwrap_or(0.0),
                    height: parts[5].parse().unwrap_or(0.0),
                    is_on_screen: true,
                });
                id += 1;
            }
        }

        Ok(windows)
    }

    pub fn focus_window(app_name: &str, window_title: &str) -> Result<(), String> {
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

    pub fn get_screen_size() -> ScreenSize {
        use core_graphics::display::CGDisplay;
        let display = CGDisplay::main();
        let bounds = display.bounds();
        ScreenSize {
            width: bounds.size.width,
            height: bounds.size.height,
        }
    }
}

// Platform dispatch
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "macos")]
    return macos::list_windows();
    #[cfg(not(target_os = "macos"))]
    Err("Window management not supported on this platform".to_string())
}

pub fn focus_window(app_name: &str, window_title: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::focus_window(app_name, window_title);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}

pub fn get_screen_size() -> ScreenSize {
    #[cfg(target_os = "macos")]
    return macos::get_screen_size();
    #[cfg(not(target_os = "macos"))]
    ScreenSize { width: 1920.0, height: 1080.0 }
}
