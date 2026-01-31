//! Connection management for SQLCipher-encrypted SQLite
//!
//! Uses a Mutex-wrapped Connection with SQLCipher PRAGMA configuration
//! and update_hook installed for change notification via Tauri events.
//!
//! We use a single connection (with WAL mode for concurrent reads) rather
//! than a pool because update_hook is per-connection and must be installed
//! once for reliable event emission.

use std::path::Path;
use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use rusqlite::hooks::Action;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use serde::Serialize;

/// Change event emitted to the frontend when data changes
#[derive(Debug, Clone, Serialize)]
pub struct DataChangeEvent {
    /// The operation type: "INSERT", "UPDATE", or "DELETE"
    pub action: String,
    /// The table that changed
    pub table: String,
    /// The rowid of the changed row
    pub rowid: i64,
}

/// Manages a single SQLCipher-encrypted connection with change notifications
pub struct DbPool {
    conn: Mutex<Connection>,
}

impl DbPool {
    /// Create a new connection for an encrypted SQLite database
    pub fn new(
        db_path: &Path,
        key: &str,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
    ) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {e}"))?;

        // Apply SQLCipher encryption key
        conn.pragma_update(None, "key", key)
            .map_err(|e| format!("Failed to set encryption key: {e}"))?;

        // Performance tuning
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| format!("Failed to set journal_mode: {e}"))?;
        conn.pragma_update(None, "synchronous", "NORMAL")
            .map_err(|e| format!("Failed to set synchronous: {e}"))?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| format!("Failed to enable foreign_keys: {e}"))?;

        // SQLCipher memory security
        conn.pragma_update(None, "cipher_memory_security", "ON")
            .map_err(|e| format!("Failed to set cipher_memory_security: {e}"))?;

        // Install update_hook for change notifications
        conn.update_hook(Some(
            move |action: Action, _db: &str, table: &str, rowid: i64| {
                let action_str = match action {
                    Action::SQLITE_INSERT => "INSERT",
                    Action::SQLITE_UPDATE => "UPDATE",
                    Action::SQLITE_DELETE => "DELETE",
                    _ => return,
                };

                let event = DataChangeEvent {
                    action: action_str.to_string(),
                    table: table.to_string(),
                    rowid,
                };

                if let Some(ref app) = *app_handle.read() {
                    let _ = app.emit("db-change", &event);
                }
            },
        ));

        // Verify the database is accessible (key is valid)
        conn.execute_batch("SELECT count(*) FROM sqlite_master;")
            .map_err(|e| format!("Database key verification failed (wrong key?): {e}"))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Execute a function with an immutable database connection reference
    pub fn with_connection<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, String>,
    {
        let conn = self.conn.lock();
        f(&conn)
    }

    /// Execute a function with a mutable database connection reference
    /// Needed for migrations and other operations requiring &mut Connection
    pub fn with_connection_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut Connection) -> Result<T, String>,
    {
        let mut conn = self.conn.lock();
        f(&mut conn)
    }
}
