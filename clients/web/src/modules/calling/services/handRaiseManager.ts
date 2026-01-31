/**
 * Hand Raise Manager
 * Manages hand raising queue for conference calls
 *
 * Features:
 * - FIFO queue for raised hands
 * - Moderator can lower hands
 * - Visual queue with timestamps
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';

export interface RaisedHand {
  pubkey: string;
  raisedAt: number;
  position: number;
}

export interface HandRaiseManagerEvents {
  'hand-raised': (hand: RaisedHand) => void;
  'hand-lowered': (pubkey: string) => void;
  'queue-updated': (queue: RaisedHand[]) => void;
}

/**
 * Hand Raise Manager
 */
export class HandRaiseManager extends EventEmitter {
  private raisedHands: Map<string, { pubkey: string; raisedAt: number }> = new Map();
  private onSendHandRaise?: (pubkey: string, action: 'raise' | 'lower') => Promise<void>;

  constructor(_roomId: string) {
    super();
  }

  /**
   * Set callback for sending hand raise events
   */
  setOnSendHandRaise(
    callback: (pubkey: string, action: 'raise' | 'lower') => Promise<void>
  ): void {
    this.onSendHandRaise = callback;
  }

  /**
   * Raise hand (local user)
   */
  async raiseHand(pubkey: string): Promise<void> {
    if (this.raisedHands.has(pubkey)) {
      return; // Already raised
    }

    const hand = {
      pubkey,
      raisedAt: Date.now(),
    };

    this.raisedHands.set(pubkey, hand);

    if (this.onSendHandRaise) {
      await this.onSendHandRaise(pubkey, 'raise');
    }

    const queue = this.getQueue();
    const raisedHand = queue.find((h) => h.pubkey === pubkey)!;

    this.emit('hand-raised', raisedHand);
    this.emit('queue-updated', queue);

    logger.info('Hand raised', { pubkey });
  }

  /**
   * Lower hand (local user or moderator)
   */
  async lowerHand(pubkey: string): Promise<void> {
    if (!this.raisedHands.has(pubkey)) {
      return; // Not raised
    }

    this.raisedHands.delete(pubkey);

    if (this.onSendHandRaise) {
      await this.onSendHandRaise(pubkey, 'lower');
    }

    this.emit('hand-lowered', pubkey);
    this.emit('queue-updated', this.getQueue());

    logger.info('Hand lowered', { pubkey });
  }

  /**
   * Handle remote hand raise event
   */
  handleRemoteHandRaise(pubkey: string, action: 'raise' | 'lower'): void {
    if (action === 'raise') {
      if (!this.raisedHands.has(pubkey)) {
        const hand = {
          pubkey,
          raisedAt: Date.now(),
        };
        this.raisedHands.set(pubkey, hand);

        const queue = this.getQueue();
        const raisedHand = queue.find((h) => h.pubkey === pubkey)!;

        this.emit('hand-raised', raisedHand);
        this.emit('queue-updated', queue);
      }
    } else {
      if (this.raisedHands.has(pubkey)) {
        this.raisedHands.delete(pubkey);
        this.emit('hand-lowered', pubkey);
        this.emit('queue-updated', this.getQueue());
      }
    }
  }

  /**
   * Lower hand for participant (moderator action)
   */
  async lowerHandFor(pubkey: string): Promise<void> {
    await this.lowerHand(pubkey);
    logger.info('Moderator lowered hand for participant', { pubkey });
  }

  /**
   * Lower all hands (moderator action)
   */
  async lowerAllHands(): Promise<void> {
    const pubkeys = Array.from(this.raisedHands.keys());

    for (const pubkey of pubkeys) {
      await this.lowerHand(pubkey);
    }

    logger.info('Moderator lowered all hands', { count: pubkeys.length });
  }

  /**
   * Check if hand is raised
   */
  isHandRaised(pubkey: string): boolean {
    return this.raisedHands.has(pubkey);
  }

  /**
   * Get queue ordered by raise time
   */
  getQueue(): RaisedHand[] {
    const hands = Array.from(this.raisedHands.values())
      .sort((a, b) => a.raisedAt - b.raisedAt)
      .map((hand, index) => ({
        ...hand,
        position: index + 1,
      }));

    return hands;
  }

  /**
   * Get queue count
   */
  getQueueCount(): number {
    return this.raisedHands.size;
  }

  /**
   * Get position in queue
   */
  getPosition(pubkey: string): number | null {
    const queue = this.getQueue();
    const hand = queue.find((h) => h.pubkey === pubkey);
    return hand?.position ?? null;
  }

  /**
   * Clear all hands
   */
  clear(): void {
    this.raisedHands.clear();
    this.emit('queue-updated', []);
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
export function createHandRaiseManager(roomId: string): HandRaiseManager {
  return new HandRaiseManager(roomId);
}
