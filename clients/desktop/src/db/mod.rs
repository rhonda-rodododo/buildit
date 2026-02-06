//! SQLite database module with SQLCipher encryption
//!
//! Provides encrypted local storage via rusqlite + SQLCipher, replacing
//! the browser-side Dexie/IndexedDB approach with a Rust-managed SQLite
//! database accessible through Tauri IPC commands.
//!
//! ## Architecture
//!
//! - SQLCipher encrypts the entire DB file at rest (AES-256)
//! - Connection pool via r2d2 for concurrent access
//! - `update_hook` fires Tauri events on every INSERT/UPDATE/DELETE
//! - Migrations managed by `rusqlite_migration`
//!
//! ## Key Lifecycle
//!
//! - On unlock: derive SQLCipher key from user's master password, open DB
//! - On lock: close DB connection, wipe key from memory

pub mod pool;
pub mod schema;

use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;
use rusqlite::Connection;
use tauri::AppHandle;

use crate::db::pool::DbPool;

/// Database state managed by the Tauri app
pub struct Database {
    /// Connection pool (None when locked)
    pool: RwLock<Option<DbPool>>,
    /// Path to the SQLite database file
    db_path: PathBuf,
    /// Tauri app handle for emitting change events
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl Database {
    /// Create a new Database instance (starts locked/disconnected)
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            pool: RwLock::new(None),
            db_path,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write() = Some(handle);
    }

    /// Open the database with the given encryption key
    ///
    /// The key should be derived from the user's master password via
    /// Argon2id + HKDF (matching the existing key derivation in SecureKeyManager).
    pub fn open(&self, key: &str) -> Result<(), String> {
        // Ensure parent directory exists
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create DB directory: {e}"))?;
        }

        let pool = DbPool::new(&self.db_path, key, self.app_handle.clone())
            .map_err(|e| format!("Failed to open database: {e}"))?;

        // Run migrations (needs mutable connection)
        pool.with_connection_mut(|conn| {
            schema::run_migrations(conn)
                .map_err(|e| format!("Migration failed: {e}"))
        })?;

        *self.pool.write() = Some(pool);
        log::info!("Database opened at {:?}", self.db_path);
        Ok(())
    }

    /// Close the database (wipe connection pool)
    pub fn close(&self) {
        let mut pool = self.pool.write();
        if pool.is_some() {
            *pool = None;
            log::info!("Database closed");
        }
    }

    /// Check if the database is open
    pub fn is_open(&self) -> bool {
        self.pool.read().is_some()
    }

    /// Execute a function with a database connection from the pool
    pub fn with_connection<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, String>,
    {
        let pool_guard = self.pool.read();
        let pool = pool_guard
            .as_ref()
            .ok_or_else(|| "Database is locked/closed".to_string())?;
        pool.with_connection(f)
    }

    /// Execute a function with a mutable database connection reference
    /// Required for operations that need &mut Connection (e.g., transactions)
    pub fn with_connection_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut Connection) -> Result<T, String>,
    {
        let pool_guard = self.pool.read();
        let pool = pool_guard
            .as_ref()
            .ok_or_else(|| "Database is locked/closed".to_string())?;
        pool.with_connection_mut(f)
    }
}

/// Get the default database path for the current platform
pub fn default_db_path() -> PathBuf {
    let app_dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    app_dir.join("buildit.db")
}

/// Platform-specific app data directory
fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local/share"))
            })
            .map(|p| p.join("network.buildit.desktop"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join("Library/Application Support/network.buildit.desktop"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("network.buildit.desktop"))
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        None
    }
}
