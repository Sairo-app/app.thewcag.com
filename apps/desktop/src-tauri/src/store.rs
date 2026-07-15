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
    if key.is_empty()
        || !key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
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
fn merge_findings(existing: &mut Vec<serde_json::Value>, items: &serde_json::Value) {
    let seen: HashSet<String> = existing
        .iter()
        .filter_map(|value| {
            value
                .get("key")
                .and_then(|key| key.as_str())
                .filter(|key| !key.is_empty())
                .map(String::from)
        })
        .collect();
    let mut batch_seen: HashSet<String> = HashSet::new();

    if let Some(items) = items.as_array() {
        for item in items {
            let Some(key) = item
                .get("key")
                .and_then(|key| key.as_str())
                .filter(|key| !key.is_empty())
            else {
                continue;
            };
            if !seen.contains(key) && batch_seen.insert(key.to_string()) {
                existing.push(item.clone());
            }
        }
    }
}

#[tauri::command]
pub fn add_findings(app: AppHandle, items: serde_json::Value) -> Result<(), String> {
    let path = key_path(&app, "findings")?;
    let mut existing: Vec<serde_json::Value> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    merge_findings(&mut existing, &items);

    std::fs::write(
        path,
        serde_json::to_string(&existing).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::merge_findings;
    use serde_json::json;

    #[test]
    fn merges_only_new_non_empty_finding_keys() {
        let mut existing = vec![json!({ "key": "capture:1", "status": "fixed" })];
        let incoming = json!([
            { "key": "capture:1", "status": "open" },
            { "key": "capture:2", "status": "open" },
            { "key": "capture:2", "status": "open" },
            { "key": "", "status": "open" },
            { "status": "open" }
        ]);

        merge_findings(&mut existing, &incoming);

        assert_eq!(existing.len(), 2);
        assert_eq!(existing[0]["status"], "fixed");
        assert_eq!(existing[1]["key"], "capture:2");
    }

    #[test]
    fn ignores_non_array_payloads() {
        let mut existing = vec![json!({ "key": "capture:1" })];
        merge_findings(&mut existing, &json!({ "key": "capture:2" }));
        assert_eq!(existing.len(), 1);
    }
}
