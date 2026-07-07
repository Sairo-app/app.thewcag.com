use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn toggle(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("lens") {
        let _ = window.close();
        return;
    }
    if !crate::permissions::granted() {
        crate::actions::show_main(app);
        use tauri::Emitter;
        let _ = app.emit("permission-needed", ());
        return;
    }
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let _ = WebviewWindowBuilder::new(&handle, "lens", WebviewUrl::App(Default::default()))
            .title("Lens")
            .inner_size(480.0, 380.0)
            .min_inner_size(320.0, 260.0)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(true)
            .focused(true)
            .build();
    });
}

#[tauri::command]
pub fn toggle_lens(app: AppHandle) {
    toggle(&app);
}

/// Captures what is on screen *below* the lens window (so the lens never
/// sees itself) and returns raw pixels: [w: u32 LE][h: u32 LE][RGBA...].
/// Uses CGWindowListCreateImage - deprecated by Apple in favor of
/// ScreenCaptureKit but still the only one-call below-window capture;
/// revisit when the sandbox/MAS build lands.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn lens_frame(window: tauri::WebviewWindow) -> Result<tauri::ipc::Response, String> {
    use core_graphics::display::{CGPoint, CGRect, CGSize};
    use core_graphics::window::{
        create_image, kCGWindowImageBestResolution, kCGWindowListOptionOnScreenBelowWindow,
    };
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let window_number: isize = unsafe {
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as *mut AnyObject;
        msg_send![ns_window, windowNumber]
    };

    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let rect = CGRect::new(
        &CGPoint::new(pos.x as f64 / scale, pos.y as f64 / scale),
        &CGSize::new(size.width as f64 / scale, size.height as f64 / scale),
    );

    let cg_image = create_image(
        rect,
        kCGWindowListOptionOnScreenBelowWindow,
        window_number as u32,
        kCGWindowImageBestResolution,
    )
    .ok_or("below-window capture failed")?;

    let width = cg_image.width();
    let height = cg_image.height();
    let bytes_per_row = cg_image.bytes_per_row();
    let data = cg_image.data();
    let src = data.bytes();

    let mut out = Vec::with_capacity(8 + width * height * 4);
    out.extend_from_slice(&(width as u32).to_le_bytes());
    out.extend_from_slice(&(height as u32).to_le_bytes());
    for row in 0..height {
        let start = row * bytes_per_row;
        for col in 0..width {
            let i = start + col * 4;
            // CGWindowList images are BGRA
            out.push(src[i + 2]);
            out.push(src[i + 1]);
            out.push(src[i]);
            out.push(255);
        }
    }
    Ok(tauri::ipc::Response::new(out))
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn lens_frame(_window: tauri::WebviewWindow) -> Result<tauri::ipc::Response, String> {
    Err("the lens is not supported on this platform yet".into())
}
