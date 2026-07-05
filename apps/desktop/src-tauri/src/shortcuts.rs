use tauri::Wry;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

use crate::actions;

fn pick_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyP)
}

fn screenshot_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyS)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts([pick_shortcut(), screenshot_shortcut()])
        .expect("valid default shortcuts")
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if shortcut == &pick_shortcut() {
                actions::pick_color(app);
            } else if shortcut == &screenshot_shortcut() {
                actions::screenshot(app);
            }
        })
        .build()
}
