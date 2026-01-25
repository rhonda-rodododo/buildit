// Import fake-indexeddb FIRST, before any code that uses Dexie/IndexedDB
import 'fake-indexeddb/auto';

import { initializeDatabase, closeDatabase, getDB, registerModuleSchema } from '@/core/storage/db';
import { enableTestMode, disableTestMode } from '@/core/storage/EncryptedDB';
import { NostrClient } from '@/core/nostr/client';
import {
  getPublicKey,
  finalizeEvent,
  generateSecretKey,
  type UnsignedEvent,
  type NostrEvent,
} from 'nostr-tools';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';

// Import all module schemas directly for test setup
import { microbloggingSchema } from '@/modules/microblogging/schema';
import { governanceSchema } from '@/modules/governance/schema';
import { eventsSchema } from '@/modules/events/schema';
import { mutualAidSchema } from '@/modules/mutual-aid/schema';
import { wikiSchema } from '@/modules/wiki/schema';
import { databaseSchema } from '@/modules/database/schema';
import { crmSchema } from '@/modules/crm/schema';
import { documentsSchema } from '@/modules/documents/schema';
import { filesSchema } from '@/modules/files/schema';
import { customFieldsSchema } from '@/modules/custom-fields/schema';
import { formsSchema } from '@/modules/forms/schema';
import { fundraisingSchema } from '@/modules/fundraising/schema';
import { publicSchema } from '@/modules/public/schema';

/**
 * Register all module schemas for testing
 * This must be called before initializeDatabase()
 */
function registerAllModuleSchemas(): void {
  // Register in dependency order (custom-fields first)
  registerModuleSchema('custom-fields', customFieldsSchema);
  registerModuleSchema('microblogging', microbloggingSchema);
  registerModuleSchema('governance', governanceSchema);
  registerModuleSchema('events', eventsSchema);
  registerModuleSchema('mutual-aid', mutualAidSchema);
  registerModuleSchema('wiki', wikiSchema);
  registerModuleSchema('database', databaseSchema);
  registerModuleSchema('crm', crmSchema);
  registerModuleSchema('documents', documentsSchema);
  registerModuleSchema('files', filesSchema);
  registerModuleSchema('forms', formsSchema);
  registerModuleSchema('fundraising', fundraisingSchema);
  registerModuleSchema('public', publicSchema);
}

/**
 * Initialize database for testing with test mode enabled
 * Call this in beforeEach or beforeAll
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Enable test mode to bypass encryption
    enableTestMode();

    // Register all module schemas BEFORE initializing database
    registerAllModuleSchemas();
    await initializeDatabase();
  } catch (error) {
    // If already initialized, that's okay
    if (!(error instanceof Error && error.message.includes('already initialized'))) {
      throw error;
    }
  }
}

/**
 * Clean up database after tests
 * Call this in afterEach or afterAll
 */
export async function teardownTestDatabase(): Promise<void> {
  try {
    const db = getDB();
    // Clear all tables
    await Promise.all(db.tables.map((table) => table.clear()));
    await closeDatabase();

    // Disable test mode
    disableTestMode();
  } catch (error) {
    // Ignore errors if database not initialized
    console.warn('Error during test database teardown:', error);
  }
}

/**
 * Generate a random test keypair
 */
export function generateTestKeypair(): { privateKey: string; publicKey: string } {
  const privateKeyBytes = generateSecretKey();
  const privateKey = bytesToHex(privateKeyBytes);
  const publicKey = getPublicKey(privateKeyBytes);
  return { privateKey, publicKey };
}

/**
 * Generate a random private key (hex string)
 */
export function generatePrivateKey(): string {
  const privateKeyBytes = generateSecretKey();
  return bytesToHex(privateKeyBytes);
}

/**
 * Create a test Nostr client with mock relays
 * Doesn't actually connect to real relays
 */
export function createTestNostrClient(): NostrClient {
  return new NostrClient([
    { url: 'wss://test-relay-1.local', read: true, write: true },
    { url: 'wss://test-relay-2.local', read: true, write: true },
  ]);
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sign an event with a private key (hex string)
 */
export function signEvent(unsignedEvent: UnsignedEvent, privateKeyHex: string): NostrEvent {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  return finalizeEvent(unsignedEvent, privateKeyBytes);
}

/**
 * Create a mock Nostr event for testing
 */
export function createMockEvent(
  content: string,
  pubkey: string,
  kind: number = 1,
  tags: string[][] = []
): UnsignedEvent {
  return {
    kind,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
  };
}
