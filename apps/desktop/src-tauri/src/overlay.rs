use std::io::Cursor;

use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use xcap::Monitor;

use crate::permissions;
use crate::state::{AppState, OverlayPayload};

/// Freeze the screen under the cursor and open a fullscreen overlay window
/// on that monitor. `mode` is "pair" | "fg" | "bg" | "shot". If the main
/// window is focused we hide it first so it isn't part of the frozen frame.
pub fn begin(app: &AppHandle, mode: &str) {
    begin_delayed(app, mode, 0);
}

/// `extra_delay_ms` lets auditors arrange hover states, open menus and
/// tooltips before the frame freezes ("capture in 3s").
pub fn begin_delayed(app: &AppHandle, mode: &str, extra_delay_ms: u64) {
    if !permissions::granted() {
        crate::actions::show_main(app);
        let _ = app.emit("permission-needed", ());
        return;
    }

    let mut delay_ms = extra_delay_ms;
    if let Some(main) = app.get_webview_window("main") {
        if main.is_visible().unwrap_or(false) && main.is_focused().unwrap_or(false) {
            let _ = main.hide();
            delay_ms = delay_ms.max(250); // let the hide animation finish
        }
    }

    let app = app.clone();
    let mode = mode.to_string();
    std::thread::spawn(move || {
        if delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }
        if let Err(message) = capture_and_open(&app, &mode) {
            let _ = app.emit("capture-error", message);
            crate::actions::show_main(&app);
        }
    });
}

fn capture_and_open(app: &AppHandle, mode: &str) -> Result<(), String> {
    use mouse_position::mouse_position::Mouse;
    let (cx, cy) = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => (x, y),
        Mouse::Error => (0, 0),
    };
    let monitor = Monitor::from_point(cx, cy).map_err(|e| e.to_string())?;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let scale = monitor.scale_factor().map_err(|e| e.to_string())?;
    let mon_x = monitor.x().map_err(|e| e.to_string())? as f64;
    let mon_y = monitor.y().map_err(|e| e.to_string())? as f64;
    let logical_w = image.width() as f64 / scale as f64;
    let logical_h = image.height() as f64 / scale as f64;

    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(image)
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let state: State<AppState> = app.state();
    *state.overlay.lock().unwrap() = Some(OverlayPayload {
        png,
        mode: mode.to_string(),
        scale,
    });

    let handle = app.clone();
    app.run_on_main_thread(move || {
        if let Some(existing) = handle.get_webview_window("overlay") {
            let _ = existing.close();
        }
        let result = WebviewWindowBuilder::new(&handle, "overlay", WebviewUrl::App(Default::default()))
            .title("Capture")
            .position(mon_x, mon_y)
            .inner_size(logical_w, logical_h)
            .decorations(false)
            .resizable(false)
            .maximizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .accept_first_mouse(true)
            .focused(true)
            .build();
        if let Err(e) = result {
            let _ = handle.emit("capture-error", e.to_string());
        }
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Frontend entry point (main-window buttons); tray/hotkeys call begin().
#[tauri::command]
pub fn begin_overlay(app: AppHandle, mode: String, delay_ms: Option<u64>) {
    begin_delayed(&app, &mode, delay_ms.unwrap_or(0));
}

#[tauri::command]
pub fn overlay_meta(state: State<AppState>) -> Result<serde_json::Value, String> {
    let guard = state.overlay.lock().unwrap();
    let payload = guard.as_ref().ok_or("no overlay payload")?;
    Ok(serde_json::json!({ "mode": payload.mode, "scale": payload.scale }))
}

#[tauri::command]
pub fn overlay_png(state: State<AppState>) -> Result<tauri::ipc::Response, String> {
    let guard = state.overlay.lock().unwrap();
    let payload = guard.as_ref().ok_or("no overlay payload")?;
    Ok(tauri::ipc::Response::new(payload.png.clone()))
}

#[tauri::command]
pub fn close_overlay(app: AppHandle, reopen_main: bool) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.close();
    }
    if reopen_main {
        crate::actions::show_main(&app);
    }
}

/// Receives the cropped region PNG from the overlay and opens the editor.
#[tauri::command]
pub fn store_annotation(app: AppHandle, request: tauri::ipc::Request) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("expected raw body".into()),
    };
    let state: State<AppState> = app.state();
    *state.annotation.lock().unwrap() = Some(bytes);

    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.close();
    }
    if let Some(existing) = app.get_webview_window("annotate") {
        let _ = existing.close();
    }
    WebviewWindowBuilder::new(&app, "annotate", WebviewUrl::App(Default::default()))
        .title("Annotate — Accessibility.build")
        .inner_size(1120.0, 760.0)
        .min_inner_size(840.0, 560.0)
        .center()
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn annotation_png(state: State<AppState>) -> Result<tauri::ipc::Response, String> {
    let guard = state.annotation.lock().unwrap();
    let payload = guard.as_ref().ok_or("no annotation payload")?;
    Ok(tauri::ipc::Response::new(payload.clone()))
}
