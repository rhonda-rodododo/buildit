/**
 * Calling Module Types
 * Type definitions and Zod validators for E2EE voice/video calling
 */

import { z } from 'zod';

// Re-export generated types from protocol schema
export type {
  CallOffer,
  CallAnswer,
  CallIceCandidate,
  CallHangup,
  CallState,
  CallCapabilities,
  CallQuality,
  CallHistory,
  CallSettings,
  GroupCallCreate,
  GroupCallJoin,
  GroupCallLeave,
  GroupCallParticipant,
  SenderKeyDistribution,
  HotlineCallState,
  HotlineOperatorStatus,
  HotlineQueueState,
  MessagingHotlineThread,
  Broadcast,
  ConferenceRoom,
  BreakoutConfig,
  Candidate,
} from '@/generated/schemas/calling';

export {
  CallType,
  Reason as HangupReason,
  Direction as CallDirection,
  CallStateState,
  GroupCallParticipantState,
  Topology,
  CallHistoryCallType,
  HotlineCallStateCallType,
  HotlineCallStatePriority,
  HotlineCallStateState,
  HotlineOperatorStatusStatus,
  MessagingHotlineThreadStatus,
  BroadcastPriority,
  BroadcastStatus,
  TargetType as BroadcastTargetType,
  Type as ContactType,
  LastMessageBy,
} from '@/generated/schemas/calling';

import {
  CallType,
  Reason,
  Direction,
  CallStateState,
  GroupCallParticipantState,
  Topology,
  HotlineCallStatePriority,
  HotlineOperatorStatusStatus,
  MessagingHotlineThreadStatus,
  BroadcastPriority,
  BroadcastStatus,
  TargetType,
  LastMessageBy,
} from '@/generated/schemas/calling';

/**
 * Nostr event kinds for calling (from protocol registry)
 */
export const CALLING_KINDS = {
  CALL_OFFER: 24300,
  CALL_ANSWER: 24301,
  CALL_ICE: 24302,
  CALL_HANGUP: 24303,
  CALL_STATE: 24304,
  GROUP_CALL_CREATE: 24310,
  GROUP_CALL_JOIN: 24311,
  GROUP_CALL_LEAVE: 24312,
  SENDER_KEY: 24320,
  HOTLINE_CALL_STATE: 24330,
  HOTLINE_OPERATOR_STATUS: 24331,
  HOTLINE_QUEUE_STATE: 24332,
  MESSAGING_THREAD: 24340,
  BROADCAST: 24350,
  CONFERENCE_ROOM: 24360,
  BREAKOUT_CONFIG: 24361,
} as const;

/**
 * Zod Schemas for validation
 */

export const CallCapabilitiesSchema = z.object({
  video: z.boolean().optional(),
  screenShare: z.boolean().optional(),
  e2ee: z.boolean().optional(),
  insertableStreams: z.boolean().optional(),
});

export const CandidateSchema = z.object({
  candidate: z.string().optional(),
  sdpMid: z.string().optional(),
  sdpMLineIndex: z.number().optional(),
  usernameFragment: z.string().optional(),
});

export const CallOfferSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  callType: z.nativeEnum(CallType),
  sdp: z.string(),
  timestamp: z.number(),
  groupId: z.string().optional(),
  roomId: z.string().optional(),
  hotlineId: z.string().optional(),
  isReconnect: z.boolean().optional(),
  isRenegotiation: z.boolean().optional(),
  capabilities: CallCapabilitiesSchema.optional(),
});

export const CallAnswerSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  sdp: z.string(),
  timestamp: z.number(),
});

export const CallIceCandidateSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  candidate: CandidateSchema,
});

export const CallHangupSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  reason: z.nativeEnum(Reason),
  timestamp: z.number().optional(),
});

export const CallQualitySchema = z.object({
  roundTripTime: z.number().optional(),
  jitter: z.number().optional(),
  packetLoss: z.number().optional(),
  bandwidth: z.number().optional(),
  audioLevel: z.number().optional(),
});

export const CallStateSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  remotePubkey: z.string(),
  remoteName: z.string().optional(),
  direction: z.nativeEnum(Direction),
  callType: z.nativeEnum(CallType).optional(),
  state: z.nativeEnum(CallStateState),
  startedAt: z.number(),
  connectedAt: z.number().optional(),
  endedAt: z.number().optional(),
  endReason: z.nativeEnum(Reason).optional(),
  isMuted: z.boolean().optional(),
  isVideoEnabled: z.boolean().optional(),
  isScreenSharing: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  quality: CallQualitySchema.optional(),
});

export const GroupCallParticipantSchema = z.object({
  pubkey: z.string(),
  displayName: z.string().optional(),
  joinedAt: z.number(),
  state: z.nativeEnum(GroupCallParticipantState),
  audioEnabled: z.boolean().optional(),
  videoEnabled: z.boolean().optional(),
  screenSharing: z.boolean().optional(),
  isSpeaking: z.boolean().optional(),
  isHost: z.boolean().optional(),
});

export const GroupCallCreateSchema = z.object({
  _v: z.string(),
  roomId: z.string(),
  groupId: z.string().optional(),
  callType: z.nativeEnum(CallType),
  createdBy: z.string(),
  timestamp: z.number(),
  maxParticipants: z.number().optional(),
  invitedPubkeys: z.array(z.string()).optional(),
  topology: z.nativeEnum(Topology).optional(),
});

export const GroupCallJoinSchema = z.object({
  _v: z.string(),
  roomId: z.string(),
  pubkey: z.string(),
  displayName: z.string().optional(),
  timestamp: z.number(),
});

export const GroupCallLeaveSchema = z.object({
  _v: z.string(),
  roomId: z.string(),
  pubkey: z.string(),
  timestamp: z.number(),
});

export const SenderKeyDistributionSchema = z.object({
  _v: z.string(),
  roomId: z.string(),
  senderPubkey: z.string(),
  keyId: z.number(),
  encryptedKeys: z.record(z.string(), z.string()),
  timestamp: z.number().optional(),
});

export const CallHistorySchema = z.object({
  _v: z.string(),
  callId: z.string(),
  remotePubkey: z.string(),
  remoteName: z.string().optional(),
  direction: z.nativeEnum(Direction),
  callType: z.enum(['voice', 'video', 'group']).optional(),
  startedAt: z.number(),
  connectedAt: z.number().optional(),
  endedAt: z.number().optional(),
  duration: z.number().optional(),
  endReason: z.nativeEnum(Reason).optional(),
  wasEncrypted: z.boolean().optional(),
  groupId: z.string().optional(),
  roomId: z.string().optional(),
  participantCount: z.number().optional(),
});

export const CallSettingsSchema = z.object({
  _v: z.string().optional(),
  defaultCallType: z.nativeEnum(CallType).optional(),
  autoAnswer: z.boolean().optional(),
  doNotDisturb: z.boolean().optional(),
  allowUnknownCallers: z.boolean().optional(),
  preferredAudioInput: z.string().optional(),
  preferredAudioOutput: z.string().optional(),
  preferredVideoInput: z.string().optional(),
  echoCancellation: z.boolean().optional(),
  noiseSuppression: z.boolean().optional(),
  autoGainControl: z.boolean().optional(),
  relayOnlyMode: z.boolean().optional(),
});

// Hotline types
export const HotlineCallerSchema = z.object({
  pubkey: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
});

export const HotlineOperatorSchema = z.object({
  pubkey: z.string().optional(),
  name: z.string().optional(),
});

export const HotlineCallStateSchema = z.object({
  _v: z.string(),
  callId: z.string(),
  hotlineId: z.string(),
  groupId: z.string().optional(),
  callType: z.enum(['internal', 'pstn']),
  state: z.enum(['queued', 'ringing', 'active', 'on_hold', 'transferred', 'completed', 'abandoned', 'escalated']),
  caller: HotlineCallerSchema.optional(),
  operator: HotlineOperatorSchema.optional(),
  queuedAt: z.number().optional(),
  answeredAt: z.number().optional(),
  endedAt: z.number().optional(),
  queuePosition: z.number().optional(),
  waitDuration: z.number().optional(),
  priority: z.nativeEnum(HotlineCallStatePriority).optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  isEncrypted: z.boolean().optional(),
});

export const HotlineOperatorStatusSchema = z.object({
  _v: z.string(),
  hotlineId: z.string(),
  pubkey: z.string(),
  status: z.nativeEnum(HotlineOperatorStatusStatus),
  currentCallId: z.string().optional(),
  callCount: z.number().optional(),
  shiftStart: z.number().optional(),
  shiftEnd: z.number().optional(),
  timestamp: z.number().optional(),
});

export const HotlineQueueCallSchema = z.object({
  callId: z.string().optional(),
  queuedAt: z.number().optional(),
  callerName: z.string().optional(),
  priority: z.string().optional(),
  position: z.number().optional(),
});

export const HotlineQueueStateSchema = z.object({
  _v: z.string(),
  hotlineId: z.string(),
  calls: z.array(HotlineQueueCallSchema),
  operatorsAvailable: z.number().optional(),
  estimatedWaitTime: z.number().optional(),
  timestamp: z.number().optional(),
});

// Messaging hotline types
export const MessagingContactSchema = z.object({
  pubkey: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  type: z.enum(['buildit', 'sms', 'rcs']).optional(),
});

export const MessagingHotlineThreadSchema = z.object({
  _v: z.string(),
  threadId: z.string(),
  hotlineId: z.string(),
  groupId: z.string().optional(),
  contact: MessagingContactSchema.optional(),
  status: z.nativeEnum(MessagingHotlineThreadStatus),
  assignedOperator: z.string().optional(),
  priority: z.nativeEnum(HotlineCallStatePriority).optional(),
  category: z.string().optional(),
  createdAt: z.number(),
  lastMessageAt: z.number().optional(),
  lastMessageBy: z.nativeEnum(LastMessageBy).optional(),
  messageCount: z.number().optional(),
  unreadByOperator: z.number().optional(),
  resolvedAt: z.number().optional(),
  linkedCallId: z.string().optional(),
});

// Broadcast types
export const BroadcastAnalyticsSchema = z.object({
  totalRecipients: z.number().optional(),
  delivered: z.number().optional(),
  read: z.number().optional(),
  replied: z.number().optional(),
});

export const BroadcastSchema = z.object({
  _v: z.string(),
  broadcastId: z.string(),
  content: z.string(),
  title: z.string().optional(),
  targetType: z.nativeEnum(TargetType),
  targetIds: z.array(z.string()).optional(),
  createdBy: z.string(),
  scheduledAt: z.number().optional(),
  sentAt: z.number().optional(),
  status: z.nativeEnum(BroadcastStatus).optional(),
  priority: z.nativeEnum(BroadcastPriority).optional(),
  analytics: BroadcastAnalyticsSchema.optional(),
});

// Conference types
export const ConferenceSettingsSchema = z.object({
  locked: z.boolean().optional(),
  waitingRoom: z.boolean().optional(),
  allowScreenShare: z.boolean().optional(),
  allowRecording: z.boolean().optional(),
  e2eeRequired: z.boolean().optional(),
});

export const ConferenceRoomSchema = z.object({
  _v: z.string(),
  roomId: z.string(),
  name: z.string(),
  groupId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.number().optional(),
  expiresAt: z.number().optional(),
  maxParticipants: z.number().optional(),
  settings: ConferenceSettingsSchema.optional(),
  sfuEndpoint: z.string().optional(),
});

export const BreakoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().optional(),
  participants: z.array(z.string()).optional(),
});

export const BreakoutConfigSchema = z.object({
  _v: z.string(),
  mainRoomId: z.string(),
  breakouts: z.array(BreakoutSchema),
  duration: z.number().optional(),
  autoAssign: z.boolean().optional(),
  allowSelfSelect: z.boolean().optional(),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
});

/**
 * Local UI types (not from protocol)
 */

export interface LocalCallState {
  callId: string;
  remotePubkey: string;
  remoteName?: string;
  direction: Direction;
  callType: CallType;
  state: CallStateState;
  startedAt: number;
  connectedAt?: number;

  // Local media state
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isEncrypted: boolean;

  // Connection quality
  quality?: {
    roundTripTime?: number;
    jitter?: number;
    packetLoss?: number;
    bandwidth?: number;
    audioLevel?: number;
  };

  // WebRTC objects (not serializable)
  peerConnection?: RTCPeerConnection;
}

export interface GroupCallState {
  roomId: string;
  groupId?: string;
  callType: CallType;
  topology: Topology;
  isHost: boolean;

  // Local participant
  localPubkey: string;
  localStream?: MediaStream;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;

  // Remote participants
  participants: Map<string, {
    pubkey: string;
    displayName?: string;
    stream?: MediaStream;
    audioEnabled: boolean;
    videoEnabled: boolean;
    isSpeaking: boolean;
    peerConnection?: RTCPeerConnection;
  }>;

  // E2EE state
  senderKeyId?: number;
  receivedKeys: Map<string, number>; // pubkey -> keyId
}

export interface MediaDevices {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallingConfig {
  iceServers: ICEServer[];
  relayOnly: boolean;
  bundlePolicy: RTCBundlePolicy;
  iceTransportPolicy: RTCIceTransportPolicy;
}

/**
 * Create form data types
 */
export interface CreateBroadcastData {
  content: string;
  title?: string;
  targetType: TargetType;
  targetIds?: string[];
  scheduledAt?: Date;
  priority?: BroadcastPriority;
}

export interface HotlineConfig {
  id: string;
  name: string;
  groupId: string;
  categories: string[];
  operators: string[]; // pubkeys
  voiceEnabled: boolean;
  messagingEnabled: boolean;
  smsEnabled: boolean;
  pstnNumber?: string;
}

// Additional messaging hotline types for UI
export type MessagingHotlineThreadPriority = HotlineCallStatePriority;
export type MessagingHotlineThreadContactType = 'buildit' | 'sms' | 'rcs';

export interface MessagingHotlineThreadExtended {
  _v: string;
  threadId: string;
  hotlineId: string;
  callerPubkey?: string;
  callerName?: string;
  callerPhone?: string;
  contactType: MessagingHotlineThreadContactType;
  status: MessagingHotlineThreadStatus;
  priority: MessagingHotlineThreadPriority;
  category?: string;
  notes?: string;
  assignedTo?: string;
  assignedAt?: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  archivedAt?: number;
  metadata?: Record<string, unknown>;
}

// Push-to-Talk types (for future epic)
export interface PTTChannel {
  id: string;
  name: string;
  groupId: string;
  isActive: boolean;
  participants: string[];
  maxParticipants: number;
  currentSpeaker?: string;
  speakingQueue: string[];
  isE2EE: boolean;
}

export interface PTTState {
  channelId: string;
  isPTTActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  speakerPubkey?: string;
  speakerName?: string;
  queuePosition?: number;
  localStream?: MediaStream;
}

export const PTT_KINDS = {
  PTT_CHANNEL_CREATE: 24370,
  PTT_CHANNEL_JOIN: 24371,
  PTT_CHANNEL_LEAVE: 24372,
  PTT_SPEAK_REQUEST: 24373,
  PTT_SPEAK_GRANT: 24374,
  PTT_SPEAK_RELEASE: 24375,
} as const;
