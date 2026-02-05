#!/usr/bin/env bun
/**
 * Standard Schema Bundle Generator
 *
 * Reads all schemas from protocol/schemas/modules/, reads _registry.json,
 * and outputs a bundle per protocol/schemas/bundle-format.json spec.
 *
 * Output: protocol/schemas/bundles/latest.bundle.json
 *
 * Usage:
 *   bun run src/generate.ts [--output <path>]
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '@noble/hashes/sha256'
import * as ed25519 from '@noble/ed25519'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCHEMAS_DIR = join(__dirname, '../../../protocol/schemas/modules')
const DEFAULT_OUTPUT = join(__dirname, '../../../protocol/schemas/bundles/latest.bundle.json')

/**
 * Standard bundle format per bundle-format.json
 */
interface StandardBundle {
  bundleVersion: string
  createdAt: number
  minClientVersion: string
  description?: string
  schemas: Record<string, {
    version: string
    minReaderVersion?: string
    schema: object
  }>
  signature: string
  signedBy: string
}

interface RegistryModule {
  name: string
  description: string
  currentVersion: string
  versions: string[]
  dependencies: string[]
  schemaPath: string
  coreDependency?: boolean
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function main() {
  const args = process.argv.slice(2)
  const outputIndex = args.findIndex(a => a === '--output' || a === '-o')
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : DEFAULT_OUTPUT

  console.log('Generating standard schema bundle...')

  // Load registry
  const registryPath = join(SCHEMAS_DIR, '_registry.json')
  const registryContent = await readFile(registryPath, 'utf-8')
  const registry = JSON.parse(registryContent)

  // Load all module schemas
  const schemas: StandardBundle['schemas'] = {}
  const modules = registry.modules as Record<string, RegistryModule>

  for (const [moduleId, metadata] of Object.entries(modules)) {
    const schemaPath = join(SCHEMAS_DIR, metadata.schemaPath)

    try {
      const schemaContent = await readFile(schemaPath, 'utf-8')
      const schema = JSON.parse(schemaContent)

      schemas[moduleId] = {
        version: metadata.currentVersion,
        schema
      }

      // Add minReaderVersion if schema has it
      if (schema.minReaderVersion) {
        schemas[moduleId].minReaderVersion = schema.minReaderVersion
      }
    } catch (error) {
      console.warn(`Warning: Could not load schema for ${moduleId}: ${error}`)
    }
  }

  console.log(`  Loaded ${Object.keys(schemas).length} module schemas`)

  // Generate content for signing: deterministic JSON of schemas
  const schemasJson = JSON.stringify(schemas, null, 0)
  const contentHashBytes = sha256(new TextEncoder().encode(schemasJson))

  // Generate placeholder Ed25519 signing key
  // In production, this would use a real key from secure storage
  const signingKey = ed25519.utils.randomPrivateKey()
  const publicKey = await ed25519.getPublicKeyAsync(signingKey)

  // Sign the content hash
  const signatureBytes = await ed25519.signAsync(contentHashBytes, signingKey)

  const bundle: StandardBundle = {
    bundleVersion: registry.properties?.registryVersion?.const ?? '1.0.0',
    createdAt: Math.floor(Date.now() / 1000),
    minClientVersion: '0.1.0',
    description: `Schema bundle with ${Object.keys(schemas).length} modules`,
    schemas,
    signature: bytesToHex(signatureBytes),
    signedBy: bytesToHex(publicKey)
  }

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true })

  // Write bundle
  const bundleJson = JSON.stringify(bundle, null, 2)
  await writeFile(outputPath, bundleJson)

  console.log(`  Bundle version: ${bundle.bundleVersion}`)
  console.log(`  Created at: ${new Date(bundle.createdAt * 1000).toISOString()}`)
  console.log(`  Min client version: ${bundle.minClientVersion}`)
  console.log(`  Signer: ${bundle.signedBy.slice(0, 16)}...`)
  console.log(`  Signature: ${bundle.signature.slice(0, 16)}...`)
  console.log(`\nBundle written to: ${outputPath}`)
  console.log(`  Size: ${bundleJson.length} bytes`)
}

main().catch(error => {
  console.error('Error generating bundle:', error)
  process.exit(1)
})
