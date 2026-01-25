//! BLE (Bluetooth Low Energy) module for BuildIt Network mesh networking
//!
//! This module provides:
//! - Device discovery and scanning
//! - Connection management
//! - GATT read/write operations
//! - Mesh message routing
//! - Message chunking and reassembly

pub mod chunk;
pub mod manager;
pub mod mesh;

pub use chunk::{chunk_message, reassemble_chunks, Chunk, ChunkBuffer, ChunkError};
pub use manager::BleManager;
pub use mesh::{MeshMessage, MeshNode};
