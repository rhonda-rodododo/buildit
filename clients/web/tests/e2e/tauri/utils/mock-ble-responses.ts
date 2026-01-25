/**
 * Mock BLE Device Responses for E2E Testing
 *
 * Provides realistic mock data for BLE device simulation during tests.
 * Includes BuildIt mesh network devices and generic BLE peripherals.
 */

import type { DiscoveredDevice, BleStatus } from './tauri-mocks';

// ============================================================================
// Mock Device Definitions
// ============================================================================

/**
 * BuildIt mesh network device - Primary node
 */
export const BUILDIT_NODE_PRIMARY: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:01',
  name: 'BuildIt-Node-001',
  rssi: -45,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * BuildIt mesh network device - Secondary node
 */
export const BUILDIT_NODE_SECONDARY: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:02',
  name: 'BuildIt-Node-002',
  rssi: -55,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * BuildIt mesh network device - Relay node (farther away)
 */
export const BUILDIT_NODE_RELAY: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:03',
  name: 'BuildIt-Relay-003',
  rssi: -75,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * BuildIt mesh network device - Edge node (weak signal)
 */
export const BUILDIT_NODE_EDGE: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:04',
  name: 'BuildIt-Edge-004',
  rssi: -85,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * Generic BLE device (headphones)
 */
export const GENERIC_HEADPHONES: DiscoveredDevice = {
  address: '11:22:33:44:55:66',
  name: 'WH-1000XM4',
  rssi: -50,
  is_buildit_device: false,
  last_seen: Date.now(),
};

/**
 * Generic BLE device (fitness tracker)
 */
export const GENERIC_FITNESS_TRACKER: DiscoveredDevice = {
  address: '22:33:44:55:66:77',
  name: 'Mi Band 6',
  rssi: -60,
  is_buildit_device: false,
  last_seen: Date.now(),
};

/**
 * Unnamed BLE device (common for some peripherals)
 */
export const UNNAMED_DEVICE: DiscoveredDevice = {
  address: '77:88:99:AA:BB:CC',
  name: null,
  rssi: -80,
  is_buildit_device: false,
  last_seen: Date.now(),
};

/**
 * Device with very weak signal (edge of range)
 */
export const WEAK_SIGNAL_DEVICE: DiscoveredDevice = {
  address: '88:99:AA:BB:CC:DD',
  name: 'BuildIt-Far-005',
  rssi: -95,
  is_buildit_device: true,
  last_seen: Date.now(),
};

// ============================================================================
// Device Collections
// ============================================================================

/**
 * All BuildIt mesh network devices
 */
export const BUILDIT_DEVICES: DiscoveredDevice[] = [
  BUILDIT_NODE_PRIMARY,
  BUILDIT_NODE_SECONDARY,
  BUILDIT_NODE_RELAY,
  BUILDIT_NODE_EDGE,
  WEAK_SIGNAL_DEVICE,
];

/**
 * All generic (non-BuildIt) devices
 */
export const GENERIC_DEVICES: DiscoveredDevice[] = [
  GENERIC_HEADPHONES,
  GENERIC_FITNESS_TRACKER,
  UNNAMED_DEVICE,
];

/**
 * All devices (for full scan simulation)
 */
export const ALL_DEVICES: DiscoveredDevice[] = [
  ...BUILDIT_DEVICES,
  ...GENERIC_DEVICES,
];

/**
 * Devices with strong signal (good for connection tests)
 */
export const STRONG_SIGNAL_DEVICES: DiscoveredDevice[] = ALL_DEVICES.filter(
  (d) => d.rssi !== null && d.rssi > -70
);

/**
 * Only BuildIt devices with strong signal
 */
export const CONNECTABLE_BUILDIT_DEVICES: DiscoveredDevice[] = BUILDIT_DEVICES.filter(
  (d) => d.rssi !== null && d.rssi > -80
);

// ============================================================================
// Scan Simulation Scenarios
// ============================================================================

/**
 * Simulates gradual device discovery during a scan
 * Returns arrays of devices to be "discovered" at each step
 */
export const GRADUAL_DISCOVERY_SCENARIO: DiscoveredDevice[][] = [
  // Step 1: Closest devices found first
  [BUILDIT_NODE_PRIMARY, GENERIC_HEADPHONES],
  // Step 2: More devices appear
  [BUILDIT_NODE_SECONDARY, GENERIC_FITNESS_TRACKER],
  // Step 3: Farther devices discovered
  [BUILDIT_NODE_RELAY, UNNAMED_DEVICE],
  // Step 4: Edge devices
  [BUILDIT_NODE_EDGE, WEAK_SIGNAL_DEVICE],
];

/**
 * Simulates devices going in and out of range
 */
export const FLUCTUATING_DEVICES_SCENARIO = {
  initial: [BUILDIT_NODE_PRIMARY, BUILDIT_NODE_SECONDARY],
  deviceLost: BUILDIT_NODE_SECONDARY,
  deviceReturned: { ...BUILDIT_NODE_SECONDARY, rssi: -65 }, // Weaker signal
  newDevice: BUILDIT_NODE_RELAY,
};

/**
 * Empty scan result (no devices in range)
 */
export const EMPTY_SCAN_SCENARIO: DiscoveredDevice[] = [];

/**
 * Crowded environment (many devices)
 */
export const CROWDED_SCAN_SCENARIO: DiscoveredDevice[] = [
  ...ALL_DEVICES,
  // Add more fake generic devices
  {
    address: 'CC:DD:EE:FF:00:11',
    name: 'AirPods Pro',
    rssi: -55,
    is_buildit_device: false,
    last_seen: Date.now(),
  },
  {
    address: 'DD:EE:FF:00:11:22',
    name: 'Galaxy Buds',
    rssi: -58,
    is_buildit_device: false,
    last_seen: Date.now(),
  },
  {
    address: 'EE:FF:00:11:22:33',
    name: null,
    rssi: -70,
    is_buildit_device: false,
    last_seen: Date.now(),
  },
];

// ============================================================================
// BLE Status Responses
// ============================================================================

/**
 * Initial status (not scanning, no connections)
 */
export const INITIAL_BLE_STATUS: BleStatus = {
  is_scanning: false,
  connected_devices: [],
  discovered_count: 0,
};

/**
 * Actively scanning status
 */
export const SCANNING_BLE_STATUS: BleStatus = {
  is_scanning: true,
  connected_devices: [],
  discovered_count: 0,
};

/**
 * Scanning with devices found
 */
export const SCANNING_WITH_DEVICES_STATUS: BleStatus = {
  is_scanning: true,
  connected_devices: [],
  discovered_count: ALL_DEVICES.length,
};

/**
 * Connected to one device
 */
export const CONNECTED_ONE_DEVICE_STATUS: BleStatus = {
  is_scanning: false,
  connected_devices: [BUILDIT_NODE_PRIMARY.address],
  discovered_count: ALL_DEVICES.length,
};

/**
 * Connected to multiple devices (mesh network active)
 */
export const MESH_NETWORK_ACTIVE_STATUS: BleStatus = {
  is_scanning: false,
  connected_devices: [
    BUILDIT_NODE_PRIMARY.address,
    BUILDIT_NODE_SECONDARY.address,
    BUILDIT_NODE_RELAY.address,
  ],
  discovered_count: ALL_DEVICES.length,
};

// ============================================================================
// Mesh Message Payloads
// ============================================================================

/**
 * Simple text message payload
 */
export const TEXT_MESSAGE_PAYLOAD = {
  text: 'Hello, mesh network!',
  bytes: Array.from(new TextEncoder().encode('Hello, mesh network!')),
};

/**
 * Encrypted message payload (simulated NIP-44 ciphertext)
 */
export const ENCRYPTED_MESSAGE_PAYLOAD = {
  bytes: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a],
  description: 'Encrypted NIP-44 payload',
};

/**
 * Mesh routing header
 * Format: "BN" magic bytes + TTL + hop count
 */
export const MESH_HEADER = {
  bytes: [0x42, 0x4e, 0x03, 0x00], // "BN" + TTL=3 + hops=0
  magic: 'BN',
  ttl: 3,
  hopCount: 0,
};

/**
 * Full mesh message with header and payload
 */
export const FULL_MESH_MESSAGE = {
  header: MESH_HEADER.bytes,
  payload: TEXT_MESSAGE_PAYLOAD.bytes,
  combined: [...MESH_HEADER.bytes, ...TEXT_MESSAGE_PAYLOAD.bytes],
};

/**
 * Ping message for connection testing
 */
export const PING_MESSAGE = {
  bytes: [0x50, 0x49, 0x4e, 0x47], // "PING"
};

/**
 * Pong response
 */
export const PONG_MESSAGE = {
  bytes: [0x50, 0x4f, 0x4e, 0x47], // "PONG"
};

/**
 * Heartbeat message for keep-alive
 */
export const HEARTBEAT_MESSAGE = {
  bytes: [0x48, 0x42], // "HB"
};

// ============================================================================
// Error Scenarios
// ============================================================================

/**
 * Connection error responses
 */
export const CONNECTION_ERRORS = {
  deviceNotFound: 'Device not found: XX:XX:XX:XX:XX:XX',
  connectionTimeout: 'Connection timeout after 10 seconds',
  deviceRejected: 'Device rejected connection',
  alreadyConnected: 'Already connected to device',
  bluetoothDisabled: 'Bluetooth is disabled',
  permissionDenied: 'Bluetooth permission denied',
  deviceOutOfRange: 'Device out of range',
} as const;

/**
 * Scan error responses
 */
export const SCAN_ERRORS = {
  alreadyScanning: 'Scan already in progress',
  bluetoothDisabled: 'Bluetooth is disabled',
  permissionDenied: 'Bluetooth scan permission denied',
  hardwareError: 'BLE hardware error',
} as const;

/**
 * Message send error responses
 */
export const MESSAGE_ERRORS = {
  notConnected: 'Not connected to device',
  messageTooBig: 'Message exceeds maximum size (512 bytes)',
  sendTimeout: 'Message send timeout',
  deviceDisconnected: 'Device disconnected during send',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock device with custom properties
 */
export function createMockDevice(
  overrides: Partial<DiscoveredDevice>
): DiscoveredDevice {
  return {
    address: 'XX:XX:XX:XX:XX:XX',
    name: 'Mock Device',
    rssi: -60,
    is_buildit_device: false,
    last_seen: Date.now(),
    ...overrides,
  };
}

/**
 * Create multiple mock BuildIt devices
 */
export function createMockBuilditNodes(count: number): DiscoveredDevice[] {
  return Array.from({ length: count }, (_, i) => ({
    address: `AA:BB:CC:DD:EE:${(i + 1).toString(16).padStart(2, '0').toUpperCase()}`,
    name: `BuildIt-Node-${(i + 1).toString().padStart(3, '0')}`,
    rssi: -45 - i * 5, // Each device slightly farther
    is_buildit_device: true,
    last_seen: Date.now(),
  }));
}

/**
 * Simulate device RSSI fluctuation
 */
export function fluctuateRssi(device: DiscoveredDevice, variance: number = 5): DiscoveredDevice {
  if (device.rssi === null) return device;

  const fluctuation = Math.floor(Math.random() * variance * 2) - variance;
  return {
    ...device,
    rssi: device.rssi + fluctuation,
    last_seen: Date.now(),
  };
}

/**
 * Create a mesh message with custom content
 */
export function createMeshMessage(content: string, ttl: number = 3): number[] {
  const contentBytes = Array.from(new TextEncoder().encode(content));
  return [
    0x42, 0x4e, // "BN" magic
    ttl,
    0x00, // hop count
    ...contentBytes,
  ];
}

/**
 * Parse a mesh message
 */
export function parseMeshMessage(bytes: number[]): {
  valid: boolean;
  ttl?: number;
  hopCount?: number;
  payload?: string;
} {
  if (bytes.length < 4) return { valid: false };
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4e) return { valid: false };

  return {
    valid: true,
    ttl: bytes[2],
    hopCount: bytes[3],
    payload: new TextDecoder().decode(new Uint8Array(bytes.slice(4))),
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type ConnectionError = keyof typeof CONNECTION_ERRORS;
export type ScanError = keyof typeof SCAN_ERRORS;
export type MessageError = keyof typeof MESSAGE_ERRORS;
