use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Wry,
};

use crate::{actions, lens, overlay, settings};

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let cfg = app
        .state::<settings::ShortcutSettings>()
        .0
        .lock()
        .unwrap()
        .clone();
    let pick = MenuItem::with_id(
        app,
        "pick",
        format!("Check Contrast ({})", settings::display(&cfg.pick)),
        true,
        None::<&str>,
    )?;
    let shot = MenuItem::with_id(
        app,
        "shot",
        format!("Capture & Annotate ({})", settings::display(&cfg.shot)),
        true,
        None::<&str>,
    )?;
    let lens_item = MenuItem::with_id(
        app,
        "lens",
        format!("Colorblind Lens ({})", settings::display(&cfg.lens)),
        true,
        None::<&str>,
    )?;
    let pick_delayed =
        MenuItem::with_id(app, "pick3", "Check Contrast in 3s (hover states)", true, None::<&str>)?;
    let shot_delayed =
        MenuItem::with_id(app, "shot3", "Capture in 3s (hover states)", true, None::<&str>)?;
    let full = MenuItem::with_id(app, "full", "Capture Full Screen", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Open Accessibility.build", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &pick,
            &shot,
            &lens_item,
            &PredefinedMenuItem::separator(app)?,
            &pick_delayed,
            &shot_delayed,
            &full,
            &PredefinedMenuItem::separator(app)?,
            &show,
            &quit,
        ],
    )
}

/// Rebuild the tray menu (called after shortcut changes).
pub fn refresh(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_menu(app) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundled icon").clone())
        .icon_as_template(false)
        .tooltip("Accessibility.build")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "pick" => overlay::begin(app, "pair"),
            "shot" => overlay::begin(app, "shot"),
            "pick3" => overlay::begin_delayed(app, "pair", 3000),
            "shot3" => overlay::begin_delayed(app, "shot", 3000),
            "lens" => lens::toggle(app),
            "full" => actions::full_screenshot(app),
            "show" => actions::show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
