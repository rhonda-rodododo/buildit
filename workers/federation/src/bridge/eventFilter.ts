/**
 * Event filter — privacy enforcement
 *
 * Determines whether a Nostr event is eligible for federation.
 * CRITICAL: Encrypted, gift-wrapped, and group-only events must NEVER be federated.
 */

import type { NostrEvent } from '../types';
import { FEDERABLE_KINDS } from '../config';

/** NIP-17 event kinds that indicate private/encrypted content */
const PRIVATE_KINDS = new Set([
  4,     // Encrypted DM (NIP-04, deprecated but still in use)
  13,    // Seal (NIP-17)
  14,    // DM Rumor (NIP-17)
  1059,  // Gift Wrap (NIP-17)
]);

/** Nostr event kinds for group-specific content */
const GROUP_KINDS = new Set([
  24242, // Device transfer
  24243,
  24244,
]);

/**
 * Check if a Nostr event is eligible for federation.
 *
 * Returns true ONLY for public events of federable kinds.
 * Returns false for:
 * - Private/encrypted events (NIP-17 gift-wrapped, NIP-04 DMs)
 * - Group-only events
 * - Events with explicit privacy markers
 * - Unsupported event kinds
 */
export function shouldFederateEvent(event: NostrEvent): boolean {
  // Only federate supported kinds
  if (!FEDERABLE_KINDS.includes(event.kind as typeof FEDERABLE_KINDS[number])) {
    return false;
  }

  // NEVER federate private event kinds
  if (PRIVATE_KINDS.has(event.kind)) {
    return false;
  }

  // NEVER federate group-specific events
  if (GROUP_KINDS.has(event.kind)) {
    return false;
  }

  // Check for explicit privacy markers in tags
  for (const tag of event.tags) {
    // "p" tag with group marker indicates group-restricted content
    if (tag[0] === 'p' && tag[3] === 'group') {
      return false;
    }

    // Explicit visibility tag
    if (tag[0] === 'visibility') {
      const visibility = tag[1];
      if (visibility !== 'public') {
        return false;
      }
    }

    // NIP-42 expiration — skip expired events
    if (tag[0] === 'expiration') {
      const expiry = parseInt(tag[1]);
      if (!isNaN(expiry) && expiry < Math.floor(Date.now() / 1000)) {
        return false;
      }
    }
  }

  // Check for encrypted content markers
  if (event.content.startsWith('?iv=') || event.content.includes('?iv=')) {
    // NIP-04 encrypted content pattern
    return false;
  }

  // For deletion events (kind 5), ensure we have targets
  if (event.kind === 5) {
    const hasTargets = event.tags.some((t) => t[0] === 'e');
    if (!hasTargets) return false;
  }

  return true;
}
