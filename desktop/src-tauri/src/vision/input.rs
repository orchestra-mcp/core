// Vision: Input Injection — macOS CGEvent implementation

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClickResult {
    pub x: f64,
    pub y: f64,
    pub button: String,
    pub success: bool,
}

#[cfg(target_os = "macos")]
pub mod macos {
    use core_graphics::event::{
        CGEvent, CGEventTapLocation, CGEventType, CGMouseButton, CGEventFlags,
    };
    use core_graphics::event_source::CGEventSource;
    use core_graphics::geometry::CGPoint;

    fn event_source() -> CGEventSource {
        CGEventSource::new(core_graphics::event_source::CGEventSourceStateID::HIDSystemState)
            .expect("Failed to create event source")
    }

    pub fn mouse_move(x: f64, y: f64) -> Result<(), String> {
        let point = CGPoint::new(x, y);
        let event = CGEvent::new_mouse_event(
            event_source(),
            CGEventType::MouseMoved,
            point,
            CGMouseButton::Left,
        ).map_err(|_| "Failed to create mouse move event".to_string())?;
        event.post(CGEventTapLocation::HID);
        Ok(())
    }

    pub fn mouse_click(x: f64, y: f64, button: &str) -> Result<(), String> {
        let point = CGPoint::new(x, y);
        let (btn, down_type, up_type) = match button {
            "right" => (CGMouseButton::Right, CGEventType::RightMouseDown, CGEventType::RightMouseUp),
            _ => (CGMouseButton::Left, CGEventType::LeftMouseDown, CGEventType::LeftMouseUp),
        };

        let down = CGEvent::new_mouse_event(event_source(), down_type, point, btn)
            .map_err(|_| "Failed to create mouse down".to_string())?;
        let up = CGEvent::new_mouse_event(event_source(), up_type, point, btn)
            .map_err(|_| "Failed to create mouse up".to_string())?;

        down.post(CGEventTapLocation::HID);
        std::thread::sleep(std::time::Duration::from_millis(50));
        up.post(CGEventTapLocation::HID);
        Ok(())
    }

    pub fn mouse_drag(from_x: f64, from_y: f64, to_x: f64, to_y: f64) -> Result<(), String> {
        let down = CGEvent::new_mouse_event(
            event_source(), CGEventType::LeftMouseDown, CGPoint::new(from_x, from_y), CGMouseButton::Left,
        ).map_err(|_| "Failed to create drag start".to_string())?;
        down.post(CGEventTapLocation::HID);
        std::thread::sleep(std::time::Duration::from_millis(50));

        let drag = CGEvent::new_mouse_event(
            event_source(), CGEventType::LeftMouseDragged, CGPoint::new(to_x, to_y), CGMouseButton::Left,
        ).map_err(|_| "Failed to create drag move".to_string())?;
        drag.post(CGEventTapLocation::HID);
        std::thread::sleep(std::time::Duration::from_millis(50));

        let up = CGEvent::new_mouse_event(
            event_source(), CGEventType::LeftMouseUp, CGPoint::new(to_x, to_y), CGMouseButton::Left,
        ).map_err(|_| "Failed to create drag end".to_string())?;
        up.post(CGEventTapLocation::HID);
        Ok(())
    }

    pub fn mouse_scroll(delta_x: i32, delta_y: i32) -> Result<(), String> {
        let event = CGEvent::new_scroll_event(
            event_source(),
            core_graphics::event::ScrollEventUnit::PIXEL,
            2, delta_y, delta_x, 0,
        ).map_err(|_| "Failed to create scroll event".to_string())?;
        event.post(CGEventTapLocation::HID);
        Ok(())
    }

    pub fn keyboard_type(text: &str) -> Result<(), String> {
        for ch in text.chars() {
            let event = CGEvent::new_keyboard_event(event_source(), 0, true)
                .map_err(|_| "Failed to create key event".to_string())?;
            let mut buf = [0u16; 2];
            let encoded: Vec<u16> = ch.encode_utf16(&mut buf).to_vec();
            event.set_string_from_utf16_unchecked(&encoded);
            event.post(CGEventTapLocation::HID);
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        Ok(())
    }

    pub fn keyboard_press(keys: &str) -> Result<(), String> {
        let parts: Vec<String> = keys.split('+').map(|s| s.trim().to_lowercase()).collect();

        let mut flags = CGEventFlags::empty();
        let mut keycode: u16 = 0;

        for part in &parts {
            match part.as_str() {
                "cmd" | "command" | "meta" => flags |= CGEventFlags::CGEventFlagCommand,
                "ctrl" | "control" => flags |= CGEventFlags::CGEventFlagControl,
                "alt" | "option" => flags |= CGEventFlags::CGEventFlagAlternate,
                "shift" => flags |= CGEventFlags::CGEventFlagShift,
                k => keycode = key_to_code(k),
            }
        }

        let down = CGEvent::new_keyboard_event(event_source(), keycode, true)
            .map_err(|_| "Failed to create key down".to_string())?;
        down.set_flags(flags);
        down.post(CGEventTapLocation::HID);
        std::thread::sleep(std::time::Duration::from_millis(50));

        let up = CGEvent::new_keyboard_event(event_source(), keycode, false)
            .map_err(|_| "Failed to create key up".to_string())?;
        up.set_flags(flags);
        up.post(CGEventTapLocation::HID);
        Ok(())
    }

    fn key_to_code(key: &str) -> u16 {
        match key {
            "a" => 0, "b" => 11, "c" => 8, "d" => 2, "e" => 14, "f" => 3,
            "g" => 5, "h" => 4, "i" => 34, "j" => 38, "k" => 40, "l" => 37,
            "m" => 46, "n" => 45, "o" => 31, "p" => 35, "q" => 12, "r" => 15,
            "s" => 1, "t" => 17, "u" => 32, "v" => 9, "w" => 13, "x" => 7,
            "y" => 16, "z" => 6,
            "0" => 29, "1" => 18, "2" => 19, "3" => 20, "4" => 21,
            "5" => 23, "6" => 22, "7" => 26, "8" => 28, "9" => 25,
            "return" | "enter" => 36, "tab" => 48, "space" => 49,
            "delete" | "backspace" => 51, "escape" | "esc" => 53,
            "up" => 126, "down" => 125, "left" => 123, "right" => 124,
            _ => 0,
        }
    }
}

// Platform dispatch
pub fn mouse_move(x: f64, y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::mouse_move(x, y);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported on this platform".to_string())
}

pub fn mouse_click(x: f64, y: f64, button: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::mouse_click(x, y, button);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}

pub fn mouse_drag(from_x: f64, from_y: f64, to_x: f64, to_y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::mouse_drag(from_x, from_y, to_x, to_y);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}

pub fn mouse_scroll(delta_x: i32, delta_y: i32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::mouse_scroll(delta_x, delta_y);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}

pub fn keyboard_type(text: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::keyboard_type(text);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}

pub fn keyboard_press(keys: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::keyboard_press(keys);
    #[cfg(not(target_os = "macos"))]
    Err("Not supported".to_string())
}
