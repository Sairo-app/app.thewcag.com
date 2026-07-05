use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub const ACTIONS: [&str; 3] = ["pick", "shot", "lens"];

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct ShortcutConfig {
    pub pick: String,
    pub shot: String,
    pub lens: String,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            pick: "alt+super+KeyP".into(),
            shot: "alt+super+KeyS".into(),
            lens: "alt+super+KeyL".into(),
        }
    }
}

impl ShortcutConfig {
    pub fn get(&self, action: &str) -> &str {
        match action {
            "pick" => &self.pick,
            "shot" => &self.shot,
            _ => &self.lens,
        }
    }

    fn set(&mut self, action: &str, value: String) {
        match action {
            "pick" => self.pick = value,
            "shot" => self.shot = value,
            _ => self.lens = value,
        }
    }
}

#[derive(Default)]
pub struct ShortcutSettings(pub Mutex<ShortcutConfig>);

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("shortcuts.json"))
}

pub fn load(app: &AppHandle) -> ShortcutConfig {
    config_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(app: &AppHandle, cfg: &ShortcutConfig) {
    if let Some(path) = config_path(app) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(path, serde_json::to_string_pretty(cfg).unwrap());
    }
}

/// (Re-)register every configured shortcut. Invalid or OS-rejected combos
/// surface as an Err with the failing action name.
pub fn apply(app: &AppHandle) -> Result<(), String> {
    let cfg = app.state::<ShortcutSettings>().0.lock().unwrap().clone();
    let shortcuts = app.global_shortcut();
    shortcuts.unregister_all().map_err(|e| e.to_string())?;
    for action in ACTIONS {
        let parsed: Shortcut = cfg
            .get(action)
            .parse()
            .map_err(|_| format!("invalid shortcut for {action}"))?;
        shortcuts
            .register(parsed)
            .map_err(|e| format!("could not register {action}: {e}"))?;
    }
    Ok(())
}

pub fn action_for(app: &AppHandle, fired: &Shortcut) -> Option<&'static str> {
    let cfg = app.state::<ShortcutSettings>().0.lock().unwrap().clone();
    ACTIONS
        .into_iter()
        .find(|action| matches!(cfg.get(action).parse::<Shortcut>(), Ok(s) if &s == fired))
}

/// "alt+super+KeyP" → "⌥⌘P" for menus and UI.
pub fn display(shortcut: &str) -> String {
    let mut mods = String::new();
    let mut key = String::new();
    for token in shortcut.split('+') {
        match token.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods.push('⌃'),
            "alt" | "option" => mods.push('⌥'),
            "shift" => mods.push('⇧'),
            "super" | "cmd" | "command" | "meta" => mods.push('⌘'),
            _ => {
                key = token
                    .strip_prefix("Key")
                    .or_else(|| token.strip_prefix("Digit"))
                    .unwrap_or(token)
                    .to_string();
            }
        }
    }
    let key = match key.as_str() {
        "ArrowUp" => "↑".into(),
        "ArrowDown" => "↓".into(),
        "ArrowLeft" => "←".into(),
        "ArrowRight" => "→".into(),
        "Space" => "Space".into(),
        other => other.to_uppercase(),
    };
    format!("{mods}{key}")
}

#[tauri::command]
pub fn get_shortcuts(app: AppHandle) -> ShortcutConfig {
    app.state::<ShortcutSettings>().0.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_shortcut(app: AppHandle, action: String, shortcut: String) -> Result<(), String> {
    if !ACTIONS.contains(&action.as_str()) {
        return Err("unknown action".into());
    }
    shortcut
        .parse::<Shortcut>()
        .map_err(|_| "that key combination can't be used".to_string())?;

    let previous;
    {
        let state = app.state::<ShortcutSettings>();
        let mut cfg = state.0.lock().unwrap();
        for other in ACTIONS {
            if other != action && cfg.get(other) == shortcut {
                return Err(format!("already used by {other}"));
            }
        }
        previous = cfg.clone();
        cfg.set(&action, shortcut);
    }

    if let Err(e) = apply(&app) {
        // roll back so we never end up with dead hotkeys
        *app.state::<ShortcutSettings>().0.lock().unwrap() = previous;
        let _ = apply(&app);
        return Err(e);
    }
    let cfg = app.state::<ShortcutSettings>().0.lock().unwrap().clone();
    save(&app, &cfg);
    crate::tray::refresh(&app);
    Ok(())
}

#[tauri::command]
pub fn reset_shortcuts(app: AppHandle) -> Result<ShortcutConfig, String> {
    *app.state::<ShortcutSettings>().0.lock().unwrap() = ShortcutConfig::default();
    apply(&app)?;
    let cfg = ShortcutConfig::default();
    save(&app, &cfg);
    crate::tray::refresh(&app);
    Ok(cfg)
}
