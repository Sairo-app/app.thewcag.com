use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Open one of the standalone auditor tool windows (findings / checklist /
/// palette). Focuses the existing window if already open.
#[tauri::command]
pub fn open_tool_window(app: AppHandle, kind: String) -> Result<(), String> {
    let (title, w, h) = match kind.as_str() {
        "findings" => ("Findings Register - TheWCAG", 940.0, 660.0),
        "checklist" => ("WCAG 2.2 Checklist - TheWCAG", 760.0, 740.0),
        "palette" => ("Palette Contrast - TheWCAG", 760.0, 660.0),
        _ => return Err("unknown tool window".into()),
    };

    if let Some(existing) = app.get_webview_window(&kind) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, &kind, WebviewUrl::App(Default::default()))
        .title(title)
        .inner_size(w, h)
        .min_inner_size(560.0, 460.0)
        .center()
        .focused(true)
        .visible(false) // revealed by the frontend after first paint (no flash)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
