/**
 * Schema Versioning Module
 *
 * Provides graceful degradation for schema versioning, ensuring
 * crisis-scenario interoperability across all client versions.
 *
 * Key features:
 * - Unknown field preservation for relay forwarding
 * - Version comparison utilities
 * - Compatibility status checking
 * - Module-specific parsers
 */

// Types
export type {
  SemanticVersion,
  VersionedContent,
  ParseResult,
  SchemaMetadata,
  VersionComparison,
  CompatibilityStatus,
  ModuleVersionInfo,
  ModuleRegistry,
  SchemaBundle,
  DeviceSchemaInfo
} from './types'

// Version utilities
export {
  parseVersion,
  createVersion,
  compareVersions,
  isAtLeast,
  isWithinSupportWindow,
  getCompatibilityStatus,
  isFromFuture,
  getCurrentSchemaVersion
} from './versionUtils'

// Parser
export {
  parseVersionedContent,
  serializeVersionedContent,
  createKnownFieldsSet,
  parseVersionedArray,
  hasAnyUnknownFields,
  getHighestVersion,
  moduleParsers
} from './parser'
