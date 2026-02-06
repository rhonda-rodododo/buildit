#!/usr/bin/env bun
/**
 * Standard Schema Bundle Verifier
 *
 * Verifies a bundle: checks structure against bundle-format.json,
 * validates all schemas are present per registry, validates signature.
 *
 * Usage:
 *   bun run src/verify.ts <bundle-path> [--allow-any-signer]
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '@noble/hashes/sha256'
import * as ed25519 from '@noble/ed25519'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCHEMAS_DIR = join(__dirname, '../../../protocol/schemas/modules')

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
  registry?: object
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

/**
 * Known trusted signer public keys (hex, 64 chars)
 * These are BuildIt's official Ed25519 signing keys for schema bundles.
 * Keys are rotated periodically - old keys remain for verification of existing bundles.
 */
const TRUSTED_SIGNERS = new Set<string>([
  '44470946c302a9349de9e332ac5496a70ecc7d26bb52b149eea51897b16a771c', // BuildIt Official (2026-02)
])

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

const semverRegex = /^\d+\.\d+\.\d+$/
const hexPubkeyRegex = /^[0-9a-f]{64}$/

async function main() {
  const args = process.argv.slice(2)
  const bundlePath = args.find(a => !a.startsWith('--'))
  const allowAnySigner = args.includes('--allow-any-signer')

  if (!bundlePath) {
    console.error('Usage: bun run src/verify.ts <bundle-path> [--allow-any-signer]')
    process.exit(1)
  }

  console.log(`Verifying bundle: ${bundlePath}`)
  if (allowAnySigner) {
    console.log('  (--allow-any-signer: accepting any signer)')
  }

  let bundle: StandardBundle

  try {
    const content = await readFile(bundlePath, 'utf-8')
    bundle = JSON.parse(content)
  } catch (error) {
    console.error(`Failed to read/parse bundle: ${error}`)
    process.exit(1)
  }

  const errors: string[] = []
  const warnings: string[] = []

  // 1. Check required fields per bundle-format.json
  if (!bundle.bundleVersion) {
    errors.push('Missing required field: bundleVersion')
  } else if (!semverRegex.test(bundle.bundleVersion)) {
    errors.push(`Invalid bundleVersion format: "${bundle.bundleVersion}" (expected semver)`)
  }

  if (bundle.createdAt == null) {
    errors.push('Missing required field: createdAt')
  } else if (typeof bundle.createdAt !== 'number') {
    errors.push(`Invalid createdAt type: ${typeof bundle.createdAt} (expected integer)`)
  }

  if (!bundle.minClientVersion) {
    errors.push('Missing required field: minClientVersion')
  } else if (!semverRegex.test(bundle.minClientVersion)) {
    errors.push(`Invalid minClientVersion format: "${bundle.minClientVersion}" (expected semver)`)
  }

  if (!bundle.schemas || typeof bundle.schemas !== 'object') {
    errors.push('Missing or invalid required field: schemas')
  }

  if (!bundle.signature) {
    errors.push('Missing required field: signature')
  }

  if (!bundle.signedBy) {
    errors.push('Missing required field: signedBy')
  } else if (!hexPubkeyRegex.test(bundle.signedBy)) {
    errors.push(`Invalid signedBy format: must be 64-char hex, got "${bundle.signedBy.slice(0, 20)}..."`)
  }

  // 2. Validate each module schema entry
  if (bundle.schemas) {
    for (const [moduleId, entry] of Object.entries(bundle.schemas)) {
      if (!entry.version) {
        errors.push(`Schema "${moduleId}": missing required field "version"`)
      } else if (!semverRegex.test(entry.version)) {
        errors.push(`Schema "${moduleId}": invalid version format "${entry.version}"`)
      }

      if (!entry.schema || typeof entry.schema !== 'object') {
        errors.push(`Schema "${moduleId}": missing or invalid "schema" object`)
      }

      if (entry.minReaderVersion && !semverRegex.test(entry.minReaderVersion)) {
        errors.push(`Schema "${moduleId}": invalid minReaderVersion format "${entry.minReaderVersion}"`)
      }
    }
  }

  // 3. Check that all registry modules are present in bundle
  try {
    const registryPath = join(SCHEMAS_DIR, '_registry.json')
    const registryContent = await readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryContent)
    const registryModules = registry.modules as Record<string, RegistryModule>

    for (const [moduleId, metadata] of Object.entries(registryModules)) {
      if (!bundle.schemas?.[moduleId]) {
        warnings.push(`Module "${moduleId}" (${metadata.name}) in registry but not in bundle`)
      }
    }

    // Check for modules in bundle but not in registry
    if (bundle.schemas) {
      for (const moduleId of Object.keys(bundle.schemas)) {
        if (!registryModules[moduleId]) {
          warnings.push(`Module "${moduleId}" in bundle but not in registry`)
        }
      }
    }
  } catch (error) {
    warnings.push(`Could not load registry for cross-checking: ${error}`)
  }

  // 4. Verify signature
  if (bundle.signature && bundle.signedBy && bundle.schemas) {
    // Check signer trust
    if (!allowAnySigner && !TRUSTED_SIGNERS.has(bundle.signedBy)) {
      errors.push(`Untrusted signer: ${bundle.signedBy.slice(0, 16)}... (use --allow-any-signer for development)`)
    }

    // Verify Ed25519 signature
    try {
      const schemasJson = JSON.stringify(bundle.schemas, null, 0)
      const contentHashBytes = sha256(new TextEncoder().encode(schemasJson))
      const signatureBytes = hexToBytes(bundle.signature)
      const publicKeyBytes = hexToBytes(bundle.signedBy)

      const isValid = await ed25519.verifyAsync(
        signatureBytes,
        contentHashBytes,
        publicKeyBytes
      )

      if (!isValid) {
        errors.push('Signature verification FAILED: signature does not match content')
      } else {
        console.log('  Signature: VALID')
      }
    } catch (error) {
      errors.push(`Signature verification error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Report results
  console.log('')

  if (warnings.length > 0) {
    console.log('Warnings:')
    for (const warning of warnings) {
      console.log(`  - ${warning}`)
    }
    console.log('')
  }

  if (errors.length > 0) {
    console.log('VERIFICATION FAILED')
    console.log('Errors:')
    for (const error of errors) {
      console.log(`  - ${error}`)
    }
    process.exit(1)
  }

  console.log('VERIFICATION PASSED')
  console.log(`  Bundle version: ${bundle.bundleVersion}`)
  console.log(`  Created: ${new Date(bundle.createdAt * 1000).toISOString()}`)
  console.log(`  Min client version: ${bundle.minClientVersion}`)
  console.log(`  Modules: ${Object.keys(bundle.schemas).length}`)
  console.log(`  Signer: ${bundle.signedBy.slice(0, 16)}...`)
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
