//! Certificate pinning for Nostr relay connections
//!
//! This module implements certificate pinning to prevent MITM attacks on relay connections.
//! It supports:
//! - Pre-configured pins for known relays (SHA-256 fingerprints)
//! - Trust-on-First-Use (TOFU) for unknown relays
//! - Backup pins for certificate rotation
//! - Warning/blocking when certificates change unexpectedly

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ring::digest::{digest, SHA256};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, Error as TlsError, SignatureScheme};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use thiserror::Error;

/// Certificate pinning errors
#[derive(Debug, Error)]
pub enum CertPinError {
    #[error("Certificate pin mismatch for {host}: expected {expected}, got {actual}")]
    PinMismatch {
        host: String,
        expected: String,
        actual: String,
    },

    #[error("Certificate changed for TOFU host {host}: was {previous}, now {current}")]
    TofuCertificateChanged {
        host: String,
        previous: String,
        current: String,
    },

    #[error("No certificate provided by server")]
    NoCertificate,

    #[error("Invalid certificate data: {0}")]
    InvalidCertificate(String),

    #[error("Pin storage error: {0}")]
    StorageError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

/// A single relay's certificate pin configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayPinConfig {
    /// Primary certificate pins (SHA-256 fingerprints, base64-encoded)
    pub pins: Vec<String>,

    /// Backup pins for certificate rotation
    pub backup_pins: Vec<String>,

    /// When this pin was last verified
    pub last_verified: Option<u64>,

    /// Optional notes about this relay
    #[serde(default)]
    pub notes: String,
}

/// Global certificate pinning configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertPinConfig {
    /// Whether Trust-on-First-Use is enabled for unknown relays
    pub tofu_enabled: bool,

    /// Whether to warn (vs block) when TOFU certificate changes
    pub tofu_warn_on_change: bool,

    /// Whether write operations require pinned certificates
    pub require_pinned_for_write: bool,

    /// How many days before pins should be refreshed
    pub pin_expiry_days: u32,
}

impl Default for CertPinConfig {
    fn default() -> Self {
        Self {
            tofu_enabled: true,
            tofu_warn_on_change: true,
            require_pinned_for_write: true,
            pin_expiry_days: 365,
        }
    }
}

/// Certificate pin storage and verification
#[derive(Debug)]
pub struct CertPinStore {
    /// Configuration
    config: CertPinConfig,

    /// Pre-configured relay pins (from relay-pins.json)
    known_pins: HashMap<String, RelayPinConfig>,

    /// TOFU pins (learned at runtime)
    tofu_pins: Arc<RwLock<HashMap<String, String>>>,

    /// Path to persist TOFU pins
    tofu_storage_path: Option<PathBuf>,
}

impl CertPinStore {
    /// Create a new certificate pin store
    pub fn new(config: CertPinConfig) -> Self {
        Self {
            config,
            known_pins: HashMap::new(),
            tofu_pins: Arc::new(RwLock::new(HashMap::new())),
            tofu_storage_path: None,
        }
    }

    /// Load known pins from the embedded configuration
    pub fn load_known_pins(&mut self) -> Result<(), CertPinError> {
        // Load from embedded relay-pins.json
        // Path relative to clients/desktop/src/nostr/cert_pinning.rs
        let pins_json = include_str!("../../../../protocol/security/relay-pins.json");
        let config: serde_json::Value = serde_json::from_str(pins_json)
            .map_err(|e| CertPinError::ConfigError(e.to_string()))?;

        if let Some(relays) = config.get("relays").and_then(|r| r.as_object()) {
            for (url, pin_config) in relays {
                if let Ok(relay_pin) = serde_json::from_value::<RelayPinConfig>(pin_config.clone())
                {
                    self.known_pins.insert(url.clone(), relay_pin);
                }
            }
        }

        Ok(())
    }

    /// Set the path for TOFU pin persistence
    pub fn set_tofu_storage_path(&mut self, path: PathBuf) {
        self.tofu_storage_path = Some(path);
        self.load_tofu_pins();
    }

    /// Load TOFU pins from storage
    fn load_tofu_pins(&self) {
        if let Some(ref path) = self.tofu_storage_path {
            if path.exists() {
                if let Ok(contents) = std::fs::read_to_string(path) {
                    if let Ok(pins) = serde_json::from_str::<HashMap<String, String>>(&contents) {
                        if let Ok(mut tofu) = self.tofu_pins.write() {
                            *tofu = pins;
                        }
                    }
                }
            }
        }
    }

    /// Save TOFU pins to storage
    fn save_tofu_pins(&self) {
        if let Some(ref path) = self.tofu_storage_path {
            if let Ok(tofu) = self.tofu_pins.read() {
                if let Ok(json) = serde_json::to_string_pretty(&*tofu) {
                    let _ = std::fs::write(path, json);
                }
            }
        }
    }

    /// Add a known relay pin
    pub fn add_known_pin(&mut self, url: &str, pin_config: RelayPinConfig) {
        self.known_pins.insert(url.to_string(), pin_config);
    }

    /// Compute SHA-256 fingerprint of a certificate (base64-encoded)
    pub fn compute_fingerprint(cert_der: &[u8]) -> String {
        let hash = digest(&SHA256, cert_der);
        format!("sha256/{}", BASE64.encode(hash.as_ref()))
    }

    /// Verify a certificate against known or TOFU pins
    pub fn verify_certificate(
        &self,
        host: &str,
        cert_der: &[u8],
    ) -> Result<CertVerifyResult, CertPinError> {
        let fingerprint = Self::compute_fingerprint(cert_der);
        let normalized_host = self.normalize_host(host);

        // Check known pins first
        if let Some(pin_config) = self.known_pins.get(&normalized_host) {
            // Check if any primary or backup pin matches
            if !pin_config.pins.is_empty() || !pin_config.backup_pins.is_empty() {
                let all_pins: Vec<&String> = pin_config
                    .pins
                    .iter()
                    .chain(pin_config.backup_pins.iter())
                    .collect();

                if all_pins.iter().any(|p| **p == fingerprint) {
                    return Ok(CertVerifyResult::Pinned);
                } else if !all_pins.is_empty() {
                    // We have pins configured but none match
                    return Err(CertPinError::PinMismatch {
                        host: normalized_host,
                        expected: all_pins
                            .iter()
                            .map(|s| s.as_str())
                            .collect::<Vec<_>>()
                            .join(", "),
                        actual: fingerprint,
                    });
                }
            }
            // Empty pins = known relay but no pins configured yet, fall through to TOFU
        }

        // Check TOFU pins
        if self.config.tofu_enabled {
            if let Ok(tofu) = self.tofu_pins.read() {
                if let Some(stored_pin) = tofu.get(&normalized_host) {
                    if *stored_pin == fingerprint {
                        return Ok(CertVerifyResult::Tofu);
                    } else {
                        // Certificate changed!
                        if self.config.tofu_warn_on_change {
                            log::warn!(
                                "Certificate changed for TOFU host {}: was {}, now {}",
                                normalized_host,
                                stored_pin,
                                fingerprint
                            );
                            return Ok(CertVerifyResult::TofuChanged {
                                previous: stored_pin.clone(),
                                current: fingerprint,
                            });
                        } else {
                            return Err(CertPinError::TofuCertificateChanged {
                                host: normalized_host,
                                previous: stored_pin.clone(),
                                current: fingerprint,
                            });
                        }
                    }
                }
            }

            // First time seeing this host - store the pin
            if let Ok(mut tofu) = self.tofu_pins.write() {
                tofu.insert(normalized_host.clone(), fingerprint.clone());
                drop(tofu);
                self.save_tofu_pins();
                log::info!(
                    "TOFU: Stored initial certificate pin for {}: {}",
                    normalized_host,
                    fingerprint
                );
                return Ok(CertVerifyResult::TofuFirstUse);
            }
        }

        // No TOFU enabled and no known pins - this is an error for security
        Err(CertPinError::ConfigError(format!(
            "No certificate pin configured for {} and TOFU is disabled",
            normalized_host
        )))
    }

    /// Normalize a host URL to a consistent format
    fn normalize_host(&self, host: &str) -> String {
        // Convert hostname to wss:// URL format for lookup
        if host.starts_with("wss://") || host.starts_with("ws://") {
            host.to_string()
        } else {
            format!("wss://{}", host)
        }
    }

    /// Check if a relay is pinned (known or TOFU)
    pub fn is_pinned(&self, host: &str) -> bool {
        let normalized = self.normalize_host(host);

        // Check known pins
        if let Some(config) = self.known_pins.get(&normalized) {
            if !config.pins.is_empty() {
                return true;
            }
        }

        // Check TOFU pins
        if let Ok(tofu) = self.tofu_pins.read() {
            if tofu.contains_key(&normalized) {
                return true;
            }
        }

        false
    }

    /// Get configuration
    pub fn config(&self) -> &CertPinConfig {
        &self.config
    }

    /// Clear TOFU pin for a specific host (useful for certificate rotation)
    pub fn clear_tofu_pin(&self, host: &str) {
        let normalized = self.normalize_host(host);
        if let Ok(mut tofu) = self.tofu_pins.write() {
            tofu.remove(&normalized);
            drop(tofu);
            self.save_tofu_pins();
        }
    }
}

/// Result of certificate verification
#[derive(Debug, Clone)]
pub enum CertVerifyResult {
    /// Certificate matched a known pin
    Pinned,

    /// Certificate matched a TOFU pin
    Tofu,

    /// First use of this certificate (TOFU)
    TofuFirstUse,

    /// TOFU certificate changed (warning mode)
    TofuChanged { previous: String, current: String },
}

/// Custom ServerCertVerifier that implements certificate pinning
#[derive(Debug)]
pub struct PinnedCertVerifier {
    /// Certificate pin store
    pin_store: Arc<CertPinStore>,

    /// Fallback verifier for standard certificate chain validation
    default_verifier: Arc<dyn ServerCertVerifier>,
}

impl PinnedCertVerifier {
    /// Create a new pinned certificate verifier
    pub fn new(pin_store: Arc<CertPinStore>) -> Self {
        // Create default verifier using webpki roots
        let root_store = rustls::RootCertStore {
            roots: webpki_roots::TLS_SERVER_ROOTS.to_vec(),
        };

        let default_verifier = rustls::client::WebPkiServerVerifier::builder(Arc::new(root_store))
            .build()
            .expect("Failed to build WebPKI verifier");

        Self {
            pin_store,
            default_verifier,
        }
    }
}

impl ServerCertVerifier for PinnedCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        // First, do standard certificate chain validation
        self.default_verifier.verify_server_cert(
            end_entity,
            intermediates,
            server_name,
            ocsp_response,
            now,
        )?;

        // Then, verify against our pins
        let host = match server_name {
            ServerName::DnsName(name) => name.as_ref().to_string(),
            _ => {
                return Err(TlsError::General(
                    "Certificate pinning requires DNS name".to_string(),
                ))
            }
        };

        match self.pin_store.verify_certificate(&host, end_entity.as_ref()) {
            Ok(result) => {
                match &result {
                    CertVerifyResult::TofuChanged { previous, current } => {
                        log::warn!(
                            "Certificate changed for {}: {} -> {}. Connection allowed but investigate!",
                            host, previous, current
                        );
                    }
                    _ => {
                        log::debug!("Certificate verified for {}: {:?}", host, result);
                    }
                }
                Ok(ServerCertVerified::assertion())
            }
            Err(e) => {
                log::error!("Certificate pinning failed for {}: {}", host, e);
                Err(TlsError::General(format!("Certificate pinning failed: {}", e)))
            }
        }
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.default_verifier
            .verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.default_verifier
            .verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.default_verifier.supported_verify_schemes()
    }
}

/// Create a TLS connector with certificate pinning enabled
pub fn create_pinned_tls_config(pin_store: Arc<CertPinStore>) -> Arc<rustls::ClientConfig> {
    let verifier = Arc::new(PinnedCertVerifier::new(pin_store));

    let config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();

    Arc::new(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_fingerprint() {
        // Test with a dummy certificate
        let dummy_cert = b"dummy certificate data for testing";
        let fingerprint = CertPinStore::compute_fingerprint(dummy_cert);

        // Should be base64-encoded SHA-256
        assert!(fingerprint.starts_with("sha256/"));
        assert!(fingerprint.len() > 10);
    }

    #[test]
    fn test_pin_store_tofu() {
        let config = CertPinConfig {
            tofu_enabled: true,
            tofu_warn_on_change: true,
            require_pinned_for_write: false,
            pin_expiry_days: 365,
        };

        let store = CertPinStore::new(config);
        let dummy_cert = b"test certificate";

        // First use should succeed
        let result = store.verify_certificate("wss://test.relay.io", dummy_cert);
        assert!(matches!(result, Ok(CertVerifyResult::TofuFirstUse)));

        // Same cert should match TOFU
        let result = store.verify_certificate("wss://test.relay.io", dummy_cert);
        assert!(matches!(result, Ok(CertVerifyResult::Tofu)));

        // Different cert should trigger warning (not error due to warn_on_change)
        let different_cert = b"different certificate";
        let result = store.verify_certificate("wss://test.relay.io", different_cert);
        assert!(matches!(result, Ok(CertVerifyResult::TofuChanged { .. })));
    }

    #[test]
    fn test_known_pin_verification() {
        let mut store = CertPinStore::new(CertPinConfig::default());

        let test_cert = b"test certificate data";
        let fingerprint = CertPinStore::compute_fingerprint(test_cert);

        store.add_known_pin(
            "wss://pinned.relay.io",
            RelayPinConfig {
                pins: vec![fingerprint.clone()],
                backup_pins: vec![],
                last_verified: None,
                notes: String::new(),
            },
        );

        // Matching pin should succeed
        let result = store.verify_certificate("wss://pinned.relay.io", test_cert);
        assert!(matches!(result, Ok(CertVerifyResult::Pinned)));

        // Non-matching cert should fail
        let bad_cert = b"bad certificate";
        let result = store.verify_certificate("wss://pinned.relay.io", bad_cert);
        assert!(matches!(result, Err(CertPinError::PinMismatch { .. })));
    }
}
