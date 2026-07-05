use tauri::{AppHandle, Emitter, Manager};

use crate::capture;

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Full-screen capture straight to the Desktop (tray shortcut; region
/// capture goes through the overlay instead).
pub fn full_screenshot(app: &AppHandle) {
    match capture::fullscreen_to_desktop(app) {
        Ok(path) => {
            let _ = app.emit("screenshot-taken", path);
        }
        Err(message) => {
            let _ = app.emit("capture-error", message);
        }
    }
    show_main(app);
}
