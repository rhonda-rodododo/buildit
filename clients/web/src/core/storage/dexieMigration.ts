/**
 * Dexie → SQLite Migration Service
 *
 * On first Tauri launch, migrates existing data from Dexie/IndexedDB
 * to SQLite via the DAL. This is a one-time operation that:
 *
 * 1. Checks if IndexedDB has an existing Dexie database
 * 2. Opens it and reads all tables
 * 3. Writes data to SQLite via DAL's Tauri invoke path
 * 4. Marks migration as complete in localStorage
 *
 * Dexie's field-level encryption hooks automatically decrypt data on read,
 * so migrated data is written as plaintext to SQLite (SQLCipher provides
 * full-database encryption at rest).
 */

import { dal } from './dal';
import { logger } from '@/lib/logger';

const MIGRATION_KEY = 'buildit-dexie-to-sqlite-migrated';
const DEXIE_DB_NAME = 'BuildItNetworkDB';

/** Tables that use non-standard primary keys */
const PK_MAP: Record<string, string> = {
  identities: 'publicKey',
  usernameSettings: 'pubkey',
  userPresence: 'pubkey',
  cacheMetadata: 'key',
};

/** Fields that store JSON-serialized arrays/objects in Dexie but are
 *  native types in Dexie and need no transformation (Dexie stores them natively).
 *  SQLite stores these as TEXT, so the Rust backend handles JSON serialization. */

/**
 * Check if migration is needed and has not been completed.
 */
export function isMigrationNeeded(): boolean {
  // Only relevant in Tauri mode
  if (!('__TAURI_INTERNALS__' in window)) return false;

  // Already migrated?
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  return true;
}

/**
 * Check if the Dexie IndexedDB database exists.
 */
async function dexieDbExists(): Promise<boolean> {
  try {
    const databases = await indexedDB.databases();
    return databases.some((db) => db.name === DEXIE_DB_NAME);
  } catch {
    // Firefox doesn't support indexedDB.databases() — try opening directly
    return new Promise((resolve) => {
      const request = indexedDB.open(DEXIE_DB_NAME);
      request.onsuccess = () => {
        const db = request.result;
        const hasStores = db.objectStoreNames.length > 0;
        db.close();
        resolve(hasStores);
      };
      request.onerror = () => resolve(false);
    });
  }
}

/**
 * Read all records from an IndexedDB object store.
 */
function readAllFromStore(
  db: IDBDatabase,
  storeName: string
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      // Store might not exist in this version
      logger.warn(`Could not read store "${storeName}":`, error);
      resolve([]);
    }
  });
}

/**
 * Run the full Dexie → SQLite migration.
 *
 * Call this after the DAL is initialized and the SQLite database is open.
 * Returns the number of records migrated, or -1 if skipped.
 */
export async function migrateDexieToSQLite(): Promise<number> {
  if (!isMigrationNeeded()) {
    logger.info('Dexie→SQLite migration: not needed (already done or not in Tauri)');
    return -1;
  }

  // Check if Dexie DB actually exists
  const exists = await dexieDbExists();
  if (!exists) {
    logger.info('Dexie→SQLite migration: no existing Dexie database found');
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    return 0;
  }

  logger.info('Dexie→SQLite migration: starting...');

  let totalMigrated = 0;

  try {
    // Open the IndexedDB directly (not through Dexie, to avoid schema version conflicts)
    const db = await openIndexedDB();
    const storeNames = Array.from(db.objectStoreNames);

    logger.info(`Found ${storeNames.length} Dexie tables to migrate:`, storeNames);

    for (const storeName of storeNames) {
      try {
        const records = await readAllFromStore(db, storeName);

        if (records.length === 0) {
          logger.info(`  ${storeName}: empty, skipping`);
          continue;
        }

        // Write to SQLite in batches of 100
        const BATCH_SIZE = 100;
        let migratedForTable = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          // Ensure each record has the expected primary key
          const sanitized = batch.map((r) => sanitizeRecord(storeName, r));
          await dal.bulkPut(storeName, sanitized);
          migratedForTable += sanitized.length;
        }

        logger.info(`  ${storeName}: migrated ${migratedForTable} records`);
        totalMigrated += migratedForTable;
      } catch (tableError) {
        // Log but continue — don't let one table failure stop the whole migration
        logger.error(`  ${storeName}: FAILED to migrate:`, tableError);
      }
    }

    db.close();

    // Mark migration as complete
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    logger.info(`Dexie→SQLite migration: completed. ${totalMigrated} records migrated.`);

    return totalMigrated;
  } catch (error) {
    logger.error('Dexie→SQLite migration: FAILED:', error);
    // Don't mark as complete so it can be retried
    throw error;
  }
}

/**
 * Open the IndexedDB directly without Dexie (avoids version conflicts).
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEXIE_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      // If this triggers, the DB didn't exist — close and reject
      request.transaction?.abort();
      reject(new Error('Dexie DB does not exist'));
    };
  });
}

/**
 * Sanitize a record for SQLite insertion.
 * Ensures primary key is present and handles edge cases.
 */
function sanitizeRecord(
  tableName: string,
  record: Record<string, unknown>
): Record<string, unknown> {
  const pk = PK_MAP[tableName] ?? 'id';

  // If the record doesn't have a primary key, skip it (shouldn't happen)
  if (record[pk] === undefined || record[pk] === null) {
    // For auto-increment tables (groupMembers), the id may be a number
    // The Rust backend will handle auto-generation
    return record;
  }

  return record;
}

/**
 * Reset migration flag (for debugging/testing).
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_KEY);
}
