/**
 * Schema Bundle Verifier
 *
 * Verifies signed schema bundles before import.
 */

import { sha256 } from '@noble/hashes/sha256'
import * as ed25519 from '@noble/ed25519'
import type { SchemaBundle, VerificationResult } from './types'

/**
 * Known trusted signer public keys (hex)
 * In production, these would be BuildIt's official signing keys
 */
export const TRUSTED_SIGNERS = new Set<string>([
  // Add official BuildIt signing keys here
])

/**
 * Allow any signer (for development/testing)
 */
let allowAnySigner = false

/**
 * Enable/disable allowing any signer
 */
export function setAllowAnySigner(allow: boolean): void {
  allowAnySigner = allow
}

/**
 * Verify a schema bundle
 */
export async function verifyBundle(bundle: SchemaBundle): Promise<VerificationResult> {
  try {
    // 1. Verify bundle format version
    if (!bundle.bundleVersion) {
      return { valid: false, error: 'Missing bundle version' }
    }

    // 2. Verify required fields
    if (!bundle.contentHash || !bundle.signature || !bundle.signerPubkey) {
      return { valid: false, error: 'Missing required signature fields' }
    }

    // 3. Verify signer is trusted (unless in development mode)
    if (!allowAnySigner && !TRUSTED_SIGNERS.has(bundle.signerPubkey)) {
      return { valid: false, error: 'Untrusted signer' }
    }

    // 4. Verify content hash matches modules
    const modulesJson = JSON.stringify(bundle.modules, null, 0)
    const computedHash = bytesToHex(sha256(new TextEncoder().encode(modulesJson)))

    if (computedHash !== bundle.contentHash) {
      return { valid: false, error: 'Content hash mismatch' }
    }

    // 5. Verify Ed25519 signature
    const signatureBytes = hexToBytes(bundle.signature)
    const publicKeyBytes = hexToBytes(bundle.signerPubkey)
    const contentHashBytes = hexToBytes(bundle.contentHash)

    const isValidSignature = await ed25519.verifyAsync(
      signatureBytes,
      contentHashBytes,
      publicKeyBytes
    )

    if (!isValidSignature) {
      return { valid: false, error: 'Invalid signature' }
    }

    // 6. All checks passed
    return {
      valid: true,
      metadata: {
        createdAt: bundle.createdAt,
        registryVersion: bundle.registryVersion,
        moduleCount: Object.keys(bundle.modules).length,
        signerPubkey: bundle.signerPubkey
      }
    }
  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Parse and verify a bundle from JSON string
 */
export async function parseAndVerifyBundle(json: string): Promise<{
  bundle: SchemaBundle | null
  result: VerificationResult
}> {
  try {
    const bundle = JSON.parse(json) as SchemaBundle
    const result = await verifyBundle(bundle)
    return { bundle: result.valid ? bundle : null, result }
  } catch (error) {
    return {
      bundle: null,
      result: {
        valid: false,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

/**
 * Decompress and verify a bundle
 */
export async function decompressAndVerify(
  compressed: Uint8Array
): Promise<{ bundle: SchemaBundle | null; result: VerificationResult }> {
  try {
    // Try to decompress
    let data: Uint8Array

    if (typeof DecompressionStream !== 'undefined') {
      // Check for gzip magic bytes
      if (compressed[0] === 0x1f && compressed[1] === 0x8b) {
        const stream = new DecompressionStream('gzip')
        const writer = stream.writable.getWriter()
        writer.write(compressed)
        writer.close()

        const reader = stream.readable.getReader()
        const chunks: Uint8Array[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }

        data = concatenateArrays(chunks)
      } else {
        // Not gzip, assume uncompressed
        data = compressed
      }
    } else {
      // No decompression available, assume uncompressed
      data = compressed
    }

    const json = new TextDecoder().decode(data)
    return parseAndVerifyBundle(json)
  } catch (error) {
    return {
      bundle: null,
      result: {
        valid: false,
        error: `Decompression error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

/**
 * Reassemble QR code chunks
 */
export function reassembleQRChunks(chunks: string[]): Uint8Array {
  const base64 = chunks.join('')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Concatenate Uint8Arrays
 */
function concatenateArrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
