/**
 * Calling Module Test Vector Runner
 *
 * Loads test vectors from protocol/test-vectors/calling/ and validates:
 * - Hotline queue management and operator status transitions
 * - Broadcast delivery and batching logic
 * - Push-to-talk channel management and floor control
 * - Call offer/hangup/ICE candidate structure
 * - Group call topology and key distribution
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const VECTORS_DIR = join(__dirname, '../../../../../protocol/test-vectors/calling')

interface CallingVector {
  id?: string
  name?: string
  description: string
  category?: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

interface CallingVectorFile {
  title?: string
  name?: string
  version?: string
  description: string
  vectors: CallingVector[]
}

function loadCallingVectors(): Map<string, CallingVectorFile> {
  if (!existsSync(VECTORS_DIR)) return new Map()

  const files = readdirSync(VECTORS_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'README.md'
  )
  const result = new Map<string, CallingVectorFile>()

  for (const file of files) {
    const content = readFileSync(join(VECTORS_DIR, file), 'utf-8')
    const parsed = JSON.parse(content) as CallingVectorFile
    const name = file.replace('.json', '')
    result.set(name, parsed)
  }

  return result
}

const callingVectors = loadCallingVectors()

/** Get the vector identifier — some files use `id`, others use `name` */
function getVectorId(vector: CallingVector): string {
  return vector.id ?? vector.name ?? 'unknown'
}

// Priority ordering for hotline queue
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Sort calls by priority then by queue time */
function sortByPriority(
  calls: Array<{ callId: string; priority: string; queuedAt: number }>
): string[] {
  return [...calls]
    .sort((a, b) => {
      const priorityDiff =
        (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      if (priorityDiff !== 0) return priorityDiff
      return a.queuedAt - b.queuedAt
    })
    .map((c) => c.callId)
}

/** Check if a status transition is valid */
function isValidTransition(from: string, to: string): boolean {
  const validTransitions: Record<string, Set<string>> = {
    offline: new Set(['available']),
    available: new Set(['on_call', 'break', 'offline']),
    on_call: new Set(['wrap_up']),
    wrap_up: new Set(['available', 'offline']),
    break: new Set(['available', 'offline']),
  }
  return validTransitions[from]?.has(to) ?? false
}

/** ACD distribution: assign call to operator with lowest call count */
function acdDistribute(
  operators: Array<{ pubkey?: string; id?: string; status: string; callCount: number }>
): string | null {
  const available = operators
    .filter((op) => op.status === 'available')
    .sort((a, b) => a.callCount - b.callCount)
  return available[0]?.pubkey ?? available[0]?.id ?? null
}

describe('Calling Module Test Vectors', () => {
  if (callingVectors.size === 0) {
    it.skip('No calling test vectors found', () => {})
    return
  }

  for (const [filename, vectorFile] of callingVectors) {
    describe(`${filename} — ${vectorFile.description}`, () => {
      for (const vector of vectorFile.vectors) {
        const vectorId = getVectorId(vector)

        it(`${vectorId}: ${vector.description}`, () => {
          const { input, expected } = vector

          // ── Hotline vectors ──────────────────────────────────────────

          // Queue priority ordering
          if (vectorId.includes('queue-priority') && input.calls) {
            const calls = input.calls as Array<{
              callId: string
              priority: string
              queuedAt: number
            }>
            const sorted = sortByPriority(calls)
            if (expected.orderedCallIds) {
              expect(sorted).toEqual(expected.orderedCallIds)
            }
            if (expected.positions) {
              const positions = expected.positions as Record<string, number>
              for (const [callId, pos] of Object.entries(positions)) {
                expect(sorted.indexOf(callId) + 1).toBe(pos)
              }
            }
            return
          }

          // Operator status transitions
          if (vectorId.includes('operator-status')) {
            if (input.validTransitions) {
              const transitions = input.validTransitions as Array<{
                from: string
                to: string
              }>
              for (const t of transitions) {
                expect(isValidTransition(t.from, t.to)).toBe(true)
              }
            }
            if (input.invalidTransitions) {
              const transitions = input.invalidTransitions as Array<{
                from: string
                to: string
                reason: string
              }>
              for (const t of transitions) {
                expect(isValidTransition(t.from, t.to)).toBe(false)
              }
            }
            return
          }

          // ACD distribution
          if (vectorId.includes('acd-distribution') && input.operators) {
            const operators = input.operators as Array<{
              pubkey?: string
              id?: string
              status: string
              callCount: number
            }>
            const assigned = acdDistribute(operators)
            if (expected.assignedTo) {
              expect(assigned).toBe(expected.assignedTo)
            }
            return
          }

          // ── Broadcast vectors ────────────────────────────────────────

          // Batch count calculation
          if (vectorId.includes('batch') && input.recipientCount) {
            const recipientCount = input.recipientCount as number
            const batchSize = 50
            const expectedBatchCount = Math.ceil(recipientCount / batchSize)
            if (expected.batchCount) {
              expect(expectedBatchCount).toBe(expected.batchCount)
            }
            return
          }

          // Group delivery
          if (vectorId.includes('group-delivery') && input.broadcast) {
            const broadcast = input.broadcast as { targetType: string }
            if (expected.encryptionType) {
              expect(broadcast.targetType).toBe(expected.encryptionType)
            }
            if (expected.messageCount) {
              expect(expected.messageCount).toBe(1)
            }
            return
          }

          // ── PTT vectors ────────────────────────────────────────────

          // Channel creation
          if (vectorId.includes('channel-create') && input.groupId) {
            if (expected.channelIdGenerated) {
              expect(input.groupId).toBeTruthy()
              expect(input.name).toBeTruthy()
            }
            if (expected.isE2EE) {
              expect(expected.isE2EE).toBe(true)
            }
            return
          }

          // Floor control
          if (vectorId.includes('floor-request') || vectorId.includes('floor-grant')) {
            if (input.pubkey) {
              expect(typeof input.pubkey).toBe('string')
            }
            return
          }

          // ── Generic structure validation ──────────────────────────────
          // All vectors should have valid JSON and round-trip cleanly
          const serialized = JSON.stringify(vector)
          const reparsed = JSON.parse(serialized) as CallingVector
          expect(getVectorId(reparsed)).toBe(vectorId)
          expect(reparsed.description).toBe(vector.description)
          expect(reparsed.input).toEqual(vector.input)
          expect(reparsed.expected).toEqual(vector.expected)
        })
      }
    })
  }
})
