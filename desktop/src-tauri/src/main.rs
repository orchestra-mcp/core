// Orchestra Desktop — Tauri 2.x Main Entry Point
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    env_logger::init();
    orchestra_desktop_lib::run();
}
