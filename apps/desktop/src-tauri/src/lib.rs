mod actions;
mod capture;
mod permissions;
mod shortcuts;
mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(shortcuts::plugin())
        .invoke_handler(tauri::generate_handler![
            permissions::screen_permission_status,
            permissions::request_screen_permission,
            permissions::open_screen_recording_settings,
            capture::pick_color_at_cursor,
            capture::capture_fullscreen,
        ])
        .setup(|app| {
            // Menu-bar utility: no Dock icon.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            tray::create(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it; the app lives in the tray.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
