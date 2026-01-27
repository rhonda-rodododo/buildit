/**
 * Calling Module Store
 * Zustand state management for voice/video calling
 */

import { create } from 'zustand';
import type {
  CallHistory,
  CallSettings,
  GroupCallParticipant,
  HotlineCallState,
  HotlineOperatorStatus,
  MessagingHotlineThread,
  Broadcast,
  LocalCallState,
  GroupCallState,
  MediaDevices,
  HotlineConfig,
} from './types';
import {
  CallType,
  CallStateState,
} from './types';

interface CallingState {
  // Current call state
  activeCall: LocalCallState | null;
  incomingCall: {
    callId: string;
    remotePubkey: string;
    remoteName?: string;
    callType: CallType;
    timestamp: number;
  } | null;

  // Group call state
  activeGroupCall: GroupCallState | null;

  // Call history
  callHistory: CallHistory[];

  // User settings
  settings: CallSettings | null;

  // Media devices
  devices: MediaDevices;
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;

  // Hotline state (for operators)
  hotlineConfigs: HotlineConfig[];
  activeHotlineCalls: HotlineCallState[];
  operatorStatus: HotlineOperatorStatus | null;
  hotlineQueue: HotlineCallState[];

  // Messaging hotline
  messagingThreads: MessagingHotlineThread[];
  activeThread: string | null;

  // Broadcasts
  broadcasts: Broadcast[];

  // UI state
  isCallMinimized: boolean;
  showIncomingCallDialog: boolean;

  // Actions - Call lifecycle
  setActiveCall: (call: LocalCallState | null) => void;
  updateActiveCall: (updates: Partial<LocalCallState>) => void;
  setIncomingCall: (call: CallingState['incomingCall']) => void;
  clearIncomingCall: () => void;

  // Actions - Group call
  setActiveGroupCall: (call: GroupCallState | null) => void;
  updateGroupCall: (updates: Partial<GroupCallState>) => void;
  addGroupParticipant: (participant: GroupCallParticipant) => void;
  removeGroupParticipant: (pubkey: string) => void;
  updateGroupParticipant: (pubkey: string, updates: Partial<GroupCallParticipant>) => void;

  // Actions - Call history
  setCallHistory: (history: CallHistory[]) => void;
  addCallHistory: (entry: CallHistory) => void;
  clearCallHistory: () => void;

  // Actions - Settings
  setSettings: (settings: CallSettings | null) => void;
  updateSettings: (updates: Partial<CallSettings>) => void;

  // Actions - Media devices
  setDevices: (devices: MediaDevices) => void;
  setSelectedAudioInput: (deviceId: string | null) => void;
  setSelectedAudioOutput: (deviceId: string | null) => void;
  setSelectedVideoInput: (deviceId: string | null) => void;

  // Actions - Hotline
  setHotlineConfigs: (configs: HotlineConfig[]) => void;
  setActiveHotlineCalls: (calls: HotlineCallState[]) => void;
  addHotlineCall: (call: HotlineCallState) => void;
  updateHotlineCall: (callId: string, updates: Partial<HotlineCallState>) => void;
  removeHotlineCall: (callId: string) => void;
  setOperatorStatus: (status: HotlineOperatorStatus | null) => void;
  setHotlineQueue: (queue: HotlineCallState[]) => void;

  // Actions - Messaging hotline
  setMessagingThreads: (threads: MessagingHotlineThread[]) => void;
  addMessagingThread: (thread: MessagingHotlineThread) => void;
  updateMessagingThread: (threadId: string, updates: Partial<MessagingHotlineThread>) => void;
  setActiveThread: (threadId: string | null) => void;

  // Actions - Broadcasts
  setBroadcasts: (broadcasts: Broadcast[]) => void;
  addBroadcast: (broadcast: Broadcast) => void;
  updateBroadcast: (broadcastId: string, updates: Partial<Broadcast>) => void;
  removeBroadcast: (broadcastId: string) => void;

  // Actions - UI
  setCallMinimized: (minimized: boolean) => void;
  setShowIncomingCallDialog: (show: boolean) => void;

  // Selectors
  isInCall: () => boolean;
  isInGroupCall: () => boolean;
  getCallById: (callId: string) => CallHistory | undefined;
  getHotlineCallById: (callId: string) => HotlineCallState | undefined;
  getThreadById: (threadId: string) => MessagingHotlineThread | undefined;
  getUnassignedThreads: () => MessagingHotlineThread[];
  getMyThreads: (pubkey: string) => MessagingHotlineThread[];
  getBroadcastById: (broadcastId: string) => Broadcast | undefined;

  // Clear all state
  clearAll: () => void;
}

const initialState = {
  activeCall: null,
  incomingCall: null,
  activeGroupCall: null,
  callHistory: [],
  settings: null,
  devices: {
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  },
  selectedAudioInput: null,
  selectedAudioOutput: null,
  selectedVideoInput: null,
  hotlineConfigs: [],
  activeHotlineCalls: [],
  operatorStatus: null,
  hotlineQueue: [],
  messagingThreads: [],
  activeThread: null,
  broadcasts: [],
  isCallMinimized: false,
  showIncomingCallDialog: false,
};

export const useCallingStore = create<CallingState>()((set, get) => ({
  ...initialState,

  // Call lifecycle actions
  setActiveCall: (call) => set({ activeCall: call }),

  updateActiveCall: (updates) =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, ...updates }
        : null,
    })),

  setIncomingCall: (call) =>
    set({ incomingCall: call, showIncomingCallDialog: !!call }),

  clearIncomingCall: () =>
    set({ incomingCall: null, showIncomingCallDialog: false }),

  // Group call actions
  setActiveGroupCall: (call) => set({ activeGroupCall: call }),

  updateGroupCall: (updates) =>
    set((state) => ({
      activeGroupCall: state.activeGroupCall
        ? { ...state.activeGroupCall, ...updates }
        : null,
    })),

  addGroupParticipant: (participant) =>
    set((state) => {
      if (!state.activeGroupCall) return state;
      const newParticipants = new Map(state.activeGroupCall.participants);
      newParticipants.set(participant.pubkey, {
        pubkey: participant.pubkey,
        displayName: participant.displayName,
        audioEnabled: participant.audioEnabled ?? true,
        videoEnabled: participant.videoEnabled ?? false,
        isSpeaking: participant.isSpeaking ?? false,
      });
      return {
        activeGroupCall: {
          ...state.activeGroupCall,
          participants: newParticipants,
        },
      };
    }),

  removeGroupParticipant: (pubkey) =>
    set((state) => {
      if (!state.activeGroupCall) return state;
      const newParticipants = new Map(state.activeGroupCall.participants);
      newParticipants.delete(pubkey);
      return {
        activeGroupCall: {
          ...state.activeGroupCall,
          participants: newParticipants,
        },
      };
    }),

  updateGroupParticipant: (pubkey, updates) =>
    set((state) => {
      if (!state.activeGroupCall) return state;
      const participant = state.activeGroupCall.participants.get(pubkey);
      if (!participant) return state;
      const newParticipants = new Map(state.activeGroupCall.participants);
      newParticipants.set(pubkey, { ...participant, ...updates });
      return {
        activeGroupCall: {
          ...state.activeGroupCall,
          participants: newParticipants,
        },
      };
    }),

  // Call history actions
  setCallHistory: (history) => set({ callHistory: history }),

  addCallHistory: (entry) =>
    set((state) => ({
      callHistory: [entry, ...state.callHistory],
    })),

  clearCallHistory: () => set({ callHistory: [] }),

  // Settings actions
  setSettings: (settings) => set({ settings }),

  updateSettings: (updates) =>
    set((state) => ({
      settings: state.settings
        ? { ...state.settings, ...updates }
        : null,
    })),

  // Media devices actions
  setDevices: (devices) => set({ devices }),

  setSelectedAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),

  setSelectedAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),

  setSelectedVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),

  // Hotline actions
  setHotlineConfigs: (configs) => set({ hotlineConfigs: configs }),

  setActiveHotlineCalls: (calls) => set({ activeHotlineCalls: calls }),

  addHotlineCall: (call) =>
    set((state) => ({
      activeHotlineCalls: [...state.activeHotlineCalls, call],
    })),

  updateHotlineCall: (callId, updates) =>
    set((state) => ({
      activeHotlineCalls: state.activeHotlineCalls.map((call) =>
        call.callId === callId ? { ...call, ...updates } : call
      ),
    })),

  removeHotlineCall: (callId) =>
    set((state) => ({
      activeHotlineCalls: state.activeHotlineCalls.filter(
        (call) => call.callId !== callId
      ),
    })),

  setOperatorStatus: (status) => set({ operatorStatus: status }),

  setHotlineQueue: (queue) => set({ hotlineQueue: queue }),

  // Messaging hotline actions
  setMessagingThreads: (threads) => set({ messagingThreads: threads }),

  addMessagingThread: (thread) =>
    set((state) => ({
      messagingThreads: [thread, ...state.messagingThreads],
    })),

  updateMessagingThread: (threadId, updates) =>
    set((state) => ({
      messagingThreads: state.messagingThreads.map((thread) =>
        thread.threadId === threadId ? { ...thread, ...updates } : thread
      ),
    })),

  setActiveThread: (threadId) => set({ activeThread: threadId }),

  // Broadcast actions
  setBroadcasts: (broadcasts) => set({ broadcasts }),

  addBroadcast: (broadcast) =>
    set((state) => ({
      broadcasts: [broadcast, ...state.broadcasts],
    })),

  updateBroadcast: (broadcastId, updates) =>
    set((state) => ({
      broadcasts: state.broadcasts.map((b) =>
        b.broadcastId === broadcastId ? { ...b, ...updates } : b
      ),
    })),

  removeBroadcast: (broadcastId) =>
    set((state) => ({
      broadcasts: state.broadcasts.filter((b) => b.broadcastId !== broadcastId),
    })),

  // UI actions
  setCallMinimized: (minimized) => set({ isCallMinimized: minimized }),

  setShowIncomingCallDialog: (show) => set({ showIncomingCallDialog: show }),

  // Selectors
  isInCall: () => {
    const state = get();
    return (
      state.activeCall !== null &&
      state.activeCall.state !== CallStateState.Ended
    );
  },

  isInGroupCall: () => {
    const state = get();
    return state.activeGroupCall !== null;
  },

  getCallById: (callId) => {
    return get().callHistory.find((c) => c.callId === callId);
  },

  getHotlineCallById: (callId) => {
    return get().activeHotlineCalls.find((c) => c.callId === callId);
  },

  getThreadById: (threadId) => {
    return get().messagingThreads.find((t) => t.threadId === threadId);
  },

  getUnassignedThreads: () => {
    return get().messagingThreads.filter((t) => !t.assignedOperator);
  },

  getMyThreads: (pubkey) => {
    return get().messagingThreads.filter((t) => t.assignedOperator === pubkey);
  },

  getBroadcastById: (broadcastId) => {
    return get().broadcasts.find((b) => b.broadcastId === broadcastId);
  },

  // Clear all
  clearAll: () => set(initialState),
}));
