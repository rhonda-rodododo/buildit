//! Call Window Management
//!
//! Manages call windows for voice/video calls, similar to Microsoft Teams.
//! Features:
//! - Separate window per call
//! - Picture-in-Picture (PiP) mode with small floating window
//! - Always-on-top toggle
//! - Proper window title with participant info

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Configuration for creating a call window
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallWindowConfig {
    /// Unique call identifier
    pub call_id: String,
    /// Type of call
    pub call_type: CallType,
    /// List of participant names or pubkeys
    pub participants: Vec<String>,
    /// Window title
    pub title: String,
    /// Group ID if this is a group call
    pub group_id: Option<String>,
    /// Whether to start in PiP mode
    pub start_minimized: Option<bool>,
}

/// Type of call
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CallType {
    /// One-to-one call
    OneToOne,
    /// Group call (mesh topology)
    Group,
    /// Conference call (SFU topology)
    Conference,
    /// Hotline call
    Hotline,
    /// Push-to-Talk channel
    PTT,
}

/// Call window state for tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallWindowState {
    pub call_id: String,
    pub window_label: String,
    pub is_minimized: bool,
    pub is_always_on_top: bool,
}

/// PiP (Picture-in-Picture) dimensions
const PIP_WIDTH: u32 = 320;
const PIP_HEIGHT: u32 = 180;

/// Default call window dimensions
const DEFAULT_WIDTH: f64 = 800.0;
const DEFAULT_HEIGHT: f64 = 600.0;
const MIN_WIDTH: f64 = 400.0;
const MIN_HEIGHT: f64 = 300.0;

/// Generate window label from call ID
fn get_window_label(call_id: &str) -> String {
    format!("call-{}", call_id)
}

/// Create a new call window
///
/// Creates a separate window for the call, similar to Microsoft Teams.
/// The window loads the call view route with the call ID.
#[tauri::command]
pub async fn create_call_window(
    app: AppHandle,
    config: CallWindowConfig,
) -> Result<String, String> {
    let window_label = get_window_label(&config.call_id);

    // Check if window already exists
    if app.get_webview_window(&window_label).is_some() {
        // Window exists, focus it instead
        if let Some(window) = app.get_webview_window(&window_label) {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(window_label);
    }

    // Determine initial size based on config
    let (width, height) = if config.start_minimized.unwrap_or(false) {
        (PIP_WIDTH as f64, PIP_HEIGHT as f64)
    } else {
        (DEFAULT_WIDTH, DEFAULT_HEIGHT)
    };

    // Build the call window URL with call ID
    let url = WebviewUrl::App(format!("/app/call/{}", config.call_id).into());

    // Create the window
    let _window = WebviewWindowBuilder::new(&app, &window_label, url)
        .title(&config.title)
        .inner_size(width, height)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .resizable(true)
        .decorations(true)
        .always_on_top(config.start_minimized.unwrap_or(false))
        .visible(true)
        .focused(true)
        .center()
        .build()
        .map_err(|e| format!("Failed to create call window: {}", e))?;

    log::info!(
        "Created call window: {} for call type {:?}",
        window_label,
        config.call_type
    );

    Ok(window_label)
}

/// Close a call window
///
/// Closes the window associated with the given call ID.
#[tauri::command]
pub async fn close_call_window(app: AppHandle, call_id: String) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
        log::info!("Closed call window: {}", window_label);
    } else {
        log::warn!("Call window not found: {}", window_label);
    }

    Ok(())
}

/// Minimize call window to Picture-in-Picture mode
///
/// Resizes the window to a small floating view and enables always-on-top.
#[tauri::command]
pub async fn minimize_call_window(app: AppHandle, call_id: String) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        // Set to PiP size
        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: PIP_WIDTH,
                height: PIP_HEIGHT,
            }))
            .map_err(|e| format!("Failed to resize window: {}", e))?;

        // Enable always-on-top for PiP mode
        window
            .set_always_on_top(true)
            .map_err(|e| format!("Failed to set always on top: {}", e))?;

        // Position in bottom-right corner of screen
        if let Ok(monitor) = window.current_monitor() {
            if let Some(monitor) = monitor {
                let screen_size = monitor.size();
                let screen_position = monitor.position();
                let x = screen_position.x + (screen_size.width as i32) - (PIP_WIDTH as i32) - 20;
                let y = screen_position.y + (screen_size.height as i32) - (PIP_HEIGHT as i32) - 20;

                let _ = window
                    .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
            }
        }

        log::info!("Minimized call window to PiP: {}", window_label);
    } else {
        return Err(format!("Call window not found: {}", window_label));
    }

    Ok(())
}

/// Maximize call window from PiP mode
///
/// Restores the window to full size and disables always-on-top.
#[tauri::command]
pub async fn maximize_call_window(app: AppHandle, call_id: String) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        // Restore to default size
        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: DEFAULT_WIDTH as u32,
                height: DEFAULT_HEIGHT as u32,
            }))
            .map_err(|e| format!("Failed to resize window: {}", e))?;

        // Disable always-on-top
        window
            .set_always_on_top(false)
            .map_err(|e| format!("Failed to disable always on top: {}", e))?;

        // Center the window
        window
            .center()
            .map_err(|e| format!("Failed to center window: {}", e))?;

        log::info!("Maximized call window from PiP: {}", window_label);
    } else {
        return Err(format!("Call window not found: {}", window_label));
    }

    Ok(())
}

/// Toggle always-on-top for call window
///
/// Allows the user to keep the call window above other windows.
#[tauri::command]
pub async fn toggle_call_window_always_on_top(
    app: AppHandle,
    call_id: String,
    on_top: bool,
) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .set_always_on_top(on_top)
            .map_err(|e| format!("Failed to set always on top: {}", e))?;

        log::info!(
            "Set always-on-top to {} for call window: {}",
            on_top,
            window_label
        );
    } else {
        return Err(format!("Call window not found: {}", window_label));
    }

    Ok(())
}

/// Update call window title
///
/// Updates the window title (e.g., when participants join/leave).
#[tauri::command]
pub async fn update_call_window_title(
    app: AppHandle,
    call_id: String,
    title: String,
) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .set_title(&title)
            .map_err(|e| format!("Failed to set title: {}", e))?;

        log::debug!("Updated call window title: {}", title);
    } else {
        return Err(format!("Call window not found: {}", window_label));
    }

    Ok(())
}

/// Focus a call window
///
/// Brings the call window to the front.
#[tauri::command]
pub async fn focus_call_window(app: AppHandle, call_id: String) -> Result<(), String> {
    let window_label = get_window_label(&call_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        // Show the window if hidden
        window
            .show()
            .map_err(|e| format!("Failed to show window: {}", e))?;

        // Unminimize if needed
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize window: {}", e))?;

        // Focus the window
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;

        log::info!("Focused call window: {}", window_label);
    } else {
        return Err(format!("Call window not found: {}", window_label));
    }

    Ok(())
}

/// Check if a call window exists
#[tauri::command]
pub async fn call_window_exists(app: AppHandle, call_id: String) -> Result<bool, String> {
    let window_label = get_window_label(&call_id);
    Ok(app.get_webview_window(&window_label).is_some())
}

/// Get the state of all active call windows
#[tauri::command]
pub async fn get_call_windows(app: AppHandle) -> Result<Vec<CallWindowState>, String> {
    let mut windows = Vec::new();

    // Iterate through all windows and find call windows
    for (label, window) in app.webview_windows() {
        if label.starts_with("call-") {
            let call_id = label.strip_prefix("call-").unwrap_or(&label).to_string();

            // Check window size to determine if minimized
            let size = window.outer_size().map_err(|e| e.to_string())?;
            let is_minimized = size.width <= PIP_WIDTH && size.height <= PIP_HEIGHT;

            // Check always-on-top state
            let is_always_on_top = window.is_always_on_top().map_err(|e| e.to_string())?;

            windows.push(CallWindowState {
                call_id,
                window_label: label.to_string(),
                is_minimized,
                is_always_on_top,
            });
        }
    }

    Ok(windows)
}

/// Close all call windows
///
/// Used when logging out or shutting down.
#[tauri::command]
pub async fn close_all_call_windows(app: AppHandle) -> Result<(), String> {
    let labels: Vec<String> = app
        .webview_windows()
        .iter()
        .filter(|(label, _)| label.starts_with("call-"))
        .map(|(label, _)| label.to_string())
        .collect();

    for label in labels {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }
    }

    log::info!("Closed all call windows");
    Ok(())
}
