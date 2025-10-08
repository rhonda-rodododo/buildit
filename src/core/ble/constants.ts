/**
 * BLE Mesh Constants
 *
 * Configuration for Bluetooth Low Energy mesh networking
 * Based on Samiz architecture and Web Bluetooth API specifications
 */

/**
 * BuildIt BLE Service UUID
 * Custom UUID for BuildIt Network BLE mesh service
 */
export const BUILDIT_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

/**
 * BLE Characteristic UUIDs
 */
export const BLE_CHARACTERISTICS = {
  /** Message write characteristic (client → server) */
  MESSAGE_WRITE: '12345678-1234-5678-1234-56789abcdef1',
  /** Message read characteristic (server → client) */
  MESSAGE_READ: '12345678-1234-5678-1234-56789abcdef2',
  /** Sync request characteristic (Negentropy) */
  SYNC_REQUEST: '12345678-1234-5678-1234-56789abcdef3',
  /** Sync response characteristic (Negentropy) */
  SYNC_RESPONSE: '12345678-1234-5678-1234-56789abcdef4',
  /** Device info characteristic */
  DEVICE_INFO: '12345678-1234-5678-1234-56789abcdef5',
  /** Mesh routing characteristic */
  MESH_ROUTING: '12345678-1234-5678-1234-56789abcdef6',
};

/**
 * BLE transmission limits
 */
export const BLE_LIMITS = {
  /** Maximum transmission unit for BLE (bytes) */
  MAX_MTU: 512,
  /** Chunk size after accounting for metadata (bytes) */
  CHUNK_SIZE: 500,
  /** Maximum message size before compression (bytes) */
  MAX_MESSAGE_SIZE: 100 * 1024, // 100 KB
  /** Maximum hops in mesh network */
  MAX_HOPS: 10,
  /** Default TTL for messages */
  DEFAULT_TTL: 5,
};

/**
 * BLE mesh configuration
 */
export const BLE_CONFIG = {
  /** BLE scan duration (ms) */
  SCAN_DURATION: 10000,
  /** BLE scan interval (ms) */
  SCAN_INTERVAL: 5000,
  /** Connection timeout (ms) */
  CONNECTION_TIMEOUT: 30000,
  /** Message send timeout (ms) */
  MESSAGE_TIMEOUT: 10000,
  /** Sync interval (ms) */
  SYNC_INTERVAL: 60000,
  /** Maximum connected peers */
  MAX_PEERS: 7,
  /** Reconnection delay (ms) */
  RECONNECT_DELAY: 5000,
};

/**
 * Chunk metadata format
 * [chunkIndex: 2 bytes][totalChunks: 2 bytes][isLastChunk: 1 byte][messageId: 16 bytes][data: remaining]
 */
export const CHUNK_METADATA_SIZE = 21; // 2 + 2 + 1 + 16

/**
 * Message types for BLE mesh
 */
export enum BLEMessageType {
  /** Direct message to specific peer */
  DIRECT = 0x01,
  /** Broadcast message to all peers */
  BROADCAST = 0x02,
  /** Mesh relay (multi-hop) */
  RELAY = 0x03,
  /** Sync request (Negentropy) */
  SYNC_REQUEST = 0x04,
  /** Sync response (Negentropy) */
  SYNC_RESPONSE = 0x05,
  /** Peer discovery */
  DISCOVERY = 0x06,
}

/**
 * Device role in BLE mesh
 */
export enum BLEDeviceRole {
  /** BLE peripheral (server) - advertises service */
  PERIPHERAL = 'peripheral',
  /** BLE central (client) - scans and connects */
  CENTRAL = 'central',
  /** Dual role - both peripheral and central */
  DUAL = 'dual',
}

/**
 * BLE adapter status codes
 */
export enum BLEStatusCode {
  SUCCESS = 0,
  BLUETOOTH_UNAVAILABLE = 1,
  PERMISSION_DENIED = 2,
  CONNECTION_FAILED = 3,
  SEND_FAILED = 4,
  RECEIVE_FAILED = 5,
  UNSUPPORTED_BROWSER = 6,
}

/**
 * BLE error messages
 */
export const BLE_ERRORS = {
  [BLEStatusCode.BLUETOOTH_UNAVAILABLE]: 'Bluetooth is not available on this device',
  [BLEStatusCode.PERMISSION_DENIED]: 'Bluetooth permission denied',
  [BLEStatusCode.CONNECTION_FAILED]: 'Failed to connect to BLE device',
  [BLEStatusCode.SEND_FAILED]: 'Failed to send message via BLE',
  [BLEStatusCode.RECEIVE_FAILED]: 'Failed to receive message via BLE',
  [BLEStatusCode.UNSUPPORTED_BROWSER]: 'Web Bluetooth API is not supported in this browser',
};
