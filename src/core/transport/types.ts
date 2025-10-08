/**
 * Transport Layer Abstraction
 *
 * BuildIt Network uses a transport-agnostic architecture where BLE mesh is the PRIMARY
 * networking layer, with Nostr relays as secondary (internet-based) fallback.
 *
 * Transport Priority Order:
 * 1. BLE Mesh (offline-first, local)
 * 2. Nostr Relays (internet-based, long-distance)
 * 3. Future: LoRa Mesh, other mesh protocols
 *
 * Philosophy: Like BitChat, we prioritize resilient, offline-first communication
 * for high-risk organizing scenarios (protests, disasters, internet shutdowns).
 */

import type { Event as NostrEvent } from 'nostr-tools';

/**
 * Transport types supported by BuildIt Network
 */
export enum TransportType {
  BLE_MESH = 'ble_mesh',        // Primary: Bluetooth Low Energy mesh
  NOSTR_RELAY = 'nostr_relay',  // Secondary: Internet-based Nostr relays
  LORA_MESH = 'lora_mesh',      // Future: Long-range radio mesh
  MESH_RADIO = 'mesh_radio',    // Future: Other mesh radio protocols
}

/**
 * Transport status
 */
export enum TransportStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * Message delivery status across transports
 */
export enum DeliveryStatus {
  PENDING = 'pending',           // Queued for delivery
  SENT = 'sent',                 // Sent to local transport
  RELAYED = 'relayed',           // Forwarded through mesh hop
  DELIVERED = 'delivered',       // Confirmed received by recipient
  FAILED = 'failed',             // Delivery failed
}

/**
 * Transport capabilities
 */
export interface TransportCapabilities {
  /** Can send messages */
  canSend: boolean;
  /** Can receive messages */
  canReceive: boolean;
  /** Supports store-and-forward */
  storeAndForward: boolean;
  /** Supports multi-hop routing */
  multiHop: boolean;
  /** Maximum message size (bytes) */
  maxMessageSize: number;
  /** Estimated range (meters, 0 = unlimited for internet) */
  range: number;
  /** Battery efficiency (1-10, 10 = most efficient) */
  batteryEfficiency: number;
}

/**
 * Transport statistics
 */
export interface TransportStats {
  /** Messages sent through this transport */
  messagesSent: number;
  /** Messages received through this transport */
  messagesReceived: number;
  /** Messages relayed (multi-hop) */
  messagesRelayed: number;
  /** Failed delivery attempts */
  failedDeliveries: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** Connected peers/nodes count */
  connectedPeers: number;
  /** Bytes transmitted */
  bytesTransmitted: number;
  /** Bytes received */
  bytesReceived: number;
}

/**
 * Transport message wrapper
 * Wraps Nostr events with transport-specific metadata
 */
export interface TransportMessage {
  /** Unique message ID */
  id: string;
  /** Wrapped Nostr event */
  event: NostrEvent;
  /** Transport this message is routed through */
  transport: TransportType;
  /** Delivery status */
  status: DeliveryStatus;
  /** Time-to-live (max hops for mesh, max retries for relay) */
  ttl: number;
  /** Current hop count (for mesh) */
  hopCount: number;
  /** Timestamp when message was created */
  createdAt: number;
  /** Timestamp when message was last relayed */
  lastRelayedAt?: number;
  /** Sender device ID (for mesh routing) */
  senderId?: string;
  /** Recipient device ID (for mesh routing, optional for broadcast) */
  recipientId?: string;
  /** Compression applied (for BLE) */
  compressed?: boolean;
  /** Encryption applied (NIP-17 for private messages) */
  encrypted?: boolean;
}

/**
 * Transport adapter interface
 * All transport protocols must implement this interface
 */
export interface ITransportAdapter {
  /** Transport type identifier */
  type: TransportType;

  /** Current transport status */
  status: TransportStatus;

  /** Transport capabilities */
  capabilities: TransportCapabilities;

  /** Transport statistics */
  stats: TransportStats;

  /**
   * Initialize the transport
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Connect to the transport
   * @returns Promise that resolves when connection is established
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the transport
   * @returns Promise that resolves when disconnection is complete
   */
  disconnect(): Promise<void>;

  /**
   * Send a message through this transport
   * @param message - Transport message to send
   * @returns Promise that resolves when message is sent
   */
  sendMessage(message: TransportMessage): Promise<void>;

  /**
   * Subscribe to incoming messages
   * @param callback - Callback function for incoming messages
   * @returns Unsubscribe function
   */
  onMessage(callback: (message: TransportMessage) => void): () => void;

  /**
   * Subscribe to transport status changes
   * @param callback - Callback function for status changes
   * @returns Unsubscribe function
   */
  onStatusChange(callback: (status: TransportStatus) => void): () => void;

  /**
   * Subscribe to transport errors
   * @param callback - Callback function for errors
   * @returns Unsubscribe function
   */
  onError(callback: (error: Error) => void): () => void;

  /**
   * Get connected peers/nodes (for mesh transports)
   * @returns Array of peer identifiers
   */
  getPeers(): Promise<string[]>;

  /**
   * Check if this transport is available on current device
   * @returns Promise that resolves to availability status
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Transport router configuration
 */
export interface TransportRouterConfig {
  /** Preferred transport order (highest priority first) */
  preferredOrder: TransportType[];
  /** Enable automatic failover to next transport on failure */
  autoFailover: boolean;
  /** Enable automatic fallback to internet when mesh unavailable */
  autoFallback: boolean;
  /** Maximum retries per transport before failing over */
  maxRetries: number;
  /** Timeout for transport operations (ms) */
  timeout: number;
  /** Enable store-and-forward for offline delivery */
  storeAndForward: boolean;
  /** Maximum time to store undelivered messages (ms) */
  maxStoreTime: number;
}

/**
 * Default transport router configuration
 * BLE Mesh is PRIMARY, Nostr Relay is SECONDARY
 */
export const DEFAULT_TRANSPORT_CONFIG: TransportRouterConfig = {
  preferredOrder: [
    TransportType.BLE_MESH,      // First: BLE mesh (offline-first)
    TransportType.NOSTR_RELAY,   // Second: Nostr relays (internet fallback)
  ],
  autoFailover: true,
  autoFallback: true,
  maxRetries: 3,
  timeout: 30000,                // 30 seconds
  storeAndForward: true,
  maxStoreTime: 7 * 24 * 60 * 60 * 1000,  // 7 days
};
