mod actions;
mod auth;
mod capture;
mod export;
mod lens;
mod library;
mod overlay;
mod permissions;
mod settings;
mod shortcuts;
mod state;
mod store;
mod toolwin;
mod tray;
mod update;

use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .manage(settings::ShortcutSettings::default())
        .plugin(shortcuts::plugin())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            permissions::screen_permission_status,
            permissions::request_screen_permission,
            permissions::open_screen_recording_settings,
            permissions::restart_app,
            capture::pick_color_at_cursor,
            capture::capture_fullscreen,
            overlay::overlay_meta,
            overlay::overlay_png,
            overlay::close_overlay,
            overlay::store_annotation,
            overlay::annotation_png,
            overlay::begin_overlay,
            library::annotation_meta,
            library::save_annotation_doc,
            library::load_annotation_doc,
            library::list_annotation_docs,
            library::open_annotation,
            library::delete_annotation,
            lens::toggle_lens,
            lens::lens_frame,
            export::copy_png,
            export::save_png,
            export::save_text,
            export::copy_text,
            update::check_update,
            update::install_update,
            export::reveal_path,
            export::open_site,
            export::autostart_enabled,
            export::set_autostart,
            settings::get_shortcuts,
            settings::set_shortcut,
            settings::reset_shortcuts,
            auth::sign_in,
            auth::sign_out,
            auth::get_account,
            auth::publish_report,
            store::store_get,
            store::store_set,
            store::add_findings,
            toolwin::open_tool_window,
        ])
        .setup(|app| {
            // Menu-bar utility: no Dock icon.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let handle = app.handle();
            let saved = settings::load(handle);
            *handle
                .state::<settings::ShortcutSettings>()
                .0
                .lock()
                .unwrap() = saved;
            // A failed registration (combo taken by another app) must not
            // prevent startup; the settings UI surfaces it instead.
            let _ = settings::apply(handle);

            // Register the accessibility-build:// scheme at runtime (dev
            // builds); production registration comes from the bundle plist.
            let _ = app.deep_link().register("accessibility-build");
            let auth_handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    auth::handle_deep_link(&auth_handle, url.as_str());
                }
            });

            tray::create(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it; the app lives in the tray.
            // Tool windows (overlay/annotate/lens) really close.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
