/**
 * Nostr Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * Also re-exports nostr-tools types for convenience.
 */

import type { Event as NostrToolsEvent, Filter } from 'nostr-tools'

// Re-export nostr-tools types
export type { NostrToolsEvent as NostrEvent, Filter }

// Re-export all generated Zod schemas and types
export {
  NostrEventSchema,
  UnsignedEventSchema,
  type UnsignedEvent,
  NostrFilterSchema,
  type NostrFilter,
  RelayConfigSchema,
  type RelayConfig,
  RelayStatusSchema,
  type RelayStatus,
  RelayLimitationSchema,
  type RelayLimitation,
  RelayInfoSchema,
  type RelayInfo,
  PublishResultSchema,
  type PublishResult,
  RumorSchema,
  type Rumor,
  SealSchema,
  type Seal,
  GiftWrapSchema,
  type GiftWrap,
  NOSTR_SCHEMA_VERSION,
} from '@/generated/validation/nostr.zod';

// ── UI-Only Types ────────────────────────────────────────────────

export interface Subscription {
  id: string
  filters: Filter[]
  onEvent: (event: NostrToolsEvent) => void
  onEose?: () => void
}
