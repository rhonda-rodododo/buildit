/**
 * Schema Version Utilities
 *
 * Utilities for comparing, parsing, and managing schema versions.
 */

import type { SemanticVersion, VersionComparison, CompatibilityStatus, SchemaMetadata } from './types'

/**
 * Parse a semantic version string into components
 */
export function parseVersion(version: SemanticVersion): { major: number; minor: number; patch: number } {
  const parts = version.split('.').map(Number)
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0
  }
}

/**
 * Create a semantic version string from components
 */
export function createVersion(major: number, minor: number, patch: number): SemanticVersion {
  return `${major}.${minor}.${patch}` as SemanticVersion
}

/**
 * Compare two semantic versions
 * Returns: 'older' if a < b, 'same' if a == b, 'newer' if a > b
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): VersionComparison {
  const vA = parseVersion(a)
  const vB = parseVersion(b)

  if (vA.major !== vB.major) {
    return vA.major < vB.major ? 'older' : 'newer'
  }
  if (vA.minor !== vB.minor) {
    return vA.minor < vB.minor ? 'older' : 'newer'
  }
  if (vA.patch !== vB.patch) {
    return vA.patch < vB.patch ? 'older' : 'newer'
  }
  return 'same'
}

/**
 * Check if version a is at least version b
 */
export function isAtLeast(a: SemanticVersion, b: SemanticVersion): boolean {
  const comparison = compareVersions(a, b)
  return comparison === 'same' || comparison === 'newer'
}

/**
 * Check if a version is within the support window
 */
export function isWithinSupportWindow(
  contentVersion: SemanticVersion,
  currentVersion: SemanticVersion,
  supportMonths: number = 6
): boolean {
  const content = parseVersion(contentVersion)
  const current = parseVersion(currentVersion)

  // Major version must match
  if (content.major !== current.major) {
    return false
  }

  // Allow any minor version within the major version
  // This is a simplified check - in production, use timestamps
  return true
}

/**
 * Get compatibility status for content with a specific version
 */
export function getCompatibilityStatus(
  contentVersion: SemanticVersion,
  readerVersion: SemanticVersion,
  metadata?: SchemaMetadata
): CompatibilityStatus {
  const comparison = compareVersions(contentVersion, readerVersion)
  const now = Date.now()

  // Check deprecation and sunset
  const isDeprecated = metadata?.deprecatedAt != null && metadata.deprecatedAt < now
  let daysUntilSunset: number | null = null
  if (metadata?.sunsetAt) {
    daysUntilSunset = Math.max(0, Math.ceil((metadata.sunsetAt - now) / (24 * 60 * 60 * 1000)))
  }

  // Check minimum reader version requirement
  if (metadata?.minReaderVersion) {
    if (!isAtLeast(readerVersion, metadata.minReaderVersion)) {
      return {
        canRead: false,
        fullyCompatible: false,
        updateRecommended: true,
        isDeprecated,
        daysUntilSunset,
        message: `This content requires client version ${metadata.minReaderVersion} or newer`
      }
    }
  }

  // Same version - fully compatible
  if (comparison === 'same') {
    return {
      canRead: true,
      fullyCompatible: true,
      updateRecommended: false,
      isDeprecated,
      daysUntilSunset,
      message: 'Content is fully compatible'
    }
  }

  // Older content version - we can read it
  if (comparison === 'older') {
    return {
      canRead: true,
      fullyCompatible: true,
      updateRecommended: false,
      isDeprecated,
      daysUntilSunset,
      message: 'Content from older version, fully readable'
    }
  }

  // Newer content version - might have unknown fields
  const content = parseVersion(contentVersion)
  const reader = parseVersion(readerVersion)

  // Same major version - can read with possible unknown fields
  if (content.major === reader.major) {
    return {
      canRead: true,
      fullyCompatible: false,
      updateRecommended: true,
      isDeprecated,
      daysUntilSunset,
      message: 'Newer content version - some features may not be visible'
    }
  }

  // Different major version - may not be readable
  return {
    canRead: false,
    fullyCompatible: false,
    updateRecommended: true,
    isDeprecated,
    daysUntilSunset,
    message: `Content requires a newer client version (${contentVersion})`
  }
}

/**
 * Check if content version is from the future (newer than our reader)
 */
export function isFromFuture(contentVersion: SemanticVersion, readerVersion: SemanticVersion): boolean {
  return compareVersions(contentVersion, readerVersion) === 'newer'
}

/**
 * Get the current app schema version for a module
 */
export function getCurrentSchemaVersion(moduleId: string): SemanticVersion {
  // In production, this would be imported from generated types
  // For now, return 1.0.0 as the base version
  const versions: Record<string, SemanticVersion> = {
    'messaging': '1.0.0',
    'events': '1.0.0',
    'documents': '1.0.0',
    'files': '1.0.0',
    'forms': '1.0.0',
    'crm': '1.0.0',
    'database': '1.0.0',
    'fundraising': '1.0.0',
    'publishing': '1.0.0',
    'newsletters': '1.0.0',
    'governance': '1.0.0',
    'mutual-aid': '1.0.0',
    'wiki': '1.0.0',
    'custom-fields': '1.0.0'
  }
  return versions[moduleId] ?? '1.0.0'
}
