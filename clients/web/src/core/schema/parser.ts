/**
 * Graceful Degradation Parser
 *
 * Parses versioned content while preserving unknown fields for relay forwarding.
 * Ensures content from newer schema versions can still be partially read.
 */

import type { SemanticVersion, VersionedContent, ParseResult, SchemaMetadata } from './types'
import { compareVersions, getCurrentSchemaVersion, getCompatibilityStatus, isFromFuture } from './versionUtils'

/**
 * Default schema version for content without _v field
 */
const DEFAULT_VERSION: SemanticVersion = '1.0.0'

/**
 * Parse versioned content with graceful degradation.
 *
 * This parser:
 * 1. Extracts the _v field to determine content version
 * 2. Identifies unknown fields not in the known schema
 * 3. Preserves unknown fields in _unknownFields for relay forwarding
 * 4. Returns parse result with compatibility info
 *
 * @param raw - Raw JSON object to parse
 * @param knownFields - Set of field names known in current schema
 * @param moduleId - Module identifier for version lookup
 * @param metadata - Optional schema metadata
 */
export function parseVersionedContent<T extends VersionedContent>(
  raw: Record<string, unknown>,
  knownFields: Set<string>,
  moduleId: string,
  metadata?: SchemaMetadata
): ParseResult<T> {
  // Extract version, default to 1.0.0 if not present
  const version = (raw._v as SemanticVersion) ?? DEFAULT_VERSION
  const readerVersion = getCurrentSchemaVersion(moduleId)

  // Separate known and unknown fields
  const data: Record<string, unknown> = {}
  const unknownFields: Record<string, unknown> = {}
  const unknownFieldNames: string[] = []

  for (const [key, value] of Object.entries(raw)) {
    if (key === '_v') {
      data._v = version
    } else if (key === '_unknownFields') {
      // Merge any previously preserved unknown fields
      if (typeof value === 'object' && value !== null) {
        Object.assign(unknownFields, value)
        unknownFieldNames.push(...Object.keys(value as object))
      }
    } else if (knownFields.has(key)) {
      data[key] = value
    } else {
      // Unknown field - preserve for forwarding
      unknownFields[key] = value
      unknownFieldNames.push(key)
    }
  }

  // Attach unknown fields if any
  if (Object.keys(unknownFields).length > 0) {
    data._unknownFields = unknownFields
  }

  // Determine if update is recommended
  const isPartial = unknownFieldNames.length > 0
  const compatibility = getCompatibilityStatus(version, readerVersion, metadata)

  return {
    data: data as T,
    version,
    isPartial,
    unknownFields: unknownFieldNames,
    updateRecommended: compatibility.updateRecommended || isPartial,
    minReaderVersion: metadata?.minReaderVersion
  }
}

/**
 * Serialize versioned content for transmission.
 * Merges _unknownFields back into the top-level object.
 */
export function serializeVersionedContent<T extends VersionedContent>(
  content: T,
  moduleId: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Ensure _v is set
  result._v = content._v ?? getCurrentSchemaVersion(moduleId)

  // Copy all known fields
  for (const [key, value] of Object.entries(content)) {
    if (key !== '_unknownFields') {
      result[key] = value
    }
  }

  // Merge unknown fields back to top level for relay forwarding
  if (content._unknownFields) {
    for (const [key, value] of Object.entries(content._unknownFields)) {
      // Don't overwrite known fields
      if (!(key in result)) {
        result[key] = value
      }
    }
  }

  return result
}

/**
 * Create known fields set from a type's keys.
 * Helper for defining what fields are recognized.
 */
export function createKnownFieldsSet(fields: string[]): Set<string> {
  return new Set(['_v', '_unknownFields', ...fields])
}

/**
 * Parse an array of versioned content items
 */
export function parseVersionedArray<T extends VersionedContent>(
  rawArray: Record<string, unknown>[],
  knownFields: Set<string>,
  moduleId: string,
  metadata?: SchemaMetadata
): ParseResult<T>[] {
  return rawArray.map(raw => parseVersionedContent<T>(raw, knownFields, moduleId, metadata))
}

/**
 * Check if any items in an array have unknown fields
 */
export function hasAnyUnknownFields(results: ParseResult<VersionedContent>[]): boolean {
  return results.some(r => r.isPartial)
}

/**
 * Get the highest version from a set of parse results
 */
export function getHighestVersion(results: ParseResult<VersionedContent>[]): SemanticVersion {
  let highest: SemanticVersion = '0.0.0'
  for (const result of results) {
    if (compareVersions(result.version, highest) === 'newer') {
      highest = result.version
    }
  }
  return highest
}

/**
 * Module-specific parsers with pre-defined known fields
 */
export const moduleParsers = {
  /**
   * Parse a direct message
   */
  directMessage: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'content', 'replyTo', 'attachments', 'mentions'
    ])
    return parseVersionedContent(raw, knownFields, 'messaging')
  },

  /**
   * Parse a group message
   */
  groupMessage: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'content', 'groupId', 'threadId', 'replyTo', 'attachments', 'mentions'
    ])
    return parseVersionedContent(raw, knownFields, 'messaging')
  },

  /**
   * Parse an event
   */
  event: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'id', 'title', 'description', 'startAt', 'endAt', 'allDay', 'timezone',
      'location', 'virtualUrl', 'rsvpDeadline', 'maxAttendees', 'visibility',
      'recurrence', 'attachments', 'customFields', 'createdBy', 'createdAt', 'updatedAt'
    ])
    return parseVersionedContent(raw, knownFields, 'events')
  },

  /**
   * Parse a document
   */
  document: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'id', 'title', 'content', 'type', 'summary', 'visibility', 'editPermission',
      'groupId', 'parentId', 'tags', 'attachments', 'editors', 'version',
      'createdBy', 'createdAt', 'updatedAt', 'updatedBy'
    ])
    return parseVersionedContent(raw, knownFields, 'documents')
  },

  /**
   * Parse a file
   */
  file: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'id', 'name', 'url', 'mimeType', 'size', 'hash', 'description',
      'folderId', 'groupId', 'visibility', 'encrypted', 'encryptionKeyId',
      'thumbnail', 'dimensions', 'duration', 'uploadedBy', 'uploadedAt'
    ])
    return parseVersionedContent(raw, knownFields, 'files')
  },

  /**
   * Parse a form
   */
  form: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'id', 'title', 'description', 'fields', 'groupId', 'visibility',
      'anonymous', 'allowMultiple', 'opensAt', 'closesAt', 'maxResponses',
      'confirmationMessage', 'createdBy', 'createdAt', 'updatedAt'
    ])
    return parseVersionedContent(raw, knownFields, 'forms')
  },

  /**
   * Parse a CRM contact
   */
  contact: (raw: Record<string, unknown>) => {
    const knownFields = createKnownFieldsSet([
      'id', 'pubkey', 'name', 'email', 'phone', 'address', 'organization',
      'title', 'tags', 'source', 'notes', 'customFields', 'groupId', 'status',
      'lastContactedAt', 'createdBy', 'createdAt', 'updatedAt'
    ])
    return parseVersionedContent(raw, knownFields, 'crm')
  }
}
