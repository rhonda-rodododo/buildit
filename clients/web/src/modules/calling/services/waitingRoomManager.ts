/**
 * Waiting Room Manager
 * Manages waiting room for conference calls
 *
 * Features:
 * - Participants wait before being admitted
 * - Host can admit/deny individually or all at once
 * - Waiting participants can see meeting info
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';

export interface WaitingParticipant {
  pubkey: string;
  displayName?: string;
  joinedAt: number;
}

export interface WaitingRoomManagerEvents {
  'participant-waiting': (participant: WaitingParticipant) => void;
  'participant-admitted': (pubkey: string) => void;
  'participant-denied': (pubkey: string, reason?: string) => void;
  'queue-updated': (queue: WaitingParticipant[]) => void;
}

/**
 * Waiting Room Manager
 */
export class WaitingRoomManager extends EventEmitter {
  private waitingQueue: Map<string, WaitingParticipant> = new Map();
  private isEnabled = true;
  private onAdmit?: (pubkey: string) => Promise<void>;
  private onDeny?: (pubkey: string, reason?: string) => Promise<void>;

  constructor(_roomId: string) {
    super();
  }

  /**
   * Enable or disable waiting room
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info('Waiting room enabled', { enabled });
  }

  /**
   * Check if waiting room is enabled
   */
  isWaitingRoomEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set callback for when participant is admitted
   */
  setOnAdmit(callback: (pubkey: string) => Promise<void>): void {
    this.onAdmit = callback;
  }

  /**
   * Set callback for when participant is denied
   */
  setOnDeny(callback: (pubkey: string, reason?: string) => Promise<void>): void {
    this.onDeny = callback;
  }

  /**
   * Add participant to waiting room
   */
  addToWaitingRoom(pubkey: string, displayName?: string): void {
    if (!this.isEnabled) {
      // If disabled, admit immediately
      this.emit('participant-admitted', pubkey);
      return;
    }

    const participant: WaitingParticipant = {
      pubkey,
      displayName,
      joinedAt: Date.now(),
    };

    this.waitingQueue.set(pubkey, participant);
    this.emit('participant-waiting', participant);
    this.emit('queue-updated', this.getWaitingList());

    logger.info('Participant added to waiting room', { pubkey, displayName });
  }

  /**
   * Admit a participant
   */
  async admitParticipant(pubkey: string): Promise<void> {
    const participant = this.waitingQueue.get(pubkey);
    if (!participant) {
      logger.warn('Participant not in waiting room', { pubkey });
      return;
    }

    this.waitingQueue.delete(pubkey);

    if (this.onAdmit) {
      await this.onAdmit(pubkey);
    }

    this.emit('participant-admitted', pubkey);
    this.emit('queue-updated', this.getWaitingList());

    logger.info('Participant admitted', { pubkey });
  }

  /**
   * Deny a participant
   */
  async denyParticipant(pubkey: string, reason?: string): Promise<void> {
    const participant = this.waitingQueue.get(pubkey);
    if (!participant) {
      logger.warn('Participant not in waiting room', { pubkey });
      return;
    }

    this.waitingQueue.delete(pubkey);

    if (this.onDeny) {
      await this.onDeny(pubkey, reason);
    }

    this.emit('participant-denied', pubkey, reason);
    this.emit('queue-updated', this.getWaitingList());

    logger.info('Participant denied', { pubkey, reason });
  }

  /**
   * Admit all waiting participants
   */
  async admitAll(): Promise<void> {
    const participants = Array.from(this.waitingQueue.keys());

    for (const pubkey of participants) {
      await this.admitParticipant(pubkey);
    }

    logger.info('All participants admitted', { count: participants.length });
  }

  /**
   * Get list of waiting participants
   */
  getWaitingList(): WaitingParticipant[] {
    return Array.from(this.waitingQueue.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt
    );
  }

  /**
   * Get waiting count
   */
  getWaitingCount(): number {
    return this.waitingQueue.size;
  }

  /**
   * Check if participant is waiting
   */
  isWaiting(pubkey: string): boolean {
    return this.waitingQueue.has(pubkey);
  }

  /**
   * Remove participant (e.g., if they leave while waiting)
   */
  removeFromWaitingRoom(pubkey: string): void {
    if (this.waitingQueue.delete(pubkey)) {
      this.emit('queue-updated', this.getWaitingList());
      logger.info('Participant removed from waiting room', { pubkey });
    }
  }

  /**
   * Clear waiting room
   */
  clear(): void {
    this.waitingQueue.clear();
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
export function createWaitingRoomManager(roomId: string): WaitingRoomManager {
  return new WaitingRoomManager(roomId);
}
