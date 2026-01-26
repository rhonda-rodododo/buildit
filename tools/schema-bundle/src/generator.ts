/**
 * Schema Bundle Generator
 *
 * Generates signed schema bundles for offline distribution.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '@noble/hashes/sha256'
import * as ed25519 from '@noble/ed25519'
import type { SchemaBundle, ModuleSchema, SchemaMetadata } from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Path to protocol schemas directory
 */
const SCHEMAS_DIR = join(__dirname, '../../../protocol/schemas/modules')

/**
 * Current bundle format version
 */
const BUNDLE_VERSION = '1.0.0'

/**
 * Generate a schema bundle from the protocol schemas
 */
export async function generateBundle(privateKey?: Uint8Array): Promise<SchemaBundle> {
  // Load registry
  const registryPath = join(SCHEMAS_DIR, '_registry.json')
  const registryContent = await readFile(registryPath, 'utf-8')
  const registry = JSON.parse(registryContent)

  // Load all module schemas
  const modules: Record<string, ModuleSchema> = {}

  for (const [moduleId, metadata] of Object.entries(registry.modules) as [string, SchemaMetadata][]) {
    const schemaPath = join(SCHEMAS_DIR, metadata.schemaPath)

    try {
      const schemaContent = await readFile(schemaPath, 'utf-8')
      const schema = JSON.parse(schemaContent)

      modules[moduleId] = {
        moduleId,
        name: metadata.name,
        description: metadata.description,
        currentVersion: metadata.currentVersion,
        versions: metadata.versions,
        dependencies: metadata.dependencies,
        schemaPath: metadata.schemaPath,
        coreDependency: metadata.coreDependency,
        schema
      }
    } catch (error) {
      console.warn(`Warning: Could not load schema for ${moduleId}: ${error}`)
    }
  }

  // Generate content hash
  const modulesJson = JSON.stringify(modules, null, 0)
  const contentHashBytes = sha256(new TextEncoder().encode(modulesJson))
  const contentHash = bytesToHex(contentHashBytes)

  // Generate or use provided signing key
  const signingKey = privateKey ?? ed25519.utils.randomPrivateKey()
  const publicKey = await ed25519.getPublicKeyAsync(signingKey)

  // Sign the content hash
  const signatureBytes = await ed25519.signAsync(contentHashBytes, signingKey)

  const bundle: SchemaBundle = {
    bundleVersion: BUNDLE_VERSION,
    createdAt: Date.now(),
    contentHash,
    signature: bytesToHex(signatureBytes),
    signerPubkey: bytesToHex(publicKey),
    registryVersion: registry.properties?.registryVersion?.const ?? '1.0.0',
    compatibilityPolicy: registry.compatibilityPolicy,
    modules
  }

  return bundle
}

/**
 * Serialize bundle for distribution
 */
export function serializeBundle(bundle: SchemaBundle): string {
  return JSON.stringify(bundle)
}

/**
 * Compress bundle for QR code / BLE transfer
 */
export async function compressBundle(bundle: SchemaBundle): Promise<Uint8Array> {
  const json = serializeBundle(bundle)
  const encoder = new TextEncoder()
  const data = encoder.encode(json)

  // Use CompressionStream if available (modern browsers/Node 18+)
  if (typeof CompressionStream !== 'undefined') {
    const stream = new CompressionStream('gzip')
    const writer = stream.writable.getWriter()
    writer.write(data)
    writer.close()

    const reader = stream.readable.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }

    return concatenateArrays(chunks)
  }

  // Fallback: return uncompressed
  return data
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

/**
 * Split bundle into QR code chunks
 */
export function splitIntoQRChunks(
  compressed: Uint8Array,
  maxChunkSize: number = 1500
): string[] {
  const base64 = btoa(String.fromCharCode(...compressed))
  const chunks: string[] = []

  for (let i = 0; i < base64.length; i += maxChunkSize) {
    chunks.push(base64.slice(i, i + maxChunkSize))
  }

  return chunks
}
