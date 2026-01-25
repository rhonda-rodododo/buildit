//! Crypto/Keyring Tauri commands exposed to the frontend

use crate::crypto::keyring::{KeyringError, KeyringManager, SecretType};
use crate::AppState;
use buildit_crypto::{
    derive_conversation_key as crypto_derive_conversation_key, generate_keypair as crypto_generate_keypair,
    get_public_key, nip44_decrypt, nip44_encrypt, KeyPair,
};
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

/// Key pair response for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct KeyPairResponse {
    pub private_key: String,
    pub public_key: String,
}

/// Secret type for frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrontendSecretType {
    NostrPrivateKey,
    MasterKey,
    DatabaseKey,
    ApiToken,
    Custom(String),
}

impl From<FrontendSecretType> for SecretType {
    fn from(t: FrontendSecretType) -> Self {
        match t {
            FrontendSecretType::NostrPrivateKey => SecretType::NostrPrivateKey,
            FrontendSecretType::MasterKey => SecretType::MasterKey,
            FrontendSecretType::DatabaseKey => SecretType::DatabaseKey,
            FrontendSecretType::ApiToken => SecretType::ApiToken,
            FrontendSecretType::Custom(name) => SecretType::Custom(name),
        }
    }
}

/// Store a secret in the system keyring
#[tauri::command]
pub async fn store_secret(
    state: State<'_, AppState>,
    user: String,
    secret_type: FrontendSecretType,
    value: String,
    label: Option<String>,
) -> Result<CommandResult<()>, String> {
    let result = state
        .keyring_manager
        .store_secret(&user, secret_type.into(), &value, label);

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Retrieve a secret from the system keyring
#[tauri::command]
pub async fn retrieve_secret(
    state: State<'_, AppState>,
    user: String,
    secret_type: FrontendSecretType,
) -> Result<CommandResult<String>, String> {
    let result = state
        .keyring_manager
        .retrieve_secret(&user, &secret_type.into());

    match result {
        Ok(stored) => Ok(CommandResult::ok(stored.value)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Delete a secret from the system keyring
#[tauri::command]
pub async fn delete_secret(
    state: State<'_, AppState>,
    user: String,
    secret_type: FrontendSecretType,
) -> Result<CommandResult<()>, String> {
    let result = state
        .keyring_manager
        .delete_secret(&user, &secret_type.into());

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Check if a secret exists in the keyring
#[tauri::command]
pub async fn has_secret(
    state: State<'_, AppState>,
    user: String,
    secret_type: FrontendSecretType,
) -> Result<CommandResult<bool>, String> {
    let exists = state
        .keyring_manager
        .has_secret(&user, &secret_type.into());

    Ok(CommandResult::ok(exists))
}

/// Generate a new secp256k1 keypair
#[tauri::command]
pub async fn generate_keypair() -> Result<CommandResult<KeyPairResponse>, String> {
    let keypair = crypto_generate_keypair();

    let response = KeyPairResponse {
        private_key: hex::encode(&keypair.private_key),
        public_key: keypair.public_key,
    };

    Ok(CommandResult::ok(response))
}

/// Encrypt a message using NIP-44
#[tauri::command]
pub async fn encrypt_nip44(
    conversation_key_hex: String,
    plaintext: String,
) -> Result<CommandResult<String>, String> {
    let conversation_key = match hex::decode(&conversation_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid conversation key".to_string())),
    };

    match nip44_encrypt(conversation_key, plaintext) {
        Ok(ciphertext) => Ok(CommandResult::ok(ciphertext)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Decrypt a message using NIP-44
#[tauri::command]
pub async fn decrypt_nip44(
    conversation_key_hex: String,
    ciphertext: String,
) -> Result<CommandResult<String>, String> {
    let conversation_key = match hex::decode(&conversation_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid conversation key".to_string())),
    };

    match nip44_decrypt(conversation_key, ciphertext) {
        Ok(plaintext) => Ok(CommandResult::ok(plaintext)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Derive a NIP-44 conversation key from ECDH
#[tauri::command]
pub async fn derive_conversation_key(
    private_key_hex: String,
    recipient_pubkey_hex: String,
) -> Result<CommandResult<String>, String> {
    let private_key = match hex::decode(&private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    match crypto_derive_conversation_key(private_key, recipient_pubkey_hex) {
        Ok(key) => Ok(CommandResult::ok(hex::encode(&key))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}
