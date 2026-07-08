use std::io::Cursor;

use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use xcap::Monitor;

use crate::permissions;
use crate::state::{AppState, OverlayPayload};

/// Freeze every monitor and open one fullscreen overlay window per display.
/// `mode` is "pair" | "fg" | "bg" | "shot". If the main window is focused we
/// hide it first so it isn't part of the frozen frame.
pub fn begin(app: &AppHandle, mode: &str) {
    begin_delayed(app, mode, 0);
}

/// `extra_delay_ms` lets auditors arrange hover states, open menus and
/// tooltips before the frame freezes; a countdown HUD shows the timer and
/// closes itself right before capture so it never appears in the frame.
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

    if extra_delay_ms >= 1000 {
        show_countdown(app, extra_delay_ms);
    }

    let app = app.clone();
    let mode = mode.to_string();
    std::thread::spawn(move || {
        if delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }
        // remove the HUD, give the compositor a beat, then capture
        if let Some(hud) = app.get_webview_window("countdown") {
            let _ = hud.close();
            std::thread::sleep(std::time::Duration::from_millis(150));
        }
        if let Err(message) = capture_and_open(&app, &mode) {
            let _ = app.emit("capture-error", message);
            crate::actions::show_main(&app);
        }
    });
}

fn show_countdown(app: &AppHandle, duration_ms: u64) {
    use mouse_position::mouse_position::Mouse;
    let (cx, cy) = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => (x, y),
        Mouse::Error => (0, 0),
    };
    let (mx, my) = Monitor::from_point(cx, cy)
        .ok()
        .and_then(|m| Some((m.x().ok()? as f64, m.y().ok()? as f64)))
        .unwrap_or((0.0, 0.0));
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(existing) = handle.get_webview_window("countdown") {
            let _ = existing.close();
        }
        let _ = WebviewWindowBuilder::new(&handle, "countdown", WebviewUrl::App(Default::default()))
            .title("Countdown")
            .position(mx + 24.0, my + 48.0)
            .inner_size(148.0, 56.0)
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(true)
            .focused(false)
            .visible(false) // revealed by the frontend after first paint (no flash)
            .initialization_script(&format!("window.__COUNTDOWN_MS = {duration_ms};"))
            .build();
    });
}

fn capture_and_open(app: &AppHandle, mode: &str) -> Result<(), String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("no monitors found".into());
    }

    struct Prepared {
        label: String,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
    }
    let mut prepared = Vec::new();

    {
        let state: State<AppState> = app.state();
        let mut overlays = state.overlays.lock().unwrap();
        overlays.clear();
        for (index, monitor) in monitors.into_iter().enumerate() {
            let image = monitor.capture_image().map_err(|e| e.to_string())?;
            let scale = monitor.scale_factor().map_err(|e| e.to_string())?;
            let x = monitor.x().map_err(|e| e.to_string())? as f64;
            let y = monitor.y().map_err(|e| e.to_string())? as f64;
            let w = image.width() as f64 / scale as f64;
            let h = image.height() as f64 / scale as f64;

            let mut png = Vec::new();
            image::DynamicImage::ImageRgba8(image)
                .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;

            let label = format!("overlay-{index}");
            overlays.insert(
                label.clone(),
                OverlayPayload {
                    png,
                    mode: mode.to_string(),
                    scale,
                },
            );
            prepared.push(Prepared { label, x, y, w, h });
        }
    }

    let handle = app.clone();
    app.run_on_main_thread(move || {
        close_all_overlays(&handle);
        for p in prepared {
            let result = WebviewWindowBuilder::new(&handle, &p.label, WebviewUrl::App(Default::default()))
                .title("Capture")
                .position(p.x, p.y)
                .inner_size(p.w, p.h)
                .decorations(false)
                .resizable(false)
                .maximizable(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .shadow(false)
                .accept_first_mouse(true)
                .focused(true)
                .visible(false) // revealed by the frontend after first paint (no flash)
                .build();
            if let Err(e) = result {
                let _ = handle.emit("capture-error", e.to_string());
            }
        }
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn close_all_overlays(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("overlay-") {
            let _ = window.close();
        }
    }
}

/// Frontend entry point (main-window buttons); tray/hotkeys call begin().
#[tauri::command]
pub fn begin_overlay(app: AppHandle, mode: String, delay_ms: Option<u64>) {
    begin_delayed(&app, &mode, delay_ms.unwrap_or(0));
}

#[tauri::command]
pub fn overlay_meta(
    window: tauri::WebviewWindow,
    state: State<AppState>,
) -> Result<serde_json::Value, String> {
    let overlays = state.overlays.lock().unwrap();
    let payload = overlays.get(window.label()).ok_or("no overlay payload")?;
    Ok(serde_json::json!({ "mode": payload.mode, "scale": payload.scale }))
}

#[tauri::command]
pub fn overlay_png(
    window: tauri::WebviewWindow,
    state: State<AppState>,
) -> Result<tauri::ipc::Response, String> {
    let overlays = state.overlays.lock().unwrap();
    let payload = overlays.get(window.label()).ok_or("no overlay payload")?;
    Ok(tauri::ipc::Response::new(payload.png.clone()))
}

#[tauri::command]
pub fn close_overlay(app: AppHandle, reopen_main: bool) {
    close_all_overlays(&app);
    if reopen_main {
        crate::actions::show_main(&app);
    }
}

/// Receives the cropped region PNG from an overlay, writes it into the
/// capture library and opens the editor. Every capture is re-editable.
#[tauri::command]
pub fn store_annotation(app: AppHandle, request: tauri::ipc::Request) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("expected raw body".into()),
    };
    let id = crate::library::new_id();
    let dir = crate::library::captures_dir(&app)?;
    std::fs::write(dir.join(format!("{id}.png")), &bytes).map_err(|e| e.to_string())?;

    let state: State<AppState> = app.state();
    *state.annotation.lock().unwrap() = Some((id, bytes));

    close_all_overlays(&app);
    crate::library::open_annotate_window(&app)
}

#[tauri::command]
pub fn annotation_png(state: State<AppState>) -> Result<tauri::ipc::Response, String> {
    let guard = state.annotation.lock().unwrap();
    let (_, png) = guard.as_ref().ok_or("no annotation payload")?;
    Ok(tauri::ipc::Response::new(png.clone()))
}
