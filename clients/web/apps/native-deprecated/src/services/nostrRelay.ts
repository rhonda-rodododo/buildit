/**
 * Nostr Relay Service
 *
 * Manages WebSocket connections to Nostr relays and handles event pub/sub.
 */

import type { Event, Filter } from 'nostr-tools'

export interface RelayConfig {
  url: string
  read: boolean
  write: boolean
}

export interface RelayStatus {
  url: string
  connected: boolean
  error?: string
}

type EventCallback = (event: Event) => void
type EoseCallback = () => void

interface Subscription {
  id: string
  filters: Filter[]
  onEvent: EventCallback
  onEose?: EoseCallback
}

// Default relays for BuildIt
export const DEFAULT_RELAYS: RelayConfig[] = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: false },
  { url: 'wss://nos.lol', read: true, write: true },
]

class NostrRelayService {
  private sockets: Map<string, WebSocket> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()
  private relayConfigs: RelayConfig[] = []
  private statusListeners: Set<(statuses: RelayStatus[]) => void> = new Set()
  private subIdCounter = 0

  /**
   * Initialize relay connections
   */
  async connect(configs: RelayConfig[] = DEFAULT_RELAYS): Promise<void> {
    this.relayConfigs = configs

    await Promise.all(
      configs.filter((c) => c.read).map((config) => this.connectToRelay(config.url))
    )
  }

  /**
   * Disconnect from all relays
   */
  disconnect(): void {
    for (const [url, socket] of this.sockets) {
      socket.close()
      this.sockets.delete(url)
    }
    this.subscriptions.clear()
  }

  /**
   * Subscribe to events matching filters
   */
  subscribe(filters: Filter[], onEvent: EventCallback, onEose?: EoseCallback): string {
    const subId = `sub_${++this.subIdCounter}`

    const subscription: Subscription = {
      id: subId,
      filters,
      onEvent,
      onEose,
    }

    this.subscriptions.set(subId, subscription)

    // Send REQ to all connected relays
    for (const [url, socket] of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const relay = this.relayConfigs.find((r) => r.url === url)
        if (relay?.read) {
          socket.send(JSON.stringify(['REQ', subId, ...filters]))
        }
      }
    }

    return subId
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subId: string): void {
    const subscription = this.subscriptions.get(subId)
    if (!subscription) return

    this.subscriptions.delete(subId)

    // Send CLOSE to all relays
    for (const socket of this.sockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(['CLOSE', subId]))
      }
    }
  }

  /**
   * Publish an event to write relays
   */
  async publish(event: Event): Promise<{ success: boolean; relays: string[] }> {
    const writeRelays = this.relayConfigs.filter((r) => r.write)
    const successRelays: string[] = []

    await Promise.all(
      writeRelays.map(async (config) => {
        const socket = this.sockets.get(config.url)
        if (socket?.readyState === WebSocket.OPEN) {
          return new Promise<void>((resolve) => {
            socket.send(JSON.stringify(['EVENT', event]))
            successRelays.push(config.url)
            resolve()
          })
        }
      })
    )

    return {
      success: successRelays.length > 0,
      relays: successRelays,
    }
  }

  /**
   * Get current relay statuses
   */
  getStatuses(): RelayStatus[] {
    return this.relayConfigs.map((config) => {
      const socket = this.sockets.get(config.url)
      return {
        url: config.url,
        connected: socket?.readyState === WebSocket.OPEN,
      }
    })
  }

  /**
   * Listen for status changes
   */
  onStatusChange(callback: (statuses: RelayStatus[]) => void): () => void {
    this.statusListeners.add(callback)
    return () => this.statusListeners.delete(callback)
  }

  private async connectToRelay(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(url)

        socket.onopen = () => {
          console.log(`Connected to relay: ${url}`)
          this.sockets.set(url, socket)
          this.notifyStatusChange()

          // Resend active subscriptions
          for (const sub of this.subscriptions.values()) {
            socket.send(JSON.stringify(['REQ', sub.id, ...sub.filters]))
          }

          resolve()
        }

        socket.onmessage = (event) => {
          this.handleMessage(url, event.data)
        }

        socket.onerror = (error) => {
          console.error(`Relay error (${url}):`, error)
          reject(error)
        }

        socket.onclose = () => {
          console.log(`Disconnected from relay: ${url}`)
          this.sockets.delete(url)
          this.notifyStatusChange()

          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (this.relayConfigs.some((c) => c.url === url)) {
              this.connectToRelay(url).catch(() => {})
            }
          }, 5000)
        }

        // Timeout connection attempt
        setTimeout(() => {
          if (socket.readyState === WebSocket.CONNECTING) {
            socket.close()
            reject(new Error(`Connection timeout: ${url}`))
          }
        }, 10000)
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(relayUrl: string, data: string): void {
    try {
      const message = JSON.parse(data)
      const [type, ...args] = message

      switch (type) {
        case 'EVENT': {
          const [subId, event] = args
          const subscription = this.subscriptions.get(subId)
          if (subscription) {
            subscription.onEvent(event as Event)
          }
          break
        }
        case 'EOSE': {
          const [subId] = args
          const subscription = this.subscriptions.get(subId)
          if (subscription?.onEose) {
            subscription.onEose()
          }
          break
        }
        case 'OK': {
          const [eventId, success, message] = args
          if (!success) {
            console.warn(`Event rejected by ${relayUrl}: ${message}`)
          }
          break
        }
        case 'NOTICE': {
          console.log(`Notice from ${relayUrl}: ${args[0]}`)
          break
        }
      }
    } catch (error) {
      console.error('Failed to parse relay message:', error)
    }
  }

  private notifyStatusChange(): void {
    const statuses = this.getStatuses()
    for (const listener of this.statusListeners) {
      listener(statuses)
    }
  }
}

// Singleton instance
export const relayService = new NostrRelayService()
