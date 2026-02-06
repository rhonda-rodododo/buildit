import { dal } from '@/core/storage/dal';
import { validateUsername, isUsernameAvailable, normalizeUsername } from './usernameUtils';
import { createMetadataEvent } from '@/core/nostr/nip01';
import { getNostrClient } from '@/core/nostr/client';
import { getCurrentPrivateKey } from '@/stores/authStore';
import { logger } from '@/lib/logger';
import type { DBUsernameSettings } from '@/core/storage/db';

/**
 * Username claim result
 */
export interface UsernameClaimResult {
  success: boolean;
  error?: string;
}

/**
 * NIP-05 verification result
 */
export interface NIP05VerificationResult {
  verified: boolean;
  pubkey?: string;
  error?: string;
}

/**
 * Username Manager
 * Handles username registration, updates, and NIP-05 verification
 */
export class UsernameManager {
  /**
   * Claim a username for a public key
   */
  static async claimUsername(
    pubkey: string,
    username: string,
    displayName?: string
  ): Promise<UsernameClaimResult> {
    // Normalize username
    const normalizedUsername = normalizeUsername(username);

    // Validate format
    const validation = validateUsername(normalizedUsername);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check availability
    const available = await isUsernameAvailable(normalizedUsername, pubkey);
    if (!available) {
      return { success: false, error: 'Username already taken' };
    }

    try {
      // Update identity in database
      await dal.update('identities', pubkey, {
        username: normalizedUsername,
        displayName: displayName?.trim() || undefined,
      });

      // Create default username settings if they don't exist
      const existingSettings = await dal.get<DBUsernameSettings>('usernameSettings', pubkey);
      if (!existingSettings) {
        const defaultSettings: DBUsernameSettings = {
          pubkey,
          allowUsernameSearch: true,
          allowEmailDiscovery: false,
          visibleTo: 'public',
          showInDirectory: true,
          updatedAt: Date.now(),
        };
        await dal.add('usernameSettings', defaultSettings);
      }

      // Broadcast kind:0 metadata event to configured relays
      await UsernameManager.broadcastMetadata(pubkey);

      return { success: true };
    } catch (error) {
      console.error('Failed to claim username:', error);
      return { success: false, error: 'Failed to save username' };
    }
  }

  /**
   * Update username
   */
  static async updateUsername(
    pubkey: string,
    newUsername: string,
    displayName?: string
  ): Promise<UsernameClaimResult> {
    // Same validation as claim
    return this.claimUsername(pubkey, newUsername, displayName);
  }

  /**
   * Release username (remove from identity)
   */
  static async releaseUsername(pubkey: string): Promise<void> {
    await dal.update('identities', pubkey, {
      username: undefined,
      displayName: undefined,
    });
  }

  /**
   * Update username privacy settings
   */
  static async updateSettings(pubkey: string, settings: Partial<Omit<DBUsernameSettings, 'pubkey'>>): Promise<void> {
    const existing = await dal.get<DBUsernameSettings>('usernameSettings', pubkey);

    if (existing) {
      await dal.update('usernameSettings', pubkey, {
        ...settings,
        updatedAt: Date.now(),
      });
    } else {
      // Create new settings with defaults
      const defaultSettings: DBUsernameSettings = {
        pubkey,
        allowUsernameSearch: true,
        allowEmailDiscovery: false,
        visibleTo: 'public',
        showInDirectory: true,
        updatedAt: Date.now(),
        ...settings,
      };
      await dal.add('usernameSettings', defaultSettings);
    }
  }

  /**
   * Get username settings
   */
  static async getSettings(pubkey: string): Promise<DBUsernameSettings | null> {
    const settings = await dal.get<DBUsernameSettings>('usernameSettings', pubkey);
    return settings || null;
  }

  /**
   * Verify NIP-05 identifier (username@domain.com)
   * @see https://github.com/nostr-protocol/nips/blob/master/05.md
   */
  static async verifyNIP05(identifier: string): Promise<NIP05VerificationResult> {
    try {
      // Parse identifier (local@domain)
      const parts = identifier.split('@');
      if (parts.length !== 2) {
        return { verified: false, error: 'Invalid NIP-05 format. Use: name@domain.com' };
      }

      const [name, domain] = parts;

      // Fetch .well-known/nostr.json
      const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        return { verified: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();

      // Check if name exists in response
      if (!data.names || !(name in data.names)) {
        return { verified: false, error: 'Name not found in NIP-05 response' };
      }

      const pubkey = data.names[name];

      return { verified: true, pubkey };
    } catch (error) {
      console.error('NIP-05 verification error:', error);
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Set NIP-05 identifier for a pubkey
   */
  static async setNIP05(pubkey: string, identifier: string): Promise<boolean> {
    // Verify the identifier
    const result = await this.verifyNIP05(identifier);

    if (!result.verified) {
      console.error('NIP-05 verification failed:', result.error);
      return false;
    }

    // Check that the verified pubkey matches
    if (result.pubkey !== pubkey) {
      console.error('NIP-05 pubkey mismatch');
      return false;
    }

    // Update identity
    await dal.update('identities', pubkey, {
      nip05: identifier,
      nip05Verified: true,
    });

    return true;
  }

  /**
   * Remove NIP-05 verification
   */
  static async removeNIP05(pubkey: string): Promise<void> {
    await dal.update('identities', pubkey, {
      nip05: undefined,
      nip05Verified: false,
    });
  }

  /**
   * Broadcast NIP-01 kind:0 metadata event to configured relays
   *
   * This publishes the user's profile metadata (name, display_name, about,
   * picture, nip05) as a replaceable event to all configured write relays.
   *
   * @param pubkey - The public key of the identity to broadcast
   */
  static async broadcastMetadata(pubkey: string): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      logger.warn('Cannot broadcast metadata: app is locked');
      return;
    }

    try {
      // Load identity data from database
      const identity = await dal.get<{
        publicKey: string;
        username?: string;
        displayName?: string;
        name?: string;
        nip05?: string;
        about?: string;
        picture?: string;
      }>('identities', pubkey);

      if (!identity) {
        logger.warn('Cannot broadcast metadata: identity not found');
        return;
      }

      // Build NIP-01 metadata object
      const metadata: Record<string, string | undefined> = {
        name: identity.username || identity.name,
        display_name: identity.displayName,
        about: identity.about,
        picture: identity.picture,
        nip05: identity.nip05,
      };

      // Remove undefined fields to keep the event clean
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([, v]) => v !== undefined)
      ) as Record<string, string>;

      // Create and sign kind:0 metadata event
      const metadataEvent = createMetadataEvent(cleanMetadata, privateKey);

      // Publish to relays
      const client = getNostrClient();
      const results = await client.publishWithPrivacy(metadataEvent, {
        priority: 'normal',
        isCritical: false,
      });

      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      if (successes.length > 0) {
        logger.info(`Broadcast metadata to ${successes.length} relays for ${pubkey.slice(0, 8)}...`);
      }
      if (failures.length > 0) {
        logger.warn(`Metadata broadcast failed on ${failures.length} relays`);
      }
    } catch (error) {
      // Non-fatal: metadata broadcast failure should not break profile updates
      logger.warn('Failed to broadcast metadata:', error);
    }
  }
}
