/**
 * Calling Module Database Schema
 * Contains all database table definitions for voice/video calling
 */

import type { TableSchema } from '@/types/modules';

/**
 * Call history table interface
 */
export interface DBCallHistory {
  id?: number; // auto-increment
  callId: string;
  remotePubkey: string;
  remoteName?: string;
  direction: 'incoming' | 'outgoing';
  callType: 'voice' | 'video' | 'group';
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  duration?: number; // seconds
  endReason?: string;
  wasEncrypted: boolean;
  groupId?: string;
  roomId?: string;
  participantCount?: number;
}

/**
 * Call settings table interface (per-user settings)
 */
export interface DBCallSettings {
  pubkey: string; // primary key - user's pubkey
  defaultCallType: 'voice' | 'video';
  autoAnswer: boolean;
  doNotDisturb: boolean;
  allowUnknownCallers: boolean;
  preferredAudioInput?: string;
  preferredAudioOutput?: string;
  preferredVideoInput?: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  relayOnlyMode: boolean;
  updatedAt: number;
}

/**
 * Hotline configuration table
 */
export interface DBHotlineConfig {
  id: string; // hotline ID
  name: string;
  groupId: string;
  categories: string; // JSON array
  operators: string; // JSON array of pubkeys
  voiceEnabled: boolean;
  messagingEnabled: boolean;
  smsEnabled: boolean;
  pstnNumber?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Hotline call history table
 */
export interface DBHotlineCallHistory {
  id?: number;
  callId: string;
  hotlineId: string;
  callType: 'internal' | 'pstn';
  callerPubkey?: string;
  callerPhone?: string;
  callerName?: string;
  operatorPubkey?: string;
  operatorName?: string;
  state: string;
  queuedAt?: number;
  answeredAt?: number;
  endedAt?: number;
  waitDuration?: number;
  callDuration?: number;
  priority?: string;
  category?: string;
  notes?: string;
  wasEncrypted: boolean;
}

/**
 * Messaging hotline thread table
 */
export interface DBMessagingThread {
  threadId: string; // primary key
  hotlineId: string;
  groupId?: string;
  contactPubkey?: string;
  contactPhone?: string;
  contactName?: string;
  contactType: 'buildit' | 'sms' | 'rcs';
  status: 'unassigned' | 'assigned' | 'waiting' | 'active' | 'resolved' | 'archived';
  assignedOperator?: string;
  priority?: string;
  category?: string;
  createdAt: number;
  lastMessageAt?: number;
  lastMessageBy?: 'contact' | 'operator';
  messageCount: number;
  unreadByOperator: number;
  resolvedAt?: number;
  linkedCallId?: string;
}

/**
 * Broadcast table
 */
export interface DBBroadcast {
  broadcastId: string; // primary key
  content: string;
  title?: string;
  targetType: 'group' | 'contact_list' | 'public_channel' | 'emergency';
  targetIds?: string; // JSON array
  createdBy: string;
  scheduledAt?: number;
  sentAt?: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  priority: 'normal' | 'high' | 'emergency';
  totalRecipients?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Conference room table
 */
export interface DBConferenceRoom {
  roomId: string; // primary key
  name: string;
  groupId?: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  maxParticipants?: number;
  locked: boolean;
  waitingRoom: boolean;
  allowScreenShare: boolean;
  allowRecording: boolean;
  e2eeRequired: boolean;
  sfuEndpoint?: string;
}

/**
 * Operator status table (for hotlines)
 */
export interface DBOperatorStatus {
  id: string; // composite: hotlineId + pubkey
  hotlineId: string;
  pubkey: string;
  status: 'available' | 'on_call' | 'wrap_up' | 'break' | 'offline';
  currentCallId?: string;
  callCount: number;
  shiftStart?: number;
  shiftEnd?: number;
  lastUpdated: number;
}

/**
 * Conference poll table
 */
export interface DBConferencePoll {
  pollId: string; // primary key
  roomId: string;
  question: string;
  options: string; // JSON array
  status: 'draft' | 'active' | 'closed';
  anonymous: boolean;
  multiSelect: boolean;
  showLiveResults: boolean;
  results?: string; // JSON array of {option, count}
  createdBy: string;
  createdAt: number;
  closedAt?: number;
}

/**
 * Conference poll vote table
 */
export interface DBConferencePollVote {
  id?: number; // auto-increment
  pollId: string;
  voterToken: string; // HMAC for anonymous deduplication
  selectedOptions: string; // JSON array of indices
  timestamp: number;
}

/**
 * PSTN call history table
 */
export interface DBPSTNCallHistory {
  id?: number; // auto-increment
  callSid: string;
  hotlineId: string;
  direction: 'inbound' | 'outbound';
  callerPhone?: string; // Masked
  targetPhone?: string;
  operatorPubkey?: string;
  status: 'queued' | 'ringing' | 'connected' | 'on_hold' | 'completed' | 'failed';
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  duration?: number;
  creditsCost?: number;
}

/**
 * PSTN credits table
 */
export interface DBPSTNCredits {
  groupId: string; // primary key
  monthlyAllocation: number;
  used: number;
  remaining: number;
  resetDate: number;
  lastUpdated: number;
}

/**
 * Breakout room history table
 */
export interface DBBreakoutRoom {
  id: string; // primary key
  mainRoomId: string;
  name: string;
  participantPubkeys: string; // JSON array
  createdAt: number;
  closedAt?: number;
}

/**
 * PSTN provider configuration table
 * Stores per-group PSTN provider settings (BYOA - Bring Your Own Asterisk/Twilio/Plivo)
 */
export interface DBPSTNProviderConfig {
  groupId: string; // primary key
  providerType: 'builtin-credits' | 'twilio' | 'plivo' | 'telnyx' | 'asterisk' | 'custom-sip';
  encryptedCredentials?: Uint8Array; // NIP-44 encrypted credentials JSON
  sipServer?: string;
  sipPort?: number;
  sipTransport?: 'udp' | 'tcp' | 'tls';
  sipUsername?: string;
  callerId?: string;
  fallbackToBuiltin: boolean;
  lastTestAt?: number;
  testSuccess?: boolean;
  testError?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Caller reveal audit log table
 * Tracks when operators reveal masked caller phone numbers for accountability
 */
export interface DBCallerRevealAudit {
  id?: number; // auto-increment
  callSid: string;
  hotlineId: string;
  groupId: string;
  operatorPubkey: string;
  maskedPhone: string;
  revealedPhone: string;
  reason?: string;
  timestamp: number;
}

/**
 * Calling module schema definition
 */
export const callingSchema: TableSchema[] = [
  {
    name: 'callHistory',
    schema: '++id, callId, remotePubkey, direction, callType, startedAt, groupId',
    indexes: ['++id', 'callId', 'remotePubkey', 'direction', 'callType', 'startedAt', 'groupId'],
  },
  {
    name: 'callSettings',
    schema: 'pubkey, updatedAt',
    indexes: ['pubkey', 'updatedAt'],
  },
  {
    name: 'hotlineConfigs',
    schema: 'id, groupId, createdAt',
    indexes: ['id', 'groupId', 'createdAt'],
  },
  {
    name: 'hotlineCallHistory',
    schema: '++id, callId, hotlineId, operatorPubkey, state, queuedAt',
    indexes: ['++id', 'callId', 'hotlineId', 'operatorPubkey', 'state', 'queuedAt'],
  },
  {
    name: 'messagingThreads',
    schema: 'threadId, hotlineId, status, assignedOperator, lastMessageAt',
    indexes: ['threadId', 'hotlineId', 'status', 'assignedOperator', 'lastMessageAt'],
  },
  {
    name: 'broadcasts',
    schema: 'broadcastId, createdBy, status, scheduledAt, sentAt',
    indexes: ['broadcastId', 'createdBy', 'status', 'scheduledAt', 'sentAt'],
  },
  {
    name: 'conferenceRooms',
    schema: 'roomId, groupId, createdBy, createdAt, expiresAt',
    indexes: ['roomId', 'groupId', 'createdBy', 'createdAt', 'expiresAt'],
  },
  {
    name: 'operatorStatus',
    schema: 'id, hotlineId, pubkey, status',
    indexes: ['id', 'hotlineId', 'pubkey', 'status'],
  },
  {
    name: 'conferencePolls',
    schema: 'pollId, roomId, status, createdAt',
    indexes: ['pollId', 'roomId', 'status', 'createdAt'],
  },
  {
    name: 'conferencePollVotes',
    schema: '++id, pollId, voterToken, timestamp',
    indexes: ['++id', 'pollId', 'voterToken', 'timestamp'],
  },
  {
    name: 'pstnCallHistory',
    schema: '++id, callSid, hotlineId, direction, status, startedAt',
    indexes: ['++id', 'callSid', 'hotlineId', 'direction', 'status', 'startedAt'],
  },
  {
    name: 'pstnCredits',
    schema: 'groupId, resetDate',
    indexes: ['groupId', 'resetDate'],
  },
  {
    name: 'breakoutRooms',
    schema: 'id, mainRoomId, createdAt',
    indexes: ['id', 'mainRoomId', 'createdAt'],
  },
  {
    name: 'pstnProviderConfig',
    schema: 'groupId, providerType, updatedAt',
    indexes: ['groupId', 'providerType', 'updatedAt'],
  },
  {
    name: 'callerRevealAudit',
    schema: '++id, callSid, hotlineId, groupId, operatorPubkey, timestamp',
    indexes: ['++id', 'callSid', 'hotlineId', 'groupId', 'operatorPubkey', 'timestamp'],
  },
];
