/**
 * Host Controls Manager
 * Manages moderator controls for conference calls
 *
 * Features:
 * - Mute/unmute participants
 * - Remove participants
 * - Promote/demote co-hosts
 * - Lock/unlock room
 * - End meeting for all
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';

export type ParticipantRole = 'host' | 'co_host' | 'moderator' | 'participant' | 'viewer';

export interface ParticipantPermissions {
  canUnmute: boolean;
  canVideo: boolean;
  canScreenShare: boolean;
  canChat: boolean;
  canRaiseHand: boolean;
}

export interface HostControlsManagerEvents {
  'mute-requested': (pubkey: string) => void;
  'mute-all-requested': (exceptHosts: boolean) => void;
  'audio-locked': () => void;
  'audio-unlocked': () => void;
  'participant-removed': (pubkey: string) => void;
  'role-changed': (pubkey: string, role: ParticipantRole) => void;
  'room-locked': () => void;
  'room-unlocked': () => void;
  'meeting-ended': () => void;
}

/**
 * Host Controls Manager
 */
export class HostControlsManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private localRole: ParticipantRole;
  private participantRoles: Map<string, ParticipantRole> = new Map();
  private isRoomLocked = false;
  private isAudioLocked = false;
  private mutedParticipants: Set<string> = new Set();
  private onSendControl?: (pubkey: string, type: string, data?: unknown) => Promise<void>;

  constructor(roomId: string, localPubkey: string, isHost: boolean) {
    super();
    this.roomId = roomId;
    this.localPubkey = localPubkey;
    this.localRole = isHost ? 'host' : 'participant';
    this.participantRoles.set(localPubkey, this.localRole);
  }

  /**
   * Set callback for sending control messages
   */
  setOnSendControl(callback: (pubkey: string, type: string, data?: unknown) => Promise<void>): void {
    this.onSendControl = callback;
  }

  /**
   * Check if local user is host or co-host
   */
  isHostOrCoHost(): boolean {
    return this.localRole === 'host' || this.localRole === 'co_host';
  }

  /**
   * Check if local user is moderator or higher
   */
  isModerator(): boolean {
    return ['host', 'co_host', 'moderator'].includes(this.localRole);
  }

  /**
   * Set participant role
   */
  setParticipantRole(pubkey: string, role: ParticipantRole): void {
    this.participantRoles.set(pubkey, role);
  }

  /**
   * Get participant role
   */
  getParticipantRole(pubkey: string): ParticipantRole {
    return this.participantRoles.get(pubkey) ?? 'participant';
  }

  /**
   * Request soft mute (participant can unmute)
   */
  async requestMute(pubkey: string): Promise<void> {
    if (!this.isModerator()) {
      throw new Error('Only moderators can request mute');
    }

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'mute-request', { roomId: this.roomId });
    }

    this.emit('mute-requested', pubkey);
    logger.info('Mute requested', { pubkey });
  }

  /**
   * Force mute (host only, participant cannot unmute)
   */
  async forceMute(pubkey: string): Promise<void> {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can force mute');
    }

    this.mutedParticipants.add(pubkey);

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'force-mute', { roomId: this.roomId });
    }

    this.emit('mute-requested', pubkey);
    logger.info('Force muted', { pubkey });
  }

  /**
   * Mute all participants
   */
  async muteAll(exceptHosts = true): Promise<void> {
    if (!this.isModerator()) {
      throw new Error('Only moderators can mute all');
    }

    for (const [pubkey, role] of this.participantRoles) {
      if (pubkey === this.localPubkey) continue;
      if (exceptHosts && ['host', 'co_host'].includes(role)) continue;

      await this.requestMute(pubkey);
    }

    this.emit('mute-all-requested', exceptHosts);
    logger.info('Muted all participants', { exceptHosts });
  }

  /**
   * Lock audio (prevent all participants from unmuting)
   */
  lockAudio(): void {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can lock audio');
    }

    this.isAudioLocked = true;
    this.emit('audio-locked');
    logger.info('Audio locked');
  }

  /**
   * Unlock audio
   */
  unlockAudio(): void {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can unlock audio');
    }

    this.isAudioLocked = false;
    this.mutedParticipants.clear();
    this.emit('audio-unlocked');
    logger.info('Audio unlocked');
  }

  /**
   * Check if participant can unmute
   */
  canUnmute(pubkey: string): boolean {
    if (this.isAudioLocked && !['host', 'co_host'].includes(this.getParticipantRole(pubkey))) {
      return false;
    }
    return !this.mutedParticipants.has(pubkey);
  }

  /**
   * Remove participant from meeting
   */
  async removeParticipant(pubkey: string): Promise<void> {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can remove participants');
    }

    // Can't remove host
    if (this.getParticipantRole(pubkey) === 'host') {
      throw new Error('Cannot remove the host');
    }

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'remove', { roomId: this.roomId });
    }

    this.participantRoles.delete(pubkey);
    this.emit('participant-removed', pubkey);
    logger.info('Participant removed', { pubkey });
  }

  /**
   * Promote participant to co-host
   */
  async promoteToCoHost(pubkey: string): Promise<void> {
    if (this.localRole !== 'host') {
      throw new Error('Only host can promote to co-host');
    }

    this.participantRoles.set(pubkey, 'co_host');

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'role-change', {
        roomId: this.roomId,
        role: 'co_host',
      });
    }

    this.emit('role-changed', pubkey, 'co_host');
    logger.info('Promoted to co-host', { pubkey });
  }

  /**
   * Promote participant to moderator
   */
  async promoteToModerator(pubkey: string): Promise<void> {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can promote to moderator');
    }

    this.participantRoles.set(pubkey, 'moderator');

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'role-change', {
        roomId: this.roomId,
        role: 'moderator',
      });
    }

    this.emit('role-changed', pubkey, 'moderator');
    logger.info('Promoted to moderator', { pubkey });
  }

  /**
   * Demote to participant
   */
  async demoteToParticipant(pubkey: string): Promise<void> {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can demote');
    }

    // Can't demote host
    if (this.getParticipantRole(pubkey) === 'host') {
      throw new Error('Cannot demote the host');
    }

    this.participantRoles.set(pubkey, 'participant');

    if (this.onSendControl) {
      await this.onSendControl(pubkey, 'role-change', {
        roomId: this.roomId,
        role: 'participant',
      });
    }

    this.emit('role-changed', pubkey, 'participant');
    logger.info('Demoted to participant', { pubkey });
  }

  /**
   * Lock the room (prevent new joins)
   */
  lockRoom(): void {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can lock room');
    }

    this.isRoomLocked = true;
    this.emit('room-locked');
    logger.info('Room locked');
  }

  /**
   * Unlock the room
   */
  unlockRoom(): void {
    if (!this.isHostOrCoHost()) {
      throw new Error('Only host/co-host can unlock room');
    }

    this.isRoomLocked = false;
    this.emit('room-unlocked');
    logger.info('Room unlocked');
  }

  /**
   * Check if room is locked
   */
  isLocked(): boolean {
    return this.isRoomLocked;
  }

  /**
   * Check if audio is locked
   */
  isAudioLockedState(): boolean {
    return this.isAudioLocked;
  }

  /**
   * End meeting for all
   */
  async endMeetingForAll(): Promise<void> {
    if (this.localRole !== 'host') {
      throw new Error('Only host can end meeting for all');
    }

    for (const pubkey of this.participantRoles.keys()) {
      if (pubkey !== this.localPubkey && this.onSendControl) {
        await this.onSendControl(pubkey, 'meeting-ended', { roomId: this.roomId });
      }
    }

    this.emit('meeting-ended');
    logger.info('Meeting ended for all');
  }

  /**
   * Get permissions for a participant
   */
  getPermissions(pubkey: string): ParticipantPermissions {
    const role = this.getParticipantRole(pubkey);

    const basePermissions: ParticipantPermissions = {
      canUnmute: this.canUnmute(pubkey),
      canVideo: true,
      canScreenShare: true,
      canChat: true,
      canRaiseHand: true,
    };

    // Viewers have restricted permissions
    if (role === 'viewer') {
      return {
        canUnmute: false,
        canVideo: false,
        canScreenShare: false,
        canChat: true,
        canRaiseHand: true,
      };
    }

    return basePermissions;
  }

  /**
   * Close the manager
   */
  close(): void {
    this.participantRoles.clear();
    this.mutedParticipants.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createHostControlsManager(
  roomId: string,
  localPubkey: string,
  isHost: boolean
): HostControlsManager {
  return new HostControlsManager(roomId, localPubkey, isHost);
}
