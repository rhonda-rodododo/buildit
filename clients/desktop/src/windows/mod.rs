//! Window Management Module
//!
//! Provides window management for BuildIt Network Desktop, including:
//! - Call windows (separate floating windows for voice/video calls)
//! - Picture-in-Picture mode
//! - Always-on-top functionality

pub mod call_window;

use tauri::AppHandle;

/// Initialize window management
pub fn init(_app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize any window management state if needed
    log::info!("Window management initialized");
    Ok(())
}
