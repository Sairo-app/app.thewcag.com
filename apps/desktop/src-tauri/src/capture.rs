use serde::Serialize;
use tauri::Manager;
use xcap::Monitor;

#[derive(Serialize, Clone)]
pub struct PickedColor {
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub x: i32,
    pub y: i32,
}

/// Read the pixel under the mouse cursor. Cursor coordinates are logical
/// points; the captured image is physical pixels, so scale by the monitor's
/// backing factor (2x on Retina).
pub fn color_at_cursor() -> Result<PickedColor, String> {
    use mouse_position::mouse_position::Mouse;
    let (x, y) = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => (x, y),
        Mouse::Error => return Err("could not read cursor position".into()),
    };

    let monitor = Monitor::from_point(x, y).map_err(|e| e.to_string())?;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let scale = monitor.scale_factor().map_err(|e| e.to_string())?;
    let mon_x = monitor.x().map_err(|e| e.to_string())?;
    let mon_y = monitor.y().map_err(|e| e.to_string())?;

    let px = (((x - mon_x) as f32) * scale) as u32;
    let py = (((y - mon_y) as f32) * scale) as u32;
    let px = px.min(image.width().saturating_sub(1));
    let py = py.min(image.height().saturating_sub(1));

    let p = image.get_pixel(px, py);
    let (r, g, b) = (p.0[0], p.0[1], p.0[2]);
    Ok(PickedColor {
        hex: format!("#{:02X}{:02X}{:02X}", r, g, b),
        r,
        g,
        b,
        x,
        y,
    })
}

pub fn fullscreen_to_desktop(app: &tauri::AppHandle) -> Result<String, String> {
    use mouse_position::mouse_position::Mouse;
    // Capture the monitor the cursor is on; fall back to the first one.
    let monitor = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Monitor::from_point(x, y).map_err(|e| e.to_string())?,
        Mouse::Error => Monitor::all()
            .map_err(|e| e.to_string())?
            .into_iter()
            .next()
            .ok_or_else(|| "no monitor found".to_string())?,
    };

    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let dir = app
        .path()
        .desktop_dir()
        .map_err(|e| e.to_string())?;
    let name = format!(
        "a11y-screenshot-{}.png",
        chrono::Local::now().format("%Y-%m-%d-%H%M%S")
    );
    let path = dir.join(name);
    image.save(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn pick_color_at_cursor() -> Result<PickedColor, String> {
    color_at_cursor()
}

#[tauri::command]
pub fn capture_fullscreen(app: tauri::AppHandle) -> Result<String, String> {
    fullscreen_to_desktop(&app)
}
