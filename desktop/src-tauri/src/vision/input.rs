// Vision: Input Injection — cross-platform implementation using enigo

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClickResult {
    pub x: f64,
    pub y: f64,
    pub button: String,
    pub success: bool,
}

/// Create a new Enigo instance with default settings.
fn new_enigo() -> Result<enigo::Enigo, String> {
    enigo::Enigo::new(&enigo::Settings::default())
        .map_err(|e| format!("Failed to create input controller: {}", e))
}

pub fn mouse_move(x: f64, y: f64) -> Result<(), String> {
    use enigo::{Coordinate, Mouse};
    let mut enigo = new_enigo()?;
    enigo
        .move_mouse(x as i32, y as i32, Coordinate::Abs)
        .map_err(|e| format!("Failed to move mouse: {}", e))
}

pub fn mouse_click(x: f64, y: f64, button: &str) -> Result<(), String> {
    use enigo::{Button, Coordinate, Direction, Mouse};
    let mut enigo = new_enigo()?;

    // Move to position first
    enigo
        .move_mouse(x as i32, y as i32, Coordinate::Abs)
        .map_err(|e| format!("Failed to move mouse: {}", e))?;

    let btn = match button {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };

    enigo
        .button(btn, Direction::Click)
        .map_err(|e| format!("Failed to click mouse: {}", e))
}

pub fn mouse_drag(from_x: f64, from_y: f64, to_x: f64, to_y: f64) -> Result<(), String> {
    use enigo::{Button, Coordinate, Direction, Mouse};
    let mut enigo = new_enigo()?;

    // Move to start position
    enigo
        .move_mouse(from_x as i32, from_y as i32, Coordinate::Abs)
        .map_err(|e| format!("Failed to move to drag start: {}", e))?;

    // Press left button
    enigo
        .button(Button::Left, Direction::Press)
        .map_err(|e| format!("Failed to press for drag: {}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(50));

    // Move to end position
    enigo
        .move_mouse(to_x as i32, to_y as i32, Coordinate::Abs)
        .map_err(|e| format!("Failed to move during drag: {}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(50));

    // Release left button
    enigo
        .button(Button::Left, Direction::Release)
        .map_err(|e| format!("Failed to release after drag: {}", e))
}

pub fn mouse_scroll(delta_x: i32, delta_y: i32) -> Result<(), String> {
    use enigo::{Axis, Mouse};
    let mut enigo = new_enigo()?;

    if delta_y != 0 {
        enigo
            .scroll(delta_y, Axis::Vertical)
            .map_err(|e| format!("Failed to scroll vertically: {}", e))?;
    }
    if delta_x != 0 {
        enigo
            .scroll(delta_x, Axis::Horizontal)
            .map_err(|e| format!("Failed to scroll horizontally: {}", e))?;
    }

    Ok(())
}

pub fn keyboard_type(text: &str) -> Result<(), String> {
    use enigo::Keyboard;
    let mut enigo = new_enigo()?;
    enigo
        .text(text)
        .map_err(|e| format!("Failed to type text: {}", e))
}

pub fn keyboard_press(keys: &str) -> Result<(), String> {
    use enigo::{Direction, Key, Keyboard};
    let mut enigo = new_enigo()?;

    let parts: Vec<String> = keys.split('+').map(|s| s.trim().to_lowercase()).collect();

    // Separate modifiers from the final key
    let mut modifiers: Vec<Key> = Vec::new();
    let mut final_key: Option<Key> = None;

    for part in &parts {
        match part.as_str() {
            "cmd" | "command" | "meta" => modifiers.push(Key::Meta),
            "ctrl" | "control" => modifiers.push(Key::Control),
            "alt" | "option" => modifiers.push(Key::Alt),
            "shift" => modifiers.push(Key::Shift),
            k => final_key = Some(str_to_key(k)),
        }
    }

    // Press all modifiers
    for m in &modifiers {
        enigo
            .key(*m, Direction::Press)
            .map_err(|e| format!("Failed to press modifier: {}", e))?;
    }

    // Click the final key (press + release)
    if let Some(key) = final_key {
        enigo
            .key(key, Direction::Click)
            .map_err(|e| format!("Failed to press key: {}", e))?;
    }

    // Release all modifiers in reverse order
    for m in modifiers.iter().rev() {
        enigo
            .key(*m, Direction::Release)
            .map_err(|e| format!("Failed to release modifier: {}", e))?;
    }

    Ok(())
}

/// Convert a string key name to an enigo Key.
fn str_to_key(key: &str) -> enigo::Key {
    use enigo::Key;

    match key {
        "return" | "enter" => Key::Return,
        "tab" => Key::Tab,
        "space" => Key::Space,
        "delete" | "backspace" => Key::Backspace,
        "escape" | "esc" => Key::Escape,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "f1" => Key::F1,
        "f2" => Key::F2,
        "f3" => Key::F3,
        "f4" => Key::F4,
        "f5" => Key::F5,
        "f6" => Key::F6,
        "f7" => Key::F7,
        "f8" => Key::F8,
        "f9" => Key::F9,
        "f10" => Key::F10,
        "f11" => Key::F11,
        "f12" => Key::F12,
        // Single character — use Unicode key
        s if s.len() == 1 => Key::Unicode(s.chars().next().unwrap()),
        // Unknown — try as single char anyway
        s => {
            if let Some(c) = s.chars().next() {
                Key::Unicode(c)
            } else {
                Key::Return // fallback
            }
        }
    }
}
