use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::state::AppState;

/// Captures live in Application Support: <id>.png (pixels) + <id>.json
/// (the annotation document). The pair makes every capture re-editable.
pub fn captures_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("captures");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn sanitize(id: &str) -> Result<(), String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("invalid capture id".into());
    }
    Ok(())
}

pub fn new_id() -> String {
    format!(
        "cap-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    )
}

pub fn open_annotate_window(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("annotate") {
        let _ = existing.close();
    }
    WebviewWindowBuilder::new(app, "annotate", WebviewUrl::App(Default::default()))
        .title("Annotate - TheWCAG")
        .inner_size(1120.0, 760.0)
        .min_inner_size(840.0, 560.0)
        .center()
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn annotation_meta(state: State<AppState>) -> Result<serde_json::Value, String> {
    let guard = state.annotation.lock().unwrap();
    let (id, _) = guard.as_ref().ok_or("no annotation payload")?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub fn save_annotation_doc(app: AppHandle, id: String, json: String) -> Result<(), String> {
    sanitize(&id)?;
    let path = captures_dir(&app)?.join(format!("{id}.json"));
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_annotation_doc(app: AppHandle, id: String) -> Result<Option<String>, String> {
    sanitize(&id)?;
    let path = captures_dir(&app)?.join(format!("{id}.json"));
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(_) => Ok(None),
    }
}

#[derive(Serialize)]
pub struct CaptureEntry {
    pub id: String,
    pub modified_ms: u64,
    pub issues: usize,
}

#[tauri::command]
pub fn list_annotation_docs(app: AppHandle) -> Result<Vec<CaptureEntry>, String> {
    let dir = captures_dir(&app)?;
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("png") {
            continue;
        }
        let id = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let modified_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let issues = std::fs::read_to_string(dir.join(format!("{id}.json")))
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .and_then(|v| {
                v.get("shapes").and_then(|s| s.as_array()).map(|arr| {
                    arr.iter()
                        .filter(|s| s.get("kind").and_then(|k| k.as_str()) == Some("badge"))
                        .count()
                })
            })
            .unwrap_or(0);
        entries.push(CaptureEntry { id, modified_ms, issues });
    }
    entries.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    entries.truncate(24);
    Ok(entries)
}

/// Reopen a library capture in the annotation editor.
#[tauri::command]
pub fn open_annotation(app: AppHandle, id: String) -> Result<(), String> {
    sanitize(&id)?;
    let png = std::fs::read(captures_dir(&app)?.join(format!("{id}.png")))
        .map_err(|_| "capture no longer exists")?;
    let state: State<AppState> = app.state();
    *state.annotation.lock().unwrap() = Some((id, png));
    open_annotate_window(&app)
}

#[tauri::command]
pub fn delete_annotation(app: AppHandle, id: String) -> Result<(), String> {
    sanitize(&id)?;
    let dir = captures_dir(&app)?;
    let _ = std::fs::remove_file(dir.join(format!("{id}.png")));
    let _ = std::fs::remove_file(dir.join(format!("{id}.json")));
    Ok(())
}
