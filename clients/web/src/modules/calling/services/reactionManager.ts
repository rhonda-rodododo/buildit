/**
 * Reaction Manager
 * Manages emoji reactions for conference calls
 *
 * Features:
 * - Send reactions (emoji)
 * - Receive and display reactions
 * - Auto-dismiss after timeout
 * - Transport-agnostic (works with BLE mesh or Nostr relays)
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

/** Supported reaction emojis */
export const SUPPORTED_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '🎉', '👏', '✋'] as const;
export type ReactionEmoji = (typeof SUPPORTED_REACTIONS)[number];

export interface ReactionEvent {
  id: string;
  pubkey: string;
  emoji: ReactionEmoji;
  timestamp: number;
}

export interface ReactionManagerEvents {
  'reaction-received': (reaction: ReactionEvent) => void;
  'reaction-expired': (reactionId: string) => void;
  'reactions-updated': (activeReactions: ReactionEvent[]) => void;
}

/** Reaction display duration in milliseconds */
const REACTION_DISPLAY_DURATION = 5000;

/**
 * Reaction Manager
 */
export class ReactionManager extends EventEmitter {
  private activeReactions: Map<string, ReactionEvent> = new Map();
  private expirationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private onSendReaction?: (emoji: ReactionEmoji) => Promise<void>;
  private reactionCounter = 0;

  constructor(_roomId: string) {
    super();
  }

  /**
   * Set callback for sending reactions
   * This allows the manager to be transport-agnostic
   */
  setOnSendReaction(callback: (emoji: ReactionEmoji) => Promise<void>): void {
    this.onSendReaction = callback;
  }

  /**
   * Send a reaction (local user)
   */
  async sendReaction(pubkey: string, emoji: ReactionEmoji): Promise<void> {
    if (!SUPPORTED_REACTIONS.includes(emoji)) {
      logger.warn('Unsupported reaction emoji', { emoji });
      return;
    }

    const reaction: ReactionEvent = {
      id: `${pubkey}-${++this.reactionCounter}`,
      pubkey,
      emoji,
      timestamp: Date.now(),
    };

    // Add to active reactions
    this.addReaction(reaction);

    // Send via transport layer
    if (this.onSendReaction) {
      await this.onSendReaction(emoji);
    }

    logger.debug('Reaction sent', { pubkey, emoji });
  }

  /**
   * Handle remote reaction event
   */
  handleRemoteReaction(pubkey: string, emoji: string, timestamp?: number): void {
    if (!SUPPORTED_REACTIONS.includes(emoji as ReactionEmoji)) {
      logger.warn('Received unsupported reaction emoji', { emoji });
      return;
    }

    const reaction: ReactionEvent = {
      id: `${pubkey}-${++this.reactionCounter}`,
      pubkey,
      emoji: emoji as ReactionEmoji,
      timestamp: timestamp || Date.now(),
    };

    this.addReaction(reaction);
    logger.debug('Remote reaction received', { pubkey, emoji });
  }

  /**
   * Add reaction and schedule expiration
   */
  private addReaction(reaction: ReactionEvent): void {
    this.activeReactions.set(reaction.id, reaction);
    this.emit('reaction-received', reaction);
    this.emit('reactions-updated', this.getActiveReactions());

    // Schedule auto-removal
    const timer = setTimeout(() => {
      this.removeReaction(reaction.id);
    }, REACTION_DISPLAY_DURATION);

    this.expirationTimers.set(reaction.id, timer);
  }

  /**
   * Remove reaction
   */
  private removeReaction(reactionId: string): void {
    if (!this.activeReactions.has(reactionId)) {
      return;
    }

    this.activeReactions.delete(reactionId);

    const timer = this.expirationTimers.get(reactionId);
    if (timer) {
      clearTimeout(timer);
      this.expirationTimers.delete(reactionId);
    }

    this.emit('reaction-expired', reactionId);
    this.emit('reactions-updated', this.getActiveReactions());
  }

  /**
   * Get all active reactions
   */
  getActiveReactions(): ReactionEvent[] {
    return Array.from(this.activeReactions.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get active reactions for a participant
   */
  getParticipantReactions(pubkey: string): ReactionEvent[] {
    return this.getActiveReactions().filter((r) => r.pubkey === pubkey);
  }

  /**
   * Get reaction counts
   */
  getReactionCounts(): Map<ReactionEmoji, number> {
    const counts = new Map<ReactionEmoji, number>();

    for (const emoji of SUPPORTED_REACTIONS) {
      counts.set(emoji, 0);
    }

    for (const reaction of this.activeReactions.values()) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    }

    return counts;
  }

  /**
   * Clear all reactions
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }

    this.activeReactions.clear();
    this.expirationTimers.clear();
    this.emit('reactions-updated', []);
  }

  /**
   * Close the manager
   */
  close(): void {
    this.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createReactionManager(roomId: string): ReactionManager {
  return new ReactionManager(roomId);
}
