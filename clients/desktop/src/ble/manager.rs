//! BLE Manager for device discovery and connection management
//!
//! Uses btleplug for cross-platform BLE support.

use btleplug::api::{
    Central, Manager as BtManager, Peripheral, ScanFilter, WriteType,
    Characteristic, BDAddr,
};
use btleplug::platform::{Adapter, Manager, Peripheral as PlatformPeripheral};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

/// BuildIt Network BLE Service UUID
/// Custom UUID for mesh networking service
pub const BUILDIT_SERVICE_UUID: Uuid = Uuid::from_u128(0xb0000001_4e0d_4e70_8c3f_6c7e8d9a0b1c);

/// BuildIt Network Mesh Message Characteristic UUID
pub const BUILDIT_MESH_CHAR_UUID: Uuid = Uuid::from_u128(0xb0000002_4e0d_4e70_8c3f_6c7e8d9a0b1c);

/// BuildIt Network Identity Characteristic UUID
pub const BUILDIT_IDENTITY_CHAR_UUID: Uuid = Uuid::from_u128(0xb0000003_4e0d_4e70_8c3f_6c7e8d9a0b1c);

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
}

/// BLE connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
}

/// Connected device with characteristics
#[derive(Debug)]
pub struct ConnectedDevice {
    pub peripheral: PlatformPeripheral,
    pub mesh_characteristic: Option<Characteristic>,
    pub identity_characteristic: Option<Characteristic>,
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

    /// Start scanning for BuildIt devices
    pub async fn start_scan(&mut self, timeout_seconds: Option<u64>) -> Result<(), BleError> {
        if self.is_scanning {
            return Err(BleError::ScanInProgress);
        }

        // Ensure we're initialized
        if self.adapter.is_none() {
            self.initialize().await?;
        }

        let adapter = self.adapter.as_ref().ok_or(BleError::AdapterNotFound)?;

        // Set up scan filter for BuildIt service
        let scan_filter = ScanFilter {
            services: vec![BUILDIT_SERVICE_UUID],
        };

        adapter
            .start_scan(scan_filter)
            .await
            .map_err(|e| BleError::OperationError(e.to_string()))?;

        self.is_scanning = true;
        log::info!("BLE scan started");

        // Handle scan timeout if specified
        if let Some(timeout) = timeout_seconds {
            let event_tx = self.event_tx.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(timeout)).await;
                log::info!("BLE scan timeout reached");
                // Note: actual stop_scan should be called from the manager
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

        for peripheral in peripherals {
            let properties = peripheral
                .properties()
                .await
                .map_err(|e| BleError::OperationError(e.to_string()))?;

            if let Some(props) = properties {
                let address = peripheral.address().to_string();
                let is_buildit = props
                    .services
                    .iter()
                    .any(|s| *s == BUILDIT_SERVICE_UUID);

                let device = DiscoveredDevice {
                    address: address.clone(),
                    name: props.local_name,
                    rssi: props.rssi,
                    is_buildit_device: is_buildit,
                    last_seen: now,
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

        // Find BuildIt characteristics
        let mut mesh_char = None;
        let mut identity_char = None;

        for service in peripheral.services() {
            if service.uuid == BUILDIT_SERVICE_UUID {
                for characteristic in service.characteristics {
                    if characteristic.uuid == BUILDIT_MESH_CHAR_UUID {
                        mesh_char = Some(characteristic.clone());
                    } else if characteristic.uuid == BUILDIT_IDENTITY_CHAR_UUID {
                        identity_char = Some(characteristic.clone());
                    }
                }
            }
        }

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

    /// Read identity from a connected device
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
        if self.connected_devices.contains_key(address) {
            ConnectionStatus::Connected
        } else {
            ConnectionStatus::Disconnected
        }
    }

    /// Subscribe to BLE events
    pub fn subscribe(&self) -> broadcast::Receiver<BleEvent> {
        self.event_tx.subscribe()
    }

    /// Broadcast all connected device messages (for mesh routing)
    pub async fn broadcast_mesh_message(&self, data: &[u8]) -> Result<usize, BleError> {
        let mut sent_count = 0;
        for (address, device) in &self.connected_devices {
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
        log::debug!("Broadcast mesh message to {} devices", sent_count);
        Ok(sent_count)
    }
}

impl Default for BleManager {
    fn default() -> Self {
        Self::new()
    }
}
