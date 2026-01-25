//! Nostr Tauri commands for relay communication and NIP-17 gift wrapping

use crate::AppState;
use buildit_crypto::{
    create_gift_wrap, create_rumor, create_seal, sign_event, unwrap_gift_wrap, verify_event,
    NostrEvent, UnsignedEvent,
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

/// Unwrap result from NIP-17
#[derive(Debug, Serialize, Deserialize)]
pub struct UnwrapResponse {
    pub rumor: NostrEvent,
    pub sender_pubkey: String,
    pub seal_verified: bool,
}

/// Sign a Nostr event
#[tauri::command]
pub async fn sign_nostr_event(
    private_key_hex: String,
    event: UnsignedEvent,
) -> Result<CommandResult<NostrEvent>, String> {
    let private_key = match hex::decode(&private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid private key".to_string())),
    };

    match sign_event(private_key, event) {
        Ok(signed) => Ok(CommandResult::ok(signed)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Verify a Nostr event signature
#[tauri::command]
pub async fn verify_nostr_event(event: NostrEvent) -> Result<CommandResult<bool>, String> {
    let verified = verify_event(event);
    Ok(CommandResult::ok(verified))
}

/// Create a NIP-17 gift-wrapped message
#[tauri::command]
pub async fn gift_wrap_message(
    sender_private_key_hex: String,
    recipient_pubkey: String,
    content: String,
) -> Result<CommandResult<NostrEvent>, String> {
    let sender_private_key = match hex::decode(&sender_private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid sender private key".to_string())),
    };

    let sender_pubkey = match buildit_crypto::get_public_key(sender_private_key.clone()) {
        Ok(pk) => pk,
        Err(e) => return Ok(CommandResult::err(e.to_string())),
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Create rumor
    let rumor = match create_rumor(
        sender_pubkey.clone(),
        recipient_pubkey.clone(),
        content,
        now,
    ) {
        Ok(r) => r,
        Err(e) => return Ok(CommandResult::err(e.to_string())),
    };

    // Create seal
    let seal = match create_seal(
        sender_private_key,
        recipient_pubkey.clone(),
        rumor,
        now,
    ) {
        Ok(s) => s,
        Err(e) => return Ok(CommandResult::err(e.to_string())),
    };

    // Create gift wrap
    match create_gift_wrap(recipient_pubkey, seal, now) {
        Ok(gift_wrap) => Ok(CommandResult::ok(gift_wrap)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Unwrap a NIP-17 gift-wrapped message
#[tauri::command]
pub async fn unwrap_gift_message(
    recipient_private_key_hex: String,
    gift_wrap: NostrEvent,
) -> Result<CommandResult<UnwrapResponse>, String> {
    let recipient_private_key = match hex::decode(&recipient_private_key_hex) {
        Ok(k) if k.len() == 32 => k,
        _ => return Ok(CommandResult::err("Invalid recipient private key".to_string())),
    };

    match unwrap_gift_wrap(recipient_private_key, gift_wrap) {
        Ok(result) => Ok(CommandResult::ok(UnwrapResponse {
            rumor: result.rumor,
            sender_pubkey: result.sender_pubkey,
            seal_verified: result.seal_verified,
        })),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}
