// Vision: Accessibility API — Headless UI Interaction
//
// Uses macOS AXUIElement API to read UI element trees and interact
// with elements WITHOUT moving the mouse or changing focus.
// Linux: uses AT-SPI2 via atspi (stub for now)
// Windows: uses UIAutomation (stub for now)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIElement {
    pub role: String,
    pub title: String,
    pub value: String,
    pub description: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub children_count: usize,
    pub is_focused: bool,
    pub is_enabled: bool,
    pub identifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityResult {
    pub app_name: String,
    pub elements: Vec<UIElement>,
    pub focused_element: Option<UIElement>,
}

// ── macOS Implementation ─────────────────────────────────────────

#[cfg(target_os = "macos")]
pub fn read_app_ui(app_name: &str) -> Result<AccessibilityResult, String> {
    use std::process::Command;

    // Use AppleScript to get the AX element tree
    // This is simpler than raw AXUIElement FFI and works without
    // linking ApplicationServices framework directly
    let script = format!(r#"
        tell application "System Events"
            set appProcess to first process whose name is "{}"
            set uiElements to {{}}

            try
                set wins to windows of appProcess
                repeat with w in wins
                    set winTitle to name of w
                    set winPos to position of w
                    set winSize to size of w

                    -- Get top-level UI elements
                    set elems to UI elements of w
                    repeat with elem in elems
                        try
                            set elemRole to role of elem
                            set elemTitle to ""
                            try
                                set elemTitle to title of elem
                            end try
                            set elemValue to ""
                            try
                                set elemValue to value of elem as text
                            end try
                            set elemDesc to ""
                            try
                                set elemDesc to description of elem
                            end try
                            set elemPos to {{0, 0}}
                            try
                                set elemPos to position of elem
                            end try
                            set elemSize to {{0, 0}}
                            try
                                set elemSize to size of elem
                            end try
                            set elemFocused to false
                            try
                                set elemFocused to focused of elem
                            end try
                            set elemEnabled to true
                            try
                                set elemEnabled to enabled of elem
                            end try

                            set end of uiElements to {{elemRole, elemTitle, elemValue, elemDesc, item 1 of elemPos, item 2 of elemPos, item 1 of elemSize, item 2 of elemSize, elemFocused, elemEnabled}}
                        end try
                    end repeat
                end repeat
            end try

            return uiElements
        end tell
    "#, app_name);

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run accessibility script: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Accessibility error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let elements = parse_applescript_elements(&stdout);

    let focused = elements.iter().find(|e| e.is_focused).cloned();

    Ok(AccessibilityResult {
        app_name: app_name.to_string(),
        elements,
        focused_element: focused,
    })
}

#[cfg(target_os = "macos")]
fn parse_applescript_elements(output: &str) -> Vec<UIElement> {
    // AppleScript returns comma-separated lists
    // Simple parser for the structured output
    let mut elements = Vec::new();
    let trimmed = output.trim();
    if trimmed.is_empty() {
        return elements;
    }

    // Each element is a group of 10 values
    // Parse line by line, splitting on commas
    for line in trimmed.lines() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() >= 10 {
            elements.push(UIElement {
                role: parts[0].trim_matches('"').to_string(),
                title: parts[1].trim_matches('"').to_string(),
                value: parts[2].trim_matches('"').to_string(),
                description: parts[3].trim_matches('"').to_string(),
                position: (
                    parts[4].parse().unwrap_or(0.0),
                    parts[5].parse().unwrap_or(0.0),
                ),
                size: (
                    parts[6].parse().unwrap_or(0.0),
                    parts[7].parse().unwrap_or(0.0),
                ),
                children_count: 0,
                is_focused: parts[8].contains("true"),
                is_enabled: parts[9].contains("true"),
                identifier: String::new(),
            });
        }
    }

    elements
}

/// Click a UI element by performing AX action "AXPress"
#[cfg(target_os = "macos")]
pub fn click_element(app_name: &str, role: &str, title: &str) -> Result<String, String> {
    use std::process::Command;

    let script = format!(r#"
        tell application "System Events"
            set appProcess to first process whose name is "{}"
            tell appProcess
                try
                    click (first {} of first window whose title is "{}")
                    return "clicked"
                on error errMsg
                    return "error: " & errMsg
                end try
            end tell
        end tell
    "#, app_name, role, title);

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Click failed: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Set the value of a text field
#[cfg(target_os = "macos")]
pub fn set_value(app_name: &str, role: &str, title: &str, value: &str) -> Result<String, String> {
    use std::process::Command;

    let script = format!(r#"
        tell application "System Events"
            set appProcess to first process whose name is "{}"
            tell appProcess
                try
                    set value of (first {} of first window whose title is "{}") to "{}"
                    return "value set"
                on error errMsg
                    return "error: " & errMsg
                end try
            end tell
        end tell
    "#, app_name, role, title, value.replace('"', "\\\""));

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Set value failed: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

// ── Linux Stub ───────────────────────────────────────────────────

#[cfg(target_os = "linux")]
pub fn read_app_ui(app_name: &str) -> Result<AccessibilityResult, String> {
    Err(format!("Accessibility API not yet implemented on Linux for {}", app_name))
}

#[cfg(target_os = "linux")]
pub fn click_element(_app: &str, _role: &str, _title: &str) -> Result<String, String> {
    Err("Accessibility click not yet implemented on Linux".to_string())
}

#[cfg(target_os = "linux")]
pub fn set_value(_app: &str, _role: &str, _title: &str, _value: &str) -> Result<String, String> {
    Err("Accessibility set_value not yet implemented on Linux".to_string())
}

// ── Windows Stub ─────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub fn read_app_ui(app_name: &str) -> Result<AccessibilityResult, String> {
    Err(format!("Accessibility API not yet implemented on Windows for {}", app_name))
}

#[cfg(target_os = "windows")]
pub fn click_element(_app: &str, _role: &str, _title: &str) -> Result<String, String> {
    Err("Accessibility click not yet implemented on Windows".to_string())
}

#[cfg(target_os = "windows")]
pub fn set_value(_app: &str, _role: &str, _title: &str, _value: &str) -> Result<String, String> {
    Err("Accessibility set_value not yet implemented on Windows".to_string())
}
