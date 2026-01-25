//! BLE (Bluetooth Low Energy) module for BuildIt Network mesh networking
//!
//! This module provides:
//! - Device discovery and scanning
//! - Connection management
//! - GATT read/write operations
//! - Mesh message routing

pub mod manager;
pub mod mesh;

pub use manager::BleManager;
pub use mesh::{MeshMessage, MeshNode};
