/**
 * Push-to-Talk Channel Manager
 * Manages walkie-talkie style group voice communication
 */

import { EventEmitter } from 'eventemitter3';
import type { PTTChannel } from '../types';
import { PTT_KINDS } from '../types';

export type PTTPriority = 'normal' | 'high' | 'moderator';

export interface PTTSpeakRequest {
  pubkey: string;
  displayName?: string;
  priority: PTTPriority;
  requestedAt: number;
}

export interface PTTChannelState extends Omit<PTTChannel, 'currentSpeaker' | 'speakingQueue' | 'participants'> {
  members: Map<string, { pubkey: string; name?: string; online: boolean }>;
  queue: PTTSpeakRequest[];
  activeSpeaker?: { pubkey: string; name?: string; startedAt: number };
  speakExpiresAt?: number;
  participants: string[];
  speakingQueue: string[];
}

export interface PTTOptions {
  maxParticipants?: number;
  speakTimeout?: number; // ms, default 30000
  enableVAD?: boolean;
  vadThreshold?: number;
  priorityEnabled?: boolean;
}

const DEFAULT_SPEAK_TIMEOUT = 30000; // 30 seconds
const PRIORITY_WEIGHTS: Record<PTTPriority, number> = {
  moderator: 100,
  high: 10,
  normal: 1,
};

export class PTTChannelManager extends EventEmitter {
  private channels: Map<string, PTTChannelState> = new Map();
  private myPubkey: string = '';
  private myName?: string;
  private activeChannelId?: string;
  private speakTimeoutId?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
  }

  /**
   * Initialize the manager with user context
   */
  initialize(pubkey: string, displayName?: string): void {
    this.myPubkey = pubkey;
    this.myName = displayName;
  }

  /**
   * Create a new PTT channel
   */
  async createChannel(
    groupId: string,
    name: string,
    options: PTTOptions = {}
  ): Promise<PTTChannelState> {
    const channelId = crypto.randomUUID();
    const now = Date.now();

    const channel: PTTChannelState = {
      id: channelId,
      name,
      groupId,
      isActive: true,
      participants: [this.myPubkey],
      maxParticipants: options.maxParticipants || 50,
      activeSpeaker: undefined,
      speakingQueue: [],
      isE2EE: true,
      members: new Map([[this.myPubkey, { pubkey: this.myPubkey, name: this.myName, online: true }]]),
      queue: [],
    };

    this.channels.set(channelId, channel);
    this.activeChannelId = channelId;

    // Broadcast channel creation
    this.emit('channel-created', channel);
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_CHANNEL_CREATE,
      payload: {
        channelId,
        groupId,
        name,
        maxParticipants: channel.maxParticipants,
        createdBy: this.myPubkey,
        timestamp: now,
      },
    });

    return channel;
  }

  /**
   * Join an existing PTT channel
   */
  async joinChannel(channelId: string): Promise<void> {
    let channel = this.channels.get(channelId);

    if (!channel) {
      // Create a local representation if we don't have it
      channel = {
        id: channelId,
        name: 'Unknown Channel',
        groupId: '',
        isActive: true,
        participants: [],
        maxParticipants: 50,
        activeSpeaker: undefined,
        speakingQueue: [],
        isE2EE: true,
        members: new Map(),
        queue: [],
      };
      this.channels.set(channelId, channel);
    }

    // Add ourselves
    channel.members.set(this.myPubkey, {
      pubkey: this.myPubkey,
      name: this.myName,
      online: true,
    });
    channel.participants = Array.from(channel.members.keys());

    this.activeChannelId = channelId;

    // Broadcast join
    this.emit('channel-joined', channel);
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_CHANNEL_JOIN,
      payload: {
        channelId,
        pubkey: this.myPubkey,
        displayName: this.myName,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Leave a PTT channel
   */
  async leaveChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Release speak if we're speaking
    if (channel.activeSpeaker?.pubkey === this.myPubkey) {
      this.releaseSpeak();
    }

    // Remove from queue
    channel.queue = channel.queue.filter((r) => r.pubkey !== this.myPubkey);
    channel.speakingQueue = channel.queue.map((r) => r.pubkey);

    // Remove ourselves
    channel.members.delete(this.myPubkey);
    channel.participants = Array.from(channel.members.keys());

    if (this.activeChannelId === channelId) {
      this.activeChannelId = undefined;
    }

    // Broadcast leave
    this.emit('channel-left', channel);
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_CHANNEL_LEAVE,
      payload: {
        channelId,
        pubkey: this.myPubkey,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Request to speak
   * Returns queue position or null if immediately granted
   */
  async requestSpeak(priority: PTTPriority = 'normal'): Promise<number | null> {
    if (!this.activeChannelId) {
      throw new Error('Not in a channel');
    }

    const channel = this.channels.get(this.activeChannelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if already speaking
    if (channel.activeSpeaker?.pubkey === this.myPubkey) {
      return null;
    }

    // Check if already in queue
    const existingIndex = channel.queue.findIndex((r) => r.pubkey === this.myPubkey);
    if (existingIndex >= 0) {
      return existingIndex + 1;
    }

    const request: PTTSpeakRequest = {
      pubkey: this.myPubkey,
      displayName: this.myName,
      priority,
      requestedAt: Date.now(),
    };

    // If no one is speaking, grant immediately
    if (!channel.activeSpeaker) {
      this.grantSpeak(channel, request);
      return null;
    }

    // Add to queue with priority ordering
    channel.queue.push(request);
    this.sortQueue(channel);
    channel.speakingQueue = channel.queue.map((r) => r.pubkey);

    const position = channel.queue.findIndex((r) => r.pubkey === this.myPubkey) + 1;

    // Broadcast speak request
    this.emit('queue-updated', { channel, queue: channel.queue });
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_SPEAK_REQUEST,
      payload: {
        channelId: channel.id,
        pubkey: this.myPubkey,
        priority,
        timestamp: Date.now(),
      },
    });

    return position;
  }

  /**
   * Release speaking turn
   */
  releaseSpeak(): void {
    if (!this.activeChannelId) return;

    const channel = this.channels.get(this.activeChannelId);
    if (!channel) return;

    // Only release if we're the current speaker
    if (channel.activeSpeaker?.pubkey !== this.myPubkey) {
      return;
    }

    // Clear timeout
    if (this.speakTimeoutId) {
      clearTimeout(this.speakTimeoutId);
      this.speakTimeoutId = undefined;
    }

    channel.activeSpeaker = undefined;
    channel.speakExpiresAt = undefined;

    // Broadcast release
    this.emit('speaker-changed', { channel, speaker: null });
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_SPEAK_RELEASE,
      payload: {
        channelId: channel.id,
        pubkey: this.myPubkey,
        timestamp: Date.now(),
      },
    });

    // Grant to next in queue
    this.processQueue(channel);
  }

  /**
   * Grant speaking turn to a request
   */
  private grantSpeak(channel: PTTChannelState, request: PTTSpeakRequest): void {
    const now = Date.now();
    const timeout = DEFAULT_SPEAK_TIMEOUT;

    channel.activeSpeaker = {
      pubkey: request.pubkey,
      name: request.displayName,
      startedAt: now,
    };
    channel.speakExpiresAt = now + timeout;

    // Remove from queue
    channel.queue = channel.queue.filter((r) => r.pubkey !== request.pubkey);
    channel.speakingQueue = channel.queue.map((r) => r.pubkey);

    // Set timeout for auto-release
    if (request.pubkey === this.myPubkey) {
      this.speakTimeoutId = setTimeout(() => {
        this.releaseSpeak();
      }, timeout);
    }

    // Broadcast grant
    this.emit('speaker-changed', { channel, speaker: channel.activeSpeaker });
    this.emit('signaling-send', {
      kind: PTT_KINDS.PTT_SPEAK_GRANT,
      payload: {
        channelId: channel.id,
        pubkey: request.pubkey,
        expiresAt: channel.speakExpiresAt,
        timestamp: now,
      },
    });
  }

  /**
   * Process queue and grant to next speaker
   */
  private processQueue(channel: PTTChannelState): void {
    if (channel.queue.length === 0) return;

    const next = channel.queue[0];
    this.grantSpeak(channel, next);
  }

  /**
   * Sort queue by priority (moderator > high > normal) then by request time
   */
  private sortQueue(channel: PTTChannelState): void {
    channel.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.requestedAt - b.requestedAt;
    });
  }

  /**
   * Handle incoming signaling message
   */
  handleSignalingMessage(kind: number, payload: Record<string, unknown>): void {
    const channelId = payload.channelId as string;
    let channel = this.channels.get(channelId);

    switch (kind) {
      case PTT_KINDS.PTT_CHANNEL_CREATE:
        // Create local representation
        if (!channel) {
          channel = {
            id: channelId,
            name: payload.name as string,
            groupId: payload.groupId as string,
            isActive: true,
            participants: [],
            maxParticipants: (payload.maxParticipants as number) || 50,
            activeSpeaker: undefined,
            speakingQueue: [],
            isE2EE: true,
            members: new Map(),
            queue: [],
          };
          this.channels.set(channelId, channel);
          this.emit('channel-discovered', channel);
        }
        break;

      case PTT_KINDS.PTT_CHANNEL_JOIN:
        if (channel) {
          const pubkey = payload.pubkey as string;
          channel.members.set(pubkey, {
            pubkey,
            name: payload.displayName as string | undefined,
            online: true,
          });
          channel.participants = Array.from(channel.members.keys());
          this.emit('member-joined', { channel, pubkey });
        }
        break;

      case PTT_KINDS.PTT_CHANNEL_LEAVE:
        if (channel) {
          const pubkey = payload.pubkey as string;
          channel.members.delete(pubkey);
          channel.participants = Array.from(channel.members.keys());
          channel.queue = channel.queue.filter((r) => r.pubkey !== pubkey);
          channel.speakingQueue = channel.queue.map((r) => r.pubkey);
          if (channel.activeSpeaker?.pubkey === pubkey) {
            channel.activeSpeaker = undefined;
            this.processQueue(channel);
          }
          this.emit('member-left', { channel, pubkey });
        }
        break;

      case PTT_KINDS.PTT_SPEAK_REQUEST:
        if (channel) {
          const request: PTTSpeakRequest = {
            pubkey: payload.pubkey as string,
            displayName: channel.members.get(payload.pubkey as string)?.name,
            priority: (payload.priority as PTTPriority) || 'normal',
            requestedAt: payload.timestamp as number,
          };
          if (!channel.activeSpeaker) {
            this.grantSpeak(channel, request);
          } else {
            channel.queue.push(request);
            this.sortQueue(channel);
            channel.speakingQueue = channel.queue.map((r) => r.pubkey);
            this.emit('queue-updated', { channel, queue: channel.queue });
          }
        }
        break;

      case PTT_KINDS.PTT_SPEAK_GRANT:
        if (channel) {
          const pubkey = payload.pubkey as string;
          channel.activeSpeaker = {
            pubkey,
            name: channel.members.get(pubkey)?.name,
            startedAt: payload.timestamp as number,
          };
          channel.speakExpiresAt = payload.expiresAt as number;
          channel.queue = channel.queue.filter((r) => r.pubkey !== pubkey);
          channel.speakingQueue = channel.queue.map((r) => r.pubkey);
          this.emit('speaker-changed', { channel, speaker: channel.activeSpeaker });
        }
        break;

      case PTT_KINDS.PTT_SPEAK_RELEASE:
        if (channel) {
          const pubkey = payload.pubkey as string;
          if (channel.activeSpeaker?.pubkey === pubkey) {
            channel.activeSpeaker = undefined;
            channel.speakExpiresAt = undefined;
            this.emit('speaker-changed', { channel, speaker: null });
            this.processQueue(channel);
          }
        }
        break;
    }
  }

  /**
   * Get current queue position
   */
  getQueuePosition(): number | null {
    if (!this.activeChannelId) return null;
    const channel = this.channels.get(this.activeChannelId);
    if (!channel) return null;

    const index = channel.queue.findIndex((r) => r.pubkey === this.myPubkey);
    return index >= 0 ? index + 1 : null;
  }

  /**
   * Get current speaker
   */
  getSpeakingUser(): { pubkey: string; name?: string } | null {
    if (!this.activeChannelId) return null;
    const channel = this.channels.get(this.activeChannelId);
    if (!channel?.activeSpeaker) return null;
    return channel.activeSpeaker;
  }

  /**
   * Check if we are currently speaking
   */
  isSpeaking(): boolean {
    if (!this.activeChannelId) return false;
    const channel = this.channels.get(this.activeChannelId);
    return channel?.activeSpeaker?.pubkey === this.myPubkey;
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: string): PTTChannelState | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get active channel
   */
  getActiveChannel(): PTTChannelState | undefined {
    return this.activeChannelId ? this.channels.get(this.activeChannelId) : undefined;
  }

  /**
   * Get all channels
   */
  getAllChannels(): PTTChannelState[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channels for a group
   */
  getChannelsForGroup(groupId: string): PTTChannelState[] {
    return this.getAllChannels().filter((c) => c.groupId === groupId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.speakTimeoutId) {
      clearTimeout(this.speakTimeoutId);
    }
    if (this.activeChannelId) {
      this.leaveChannel(this.activeChannelId);
    }
    this.channels.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const pttChannelManager = new PTTChannelManager();
