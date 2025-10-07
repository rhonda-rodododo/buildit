import { initializeDatabase, closeDatabase, getDB } from '@/core/storage/db';
import { NostrClient } from '@/core/nostr/client';
import {
  getPublicKey,
  finalizeEvent,
  generateSecretKey,
  type UnsignedEvent,
  type NostrEvent,
} from 'nostr-tools';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';

/**
 * Initialize database for testing
 * Call this in beforeEach or beforeAll
 */
export async function setupTestDatabase(): Promise<void> {
  try {
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
