use tauri::Wry;
use tauri_plugin_global_shortcut::ShortcutState;

use crate::{lens, overlay, settings};

/// Shortcuts are registered dynamically from the saved config (see
/// settings::apply, called in setup and after every change) — the plugin
/// here only routes fired shortcuts to their action.
pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            match settings::action_for(app, shortcut) {
                Some("pick") => overlay::begin(app, "pair"),
                Some("shot") => overlay::begin(app, "shot"),
                Some("lens") => lens::toggle(app),
                _ => {}
            }
        })
        .build()
}
