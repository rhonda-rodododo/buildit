//! Crypto/Keyring Tauri commands exposed to the frontend

use crate::crypto::keyring::{KeyringError, KeyringManager, SecretType};
use crate::AppState;
use buildit_crypto::{
    aes_decrypt as crypto_aes_decrypt, aes_encrypt as crypto_aes_encrypt,
    check_duress_password as crypto_check_duress_password, compute_event_id as crypto_compute_event_id,
    create_duress_alert as crypto_create_duress_alert, create_duress_alerts as crypto_create_duress_alerts,
    derive_conversation_key as crypto_derive_conversation_key,
    derive_database_key as crypto_derive_database_key, derive_master_key as crypto_derive_master_key,
    generate_decoy_contacts as crypto_generate_decoy_contacts,
    generate_decoy_identity as crypto_generate_decoy_identity,
    generate_decoy_messages as crypto_generate_decoy_messages, generate_keypair as crypto_generate_keypair,
    generate_salt as crypto_generate_salt, get_public_key,
    hash_duress_password as crypto_hash_duress_password, nip44_decrypt_with_key, nip44_encrypt_with_key,
    randomize_timestamp as crypto_randomize_timestamp, schnorr_sign as crypto_schnorr_sign,
    schnorr_verify as crypto_schnorr_verify, secure_destroy_key as crypto_secure_destroy_key,
    validate_duress_password as crypto_validate_duress_password, DecoyContact, DecoyIdentity,
    DuressAlertConfig, DuressCheckResult, EncryptedData, KeyPair, NostrEvent, UnsignedEvent,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
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

    match nip44_encrypt_with_key(conversation_key, plaintext) {
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

    match nip44_decrypt_with_key(conversation_key, ciphertext) {
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

// =============================================================================
// Password-Based Key Derivation (Argon2id)
// =============================================================================

/// Derive a master key from password using Argon2id
/// This is the primary key derivation for password-based login
/// Argon2id params: 64MB memory, 3 iterations, 4 parallelism (~50-200ms)
#[tauri::command]
pub async fn derive_master_key(
    password: String,
    salt_hex: String,
) -> Result<CommandResult<String>, String> {
    let salt = match hex::decode(&salt_hex) {
        Ok(s) if s.len() >= 16 => s,
        _ => return Ok(CommandResult::err("Invalid salt (must be at least 16 bytes hex)".to_string())),
    };

    match crypto_derive_master_key(password.as_bytes().to_vec(), salt) {
        Ok(key) => Ok(CommandResult::ok(hex::encode(&key))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Derive database encryption key from master key using HKDF-SHA256
#[tauri::command]
pub async fn derive_database_key(
    master_key_hex: String,
) -> Result<CommandResult<String>, String> {
    let master_key = match hex::decode(&master_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid master key".to_string())),
    };

    match crypto_derive_database_key(master_key) {
        Ok(key) => Ok(CommandResult::ok(hex::encode(&key))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

// =============================================================================
// AES-256-GCM Storage Encryption
// =============================================================================

/// AES encryption response
#[derive(Debug, Serialize, Deserialize)]
pub struct AesEncryptResponse {
    pub ciphertext_hex: String,
    pub nonce_hex: String,
}

/// Encrypt data using AES-256-GCM for local storage
#[tauri::command]
pub async fn aes_encrypt(
    key_hex: String,
    plaintext_hex: String,
) -> Result<CommandResult<AesEncryptResponse>, String> {
    let key = match hex::decode(&key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid key (must be 32 bytes)".to_string())),
    };

    let plaintext = match hex::decode(&plaintext_hex) {
        Ok(p) => p,
        Err(_) => return Ok(CommandResult::err("Invalid plaintext hex".to_string())),
    };

    match crypto_aes_encrypt(key, plaintext) {
        Ok(encrypted) => Ok(CommandResult::ok(AesEncryptResponse {
            ciphertext_hex: hex::encode(&encrypted.ciphertext),
            nonce_hex: hex::encode(&encrypted.nonce),
        })),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Decrypt data using AES-256-GCM
#[tauri::command]
pub async fn aes_decrypt(
    key_hex: String,
    ciphertext_hex: String,
    nonce_hex: String,
) -> Result<CommandResult<String>, String> {
    let key = match hex::decode(&key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid key (must be 32 bytes)".to_string())),
    };

    let ciphertext = match hex::decode(&ciphertext_hex) {
        Ok(c) => c,
        Err(_) => return Ok(CommandResult::err("Invalid ciphertext hex".to_string())),
    };

    let nonce = match hex::decode(&nonce_hex) {
        Ok(n) if n.len() == 12 => n,
        _ => return Ok(CommandResult::err("Invalid nonce (must be 12 bytes)".to_string())),
    };

    let encrypted = EncryptedData { ciphertext, nonce };

    match crypto_aes_decrypt(key, encrypted) {
        Ok(plaintext) => Ok(CommandResult::ok(hex::encode(&plaintext))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

// =============================================================================
// Schnorr Signatures (BIP-340)
// =============================================================================

/// Sign a message using BIP-340 Schnorr signature
#[tauri::command]
pub async fn schnorr_sign(
    message_hex: String,
    private_key_hex: String,
) -> Result<CommandResult<String>, String> {
    let message = match hex::decode(&message_hex) {
        Ok(m) => m,
        Err(_) => return Ok(CommandResult::err("Invalid message hex".to_string())),
    };

    let private_key = match hex::decode(&private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    match crypto_schnorr_sign(message, private_key) {
        Ok(sig) => Ok(CommandResult::ok(hex::encode(&sig))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Verify a BIP-340 Schnorr signature
#[tauri::command]
pub async fn schnorr_verify(
    message_hex: String,
    signature_hex: String,
    public_key_hex: String,
) -> Result<CommandResult<bool>, String> {
    let message = match hex::decode(&message_hex) {
        Ok(m) => m,
        Err(_) => return Ok(CommandResult::err("Invalid message hex".to_string())),
    };

    let signature = match hex::decode(&signature_hex) {
        Ok(s) if s.len() == 64 => s,
        _ => return Ok(CommandResult::err("Invalid signature (must be 64 bytes)".to_string())),
    };

    let public_key = match hex::decode(&public_key_hex) {
        Ok(p) if p.len() == 32 => p,
        _ => return Ok(CommandResult::err("Invalid public key (must be 32 bytes)".to_string())),
    };

    match crypto_schnorr_verify(message, signature, public_key) {
        Ok(valid) => Ok(CommandResult::ok(valid)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Compute Nostr event ID (SHA-256 hash of serialized event)
#[tauri::command]
pub async fn compute_event_id(
    event: UnsignedEvent,
) -> Result<CommandResult<String>, String> {
    match crypto_compute_event_id(event) {
        Ok(id) => Ok(CommandResult::ok(id)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

// =============================================================================
// Duress Password System (Coercion Resistance)
// =============================================================================

/// Hash a duress password using Argon2id
#[tauri::command]
pub async fn hash_duress_password(
    password: String,
    salt_hex: String,
) -> Result<CommandResult<String>, String> {
    let salt = match hex::decode(&salt_hex) {
        Ok(s) if s.len() >= 16 => s,
        _ => return Ok(CommandResult::err("Invalid salt".to_string())),
    };

    match crypto_hash_duress_password(password.as_bytes().to_vec(), salt) {
        Ok(hash) => Ok(CommandResult::ok(hex::encode(&hash))),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Duress check response
#[derive(Debug, Serialize, Deserialize)]
pub struct DuressCheckResponse {
    pub is_duress: bool,
    pub password_valid: bool,
}

/// Check if entered password is the duress password
/// Returns whether duress mode should be activated
#[tauri::command]
pub async fn check_duress_password(
    entered_password: String,
    salt_hex: String,
    stored_duress_hash_hex: String,
    stored_normal_hash_hex: String,
) -> Result<CommandResult<DuressCheckResponse>, String> {
    let salt = match hex::decode(&salt_hex) {
        Ok(s) => s,
        Err(_) => return Ok(CommandResult::err("Invalid salt".to_string())),
    };

    let duress_hash = match hex::decode(&stored_duress_hash_hex) {
        Ok(h) => h,
        Err(_) => return Ok(CommandResult::err("Invalid duress hash".to_string())),
    };

    let normal_hash = match hex::decode(&stored_normal_hash_hex) {
        Ok(h) => h,
        Err(_) => return Ok(CommandResult::err("Invalid normal hash".to_string())),
    };

    match crypto_check_duress_password(entered_password.as_bytes().to_vec(), salt, duress_hash, normal_hash) {
        Ok(result) => Ok(CommandResult::ok(DuressCheckResponse {
            is_duress: result.is_duress,
            password_valid: result.password_valid,
        })),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Validate that duress password is sufficiently different from normal password
#[tauri::command]
pub async fn validate_duress_password(
    duress_password: String,
    normal_password: String,
) -> Result<CommandResult<bool>, String> {
    match crypto_validate_duress_password(
        duress_password.as_bytes().to_vec(),
        normal_password.as_bytes().to_vec(),
    ) {
        Ok(valid) => Ok(CommandResult::ok(valid)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Decoy identity response
#[derive(Debug, Serialize, Deserialize)]
pub struct DecoyIdentityResponse {
    pub private_key: String,
    pub public_key: String,
    pub display_name: String,
    pub about: String,
    pub created_at: i64,
}

/// Generate a decoy identity for duress mode
#[tauri::command]
pub async fn generate_decoy_identity() -> Result<CommandResult<DecoyIdentityResponse>, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let decoy = crypto_generate_decoy_identity(now);

    Ok(CommandResult::ok(DecoyIdentityResponse {
        private_key: hex::encode(&decoy.keypair.private_key),
        public_key: decoy.keypair.public_key,
        display_name: decoy.display_name,
        about: decoy.about,
        created_at: decoy.created_at,
    }))
}

/// Decoy contact response
#[derive(Debug, Serialize, Deserialize)]
pub struct DecoyContactResponse {
    pub pubkey: String,
    pub display_name: String,
}

/// Generate fake contacts for duress mode
#[tauri::command]
pub async fn generate_decoy_contacts(
    count: u32,
) -> Result<CommandResult<Vec<DecoyContactResponse>>, String> {
    let contacts = crypto_generate_decoy_contacts(count);

    Ok(CommandResult::ok(
        contacts
            .into_iter()
            .map(|c| DecoyContactResponse {
                pubkey: c.pubkey,
                display_name: c.display_name,
            })
            .collect(),
    ))
}

/// Generate fake messages for duress mode
#[tauri::command]
pub async fn generate_decoy_messages() -> Result<CommandResult<Vec<String>>, String> {
    let messages = crypto_generate_decoy_messages();
    Ok(CommandResult::ok(messages))
}

/// Duress alert config from frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendDuressAlertConfig {
    pub trusted_contact_pubkeys: Vec<String>,
    pub include_location: bool,
    pub custom_message: Option<String>,
}

/// Create silent duress alert to send to trusted contacts
#[tauri::command]
pub async fn create_duress_alert(
    sender_private_key_hex: String,
    recipient_pubkey: String,
    custom_message: Option<String>,
) -> Result<CommandResult<NostrEvent>, String> {
    let private_key = match hex::decode(&sender_private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    match crypto_create_duress_alert(private_key, recipient_pubkey, now, custom_message) {
        Ok(event) => Ok(CommandResult::ok(event)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Create multiple duress alerts to trusted contacts
#[tauri::command]
pub async fn create_duress_alerts(
    sender_private_key_hex: String,
    config: FrontendDuressAlertConfig,
) -> Result<CommandResult<Vec<NostrEvent>>, String> {
    let private_key = match hex::decode(&sender_private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let crypto_config = DuressAlertConfig {
        trusted_contact_pubkeys: config.trusted_contact_pubkeys,
        include_location: config.include_location,
        custom_message: config.custom_message,
    };

    match crypto_create_duress_alerts(private_key, crypto_config, now) {
        Ok(events) => Ok(CommandResult::ok(events)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Securely destroy a key by overwriting memory
#[tauri::command]
pub async fn secure_destroy_key(
    key_hex: String,
) -> Result<CommandResult<()>, String> {
    let mut key = match hex::decode(&key_hex) {
        Ok(k) => k,
        Err(_) => return Ok(CommandResult::err("Invalid key hex".to_string())),
    };

    match crypto_secure_destroy_key(key) {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

// =============================================================================
// Utilities
// =============================================================================

/// Generate a cryptographically secure random salt
#[tauri::command]
pub async fn generate_salt(
    length: u32,
) -> Result<CommandResult<String>, String> {
    let salt = crypto_generate_salt(length);
    Ok(CommandResult::ok(hex::encode(&salt)))
}

/// Randomize a timestamp for privacy (±range_seconds)
#[tauri::command]
pub async fn randomize_timestamp(
    timestamp: i64,
    range_seconds: u32,
) -> Result<CommandResult<i64>, String> {
    let randomized = crypto_randomize_timestamp(timestamp, range_seconds);
    Ok(CommandResult::ok(randomized))
}

/// Get public key from private key
#[tauri::command]
pub async fn get_public_key_from_private(
    private_key_hex: String,
) -> Result<CommandResult<String>, String> {
    let private_key = match hex::decode(&private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    match get_public_key(private_key) {
        Ok(pubkey) => Ok(CommandResult::ok(pubkey)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}
