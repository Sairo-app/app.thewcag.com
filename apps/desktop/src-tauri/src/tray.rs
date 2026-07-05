use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

use crate::actions;

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let pick = MenuItem::with_id(app, "pick", "Pick Color (⌥⌘P)", true, None::<&str>)?;
    let shot = MenuItem::with_id(app, "shot", "Screenshot (⌥⌘S)", true, None::<&str>)?;
    let lens = MenuItem::with_id(app, "lens", "Colorblind Lens — coming in M3", false, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Open Accessibility.build", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &pick,
            &shot,
            &lens,
            &PredefinedMenuItem::separator(app)?,
            &show,
            &quit,
        ],
    )?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundled icon").clone())
        .icon_as_template(false)
        .tooltip("Accessibility.build")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "pick" => actions::pick_color(app),
            "shot" => actions::screenshot(app),
            "show" => actions::show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
