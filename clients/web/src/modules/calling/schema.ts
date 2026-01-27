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
];
