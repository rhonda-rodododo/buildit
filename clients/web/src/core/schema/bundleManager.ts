/**
 * Schema Bundle Manager
 *
 * Handles the full lifecycle of schema bundles:
 * - Verify signature → Store in Dexie → Notify UI of updates
 * - Persist bundles for offline distribution
 * - Track active bundle and version status
 */

import type { SchemaBundle, SemanticVersion, ModuleVersionInfo } from './types'
import { verifyBundleSignature } from './bundleVerifier'
import { getCurrentSchemaVersion, getCompatibilityStatus, compareVersions, getAllModuleVersions } from './versionUtils'
import { getDB, type DBSchemaBundle } from '@/core/storage/db'
import { MODULE_VERSIONS } from '@/generated/db/version'

type BundleSource = DBSchemaBundle['source']

/** Listeners for bundle update events */
type BundleUpdateListener = (bundle: SchemaBundle, modulesUpdated: string[]) => void

const listeners: Set<BundleUpdateListener> = new Set()

/**
 * Subscribe to bundle update events
 */
export function onBundleUpdate(listener: BundleUpdateListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Import and apply a schema bundle.
 * Full pipeline: verify → store → notify
 *
 * @returns List of module IDs that have newer versions in the bundle
 */
export async function importBundle(
  bundle: SchemaBundle,
  source: BundleSource
): Promise<{ applied: boolean; modulesUpdated: string[]; error?: string }> {
  // 1. Verify Ed25519 signature
  const verification = await verifyBundleSignature(bundle)
  if (!verification.valid) {
    return { applied: false, modulesUpdated: [], error: verification.error }
  }

  // 2. Check which modules have newer versions
  const modulesUpdated: string[] = []
  for (const [moduleId, moduleInfo] of Object.entries(bundle.modules)) {
    const localVersion = getCurrentSchemaVersion(moduleId)
    if (compareVersions(moduleInfo.version, localVersion) === 'newer') {
      modulesUpdated.push(moduleId)
    }
  }

  // 3. Store in Dexie
  const db = getDB()
  const dbBundle: DBSchemaBundle = {
    contentHash: bundle.contentHash,
    version: bundle.version,
    createdAt: bundle.createdAt,
    importedAt: Date.now(),
    signature: bundle.signature,
    signerPubkey: bundle.signerPubkey,
    bundleJson: JSON.stringify(bundle),
    source,
    isActive: modulesUpdated.length > 0
  }

  // Deactivate any previous active bundle if this one has updates
  if (modulesUpdated.length > 0) {
    await db.schemaBundles
      .where('isActive').equals(1)
      .modify({ isActive: false })
  }

  await db.schemaBundles.put(dbBundle)

  // 4. Notify listeners
  if (modulesUpdated.length > 0) {
    for (const listener of listeners) {
      try {
        listener(bundle, modulesUpdated)
      } catch (e) {
        console.error('Bundle update listener error:', e)
      }
    }
  }

  return { applied: true, modulesUpdated }
}

/**
 * Get the currently active bundle from storage
 */
export async function getActiveBundle(): Promise<SchemaBundle | null> {
  const db = getDB()
  const active = await db.schemaBundles
    .where('isActive').equals(1)
    .first()

  if (!active) return null

  try {
    return JSON.parse(active.bundleJson) as SchemaBundle
  } catch {
    return null
  }
}

/**
 * Get all stored bundles, ordered by creation date (newest first)
 */
export async function getStoredBundles(): Promise<DBSchemaBundle[]> {
  const db = getDB()
  return db.schemaBundles.orderBy('createdAt').reverse().toArray()
}

/**
 * Delete a stored bundle by content hash
 */
export async function deleteBundle(contentHash: string): Promise<void> {
  const db = getDB()
  await db.schemaBundles.delete(contentHash)
}

/**
 * Get version info for all modules, comparing local vs latest bundle
 */
export async function getModuleVersionStatus(): Promise<ModuleVersionInfo[]> {
  const activeBundle = await getActiveBundle()
  const localVersions = getAllModuleVersions()

  // Build a name map from the registry
  const moduleNames: Record<string, string> = {}
  for (const key of Object.keys(MODULE_VERSIONS)) {
    moduleNames[key] = key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return Object.entries(localVersions).map(([moduleId, localVersion]) => {
    const bundleModule = activeBundle?.modules[moduleId]
    const latestVersion = bundleModule?.version as SemanticVersion | undefined
    const hasUpdate = latestVersion
      ? compareVersions(latestVersion, localVersion) === 'newer'
      : false

    const compatibility = getCompatibilityStatus(
      localVersion,
      latestVersion ?? localVersion,
      bundleModule ? {
        moduleId,
        version: bundleModule.version,
        minReaderVersion: bundleModule.minReaderVersion,
        deprecatedAt: bundleModule.deprecatedAt ?? null,
        sunsetAt: bundleModule.sunsetAt ?? null,
        coreModule: bundleModule.coreModule
      } : undefined
    )

    return {
      moduleId,
      moduleName: moduleNames[moduleId] ?? moduleId,
      localVersion,
      latestVersion,
      hasUpdate,
      compatibility
    }
  })
}

/**
 * Generate a bundle from the current local schemas (for sharing via BLE/QR)
 * This creates an unsigned bundle - signing happens separately
 */
export function generateLocalBundle(): Omit<SchemaBundle, 'signature' | 'signerPubkey' | 'contentHash'> {
  const modules: SchemaBundle['modules'] = {}

  for (const [moduleId, version] of Object.entries(MODULE_VERSIONS)) {
    modules[moduleId] = {
      moduleId,
      version: version as SemanticVersion,
      minReaderVersion: '1.0.0' as SemanticVersion,
      deprecatedAt: null,
      sunsetAt: null,
      coreModule: ['messaging', 'groups', 'contacts', 'content', 'search', 'custom-fields'].includes(moduleId),
      schema: {} // Schema content would be loaded from protocol/schemas in a build step
    }
  }

  return {
    version: '1.0.0',
    createdAt: Date.now(),
    modules
  }
}
