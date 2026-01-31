import { dal } from '@/core/storage/dal';
import { validateUsername, isUsernameAvailable, normalizeUsername } from './usernameUtils';
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

      // Nostr relay broadcast deferred to Phase 2 (see docs/TECH_DEBT.md)

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
}
