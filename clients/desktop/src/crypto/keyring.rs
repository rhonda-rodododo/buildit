//! System keyring integration for secure credential storage
//!
//! Uses the `keyring` crate for cross-platform secure storage:
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: libsecret (GNOME Keyring, KWallet)

use keyring::Entry;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Keyring operation errors
#[derive(Debug, Error)]
pub enum KeyringError {
    #[error("Failed to access keyring: {0}")]
    AccessError(String),

    #[error("Secret not found: {0}")]
    NotFound(String),

    #[error("Failed to store secret: {0}")]
    StoreError(String),

    #[error("Failed to delete secret: {0}")]
    DeleteError(String),

    #[error("Invalid secret format")]
    InvalidFormat,

    #[error("Keyring operation not supported on this platform")]
    NotSupported,
}

/// Secret types that can be stored in the keyring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecretType {
    /// Nostr private key (nsec)
    NostrPrivateKey,
    /// Master encryption key
    MasterKey,
    /// Database encryption key
    DatabaseKey,
    /// API token
    ApiToken,
    /// Custom secret
    Custom(String),
}

impl SecretType {
    /// Get the key name suffix for this secret type
    fn key_suffix(&self) -> &str {
        match self {
            SecretType::NostrPrivateKey => "nostr_private_key",
            SecretType::MasterKey => "master_key",
            SecretType::DatabaseKey => "database_key",
            SecretType::ApiToken => "api_token",
            SecretType::Custom(name) => name,
        }
    }
}

/// Stored secret with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSecret {
    /// The secret value (hex-encoded for binary data)
    pub value: String,
    /// Secret type
    pub secret_type: SecretType,
    /// Creation timestamp (unix milliseconds)
    pub created_at: u64,
    /// Last accessed timestamp (unix milliseconds)
    pub last_accessed: Option<u64>,
    /// Optional label/description
    pub label: Option<String>,
}

/// Manager for system keyring operations
pub struct KeyringManager {
    /// Application service identifier
    service: String,
}

impl KeyringManager {
    /// Create a new keyring manager
    pub fn new(service: &str) -> Self {
        Self {
            service: service.to_string(),
        }
    }

    /// Build a full key name from user and secret type
    fn build_key(&self, user: &str, secret_type: &SecretType) -> String {
        format!("{}_{}", user, secret_type.key_suffix())
    }

    /// Store a secret in the system keyring
    pub fn store_secret(
        &self,
        user: &str,
        secret_type: SecretType,
        value: &str,
        label: Option<String>,
    ) -> Result<(), KeyringError> {
        let key = self.build_key(user, &secret_type);

        let entry = Entry::new(&self.service, &key)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;

        // Create stored secret with metadata
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let stored = StoredSecret {
            value: value.to_string(),
            secret_type,
            created_at: now,
            last_accessed: None,
            label,
        };

        let serialized = serde_json::to_string(&stored)
            .map_err(|_| KeyringError::InvalidFormat)?;

        entry
            .set_password(&serialized)
            .map_err(|e| KeyringError::StoreError(e.to_string()))?;

        log::info!("Stored secret: {}", key);
        Ok(())
    }

    /// Retrieve a secret from the system keyring
    pub fn retrieve_secret(
        &self,
        user: &str,
        secret_type: &SecretType,
    ) -> Result<StoredSecret, KeyringError> {
        let key = self.build_key(user, secret_type);

        let entry = Entry::new(&self.service, &key)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;

        let password = entry
            .get_password()
            .map_err(|e| match e {
                keyring::Error::NoEntry => KeyringError::NotFound(key.clone()),
                _ => KeyringError::AccessError(e.to_string()),
            })?;

        let mut stored: StoredSecret = serde_json::from_str(&password)
            .map_err(|_| KeyringError::InvalidFormat)?;

        // Update last accessed time
        stored.last_accessed = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        );

        log::debug!("Retrieved secret: {}", key);
        Ok(stored)
    }

    /// Delete a secret from the system keyring
    pub fn delete_secret(
        &self,
        user: &str,
        secret_type: &SecretType,
    ) -> Result<(), KeyringError> {
        let key = self.build_key(user, secret_type);

        let entry = Entry::new(&self.service, &key)
            .map_err(|e| KeyringError::AccessError(e.to_string()))?;

        entry
            .delete_credential()
            .map_err(|e| match e {
                keyring::Error::NoEntry => KeyringError::NotFound(key.clone()),
                _ => KeyringError::DeleteError(e.to_string()),
            })?;

        log::info!("Deleted secret: {}", key);
        Ok(())
    }

    /// Check if a secret exists in the keyring
    pub fn has_secret(&self, user: &str, secret_type: &SecretType) -> bool {
        let key = self.build_key(user, secret_type);

        match Entry::new(&self.service, &key) {
            Ok(entry) => entry.get_password().is_ok(),
            Err(_) => false,
        }
    }

    /// Store a Nostr private key
    pub fn store_nostr_key(
        &self,
        user: &str,
        private_key_hex: &str,
        label: Option<String>,
    ) -> Result<(), KeyringError> {
        self.store_secret(user, SecretType::NostrPrivateKey, private_key_hex, label)
    }

    /// Retrieve a Nostr private key
    pub fn retrieve_nostr_key(&self, user: &str) -> Result<String, KeyringError> {
        let stored = self.retrieve_secret(user, &SecretType::NostrPrivateKey)?;
        Ok(stored.value)
    }

    /// Store a master encryption key
    pub fn store_master_key(
        &self,
        user: &str,
        master_key_hex: &str,
    ) -> Result<(), KeyringError> {
        self.store_secret(
            user,
            SecretType::MasterKey,
            master_key_hex,
            Some("BuildIt Network Master Key".to_string()),
        )
    }

    /// Retrieve a master encryption key
    pub fn retrieve_master_key(&self, user: &str) -> Result<String, KeyringError> {
        let stored = self.retrieve_secret(user, &SecretType::MasterKey)?;
        Ok(stored.value)
    }

    /// Store a database encryption key
    pub fn store_database_key(
        &self,
        user: &str,
        database_key_hex: &str,
    ) -> Result<(), KeyringError> {
        self.store_secret(
            user,
            SecretType::DatabaseKey,
            database_key_hex,
            Some("BuildIt Network Database Key".to_string()),
        )
    }

    /// Retrieve a database encryption key
    pub fn retrieve_database_key(&self, user: &str) -> Result<String, KeyringError> {
        let stored = self.retrieve_secret(user, &SecretType::DatabaseKey)?;
        Ok(stored.value)
    }

    /// List all secrets for a user (returns types, not values)
    pub fn list_secrets(&self, user: &str) -> Vec<SecretType> {
        let types = vec![
            SecretType::NostrPrivateKey,
            SecretType::MasterKey,
            SecretType::DatabaseKey,
            SecretType::ApiToken,
        ];

        types
            .into_iter()
            .filter(|t| self.has_secret(user, t))
            .collect()
    }

    /// Clear all secrets for a user
    pub fn clear_all_secrets(&self, user: &str) -> Result<(), KeyringError> {
        let types = self.list_secrets(user);
        for secret_type in types {
            self.delete_secret(user, &secret_type)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_key() {
        let manager = KeyringManager::new("test.service");
        let key = manager.build_key("alice", &SecretType::NostrPrivateKey);
        assert_eq!(key, "alice_nostr_private_key");
    }

    #[test]
    fn test_secret_type_suffix() {
        assert_eq!(SecretType::NostrPrivateKey.key_suffix(), "nostr_private_key");
        assert_eq!(SecretType::MasterKey.key_suffix(), "master_key");
        assert_eq!(SecretType::Custom("my_secret".to_string()).key_suffix(), "my_secret");
    }
}
