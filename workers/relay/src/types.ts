/**
 * Nosflare Types for BuildIt Network Relay
 * Based on https://github.com/Spl0itable/nosflare
 */

// Core Nostr Protocol Types
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  // Tag filters
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
}

// Nostr Protocol Messages
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

// Relay Information (NIP-11)
export interface RelayInfo {
  name: string;
  description: string;
  pubkey?: string;
  contact?: string;
  supported_nips: number[];
  software: string;
  version: string;
  icon?: string;
  limitation?: {
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    min_prefix?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
  };
  payments_url?: string;
  fees?: {
    admission?: { amount: number; unit: string }[];
    publication?: { kinds: number[]; amount: number; unit: string }[];
  };
}

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
