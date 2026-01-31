/**
 * Breakout Room Manager
 * Manages breakout rooms for conference calls
 *
 * Features:
 * - Create breakout rooms
 * - Assign participants manually or automatically
 * - Timer with warnings before close
 * - Host can visit any breakout
 * - Broadcast to all breakouts
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface BreakoutRoom {
  id: string;
  name: string;
  participants: string[];
  capacity?: number;
  mlsGroupId?: string;
}

export interface BreakoutState {
  isOpen: boolean;
  duration?: number; // seconds
  openedAt?: number;
  warningIssued?: boolean;
}

export interface BreakoutRoomManagerEvents {
  'rooms-created': (rooms: BreakoutRoom[]) => void;
  'participant-assigned': (pubkey: string, breakoutId: string) => void;
  'breakouts-opened': (duration?: number) => void;
  'breakouts-closed': () => void;
  'timer-warning': (secondsRemaining: number) => void;
  'help-requested': (pubkey: string, breakoutId: string) => void;
  'broadcast-sent': (message: string) => void;
}

/** Warning issued 60 seconds before close */
const WARNING_THRESHOLD_SECONDS = 60;

/**
 * Breakout Room Manager
 */
export class BreakoutRoomManager extends EventEmitter {
  private mainRoomId: string;
  private breakoutRooms: Map<string, BreakoutRoom> = new Map();
  private participantAssignments: Map<string, string> = new Map(); // pubkey -> breakoutId
  private state: BreakoutState = { isOpen: false };
  private timerInterval?: ReturnType<typeof setInterval>;
  private onSendToBreakout?: (breakoutId: string, type: string, data?: unknown) => Promise<void>;
  private onBroadcastAll?: (message: string) => Promise<void>;

  constructor(mainRoomId: string) {
    super();
    this.mainRoomId = mainRoomId;
  }

  /**
   * Set callback for sending to specific breakout
   */
  setOnSendToBreakout(
    callback: (breakoutId: string, type: string, data?: unknown) => Promise<void>
  ): void {
    this.onSendToBreakout = callback;
  }

  /**
   * Set callback for broadcasting to all breakouts
   */
  setOnBroadcastAll(callback: (message: string) => Promise<void>): void {
    this.onBroadcastAll = callback;
  }

  /**
   * Create breakout rooms
   */
  createBreakoutRooms(count: number, names?: string[]): BreakoutRoom[] {
    const rooms: BreakoutRoom[] = [];

    for (let i = 0; i < count; i++) {
      const room: BreakoutRoom = {
        id: uuidv4(),
        name: names?.[i] ?? `Breakout ${i + 1}`,
        participants: [],
      };
      this.breakoutRooms.set(room.id, room);
      rooms.push(room);
    }

    this.emit('rooms-created', rooms);
    logger.info('Created breakout rooms', { count });

    return rooms;
  }

  /**
   * Get all breakout rooms
   */
  getBreakoutRooms(): BreakoutRoom[] {
    return Array.from(this.breakoutRooms.values());
  }

  /**
   * Get breakout room by ID
   */
  getBreakoutRoom(breakoutId: string): BreakoutRoom | undefined {
    return this.breakoutRooms.get(breakoutId);
  }

  /**
   * Assign participant to breakout room
   */
  assignParticipant(pubkey: string, breakoutId: string): void {
    const room = this.breakoutRooms.get(breakoutId);
    if (!room) {
      throw new Error('Breakout room not found');
    }

    // Remove from previous assignment
    const previousId = this.participantAssignments.get(pubkey);
    if (previousId) {
      const previousRoom = this.breakoutRooms.get(previousId);
      if (previousRoom) {
        previousRoom.participants = previousRoom.participants.filter((p) => p !== pubkey);
      }
    }

    // Add to new room
    room.participants.push(pubkey);
    this.participantAssignments.set(pubkey, breakoutId);

    this.emit('participant-assigned', pubkey, breakoutId);
    logger.info('Participant assigned to breakout', { pubkey, breakoutId });
  }

  /**
   * Auto-assign participants to breakout rooms
   */
  autoAssign(
    participants: string[],
    mode: 'random' | 'alphabetical' = 'random'
  ): void {
    const rooms = this.getBreakoutRooms();
    if (rooms.length === 0) {
      throw new Error('No breakout rooms created');
    }

    // Sort participants based on mode
    const sortedParticipants = [...participants];
    if (mode === 'random') {
      // Fisher-Yates shuffle
      for (let i = sortedParticipants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortedParticipants[i], sortedParticipants[j]] = [
          sortedParticipants[j],
          sortedParticipants[i],
        ];
      }
    } else {
      sortedParticipants.sort();
    }

    // Distribute evenly
    sortedParticipants.forEach((pubkey, index) => {
      const roomIndex = index % rooms.length;
      this.assignParticipant(pubkey, rooms[roomIndex].id);
    });

    logger.info('Auto-assigned participants', { mode, count: participants.length });
  }

  /**
   * Get participant's current breakout assignment
   */
  getParticipantBreakout(pubkey: string): string | undefined {
    return this.participantAssignments.get(pubkey);
  }

  /**
   * Open breakout rooms
   */
  openBreakouts(duration?: number): void {
    this.state = {
      isOpen: true,
      duration,
      openedAt: Date.now(),
      warningIssued: false,
    };

    // Start timer if duration specified
    if (duration) {
      this.startTimer(duration);
    }

    this.emit('breakouts-opened', duration);
    logger.info('Breakout rooms opened', { duration });
  }

  /**
   * Close breakout rooms
   */
  closeBreakouts(): void {
    this.stopTimer();

    this.state = { isOpen: false };

    // Notify all participants to return
    for (const breakoutId of this.breakoutRooms.keys()) {
      if (this.onSendToBreakout) {
        this.onSendToBreakout(breakoutId, 'return-to-main', {
          mainRoomId: this.mainRoomId,
        });
      }
    }

    this.emit('breakouts-closed');
    logger.info('Breakout rooms closed');
  }

  /**
   * Check if breakouts are open
   */
  isOpen(): boolean {
    return this.state.isOpen;
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingTime(): number | undefined {
    if (!this.state.isOpen || !this.state.duration || !this.state.openedAt) {
      return undefined;
    }

    const elapsed = (Date.now() - this.state.openedAt) / 1000;
    return Math.max(0, this.state.duration - elapsed);
  }

  /**
   * Start timer
   */
  private startTimer(_duration: number): void {
    this.stopTimer();

    this.timerInterval = setInterval(() => {
      const remaining = this.getRemainingTime();
      if (remaining === undefined) return;

      // Issue warning
      if (!this.state.warningIssued && remaining <= WARNING_THRESHOLD_SECONDS) {
        this.state.warningIssued = true;
        this.emit('timer-warning', remaining);
        this.broadcastToAll(`Breakout rooms will close in ${Math.round(remaining)} seconds`);
      }

      // Auto-close
      if (remaining <= 0) {
        this.closeBreakouts();
      }
    }, 1000);
  }

  /**
   * Stop timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  /**
   * Request help from main room
   */
  requestHelp(pubkey: string): void {
    const breakoutId = this.participantAssignments.get(pubkey);
    if (!breakoutId) return;

    this.emit('help-requested', pubkey, breakoutId);
    logger.info('Help requested from breakout', { pubkey, breakoutId });
  }

  /**
   * Host visits a breakout room
   */
  async visitBreakout(breakoutId: string): Promise<void> {
    const room = this.breakoutRooms.get(breakoutId);
    if (!room) {
      throw new Error('Breakout room not found');
    }

    // In production, this would join the breakout's MLS group temporarily
    logger.info('Host visiting breakout', { breakoutId });
  }

  /**
   * Broadcast message to all breakouts
   */
  async broadcastToAll(message: string): Promise<void> {
    if (this.onBroadcastAll) {
      await this.onBroadcastAll(message);
    }

    for (const breakoutId of this.breakoutRooms.keys()) {
      if (this.onSendToBreakout) {
        await this.onSendToBreakout(breakoutId, 'broadcast', { message });
      }
    }

    this.emit('broadcast-sent', message);
    logger.info('Broadcast sent to all breakouts', { message });
  }

  /**
   * Delete a breakout room
   */
  deleteBreakoutRoom(breakoutId: string): void {
    const room = this.breakoutRooms.get(breakoutId);
    if (!room) return;

    // Remove participant assignments
    for (const pubkey of room.participants) {
      this.participantAssignments.delete(pubkey);
    }

    this.breakoutRooms.delete(breakoutId);
    logger.info('Breakout room deleted', { breakoutId });
  }

  /**
   * Clear all breakout rooms
   */
  clearBreakoutRooms(): void {
    this.stopTimer();
    this.breakoutRooms.clear();
    this.participantAssignments.clear();
    this.state = { isOpen: false };
    logger.info('All breakout rooms cleared');
  }

  /**
   * Close the manager
   */
  close(): void {
    this.stopTimer();
    this.clearBreakoutRooms();
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createBreakoutRoomManager(mainRoomId: string): BreakoutRoomManager {
  return new BreakoutRoomManager(mainRoomId);
}
