/**
 * Device Linking Service - NIP-46 Remote Signing
 *
 * Implements NIP-46 (Nostr Connect) for device linking.
 * Allows the mobile app to act as a remote signer client,
 * receiving signing capabilities from a primary device (bunker).
 *
 * Security:
 * - Uses ephemeral keypairs for each connection
 * - NIP-44 encryption for all communication
 * - Connection approval required from bunker
 * - Revocable permissions
 */

import * as nip44 from 'nostr-tools/nip44'
import { getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools/pure'
import type { Event, Filter } from 'nostr-tools'
import { relayService } from './nostrRelay'
import { setSecureItem, getSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

// NIP-46 event kinds
const NIP46_REQUEST_KIND = 24133
const NIP46_RESPONSE_KIND = 24133

/**
 * Parsed NIP-46 bunker/nostrconnect URL
 */
export interface Nip46ConnectionData {
  bunkerUrl: string
  bunkerPubkey: string
  relay: string
  secret?: string
}

/**
 * NIP-46 connection status
 */
export type Nip46ConnectionStatus =
  | 'connecting'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'error'
  | 'disconnected'

/**
 * Stored bunker connection
 */
export interface BunkerConnection {
  id: string
  bunkerPubkey: string
  clientPubkey: string
  relay: string
  name: string
  status: Nip46ConnectionStatus
  permissions: string[]
  createdAt: number
  lastUsed: number
}

/**
 * NIP-46 request payload
 */
interface Nip46Request {
  id: string
  method: string
  params: unknown[]
}

/**
 * NIP-46 response payload
 */
interface Nip46Response {
  id: string
  result?: unknown
  error?: string
}

/**
 * Connection session state
 */
interface ConnectionSession {
  bunkerPubkey: string
  clientSecretKey: Uint8Array
  clientPubkey: string
  relay: string
  secret?: string
  status: Nip46ConnectionStatus
  subscriptionId?: string
  pendingRequests: Map<string, {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }>
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30_000

class DeviceLinkingService {
  private static instance: DeviceLinkingService

  // Active sessions by bunker pubkey
  private sessions: Map<string, ConnectionSession> = new Map()

  // Status listeners
  private statusListeners: Set<(bunkerPubkey: string, status: Nip46ConnectionStatus) => void> =
    new Set()

  private constructor() {}

  public static getInstance(): DeviceLinkingService {
    if (!DeviceLinkingService.instance) {
      DeviceLinkingService.instance = new DeviceLinkingService()
    }
    return DeviceLinkingService.instance
  }

  /**
   * Parse a NIP-46 bunker or nostrconnect URL
   */
  public parseConnectionUrl(url: string): Nip46ConnectionData | null {
    try {
      const parsed = new URL(url)

      if (parsed.protocol !== 'bunker:' && parsed.protocol !== 'nostrconnect:') {
        return null
      }

      // Get pubkey from hostname or path
      const bunkerPubkey = parsed.hostname || parsed.pathname.replace('//', '')
      const relay = parsed.searchParams.get('relay')
      const secret = parsed.searchParams.get('secret') || undefined

      if (!bunkerPubkey || !relay) {
        return null
      }

      return {
        bunkerUrl: url,
        bunkerPubkey,
        relay: decodeURIComponent(relay),
        secret,
      }
    } catch {
      return null
    }
  }

  /**
   * Connect to a bunker using NIP-46
   */
  public async connect(data: Nip46ConnectionData): Promise<BunkerConnection> {
    // Generate ephemeral client keypair
    const clientSecretKey = generateSecretKey()
    const clientPubkey = getPublicKey(clientSecretKey)

    // Create session
    const session: ConnectionSession = {
      bunkerPubkey: data.bunkerPubkey,
      clientSecretKey,
      clientPubkey,
      relay: data.relay,
      secret: data.secret,
      status: 'connecting',
      pendingRequests: new Map(),
    }

    this.sessions.set(data.bunkerPubkey, session)
    this.emitStatusChange(data.bunkerPubkey, 'connecting')

    // Connect to the relay if not already connected
    await relayService.connect([{ url: data.relay, read: true, write: true }])

    // Subscribe to responses from the bunker
    const filter: Filter = {
      kinds: [NIP46_RESPONSE_KIND],
      '#p': [clientPubkey],
      authors: [data.bunkerPubkey],
    }

    const subscriptionId = relayService.subscribe(
      [filter],
      (event) => this.handleResponse(event),
      () => console.log('NIP-46 subscription EOSE')
    )
    session.subscriptionId = subscriptionId

    // Send connect request
    try {
      session.status = 'awaiting_approval'
      this.emitStatusChange(data.bunkerPubkey, 'awaiting_approval')

      const result = await this.sendRequest(data.bunkerPubkey, 'connect', [
        clientPubkey,
        data.secret || '',
        // Request permissions
        'sign_event',
        'nip44_encrypt',
        'nip44_decrypt',
        'get_public_key',
      ])

      if (result === 'ack' || result === clientPubkey) {
        session.status = 'approved'
        this.emitStatusChange(data.bunkerPubkey, 'approved')

        // Save connection
        const connection = await this.saveConnection({
          bunkerPubkey: data.bunkerPubkey,
          clientPubkey,
          relay: data.relay,
          status: 'approved',
        })

        return connection
      } else {
        throw new Error('Unexpected connect response')
      }
    } catch (error) {
      session.status = 'error'
      this.emitStatusChange(data.bunkerPubkey, 'error')
      this.sessions.delete(data.bunkerPubkey)
      throw error
    }
  }

  /**
   * Disconnect from a bunker
   */
  public disconnect(bunkerPubkey: string): void {
    const session = this.sessions.get(bunkerPubkey)
    if (session) {
      // Unsubscribe from responses
      if (session.subscriptionId) {
        relayService.unsubscribe(session.subscriptionId)
      }

      // Cancel pending requests
      for (const pending of session.pendingRequests.values()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Disconnected'))
      }

      this.sessions.delete(bunkerPubkey)
      this.emitStatusChange(bunkerPubkey, 'disconnected')
    }
  }

  /**
   * Get the public key from a connected bunker
   */
  public async getPublicKey(bunkerPubkey: string): Promise<string> {
    const result = await this.sendRequest(bunkerPubkey, 'get_public_key', [])
    return result as string
  }

  /**
   * Sign an event via the bunker
   */
  public async signEvent(
    bunkerPubkey: string,
    event: Partial<Event>
  ): Promise<Event> {
    const result = await this.sendRequest(bunkerPubkey, 'sign_event', [
      JSON.stringify(event),
    ])

    if (typeof result === 'string') {
      return JSON.parse(result) as Event
    }
    return result as Event
  }

  /**
   * Encrypt with NIP-44 via the bunker
   */
  public async nip44Encrypt(
    bunkerPubkey: string,
    recipientPubkey: string,
    plaintext: string
  ): Promise<string> {
    const result = await this.sendRequest(bunkerPubkey, 'nip44_encrypt', [
      recipientPubkey,
      plaintext,
    ])
    return result as string
  }

  /**
   * Decrypt with NIP-44 via the bunker
   */
  public async nip44Decrypt(
    bunkerPubkey: string,
    senderPubkey: string,
    ciphertext: string
  ): Promise<string> {
    const result = await this.sendRequest(bunkerPubkey, 'nip44_decrypt', [
      senderPubkey,
      ciphertext,
    ])
    return result as string
  }

  /**
   * Get saved connections
   */
  public async getSavedConnections(): Promise<BunkerConnection[]> {
    const stored = await getSecureItem(STORAGE_KEYS.BUNKER_CONNECTIONS)
    if (!stored) return []

    try {
      return JSON.parse(stored) as BunkerConnection[]
    } catch {
      return []
    }
  }

  /**
   * Delete a saved connection
   */
  public async deleteConnection(connectionId: string): Promise<void> {
    const connections = await this.getSavedConnections()
    const connection = connections.find((c) => c.id === connectionId)

    if (connection) {
      // Disconnect if active
      this.disconnect(connection.bunkerPubkey)

      // Remove from storage
      const updated = connections.filter((c) => c.id !== connectionId)
      await setSecureItem(STORAGE_KEYS.BUNKER_CONNECTIONS, JSON.stringify(updated))
    }
  }

  /**
   * Subscribe to status changes
   */
  public onStatusChange(
    listener: (bunkerPubkey: string, status: Nip46ConnectionStatus) => void
  ): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /**
   * Get connection status
   */
  public getStatus(bunkerPubkey: string): Nip46ConnectionStatus | null {
    const session = this.sessions.get(bunkerPubkey)
    return session?.status || null
  }

  // Private methods

  private async sendRequest(
    bunkerPubkey: string,
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    const session = this.sessions.get(bunkerPubkey)
    if (!session) {
      throw new Error('Not connected to bunker')
    }

    const requestId = crypto.randomUUID()

    // Create NIP-46 request
    const request: Nip46Request = {
      id: requestId,
      method,
      params,
    }

    // Encrypt the request with NIP-44
    const conversationKey = nip44.getConversationKey(
      session.clientSecretKey,
      bunkerPubkey
    )
    const encryptedContent = nip44.encrypt(JSON.stringify(request), conversationKey)

    // Create and sign the request event
    const eventTemplate = {
      kind: NIP46_REQUEST_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', bunkerPubkey]],
      content: encryptedContent,
    }

    const signedEvent = finalizeEvent(eventTemplate, session.clientSecretKey)

    // Create promise for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.pendingRequests.delete(requestId)
        reject(new Error(`Request timed out: ${method}`))
      }, REQUEST_TIMEOUT_MS)

      session.pendingRequests.set(requestId, { resolve, reject, timeout })

      // Publish the request
      relayService.publish(signedEvent).catch(reject)
    })
  }

  private handleResponse(event: Event): void {
    // Find the session this response belongs to
    const session = this.sessions.get(event.pubkey)
    if (!session) {
      console.warn('Received response from unknown bunker:', event.pubkey.slice(0, 8))
      return
    }

    try {
      // Decrypt the response
      const conversationKey = nip44.getConversationKey(
        session.clientSecretKey,
        event.pubkey
      )
      const decrypted = nip44.decrypt(event.content, conversationKey)
      const response: Nip46Response = JSON.parse(decrypted)

      // Find pending request
      const pending = session.pendingRequests.get(response.id)
      if (!pending) {
        console.warn('Received response for unknown request:', response.id.slice(0, 8))
        return
      }

      clearTimeout(pending.timeout)
      session.pendingRequests.delete(response.id)

      if (response.error) {
        pending.reject(new Error(response.error))
      } else {
        pending.resolve(response.result)
      }
    } catch (error) {
      console.error('Failed to handle NIP-46 response:', error)
    }
  }

  private async saveConnection(data: {
    bunkerPubkey: string
    clientPubkey: string
    relay: string
    status: Nip46ConnectionStatus
  }): Promise<BunkerConnection> {
    const connections = await this.getSavedConnections()

    // Check if connection already exists
    const existing = connections.find((c) => c.bunkerPubkey === data.bunkerPubkey)
    if (existing) {
      existing.status = data.status
      existing.lastUsed = Date.now()
      await setSecureItem(STORAGE_KEYS.BUNKER_CONNECTIONS, JSON.stringify(connections))
      return existing
    }

    // Create new connection
    const connection: BunkerConnection = {
      id: crypto.randomUUID(),
      bunkerPubkey: data.bunkerPubkey,
      clientPubkey: data.clientPubkey,
      relay: data.relay,
      name: 'Linked Device',
      status: data.status,
      permissions: ['sign_event', 'nip44_encrypt', 'nip44_decrypt', 'get_public_key'],
      createdAt: Date.now(),
      lastUsed: Date.now(),
    }

    connections.push(connection)
    await setSecureItem(STORAGE_KEYS.BUNKER_CONNECTIONS, JSON.stringify(connections))

    return connection
  }

  private emitStatusChange(
    bunkerPubkey: string,
    status: Nip46ConnectionStatus
  ): void {
    this.statusListeners.forEach((listener) => listener(bunkerPubkey, status))
  }
}

// Singleton instance
export const deviceLinkingService = DeviceLinkingService.getInstance()
