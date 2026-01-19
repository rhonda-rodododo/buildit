/**
 * Device Transfer Service
 * Handles device-to-device key transfer via QR codes
 *
 * Flow:
 * 1. OLD DEVICE: Generate session + ECDH keypair, display QR code
 * 2. NEW DEVICE: Scan QR code, establish connection
 * 3. OLD DEVICE: Show confirmation, user enters passphrase
 * 4. OLD DEVICE: Encrypt and send key payload
 * 5. NEW DEVICE: Decrypt and store identity
 *
 * Security:
 * - ECDH key exchange (forward secrecy)
 * - Double encryption (ECDH + user passphrase)
 * - Time-limited sessions (5 minutes)
 * - Visual fingerprint verification
 */

import { transferCrypto } from './TransferCrypto';
import { getDB, type DBDeviceTransfer, type DBLinkedDevice } from '@/core/storage/db';
import { logger } from '@/lib/logger';
import type {
  DeviceTransferQR,
  DeviceTransferSession,
  TransferMessage,
  TransferMessageType,
} from '@/core/backup/types';
import QRCode from 'qrcode';

// Session timeout (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

// Default relays for transfer communication
const DEFAULT_TRANSFER_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

/**
 * Device Transfer Service
 * Manages device-to-device key transfers
 */
export class DeviceTransferService {
  private static instance: DeviceTransferService;

  // Active transfer sessions
  private sessions: Map<string, DeviceTransferSession> = new Map();

  // Event listeners for transfer status updates
  private listeners: Set<(session: DeviceTransferSession) => void> = new Set();

  private constructor() {}

  public static getInstance(): DeviceTransferService {
    if (!DeviceTransferService.instance) {
      DeviceTransferService.instance = new DeviceTransferService();
    }
    return DeviceTransferService.instance;
  }

  /**
   * Subscribe to session updates
   */
  public onSessionUpdate(listener: (session: DeviceTransferSession) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit session update to all listeners
   */
  private emitUpdate(session: DeviceTransferSession): void {
    this.listeners.forEach(listener => listener(session));
  }

  /**
   * Initialize a transfer session (OLD DEVICE - initiator)
   * Returns session and QR code data URL
   */
  public async initiateTransfer(
    identityPubkey: string,
    options: {
      relays?: string[];
      deviceName?: string;
      npub?: string;
    } = {}
  ): Promise<{
    session: DeviceTransferSession;
    qrData: DeviceTransferQR;
    qrDataUrl: string;
  }> {
    // Generate ephemeral keypair
    const { privateKey, publicKey } = transferCrypto.generateEphemeralKeypair();

    // Generate session ID
    const sessionId = transferCrypto.generateSessionId();

    // Create session
    const session: DeviceTransferSession = {
      id: sessionId,
      role: 'initiator',
      status: 'awaiting_scan',
      ephemeralPrivateKey: privateKey,
      ephemeralPublicKey: publicKey,
      relays: options.relays || DEFAULT_TRANSFER_RELAYS,
      identityPubkey,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
      createdAt: Date.now(),
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Create QR code data
    const qrData: DeviceTransferQR = {
      version: 1,
      type: 'buildit-device-transfer',
      sessionId,
      publicKey,
      relays: session.relays,
      npub: options.npub,
      expiresAt: session.expiresAt,
      deviceName: options.deviceName,
    };

    // Generate QR code as data URL
    const qrString = `buildit://transfer?data=${this.encodeQRData(qrData)}`;
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
    });

    // Save transfer record to database
    await this.saveTransferRecord(session, 'outgoing');

    // Setup expiration timer
    this.setupExpirationTimer(sessionId);

    logger.info('Device transfer initiated', { sessionId: sessionId.slice(0, 8) });

    return { session, qrData, qrDataUrl };
  }

  /**
   * Connect to a transfer session (NEW DEVICE - receiver)
   */
  public async connectToTransfer(
    qrData: DeviceTransferQR
  ): Promise<DeviceTransferSession> {
    // Validate QR data
    if (qrData.version !== 1 || qrData.type !== 'buildit-device-transfer') {
      throw new Error('Invalid transfer QR code');
    }

    // Check expiration
    if (Date.now() > qrData.expiresAt) {
      throw new Error('Transfer session has expired');
    }

    // Generate our ephemeral keypair
    const { privateKey, publicKey } = transferCrypto.generateEphemeralKeypair();

    // Compute shared secret
    const sharedSecret = transferCrypto.computeSharedSecret(privateKey, qrData.publicKey);

    // Create session
    const session: DeviceTransferSession = {
      id: qrData.sessionId,
      role: 'receiver',
      status: 'connected',
      ephemeralPrivateKey: privateKey,
      ephemeralPublicKey: publicKey,
      remotePubkey: qrData.publicKey,
      sharedSecret,
      relays: qrData.relays,
      expiresAt: qrData.expiresAt,
      createdAt: Date.now(),
    };

    // Store session
    this.sessions.set(session.id, session);

    // Save transfer record
    await this.saveTransferRecord(session, 'incoming');

    logger.info('Connected to device transfer', { sessionId: session.id.slice(0, 8) });

    return session;
  }

  /**
   * Handle incoming handshake response (OLD DEVICE)
   * Called when the new device connects
   */
  public handleHandshakeResponse(
    sessionId: string,
    remotePubkey: string
  ): DeviceTransferSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.role !== 'initiator') {
      throw new Error('Only initiator can handle handshake response');
    }

    // Compute shared secret
    const sharedSecret = transferCrypto.computeSharedSecret(
      session.ephemeralPrivateKey,
      remotePubkey
    );

    // Update session
    session.remotePubkey = remotePubkey;
    session.sharedSecret = sharedSecret;
    session.status = 'connected';

    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    logger.info('Handshake completed', { sessionId: sessionId.slice(0, 8) });

    return session;
  }

  /**
   * Get the verification fingerprint for visual confirmation
   */
  public getVerificationFingerprint(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.remotePubkey) {
      throw new Error('Session not connected');
    }

    return transferCrypto.generateDeviceFingerprint(
      sessionId,
      session.ephemeralPublicKey,
      session.remotePubkey
    );
  }

  /**
   * Encrypt and prepare the key payload for transfer (OLD DEVICE)
   */
  public async prepareKeyPayload(
    sessionId: string,
    privateKey: Uint8Array,
    passphrase: string,
    metadata: {
      name?: string;
      displayName?: string;
      nip05?: string;
    } = {}
  ): Promise<{
    encryptedPayload: string;
    iv1: string;
    iv2: string;
    salt: string;
    metadata: string;
    metadataIv: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.sharedSecret) {
      throw new Error('Session not connected');
    }

    // Update status
    session.status = 'transferring';
    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    // Encrypt the private key with double encryption
    const { encryptedData, iv1, iv2, salt } = await transferCrypto.encryptKeyPayload(
      privateKey,
      session.sharedSecret,
      passphrase
    );

    // Encrypt metadata (single layer)
    const metadataStr = JSON.stringify(metadata);
    const { encrypted: encryptedMetadata, iv: metadataIv } = await transferCrypto.encryptMessage(
      metadataStr,
      session.sharedSecret
    );

    return {
      encryptedPayload: encryptedData,
      iv1,
      iv2,
      salt,
      metadata: encryptedMetadata,
      metadataIv,
    };
  }

  /**
   * Decrypt and receive the key payload (NEW DEVICE)
   */
  public async receiveKeyPayload(
    sessionId: string,
    payload: {
      encryptedPayload: string;
      iv1: string;
      iv2: string;
      salt: string;
      metadata: string;
      metadataIv: string;
    },
    passphrase: string
  ): Promise<{
    privateKey: Uint8Array;
    metadata: Record<string, unknown>;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.sharedSecret) {
      throw new Error('Session not connected');
    }

    // Update status
    session.status = 'transferring';
    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    try {
      // Decrypt the private key
      const privateKey = await transferCrypto.decryptKeyPayload(
        payload.encryptedPayload,
        payload.iv1,
        payload.iv2,
        payload.salt,
        session.sharedSecret,
        passphrase
      );

      // Decrypt metadata
      const metadataStr = await transferCrypto.decryptMessage(
        payload.metadata,
        payload.metadataIv,
        session.sharedSecret
      );
      const metadata = JSON.parse(metadataStr);

      // Update session
      session.status = 'completed';
      this.sessions.set(sessionId, session);
      this.emitUpdate(session);

      // Update database record
      await this.completeTransferRecord(sessionId, 'completed');

      logger.info('Key payload received and decrypted', { sessionId: sessionId.slice(0, 8) });

      return { privateKey, metadata };
    } catch (error) {
      session.status = 'failed';
      session.errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      this.sessions.set(sessionId, session);
      this.emitUpdate(session);

      await this.completeTransferRecord(sessionId, 'failed', session.errorMessage);

      throw error;
    }
  }

  /**
   * Complete the transfer (OLD DEVICE acknowledgment)
   */
  public async completeTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'completed';
    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    await this.completeTransferRecord(sessionId, 'completed');

    // Record the linked device
    if (session.identityPubkey) {
      await this.recordLinkedDevice(session);
    }

    logger.info('Device transfer completed', { sessionId: sessionId.slice(0, 8) });
  }

  /**
   * Abort a transfer session
   */
  public async abortTransfer(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.status = 'failed';
    session.errorMessage = reason || 'Transfer aborted';
    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    await this.completeTransferRecord(sessionId, 'failed', session.errorMessage);

    logger.info('Device transfer aborted', { sessionId: sessionId.slice(0, 8), reason });
  }

  /**
   * Get a session by ID
   */
  public getSession(sessionId: string): DeviceTransferSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Parse QR code data
   */
  public parseQRCode(qrString: string): DeviceTransferQR {
    // Handle both URL format and raw JSON
    let data: string;

    if (qrString.startsWith('buildit://transfer?data=')) {
      data = qrString.replace('buildit://transfer?data=', '');
    } else {
      data = qrString;
    }

    return this.decodeQRData(data);
  }

  /**
   * Get transfer history for an identity
   */
  public async getTransferHistory(identityPubkey: string): Promise<DBDeviceTransfer[]> {
    const db = getDB();
    return db.deviceTransfers.where('identityPubkey').equals(identityPubkey).toArray();
  }

  /**
   * Get linked devices for an identity
   */
  public async getLinkedDevices(identityPubkey: string): Promise<DBLinkedDevice[]> {
    const db = getDB();
    return db.linkedDevices.where('identityPubkey').equals(identityPubkey).toArray();
  }

  // Private helper methods

  private encodeQRData(data: DeviceTransferQR): string {
    const json = JSON.stringify(data);
    // Use URL-safe base64
    return btoa(json)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private decodeQRData(encoded: string): DeviceTransferQR {
    // Restore standard base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    return JSON.parse(json);
  }

  private setupExpirationTimer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const timeout = session.expiresAt - Date.now();
    if (timeout <= 0) {
      this.handleExpiration(sessionId);
      return;
    }

    setTimeout(() => this.handleExpiration(sessionId), timeout);
  }

  private async handleExpiration(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'completed' || session.status === 'failed') {
      return;
    }

    session.status = 'expired';
    session.errorMessage = 'Session expired';
    this.sessions.set(sessionId, session);
    this.emitUpdate(session);

    await this.completeTransferRecord(sessionId, 'expired');

    logger.info('Device transfer session expired', { sessionId: sessionId.slice(0, 8) });
  }

  /**
   * Map session status to DB-compatible status
   */
  private mapSessionStatusToDbStatus(
    sessionStatus: DeviceTransferSession['status']
  ): 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired' {
    switch (sessionStatus) {
      case 'awaiting_scan':
      case 'connected':
        return 'pending';
      case 'authenticating':
      case 'transferring':
        return 'in_progress';
      case 'completed':
      case 'failed':
      case 'expired':
        return sessionStatus;
    }
  }

  private async saveTransferRecord(
    session: DeviceTransferSession,
    direction: 'outgoing' | 'incoming'
  ): Promise<void> {
    const db = getDB();
    const record: DBDeviceTransfer = {
      id: session.id,
      identityPubkey: session.identityPubkey || '',
      direction,
      status: this.mapSessionStatusToDbStatus(session.status),
      deviceName: direction === 'outgoing' ? 'This device' : 'Remote device',
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };

    await db.deviceTransfers.put(record);
  }

  private async completeTransferRecord(
    sessionId: string,
    status: 'completed' | 'failed' | 'expired',
    errorMessage?: string
  ): Promise<void> {
    const db = getDB();
    await db.deviceTransfers.update(sessionId, {
      status,
      completedAt: Date.now(),
      errorMessage,
    });
  }

  private async recordLinkedDevice(session: DeviceTransferSession): Promise<void> {
    if (!session.identityPubkey) return;

    const db = getDB();
    const device: DBLinkedDevice = {
      id: crypto.randomUUID(),
      identityPubkey: session.identityPubkey,
      type: session.role === 'initiator' ? 'linked' : 'primary',
      name: session.role === 'initiator' ? 'New device' : 'Original device',
      deviceInfo: JSON.stringify({
        transferSessionId: session.id,
        linkedAt: Date.now(),
      }),
      lastSeen: Date.now(),
      isCurrent: session.role === 'receiver',
      createdAt: Date.now(),
    };

    await db.linkedDevices.put(device);
  }

  /**
   * Create a transfer message for relay communication
   */
  public createTransferMessage(
    type: TransferMessageType,
    sessionId: string,
    payload: Record<string, unknown>
  ): TransferMessage {
    return {
      type,
      sessionId,
      timestamp: Date.now(),
      payload,
    };
  }
}

// Export singleton instance
export const deviceTransferService = DeviceTransferService.getInstance();
