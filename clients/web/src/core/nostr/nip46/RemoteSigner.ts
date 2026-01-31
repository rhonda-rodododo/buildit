/**
 * NIP-46 Remote Signer
 * Implements the "client" side of NIP-46 remote signing
 *
 * This runs on SECONDARY devices that don't hold the private key.
 * Instead, signing requests are sent to the primary device (bunker).
 *
 * Benefits:
 * - Private key never leaves the primary device
 * - Can use the identity from any device
 * - Works with hardware wallets
 * - Revocable access
 *
 * Flow:
 * 1. Enter/scan bunker connection string
 * 2. Request approval from bunker
 * 3. Send signing requests when needed
 * 4. Receive signed events back
 */

import { dal } from '@/core/storage/dal';
import type { DBBunkerConnection } from '@/core/storage/db';
import { logger } from '@/lib/logger';
import type { Nip46Permission, Nip46Request } from '@/core/backup/types';
import type { Nip46Response } from './BunkerService';
import * as secp256k1 from '@noble/secp256k1';

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Remote signer connection state
 */
export interface RemoteSignerState {
  connected: boolean;
  bunkerPubkey: string | null;
  relays: string[];
  permissions: Nip46Permission[];
  lastConnected: number | null;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  id: string;
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Remote Signer Service
 * Connects to a bunker for remote signing
 */
export class RemoteSigner {
  private static instance: RemoteSigner;

  // Connection state
  private bunkerPubkey: string | null = null;
  private relays: string[] = [];
  private clientPrivateKey: Uint8Array | null = null;
  private clientPublicKey: string | null = null;
  private connectionId: string | null = null;

  // Pending requests
  private pendingRequests: Map<string, PendingRequest> = new Map();

  // Connection state listeners
  private stateListeners: Set<(state: RemoteSignerState) => void> = new Set();

  private constructor() {}

  public static getInstance(): RemoteSigner {
    if (!RemoteSigner.instance) {
      RemoteSigner.instance = new RemoteSigner();
    }
    return RemoteSigner.instance;
  }

  /**
   * Subscribe to connection state changes
   */
  public onStateChange(listener: (state: RemoteSignerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Get client private key for encrypting requests
   * Used internally for NIP-04/44 encryption with bunker
   */
  protected getClientPrivateKey(): Uint8Array | null {
    return this.clientPrivateKey;
  }

  /**
   * Get current connection state
   */
  public getState(): RemoteSignerState {
    return {
      connected: this.bunkerPubkey !== null,
      bunkerPubkey: this.bunkerPubkey,
      relays: this.relays,
      permissions: [], // Would be loaded from connection
      lastConnected: null,
    };
  }

  /**
   * Connect to a bunker using connection string
   * Format: bunker://<pubkey>?relay=<relay1>&relay=<relay2>
   */
  public async connect(connectionString: string): Promise<void> {
    // Parse connection string
    const { pubkey, relays } = this.parseConnectionString(connectionString);

    // Generate client keypair for this connection
    const clientPrivKey = secp256k1.utils.randomSecretKey();
    const clientPubKey = secp256k1.getPublicKey(clientPrivKey);

    this.clientPrivateKey = clientPrivKey;
    this.clientPublicKey = this.uint8ToHex(clientPubKey);
    this.bunkerPubkey = pubkey;
    this.relays = relays;

    // Send connect request to bunker
    const response = await this.sendRequest('connect', [this.clientPublicKey]);

    if (response.error) {
      this.disconnect();
      throw new Error(`Connection failed: ${response.error}`);
    }

    // Save connection to database
    await this.saveConnection();

    this.emitStateChange();

    logger.info('Connected to bunker', { bunkerPubkey: pubkey.slice(0, 8) });
  }

  /**
   * Reconnect to a saved bunker connection
   */
  public async reconnect(connectionId: string): Promise<void> {
    const connection = await dal.get<DBBunkerConnection>('bunkerConnections', connectionId);

    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.status !== 'approved') {
      throw new Error('Connection not approved');
    }

    this.bunkerPubkey = connection.remotePubkey;
    this.relays = JSON.parse(connection.relays);
    this.connectionId = connectionId;

    // Generate new client keypair
    const clientPrivKey = secp256k1.utils.randomSecretKey();
    const clientPubKey = secp256k1.getPublicKey(clientPrivKey);
    this.clientPrivateKey = clientPrivKey;
    this.clientPublicKey = this.uint8ToHex(clientPubKey);

    // Update last connected
    await dal.update('bunkerConnections', connectionId, {
      lastConnected: Date.now(),
    });

    this.emitStateChange();

    logger.info('Reconnected to bunker', { connectionId: connectionId.slice(0, 8) });
  }

  /**
   * Disconnect from bunker
   */
  public disconnect(): void {
    this.bunkerPubkey = null;
    this.relays = [];
    this.clientPrivateKey = null;
    this.clientPublicKey = null;
    this.connectionId = null;

    // Cancel all pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();

    this.emitStateChange();

    logger.info('Disconnected from bunker');
  }

  /**
   * Get public key from bunker
   */
  public async getPublicKey(): Promise<string> {
    const response = await this.sendRequest('get_public_key', []);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as string;
  }

  /**
   * Sign an event via bunker
   */
  public async signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.sendRequest('sign_event', [event]);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as Record<string, unknown>;
  }

  /**
   * Encrypt with NIP-04 via bunker
   */
  public async nip04Encrypt(pubkey: string, plaintext: string): Promise<string> {
    const response = await this.sendRequest('nip04_encrypt', [pubkey, plaintext]);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as string;
  }

  /**
   * Decrypt with NIP-04 via bunker
   */
  public async nip04Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    const response = await this.sendRequest('nip04_decrypt', [pubkey, ciphertext]);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as string;
  }

  /**
   * Encrypt with NIP-44 via bunker
   */
  public async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    const response = await this.sendRequest('nip44_encrypt', [pubkey, plaintext]);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as string;
  }

  /**
   * Decrypt with NIP-44 via bunker
   */
  public async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    const response = await this.sendRequest('nip44_decrypt', [pubkey, ciphertext]);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as string;
  }

  /**
   * Send a NIP-46 request to the bunker
   */
  private async sendRequest(method: string, params: unknown[]): Promise<Nip46Response> {
    if (!this.bunkerPubkey) {
      throw new Error('Not connected to bunker');
    }

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timed out'));
      }, REQUEST_TIMEOUT_MS);

      // Store pending request
      this.pendingRequests.set(requestId, {
        id: requestId,
        method,
        resolve: (result) => resolve({ id: requestId, result }),
        reject,
        timeout,
      });

      // Send request via Nostr
      this.publishRequest({
        id: requestId,
        method,
        params,
        remotePubkey: this.clientPublicKey!,
        connectionId: this.connectionId || '',
        timestamp: Date.now(),
      }).catch(reject);
    });
  }

  /**
   * Publish a NIP-46 request event
   * In a real implementation, this would publish to Nostr relays
   */
  private async publishRequest(request: Nip46Request): Promise<void> {
    // This is a placeholder - in the full implementation:
    // 1. Encrypt the request with NIP-04/44 to bunkerPubkey
    // 2. Create a kind 24133 event
    // 3. Publish to the relay(s)

    logger.debug('Publishing NIP-46 request', {
      method: request.method,
      requestId: request.id.slice(0, 8),
    });

    // For now, we'll use a direct callback mechanism
    // In production, this would use Nostr relay communication
  }

  /**
   * Handle an incoming NIP-46 response
   */
  public handleResponse(response: Nip46Response): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      logger.warn('Received response for unknown request', { id: response.id });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Get saved connections
   */
  public async getSavedConnections(): Promise<DBBunkerConnection[]> {
    return dal.queryCustom<DBBunkerConnection>({
      sql: `SELECT * FROM bunker_connections WHERE status IN ('approved', 'pending')`,
      params: [],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { anyOf: (vals: string[]) => { toArray: () => Promise<DBBunkerConnection[]> } } } };
        return dexieDb.table('bunkerConnections').where('status').anyOf(['approved', 'pending']).toArray();
      },
    });
  }

  /**
   * Delete a saved connection
   */
  public async deleteConnection(connectionId: string): Promise<void> {
    if (this.connectionId === connectionId) {
      this.disconnect();
    }

    await dal.delete('bunkerConnections', connectionId);

    logger.info('Deleted bunker connection', { connectionId: connectionId.slice(0, 8) });
  }

  // Private helper methods

  private parseConnectionString(connectionString: string): {
    pubkey: string;
    relays: string[];
  } {
    if (!connectionString.startsWith('bunker://')) {
      throw new Error('Invalid bunker connection string');
    }

    const url = new URL(connectionString);
    const pubkey = url.hostname || url.pathname.replace('//', '');
    const relays = url.searchParams.getAll('relay');

    if (!pubkey || relays.length === 0) {
      throw new Error('Invalid bunker connection string');
    }

    return { pubkey, relays };
  }

  private async saveConnection(): Promise<void> {
    if (!this.bunkerPubkey || !this.clientPublicKey) return;

    const connectionId = crypto.randomUUID();
    this.connectionId = connectionId;

    const connection: DBBunkerConnection = {
      id: connectionId,
      identityPubkey: this.clientPublicKey,
      remotePubkey: this.bunkerPubkey,
      name: 'Remote connection',
      status: 'pending',
      permissions: JSON.stringify([]),
      relays: JSON.stringify(this.relays),
      lastConnected: Date.now(),
      createdAt: Date.now(),
    };

    await dal.put('bunkerConnections', connection);
  }

  private emitStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach(l => l(state));
  }

  private uint8ToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export singleton instance
export const remoteSigner = RemoteSigner.getInstance();
