import { logger } from '@/lib/logger';

/**
 * Transport Router
 *
 * Routes messages through available transports in priority order:
 * 1. BLE Mesh (primary, offline-first)
 * 2. Nostr Relays (secondary, internet fallback)
 * 3. Future mesh protocols
 *
 * Handles:
 * - Automatic transport selection
 * - Failover on delivery failure
 * - Store-and-forward for offline messages
 * - Multi-transport sync
 */

import {
  ITransportAdapter,
  TransportMessage,
  TransportRouterConfig,
  TransportType,
  TransportStatus,
  DeliveryStatus,
  DEFAULT_TRANSPORT_CONFIG
} from './types';

export class TransportRouter {
  private adapters = new Map<TransportType, ITransportAdapter>();
  private config: TransportRouterConfig;
  private messageQueue: TransportMessage[] = [];
  private messageCallbacks = new Set<(message: TransportMessage) => void>();
  private statusCallbacks = new Map<TransportType, Set<(status: TransportStatus) => void>>();

  constructor(config: Partial<TransportRouterConfig> = {}) {
    this.config = { ...DEFAULT_TRANSPORT_CONFIG, ...config };
  }

  /**
   * Register a transport adapter
   */
  registerAdapter(adapter: ITransportAdapter): void {
    this.adapters.set(adapter.type, adapter);

    // Subscribe to adapter status changes
    adapter.onStatusChange((status) => {
      this.handleStatusChange(adapter.type, status);
    });

    // Subscribe to incoming messages
    adapter.onMessage((message) => {
      this.handleIncomingMessage(message);
    });

    // Subscribe to adapter errors
    adapter.onError((error) => {
      console.error(`[TransportRouter] ${adapter.type} error:`, error);
    });
  }

  /**
   * Initialize all registered transports
   */
  async initialize(): Promise<void> {
    const initPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const isAvailable = await adapter.isAvailable();
        if (isAvailable) {
          await adapter.initialize();
        }
      } catch (error) {
        console.error(`[TransportRouter] Failed to initialize ${adapter.type}:`, error);
      }
    });

    await Promise.all(initPromises);
  }

  /**
   * Connect all available transports
   */
  async connect(): Promise<void> {
    const connectPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const isAvailable = await adapter.isAvailable();
        if (isAvailable && adapter.status === TransportStatus.DISCONNECTED) {
          await adapter.connect();
        }
      } catch (error) {
        console.error(`[TransportRouter] Failed to connect ${adapter.type}:`, error);
      }
    });

    await Promise.all(connectPromises);

    // Process queued messages after connection
    await this.processMessageQueue();
  }

  /**
   * Disconnect all transports
   */
  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        if (adapter.status === TransportStatus.CONNECTED) {
          await adapter.disconnect();
        }
      } catch (error) {
        console.error(`[TransportRouter] Failed to disconnect ${adapter.type}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
  }

  /**
   * Send a message through the best available transport
   * Prioritizes BLE mesh, falls back to Nostr relays
   */
  async sendMessage(message: TransportMessage): Promise<void> {
    // Try each transport in priority order
    for (const transportType of this.config.preferredOrder) {
      const adapter = this.adapters.get(transportType);

      if (!adapter) {
        continue;
      }

      // Skip if transport not connected
      if (adapter.status !== TransportStatus.CONNECTED) {
        continue;
      }

      // Try to send through this transport
      try {
        message.transport = transportType;
        message.status = DeliveryStatus.SENT;
        await adapter.sendMessage(message);

        logger.info(`[TransportRouter] Message sent via ${transportType}`);
        return;
      } catch (error) {
        console.error(`[TransportRouter] Failed to send via ${transportType}:`, error);

        // Continue to next transport if failover enabled
        if (!this.config.autoFailover) {
          throw error;
        }
      }
    }

    // No transport available, queue for later if store-and-forward enabled
    if (this.config.storeAndForward) {
      message.status = DeliveryStatus.PENDING;
      this.messageQueue.push(message);
      logger.info('[TransportRouter] Message queued for later delivery');

      // Clean up old queued messages
      this.cleanMessageQueue();
    } else {
      message.status = DeliveryStatus.FAILED;
      throw new Error('No transport available and store-and-forward disabled');
    }
  }

  /**
   * Subscribe to incoming messages from any transport
   */
  onMessage(callback: (message: TransportMessage) => void): () => void {
    this.messageCallbacks.add(callback);

    return () => {
      this.messageCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to transport status changes
   */
  onStatusChange(
    transportType: TransportType,
    callback: (status: TransportStatus) => void
  ): () => void {
    if (!this.statusCallbacks.has(transportType)) {
      this.statusCallbacks.set(transportType, new Set());
    }

    this.statusCallbacks.get(transportType)!.add(callback);

    return () => {
      this.statusCallbacks.get(transportType)?.delete(callback);
    };
  }

  /**
   * Get primary transport status
   */
  getPrimaryTransportStatus(): TransportStatus {
    const primaryType = this.config.preferredOrder[0];
    const adapter = this.adapters.get(primaryType);
    return adapter?.status || TransportStatus.DISCONNECTED;
  }

  /**
   * Get all connected transports
   */
  getConnectedTransports(): TransportType[] {
    return Array.from(this.adapters.values())
      .filter(adapter => adapter.status === TransportStatus.CONNECTED)
      .map(adapter => adapter.type);
  }

  /**
   * Get adapter for specific transport type
   */
  getAdapter(type: TransportType): ITransportAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Check if any transport is available
   */
  isAnyTransportAvailable(): boolean {
    return Array.from(this.adapters.values()).some(
      adapter => adapter.status === TransportStatus.CONNECTED
    );
  }

  /**
   * Handle incoming message from any transport
   */
  private handleIncomingMessage(message: TransportMessage): void {
    // Notify all subscribers
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[TransportRouter] Message callback error:', error);
      }
    });
  }

  /**
   * Handle transport status change
   */
  private handleStatusChange(transportType: TransportType, status: TransportStatus): void {
    logger.info(`[TransportRouter] ${transportType} status changed to ${status}`);

    // Notify subscribers
    const callbacks = this.statusCallbacks.get(transportType);
    callbacks?.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[TransportRouter] Status callback error:', error);
      }
    });

    // Process queued messages when transport becomes available
    if (status === TransportStatus.CONNECTED) {
      this.processMessageQueue().catch(console.error);
    }
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }

    logger.info(`[TransportRouter] Processing ${this.messageQueue.length} queued messages`);

    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messagesToSend) {
      try {
        await this.sendMessage(message);
      } catch (error) {
        console.error('[TransportRouter] Failed to send queued message:', error);
      }
    }
  }

  /**
   * Clean up old messages from queue
   */
  private cleanMessageQueue(): void {
    const now = Date.now();
    const maxAge = this.config.maxStoreTime;

    this.messageQueue = this.messageQueue.filter(message => {
      const age = now - message.createdAt;
      return age < maxAge;
    });
  }
}
