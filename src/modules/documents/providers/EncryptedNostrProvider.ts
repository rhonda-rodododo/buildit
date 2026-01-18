/**
 * EncryptedNostrProvider - Privacy-preserving CRDT sync over Nostr
 *
 * This custom Yjs provider syncs CRDT updates over Nostr relays using NIP-17 encryption.
 * It wraps Yjs binary updates in gift-wrapped events to ensure zero-knowledge relay architecture.
 *
 * Architecture:
 * - Yjs Y.Doc emits binary updates (Uint8Array)
 * - Updates are encrypted with NIP-17 (rumor → seal → gift wrap)
 * - Encrypted events sent to Nostr relays (kind 9001 for CRDT sync)
 * - Other participants decrypt and apply updates to their Y.Doc
 *
 * Privacy guarantees:
 * - Relays cannot read document content or edits
 * - Metadata is protected via randomized timestamps
 * - Only group members with keys can decrypt
 */

import * as Y from 'yjs'
import { Observable } from 'lib0/observable'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import { createRumor, createSeal, createGiftWrap, unwrapGiftWrap } from '@/core/crypto/nip17'
import type { NostrClient } from '@/core/nostr/client'
import type { GiftWrap } from '@/types/nostr'
import type { Event as NostrEvent } from 'nostr-tools'

// Custom event kind for CRDT sync (following nostr-crdt pattern)
const CRDT_SYNC_KIND = 9001
const CRDT_ROOM_KIND = 9000

export interface EncryptedNostrProviderConfig {
  doc: Y.Doc
  nostrClient: NostrClient
  senderPrivateKey: Uint8Array
  recipientPubkeys: string[] // Group members
  roomId: string // Document/room identifier
  awareness?: awarenessProtocol.Awareness
}

/**
 * Message types for CRDT sync protocol
 */
enum MessageType {
  SYNC_STEP1 = 0,
  SYNC_STEP2 = 1,
  SYNC_UPDATE = 2,
  AWARENESS = 3,
}

/**
 * EncryptedNostrProvider - Yjs provider for encrypted Nostr sync
 */
export class EncryptedNostrProvider extends Observable<string> {
  private doc: Y.Doc
  private nostrClient: NostrClient
  private senderPrivateKey: Uint8Array
  private recipientPubkeys: string[]
  private roomId: string
  private awareness: awarenessProtocol.Awareness | null

  private subscriptionId: string | null = null
  private _synced = false

  // Track connected state
  private _connected = false

  constructor(config: EncryptedNostrProviderConfig) {
    super()

    this.doc = config.doc
    this.nostrClient = config.nostrClient
    this.senderPrivateKey = config.senderPrivateKey
    this.recipientPubkeys = config.recipientPubkeys
    this.roomId = config.roomId
    this.awareness = config.awareness || null

    // Bind document update handler
    this._docUpdateHandler = this._docUpdateHandler.bind(this)
    this._awarenessUpdateHandler = this._awarenessUpdateHandler.bind(this)

    // Listen to document updates
    this.doc.on('update', this._docUpdateHandler)

    // Listen to awareness updates (cursor positions, etc.)
    if (this.awareness) {
      this.awareness.on('update', this._awarenessUpdateHandler)
    }

    // Start syncing
    this.connect()
  }

  /**
   * Connect to Nostr relays and start syncing
   */
  async connect(): Promise<void> {
    if (this._connected) return

    try {
      // Subscribe to CRDT events for this room
      this.subscriptionId = this.nostrClient.subscribe(
        [
          {
            kinds: [CRDT_SYNC_KIND, CRDT_ROOM_KIND],
            '#e': [this.roomId], // Events tagged with room ID
          },
        ],
        this._handleNostrEvent.bind(this),
        this._handleEOSE.bind(this)
      )

      this._connected = true
      this.emit('status', [{ status: 'connected' }])

      // Send sync request to get current state
      await this._sendSyncStep1()
    } catch (error) {
      console.error('Failed to connect to Nostr:', error)
      this.emit('status', [{ status: 'error', error }])
    }
  }

  /**
   * Disconnect from Nostr relays
   */
  disconnect(): void {
    if (!this._connected) return

    if (this.subscriptionId) {
      this.nostrClient.unsubscribe(this.subscriptionId)
      this.subscriptionId = null
    }

    this._connected = false
    this.emit('status', [{ status: 'disconnected' }])
  }

  /**
   * Destroy provider and cleanup
   */
  destroy(): void {
    this.disconnect()

    // Remove listeners
    this.doc.off('update', this._docUpdateHandler)
    if (this.awareness) {
      this.awareness.off('update', this._awarenessUpdateHandler)
    }

    super.destroy()
  }

  /**
   * Check if provider is connected
   */
  get connected(): boolean {
    return this._connected
  }

  /**
   * Check if initial sync is complete
   */
  get isSynced(): boolean {
    return this._synced
  }

  /**
   * Handle document updates from local changes
   */
  private _docUpdateHandler(update: Uint8Array, origin: any): void {
    // Don't broadcast updates that came from network
    if (origin === this) return

    // Broadcast update to other peers
    this._broadcastUpdate(update)
  }

  /**
   * Handle awareness updates (cursor positions, user presence)
   */
  private _awarenessUpdateHandler({ added, updated, removed }: any): void {
    const changedClients = added.concat(updated).concat(removed)
    if (changedClients.length === 0) return

    // Encode awareness update
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MessageType.AWARENESS)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness!, changedClients))

    // Broadcast awareness update
    this._broadcastMessage(encoding.toUint8Array(encoder))
  }

  /**
   * Broadcast a Yjs update to all peers
   */
  private async _broadcastUpdate(update: Uint8Array): Promise<void> {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MessageType.SYNC_UPDATE)
    encoding.writeVarUint8Array(encoder, update)

    await this._broadcastMessage(encoding.toUint8Array(encoder))
  }

  /**
   * Send sync step 1 request (get state vector)
   */
  private async _sendSyncStep1(): Promise<void> {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MessageType.SYNC_STEP1)
    encoding.writeVarUint8Array(encoder, Y.encodeStateVector(this.doc))

    await this._broadcastMessage(encoding.toUint8Array(encoder))
  }

  /**
   * Broadcast a protocol message to all group members
   */
  private async _broadcastMessage(message: Uint8Array): Promise<void> {
    // Convert Uint8Array to base64 for JSON serialization
    const messageBase64 = Buffer.from(message).toString('base64')

    // Create encrypted events for each recipient
    const giftWraps = this.recipientPubkeys.map(recipientPubkey => {
      // Create rumor with CRDT message
      const rumor = createRumor(
        CRDT_SYNC_KIND,
        messageBase64,
        recipientPubkey,
        [['e', this.roomId]] // Tag with room ID
      )

      // Create seal
      const seal = createSeal(rumor, this.senderPrivateKey)

      // Create gift wrap
      return createGiftWrap(seal, recipientPubkey)
    })

    // Publish all gift wraps
    await Promise.all(
      giftWraps.map(giftWrap => this.nostrClient.publish(giftWrap as NostrEvent))
    )
  }

  /**
   * Handle incoming Nostr event
   */
  private async _handleNostrEvent(event: NostrEvent): Promise<void> {
    try {
      // Unwrap gift wrap to get message
      const unwrapped = unwrapGiftWrap(event as GiftWrap, this.senderPrivateKey)

      // Decode message from base64
      const messageBase64 = unwrapped.rumor.content
      const message = new Uint8Array(Buffer.from(messageBase64, 'base64'))

      // Process sync message
      this._processSyncMessage(message)
    } catch (error) {
      console.error('Failed to process Nostr event:', error)
    }
  }

  /**
   * Process a decoded sync protocol message
   */
  private _processSyncMessage(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)

    switch (messageType) {
      case MessageType.SYNC_STEP1: {
        // Peer is requesting state - send them missing updates
        const stateVector = decoding.readVarUint8Array(decoder)
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MessageType.SYNC_STEP2)
        encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(this.doc, stateVector))
        this._broadcastMessage(encoding.toUint8Array(encoder))
        break
      }

      case MessageType.SYNC_STEP2: {
        // Receiving state update from peer
        const update = decoding.readVarUint8Array(decoder)
        Y.applyUpdate(this.doc, update, this)

        if (!this._synced) {
          this._synced = true
          this.emit('synced', [{ synced: true }])
        }
        break
      }

      case MessageType.SYNC_UPDATE: {
        // Receiving incremental update from peer
        const update = decoding.readVarUint8Array(decoder)
        Y.applyUpdate(this.doc, update, this)
        break
      }

      case MessageType.AWARENESS: {
        // Receiving awareness update (cursors, presence)
        if (this.awareness) {
          const update = decoding.readVarUint8Array(decoder)
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this)
        }
        break
      }
    }
  }

  /**
   * Handle EOSE (End of Stored Events)
   */
  private _handleEOSE(): void {
    console.info('Initial sync complete (EOSE)')

    // If we haven't synced yet, mark as synced
    if (!this._synced) {
      this._synced = true
      this.emit('synced', [{ synced: true }])
    }
  }
}

/**
 * Create a document room event to announce a new collaborative document
 */
export async function createDocumentRoom(
  nostrClient: NostrClient,
  senderPrivateKey: Uint8Array,
  recipientPubkeys: string[],
  documentId: string,
  documentTitle: string
): Promise<void> {
  const roomData = {
    documentId,
    title: documentTitle,
    created: Date.now(),
  }

  // Broadcast room creation to all members
  const giftWraps = recipientPubkeys.map(recipientPubkey => {
    const rumor = createRumor(
      CRDT_ROOM_KIND,
      JSON.stringify(roomData),
      recipientPubkey,
      [['e', documentId]]
    )
    const seal = createSeal(rumor, senderPrivateKey)
    return createGiftWrap(seal, recipientPubkey)
  })

  await Promise.all(
    giftWraps.map(giftWrap => nostrClient.publish(giftWrap as NostrEvent))
  )
}
