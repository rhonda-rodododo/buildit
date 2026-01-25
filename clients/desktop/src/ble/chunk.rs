//! BLE message chunking and reassembly
//!
//! Messages larger than MTU need to be split into chunks for transmission.
//! This module handles chunking, reassembly, and compression.

use flate2::read::{DeflateDecoder, DeflateEncoder};
use flate2::Compression;
use std::collections::HashMap;
use std::io::Read;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

/// Maximum BLE MTU (conservative estimate)
pub const MAX_MTU: usize = 512;

/// Chunk header size (21 bytes)
pub const CHUNK_HEADER_SIZE: usize = 21;

/// Maximum payload per chunk
pub const MAX_CHUNK_PAYLOAD: usize = MAX_MTU - CHUNK_HEADER_SIZE;

/// Minimum message size for compression (100 bytes)
pub const COMPRESSION_THRESHOLD: usize = 100;

/// Chunk errors
#[derive(Debug, Error)]
pub enum ChunkError {
    #[error("Message too large: {0} bytes")]
    MessageTooLarge(usize),

    #[error("Invalid chunk header")]
    InvalidHeader,

    #[error("Chunk index out of bounds: {0}/{1}")]
    InvalidChunkIndex(u8, u8),

    #[error("Compression failed: {0}")]
    CompressionFailed(String),

    #[error("Decompression failed: {0}")]
    DecompressionFailed(String),

    #[error("Message ID mismatch")]
    MessageIdMismatch,

    #[error("Incomplete message")]
    IncompleteMessage,
}

/// Chunk header format (21 bytes):
/// - Message ID: 16 bytes (UUID)
/// - Chunk index: 1 byte (0-255)
/// - Total chunks: 1 byte (1-256)
/// - Payload length: 2 bytes (big-endian)
/// - Flags: 1 byte (bit 0: compressed)
#[derive(Debug, Clone)]
pub struct ChunkHeader {
    pub message_id: Uuid,
    pub chunk_index: u8,
    pub total_chunks: u8,
    pub payload_length: u16,
    pub compressed: bool,
}

impl ChunkHeader {
    /// Serialize header to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(CHUNK_HEADER_SIZE);

        // Message ID (16 bytes)
        bytes.extend_from_slice(self.message_id.as_bytes());

        // Chunk index (1 byte)
        bytes.push(self.chunk_index);

        // Total chunks (1 byte)
        bytes.push(self.total_chunks);

        // Payload length (2 bytes, big-endian)
        bytes.push(((self.payload_length >> 8) & 0xff) as u8);
        bytes.push((self.payload_length & 0xff) as u8);

        // Flags (1 byte)
        let flags = if self.compressed { 0x01 } else { 0x00 };
        bytes.push(flags);

        bytes
    }

    /// Deserialize header from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ChunkError> {
        if bytes.len() < CHUNK_HEADER_SIZE {
            return Err(ChunkError::InvalidHeader);
        }

        // Parse message ID
        let message_id = Uuid::from_slice(&bytes[0..16])
            .map_err(|_| ChunkError::InvalidHeader)?;

        // Parse chunk index
        let chunk_index = bytes[16];

        // Parse total chunks
        let total_chunks = bytes[17];

        // Parse payload length
        let payload_length = ((bytes[18] as u16) << 8) | (bytes[19] as u16);

        // Parse flags
        let compressed = (bytes[20] & 0x01) != 0;

        // Validate
        if chunk_index >= total_chunks {
            return Err(ChunkError::InvalidChunkIndex(chunk_index, total_chunks));
        }

        Ok(Self {
            message_id,
            chunk_index,
            total_chunks,
            payload_length,
            compressed,
        })
    }
}

/// A single chunk
#[derive(Debug, Clone)]
pub struct Chunk {
    pub header: ChunkHeader,
    pub payload: Vec<u8>,
}

impl Chunk {
    /// Serialize chunk to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = self.header.to_bytes();
        bytes.extend_from_slice(&self.payload);
        bytes
    }

    /// Deserialize chunk from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ChunkError> {
        if bytes.len() < CHUNK_HEADER_SIZE {
            return Err(ChunkError::InvalidHeader);
        }

        let header = ChunkHeader::from_bytes(&bytes[0..CHUNK_HEADER_SIZE])?;
        let payload = bytes[CHUNK_HEADER_SIZE..].to_vec();

        // Verify payload length matches header
        if payload.len() != header.payload_length as usize {
            return Err(ChunkError::InvalidHeader);
        }

        Ok(Self { header, payload })
    }
}

/// Split a message into chunks
pub fn chunk_message(data: &[u8]) -> Result<Vec<Chunk>, ChunkError> {
    // Check if compression would be beneficial
    let (to_chunk, compressed) = if data.len() >= COMPRESSION_THRESHOLD {
        match compress(data) {
            Ok(compressed_data) if compressed_data.len() < data.len() => {
                (compressed_data, true)
            }
            _ => (data.to_vec(), false),
        }
    } else {
        (data.to_vec(), false)
    };

    // Calculate number of chunks needed
    let total_chunks = ((to_chunk.len() + MAX_CHUNK_PAYLOAD - 1) / MAX_CHUNK_PAYLOAD) as u8;

    if total_chunks == 0 || total_chunks > 255 {
        return Err(ChunkError::MessageTooLarge(data.len()));
    }

    // Generate message ID
    let message_id = Uuid::new_v4();

    // Create chunks
    let mut chunks = Vec::new();
    for chunk_index in 0..total_chunks {
        let start = (chunk_index as usize) * MAX_CHUNK_PAYLOAD;
        let end = std::cmp::min(start + MAX_CHUNK_PAYLOAD, to_chunk.len());
        let payload = to_chunk[start..end].to_vec();

        let header = ChunkHeader {
            message_id,
            chunk_index,
            total_chunks,
            payload_length: payload.len() as u16,
            compressed,
        };

        chunks.push(Chunk { header, payload });
    }

    Ok(chunks)
}

/// Reassemble chunks into original message
pub fn reassemble_chunks(chunks: &[Chunk]) -> Result<Vec<u8>, ChunkError> {
    if chunks.is_empty() {
        return Err(ChunkError::IncompleteMessage);
    }

    // Verify all chunks have the same message ID
    let message_id = chunks[0].header.message_id;
    let total_chunks = chunks[0].header.total_chunks;
    let compressed = chunks[0].header.compressed;

    for chunk in chunks {
        if chunk.header.message_id != message_id {
            return Err(ChunkError::MessageIdMismatch);
        }
        if chunk.header.total_chunks != total_chunks {
            return Err(ChunkError::InvalidHeader);
        }
    }

    // Verify we have all chunks
    if chunks.len() != total_chunks as usize {
        return Err(ChunkError::IncompleteMessage);
    }

    // Sort chunks by index
    let mut sorted_chunks = chunks.to_vec();
    sorted_chunks.sort_by_key(|c| c.header.chunk_index);

    // Reassemble payload
    let mut data = Vec::new();
    for (i, chunk) in sorted_chunks.iter().enumerate() {
        if chunk.header.chunk_index != i as u8 {
            return Err(ChunkError::InvalidChunkIndex(chunk.header.chunk_index, total_chunks));
        }
        data.extend_from_slice(&chunk.payload);
    }

    // Decompress if needed
    if compressed {
        decompress(&data)
    } else {
        Ok(data)
    }
}

/// Compress data using DEFLATE
fn compress(data: &[u8]) -> Result<Vec<u8>, ChunkError> {
    let mut encoder = DeflateEncoder::new(data, Compression::best());
    let mut compressed = Vec::new();
    encoder
        .read_to_end(&mut compressed)
        .map_err(|e| ChunkError::CompressionFailed(e.to_string()))?;
    Ok(compressed)
}

/// Decompress data using DEFLATE
fn decompress(data: &[u8]) -> Result<Vec<u8>, ChunkError> {
    let mut decoder = DeflateDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| ChunkError::DecompressionFailed(e.to_string()))?;
    Ok(decompressed)
}

/// Chunk reassembly buffer
pub struct ChunkBuffer {
    /// Buffered chunks by message ID
    buffers: HashMap<Uuid, Vec<Option<Chunk>>>,
    /// Message receive timestamps
    timestamps: HashMap<Uuid, u64>,
    /// Maximum age for incomplete messages (milliseconds)
    max_age_ms: u64,
}

impl ChunkBuffer {
    /// Create a new chunk buffer
    pub fn new(max_age_ms: u64) -> Self {
        Self {
            buffers: HashMap::new(),
            timestamps: HashMap::new(),
            max_age_ms,
        }
    }

    /// Add a chunk to the buffer
    ///
    /// Returns Some(message) if all chunks received, None otherwise
    pub fn add_chunk(&mut self, chunk: Chunk) -> Result<Option<Vec<u8>>, ChunkError> {
        let message_id = chunk.header.message_id;
        let total_chunks = chunk.header.total_chunks as usize;
        let chunk_index = chunk.header.chunk_index as usize;

        // Initialize buffer for this message if needed
        if !self.buffers.contains_key(&message_id) {
            self.buffers.insert(message_id, vec![None; total_chunks]);
            self.timestamps.insert(message_id, Self::current_time_ms());
        }

        // Get buffer
        let buffer = self.buffers.get_mut(&message_id).unwrap();

        // Verify chunk index is valid
        if chunk_index >= buffer.len() {
            return Err(ChunkError::InvalidChunkIndex(
                chunk_index as u8,
                total_chunks as u8,
            ));
        }

        // Store chunk
        buffer[chunk_index] = Some(chunk);

        // Check if all chunks received
        if buffer.iter().all(|c| c.is_some()) {
            // Extract chunks
            let chunks: Vec<Chunk> = buffer.iter().filter_map(|c| c.clone()).collect();

            // Remove from buffer
            self.buffers.remove(&message_id);
            self.timestamps.remove(&message_id);

            // Reassemble
            reassemble_chunks(&chunks).map(Some)
        } else {
            Ok(None)
        }
    }

    /// Clean up old incomplete messages
    pub fn cleanup(&mut self) {
        let now = Self::current_time_ms();
        let max_age = self.max_age_ms;

        self.timestamps.retain(|message_id, timestamp| {
            if now - *timestamp > max_age {
                self.buffers.remove(message_id);
                false
            } else {
                true
            }
        });
    }

    /// Get current time in milliseconds
    fn current_time_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_header_serialization() {
        let header = ChunkHeader {
            message_id: Uuid::new_v4(),
            chunk_index: 5,
            total_chunks: 10,
            payload_length: 256,
            compressed: true,
        };

        let bytes = header.to_bytes();
        assert_eq!(bytes.len(), CHUNK_HEADER_SIZE);

        let deserialized = ChunkHeader::from_bytes(&bytes).unwrap();
        assert_eq!(deserialized.message_id, header.message_id);
        assert_eq!(deserialized.chunk_index, header.chunk_index);
        assert_eq!(deserialized.total_chunks, header.total_chunks);
        assert_eq!(deserialized.payload_length, header.payload_length);
        assert_eq!(deserialized.compressed, header.compressed);
    }

    #[test]
    fn test_small_message_chunking() {
        let data = b"Hello, World!";
        let chunks = chunk_message(data).unwrap();

        assert_eq!(chunks.len(), 1);
        assert!(!chunks[0].header.compressed);

        let reassembled = reassemble_chunks(&chunks).unwrap();
        assert_eq!(reassembled, data);
    }

    #[test]
    fn test_large_message_chunking() {
        let data = vec![0x42u8; 2000]; // 2KB message
        let chunks = chunk_message(&data).unwrap();

        assert!(chunks.len() > 1);

        let reassembled = reassemble_chunks(&chunks).unwrap();
        assert_eq!(reassembled, data);
    }

    #[test]
    fn test_compression() {
        let data = vec![0x41u8; 500]; // Highly compressible data
        let chunks = chunk_message(&data).unwrap();

        // Should be compressed
        assert!(chunks[0].header.compressed);

        let reassembled = reassemble_chunks(&chunks).unwrap();
        assert_eq!(reassembled, data);
    }

    #[test]
    fn test_chunk_buffer() {
        let mut buffer = ChunkBuffer::new(60000);

        let data = vec![0x42u8; 2000];
        let chunks = chunk_message(&data).unwrap();

        // Add chunks in reverse order
        for chunk in chunks.iter().rev() {
            let result = buffer.add_chunk(chunk.clone()).unwrap();
            if chunk.header.chunk_index == 0 {
                // Last chunk added should complete the message
                assert_eq!(result.unwrap(), data);
            } else {
                assert!(result.is_none());
            }
        }
    }
}
