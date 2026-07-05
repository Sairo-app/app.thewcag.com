use tauri::Wry;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

use crate::{lens, overlay};

fn pick_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyP)
}

fn screenshot_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyS)
}

fn lens_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyL)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts([pick_shortcut(), screenshot_shortcut(), lens_shortcut()])
        .expect("valid default shortcuts")
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if shortcut == &pick_shortcut() {
                overlay::begin(app, "pair");
            } else if shortcut == &screenshot_shortcut() {
                overlay::begin(app, "shot");
            } else if shortcut == &lens_shortcut() {
                lens::toggle(app);
            }
        })
        .build()
}
