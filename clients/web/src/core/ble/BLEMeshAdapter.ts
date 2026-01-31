/**
 * BLE Mesh Adapter
 *
 * Implements Nostr-over-BLE mesh networking using Web Bluetooth API
 * Primary transport layer for BuildIt Network (offline-first)
 *
 * Architecture:
 * - Dual role: Acts as both BLE peripheral (server) and central (client)
 * - Auto-discovery: Scans for nearby BuildIt BLE mesh nodes
 * - Multi-hop: Messages propagate through intermediate nodes
 * - Store-and-forward: Caches messages for offline delivery
 * - Compression: Gzip compression for efficient bandwidth usage
 * - Chunking: Handles BLE's 512-byte MTU limit
 */

import type { Event as NostrEvent } from 'nostr-tools';
import { logger } from '@/lib/logger';
import {
  type ITransportAdapter,
  TransportType,
  TransportStatus,
  type TransportCapabilities,
  type TransportStats,
  type TransportMessage,
  DeliveryStatus,
} from '../transport/types';
import {
  BUILDIT_SERVICE_UUID,
  BLE_CHARACTERISTICS,
  BLE_CONFIG,
  BLE_LIMITS,
  BLEDeviceRole,
  BLEStatusCode,
  BLE_ERRORS,
} from './constants';
import {
  compressMessage,
  decompressMessage,
  chunkMessage,
  serializeChunk,
  deserializeChunk,
  MessageReassembler,
} from './compression';

/**
 * BLE peer connection
 */
interface BLEPeer {
  id: string;
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  characteristics: Map<string, BluetoothRemoteGATTCharacteristic>;
  lastSeen: number;
  role: 'central' | 'peripheral';
}

/**
 * BLE mesh adapter configuration
 */
export interface BLEMeshAdapterConfig {
  /** Device role (dual = both central and peripheral) */
  role: BLEDeviceRole;
  /** Enable auto-reconnection on disconnect */
  autoReconnect: boolean;
  /** Enable mesh routing (multi-hop) */
  enableMeshRouting: boolean;
  /** Maximum number of connected peers */
  maxPeers: number;
  /** Scan interval (ms) */
  scanInterval: number;
  /** Sync interval (ms) */
  syncInterval: number;
}

/**
 * Default BLE mesh adapter configuration
 */
const DEFAULT_CONFIG: BLEMeshAdapterConfig = {
  role: BLEDeviceRole.DUAL,
  autoReconnect: true,
  enableMeshRouting: true,
  maxPeers: BLE_CONFIG.MAX_PEERS,
  scanInterval: BLE_CONFIG.SCAN_INTERVAL,
  syncInterval: BLE_CONFIG.SYNC_INTERVAL,
};

/**
 * BLE Mesh Adapter
 */
export class BLEMeshAdapter implements ITransportAdapter {
  type = TransportType.BLE_MESH as const;
  status = TransportStatus.DISCONNECTED;

  capabilities: TransportCapabilities = {
    canSend: true,
    canReceive: true,
    storeAndForward: true,
    multiHop: true,
    maxMessageSize: BLE_LIMITS.MAX_MESSAGE_SIZE,
    range: 30, // 30 meters typical BLE range
    batteryEfficiency: 8, // BLE is battery-efficient
  };

  stats: TransportStats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesRelayed: 0,
    failedDeliveries: 0,
    avgLatency: 0,
    connectedPeers: 0,
    bytesTransmitted: 0,
    bytesReceived: 0,
  };

  private config: BLEMeshAdapterConfig;
  private peers = new Map<string, BLEPeer>();
  private reassembler = new MessageReassembler();
  private messageCallbacks = new Set<(message: TransportMessage) => void>();
  private statusCallbacks = new Set<(status: TransportStatus) => void>();
  private errorCallbacks = new Set<(error: Error) => void>();
  private scanInterval: number | null = null;
  private syncInterval: number | null = null;
  private seenMessageIds = new Set<string>();
  private peerListeners = new Map<string, {
    characteristicHandlers: Array<{ characteristic: BluetoothRemoteGATTCharacteristic; handler: (event: Event) => void }>;
    disconnectHandler: () => void;
    device: BluetoothDevice;
  }>();

  constructor(config: Partial<BLEMeshAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the BLE adapter
   */
  async initialize(): Promise<void> {
    logger.info('[BLE Mesh] Initializing adapter...');

    // Check if Web Bluetooth API is available
    const available = await this.isAvailable();
    if (!available) {
      throw new Error(BLE_ERRORS[BLEStatusCode.UNSUPPORTED_BROWSER]);
    }

    this.setStatus(TransportStatus.DISCONNECTED);
  }

  /**
   * Connect to BLE mesh network
   */
  async connect(): Promise<void> {
    logger.info('[BLE Mesh] Connecting to mesh network...');
    this.setStatus(TransportStatus.CONNECTING);

    try {
      // Start scanning for nearby peers
      if (this.config.role === BLEDeviceRole.CENTRAL || this.config.role === BLEDeviceRole.DUAL) {
        await this.startScanning();
      }

      // Start advertising as peripheral
      if (this.config.role === BLEDeviceRole.PERIPHERAL || this.config.role === BLEDeviceRole.DUAL) {
        await this.startAdvertising();
      }

      // Start periodic sync
      this.startPeriodicSync();

      this.setStatus(TransportStatus.CONNECTED);
      logger.info('[BLE Mesh] Connected to mesh network');
    } catch (error) {
      this.setStatus(TransportStatus.ERROR);
      this.emitError(new Error(`Failed to connect: ${error}`));
      throw error;
    }
  }

  /**
   * Clean up event listeners for a specific peer
   */
  private cleanupPeerListeners(peerId: string): void {
    const listeners = this.peerListeners.get(peerId);
    if (!listeners) return;

    // Remove characteristic value changed listeners
    for (const { characteristic, handler } of listeners.characteristicHandlers) {
      try {
        characteristic.removeEventListener('characteristicvaluechanged', handler);
        characteristic.stopNotifications().catch(() => {
          // Ignore errors during cleanup - characteristic may already be disconnected
        });
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Remove device disconnect listener
    try {
      listeners.device.removeEventListener('gattserverdisconnected', listeners.disconnectHandler);
    } catch {
      // Ignore errors during cleanup
    }

    this.peerListeners.delete(peerId);
  }

  /**
   * Disconnect from BLE mesh network
   */
  async disconnect(): Promise<void> {
    logger.info('[BLE Mesh] Disconnecting from mesh network...');

    // Stop scanning
    this.stopScanning();

    // Stop periodic sync
    this.stopPeriodicSync();

    // Clean up listeners and disconnect all peers
    for (const peer of this.peers.values()) {
      this.cleanupPeerListeners(peer.id);
      try {
        await peer.device.gatt?.disconnect();
      } catch (error) {
        console.error('[BLE Mesh] Failed to disconnect peer:', error);
      }
    }

    this.peers.clear();
    this.peerListeners.clear();
    this.stats.connectedPeers = 0;

    this.setStatus(TransportStatus.DISCONNECTED);
    logger.info('[BLE Mesh] Disconnected from mesh network');
  }

  /**
   * Send a message through BLE mesh
   */
  async sendMessage(message: TransportMessage): Promise<void> {
    if (this.status !== TransportStatus.CONNECTED) {
      throw new Error('BLE adapter not connected');
    }

    try {
      // Serialize Nostr event to JSON
      const eventJson = JSON.stringify(message.event);

      // Compress message
      const compressed = compressMessage(eventJson);

      // Chunk message
      const chunks = chunkMessage(compressed, message.id);

      // Send each chunk
      for (const chunk of chunks) {
        const serialized = serializeChunk(chunk);
        await this.broadcastChunk(serialized);
      }

      // Update stats
      this.stats.messagesSent++;
      this.stats.bytesTransmitted += compressed.length;

      logger.info(`[BLE Mesh] Message sent: ${message.id} (${chunks.length} chunks)`);
    } catch (error) {
      this.stats.failedDeliveries++;
      this.emitError(new Error(`Failed to send message: ${error}`));
      throw error;
    }
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(callback: (message: TransportMessage) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: TransportStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Subscribe to errors
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Get connected peers
   */
  async getPeers(): Promise<string[]> {
    return Array.from(this.peers.keys());
  }

  /**
   * Check if BLE is available
   */
  async isAvailable(): Promise<boolean> {
    // Check if Web Bluetooth API exists
    if (!navigator.bluetooth) {
      console.warn('[BLE Mesh] Web Bluetooth API not available');
      return false;
    }

    // Check if Bluetooth is available on device
    try {
      const available = await navigator.bluetooth.getAvailability();
      if (!available) {
        console.warn('[BLE Mesh] Bluetooth not available on this device');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[BLE Mesh] Failed to check Bluetooth availability:', error);
      return false;
    }
  }

  /**
   * Start scanning for nearby BLE mesh nodes
   */
  private async startScanning(): Promise<void> {
    logger.info('[BLE Mesh] Starting scan for nearby nodes...');

    // Initial scan
    await this.scanForDevices();

    // Periodic scanning
    this.scanInterval = window.setInterval(() => {
      this.scanForDevices().catch(console.error);
    }, this.config.scanInterval);
  }

  /**
   * Stop scanning for devices
   */
  private stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Scan for nearby BLE devices
   */
  private async scanForDevices(): Promise<void> {
    // Skip if already at max peers
    if (this.peers.size >= this.config.maxPeers) {
      return;
    }

    try {
      // Request device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BUILDIT_SERVICE_UUID] }],
        optionalServices: Object.values(BLE_CHARACTERISTICS),
      });

      // Connect to device
      await this.connectToPeer(device);
    } catch (error) {
      // User cancelled or error
      if (error instanceof Error && error.name !== 'NotFoundError') {
        console.error('[BLE Mesh] Scan error:', error);
      }
    }
  }

  /**
   * Connect to a BLE peer
   */
  private async connectToPeer(device: BluetoothDevice): Promise<void> {
    const peerId = device.id;

    // Skip if already connected
    if (this.peers.has(peerId)) {
      return;
    }

    logger.info(`[BLE Mesh] Connecting to peer: ${peerId}`);

    try {
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      const service = await server.getPrimaryService(BUILDIT_SERVICE_UUID);

      // Get characteristics
      const characteristics = new Map<string, BluetoothRemoteGATTCharacteristic>();
      const characteristicHandlers: Array<{ characteristic: BluetoothRemoteGATTCharacteristic; handler: (event: Event) => void }> = [];

      for (const [name, uuid] of Object.entries(BLE_CHARACTERISTICS)) {
        try {
          const characteristic = await service.getCharacteristic(uuid);
          characteristics.set(name, characteristic);

          // Subscribe to notifications
          if (characteristic.properties.notify) {
            await characteristic.startNotifications();
            const handler = (event: Event) => {
              this.handleCharacteristicChange(peerId, event);
            };
            characteristic.addEventListener('characteristicvaluechanged', handler);
            characteristicHandlers.push({ characteristic, handler });
          }
        } catch (error) {
          console.warn(`[BLE Mesh] Failed to get characteristic ${name}:`, error);
        }
      }

      // Handle disconnect
      const disconnectHandler = () => {
        this.handlePeerDisconnect(peerId);
      };
      device.addEventListener('gattserverdisconnected', disconnectHandler);

      // Store listener references for cleanup
      this.peerListeners.set(peerId, {
        characteristicHandlers,
        disconnectHandler,
        device,
      });

      // Store peer
      const peer: BLEPeer = {
        id: peerId,
        device,
        server,
        characteristics,
        lastSeen: Date.now(),
        role: 'central',
      };

      this.peers.set(peerId, peer);
      this.stats.connectedPeers = this.peers.size;

      logger.info(`[BLE Mesh] Connected to peer: ${peerId}`);
    } catch (error) {
      console.error(`[BLE Mesh] Failed to connect to peer ${peerId}:`, error);
      throw error;
    }
  }

  /**
   * Start advertising as BLE peripheral
   * Note: Web Bluetooth API doesn't support peripheral mode yet
   * This is a placeholder for future implementation
   */
  private async startAdvertising(): Promise<void> {
    console.warn('[BLE Mesh] Peripheral mode not yet supported in Web Bluetooth API');
    // Peripheral mode blocked by Web Bluetooth API - Phase 4+
  }

  /**
   * Broadcast a chunk to all connected peers
   */
  private async broadcastChunk(data: Uint8Array): Promise<void> {
    const sendPromises = Array.from(this.peers.values()).map(async (peer) => {
      try {
        const characteristic = peer.characteristics.get('MESSAGE_WRITE');
        if (characteristic) {
          await characteristic.writeValue(data.buffer as ArrayBuffer);
        }
      } catch (error) {
        console.error(`[BLE Mesh] Failed to send to peer ${peer.id}:`, error);
      }
    });

    await Promise.all(sendPromises);
  }

  /**
   * Handle characteristic value change (incoming data)
   */
  private handleCharacteristicChange(_peerId: string, event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;

    if (!value) {
      return;
    }

    try {
      // Deserialize chunk
      const chunk = deserializeChunk(new Uint8Array(value.buffer));

      // Add to reassembler
      const reassembled = this.reassembler.addChunk(chunk);

      if (reassembled) {
        // Message complete, decompress and parse
        const decompressed = decompressMessage(reassembled);
        const event = JSON.parse(decompressed) as NostrEvent;

        // Create transport message
        const message: TransportMessage = {
          id: chunk.messageId,
          event,
          transport: TransportType.BLE_MESH,
          status: DeliveryStatus.DELIVERED,
          ttl: BLE_LIMITS.DEFAULT_TTL,
          hopCount: 0,
          createdAt: Date.now(),
        };

        // Check for duplicates
        if (this.seenMessageIds.has(message.id)) {
          return;
        }
        this.seenMessageIds.add(message.id);

        // Update stats
        this.stats.messagesReceived++;
        this.stats.bytesReceived += reassembled.length;

        // Emit message
        this.emitMessage(message);

        // Relay message if mesh routing enabled
        if (this.config.enableMeshRouting && message.hopCount < message.ttl) {
          this.relayMessage(message).catch(console.error);
        }
      }
    } catch (error) {
      console.error('[BLE Mesh] Failed to handle incoming data:', error);
    }
  }

  /**
   * Relay a message to other peers (multi-hop routing)
   */
  private async relayMessage(message: TransportMessage): Promise<void> {
    // Increment hop count
    message.hopCount++;
    message.status = DeliveryStatus.RELAYED;

    // Re-send message
    await this.sendMessage(message);

    this.stats.messagesRelayed++;
    logger.info(`[BLE Mesh] Relayed message ${message.id} (hop ${message.hopCount})`);
  }

  /**
   * Handle peer disconnect
   */
  private handlePeerDisconnect(peerId: string): void {
    logger.info(`[BLE Mesh] Peer disconnected: ${peerId}`);

    this.cleanupPeerListeners(peerId);
    this.peers.delete(peerId);
    this.stats.connectedPeers = this.peers.size;

    // Auto-reconnect if enabled
    if (this.config.autoReconnect && this.status === TransportStatus.CONNECTED) {
      setTimeout(() => {
        this.scanForDevices().catch(console.error);
      }, BLE_CONFIG.RECONNECT_DELAY);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = window.setInterval(() => {
      this.performSync().catch(console.error);
      this.reassembler.cleanup();
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform periodic sync with peers
   */
  private async performSync(): Promise<void> {
    // Negentropy sync protocol deferred to Phase 4+ BLE mesh
    logger.info('[BLE Mesh] Periodic sync (Negentropy not yet implemented)');
  }

  /**
   * Set adapter status
   */
  private setStatus(status: TransportStatus): void {
    this.status = status;
    this.statusCallbacks.forEach(callback => callback(status));
  }

  /**
   * Emit incoming message to subscribers
   */
  private emitMessage(message: TransportMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[BLE Mesh] Message callback error:', error);
      }
    });
  }

  /**
   * Emit error to subscribers
   */
  private emitError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('[BLE Mesh] Error callback error:', err);
      }
    });
  }
}
