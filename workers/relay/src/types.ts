/**
 * Nosflare Types for BuildIt Network Relay
 * Based on https://github.com/Spl0itable/nosflare
 */

import type {
  NostrEvent as GeneratedNostrEvent,
  NostrFilter as GeneratedNostrFilter,
  RelayInfo as GeneratedRelayInfo,
} from '../../shared/generated/schemas/nostr';

// Re-export protocol types with _v made optional for runtime use.
// Raw Nostr events arriving over WebSocket do not carry the _v field,
// so the relay needs a permissive variant of the generated types.
export type NostrEvent = Omit<GeneratedNostrEvent, '_v'> & { _v?: string };
export type NostrFilter = Omit<GeneratedNostrFilter, '_v'> & {
  _v?: string;
  '#e'?: string[];
  '#p'?: string[];
  '#a'?: string[];
  '#t'?: string[];
  '#d'?: string[];
  '#r'?: string[];
  '#L'?: string[];
  '#s'?: string[];
  '#u'?: string[];
  [key: `#${string}`]: string[] | undefined;
};
export type RelayInfo = Omit<GeneratedRelayInfo, '_v'> & {
  _v?: string;
  fees?: {
    admission?: { amount: number; unit: string }[];
    publication?: { kinds: number[]; amount: number; unit: string }[];
  };
};

// Nostr Protocol Messages (complex union that codegen cannot represent)
export type NostrMessage =
  | ['EVENT', NostrEvent]
  | ['EVENT', string, NostrEvent]
  | ['EOSE', string]
  | ['OK', string, boolean, string]
  | ['NOTICE', string]
  | ['REQ', string, ...NostrFilter[]]
  | ['CLOSE', string]
  | ['CLOSED', string, string]
  | ['AUTH', string]
  | ['AUTH', NostrEvent];

// Rate Limiting
export interface RateLimitConfig {
  rate: number;      // Tokens per second
  capacity: number;  // Max tokens (burst capacity)
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private rate: number;
  private capacity: number;

  constructor(rate: number, capacity: number) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  removeToken(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.rate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}

// WebSocket Session
export interface WebSocketSession {
  id: string;
  webSocket: WebSocket;
  subscriptions: Map<string, NostrFilter[]>;
  pubkeyRateLimiter: RateLimiter;
  reqRateLimiter: RateLimiter;
  bookmark: string;
  host: string;
  challenge?: string;
  authenticatedPubkeys: Set<string>;
}

// Query Result
export interface QueryResult {
  events: NostrEvent[];
  bookmark?: string;
}

// Event Processing Result
export interface ProcessEventResult {
  success: boolean;
  message: string;
  bookmark?: string;
}

// Durable Object Broadcast Request
export interface DOBroadcastRequest {
  event: NostrEvent;
  sourceDoId: string;
}

// Cloudflare Workers Environment
export interface Env {
  RELAY_DATABASE: D1Database;
  RELAY_WEBSOCKET: DurableObjectNamespace;
  ENVIRONMENT?: string;
  RELAY_PUBKEY?: string;
  RELAY_CONTACT?: string;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  sessions: number;
  activeWebSockets: number;
  region?: string;
}

// Database Row Types
export interface EventRow {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string;
  content: string;
  sig: string;
  p_tags?: string;
  e_tags?: string;
  a_tags?: string;
  t_tags?: string;
  d_tag?: string;
  r_tags?: string;
  L_tags?: string;
  s_tags?: string;
  u_tags?: string;
  content_hash?: string;
}

export interface PaymentRow {
  pubkey: string;
  paid_at: number;
  expires_at?: number;
  amount_sats: number;
  invoice_id?: string;
}
