//! BuildIt Network Desktop Application Library
//!
//! This crate provides the Tauri backend for the BuildIt Network desktop application,
//! including BLE mesh networking, secure keyring integration, and system tray support.

pub mod ble;
pub mod commands;
pub mod crypto;
pub mod tray;

use std::sync::Arc;
use parking_lot::RwLock;
use tauri::Manager;

use ble::manager::BleManager;
use crypto::keyring::KeyringManager;

/// Application state shared across all Tauri commands
pub struct AppState {
    /// BLE manager for mesh networking
    pub ble_manager: Arc<RwLock<BleManager>>,
    /// Keyring manager for secure credential storage
    pub keyring_manager: Arc<KeyringManager>,
}

impl AppState {
    /// Create a new application state
    pub fn new() -> Self {
        Self {
            ble_manager: Arc::new(RwLock::new(BleManager::new())),
            keyring_manager: Arc::new(KeyringManager::new("network.buildit.desktop")),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Initialize the Tauri application with all plugins and commands
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Initialize application state
            let state = AppState::new();
            app.manage(state);

            // Setup system tray
            tray::setup_tray(app)?;

            // Handle deep links (buildit:// protocol)
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    if let Some(urls) = event.payload().as_str() {
                        log::info!("Deep link received: {}", urls);
                        // Emit to frontend for handling
                        let _ = handle.emit("deep-link", urls);
                    }
                });
            }

            log::info!("BuildIt Network Desktop initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // BLE commands
            commands::ble_commands::start_ble_scan,
            commands::ble_commands::stop_ble_scan,
            commands::ble_commands::get_discovered_devices,
            commands::ble_commands::connect_device,
            commands::ble_commands::disconnect_device,
            commands::ble_commands::send_mesh_message,
            commands::ble_commands::get_ble_status,
            // Crypto/keyring commands
            commands::crypto_commands::store_secret,
            commands::crypto_commands::retrieve_secret,
            commands::crypto_commands::delete_secret,
            commands::crypto_commands::has_secret,
            commands::crypto_commands::generate_keypair,
            commands::crypto_commands::encrypt_nip44,
            commands::crypto_commands::decrypt_nip44,
            commands::crypto_commands::derive_conversation_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BuildIt Network Desktop");
}
