/**
 * Schema Bundle Signature Verifier
 *
 * Verifies Ed25519 signatures on schema bundles before import.
 * This prevents malicious bundles from being injected via BLE mesh or QR codes.
 *
 * SECURITY: All bundles MUST be verified before applying schema updates.
 * Unverified bundles could inject malicious schemas that alter data handling.
 */

import { sha256 } from '@noble/hashes/sha256'
import * as ed25519 from '@noble/ed25519'
import type { SchemaBundle } from './types'

/**
 * BuildIt's official Ed25519 signing public keys (hex).
 * Keys are rotated periodically - old keys remain for verification of existing bundles.
 *
 * To add a new key: generate an Ed25519 keypair, add the public key here,
 * and store the private key in CI/CD secrets as BUILDIT_BUNDLE_SIGNING_KEY.
 */
const TRUSTED_SIGNERS = new Set<string>([
  '44470946c302a9349de9e332ac5496a70ecc7d26bb52b149eea51897b16a771c', // BuildIt Official (2026-02)
])

export interface BundleVerificationResult {
  valid: boolean
  error?: string
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a schema bundle's Ed25519 signature.
 *
 * Checks:
 * 1. Required fields are present
 * 2. Signer is in the trusted set
 * 3. Content hash matches the modules JSON
 * 4. Ed25519 signature is valid
 */
export async function verifyBundleSignature(
  bundle: SchemaBundle
): Promise<BundleVerificationResult> {
  try {
    // 1. Check required fields
    if (!bundle.contentHash || !bundle.signature || !bundle.signerPubkey) {
      return { valid: false, error: 'Missing required signature fields' }
    }

    // 2. Verify signer is trusted
    if (!TRUSTED_SIGNERS.has(bundle.signerPubkey)) {
      return { valid: false, error: `Untrusted signer: ${bundle.signerPubkey.slice(0, 16)}...` }
    }

    // 3. Verify content hash matches modules
    const modulesJson = JSON.stringify(bundle.modules, null, 0)
    const computedHash = bytesToHex(sha256(new TextEncoder().encode(modulesJson)))

    if (computedHash !== bundle.contentHash) {
      return { valid: false, error: 'Content hash mismatch - bundle may have been tampered with' }
    }

    // 4. Verify Ed25519 signature over the content hash
    const signatureBytes = hexToBytes(bundle.signature)
    const publicKeyBytes = hexToBytes(bundle.signerPubkey)
    const contentHashBytes = hexToBytes(bundle.contentHash)

    const isValid = await ed25519.verifyAsync(
      signatureBytes,
      contentHashBytes,
      publicKeyBytes
    )

    if (!isValid) {
      return { valid: false, error: 'Invalid signature - bundle authenticity could not be verified' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
