import type { Event as NostrEvent, Filter } from 'nostr-tools'

export type { NostrEvent, Filter }

export interface RelayConfig {
  url: string
  read: boolean
  write: boolean
}

export interface RelayStatus {
  url: string
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnected: number | null
  messagesSent: number
  messagesReceived: number
}

export interface Subscription {
  id: string
  filters: Filter[]
  onEvent: (event: NostrEvent) => void
  onEose?: () => void
}

export interface PublishResult {
  relay: string
  success: boolean
  error?: string
}

// NIP-17 Gift Wrap types
export interface Rumor {
  kind: number
  content: string
  created_at: number
  tags: string[][]
}

export interface Seal {
  kind: 13
  content: string
  created_at: number
  tags: string[][]
  id: string
  pubkey: string
  sig: string
}

export interface GiftWrap {
  kind: 1059
  content: string
  created_at: number
  tags: string[][]
  id: string
  pubkey: string // ephemeral key
  sig: string
}
