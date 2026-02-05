/**
 * BuildIt Network Relay Configuration
 * Based on Nosflare (https://github.com/Spl0itable/nosflare)
 *
 * Customize these settings for your relay's moderation policies,
 * rate limiting, and feature toggles.
 */

import type { RelayInfo, RateLimitConfig, NostrEvent } from './types';

// =============================================================================
// RELAY IDENTITY
// =============================================================================

export const relayInfo: RelayInfo = {
  name: 'BuildIt Network Relay',
  description: 'A privacy-first Nostr relay for activist groups, co-ops, unions, and community organizers. Powered by Nosflare on Cloudflare.',
  pubkey: '', // Set via RELAY_PUBKEY env var
  contact: '', // Set via RELAY_CONTACT env var
  supported_nips: [1, 2, 4, 9, 11, 12, 15, 16, 17, 20, 22, 28, 33, 40, 42, 44, 45, 50, 59],
  software: 'https://github.com/buildit-network/buildit-network',
  version: '1.0.0',
  icon: '',
  limitation: {
    max_message_length: 524288,  // 512KB
    max_subscriptions: 20,
    max_filters: 10,
    max_limit: 500,
    max_subid_length: 64,
    min_prefix: 4,
    max_event_tags: 2500,
    max_content_length: 102400, // 100KB
    auth_required: false,
    payment_required: false,
  },
};

// =============================================================================
// AUTHENTICATION (NIP-42)
// =============================================================================

/** Require NIP-42 authentication for all operations */
export const AUTH_REQUIRED = false;

/** Timeout for auth challenges (5 minutes) */
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

// =============================================================================
// PAYMENT (Pay-to-Relay)
// =============================================================================

/** Enable pay-to-relay functionality */
export const PAY_TO_RELAY_ENABLED = false;

/** Access price in satoshis (0 = free) */
export const RELAY_ACCESS_PRICE_SATS = 0;

// =============================================================================
// RATE LIMITING
// =============================================================================

/** Rate limit for event publishing per pubkey */
export const PUBKEY_RATE_LIMIT: RateLimitConfig = {
  rate: 10,       // 10 tokens per second
  capacity: 50,   // Burst of 50 events
};

/** Rate limit for REQ subscriptions */
export const REQ_RATE_LIMIT: RateLimitConfig = {
  rate: 5,        // 5 tokens per second
  capacity: 20,   // Burst of 20 requests
};

/** Event kinds excluded from rate limiting */
export const excludedRateLimitKinds = new Set([
  0,     // Metadata
  3,     // Contacts
  7,     // Reaction
  1059,  // Gift wrap (NIP-17)
  10002, // Relay list
]);

// =============================================================================
// MODERATION - PUBKEY LISTS
// =============================================================================

/**
 * Pubkey allowlist mode
 * - false: Allow all pubkeys except those in blocklist
 * - true: Only allow pubkeys in allowlist
 */
export const PUBKEY_ALLOWLIST_MODE = false;

/** Allowed pubkeys (only used if PUBKEY_ALLOWLIST_MODE is true) */
export const pubkeyAllowlist = new Set<string>([
  // Add hex pubkeys here
]);

/** Blocked pubkeys (always blocked regardless of mode) */
export const pubkeyBlocklist = new Set<string>([
  // Add hex pubkeys of known bad actors
]);

/** Check if a pubkey is allowed to publish */
export function isPubkeyAllowed(pubkey: string): boolean {
  // Always block pubkeys in blocklist
  if (pubkeyBlocklist.has(pubkey)) {
    return false;
  }

  // If allowlist mode, only allow listed pubkeys
  if (PUBKEY_ALLOWLIST_MODE) {
    return pubkeyAllowlist.has(pubkey);
  }

  return true;
}

// =============================================================================
// MODERATION - EVENT KINDS
// =============================================================================

/**
 * Kind blocklist mode
 * - false: Allow all kinds except those in blocklist
 * - true: Only allow kinds in allowlist
 */
export const KIND_ALLOWLIST_MODE = false;

/** Allowed event kinds (only used if KIND_ALLOWLIST_MODE is true) */
export const kindAllowlist = new Set<number>([
  // Core kinds
  0, 1, 3, 4, 5, 6, 7, 8,
  // NIP-17 DMs
  1059,
  // Lists
  10000, 10001, 10002,
  // Parameterized replaceable
  30000, 30001, 30008, 30009, 30023, 30024, 30078,
]);

/** Blocked event kinds */
export const kindBlocklist = new Set<number>([
  // Add kinds to block
]);

/** Check if an event kind is allowed */
export function isEventKindAllowed(kind: number): boolean {
  if (kindBlocklist.has(kind)) {
    return false;
  }

  if (KIND_ALLOWLIST_MODE) {
    return kindAllowlist.has(kind);
  }

  return true;
}

// =============================================================================
// MODERATION - CONTENT FILTERING
// =============================================================================

/** Blocked phrases (case-insensitive) */
export const blockedPhrases: string[] = [
  // Add spam phrases, slurs, etc.
];

/** Blocked domains in URLs */
export const blockedDomains: string[] = [
  // Add known phishing/spam domains
];

/** Check if event content contains blocked content */
export function containsBlockedContent(event: NostrEvent): boolean {
  const contentLower = event.content.toLowerCase();

  // Check blocked phrases
  for (const phrase of blockedPhrases) {
    if (contentLower.includes(phrase.toLowerCase())) {
      return true;
    }
  }

  // Check blocked domains
  for (const domain of blockedDomains) {
    if (contentLower.includes(domain.toLowerCase())) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// MODERATION - TAG FILTERING
// =============================================================================

/** Blocked tag names */
export const blockedTags = new Set<string>([
  // Add tags to block
]);

/** Check if a tag is allowed */
export function isTagAllowed(tagName: string): boolean {
  return !blockedTags.has(tagName);
}

// =============================================================================
// NIP-05 VERIFICATION
// =============================================================================

/** Require NIP-05 verification for publishing */
export const NIP05_REQUIRED = false;

/** NIP-05 domain allowlist (empty = allow all domains) */
export const nip05DomainAllowlist: string[] = [
  // Add allowed domains, e.g., 'buildit.network'
];

/** NIP-05 domain blocklist */
export const nip05DomainBlocklist: string[] = [
  // Add blocked domains
];

// =============================================================================
// SPAM PREVENTION
// =============================================================================

/** Enable content hash deduplication */
export const CONTENT_HASH_DEDUP_ENABLED = true;

/** Time window for content deduplication (1 hour) */
export const CONTENT_HASH_WINDOW_MS = 60 * 60 * 1000;

// =============================================================================
// DATABASE MAINTENANCE
// =============================================================================

/** Max database size before pruning (500MB) */
export const DB_MAX_SIZE_MB = 500;

/** Event kinds protected from pruning */
export const protectedKinds = new Set([
  0,      // Metadata
  3,      // Contacts
  10002,  // Relay list
  30000,  // Categorized people list
  30001,  // Categorized bookmark list
  30008,  // Profile badges
  30009,  // Badge definitions
]);

/** Minimum age (days) before events can be pruned */
export const PRUNE_MIN_AGE_DAYS = 30;

// =============================================================================
// REGIONAL CONFIGURATION
// =============================================================================

/** Multi-region Durable Object endpoints */
export const REGIONAL_ENDPOINTS = [
  'relay-WNAM-primary',  // West North America
  'relay-ENAM-primary',  // East North America
  'relay-WEUR-primary',  // West Europe
  'relay-EEUR-primary',  // East Europe
  'relay-APAC-primary',  // Asia Pacific
  'relay-OC-primary',    // Oceania
  'relay-SAM-primary',   // South America
  'relay-AFR-primary',   // Africa
  'relay-ME-primary',    // Middle East
] as const;

/** Location hints for Durable Objects */
export const ENDPOINT_HINTS: Record<string, string> = {
  'relay-WNAM-primary': 'wnam',
  'relay-ENAM-primary': 'enam',
  'relay-WEUR-primary': 'weur',
  'relay-EEUR-primary': 'eeur',
  'relay-APAC-primary': 'apac',
  'relay-OC-primary': 'oc',
  'relay-SAM-primary': 'enam',
  'relay-AFR-primary': 'weur',
  'relay-ME-primary': 'eeur',
};

/** Country to region mapping */
export const COUNTRY_REGIONS: Record<string, string> = {
  // North America
  US: 'WNAM', CA: 'WNAM', MX: 'WNAM',
  // Europe
  GB: 'WEUR', DE: 'WEUR', FR: 'WEUR', ES: 'WEUR', IT: 'WEUR', NL: 'WEUR',
  PL: 'EEUR', UA: 'EEUR', RO: 'EEUR', CZ: 'EEUR', HU: 'EEUR',
  // Asia Pacific
  JP: 'APAC', KR: 'APAC', CN: 'APAC', TW: 'APAC', HK: 'APAC', SG: 'APAC',
  // Oceania
  AU: 'OC', NZ: 'OC',
  // South America
  BR: 'SAM', AR: 'SAM', CL: 'SAM', CO: 'SAM',
  // Africa
  ZA: 'AFR', NG: 'AFR', EG: 'AFR', KE: 'AFR',
  // Middle East
  AE: 'ME', SA: 'ME', IL: 'ME', TR: 'ME',
};

/** US state to region mapping */
export const US_STATE_REGIONS: Record<string, string> = {
  // West
  CA: 'WNAM', WA: 'WNAM', OR: 'WNAM', NV: 'WNAM', AZ: 'WNAM', CO: 'WNAM',
  // East
  NY: 'ENAM', FL: 'ENAM', TX: 'ENAM', PA: 'ENAM', GA: 'ENAM', NC: 'ENAM',
  MA: 'ENAM', VA: 'ENAM', MD: 'ENAM', DC: 'ENAM',
};
