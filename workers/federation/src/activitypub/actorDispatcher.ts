/**
 * ActivityPub actor utilities
 *
 * Key pair generation and actor profile management.
 * Uses Fedify's JWK-based key storage for proper HTTP Signature support.
 */

import {
  generateCryptoKeyPair,
  exportJwk,
  importJwk,
} from '@fedify/fedify';
import type { Env, NostrEvent } from '../types';
import { getIdentityByPubkey, updateAPKeys } from '../db';

/** Stored key pair format in D1 (JSON-serialized array) */
interface StoredKeyPair {
  type: 'RSASSA-PKCS1-v1_5' | 'Ed25519';
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

/**
 * Generate RSA + Ed25519 key pairs for AP HTTP Signatures and Object Integrity Proofs.
 * Returns CryptoKeyPair objects ready for Fedify's key pairs dispatcher.
 */
export async function generateAPKeyPairs(): Promise<{
  pairs: CryptoKeyPair[];
  stored: StoredKeyPair[];
}> {
  const rsaPair = await generateCryptoKeyPair('RSASSA-PKCS1-v1_5');
  const ed25519Pair = await generateCryptoKeyPair('Ed25519');

  const stored: StoredKeyPair[] = [
    {
      type: 'RSASSA-PKCS1-v1_5',
      privateKey: await exportJwk(rsaPair.privateKey),
      publicKey: await exportJwk(rsaPair.publicKey),
    },
    {
      type: 'Ed25519',
      privateKey: await exportJwk(ed25519Pair.privateKey),
      publicKey: await exportJwk(ed25519Pair.publicKey),
    },
  ];

  return { pairs: [rsaPair, ed25519Pair], stored };
}

/**
 * Load stored key pairs from D1 and convert to CryptoKeyPair objects.
 * Returns the format Fedify's setKeyPairsDispatcher expects.
 */
export async function loadKeyPairs(
  storedJson: string,
): Promise<CryptoKeyPair[]> {
  const stored: StoredKeyPair[] = JSON.parse(storedJson);
  const pairs: CryptoKeyPair[] = [];

  for (const entry of stored) {
    const privateKey = await importJwk(entry.privateKey, 'private');
    const publicKey = await importJwk(entry.publicKey, 'public');
    pairs.push({ privateKey, publicKey });
  }

  return pairs;
}

/**
 * Initialize AP keys for a user (called on first AP enable).
 * Generates both RSA (for HTTP Signatures) and Ed25519 (for Object Integrity Proofs).
 */
export async function ensureAPKeys(
  env: Env,
  pubkey: string,
): Promise<void> {
  const identity = await getIdentityByPubkey(env.FEDERATION_DB, pubkey);
  if (!identity || identity.ap_private_key) return;

  const { stored } = await generateAPKeyPairs();
  const actorId = `https://${env.FEDERATION_DOMAIN}/ap/users/${identity.username}`;

  await updateAPKeys(env.FEDERATION_DB, pubkey, actorId, JSON.stringify(stored));
}

/**
 * Build an AP actor profile from a Nostr kind:0 metadata event
 */
export function nostrProfileToAPProfile(
  event: NostrEvent,
  username: string,
  domain: string,
): {
  name: string | null;
  summary: string | null;
  icon: string | null;
  image: string | null;
} {
  try {
    const meta = JSON.parse(event.content);
    return {
      name: meta.display_name ?? meta.name ?? username,
      summary: meta.about ?? null,
      icon: meta.picture ?? null,
      image: meta.banner ?? null,
    };
  } catch {
    return { name: username, summary: null, icon: null, image: null };
  }
}
