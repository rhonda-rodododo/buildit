/**
 * AT Protocol session management
 *
 * Encrypts/decrypts Bluesky sessions in D1 using a worker secret.
 * Refresh via scheduled cron every 6h.
 */

import type { Env } from '../types';
import type { ATSession } from './client';
import { refreshSession } from './client';
import { getIdentityByPubkey, updateATSession } from '../db';

const HKDF_SALT = new TextEncoder().encode('buildit-federation-at-session-v1');

/**
 * Derive a proper 256-bit AES key from the encryption secret using HKDF-SHA256.
 * This avoids the weak zero-padding approach and provides proper key stretching.
 */
async function deriveKey(secret: string): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: new TextEncoder().encode('aes-256-gcm'),
    },
    keyMaterial,
    256,
  );
}

/**
 * Encrypt an AT session for storage in D1
 */
export async function encryptSession(
  session: ATSession,
  encryptionKey: string,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    await deriveKey(encryptionKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    plaintext,
  );

  // Combine IV + ciphertext as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an AT session from D1 storage
 */
export async function decryptSession(
  encrypted: string,
  encryptionKey: string,
): Promise<ATSession> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    await deriveKey(encryptionKey),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as ATSession;
}

/**
 * Get the current AT session for a Nostr pubkey, decrypted and ready to use
 */
export async function getATSession(
  env: Env,
  pubkey: string,
): Promise<ATSession | null> {
  const identity = await getIdentityByPubkey(env.FEDERATION_DB, pubkey);
  if (!identity || !identity.at_enabled || !identity.at_session_encrypted) {
    return null;
  }

  if (!env.ATPROTO_ENCRYPTION_KEY) {
    console.error('ATPROTO_ENCRYPTION_KEY not set');
    return null;
  }

  try {
    return await decryptSession(identity.at_session_encrypted, env.ATPROTO_ENCRYPTION_KEY);
  } catch (err) {
    console.error('Failed to decrypt AT session for', pubkey.slice(0, 8), err);
    return null;
  }
}

/**
 * Refresh all AT sessions — called by scheduled cron every 6h
 */
export async function refreshATSessions(env: Env): Promise<void> {
  if (!env.ATPROTO_ENCRYPTION_KEY) {
    console.warn('ATPROTO_ENCRYPTION_KEY not set, skipping AT session refresh');
    return;
  }

  const results = await env.FEDERATION_DB
    .prepare(
      'SELECT nostr_pubkey, at_did, at_handle, at_session_encrypted FROM federation_identities WHERE at_enabled = 1 AND at_session_encrypted IS NOT NULL',
    )
    .all<{
      nostr_pubkey: string;
      at_did: string;
      at_handle: string;
      at_session_encrypted: string;
    }>();

  for (const row of results.results) {
    try {
      const session = await decryptSession(row.at_session_encrypted, env.ATPROTO_ENCRYPTION_KEY);
      const refreshed = await refreshSession(session.refreshJwt);
      const encrypted = await encryptSession(refreshed, env.ATPROTO_ENCRYPTION_KEY);
      await updateATSession(env.FEDERATION_DB, row.nostr_pubkey, refreshed.did, refreshed.handle, encrypted);
    } catch (err) {
      console.error(`Failed to refresh AT session for ${row.nostr_pubkey.slice(0, 8)}:`, err);
    }
  }
}
