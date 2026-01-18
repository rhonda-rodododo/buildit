/**
 * Message Compression Utilities
 *
 * Handles compression and chunking of messages for BLE transmission
 * BLE MTU limit: 512 bytes per transmission
 */

import pako from 'pako';
import { BLE_LIMITS, CHUNK_METADATA_SIZE } from './constants';

/**
 * Message chunk structure
 */
export interface MessageChunk {
  /** Chunk index (0-based) */
  index: number;
  /** Total number of chunks */
  total: number;
  /** Is this the last chunk? */
  isLast: boolean;
  /** Message ID (for reassembly) */
  messageId: string;
  /** Chunk data */
  data: Uint8Array;
}

/**
 * Compress a message using gzip (pako)
 */
export function compressMessage(message: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Only compress if beneficial (data > 100 bytes)
  if (data.length < 100) {
    return data;
  }

  try {
    return pako.deflate(data);
  } catch (error) {
    console.error('[BLE Compression] Failed to compress message:', error);
    return data; // Return uncompressed on error
  }
}

/**
 * Decompress a message using gunzip (pako)
 */
export function decompressMessage(data: Uint8Array): string {
  const decoder = new TextDecoder();

  try {
    const decompressed = pako.inflate(data);
    return decoder.decode(decompressed);
  } catch {
    // Not compressed, return as-is
    return decoder.decode(data);
  }
}

/**
 * Split compressed data into BLE-sized chunks
 */
export function chunkMessage(
  data: Uint8Array,
  messageId: string
): MessageChunk[] {
  const maxChunkDataSize = BLE_LIMITS.CHUNK_SIZE - CHUNK_METADATA_SIZE;
  const totalChunks = Math.ceil(data.length / maxChunkDataSize);

  const chunks: MessageChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxChunkDataSize;
    const end = Math.min(start + maxChunkDataSize, data.length);
    const chunkData = data.slice(start, end);

    chunks.push({
      index: i,
      total: totalChunks,
      isLast: i === totalChunks - 1,
      messageId,
      data: chunkData,
    });
  }

  return chunks;
}

/**
 * Serialize a message chunk to BLE transmission format
 * Format: [chunkIndex: 2][totalChunks: 2][isLastChunk: 1][messageId: 16][data: remaining]
 */
export function serializeChunk(chunk: MessageChunk): Uint8Array {
  const messageIdBytes = stringToBytes(chunk.messageId, 16);
  const buffer = new Uint8Array(CHUNK_METADATA_SIZE + chunk.data.length);

  // Write chunk index (2 bytes)
  buffer[0] = chunk.index >> 8;
  buffer[1] = chunk.index & 0xff;

  // Write total chunks (2 bytes)
  buffer[2] = chunk.total >> 8;
  buffer[3] = chunk.total & 0xff;

  // Write isLast flag (1 byte)
  buffer[4] = chunk.isLast ? 1 : 0;

  // Write message ID (16 bytes)
  buffer.set(messageIdBytes, 5);

  // Write chunk data
  buffer.set(chunk.data, CHUNK_METADATA_SIZE);

  return buffer;
}

/**
 * Deserialize a BLE transmission to message chunk
 */
export function deserializeChunk(buffer: Uint8Array): MessageChunk {
  // Read chunk index (2 bytes)
  const index = (buffer[0] << 8) | buffer[1];

  // Read total chunks (2 bytes)
  const total = (buffer[2] << 8) | buffer[3];

  // Read isLast flag (1 byte)
  const isLast = buffer[4] === 1;

  // Read message ID (16 bytes)
  const messageIdBytes = buffer.slice(5, 21);
  const messageId = bytesToString(messageIdBytes);

  // Read chunk data
  const data = buffer.slice(CHUNK_METADATA_SIZE);

  return {
    index,
    total,
    isLast,
    messageId,
    data,
  };
}

/**
 * Message reassembly manager
 * Handles reassembling chunked messages received over BLE
 */
export class MessageReassembler {
  private pendingMessages = new Map<string, {
    chunks: Map<number, Uint8Array>;
    totalChunks: number;
    createdAt: number;
  }>();

  /** Maximum time to wait for missing chunks (30 seconds) */
  private readonly MAX_PENDING_TIME = 30000;

  /**
   * Add a chunk to the reassembly buffer
   * Returns complete message when all chunks received, null otherwise
   */
  addChunk(chunk: MessageChunk): Uint8Array | null {
    const { messageId, index, total, data } = chunk;

    // Create pending message entry if doesn't exist
    if (!this.pendingMessages.has(messageId)) {
      this.pendingMessages.set(messageId, {
        chunks: new Map(),
        totalChunks: total,
        createdAt: Date.now(),
      });
    }

    const pending = this.pendingMessages.get(messageId)!;

    // Store chunk
    pending.chunks.set(index, data);

    // Check if all chunks received
    if (pending.chunks.size === pending.totalChunks) {
      // Reassemble message
      const reassembled = this.reassembleMessage(messageId);
      this.pendingMessages.delete(messageId);
      return reassembled;
    }

    return null;
  }

  /**
   * Reassemble complete message from chunks
   */
  private reassembleMessage(messageId: string): Uint8Array {
    const pending = this.pendingMessages.get(messageId);
    if (!pending) {
      throw new Error(`No pending message with ID: ${messageId}`);
    }

    // Calculate total size
    let totalSize = 0;
    for (const chunk of pending.chunks.values()) {
      totalSize += chunk.length;
    }

    // Allocate buffer
    const reassembled = new Uint8Array(totalSize);

    // Copy chunks in order
    let offset = 0;
    for (let i = 0; i < pending.totalChunks; i++) {
      const chunk = pending.chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i} for message ${messageId}`);
      }
      reassembled.set(chunk, offset);
      offset += chunk.length;
    }

    return reassembled;
  }

  /**
   * Clean up old pending messages
   */
  cleanup(): void {
    const now = Date.now();
    for (const [messageId, pending] of this.pendingMessages.entries()) {
      if (now - pending.createdAt > this.MAX_PENDING_TIME) {
        console.warn(`[MessageReassembler] Removing stale message ${messageId}`);
        this.pendingMessages.delete(messageId);
      }
    }
  }

  /**
   * Clear all pending messages
   */
  clear(): void {
    this.pendingMessages.clear();
  }
}

/**
 * Convert string to fixed-size byte array
 */
function stringToBytes(str: string, size: number): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = new Uint8Array(size);
  const encoded = encoder.encode(str.slice(0, size));
  bytes.set(encoded);
  return bytes;
}

/**
 * Convert byte array to string (trim null bytes)
 */
function bytesToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  // Find first null byte
  let end = bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      end = i;
      break;
    }
  }
  return decoder.decode(bytes.slice(0, end));
}
