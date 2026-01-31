//! BuildIt Network Desktop Application Library
//!
//! This crate provides the Tauri backend for the BuildIt Network desktop application,
//! including BLE mesh networking, secure keyring integration, system tray support,
//! and call window management.

pub mod ble;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod nostr;
pub mod tray;
pub mod windows;

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use tauri::{Emitter, Listener, Manager};

use ble::manager::BleManager;
use crypto::keyring::KeyringManager;
use db::Database;
use nostr::relay::NostrRelay;

/// Application state shared across all Tauri commands
pub struct AppState {
    /// BLE manager for mesh networking
    pub ble_manager: Arc<RwLock<BleManager>>,
    /// Keyring manager for secure credential storage
    pub keyring_manager: Arc<KeyringManager>,
    /// Nostr relay connections
    pub nostr_relays: Arc<RwLock<HashMap<String, Arc<NostrRelay>>>>,
}

impl AppState {
    /// Create a new application state
    pub fn new() -> Self {
        Self {
            ble_manager: Arc::new(RwLock::new(BleManager::new())),
            keyring_manager: Arc::new(KeyringManager::new("network.buildit.desktop")),
            nostr_relays: Arc::new(RwLock::new(HashMap::new())),
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

            // Initialize SQLite database (starts closed/locked, opened on user unlock)
            let db_path = db::default_db_path();
            let database = Database::new(db_path.clone());
            database.set_app_handle(app.handle().clone());
            app.manage(database);
            log::info!("SQLite database configured at {:?}", db_path);

            // Setup system tray
            tray::setup_tray(app)?;

            // Handle deep links (buildit:// protocol)
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    let urls = event.payload();
                    log::info!("Deep link received: {}", urls);
                    // Emit to frontend for handling
                    let _ = handle.emit("deep-link", urls);
                });
            }

            // Initialize window management
            windows::init(app.handle())?;

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
            // Crypto/keyring commands - Core
            commands::crypto_commands::store_secret,
            commands::crypto_commands::retrieve_secret,
            commands::crypto_commands::delete_secret,
            commands::crypto_commands::has_secret,
            commands::crypto_commands::generate_keypair,
            commands::crypto_commands::get_public_key_from_private,
            // Crypto - NIP-44 encryption
            commands::crypto_commands::encrypt_nip44,
            commands::crypto_commands::decrypt_nip44,
            commands::crypto_commands::derive_conversation_key,
            // Crypto - Key derivation (Argon2id)
            commands::crypto_commands::derive_master_key,
            commands::crypto_commands::derive_database_key,
            // Crypto - AES-256-GCM storage encryption
            commands::crypto_commands::aes_encrypt,
            commands::crypto_commands::aes_decrypt,
            // Crypto - Schnorr signatures
            commands::crypto_commands::schnorr_sign,
            commands::crypto_commands::schnorr_verify,
            commands::crypto_commands::compute_event_id,
            // Crypto - Duress password system
            commands::crypto_commands::hash_duress_password,
            commands::crypto_commands::check_duress_password,
            commands::crypto_commands::validate_duress_password,
            commands::crypto_commands::generate_decoy_identity,
            commands::crypto_commands::generate_decoy_contacts,
            commands::crypto_commands::generate_decoy_messages,
            commands::crypto_commands::create_duress_alert,
            commands::crypto_commands::create_duress_alerts,
            commands::crypto_commands::secure_destroy_key,
            // Crypto - Utilities
            commands::crypto_commands::generate_salt,
            commands::crypto_commands::randomize_timestamp,
            // Storage commands
            commands::storage_commands::store_encrypted_key,
            commands::storage_commands::retrieve_encrypted_key,
            commands::storage_commands::delete_key,
            // Nostr commands
            commands::nostr_commands::sign_nostr_event,
            commands::nostr_commands::verify_nostr_event,
            commands::nostr_commands::gift_wrap_message,
            commands::nostr_commands::unwrap_gift_message,
            // Database commands
            commands::db_commands::db_open,
            commands::db_commands::db_close,
            commands::db_commands::db_is_open,
            commands::db_commands::db_put,
            commands::db_commands::db_get,
            commands::db_commands::db_get_all,
            commands::db_commands::db_query,
            commands::db_commands::db_delete,
            commands::db_commands::db_bulk_put,
            commands::db_commands::db_count,
            commands::db_commands::db_execute_query,
            commands::db_commands::db_clear_table,
            // Call window commands
            windows::call_window::create_call_window,
            windows::call_window::close_call_window,
            windows::call_window::minimize_call_window,
            windows::call_window::maximize_call_window,
            windows::call_window::toggle_call_window_always_on_top,
            windows::call_window::update_call_window_title,
            windows::call_window::focus_call_window,
            windows::call_window::call_window_exists,
            windows::call_window::get_call_windows,
            windows::call_window::close_all_call_windows,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BuildIt Network Desktop");
}
