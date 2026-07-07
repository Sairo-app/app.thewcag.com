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
        let built = WebviewWindowBuilder::new(&handle, "lens", WebviewUrl::App(Default::default()))
            .title("Lens")
            .inner_size(480.0, 380.0)
            .min_inner_size(320.0, 260.0)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(true)
            .focused(true)
            .build();
        if let Ok(win) = built {
            #[cfg(target_os = "windows")]
            exclude_from_capture(&win);
            let _ = &win;
        }
    });
}

#[tauri::command]
pub fn toggle_lens(app: AppHandle) {
    toggle(&app);
}

/// Mark the lens window invisible to screen capture (WDA_EXCLUDEFROMCAPTURE)
/// so the live `lens_frame` can grab the screen beneath it without a
/// hide/show flicker and without capturing itself. Windows 10 2004+.
#[cfg(target_os = "windows")]
fn exclude_from_capture(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};
    if let Ok(h) = window.hwnd() {
        unsafe {
            let _ = SetWindowDisplayAffinity(HWND(h.0 as _), WDA_EXCLUDEFROMCAPTURE);
        }
    }
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

/// Windows lens: the window is excluded from capture (see `exclude_from_capture`),
/// so we capture the monitor beneath it and crop to the window rect. Same
/// output layout as macOS: [w: u32 LE][h: u32 LE][RGBA...].
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn lens_frame(window: tauri::WebviewWindow) -> Result<tauri::ipc::Response, String> {
    use xcap::Monitor;

    // outer_position / outer_size are physical pixels.
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let win_scale = window.scale_factor().map_err(|e| e.to_string())?;

    // Find the monitor under the lens center (Monitor::from_point wants logical points).
    let cx = ((pos.x as f64 + size.width as f64 / 2.0) / win_scale) as i32;
    let cy = ((pos.y as f64 + size.height as f64 / 2.0) / win_scale) as i32;
    let monitor = Monitor::from_point(cx, cy).map_err(|e| e.to_string())?;

    let scale = monitor.scale_factor().map_err(|e| e.to_string())? as f64;
    let mon_x = monitor.x().map_err(|e| e.to_string())? as f64;
    let mon_y = monitor.y().map_err(|e| e.to_string())? as f64;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    // Window rect within this monitor's (physical) image.
    let crop_x = (pos.x as f64 - mon_x * scale).round() as i64;
    let crop_y = (pos.y as f64 - mon_y * scale).round() as i64;
    let w = size.width;
    let h = size.height;
    let iw = image.width() as i64;
    let ih = image.height() as i64;

    let mut out = Vec::with_capacity(8 + (w as usize) * (h as usize) * 4);
    out.extend_from_slice(&w.to_le_bytes());
    out.extend_from_slice(&h.to_le_bytes());
    for row in 0..h as i64 {
        for col in 0..w as i64 {
            let sx = crop_x + col;
            let sy = crop_y + row;
            if sx >= 0 && sy >= 0 && sx < iw && sy < ih {
                let p = image.get_pixel(sx as u32, sy as u32);
                out.push(p.0[0]);
                out.push(p.0[1]);
                out.push(p.0[2]);
                out.push(255);
            } else {
                out.extend_from_slice(&[0, 0, 0, 255]);
            }
        }
    }
    Ok(tauri::ipc::Response::new(out))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
pub fn lens_frame(_window: tauri::WebviewWindow) -> Result<tauri::ipc::Response, String> {
    Err("the lens is not supported on this platform yet".into())
}
