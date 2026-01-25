//! Integration tests for BLE chunking functionality

use buildit_network_desktop::ble::chunk::{
    chunk_message, reassemble_chunks, Chunk, ChunkBuffer, ChunkError, ChunkHeader,
    CHUNK_HEADER_SIZE, MAX_CHUNK_PAYLOAD,
};
use uuid::Uuid;

#[test]
fn test_chunk_header_roundtrip() {
    let header = ChunkHeader {
        message_id: Uuid::new_v4(),
        chunk_index: 0,
        total_chunks: 5,
        payload_length: 256,
        compressed: false,
    };

    let bytes = header.to_bytes();
    assert_eq!(bytes.len(), CHUNK_HEADER_SIZE);

    let parsed = ChunkHeader::from_bytes(&bytes).unwrap();
    assert_eq!(parsed.message_id, header.message_id);
    assert_eq!(parsed.chunk_index, header.chunk_index);
    assert_eq!(parsed.total_chunks, header.total_chunks);
    assert_eq!(parsed.payload_length, header.payload_length);
    assert_eq!(parsed.compressed, header.compressed);
}

#[test]
fn test_small_message_single_chunk() {
    let message = b"Hello, BuildIt Network!";
    let chunks = chunk_message(message).unwrap();

    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].header.chunk_index, 0);
    assert_eq!(chunks[0].header.total_chunks, 1);
    assert!(!chunks[0].header.compressed);

    let reassembled = reassemble_chunks(&chunks).unwrap();
    assert_eq!(reassembled, message);
}

#[test]
fn test_large_message_multiple_chunks() {
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD * 3 + 100];
    let chunks = chunk_message(&message).unwrap();

    assert_eq!(chunks.len(), 4);

    for (i, chunk) in chunks.iter().enumerate() {
        assert_eq!(chunk.header.chunk_index, i as u8);
        assert_eq!(chunk.header.total_chunks, 4);
        assert_eq!(chunk.header.message_id, chunks[0].header.message_id);
    }

    let reassembled = reassemble_chunks(&chunks).unwrap();
    assert_eq!(reassembled, message);
}

#[test]
fn test_compression_for_large_compressible_data() {
    // Highly compressible data (repeated pattern)
    let message = vec![0x41u8; 1000];
    let chunks = chunk_message(&message).unwrap();

    // Should use compression
    assert!(chunks[0].header.compressed);

    // Reassemble and verify
    let reassembled = reassemble_chunks(&chunks).unwrap();
    assert_eq!(reassembled, message);
}

#[test]
fn test_chunk_buffer_in_order() {
    let mut buffer = ChunkBuffer::new(60000);
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD * 2 + 50];
    let chunks = chunk_message(&message).unwrap();

    // Add chunks in order
    for chunk in &chunks[..chunks.len() - 1] {
        let result = buffer.add_chunk(chunk.clone()).unwrap();
        assert!(result.is_none()); // Not complete yet
    }

    // Add last chunk
    let result = buffer.add_chunk(chunks[chunks.len() - 1].clone()).unwrap();
    assert!(result.is_some());
    assert_eq!(result.unwrap(), message);
}

#[test]
fn test_chunk_buffer_out_of_order() {
    let mut buffer = ChunkBuffer::new(60000);
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD * 3];
    let chunks = chunk_message(&message).unwrap();

    // Add chunks in reverse order
    for chunk in chunks.iter().rev() {
        let result = buffer.add_chunk(chunk.clone()).unwrap();

        if chunk.header.chunk_index == 0 {
            // Last chunk added should complete the message
            assert!(result.is_some());
            assert_eq!(result.unwrap(), message);
        } else {
            assert!(result.is_none());
        }
    }
}

#[test]
fn test_chunk_serialization() {
    let message = b"Test message for chunking";
    let chunks = chunk_message(message).unwrap();

    for chunk in &chunks {
        let bytes = chunk.to_bytes();

        // Verify total length
        assert_eq!(
            bytes.len(),
            CHUNK_HEADER_SIZE + chunk.header.payload_length as usize
        );

        // Deserialize and verify
        let parsed = Chunk::from_bytes(&bytes).unwrap();
        assert_eq!(parsed.header.message_id, chunk.header.message_id);
        assert_eq!(parsed.header.chunk_index, chunk.header.chunk_index);
        assert_eq!(parsed.payload, chunk.payload);
    }
}

#[test]
fn test_invalid_chunk_index() {
    let header = ChunkHeader {
        message_id: Uuid::new_v4(),
        chunk_index: 5,
        total_chunks: 3, // Invalid: index >= total
        payload_length: 100,
        compressed: false,
    };

    let bytes = header.to_bytes();
    let result = ChunkHeader::from_bytes(&bytes);

    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ChunkError::InvalidChunkIndex(5, 3)));
}

#[test]
fn test_message_id_mismatch() {
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD * 2];
    let mut chunks = chunk_message(&message).unwrap();

    // Change message ID of second chunk
    chunks[1].header.message_id = Uuid::new_v4();

    let result = reassemble_chunks(&chunks);
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ChunkError::MessageIdMismatch));
}

#[test]
fn test_unicode_message_chunking() {
    let message = "Hello 世界! 🌍 This is a test message with unicode characters.";
    let chunks = chunk_message(message.as_bytes()).unwrap();

    let reassembled = reassemble_chunks(&chunks).unwrap();
    let reassembled_str = String::from_utf8(reassembled).unwrap();

    assert_eq!(reassembled_str, message);
}

#[test]
fn test_empty_message() {
    let message = b"";
    let result = chunk_message(message);

    // Empty messages should still work
    assert!(result.is_ok());
}

#[test]
fn test_exact_mtu_boundary() {
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD];
    let chunks = chunk_message(&message).unwrap();

    assert_eq!(chunks.len(), 1);

    let reassembled = reassemble_chunks(&chunks).unwrap();
    assert_eq!(reassembled, message);
}

#[test]
fn test_just_over_mtu_boundary() {
    let message = vec![0x42u8; MAX_CHUNK_PAYLOAD + 1];
    let chunks = chunk_message(&message).unwrap();

    assert_eq!(chunks.len(), 2);

    let reassembled = reassemble_chunks(&chunks).unwrap();
    assert_eq!(reassembled, message);
}
