#!/usr/bin/env bun
/**
 * Schema Bundle CLI
 *
 * Command-line tool for generating and verifying schema bundles.
 *
 * Usage:
 *   bun run src/cli.ts generate [--output <path>] [--key <hex>]
 *   bun run src/cli.ts verify <bundle-path>
 *   bun run src/cli.ts qr <bundle-path> [--output-dir <path>]
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { generateBundle, serializeBundle, compressBundle, splitIntoQRChunks } from './generator'
import { parseAndVerifyBundle, setAllowAnySigner } from './verifier'
import QRCode from 'qrcode'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'generate':
      await generateCommand()
      break
    case 'verify':
      await verifyCommand()
      break
    case 'qr':
      await qrCommand()
      break
    default:
      printUsage()
      process.exit(1)
  }
}

function printUsage() {
  console.log(`
Schema Bundle CLI

Usage:
  bun run src/cli.ts generate [options]    Generate a schema bundle
  bun run src/cli.ts verify <bundle-path>  Verify a schema bundle
  bun run src/cli.ts qr <bundle-path>      Generate QR codes for a bundle

Generate Options:
  --output, -o <path>   Output file path (default: ./bundle.json)
  --key, -k <hex>       Signing key (hex string, generates random if not provided)
  --compressed          Output compressed bundle (gzip)

Verify Options:
  --allow-any-signer    Allow untrusted signers (for development)

QR Options:
  --output-dir, -d <path>  Output directory for QR images (default: ./qr-codes)
  --max-size <bytes>       Maximum chunk size (default: 1500)
`)
}

async function generateCommand() {
  const outputIndex = args.findIndex(a => a === '--output' || a === '-o')
  const keyIndex = args.findIndex(a => a === '--key' || a === '-k')
  const compressed = args.includes('--compressed')

  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : './bundle.json'
  const keyHex = keyIndex !== -1 ? args[keyIndex + 1] : undefined

  console.log('Generating schema bundle...')

  // Parse signing key if provided
  let privateKey: Uint8Array | undefined
  if (keyHex) {
    privateKey = new Uint8Array(keyHex.length / 2)
    for (let i = 0; i < keyHex.length; i += 2) {
      privateKey[i / 2] = parseInt(keyHex.slice(i, i + 2), 16)
    }
  }

  try {
    const bundle = await generateBundle(privateKey)
    console.log(`  Modules: ${Object.keys(bundle.modules).length}`)
    console.log(`  Registry version: ${bundle.registryVersion}`)
    console.log(`  Content hash: ${bundle.contentHash.slice(0, 16)}...`)
    console.log(`  Signer: ${bundle.signerPubkey.slice(0, 16)}...`)

    if (compressed) {
      const compressedData = await compressBundle(bundle)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, compressedData)
      console.log(`\nCompressed bundle written to: ${outputPath}`)
      console.log(`  Size: ${compressedData.length} bytes`)
    } else {
      const json = serializeBundle(bundle)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, json)
      console.log(`\nBundle written to: ${outputPath}`)
      console.log(`  Size: ${json.length} bytes`)
    }
  } catch (error) {
    console.error('Error generating bundle:', error)
    process.exit(1)
  }
}

async function verifyCommand() {
  const bundlePath = args[1]
  if (!bundlePath) {
    console.error('Error: Bundle path required')
    printUsage()
    process.exit(1)
  }

  if (args.includes('--allow-any-signer')) {
    setAllowAnySigner(true)
  }

  console.log(`Verifying bundle: ${bundlePath}`)

  try {
    const content = await readFile(bundlePath, 'utf-8')
    const { bundle, result } = await parseAndVerifyBundle(content)

    if (result.valid) {
      console.log('\n✅ Bundle verification PASSED')
      console.log(`  Created: ${new Date(result.metadata!.createdAt).toISOString()}`)
      console.log(`  Registry version: ${result.metadata!.registryVersion}`)
      console.log(`  Modules: ${result.metadata!.moduleCount}`)
      console.log(`  Signer: ${result.metadata!.signerPubkey.slice(0, 16)}...`)

      if (bundle) {
        console.log('\nIncluded modules:')
        for (const [id, mod] of Object.entries(bundle.modules)) {
          console.log(`  - ${id}: ${mod.name} (v${mod.currentVersion})`)
        }
      }
    } else {
      console.log('\n❌ Bundle verification FAILED')
      console.log(`  Error: ${result.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('Error reading bundle:', error)
    process.exit(1)
  }
}

async function qrCommand() {
  const bundlePath = args[1]
  if (!bundlePath) {
    console.error('Error: Bundle path required')
    printUsage()
    process.exit(1)
  }

  const outputDirIndex = args.findIndex(a => a === '--output-dir' || a === '-d')
  const maxSizeIndex = args.findIndex(a => a === '--max-size')

  const outputDir = outputDirIndex !== -1 ? args[outputDirIndex + 1] : './qr-codes'
  const maxSize = maxSizeIndex !== -1 ? parseInt(args[maxSizeIndex + 1]) : 1500

  console.log(`Generating QR codes for: ${bundlePath}`)

  try {
    const content = await readFile(bundlePath, 'utf-8')
    const bundle = JSON.parse(content)

    const compressed = await compressBundle(bundle)
    const chunks = splitIntoQRChunks(compressed, maxSize)

    console.log(`  Compressed size: ${compressed.length} bytes`)
    console.log(`  QR code chunks: ${chunks.length}`)

    await mkdir(outputDir, { recursive: true })

    // Generate QR code for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const qrData = JSON.stringify({
        total: chunks.length,
        index: i,
        data: chunks[i],
        ...(i === 0 ? { hash: bundle.contentHash } : {})
      })

      const filename = join(outputDir, `schema-bundle-${i + 1}-of-${chunks.length}.png`)
      await QRCode.toFile(filename, qrData, {
        errorCorrectionLevel: 'M',
        width: 800
      })

      console.log(`  Generated: ${filename}`)
    }

    // Generate an index file
    const indexContent = {
      bundleVersion: bundle.bundleVersion,
      contentHash: bundle.contentHash,
      totalChunks: chunks.length,
      createdAt: Date.now(),
      instructions: [
        'Scan QR codes in order (1, 2, 3, ...)',
        'App will assemble and verify the bundle',
        'Hash will be verified against first chunk'
      ]
    }
    await writeFile(join(outputDir, 'index.json'), JSON.stringify(indexContent, null, 2))

    console.log(`\nQR codes written to: ${outputDir}`)
  } catch (error) {
    console.error('Error generating QR codes:', error)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
