/**
 * BLE Schema Sync Protocol
 *
 * Handles schema bundle distribution over BLE mesh network.
 * Enables offline schema updates between nearby devices.
 */

import type { SchemaBundle, DeviceSchemaInfo, SemanticVersion } from './types'
import { compareVersions, getAllModuleVersions } from './versionUtils'
import { verifyBundleSignature } from './bundleVerifier'

/**
 * BLE Schema Sync message types
 */
export enum SchemaSyncMessageType {
  /** Request schema version info from nearby devices */
  VERSION_REQUEST = 'schema_version_req',
  /** Response with device's schema versions */
  VERSION_RESPONSE = 'schema_version_resp',
  /** Request a schema bundle */
  BUNDLE_REQUEST = 'schema_bundle_req',
  /** Bundle chunk data */
  BUNDLE_CHUNK = 'schema_bundle_chunk',
  /** Bundle transfer complete */
  BUNDLE_COMPLETE = 'schema_bundle_complete',
  /** Acknowledge chunk received */
  CHUNK_ACK = 'schema_chunk_ack'
}

/**
 * Schema sync message structure
 */
export interface SchemaSyncMessage {
  type: SchemaSyncMessageType
  /** Sender's device ID */
  deviceId: string
  /** Timestamp */
  timestamp: number
  /** Message payload */
  payload: unknown
}

/**
 * Version response payload
 */
export interface VersionResponsePayload {
  /** Client version */
  clientVersion: string
  /** Schema versions by module */
  schemaVersions: Record<string, SemanticVersion>
  /** Last schema update timestamp */
  lastSchemaUpdate: number
  /** Whether device has a full bundle available */
  hasBundleAvailable: boolean
  /** Bundle content hash (if available) */
  bundleHash?: string
}

/**
 * Bundle chunk payload
 */
export interface BundleChunkPayload {
  /** Total number of chunks */
  totalChunks: number
  /** Chunk index (0-based) */
  chunkIndex: number
  /** Chunk data (base64) */
  data: string
  /** Bundle hash (only in first chunk) */
  bundleHash?: string
}

/**
 * Chunk acknowledgment payload
 */
export interface ChunkAckPayload {
  /** Acknowledged chunk index */
  chunkIndex: number
  /** Request retransmit if needed */
  requestRetransmit?: boolean
}

/**
 * BLE Schema Sync Manager
 *
 * Manages schema synchronization over BLE mesh.
 */
export class BLESchemaSyncManager {
  private deviceId: string
  private localBundle: SchemaBundle | null = null
  private receivedChunks: Map<number, string> = new Map()
  private expectedChunks: number = 0
  private targetBundleHash: string | null = null
  private onBundleReceived: ((bundle: SchemaBundle) => void) | null = null
  private sendMessage: ((message: SchemaSyncMessage) => Promise<void>) | null = null

  constructor(deviceId: string) {
    this.deviceId = deviceId
  }

  /**
   * Set the local schema bundle for sharing
   */
  setLocalBundle(bundle: SchemaBundle): void {
    this.localBundle = bundle
  }

  /**
   * Set callback for when a bundle is received
   */
  onBundle(callback: (bundle: SchemaBundle) => void): void {
    this.onBundleReceived = callback
  }

  /**
   * Set the message sending function
   */
  setSendFunction(send: (message: SchemaSyncMessage) => Promise<void>): void {
    this.sendMessage = send
  }

  /**
   * Handle an incoming schema sync message
   */
  async handleMessage(message: SchemaSyncMessage): Promise<void> {
    switch (message.type) {
      case SchemaSyncMessageType.VERSION_REQUEST:
        await this.handleVersionRequest(message)
        break

      case SchemaSyncMessageType.VERSION_RESPONSE:
        await this.handleVersionResponse(message)
        break

      case SchemaSyncMessageType.BUNDLE_REQUEST:
        await this.handleBundleRequest(message)
        break

      case SchemaSyncMessageType.BUNDLE_CHUNK:
        await this.handleBundleChunk(message)
        break

      case SchemaSyncMessageType.BUNDLE_COMPLETE:
        await this.handleBundleComplete(message)
        break

      case SchemaSyncMessageType.CHUNK_ACK:
        // Acknowledgment received, could implement retry logic here
        break
    }
  }

  /**
   * Request schema versions from nearby devices
   */
  async requestVersions(): Promise<void> {
    await this.send({
      type: SchemaSyncMessageType.VERSION_REQUEST,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      payload: {}
    })
  }

  /**
   * Request a schema bundle from a specific device
   */
  async requestBundle(targetDeviceId: string, bundleHash: string): Promise<void> {
    this.receivedChunks.clear()
    this.targetBundleHash = bundleHash

    await this.send({
      type: SchemaSyncMessageType.BUNDLE_REQUEST,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      payload: {
        targetDeviceId,
        bundleHash
      }
    })
  }

  /**
   * Get local device schema info
   */
  getLocalSchemaInfo(): DeviceSchemaInfo {
    const schemaVersions = getAllModuleVersions()

    return {
      clientVersion: '0.74.0', // Would come from package.json in production
      schemaVersions,
      lastSchemaUpdate: this.localBundle?.createdAt ?? 0
    }
  }

  /**
   * Check if we need a schema update based on another device's info
   */
  needsUpdate(remoteInfo: DeviceSchemaInfo): boolean {
    const localInfo = this.getLocalSchemaInfo()

    for (const [moduleId, remoteVersion] of Object.entries(remoteInfo.schemaVersions)) {
      const localVersion = localInfo.schemaVersions[moduleId]
      if (!localVersion || compareVersions(localVersion, remoteVersion) === 'older') {
        return true
      }
    }

    return false
  }

  // Private methods

  private async send(message: SchemaSyncMessage): Promise<void> {
    if (this.sendMessage) {
      await this.sendMessage(message)
    }
  }

  private async handleVersionRequest(_message: SchemaSyncMessage): Promise<void> {
    const payload: VersionResponsePayload = {
      clientVersion: '0.74.0',
      schemaVersions: this.getLocalSchemaInfo().schemaVersions,
      lastSchemaUpdate: this.localBundle?.createdAt ?? 0,
      hasBundleAvailable: this.localBundle !== null,
      bundleHash: this.localBundle?.contentHash
    }

    await this.send({
      type: SchemaSyncMessageType.VERSION_RESPONSE,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      payload
    })
  }

  private async handleVersionResponse(message: SchemaSyncMessage): Promise<void> {
    const payload = message.payload as VersionResponsePayload

    // Check if we need their bundle
    if (payload.hasBundleAvailable && payload.bundleHash) {
      const remoteInfo: DeviceSchemaInfo = {
        clientVersion: payload.clientVersion,
        schemaVersions: payload.schemaVersions,
        lastSchemaUpdate: payload.lastSchemaUpdate
      }

      if (this.needsUpdate(remoteInfo)) {
        await this.requestBundle(message.deviceId, payload.bundleHash)
      }
    }
  }

  private async handleBundleRequest(message: SchemaSyncMessage): Promise<void> {
    if (!this.localBundle) return

    const { bundleHash } = message.payload as { targetDeviceId: string; bundleHash: string }
    if (bundleHash !== this.localBundle.contentHash) return

    // Send bundle in chunks
    const json = JSON.stringify(this.localBundle)
    const encoder = new TextEncoder()
    const data = encoder.encode(json)
    const base64 = btoa(String.fromCharCode(...data))

    const chunkSize = 1500 // BLE-friendly chunk size
    const chunks: string[] = []

    for (let i = 0; i < base64.length; i += chunkSize) {
      chunks.push(base64.slice(i, i + chunkSize))
    }

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkPayload: BundleChunkPayload = {
        totalChunks: chunks.length,
        chunkIndex: i,
        data: chunks[i],
        ...(i === 0 ? { bundleHash: this.localBundle.contentHash } : {})
      }

      await this.send({
        type: SchemaSyncMessageType.BUNDLE_CHUNK,
        deviceId: this.deviceId,
        timestamp: Date.now(),
        payload: chunkPayload
      })

      // Small delay between chunks to avoid flooding
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Signal completion
    await this.send({
      type: SchemaSyncMessageType.BUNDLE_COMPLETE,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      payload: { bundleHash: this.localBundle.contentHash }
    })
  }

  private async handleBundleChunk(message: SchemaSyncMessage): Promise<void> {
    const payload = message.payload as BundleChunkPayload

    // Store hash from first chunk
    if (payload.chunkIndex === 0 && payload.bundleHash) {
      this.targetBundleHash = payload.bundleHash
      this.expectedChunks = payload.totalChunks
    }

    this.receivedChunks.set(payload.chunkIndex, payload.data)

    // Send acknowledgment
    await this.send({
      type: SchemaSyncMessageType.CHUNK_ACK,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      payload: { chunkIndex: payload.chunkIndex } as ChunkAckPayload
    })
  }

  private async handleBundleComplete(message: SchemaSyncMessage): Promise<void> {
    const { bundleHash } = message.payload as { bundleHash: string }

    if (bundleHash !== this.targetBundleHash) return
    if (this.receivedChunks.size !== this.expectedChunks) {
      console.warn('Bundle incomplete, missing chunks')
      return
    }

    // Reassemble bundle
    const chunks: string[] = []
    for (let i = 0; i < this.expectedChunks; i++) {
      const chunk = this.receivedChunks.get(i)
      if (!chunk) {
        console.error(`Missing chunk ${i}`)
        return
      }
      chunks.push(chunk)
    }

    const base64 = chunks.join('')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    try {
      const json = new TextDecoder().decode(bytes)
      const bundle = JSON.parse(json) as SchemaBundle

      // SECURITY: Verify Ed25519 signature before accepting bundle
      // This prevents malicious bundles from being injected via BLE
      const verification = await verifyBundleSignature(bundle)
      if (!verification.valid) {
        console.error('Bundle signature verification failed:', verification.error)
        return
      }

      this.onBundleReceived?.(bundle)
    } catch (error) {
      console.error('Failed to parse bundle:', error)
    }

    // Clean up
    this.receivedChunks.clear()
    this.expectedChunks = 0
    this.targetBundleHash = null
  }
}
