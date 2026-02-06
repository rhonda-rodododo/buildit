/**
 * Ephemeral Message Manager
 *
 * Manages self-destructing messages with configurable TTL (time-to-live).
 * After a message is read and the TTL expires, it is SECURELY DELETED -
 * not soft-deleted, but actually removed from the database.
 *
 * SECURITY:
 * - Messages are tracked by readAt timestamp + ttl
 * - Deletion overwrites content before removal to resist forensic recovery
 * - Background timer periodically checks for expired messages
 * - Orphaned ephemeral metadata is cleaned up periodically
 *
 * This feature is OPT-IN: messages are only ephemeral when the sender
 * explicitly sets an ephemeral TTL.
 */

import { dal } from '@/core/storage/dal';
import { logger } from '@/lib/logger';
import type { ConversationMessage } from './conversationTypes';

/**
 * Ephemeral configuration for a message
 */
export interface EphemeralConfig {
  /** Time-to-live in seconds after the message is read */
  ttl: number;
}

/**
 * Tracked ephemeral message state
 */
interface EphemeralMessageState {
  messageId: string;
  conversationId: string;
  ttl: number; // seconds
  readAt: number | null; // timestamp when message was first read (ms)
  expiresAt: number | null; // computed: readAt + (ttl * 1000)
}

/**
 * Dexie/DAL table name for ephemeral tracking
 * This is stored separately from messages so deletion of the message
 * also removes the tracking record.
 */
const EPHEMERAL_STORE_KEY = 'ephemeralMessages';

/**
 * Background check interval (30 seconds)
 */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Orphan cleanup interval (5 minutes)
 */
const ORPHAN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

class EphemeralMessageManager {
  private trackedMessages: Map<string, EphemeralMessageState> = new Map();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private orphanCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private onMessageExpired: ((messageId: string, conversationId: string) => void) | null = null;

  /**
   * Start the ephemeral message manager
   * @param onExpired - callback when a message expires (for UI updates)
   */
  start(onExpired?: (messageId: string, conversationId: string) => void): void {
    if (this.checkTimer) {
      return; // Already running
    }

    this.onMessageExpired = onExpired || null;

    // Start periodic expiration check
    this.checkTimer = setInterval(() => {
      this.checkExpiredMessages();
    }, CHECK_INTERVAL_MS);

    // Start periodic orphan cleanup
    this.orphanCleanupTimer = setInterval(() => {
      this.cleanupOrphans();
    }, ORPHAN_CLEANUP_INTERVAL_MS);

    logger.info('Ephemeral message manager started');
  }

  /**
   * Stop the ephemeral message manager
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.orphanCleanupTimer) {
      clearInterval(this.orphanCleanupTimer);
      this.orphanCleanupTimer = null;
    }
    this.trackedMessages.clear();
    this.onMessageExpired = null;
    logger.info('Ephemeral message manager stopped');
  }

  /**
   * Register a message as ephemeral
   * Called when a message with ephemeral.ttl is received or sent
   */
  trackMessage(messageId: string, conversationId: string, ttl: number): void {
    if (ttl <= 0) {
      return; // Invalid TTL, skip
    }

    const state: EphemeralMessageState = {
      messageId,
      conversationId,
      ttl,
      readAt: null,
      expiresAt: null,
    };

    this.trackedMessages.set(messageId, state);

    // Persist tracking state
    this.persistState(messageId, state).catch((err) => {
      logger.warn('Failed to persist ephemeral state:', err);
    });
  }

  /**
   * Mark a message as read, starting the TTL countdown
   * Returns the expiration timestamp (ms) or null if not ephemeral
   */
  markAsRead(messageId: string): number | null {
    const state = this.trackedMessages.get(messageId);
    if (!state) {
      return null;
    }

    // Only set readAt once (first read)
    if (state.readAt !== null) {
      return state.expiresAt;
    }

    const now = Date.now();
    state.readAt = now;
    state.expiresAt = now + state.ttl * 1000;

    // Update persisted state
    this.persistState(messageId, state).catch((err) => {
      logger.warn('Failed to update ephemeral state:', err);
    });

    return state.expiresAt;
  }

  /**
   * Get the remaining time (in seconds) for an ephemeral message.
   * Returns null if message is not tracked, not yet read, or already expired.
   */
  getRemainingSeconds(messageId: string): number | null {
    const state = this.trackedMessages.get(messageId);
    if (!state || !state.expiresAt) {
      return null;
    }

    const remaining = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Check if a message is ephemeral
   */
  isEphemeral(messageId: string): boolean {
    return this.trackedMessages.has(messageId);
  }

  /**
   * Get ephemeral config for a message
   */
  getEphemeralConfig(messageId: string): EphemeralConfig | null {
    const state = this.trackedMessages.get(messageId);
    if (!state) return null;
    return { ttl: state.ttl };
  }

  /**
   * Check for and delete expired messages
   * This runs on the background timer
   */
  private async checkExpiredMessages(): Promise<void> {
    const now = Date.now();
    const expired: EphemeralMessageState[] = [];

    for (const [, state] of this.trackedMessages) {
      if (state.expiresAt !== null && now >= state.expiresAt) {
        expired.push(state);
      }
    }

    for (const state of expired) {
      await this.secureDeleteMessage(state.messageId, state.conversationId);
    }
  }

  /**
   * Securely delete an expired ephemeral message
   *
   * SECURITY: Overwrites message content with random data before deletion
   * to resist forensic recovery from IndexedDB/SQLite. This is a best-effort
   * defense - the OS may still have copies in swap/journal, but we reduce
   * the attack surface significantly.
   */
  private async secureDeleteMessage(
    messageId: string,
    conversationId: string
  ): Promise<void> {
    try {
      // Step 1: Overwrite the message content with random data
      // This makes forensic recovery much harder
      const randomBytes = new Uint8Array(64);
      crypto.getRandomValues(randomBytes);
      const overwriteContent = Array.from(randomBytes)
        .map((b) => String.fromCharCode(b % 94 + 33))
        .join('');

      try {
        await dal.update('conversationMessages', messageId, {
          content: overwriteContent,
          // Overwrite any other potentially sensitive fields
        });
      } catch {
        // Message might already be deleted, continue
      }

      // Step 2: Actually delete the record
      try {
        await dal.delete('conversationMessages', messageId);
      } catch {
        // Best effort - may fail if already deleted
      }

      // Step 3: Remove tracking state
      this.trackedMessages.delete(messageId);
      try {
        await dal.delete(EPHEMERAL_STORE_KEY, messageId);
      } catch {
        // Best effort
      }

      // Step 4: Notify UI
      if (this.onMessageExpired) {
        this.onMessageExpired(messageId, conversationId);
      }

      logger.info(`Ephemeral message ${messageId.slice(0, 8)}... securely deleted`);
    } catch (err) {
      logger.warn(`Failed to securely delete ephemeral message ${messageId}:`, err);
    }
  }

  /**
   * Clean up orphaned ephemeral tracking entries
   * (entries whose messages no longer exist in the database)
   */
  private async cleanupOrphans(): Promise<void> {
    try {
      const orphanIds: string[] = [];

      for (const [messageId] of this.trackedMessages) {
        try {
          const msg = await dal.get<ConversationMessage>(
            'conversationMessages',
            messageId
          );
          if (!msg) {
            orphanIds.push(messageId);
          }
        } catch {
          // If we can't check, skip
        }
      }

      for (const id of orphanIds) {
        this.trackedMessages.delete(id);
        try {
          await dal.delete(EPHEMERAL_STORE_KEY, id);
        } catch {
          // Best effort
        }
      }

      if (orphanIds.length > 0) {
        logger.info(`Cleaned up ${orphanIds.length} orphaned ephemeral entries`);
      }
    } catch (err) {
      logger.warn('Ephemeral orphan cleanup error:', err);
    }
  }

  /**
   * Persist ephemeral state to database (for survival across page refreshes)
   */
  private async persistState(
    messageId: string,
    state: EphemeralMessageState
  ): Promise<void> {
    try {
      await dal.put(EPHEMERAL_STORE_KEY, {
        id: messageId,
        ...state,
      });
    } catch {
      // Ephemeral store might not exist yet - that's OK
      // Messages will still be tracked in memory for this session
    }
  }

  /**
   * Load persisted ephemeral state from database
   * Call on startup to restore tracking state
   */
  async loadPersistedState(): Promise<void> {
    try {
      const states = await dal.getAll<EphemeralMessageState & { id: string }>(
        EPHEMERAL_STORE_KEY
      );

      for (const state of states) {
        this.trackedMessages.set(state.messageId, {
          messageId: state.messageId,
          conversationId: state.conversationId,
          ttl: state.ttl,
          readAt: state.readAt,
          expiresAt: state.expiresAt,
        });
      }

      logger.info(`Loaded ${states.length} ephemeral message states`);

      // Immediately check for any that expired while we were offline
      await this.checkExpiredMessages();
    } catch {
      // Store might not exist yet
    }
  }

  /**
   * Get all tracked ephemeral messages for a conversation
   * Useful for rendering ephemeral indicators in the UI
   */
  getConversationEphemeralMessages(conversationId: string): Map<string, EphemeralMessageState> {
    const result = new Map<string, EphemeralMessageState>();
    for (const [id, state] of this.trackedMessages) {
      if (state.conversationId === conversationId) {
        result.set(id, state);
      }
    }
    return result;
  }
}

/**
 * Singleton instance
 */
export const ephemeralManager = new EphemeralMessageManager();

/**
 * Parse ephemeral config from message content
 * Messages with ephemeral TTL include it in the structured content envelope
 */
export function parseEphemeralConfig(content: string): EphemeralConfig | null {
  try {
    const parsed = JSON.parse(content);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.ephemeral === 'object' &&
      typeof parsed.ephemeral.ttl === 'number' &&
      parsed.ephemeral.ttl > 0
    ) {
      return { ttl: parsed.ephemeral.ttl };
    }
  } catch {
    // Not structured content, no ephemeral config
  }
  return null;
}

/**
 * Create message content with ephemeral config
 * Wraps the content in a structured envelope with TTL
 */
export function createEphemeralContent(
  content: string,
  ttl: number
): string {
  return JSON.stringify({
    content,
    ephemeral: { ttl },
  });
}

/**
 * Extract actual message content from ephemeral envelope
 */
export function extractEphemeralContent(rawContent: string): {
  content: string;
  ephemeral: EphemeralConfig | null;
} {
  try {
    const parsed = JSON.parse(rawContent);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.content === 'string'
    ) {
      const ephemeral =
        typeof parsed.ephemeral === 'object' &&
        typeof parsed.ephemeral?.ttl === 'number'
          ? { ttl: parsed.ephemeral.ttl }
          : null;

      return {
        content: parsed.content,
        ephemeral,
      };
    }
  } catch {
    // Not structured
  }

  return { content: rawContent, ephemeral: null };
}
