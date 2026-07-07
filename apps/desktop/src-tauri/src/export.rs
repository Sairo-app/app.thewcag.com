use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

fn raw_body(request: &tauri::ipc::Request) -> Result<Vec<u8>, String> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        _ => Err("expected raw body".into()),
    }
}

#[tauri::command]
pub fn copy_png(app: AppHandle, request: tauri::ipc::Request) -> Result<(), String> {
    let bytes = raw_body(&request)?;
    let decoded = image::load_from_memory(&bytes)
        .map_err(|e| e.to_string())?
        .to_rgba8();
    let (w, h) = decoded.dimensions();
    let img = tauri::image::Image::new(decoded.as_raw(), w, h);
    app.clipboard().write_image(&img).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_png(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<Option<String>, String> {
    let bytes = raw_body(&request)?;
    let suggested = request
        .headers()
        .get("x-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("export.png")
        .to_string();
    let picked = app
        .dialog()
        .file()
        .set_file_name(&suggested)
        .add_filter("PNG image", &["png"])
        .blocking_save_file();
    match picked {
        Some(path) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn save_text(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<Option<String>, String> {
    let bytes = raw_body(&request)?;
    let suggested = request
        .headers()
        .get("x-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("export.md")
        .to_string();
    // Filter follows the suggested name's extension (md / csv / html / …).
    let ext = suggested.rsplit('.').next().unwrap_or("txt").to_ascii_lowercase();
    let label = match ext.as_str() {
        "md" => "Markdown",
        "csv" => "CSV",
        "html" => "HTML",
        "json" => "JSON",
        _ => "Text",
    };
    let picked = app
        .dialog()
        .file()
        .set_file_name(&suggested)
        .add_filter(label, &[ext.as_str()])
        .blocking_save_file();
    match picked {
        Some(path) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn copy_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        // /select, highlights the file in its folder.
        .arg(format!("/select,{}", path))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_site(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn autostart_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}
