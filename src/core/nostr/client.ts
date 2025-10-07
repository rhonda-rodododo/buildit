import { SimplePool, type Event as NostrEvent, type Filter, mergeFilters } from 'nostr-tools'
import type { RelayConfig, RelayStatus, Subscription, PublishResult } from '@/types/nostr'

export class NostrClient {
  private pool: SimplePool
  private relays: Map<string, RelayConfig>
  private relayStatus: Map<string, RelayStatus>
  private subscriptions: Map<string, Subscription>
  private eventHandlers: Map<string, Set<(event: NostrEvent) => void>>

  constructor(relays: RelayConfig[] = []) {
    this.pool = new SimplePool()
    this.relays = new Map()
    this.relayStatus = new Map()
    this.subscriptions = new Map()
    this.eventHandlers = new Map()

    relays.forEach(relay => this.addRelay(relay))
  }

  /**
   * Add a relay to the client
   */
  addRelay(config: RelayConfig): void {
    this.relays.set(config.url, config)
    this.relayStatus.set(config.url, {
      url: config.url,
      connected: false,
      connecting: false,
      error: null,
      lastConnected: null,
      messagesSent: 0,
      messagesReceived: 0,
    })
  }

  /**
   * Remove a relay from the client
   */
  removeRelay(url: string): void {
    this.relays.delete(url)
    this.relayStatus.delete(url)
    // Note: SimplePool handles relay cleanup automatically
  }

  /**
   * Get all relay URLs for read operations
   */
  private getReadRelays(): string[] {
    return Array.from(this.relays.values())
      .filter(r => r.read)
      .map(r => r.url)
  }

  /**
   * Get all relay URLs for write operations
   */
  private getWriteRelays(): string[] {
    return Array.from(this.relays.values())
      .filter(r => r.write)
      .map(r => r.url)
  }

  /**
   * Get relay status for all relays
   */
  getRelayStatuses(): RelayStatus[] {
    return Array.from(this.relayStatus.values())
  }

  /**
   * Subscribe to events matching filters
   */
  subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const subscription: Subscription = {
      id: subId,
      filters,
      onEvent,
      onEose,
    }

    this.subscriptions.set(subId, subscription)

    // Subscribe to relays
    const relayUrls = this.getReadRelays()

    // nostr-tools subscribeMany accepts a single Filter
    // Merge multiple filters into one using OR logic (arrays in filter values)
    const mergedFilter = filters.length === 1 ? filters[0] : mergeFilters(...filters)

    this.pool.subscribeMany(
      relayUrls,
      mergedFilter,
      {
        onevent: (event: NostrEvent) => {
          onEvent(event)

          // Track messages received
          relayUrls.forEach(url => {
            const status = this.relayStatus.get(url)
            if (status) {
              status.messagesReceived++
            }
          })
        },
        oneose: () => {
          onEose?.()
        },
      }
    )

    return subId
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subId: string): void {
    this.subscriptions.delete(subId)
    // Note: SimplePool manages subscriptions internally
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.clear()
    this.pool.close(this.getReadRelays())
  }

  /**
   * Publish an event to write relays
   */
  async publish(event: NostrEvent): Promise<PublishResult[]> {
    const relays = this.getWriteRelays()
    const results: PublishResult[] = []

    const publishPromises = relays.map(async (relayUrl) => {
      try {
        await this.pool.publish([relayUrl], event)

        // Track messages sent
        const status = this.relayStatus.get(relayUrl)
        if (status) {
          status.messagesSent++
          status.connected = true
          status.lastConnected = Date.now()
        }

        results.push({
          relay: relayUrl,
          success: true,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'

        // Update relay status
        const status = this.relayStatus.get(relayUrl)
        if (status) {
          status.error = errorMsg
          status.connected = false
        }

        results.push({
          relay: relayUrl,
          success: false,
          error: errorMsg,
        })
      }
    })

    await Promise.allSettled(publishPromises)
    return results
  }

  /**
   * Query for events (one-time query, not a subscription)
   */
  async query(filters: Filter[], timeout = 5000): Promise<NostrEvent[]> {
    const relays = this.getReadRelays()

    return new Promise((resolve) => {
      const events: NostrEvent[] = []
      const timer = setTimeout(() => resolve(events), timeout)

      // Combine filters into a single filter for nostr-tools pool
      const combinedFilter = filters.length === 1 ? filters[0] : filters[0]

      this.pool.subscribeMany(
        relays,
        combinedFilter,
        {
          onevent: (event: NostrEvent) => {
            events.push(event)
          },
          oneose: () => {
            clearTimeout(timer)
            resolve(events)
          },
        }
      )
    })
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string, timeout = 5000): Promise<NostrEvent | null> {
    const events = await this.query([{ ids: [eventId] }], timeout)
    return events[0] || null
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    const allRelays = Array.from(this.relays.keys())
    this.pool.close(allRelays)
    this.subscriptions.clear()
    this.eventHandlers.clear()
  }

  /**
   * Alias for close() to match common disconnect naming
   */
  disconnect(): void {
    this.close()
  }
}

// Singleton instance (optional, can be created per-component if needed)
let clientInstance: NostrClient | null = null

export function getNostrClient(relays?: RelayConfig[]): NostrClient {
  if (!clientInstance) {
    const defaultRelays: RelayConfig[] = relays || [
      { url: 'wss://relay.damus.io', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
      { url: 'wss://relay.nostr.band', read: true, write: true },
      { url: 'wss://nos.lol', read: true, write: true },
    ]
    clientInstance = new NostrClient(defaultRelays)
  }
  return clientInstance
}

export function resetNostrClient(): void {
  if (clientInstance) {
    clientInstance.close()
    clientInstance = null
  }
}
