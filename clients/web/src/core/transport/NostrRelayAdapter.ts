/**
 * Nostr Relay Adapter
 *
 * Implements Nostr relay transport as SECONDARY fallback when BLE mesh unavailable
 * Uses traditional internet-based Nostr relays for long-distance communication
 *
 * Priority: SECONDARY (fallback from BLE mesh)
 * Use cases:
 * - Long-distance communication (beyond BLE range)
 * - When BLE not available (desktop browsers, iOS Safari)
 * - Backup transport for critical messages
 * - Sync with cloud when internet returns
 */

import type { Event as NostrEvent, Filter } from 'nostr-tools';
import { NostrClient } from '../nostr/client';
import type { RelayConfig } from '@/types/nostr';
import { useTorStore } from '@/modules/security/tor/torStore';
import { createLogger } from '@/lib/logger';

const log = createLogger('transport');
import {
  type ITransportAdapter,
  TransportType,
  TransportStatus,
  type TransportCapabilities,
  type TransportStats,
  type TransportMessage,
  DeliveryStatus,
} from './types';

/**
 * Nostr relay adapter configuration
 */
export interface NostrRelayAdapterConfig {
  /** Relay configurations */
  relays: RelayConfig[];
  /** Enable auto-reconnection on disconnect */
  autoReconnect: boolean;
  /** Reconnection delay (ms) */
  reconnectDelay: number;
  /** Message publish timeout (ms) */
  publishTimeout: number;
}

/**
 * Default Nostr relay adapter configuration
 */
const DEFAULT_CONFIG: NostrRelayAdapterConfig = {
  relays: [
    { url: 'wss://relay.damus.io', read: true, write: true },
    { url: 'wss://relay.primal.net', read: true, write: true },
    { url: 'wss://relay.nostr.band', read: true, write: true },
    { url: 'wss://nos.lol', read: true, write: true },
  ],
  autoReconnect: true,
  reconnectDelay: 5000,
  publishTimeout: 10000,
};

/**
 * Nostr Relay Adapter
 */
export class NostrRelayAdapter implements ITransportAdapter {
  type = TransportType.NOSTR_RELAY as const;
  status = TransportStatus.DISCONNECTED;

  capabilities: TransportCapabilities = {
    canSend: true,
    canReceive: true,
    storeAndForward: false, // Relays don't guarantee store-and-forward
    multiHop: false, // Direct relay-to-relay, not multi-hop
    maxMessageSize: 100 * 1024, // 100 KB typical relay limit
    range: 0, // Unlimited (internet-based)
    batteryEfficiency: 5, // WebSocket connections use moderate battery
  };

  stats: TransportStats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesRelayed: 0,
    failedDeliveries: 0,
    avgLatency: 0,
    connectedPeers: 0, // Relays, not peers
    bytesTransmitted: 0,
    bytesReceived: 0,
  };

  private config: NostrRelayAdapterConfig;
  private client: NostrClient;
  private messageCallbacks = new Set<(message: TransportMessage) => void>();
  private statusCallbacks = new Set<(status: TransportStatus) => void>();
  private errorCallbacks = new Set<(error: Error) => void>();
  private subscriptionIds = new Set<string>();
  private seenEventIds = new Set<string>();

  constructor(config: Partial<NostrRelayAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Get relays based on Tor configuration
    const relays = this.getRelaysWithTor();
    this.client = new NostrClient(relays);
  }

  /**
   * Get relay list with Tor integration
   * If Tor is enabled, use .onion relays; otherwise use clearnet
   */
  private getRelaysWithTor(): RelayConfig[] {
    const torStore = useTorStore.getState();

    // If Tor enabled, use .onion relays
    if (torStore.config.enabled) {
      const onionRelays: RelayConfig[] = torStore.onionRelays.map((relay) => ({
        url: relay.url,
        read: relay.read,
        write: relay.write,
      }));

      // If fallback enabled, also include clearnet relays
      if (torStore.config.fallbackToClearnet && !torStore.config.onionOnly) {
        return [...onionRelays, ...this.config.relays];
      }

      return onionRelays;
    }

    // Tor disabled - use clearnet relays
    return this.config.relays;
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    log.info('[Nostr Relay] Initializing adapter...');
    this.setStatus(TransportStatus.DISCONNECTED);
  }

  /**
   * Connect to Nostr relays
   */
  async connect(): Promise<void> {
    // Update relays based on current Tor configuration
    const relays = this.getRelaysWithTor();
    this.client = new NostrClient(relays);

    const torStore = useTorStore.getState();
    const torEnabled = torStore.config.enabled;

    log.info(
      `[Nostr Relay] Connecting to relays... (Tor: ${torEnabled ? 'enabled' : 'disabled'})`
    );
    this.setStatus(TransportStatus.CONNECTING);

    try {
      // Subscribe to all relevant events
      // This is a global subscription - actual filtering happens in app logic
      const filters: Filter[] = [
        // Subscribe to kind 0-30 (common Nostr events)
        // In production, you'd filter by pubkeys or specific kinds
        { kinds: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 30], limit: 100 },
      ];

      const subId = this.client.subscribe(
        filters,
        (event) => {
          this.handleIncomingEvent(event);
        },
        () => {
          log.info('[Nostr Relay] Subscription EOSE');
        }
      );

      this.subscriptionIds.add(subId);

      // Check relay statuses
      const statuses = this.client.getRelayStatuses();
      const connectedCount = statuses.filter(s => s.connected).length;

      this.stats.connectedPeers = connectedCount;

      this.setStatus(TransportStatus.CONNECTED);

      if (torEnabled) {
        const onionCount = statuses.filter(s => s.connected && s.url.includes('.onion')).length;
        log.info(
          `[Nostr Relay] Connected to ${connectedCount} relays (${onionCount} .onion)`
        );
      } else {
        log.info(`[Nostr Relay] Connected to ${connectedCount} relays`);
      }
    } catch (error) {
      this.setStatus(TransportStatus.ERROR);
      this.emitError(new Error(`Failed to connect: ${error}`));
      throw error;
    }
  }

  /**
   * Disconnect from Nostr relays
   */
  async disconnect(): Promise<void> {
    log.info('[Nostr Relay] Disconnecting from relays...');

    // Unsubscribe from all subscriptions
    for (const subId of this.subscriptionIds) {
      this.client.unsubscribe(subId);
    }
    this.subscriptionIds.clear();

    // Close client
    this.client.disconnect();

    this.stats.connectedPeers = 0;
    this.setStatus(TransportStatus.DISCONNECTED);
    log.info('[Nostr Relay] Disconnected from relays');
  }

  /**
   * Send a message through Nostr relays
   */
  async sendMessage(message: TransportMessage): Promise<void> {
    if (this.status !== TransportStatus.CONNECTED) {
      throw new Error('Nostr adapter not connected');
    }

    try {
      const startTime = Date.now();

      // Publish event to relays
      const results = await this.client.publish(message.event);

      // Check if at least one relay succeeded
      const successCount = results.filter(r => r.success).length;

      if (successCount === 0) {
        throw new Error('Failed to publish to any relay');
      }

      // Calculate latency
      const latency = Date.now() - startTime;
      this.stats.avgLatency = (this.stats.avgLatency * this.stats.messagesSent + latency) / (this.stats.messagesSent + 1);

      // Update stats
      this.stats.messagesSent++;

      // Estimate bytes transmitted (rough approximation)
      const eventSize = JSON.stringify(message.event).length;
      this.stats.bytesTransmitted += eventSize;

      log.info(`[Nostr Relay] Message sent: ${message.id} (${successCount}/${results.length} relays)`);
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
   * Get connected relays (as "peers")
   */
  async getPeers(): Promise<string[]> {
    const statuses = this.client.getRelayStatuses();
    return statuses
      .filter(s => s.connected)
      .map(s => s.url);
  }

  /**
   * Check if Nostr relays are available
   */
  async isAvailable(): Promise<boolean> {
    // Nostr relays are always "available" if we have internet
    // We can't reliably check internet connectivity in the browser
    // So we return true and let connection attempt fail if no internet
    return true;
  }

  /**
   * Add a relay to the client
   */
  addRelay(config: RelayConfig): void {
    this.client.addRelay(config);
    log.info(`[Nostr Relay] Added relay: ${config.url}`);
  }

  /**
   * Remove a relay from the client
   */
  removeRelay(url: string): void {
    this.client.removeRelay(url);
    log.info(`[Nostr Relay] Removed relay: ${url}`);
  }

  /**
   * Get relay statuses
   */
  getRelayStatuses() {
    return this.client.getRelayStatuses();
  }

  /**
   * Handle incoming Nostr event
   */
  private handleIncomingEvent(event: NostrEvent): void {
    // Check for duplicates
    if (this.seenEventIds.has(event.id)) {
      return;
    }
    this.seenEventIds.add(event.id);

    // Create transport message
    const message: TransportMessage = {
      id: event.id,
      event,
      transport: TransportType.NOSTR_RELAY,
      status: DeliveryStatus.DELIVERED,
      ttl: 1, // No multi-hop for relays
      hopCount: 0,
      createdAt: event.created_at * 1000, // Nostr uses seconds, we use ms
    };

    // Update stats
    this.stats.messagesReceived++;

    // Estimate bytes received
    const eventSize = JSON.stringify(event).length;
    this.stats.bytesReceived += eventSize;

    // Emit message to subscribers
    this.emitMessage(message);
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
        log.error(' Message callback error:', error);
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
        log.error(' Error callback error:', err);
      }
    });
  }
}
