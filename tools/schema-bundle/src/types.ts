/**
 * Schema Bundle Types
 *
 * Types for schema bundle generation and verification.
 */

/**
 * Schema metadata from module registry
 */
export interface SchemaMetadata {
  moduleId: string
  name: string
  description: string
  currentVersion: string
  versions: string[]
  dependencies: string[]
  schemaPath: string
  coreDependency?: boolean
}

/**
 * Module schema with full content
 */
export interface ModuleSchema extends SchemaMetadata {
  /** Full JSON Schema content */
  schema: object
}

/**
 * Schema bundle for distribution
 */
export interface SchemaBundle {
  /** Bundle format version */
  bundleVersion: string
  /** Bundle creation timestamp (Unix ms) */
  createdAt: number
  /** SHA-256 hash of serialized modules */
  contentHash: string
  /** Ed25519 signature of content hash */
  signature: string
  /** Signer's public key (hex) */
  signerPubkey: string
  /** Registry version */
  registryVersion: string
  /** Compatibility policy */
  compatibilityPolicy: {
    supportWindow: string
    coreMessagingSupport: string
    breakingChangeNotice: string
  }
  /** Included module schemas */
  modules: Record<string, ModuleSchema>
}

/**
 * Bundle verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  valid: boolean
  /** Error message if invalid */
  error?: string
  /** Verified bundle metadata */
  metadata?: {
    createdAt: number
    registryVersion: string
    moduleCount: number
    signerPubkey: string
  }
}

/**
 * QR code chunk for schema transfer
 */
export interface QRChunk {
  /** Total number of chunks */
  total: number
  /** Chunk index (0-based) */
  index: number
  /** Chunk data (base64) */
  data: string
  /** Content hash (first chunk only) */
  hash?: string
}

/**
 * BLE schema sync message types
 */
export enum BLESchemaSyncType {
  /** Request available schema versions */
  VERSION_REQUEST = 'schema_version_req',
  /** Response with version info */
  VERSION_RESPONSE = 'schema_version_resp',
  /** Request schema bundle */
  BUNDLE_REQUEST = 'schema_bundle_req',
  /** Bundle chunk */
  BUNDLE_CHUNK = 'schema_bundle_chunk',
  /** Bundle complete */
  BUNDLE_COMPLETE = 'schema_bundle_complete'
}

/**
 * BLE schema sync message
 */
export interface BLESchemaSyncMessage {
  type: BLESchemaSyncType
  /** Message payload */
  payload: unknown
  /** Sender's device ID */
  deviceId: string
  /** Timestamp */
  timestamp: number
}
