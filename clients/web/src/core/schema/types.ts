/**
 * Schema Versioning Types
 *
 * Provides types for schema version handling and graceful degradation.
 * Ensures crisis-scenario interoperability across all client versions.
 */

/**
 * Semantic version string (e.g., "1.0.0")
 */
export type SemanticVersion = `${number}.${number}.${number}`

/**
 * Base type for all versioned schema content.
 * All module messages must include the _v field.
 */
export interface VersionedContent {
  /** Schema version that created this content */
  _v: SemanticVersion
  /** Unknown fields from newer schema versions (preserved for relay forwarding) */
  _unknownFields?: Record<string, unknown>
}

/**
 * Result of parsing versioned content
 */
export interface ParseResult<T extends VersionedContent> {
  /** Successfully parsed content */
  data: T
  /** Version of the content */
  version: SemanticVersion
  /** Whether parsing was partial (unknown fields present) */
  isPartial: boolean
  /** Fields that were not recognized by current schema */
  unknownFields: string[]
  /** Whether an update is recommended */
  updateRecommended: boolean
  /** Minimum reader version required (from schema) */
  minReaderVersion?: SemanticVersion
}

/**
 * Schema metadata for a module
 */
export interface SchemaMetadata {
  /** Module identifier */
  moduleId: string
  /** Current schema version */
  version: SemanticVersion
  /** Minimum reader version required */
  minReaderVersion: SemanticVersion
  /** When this version was deprecated (null if active) */
  deprecatedAt: number | null
  /** When this version will no longer be supported (null if active) */
  sunsetAt: number | null
  /** Whether this is a core module (messaging must never break) */
  coreModule?: boolean
}

/**
 * Version comparison result
 */
export type VersionComparison = 'older' | 'same' | 'newer'

/**
 * Schema compatibility status
 */
export interface CompatibilityStatus {
  /** Whether the content can be read */
  canRead: boolean
  /** Whether the content can be fully understood */
  fullyCompatible: boolean
  /** Whether an update is strongly recommended */
  updateRecommended: boolean
  /** Whether this version is deprecated */
  isDeprecated: boolean
  /** Days until sunset (null if not set) */
  daysUntilSunset: number | null
  /** Human-readable status message */
  message: string
}

/**
 * Module version info for UI display
 */
export interface ModuleVersionInfo {
  moduleId: string
  moduleName: string
  localVersion: SemanticVersion
  latestVersion?: SemanticVersion
  hasUpdate: boolean
  compatibility: CompatibilityStatus
}

/**
 * Known module schemas from the registry
 */
export interface ModuleRegistry {
  registryVersion: string
  modules: Record<string, SchemaMetadata>
  compatibilityPolicy: {
    supportWindow: string
    coreMessagingSupport: string
    breakingChangeNotice: string
  }
}

/**
 * Schema bundle for offline distribution
 */
export interface SchemaBundle {
  /** Bundle version */
  version: string
  /** Creation timestamp */
  createdAt: number
  /** SHA-256 hash of bundle content */
  contentHash: string
  /** Ed25519 signature of content hash */
  signature: string
  /** Signer's public key */
  signerPubkey: string
  /** Included module schemas */
  modules: Record<string, SchemaMetadata & { schema: object }>
}

/**
 * Device info schema version (for BLE discovery)
 */
export interface DeviceSchemaInfo {
  /** Current client version */
  clientVersion: string
  /** Supported schema versions by module */
  schemaVersions: Record<string, SemanticVersion>
  /** Timestamp of last schema update */
  lastSchemaUpdate: number
}
