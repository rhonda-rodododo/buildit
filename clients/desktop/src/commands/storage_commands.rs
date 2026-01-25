//! Storage Tauri commands for encrypted local storage

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Command result wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// Store encrypted data in keyring
#[tauri::command]
pub async fn store_encrypted_key(
    state: State<'_, AppState>,
    user: String,
    key_id: String,
    encrypted_key: String,
) -> Result<CommandResult<()>, String> {
    use crate::crypto::keyring::SecretType;

    let result = state.keyring_manager.store_secret(
        &user,
        SecretType::Custom(key_id),
        &encrypted_key,
        None,
    );

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Retrieve encrypted data from keyring
#[tauri::command]
pub async fn retrieve_encrypted_key(
    state: State<'_, AppState>,
    user: String,
    key_id: String,
) -> Result<CommandResult<String>, String> {
    use crate::crypto::keyring::SecretType;

    let result = state
        .keyring_manager
        .retrieve_secret(&user, &SecretType::Custom(key_id));

    match result {
        Ok(stored) => Ok(CommandResult::ok(stored.value)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Delete encrypted data from keyring
#[tauri::command]
pub async fn delete_key(
    state: State<'_, AppState>,
    user: String,
    key_id: String,
) -> Result<CommandResult<()>, String> {
    use crate::crypto::keyring::SecretType;

    let result = state
        .keyring_manager
        .delete_secret(&user, &SecretType::Custom(key_id));

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}
