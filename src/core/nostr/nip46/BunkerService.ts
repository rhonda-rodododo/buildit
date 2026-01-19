/**
 * NIP-46 Bunker Service
 * Implements the "bunker" side of NIP-46 remote signing
 *
 * This runs on the PRIMARY device that holds the private key.
 * Remote devices (phone, laptop, etc.) connect and request signatures.
 *
 * Security:
 * - Private key never leaves the primary device
 * - Each request requires approval (unless auto-approved)
 * - Permissions can be scoped per connection
 * - All communication encrypted with NIP-04/44
 *
 * Flow:
 * 1. Primary device generates bunker connection string
 * 2. Remote device scans/enters connection string
 * 3. Remote sends signing requests via Nostr events
 * 4. Primary approves/signs and returns result
 */

import { getDB, type DBBunkerConnection } from '@/core/storage/db';
import { logger } from '@/lib/logger';
import type { Nip46Permission, Nip46Request, BunkerConnectionConfig } from '@/core/backup/types';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';

// Default permissions for new connections
const DEFAULT_PERMISSIONS: Nip46Permission[] = [
  'get_public_key',
  'sign_event',
  'nip04_encrypt',
  'nip04_decrypt',
  'nip44_encrypt',
  'nip44_decrypt',
];

/**
 * NIP-46 request handler result
 */
export interface Nip46Response {
  id: string;
  result?: unknown;
  error?: string;
}

/**
 * Pending approval request
 */
export interface PendingApproval {
  request: Nip46Request;
  connection: DBBunkerConnection;
  resolve: (approved: boolean) => void;
  expiresAt: number;
}

/**
 * Bunker Service
 * Manages NIP-46 signing requests on the primary device
 */
export class BunkerService {
  private static instance: BunkerService;

  // Active connections
  private connections: Map<string, BunkerConnectionConfig> = new Map();

  // Pending approval requests
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  // Event listeners
  private approvalListeners: Set<(approval: PendingApproval) => void> = new Set();
  private connectionListeners: Set<(connection: DBBunkerConnection) => void> = new Set();

  // Private key getter (set by auth system when unlocked)
  private privateKeyGetter: (() => Uint8Array | null) | null = null;

  // Public key for this bunker
  private bunkerPubkey: string | null = null;

  private constructor() {}

  public static getInstance(): BunkerService {
    if (!BunkerService.instance) {
      BunkerService.instance = new BunkerService();
    }
    return BunkerService.instance;
  }

  /**
   * Initialize the bunker with the identity's private key getter
   */
  public initialize(
    bunkerPubkey: string,
    privateKeyGetter: () => Uint8Array | null
  ): void {
    this.bunkerPubkey = bunkerPubkey;
    this.privateKeyGetter = privateKeyGetter;
    logger.info('Bunker service initialized', { pubkey: bunkerPubkey.slice(0, 8) });
  }

  /**
   * Subscribe to pending approval requests
   */
  public onApprovalRequest(listener: (approval: PendingApproval) => void): () => void {
    this.approvalListeners.add(listener);
    return () => this.approvalListeners.delete(listener);
  }

  /**
   * Subscribe to connection updates
   */
  public onConnectionUpdate(listener: (connection: DBBunkerConnection) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  /**
   * Generate a bunker connection string for remote devices
   * Format: bunker://<pubkey>?relay=<relay1>&relay=<relay2>
   */
  public generateConnectionString(relays: string[]): string {
    if (!this.bunkerPubkey) {
      throw new Error('Bunker not initialized');
    }

    const params = relays.map(r => `relay=${encodeURIComponent(r)}`).join('&');
    return `bunker://${this.bunkerPubkey}?${params}`;
  }

  /**
   * Parse a bunker connection string
   */
  public parseConnectionString(connectionString: string): {
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

  /**
   * Create a new connection (when remote device connects)
   */
  public async createConnection(
    remotePubkey: string,
    name: string,
    relays: string[],
    options: {
      permissions?: Nip46Permission[];
      autoApprove?: boolean;
      expiresAt?: number;
    } = {}
  ): Promise<DBBunkerConnection> {
    if (!this.bunkerPubkey) {
      throw new Error('Bunker not initialized');
    }

    const db = getDB();
    const connectionId = crypto.randomUUID();

    const connection: DBBunkerConnection = {
      id: connectionId,
      identityPubkey: this.bunkerPubkey,
      remotePubkey,
      name,
      status: 'pending',
      permissions: JSON.stringify(options.permissions || DEFAULT_PERMISSIONS),
      relays: JSON.stringify(relays),
      lastConnected: Date.now(),
      createdAt: Date.now(),
    };

    await db.bunkerConnections.put(connection);

    // Add to active connections
    this.connections.set(connectionId, {
      id: connectionId,
      name,
      remotePubkey,
      relays,
      permissions: options.permissions || DEFAULT_PERMISSIONS,
      autoApprove: options.autoApprove || false,
      expiresAt: options.expiresAt,
    });

    this.connectionListeners.forEach(l => l(connection));

    logger.info('Bunker connection created', {
      connectionId: connectionId.slice(0, 8),
      remotePubkey: remotePubkey.slice(0, 8),
    });

    return connection;
  }

  /**
   * Approve a pending connection
   */
  public async approveConnection(connectionId: string): Promise<void> {
    const db = getDB();
    await db.bunkerConnections.update(connectionId, {
      status: 'approved',
      lastConnected: Date.now(),
    });

    const connection = await db.bunkerConnections.get(connectionId);
    if (connection) {
      this.connectionListeners.forEach(l => l(connection));
    }

    logger.info('Bunker connection approved', { connectionId: connectionId.slice(0, 8) });
  }

  /**
   * Deny a pending connection
   */
  public async denyConnection(connectionId: string): Promise<void> {
    const db = getDB();
    await db.bunkerConnections.update(connectionId, {
      status: 'denied',
    });

    this.connections.delete(connectionId);

    logger.info('Bunker connection denied', { connectionId: connectionId.slice(0, 8) });
  }

  /**
   * Revoke an existing connection
   */
  public async revokeConnection(connectionId: string): Promise<void> {
    const db = getDB();
    await db.bunkerConnections.update(connectionId, {
      status: 'revoked',
    });

    this.connections.delete(connectionId);

    logger.info('Bunker connection revoked', { connectionId: connectionId.slice(0, 8) });
  }

  /**
   * Handle an incoming NIP-46 request
   */
  public async handleRequest(
    request: Nip46Request
  ): Promise<Nip46Response> {
    const connection = await this.findConnectionByRemotePubkey(request.remotePubkey);
    if (!connection) {
      return { id: request.id, error: 'Connection not found' };
    }

    if (connection.status !== 'approved') {
      return { id: request.id, error: 'Connection not approved' };
    }

    // Check permissions
    const permissions: Nip46Permission[] = JSON.parse(connection.permissions);
    const requiredPermission = this.getRequiredPermission(request.method);

    if (requiredPermission && !permissions.includes(requiredPermission)) {
      return { id: request.id, error: `Permission denied: ${requiredPermission}` };
    }

    // Check if auto-approve is enabled
    const config = this.connections.get(connection.id);
    if (!config?.autoApprove) {
      // Request user approval
      const approved = await this.requestApproval(request, connection);
      if (!approved) {
        return { id: request.id, error: 'Request denied by user' };
      }
    }

    // Execute the request
    try {
      const result = await this.executeRequest(request);
      return { id: request.id, result };
    } catch (error) {
      return {
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a NIP-46 request
   */
  private async executeRequest(request: Nip46Request): Promise<unknown> {
    const privateKey = this.privateKeyGetter?.();
    if (!privateKey) {
      throw new Error('Identity not unlocked');
    }

    switch (request.method) {
      case 'get_public_key':
        return this.bunkerPubkey;

      case 'sign_event': {
        const event = request.params[0] as { id?: string; pubkey?: string; sig?: string; [key: string]: unknown };
        // Ensure event has correct pubkey
        event.pubkey = this.bunkerPubkey!;

        // Calculate event ID if not present
        if (!event.id) {
          event.id = this.calculateEventId(event);
        }

        // Sign the event using schnorr signatures (Nostr standard)
        const sig = secp256k1.schnorr.sign(
          this.hexToUint8(event.id),
          privateKey
        );
        event.sig = this.uint8ToHex(sig);

        return event;
      }

      case 'nip04_encrypt': {
        const [pubkey, plaintext] = request.params as [string, string];
        return this.nip04Encrypt(privateKey, pubkey, plaintext);
      }

      case 'nip04_decrypt': {
        const [pubkey, ciphertext] = request.params as [string, string];
        return this.nip04Decrypt(privateKey, pubkey, ciphertext);
      }

      case 'nip44_encrypt': {
        const [pubkey, plaintext] = request.params as [string, string];
        return this.nip44Encrypt(privateKey, pubkey, plaintext);
      }

      case 'nip44_decrypt': {
        const [pubkey, ciphertext] = request.params as [string, string];
        return this.nip44Decrypt(privateKey, pubkey, ciphertext);
      }

      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  }

  /**
   * Request user approval for a signing request
   */
  private requestApproval(
    request: Nip46Request,
    connection: DBBunkerConnection
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const approval: PendingApproval = {
        request,
        connection,
        resolve,
        expiresAt: Date.now() + 60000, // 1 minute timeout
      };

      this.pendingApprovals.set(request.id, approval);
      this.approvalListeners.forEach(l => l(approval));

      // Auto-reject after timeout
      setTimeout(() => {
        if (this.pendingApprovals.has(request.id)) {
          this.pendingApprovals.delete(request.id);
          resolve(false);
        }
      }, 60000);
    });
  }

  /**
   * Respond to a pending approval
   */
  public respondToApproval(requestId: string, approved: boolean): void {
    const approval = this.pendingApprovals.get(requestId);
    if (approval) {
      this.pendingApprovals.delete(requestId);
      approval.resolve(approved);
    }
  }

  /**
   * Get all connections for an identity
   */
  public async getConnections(identityPubkey: string): Promise<DBBunkerConnection[]> {
    const db = getDB();
    return db.bunkerConnections.where('identityPubkey').equals(identityPubkey).toArray();
  }

  /**
   * Get pending approvals
   */
  public getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Check if bunker is active
   */
  public isActive(): boolean {
    return this.bunkerPubkey !== null && this.privateKeyGetter !== null;
  }

  // Private helper methods

  private async findConnectionByRemotePubkey(
    remotePubkey: string
  ): Promise<DBBunkerConnection | undefined> {
    if (!this.bunkerPubkey) return undefined;

    const db = getDB();
    return db.bunkerConnections
      .where(['identityPubkey', 'remotePubkey'])
      .equals([this.bunkerPubkey, remotePubkey])
      .first();
  }

  private getRequiredPermission(method: string): Nip46Permission | null {
    const permissionMap: Record<string, Nip46Permission> = {
      get_public_key: 'get_public_key',
      sign_event: 'sign_event',
      nip04_encrypt: 'nip04_encrypt',
      nip04_decrypt: 'nip04_decrypt',
      nip44_encrypt: 'nip44_encrypt',
      nip44_decrypt: 'nip44_decrypt',
      encrypt: 'encrypt',
      decrypt: 'decrypt',
    };
    return permissionMap[method] || null;
  }

  private calculateEventId(event: Record<string, unknown>): string {
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    const hash = sha256(new TextEncoder().encode(serialized));
    return this.uint8ToHex(hash);
  }

  // NIP-04 encryption (legacy, for compatibility)
  private async nip04Encrypt(
    _privateKey: Uint8Array,
    _pubkey: string,
    _plaintext: string
  ): Promise<string> {
    // Import from nostr-tools or implement
    // For now, throw not implemented
    throw new Error('NIP-04 encryption not yet implemented');
  }

  private async nip04Decrypt(
    _privateKey: Uint8Array,
    _pubkey: string,
    _ciphertext: string
  ): Promise<string> {
    throw new Error('NIP-04 decryption not yet implemented');
  }

  // NIP-44 encryption (modern)
  private async nip44Encrypt(
    privateKey: Uint8Array,
    pubkey: string,
    plaintext: string
  ): Promise<string> {
    // Use existing nip44 module - derive conversation key first
    const { encryptDM } = await import('@/core/crypto/nip44');
    return encryptDM(plaintext, privateKey, pubkey);
  }

  private async nip44Decrypt(
    privateKey: Uint8Array,
    pubkey: string,
    ciphertext: string
  ): Promise<string> {
    const { decryptDM } = await import('@/core/crypto/nip44');
    return decryptDM(ciphertext, privateKey, pubkey);
  }

  // Utility methods
  private uint8ToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToUint8(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }
}

// Export singleton instance
export const bunkerService = BunkerService.getInstance();
