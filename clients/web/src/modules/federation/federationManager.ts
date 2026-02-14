/**
 * Federation module business logic
 *
 * Handles federation enable/disable workflows and status checks.
 */

import type { FederationIdentityStatus } from './types';

const FEDERATION_API_BASE = import.meta.env.VITE_FEDERATION_API_URL ?? 'https://federation.buildit.network';

/**
 * Check if a post has been federated to either protocol
 */
export async function getPostFederationStatus(
  eventId: string,
): Promise<{ apFederated: boolean; atFederated: boolean } | null> {
  try {
    const res = await fetch(`${FEDERATION_API_BASE}/api/post-status/${eventId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Check federation status for a user
 */
export async function getUserFederationStatus(
  pubkey: string,
): Promise<FederationIdentityStatus | null> {
  try {
    const res = await fetch(`${FEDERATION_API_BASE}/api/status/${pubkey}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
