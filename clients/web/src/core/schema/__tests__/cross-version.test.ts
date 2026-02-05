/**
 * Cross-Version Parsing Test Vector Runner
 *
 * Loads test vectors from protocol/test-vectors/cross-version-parsing.json
 * and validates the web client's parseVersionedContent() implementation
 * against expected behaviors for cross-client compatibility.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parseVersionedContent,
  serializeVersionedContent,
  createKnownFieldsSet,
  moduleParsers,
} from '@/core/schema/parser'
import type { SemanticVersion } from '@/core/schema/types'

const VECTORS_PATH = join(
  __dirname,
  '../../../../../../protocol/test-vectors/cross-version-parsing.json'
)

interface TestCase {
  id: string
  name: string
  description: string
  module: string
  readerVersion: SemanticVersion
  coreModuleTest?: boolean
  input: Record<string, unknown>
  expected: {
    canParse?: boolean
    isPartial?: boolean
    unknownFields?: string[]
    preservedUnknownFields?: Record<string, unknown>
    updateRequired?: boolean
    inferredVersion?: string
    contentReadable?: boolean
    relayOutput?: Record<string, unknown>
    note?: string
  }
}

interface TestVectorFile {
  testSuiteVersion: string
  testCases: TestCase[]
  validationRules: Array<{
    rule: string
    description: string
    priority: string
    applies_to?: string[]
  }>
}

function getKnownFieldsForModule(moduleId: string): Set<string> {
  switch (moduleId) {
    case 'messaging':
      return createKnownFieldsSet([
        'content',
        'replyTo',
        'attachments',
        'mentions',
        'groupId',
        'threadId',
      ])
    case 'events':
      return createKnownFieldsSet([
        'id',
        'title',
        'description',
        'startAt',
        'endAt',
        'allDay',
        'timezone',
        'location',
        'virtualUrl',
        'rsvpDeadline',
        'maxAttendees',
        'visibility',
        'recurrence',
        'attachments',
        'customFields',
        'createdBy',
        'createdAt',
        'updatedAt',
      ])
    case 'documents':
      return createKnownFieldsSet([
        'id',
        'title',
        'content',
        'type',
        'summary',
        'visibility',
        'editPermission',
        'groupId',
        'parentId',
        'tags',
        'attachments',
        'editors',
        'version',
        'createdBy',
        'createdAt',
        'updatedAt',
        'updatedBy',
      ])
    default:
      return createKnownFieldsSet([])
  }
}

const vectorFile: TestVectorFile = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8'))

describe('Cross-Version Parsing Test Vectors', () => {
  describe(`Test suite v${vectorFile.testSuiteVersion} (${vectorFile.testCases.length} cases)`, () => {
    for (const tc of vectorFile.testCases) {
      it(`${tc.id}: ${tc.name}`, () => {
        const knownFields = getKnownFieldsForModule(tc.module)
        const result = parseVersionedContent(
          tc.input,
          knownFields,
          tc.module
        )

        // cv-008: Missing version defaults to 1.0.0
        if (tc.expected.inferredVersion) {
          expect(result.version).toBe(tc.expected.inferredVersion)
        }

        // Verify canParse: the parser always "can parse" known fields;
        // canParse=false in test vectors means major version incompatibility
        // where the parser still returns data but marks updateRecommended
        if (tc.expected.canParse !== undefined) {
          if (tc.expected.canParse === false && tc.expected.updateRequired) {
            // Major version mismatch - parser still parses what it can
            // but signals updateRecommended
            expect(result.updateRecommended).toBe(true)
          }
          // For canParse=true cases, ensure we got data back
          if (tc.expected.canParse === true) {
            expect(result.data).toBeDefined()
          }
        }

        // Verify isPartial (unknown fields present)
        if (tc.expected.isPartial !== undefined) {
          expect(result.isPartial).toBe(tc.expected.isPartial)
        }

        // Verify unknownFields list
        if (tc.expected.unknownFields !== undefined) {
          expect(result.unknownFields.sort()).toEqual(
            tc.expected.unknownFields.sort()
          )
        }

        // Verify preserved unknown fields values
        if (tc.expected.preservedUnknownFields) {
          const unknownData = result.data._unknownFields ?? {}
          for (const [key, value] of Object.entries(
            tc.expected.preservedUnknownFields
          )) {
            expect(unknownData[key]).toEqual(value)
          }
        }

        // cv-009: Core messaging content always readable
        if (tc.expected.contentReadable && tc.coreModuleTest) {
          // The 'content' field must always be parseable from messaging module
          expect(result.data).toHaveProperty('content')
          const contentValue = (result.data as Record<string, unknown>).content
          expect(contentValue).toBeDefined()
          expect(typeof contentValue).toBe('string')
        }

        // cv-010: Relay forwarding preserves unknown fields
        if (tc.expected.relayOutput) {
          // Serialize the parsed content back for relay
          const serialized = serializeVersionedContent(result.data, tc.module)

          // The serialized output must match the expected relay output exactly
          for (const [key, value] of Object.entries(tc.expected.relayOutput)) {
            expect(serialized[key]).toEqual(value)
          }

          // Verify all fields from input are present in serialized output
          for (const [key, value] of Object.entries(tc.input)) {
            if (key !== '_unknownFields') {
              expect(serialized[key]).toEqual(value)
            }
          }
        }
      })
    }
  })

  describe('Module-specific parsers', () => {
    it('directMessage parser handles current version', () => {
      const result = moduleParsers.directMessage({
        _v: '1.0.0',
        content: 'Hello!',
        replyTo: null,
        attachments: [],
      })
      expect(result.isPartial).toBe(false)
      expect(result.unknownFields).toEqual([])
      expect(result.version).toBe('1.0.0')
    })

    it('directMessage parser preserves unknown fields from future version', () => {
      const result = moduleParsers.directMessage({
        _v: '1.5.0',
        content: 'Hello with new features!',
        replyTo: null,
        attachments: [],
        futureReaction: 'thumbsup',
        threadMeta: { pinned: true },
      })
      expect(result.isPartial).toBe(true)
      expect(result.unknownFields).toContain('futureReaction')
      expect(result.unknownFields).toContain('threadMeta')
      expect(result.data._unknownFields?.futureReaction).toBe('thumbsup')
      expect(result.data._unknownFields?.threadMeta).toEqual({ pinned: true })
    })

    it('event parser handles events with unknown fields', () => {
      const result = moduleParsers.event({
        _v: '1.1.0',
        id: 'test-event-id',
        title: 'Community Meeting',
        startAt: 1706198400,
        createdBy: '0123456789abcdef',
        createdAt: 1706112000,
        coHostIds: ['peer1', 'peer2'],
        virtualPlatform: 'jitsi',
      })
      expect(result.isPartial).toBe(true)
      expect(result.unknownFields).toContain('coHostIds')
      expect(result.unknownFields).toContain('virtualPlatform')
    })

    it('document parser handles documents with unknown fields', () => {
      const result = moduleParsers.document({
        _v: '1.2.0',
        id: 'test-doc-id',
        title: 'Team Guidelines',
        content: '# Guidelines',
        type: 'markdown',
        createdBy: '0123456789abcdef',
        createdAt: 1706112000,
        editHistory: [{ version: 1 }],
        collaborativeEditingEnabled: true,
      })
      expect(result.isPartial).toBe(true)
      expect(result.unknownFields).toContain('editHistory')
      expect(result.unknownFields).toContain('collaborativeEditingEnabled')
    })
  })

  describe('Validation rules', () => {
    it('unknown-field-preservation: unknown fields stored and restored', () => {
      const input = {
        _v: '2.0.0' as SemanticVersion,
        content: 'test',
        futureField: 'preserved',
        nestedObject: { key: 'value' },
      }
      const knownFields = createKnownFieldsSet(['content'])
      const result = parseVersionedContent(input, knownFields, 'messaging')

      // Unknown fields stored
      expect(result.data._unknownFields?.futureField).toBe('preserved')
      expect(result.data._unknownFields?.nestedObject).toEqual({
        key: 'value',
      })

      // Unknown fields restored when serializing
      const serialized = serializeVersionedContent(result.data, 'messaging')
      expect(serialized.futureField).toBe('preserved')
      expect(serialized.nestedObject).toEqual({ key: 'value' })
    })

    it('core-messaging-always-readable: content field always parseable', () => {
      // Even with a far-future version, the content field must be readable
      const input = {
        _v: '99.0.0' as SemanticVersion,
        content: 'Emergency: critical situation',
        unknownCriticalField: true,
        futureEncryption: { layers: 5 },
      }
      const knownFields = createKnownFieldsSet(['content'])
      const result = parseVersionedContent(input, knownFields, 'messaging')

      expect(result.data).toHaveProperty('content')
      expect((result.data as Record<string, unknown>).content).toBe(
        'Emergency: critical situation'
      )
    })

    it('version-comparison: same major compatible, different major may not be', () => {
      // Same major version - compatible
      const sameMinor = parseVersionedContent(
        { _v: '1.5.0', content: 'test' } as Record<string, unknown>,
        createKnownFieldsSet(['content']),
        'messaging'
      )
      expect(sameMinor.data).toBeDefined()

      // Different major version - update recommended
      const diffMajor = parseVersionedContent(
        { _v: '3.0.0', content: 'test' } as Record<string, unknown>,
        createKnownFieldsSet(['content']),
        'messaging'
      )
      expect(diffMajor.updateRecommended).toBe(true)
    })

    it('default-version: content without _v treated as 1.0.0', () => {
      const result = parseVersionedContent(
        { content: 'no version' } as Record<string, unknown>,
        createKnownFieldsSet(['content']),
        'messaging'
      )
      expect(result.version).toBe('1.0.0')
    })
  })
})
