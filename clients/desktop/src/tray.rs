//! System tray integration for BuildIt Network Desktop
//!
//! Provides:
//! - System tray icon
//! - Quick actions menu
//! - Notification badge

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager, Runtime,
};

/// Set up the system tray
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    // Quick actions submenu
    let scan_ble = MenuItem::with_id(app, "scan_ble", "Scan for Devices", true, None::<&str>)?;
    let stop_scan = MenuItem::with_id(app, "stop_scan", "Stop Scanning", true, None::<&str>)?;
    let quick_actions = Submenu::with_items(
        app,
        "Quick Actions",
        true,
        &[&scan_ble, &stop_scan],
    )?;

    // Status submenu
    let status_online = MenuItem::with_id(app, "status_online", "Online", true, None::<&str>)?;
    let status_away = MenuItem::with_id(app, "status_away", "Away", true, None::<&str>)?;
    let status_dnd = MenuItem::with_id(app, "status_dnd", "Do Not Disturb", true, None::<&str>)?;
    let status_invisible = MenuItem::with_id(app, "status_invisible", "Invisible", true, None::<&str>)?;
    let status_menu = Submenu::with_items(
        app,
        "Status",
        true,
        &[&status_online, &status_away, &status_dnd, &status_invisible],
    )?;

    let separator2 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
    let about_item = MenuItem::with_id(app, "about", "About BuildIt Network", true, None::<&str>)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Build the menu
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &hide_item,
            &separator,
            &quick_actions,
            &status_menu,
            &separator2,
            &settings_item,
            &about_item,
            &separator3,
            &quit_item,
        ],
    )?;

    // Build the tray icon
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(false)
        .tooltip("BuildIt Network")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // Show/focus the main window on left click
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    log::info!("System tray initialized");
    Ok(())
}

/// Handle menu item clicks
fn handle_menu_event<R: Runtime>(app: &tauri::AppHandle<R>, menu_id: &str) {
    match menu_id {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "hide" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        "scan_ble" => {
            // Emit event to frontend to start BLE scan
            let _ = app.emit("tray-action", "scan_ble");
        }
        "stop_scan" => {
            // Emit event to frontend to stop BLE scan
            let _ = app.emit("tray-action", "stop_scan");
        }
        "status_online" | "status_away" | "status_dnd" | "status_invisible" => {
            // Emit status change event
            let status = menu_id.strip_prefix("status_").unwrap_or("online");
            let _ = app.emit("status-change", status);
        }
        "settings" => {
            // Emit event to open settings
            let _ = app.emit("navigate", "/settings");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "about" => {
            // Emit event to show about dialog
            let _ = app.emit("show-about", ());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {
            log::warn!("Unknown menu item: {}", menu_id);
        }
    }
}

/// Update tray icon (e.g., for notifications)
pub fn update_tray_icon<R: Runtime>(
    _app: &tauri::AppHandle<R>,
    _has_notifications: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    // TODO: Implement icon switching for notification badge
    // This would require having separate icon assets
    Ok(())
}

/// Update tray tooltip
pub fn update_tray_tooltip<R: Runtime>(
    app: &tauri::AppHandle<R>,
    tooltip: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Tauri 2.0 tray tooltip can be updated via TrayIcon
    // For now, this is a placeholder
    log::debug!("Tray tooltip update requested: {}", tooltip);
    Ok(())
}
