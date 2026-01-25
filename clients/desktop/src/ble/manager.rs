//! BLE Manager for device discovery and connection management
//!
//! Uses btleplug for cross-platform BLE support.
//!
//! Security Features:
//! - Dynamic service UUID rotation derived from shared daily seed
//! - Commitment-based identity (H(pubkey || nonce)) instead of exposing public keys
//! - No public key exposure in advertisements

use btleplug::api::{
    BDAddr, Central, Characteristic, Manager as BtManager, Peripheral, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral as PlatformPeripheral};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Base UUID components for BuildIt Network BLE Service
/// The actual UUID rotates daily based on a shared seed
const BUILDIT_SERVICE_BASE: u128 = 0xb0000001_4e0d_4e70_8c3f_6c7e8d9a0b1c;

/// BuildIt Network Mesh Message Characteristic UUID (static, within the rotating service)
const BUILDIT_MESH_CHAR_OFFSET: u128 = 0x01;

/// BuildIt Network Identity Characteristic UUID (static, within the rotating service)
const BUILDIT_IDENTITY_CHAR_OFFSET: u128 = 0x02;

/// BuildIt Network Handshake Characteristic UUID (for commitment reveal)
const BUILDIT_HANDSHAKE_CHAR_OFFSET: u128 = 0x03;

/// Service UUID rotation interval in seconds (24 hours)
const UUID_ROTATION_INTERVAL_SECS: u64 = 86400;

/// Well-known seed for UUID derivation (all BuildIt nodes use this)
/// In production, this could be derived from a more sophisticated mechanism
const UUID_DERIVATION_SEED: &[u8] = b"BuildItNetwork-BLE-UUID-Seed-v1";

/// BLE operation errors
#[derive(Debug, Error)]
pub enum BleError {
    #[error("BLE not available on this device")]
    NotAvailable,

    #[error("BLE adapter not found")]
    AdapterNotFound,

    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Service not found")]
    ServiceNotFound,

    #[error("Characteristic not found")]
    CharacteristicNotFound,

    #[error("Write failed: {0}")]
    WriteFailed(String),

    #[error("Read failed: {0}")]
    ReadFailed(String),

    #[error("Scan already in progress")]
    ScanInProgress,

    #[error("Scan not running")]
    ScanNotRunning,

    #[error("BLE operation error: {0}")]
    OperationError(String),

    #[error("Commitment verification failed")]
    CommitmentVerificationFailed,
}

/// Generate the current service UUID based on daily rotation
///
/// All BuildIt nodes derive the same UUID for a given day, allowing
/// discovery while preventing long-term device tracking via static UUIDs.
pub fn get_current_service_uuid() -> Uuid {
    // Get current day (UTC) as the rotation epoch
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let day_epoch = now / UUID_ROTATION_INTERVAL_SECS;

    // Derive UUID from seed and day
    let mut hasher = Sha256::new();
    hasher.update(UUID_DERIVATION_SEED);
    hasher.update(day_epoch.to_le_bytes());
    let hash = hasher.finalize();

    // Use first 16 bytes of hash as UUID, but keep the version/variant bits valid
    let mut uuid_bytes = [0u8; 16];
    uuid_bytes.copy_from_slice(&hash[..16]);

    // Set version 4 (random) and variant 1 (RFC 4122)
    uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40; // Version 4
    uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80; // Variant 1

    Uuid::from_bytes(uuid_bytes)
}

/// Get the mesh message characteristic UUID for the current service
pub fn get_mesh_characteristic_uuid() -> Uuid {
    let service = get_current_service_uuid();
    let service_u128 = u128::from_be_bytes(*service.as_bytes());
    Uuid::from_u128(service_u128.wrapping_add(BUILDIT_MESH_CHAR_OFFSET))
}

/// Get the identity characteristic UUID for the current service
pub fn get_identity_characteristic_uuid() -> Uuid {
    let service = get_current_service_uuid();
    let service_u128 = u128::from_be_bytes(*service.as_bytes());
    Uuid::from_u128(service_u128.wrapping_add(BUILDIT_IDENTITY_CHAR_OFFSET))
}

/// Get the handshake characteristic UUID for the current service
pub fn get_handshake_characteristic_uuid() -> Uuid {
    let service = get_current_service_uuid();
    let service_u128 = u128::from_be_bytes(*service.as_bytes());
    Uuid::from_u128(service_u128.wrapping_add(BUILDIT_HANDSHAKE_CHAR_OFFSET))
}

/// Legacy static UUIDs (deprecated, kept for migration)
/// DO NOT USE - these expose users to tracking
#[deprecated(note = "Use get_current_service_uuid() for rotating UUIDs")]
pub const BUILDIT_SERVICE_UUID: Uuid = Uuid::from_u128(BUILDIT_SERVICE_BASE);

#[deprecated(note = "Use get_mesh_characteristic_uuid() for rotating UUIDs")]
pub const BUILDIT_MESH_CHAR_UUID: Uuid = Uuid::from_u128(BUILDIT_SERVICE_BASE + 1);

#[deprecated(note = "Use get_identity_characteristic_uuid() for rotating UUIDs")]
pub const BUILDIT_IDENTITY_CHAR_UUID: Uuid = Uuid::from_u128(BUILDIT_SERVICE_BASE + 2);

/// Identity commitment for BLE advertisement
///
/// SECURITY: We advertise H(pubkey || nonce) instead of the actual pubkey.
/// The nonce is revealed after connection establishment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityCommitment {
    /// SHA256(pubkey || nonce), first 20 bytes (fits in BLE advertisement)
    pub commitment: Vec<u8>,
    /// Nonce used in commitment (revealed after connection)
    pub nonce: Vec<u8>,
    /// Our actual public key (never transmitted in advertisements)
    pub pubkey: String,
}

impl IdentityCommitment {
    /// Create a new identity commitment
    pub fn new(pubkey: &str) -> Self {
        // Generate random nonce
        let mut nonce = vec![0u8; 16];
        getrandom::getrandom(&mut nonce).expect("Failed to generate random nonce");

        // Compute commitment
        let mut hasher = Sha256::new();
        hasher.update(pubkey.as_bytes());
        hasher.update(&nonce);
        let hash = hasher.finalize();

        Self {
            commitment: hash[..20].to_vec(), // First 20 bytes for BLE advertisement
            nonce,
            pubkey: pubkey.to_string(),
        }
    }

    /// Verify a commitment against a pubkey and nonce
    pub fn verify(commitment: &[u8], pubkey: &str, nonce: &[u8]) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(pubkey.as_bytes());
        hasher.update(nonce);
        let hash = hasher.finalize();
        hash[..commitment.len()] == *commitment
    }

    /// Get the commitment bytes for advertisement (max 20 bytes)
    pub fn advertisement_data(&self) -> Vec<u8> {
        self.commitment.clone()
    }
}

/// Discovered BLE device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    /// Device address (MAC or UUID depending on platform)
    pub address: String,
    /// Device name (if available)
    pub name: Option<String>,
    /// Signal strength (RSSI)
    pub rssi: Option<i16>,
    /// Whether this device advertises the BuildIt service
    pub is_buildit_device: bool,
    /// Last seen timestamp (unix milliseconds)
    pub last_seen: u64,
    /// Identity commitment from advertisement (NOT the actual pubkey)
    pub identity_commitment: Option<Vec<u8>>,
    /// Verified public key (only set after successful handshake)
    pub verified_pubkey: Option<String>,
}

/// BLE connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
    /// Handshake in progress (commitment verification)
    Handshaking,
    /// Fully authenticated (commitment verified)
    Authenticated,
}

/// Connected device with characteristics
#[derive(Debug)]
pub struct ConnectedDevice {
    pub peripheral: PlatformPeripheral,
    pub mesh_characteristic: Option<Characteristic>,
    pub identity_characteristic: Option<Characteristic>,
    pub handshake_characteristic: Option<Characteristic>,
    /// Their identity commitment (from advertisement)
    pub their_commitment: Option<Vec<u8>>,
    /// Their verified public key (after handshake)
    pub their_pubkey: Option<String>,
    /// Connection status
    pub status: ConnectionStatus,
}

/// BLE scan event for broadcasting to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BleEvent {
    DeviceDiscovered(DiscoveredDevice),
    DeviceUpdated(DiscoveredDevice),
    DeviceLost(String),
    ConnectionChanged {
        address: String,
        status: ConnectionStatus,
    },
    MessageReceived {
        from_address: String,
        data: Vec<u8>,
    },
    /// Service UUID rotated (clients should update their scan filters)
    ServiceUuidRotated {
        new_uuid: String,
    },
    /// Handshake completed (identity verified)
    HandshakeCompleted {
        address: String,
        pubkey: String,
    },
}

/// BLE Manager for handling all Bluetooth operations
pub struct BleManager {
    /// Platform BLE manager
    manager: Option<Manager>,
    /// Primary adapter
    adapter: Option<Adapter>,
    /// Discovered devices
    discovered_devices: HashMap<String, DiscoveredDevice>,
    /// Connected devices
    connected_devices: HashMap<String, ConnectedDevice>,
    /// Scan status
    is_scanning: bool,
    /// Event broadcaster
    event_tx: broadcast::Sender<BleEvent>,
    /// Our identity commitment
    our_commitment: Option<IdentityCommitment>,
    /// Last known service UUID (for rotation detection)
    last_service_uuid: Uuid,
}

impl BleManager {
    /// Create a new BLE manager
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self {
            manager: None,
            adapter: None,
            discovered_devices: HashMap::new(),
            connected_devices: HashMap::new(),
            is_scanning: false,
            event_tx,
            our_commitment: None,
            last_service_uuid: get_current_service_uuid(),
        }
    }

    /// Initialize the BLE manager and find adapter
    pub async fn initialize(&mut self) -> Result<(), BleError> {
        let manager = Manager::new()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        let adapters = manager
            .adapters()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        let adapter = adapters
            .into_iter()
            .next()
            .ok_or(BleError::AdapterNotFound)?;

        self.manager = Some(manager);
        self.adapter = Some(adapter);

        log::info!("BLE manager initialized successfully");
        Ok(())
    }

    /// Set our identity for commitment-based advertisement
    pub fn set_identity(&mut self, pubkey: &str) {
        self.our_commitment = Some(IdentityCommitment::new(pubkey));
        log::info!("Identity commitment created for BLE");
    }

    /// Get our identity commitment for advertisement
    pub fn get_advertisement_data(&self) -> Option<Vec<u8>> {
        self.our_commitment.as_ref().map(|c| c.advertisement_data())
    }

    /// Check if service UUID needs rotation and notify if so
    pub fn check_uuid_rotation(&mut self) {
        let current = get_current_service_uuid();
        if current != self.last_service_uuid {
            self.last_service_uuid = current;
            let _ = self.event_tx.send(BleEvent::ServiceUuidRotated {
                new_uuid: current.to_string(),
            });
            log::info!("Service UUID rotated to: {}", current);
        }
    }

    /// Start scanning for BuildIt devices
    pub async fn start_scan(&mut self, timeout_seconds: Option<u64>) -> Result<(), BleError> {
        if self.is_scanning {
            return Err(BleError::ScanInProgress);
        }

        // Ensure we're initialized
        if self.adapter.is_none() {
            self.initialize().await?;
        }

        // Check for UUID rotation
        self.check_uuid_rotation();

        let adapter = self.adapter.as_ref().ok_or(BleError::AdapterNotFound)?;

        // Set up scan filter for current BuildIt service UUID
        let current_service_uuid = get_current_service_uuid();
        let scan_filter = ScanFilter {
            services: vec![current_service_uuid],
        };

        adapter
            .start_scan(scan_filter)
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        self.is_scanning = true;
        log::info!(
            "BLE scan started with service UUID: {}",
            current_service_uuid
        );

        // Handle scan timeout if specified
        if let Some(timeout) = timeout_seconds {
            let event_tx = self.event_tx.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(timeout)).await;
                log::info!("BLE scan timeout reached");
                let _ = event_tx.send(BleEvent::DeviceLost("scan_timeout".to_string()));
            });
        }

        Ok(())
    }

    /// Stop scanning for devices
    pub async fn stop_scan(&mut self) -> Result<(), BleError> {
        if !self.is_scanning {
            return Err(BleError::ScanNotRunning);
        }

        let adapter = self.adapter.as_ref().ok_or(BleError::AdapterNotFound)?;

        adapter
            .stop_scan()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        self.is_scanning = false;
        log::info!("BLE scan stopped");
        Ok(())
    }

    /// Get all discovered devices
    pub async fn get_discovered_devices(&mut self) -> Result<Vec<DiscoveredDevice>, BleError> {
        let adapter = self.adapter.as_ref().ok_or(BleError::AdapterNotFound)?;

        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let current_service_uuid = get_current_service_uuid();

        for peripheral in peripherals {
            let properties = peripheral
                .properties()
                .await
                .map_err(|e| BleError::OperationError(e.to_string()))?;

            if let Some(props) = properties {
                let address = peripheral.address().to_string();
                let is_buildit = props.services.iter().any(|s| *s == current_service_uuid);

                // Extract identity commitment from service data if available
                let identity_commitment = props
                    .service_data
                    .get(&current_service_uuid)
                    .cloned();

                let device = DiscoveredDevice {
                    address: address.clone(),
                    name: props.local_name,
                    rssi: props.rssi,
                    is_buildit_device: is_buildit,
                    last_seen: now,
                    identity_commitment,
                    verified_pubkey: None, // Not verified until handshake
                };

                // Check if this is a new or updated device
                let is_new = !self.discovered_devices.contains_key(&address);
                self.discovered_devices.insert(address.clone(), device.clone());

                // Broadcast event
                let event = if is_new {
                    BleEvent::DeviceDiscovered(device)
                } else {
                    BleEvent::DeviceUpdated(device)
                };
                let _ = self.event_tx.send(event);
            }
        }

        Ok(self.discovered_devices.values().cloned().collect())
    }

    /// Connect to a device by address
    pub async fn connect(&mut self, address: &str) -> Result<(), BleError> {
        let adapter = self.adapter.as_ref().ok_or(BleError::AdapterNotFound)?;

        // Find the peripheral
        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        let peripheral = peripherals
            .into_iter()
            .find(|p| p.address().to_string() == address)
            .ok_or_else(|| BleError::DeviceNotFound(address.to_string()))?;

        // Broadcast connecting status
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Connecting,
        });

        // Connect
        peripheral
            .connect()
            .await
            .map_err(|e| BleError::ConnectionFailed(e.to_string()))?;

        // Discover services
        peripheral
            .discover_services()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        let current_service_uuid = get_current_service_uuid();
        let mesh_char_uuid = get_mesh_characteristic_uuid();
        let identity_char_uuid = get_identity_characteristic_uuid();
        let handshake_char_uuid = get_handshake_characteristic_uuid();

        // Find BuildIt characteristics
        let mut mesh_char = None;
        let mut identity_char = None;
        let mut handshake_char = None;

        for service in peripheral.services() {
            if service.uuid == current_service_uuid {
                for characteristic in service.characteristics {
                    if characteristic.uuid == mesh_char_uuid {
                        mesh_char = Some(characteristic.clone());
                    } else if characteristic.uuid == identity_char_uuid {
                        identity_char = Some(characteristic.clone());
                    } else if characteristic.uuid == handshake_char_uuid {
                        handshake_char = Some(characteristic.clone());
                    }
                }
            }
        }

        // Get their commitment from discovered device
        let their_commitment = self
            .discovered_devices
            .get(address)
            .and_then(|d| d.identity_commitment.clone());

        // Subscribe to mesh characteristic notifications
        if let Some(ref char) = mesh_char {
            peripheral
                .subscribe(char)
                .await
                .map_err(|e| BleError::OperationError(e.to_string()))?;

            // Set up notification handler
            let mut notification_stream = peripheral
                .notifications()
                .await
                .map_err(|e| BleError::OperationError(e.to_string()))?;

            let event_tx = self.event_tx.clone();
            let addr = address.to_string();
            tokio::spawn(async move {
                while let Some(data) = notification_stream.next().await {
                    let _ = event_tx.send(BleEvent::MessageReceived {
                        from_address: addr.clone(),
                        data: data.value,
                    });
                }
            });
        }

        // Store connected device
        let connected = ConnectedDevice {
            peripheral,
            mesh_characteristic: mesh_char,
            identity_characteristic: identity_char,
            handshake_characteristic: handshake_char,
            their_commitment,
            their_pubkey: None,
            status: ConnectionStatus::Connected,
        };
        self.connected_devices.insert(address.to_string(), connected);

        // Broadcast connected status
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Connected,
        });

        log::info!("Connected to device: {}", address);
        Ok(())
    }

    /// Perform handshake to verify identity commitment
    pub async fn perform_handshake(&mut self, address: &str) -> Result<String, BleError> {
        let device = self
            .connected_devices
            .get_mut(address)
            .ok_or_else(|| BleError::DeviceNotFound(address.to_string()))?;

        // Update status to handshaking
        device.status = ConnectionStatus::Handshaking;
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Handshaking,
        });

        // Read their handshake data (pubkey + nonce)
        let handshake_char = device
            .handshake_characteristic
            .as_ref()
            .ok_or(BleError::CharacteristicNotFound)?;

        let handshake_data = device
            .peripheral
            .read(handshake_char)
            .await
            .map_err(|e| BleError::ReadFailed(e.to_string()))?;

        // Parse handshake data: pubkey (64 bytes hex = 32 bytes) + nonce (16 bytes)
        if handshake_data.len() < 48 {
            return Err(BleError::CommitmentVerificationFailed);
        }

        let their_pubkey_hex = String::from_utf8_lossy(&handshake_data[..64]).to_string();
        let their_nonce = &handshake_data[64..];

        // Verify commitment
        let their_commitment = device
            .their_commitment
            .as_ref()
            .ok_or(BleError::CommitmentVerificationFailed)?;

        if !IdentityCommitment::verify(their_commitment, &their_pubkey_hex, their_nonce) {
            device.status = ConnectionStatus::Connected; // Revert status
            return Err(BleError::CommitmentVerificationFailed);
        }

        // Commitment verified - store their pubkey
        device.their_pubkey = Some(their_pubkey_hex.clone());
        device.status = ConnectionStatus::Authenticated;

        // Send our handshake data (pubkey + nonce)
        if let Some(ref our_commitment) = self.our_commitment {
            let mut our_handshake = our_commitment.pubkey.as_bytes().to_vec();
            our_handshake.extend_from_slice(&our_commitment.nonce);

            device
                .peripheral
                .write(handshake_char, &our_handshake, WriteType::WithResponse)
                .await
                .map_err(|e| BleError::WriteFailed(e.to_string()))?;
        }

        // Broadcast authenticated status
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Authenticated,
        });

        let _ = self.event_tx.send(BleEvent::HandshakeCompleted {
            address: address.to_string(),
            pubkey: their_pubkey_hex.clone(),
        });

        log::info!(
            "Handshake completed with {}: pubkey verified",
            address
        );
        Ok(their_pubkey_hex)
    }

    /// Disconnect from a device
    pub async fn disconnect(&mut self, address: &str) -> Result<(), BleError> {
        let device = self
            .connected_devices
            .remove(address)
            .ok_or_else(|| BleError::DeviceNotFound(address.to_string()))?;

        // Broadcast disconnecting status
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Disconnecting,
        });

        device
            .peripheral
            .disconnect()
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        // Broadcast disconnected status
        let _ = self.event_tx.send(BleEvent::ConnectionChanged {
            address: address.to_string(),
            status: ConnectionStatus::Disconnected,
        });

        log::info!("Disconnected from device: {}", address);
        Ok(())
    }

    /// Send a message to a connected device
    pub async fn send_message(&self, address: &str, data: &[u8]) -> Result<(), BleError> {
        let device = self
            .connected_devices
            .get(address)
            .ok_or_else(|| BleError::DeviceNotFound(address.to_string()))?;

        let characteristic = device
            .mesh_characteristic
            .as_ref()
            .ok_or(BleError::CharacteristicNotFound)?;

        device
            .peripheral
            .write(characteristic, data, WriteType::WithResponse)
            .await
            .map_err(|e| BleError::WriteFailed(e.to_string()))?;

        log::debug!("Sent {} bytes to {}", data.len(), address);
        Ok(())
    }

    /// Read identity from a connected device (returns commitment, not pubkey)
    pub async fn read_identity(&self, address: &str) -> Result<Vec<u8>, BleError> {
        let device = self
            .connected_devices
            .get(address)
            .ok_or_else(|| BleError::DeviceNotFound(address.to_string()))?;

        let characteristic = device
            .identity_characteristic
            .as_ref()
            .ok_or(BleError::CharacteristicNotFound)?;

        let data = device
            .peripheral
            .read(characteristic)
            .await
            .map_err(|e| BleError::ReadFailed(e.to_string()))?;

        Ok(data)
    }

    /// Get current scanning status
    pub fn is_scanning(&self) -> bool {
        self.is_scanning
    }

    /// Get connection status for a device
    pub fn get_connection_status(&self, address: &str) -> ConnectionStatus {
        self.connected_devices
            .get(address)
            .map(|d| d.status.clone())
            .unwrap_or(ConnectionStatus::Disconnected)
    }

    /// Get verified public key for a connected device (only after handshake)
    pub fn get_verified_pubkey(&self, address: &str) -> Option<String> {
        self.connected_devices
            .get(address)
            .and_then(|d| d.their_pubkey.clone())
    }

    /// Subscribe to BLE events
    pub fn subscribe(&self) -> broadcast::Receiver<BleEvent> {
        self.event_tx.subscribe()
    }

    /// Broadcast all connected device messages (for mesh routing)
    pub async fn broadcast_mesh_message(&self, data: &[u8]) -> Result<usize, BleError> {
        let mut sent_count = 0;
        for (address, device) in &self.connected_devices {
            // Only send to authenticated devices
            if device.status != ConnectionStatus::Authenticated {
                log::debug!("Skipping unauthenticated device: {}", address);
                continue;
            }

            if let Some(ref char) = device.mesh_characteristic {
                if device
                    .peripheral
                    .write(char, data, WriteType::WithoutResponse)
                    .await
                    .is_ok()
                {
                    sent_count += 1;
                } else {
                    log::warn!("Failed to send mesh message to {}", address);
                }
            }
        }
        log::debug!("Broadcast mesh message to {} authenticated devices", sent_count);
        Ok(sent_count)
    }

    /// Get the current service UUID (for external use)
    pub fn current_service_uuid(&self) -> Uuid {
        get_current_service_uuid()
    }
}

impl Default for BleManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuid_rotation_deterministic() {
        // Same day should produce same UUID
        let uuid1 = get_current_service_uuid();
        let uuid2 = get_current_service_uuid();
        assert_eq!(uuid1, uuid2);
    }

    #[test]
    fn test_characteristic_uuids_unique() {
        let mesh = get_mesh_characteristic_uuid();
        let identity = get_identity_characteristic_uuid();
        let handshake = get_handshake_characteristic_uuid();

        assert_ne!(mesh, identity);
        assert_ne!(mesh, handshake);
        assert_ne!(identity, handshake);
    }

    #[test]
    fn test_identity_commitment() {
        let pubkey = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
        let commitment = IdentityCommitment::new(pubkey);

        // Commitment should be 20 bytes for BLE advertisement
        assert_eq!(commitment.advertisement_data().len(), 20);

        // Verification should work with correct data
        assert!(IdentityCommitment::verify(
            &commitment.commitment,
            pubkey,
            &commitment.nonce
        ));

        // Verification should fail with wrong pubkey
        let wrong_pubkey = "1111111111111111111111111111111111111111111111111111111111111111";
        assert!(!IdentityCommitment::verify(
            &commitment.commitment,
            wrong_pubkey,
            &commitment.nonce
        ));
    }

    #[test]
    fn test_uuid_is_valid_uuid4() {
        let uuid = get_current_service_uuid();
        // Check version 4 and variant 1
        let bytes = uuid.as_bytes();
        assert_eq!((bytes[6] >> 4) & 0x0f, 4); // Version 4
        assert!((bytes[8] >> 6) & 0x03 >= 2); // Variant 1
    }
}
