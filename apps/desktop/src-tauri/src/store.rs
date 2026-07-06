use std::collections::HashSet;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// Generic JSON key/value store under Application Support (findings,
/// checklist, palette, etc.). Keys are filename-safe.
fn store_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("store");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn key_path(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("invalid store key".into());
    }
    Ok(store_dir(app)?.join(format!("{key}.json")))
}

#[tauri::command]
pub fn store_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let path = key_path(&app, &key)?;
    Ok(std::fs::read_to_string(path).ok())
}

#[tauri::command]
pub fn store_set(app: AppHandle, key: String, json: String) -> Result<(), String> {
    let path = key_path(&app, &key)?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

/// Merge findings into the register, keyed by each item's `key` field.
/// New keys are appended; existing keys are left untouched so status/notes
/// edited in the register are never clobbered by a re-export.
#[tauri::command]
pub fn add_findings(app: AppHandle, items: serde_json::Value) -> Result<(), String> {
    let path = key_path(&app, "findings")?;
    let mut existing: Vec<serde_json::Value> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let seen: HashSet<String> = existing
        .iter()
        .filter_map(|v| v.get("key").and_then(|k| k.as_str()).map(String::from))
        .collect();

    if let Some(arr) = items.as_array() {
        let mut batch_seen: HashSet<String> = HashSet::new();
        for item in arr {
            let k = item.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string();
            if k.is_empty() || (!seen.contains(&k) && !batch_seen.contains(&k)) {
                if !k.is_empty() {
                    batch_seen.insert(k);
                }
                existing.push(item.clone());
            }
        }
    }

    std::fs::write(
        path,
        serde_json::to_string(&existing).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
