/**
 * Transport Service
 *
 * Main service that manages all transport adapters for BuildIt Network
 * Architecture: BLE Mesh FIRST, Nostr Relay SECOND (fallback)
 *
 * This is the single entry point for all messaging in the application.
 * Replaces direct Nostr client usage with transport-agnostic API.
 *
 * Usage:
 * ```ts
 * const transport = TransportService.getInstance();
 * await transport.initialize();
 * await transport.connect();
 *
 * // Send message (automatically routes through BLE mesh first, then Nostr)
 * await transport.sendEvent(nostrEvent);
 *
 * // Subscribe to incoming messages from any transport
 * transport.onMessage((message) => {
 *   logger.info('Received:', message);
 * });
 * ```
 */

import type { Event as NostrEvent } from 'nostr-tools';
import { TransportRouter } from './TransportRouter';
import { BLEMeshAdapter } from '../ble/BLEMeshAdapter';
import { NostrRelayAdapter } from './NostrRelayAdapter';
import type { RelayConfig } from '@/types/nostr';
import {
  type TransportMessage,
  type TransportRouterConfig,
  TransportType,
  TransportStatus,
  DeliveryStatus,
} from './types';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '@/lib/logger';
/**
 * Transport service configuration
 */
export interface TransportServiceConfig {
  /** Router configuration */
  router?: Partial<TransportRouterConfig>;
  /** Nostr relay configurations */
  relays?: RelayConfig[];
  /** Enable BLE mesh (default: true) */
  enableBLE?: boolean;
  /** Enable Nostr relays (default: true) */
  enableNostr?: boolean;
}

/**
 * Transport Service (Singleton)
 */
export class TransportService {
  private static instance: TransportService | null = null;

  private router: TransportRouter;
  private bleAdapter: BLEMeshAdapter | null = null;
  private nostrAdapter: NostrRelayAdapter | null = null;
  private initialized = false;

  private constructor(config: TransportServiceConfig = {}) {
    // Create transport router with BLE mesh as PRIMARY
    this.router = new TransportRouter(config.router);

    // Initialize BLE mesh adapter (PRIMARY)
    if (config.enableBLE !== false) {
      this.bleAdapter = new BLEMeshAdapter({
        autoReconnect: true,
        enableMeshRouting: true,
      });
      this.router.registerAdapter(this.bleAdapter);
    }

    // Initialize Nostr relay adapter (SECONDARY fallback)
    if (config.enableNostr !== false) {
      this.nostrAdapter = new NostrRelayAdapter({
        relays: config.relays,
        autoReconnect: true,
      });
      this.router.registerAdapter(this.nostrAdapter);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: TransportServiceConfig): TransportService {
    if (!TransportService.instance) {
      TransportService.instance = new TransportService(config);
    }
    return TransportService.instance;
  }

  /**
   * Reset singleton (useful for testing)
   */
  static reset(): void {
    if (TransportService.instance) {
      TransportService.instance.disconnect().catch(console.error);
      TransportService.instance = null;
    }
  }

  /**
   * Initialize all transports
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[TransportService] Already initialized');
      return;
    }

    logger.info('[TransportService] Initializing transports...');
    logger.info('[TransportService] Priority: BLE Mesh (PRIMARY) → Nostr Relays (SECONDARY)');

    await this.router.initialize();
    this.initialized = true;

    logger.info('[TransportService] Transports initialized');
  }

  /**
   * Connect all transports
   */
  async connect(): Promise<void> {
    if (!this.initialized) {
      throw new Error('TransportService not initialized');
    }

    logger.info('[TransportService] Connecting to mesh network and relays...');
    await this.router.connect();
    logger.info('[TransportService] Connected');
  }

  /**
   * Disconnect all transports
   */
  async disconnect(): Promise<void> {
    logger.info('[TransportService] Disconnecting...');
    await this.router.disconnect();
    this.initialized = false;
    logger.info('[TransportService] Disconnected');
  }

  /**
   * Send a Nostr event through the best available transport
   * Priority: BLE mesh (if available) → Nostr relays (fallback)
   */
  async sendEvent(event: NostrEvent): Promise<void> {
    const message: TransportMessage = {
      id: uuidv4(),
      event,
      transport: TransportType.BLE_MESH, // Will be overridden by router
      status: DeliveryStatus.PENDING,
      ttl: 5, // Default TTL
      hopCount: 0,
      createdAt: Date.now(),
    };

    await this.router.sendMessage(message);
  }

  /**
   * Subscribe to incoming messages from any transport
   */
  onMessage(callback: (message: TransportMessage) => void): () => void {
    return this.router.onMessage(callback);
  }

  /**
   * Subscribe to transport status changes
   */
  onStatusChange(
    transportType: TransportType,
    callback: (status: TransportStatus) => void
  ): () => void {
    return this.router.onStatusChange(transportType, callback);
  }

  /**
   * Get primary transport status (BLE mesh)
   */
  getPrimaryTransportStatus(): TransportStatus {
    return this.router.getPrimaryTransportStatus();
  }

  /**
   * Get all connected transports
   */
  getConnectedTransports(): TransportType[] {
    return this.router.getConnectedTransports();
  }

  /**
   * Check if any transport is available
   */
  isConnected(): boolean {
    return this.router.isAnyTransportAvailable();
  }

  /**
   * Check if BLE mesh is connected (primary transport)
   */
  isBLEConnected(): boolean {
    return this.bleAdapter?.status === TransportStatus.CONNECTED;
  }

  /**
   * Check if Nostr relays are connected (secondary transport)
   */
  isNostrConnected(): boolean {
    return this.nostrAdapter?.status === TransportStatus.CONNECTED;
  }

  /**
   * Get BLE adapter
   */
  getBLEAdapter(): BLEMeshAdapter | null {
    return this.bleAdapter;
  }

  /**
   * Get Nostr adapter
   */
  getNostrAdapter(): NostrRelayAdapter | null {
    return this.nostrAdapter;
  }

  /**
   * Get transport router
   */
  getRouter(): TransportRouter {
    return this.router;
  }

  /**
   * Add a Nostr relay
   */
  addNostrRelay(config: RelayConfig): void {
    if (!this.nostrAdapter) {
      throw new Error('Nostr adapter not enabled');
    }
    this.nostrAdapter.addRelay(config);
  }

  /**
   * Remove a Nostr relay
   */
  removeNostrRelay(url: string): void {
    if (!this.nostrAdapter) {
      throw new Error('Nostr adapter not enabled');
    }
    this.nostrAdapter.removeRelay(url);
  }

  /**
   * Get statistics for all transports
   */
  getStats() {
    return {
      ble: this.bleAdapter?.stats || null,
      nostr: this.nostrAdapter?.stats || null,
    };
  }

  /**
   * Get BLE mesh peers
   */
  async getBLEPeers(): Promise<string[]> {
    if (!this.bleAdapter) {
      return [];
    }
    return this.bleAdapter.getPeers();
  }

  /**
   * Get connected Nostr relays
   */
  async getNostrRelays(): Promise<string[]> {
    if (!this.nostrAdapter) {
      return [];
    }
    return this.nostrAdapter.getPeers();
  }
}
