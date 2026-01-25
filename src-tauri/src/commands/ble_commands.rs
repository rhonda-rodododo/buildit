//! BLE Tauri commands exposed to the frontend

use crate::ble::manager::{BleError, ConnectionStatus, DiscoveredDevice};
use crate::ble::mesh::MeshMessage;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// BLE status response
#[derive(Debug, Serialize, Deserialize)]
pub struct BleStatus {
    pub is_scanning: bool,
    pub connected_devices: Vec<String>,
    pub discovered_count: usize,
}

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

/// Start BLE scanning for BuildIt devices
#[tauri::command]
pub async fn start_ble_scan(
    state: State<'_, AppState>,
    timeout_seconds: Option<u64>,
) -> Result<CommandResult<()>, String> {
    let mut manager = state.ble_manager.write();

    // We need to use tokio runtime for async operations
    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(manager.start_scan(timeout_seconds))
    });

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Stop BLE scanning
#[tauri::command]
pub async fn stop_ble_scan(state: State<'_, AppState>) -> Result<CommandResult<()>, String> {
    let mut manager = state.ble_manager.write();

    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(manager.stop_scan())
    });

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Get list of discovered BLE devices
#[tauri::command]
pub async fn get_discovered_devices(
    state: State<'_, AppState>,
) -> Result<CommandResult<Vec<DiscoveredDevice>>, String> {
    let mut manager = state.ble_manager.write();

    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(manager.get_discovered_devices())
    });

    match result {
        Ok(devices) => Ok(CommandResult::ok(devices)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Connect to a BLE device by address
#[tauri::command]
pub async fn connect_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<CommandResult<()>, String> {
    let mut manager = state.ble_manager.write();

    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(manager.connect(&address))
    });

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Disconnect from a BLE device
#[tauri::command]
pub async fn disconnect_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<CommandResult<()>, String> {
    let mut manager = state.ble_manager.write();

    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(manager.disconnect(&address))
    });

    match result {
        Ok(()) => Ok(CommandResult::ok(())),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Send a mesh message to connected devices
#[tauri::command]
pub async fn send_mesh_message(
    state: State<'_, AppState>,
    address: Option<String>,
    data: Vec<u8>,
) -> Result<CommandResult<usize>, String> {
    let manager = state.ble_manager.read();

    let result = if let Some(addr) = address {
        // Send to specific device
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(manager.send_message(&addr, &data))
        })
        .map(|_| 1usize)
    } else {
        // Broadcast to all connected devices
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(manager.broadcast_mesh_message(&data))
        })
    };

    match result {
        Ok(count) => Ok(CommandResult::ok(count)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Get current BLE status
#[tauri::command]
pub async fn get_ble_status(state: State<'_, AppState>) -> Result<CommandResult<BleStatus>, String> {
    let manager = state.ble_manager.read();

    let status = BleStatus {
        is_scanning: manager.is_scanning(),
        connected_devices: vec![], // Would need to track this in manager
        discovered_count: 0,       // Would need to expose this
    };

    Ok(CommandResult::ok(status))
}
