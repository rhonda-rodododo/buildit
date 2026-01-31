/**
 * Schema Test Vector Runner
 *
 * Loads and validates all module schema test vectors from protocol/test-vectors/schemas/.
 * Validates JSON serialization, field presence, type correctness, and round-trip stability.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const VECTORS_DIR = join(__dirname, '../../../../../protocol/test-vectors/schemas')

interface SchemaVector {
  id: string
  description: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

interface SchemaVectorFile {
  version: string
  description: string
  schema_version: string
  vectors: SchemaVector[]
}

function loadSchemaVectors(): Map<string, SchemaVectorFile> {
  const files = readdirSync(VECTORS_DIR).filter((f) => f.endsWith('.json'))
  const result = new Map<string, SchemaVectorFile>()

  for (const file of files) {
    const content = readFileSync(join(VECTORS_DIR, file), 'utf-8')
    const parsed = JSON.parse(content) as SchemaVectorFile
    const moduleName = file.replace('.json', '')
    result.set(moduleName, parsed)
  }

  return result
}

/** Find any string value in the input to verify UTF-8 round-trip */
function findStringWithUnicode(obj: Record<string, unknown>): string | null {
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && /[^\x00-\x7F]/.test(value)) {
      return value
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const found = findStringWithUnicode(value as Record<string, unknown>)
      if (found) return found
    }
  }
  return null
}

const schemaVectors = loadSchemaVectors()

describe('Protocol Schema Test Vectors', () => {
  for (const [moduleName, vectorFile] of schemaVectors) {
    describe(`${moduleName} (${vectorFile.vectors.length} vectors)`, () => {
      for (const vector of vectorFile.vectors) {
        it(`${vector.id}: ${vector.description}`, () => {
          const input = vector.input
          const expected = vector.expected

          // 1. JSON validity: input must serialize/parse cleanly
          const serialized = JSON.stringify(input)
          const reparsed = JSON.parse(serialized) as Record<string, unknown>
          expect(reparsed).toEqual(input)

          // 2. Check expected assertions
          if (expected.json_valid !== undefined) {
            expect(expected.json_valid).toBe(true)
          }

          if (expected.all_fields_present) {
            for (const key of Object.keys(input)) {
              expect(reparsed).toHaveProperty(key)
            }
          }

          // 3. Verify specific type assertions
          if (expected.type_is_group) {
            expect(input.type).toBe('group')
          }
          if (expected.has_group_id) {
            expect(input.groupId).toBeDefined()
          }

          // 4. UTF-8 preservation — find any unicode string in the input
          if (expected.utf8_preserved) {
            const unicodeStr = findStringWithUnicode(input)
            expect(unicodeStr).not.toBeNull()
            if (unicodeStr) {
              const roundTripped = JSON.parse(JSON.stringify(unicodeStr)) as string
              expect(roundTripped).toBe(unicodeStr)
            }
          }

          // 5. Round-trip determinism: serialize → parse → serialize should be stable
          const serialized2 = JSON.stringify(reparsed)
          expect(serialized2).toBe(serialized)

          // 6. Version field present if required
          if (input._v) {
            expect(typeof input._v).toBe('string')
            expect(input._v).toMatch(/^\d+\.\d+\.\d+$/)
          }

          // 7. ID field present and string
          if (input.id) {
            expect(typeof input.id).toBe('string')
            expect((input.id as string).length).toBeGreaterThan(0)
          }

          // 8. Validate nested objects survive serialization
          for (const [key, value] of Object.entries(input)) {
            if (value !== null && typeof value === 'object') {
              expect(reparsed[key]).toEqual(value)
            }
          }
        })
      }
    })
  }
})
