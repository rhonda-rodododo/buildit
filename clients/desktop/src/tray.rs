//! System tray integration for BuildIt Network Desktop
//!
//! Provides:
//! - System tray icon
//! - Quick actions menu
//! - Notification badge (overlay dot on tray icon)
//! - Badge state tracking and auto-clear on app focus

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Listener, Manager, Runtime,
};

/// Tray icon identifier constant
const TRAY_ID: &str = "buildit-tray";

/// Global badge state: true when there are unread notifications
static HAS_BADGE: AtomicBool = AtomicBool::new(false);

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
    let _tray = TrayIconBuilder::with_id(TRAY_ID)
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

                // Clear the badge when the user clicks the tray to focus the app
                if HAS_BADGE.load(Ordering::Relaxed) {
                    let _ = clear_badge(app);
                }
            }
        })
        .build(app)?;

    // Listen for notification badge events from the frontend
    let handle = app.handle().clone();
    app.listen("notification-badge", move |event| {
        let payload = event.payload();
        // Payload is a JSON boolean string: "true" or "false"
        let has_notifications = payload.trim().trim_matches('"') == "true";
        if has_notifications {
            let _ = set_badge(&handle);
        } else {
            let _ = clear_badge(&handle);
        }
    });

    // Listen for window focus events to clear badge
    let handle2 = app.handle().clone();
    app.listen("tauri://focus", move |_event| {
        if HAS_BADGE.load(Ordering::Relaxed) {
            let _ = clear_badge(&handle2);
        }
    });

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

/// Set the notification badge on the tray icon by compositing a red dot overlay
/// onto the default app icon.
fn set_badge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    if HAS_BADGE.swap(true, Ordering::Relaxed) {
        // Badge already set, no need to update the icon again
        return Ok(());
    }

    let badge_icon = create_badge_icon(app)?;

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_icon(Some(badge_icon))?;
        tray.set_tooltip(Some("BuildIt Network - New notifications"))?;
    }

    log::debug!("Tray badge set");
    Ok(())
}

/// Clear the notification badge from the tray icon, restoring the default icon.
fn clear_badge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    if !HAS_BADGE.swap(false, Ordering::Relaxed) {
        // Badge already cleared
        return Ok(());
    }

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Some(default_icon) = app.default_window_icon() {
            tray.set_icon(Some(default_icon.clone()))?;
        }
        tray.set_tooltip(Some("BuildIt Network"))?;
    }

    // Notify the frontend that the badge was cleared
    let _ = app.emit("badge-cleared", ());

    log::debug!("Tray badge cleared");
    Ok(())
}

/// Create a tray icon with a notification badge overlay (red dot in the top-right corner).
/// Takes the default app icon and draws a filled red circle on it.
fn create_badge_icon<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<Image<'static>, Box<dyn std::error::Error>> {
    let default_icon = app
        .default_window_icon()
        .ok_or("No default window icon available")?;

    // Get the RGBA pixel data from the default icon
    let rgba = default_icon.rgba().to_vec();
    let width = default_icon.width();
    let height = default_icon.height();

    let mut pixels = rgba;

    // Draw a red badge dot in the top-right corner
    // Badge is approximately 25% of the icon size, positioned at top-right
    let badge_radius = (width.min(height) as f64 * 0.15).max(2.0) as u32;
    let center_x = width - badge_radius - 1;
    let center_y = badge_radius + 1;

    // Badge color: bright red (#FF3B30) with full opacity
    let badge_r: u8 = 255;
    let badge_g: u8 = 59;
    let badge_b: u8 = 48;
    let badge_a: u8 = 255;

    for y in 0..height {
        for x in 0..width {
            let dx = x as i32 - center_x as i32;
            let dy = y as i32 - center_y as i32;
            let distance_sq = (dx * dx + dy * dy) as u32;

            if distance_sq <= badge_radius * badge_radius {
                let idx = ((y * width + x) * 4) as usize;
                if idx + 3 < pixels.len() {
                    pixels[idx] = badge_r;
                    pixels[idx + 1] = badge_g;
                    pixels[idx + 2] = badge_b;
                    pixels[idx + 3] = badge_a;
                }
            }
        }
    }

    Ok(Image::new_owned(pixels, width, height))
}

/// Update tray icon based on notification state.
/// Called from Tauri commands or event listeners.
pub fn update_tray_icon<R: Runtime>(
    app: &tauri::AppHandle<R>,
    has_notifications: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if has_notifications {
        set_badge(app)
    } else {
        clear_badge(app)
    }
}

/// Update tray tooltip
pub fn update_tray_tooltip<R: Runtime>(
    app: &tauri::AppHandle<R>,
    tooltip: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(tooltip))?;
    }
    log::debug!("Tray tooltip update requested: {}", tooltip);
    Ok(())
}
