/**
 * Hotlines Module Zustand Store
 * State management for hotlines, calls, and operators
 */

import { create } from 'zustand';
import type {
  Hotline,
  HotlineCall,
  HotlineDispatch,
  HotlineOperator,
  HotlineStats,
  CallLogOptions,
  CreateHotlineData,
  UpdateHotlineData,
  CallerData,
  UpdateCallData,
  DispatchStatus,
} from './types';
import { HotlinesManager } from './hotlinesManager';

interface HotlinesState {
  // State
  hotlines: Hotline[];
  activeCalls: HotlineCall[];
  callHistory: HotlineCall[];
  dispatches: HotlineDispatch[];
  operators: HotlineOperator[];
  currentHotlineId: string | null;
  stats: HotlineStats | null;
  isLoading: boolean;
  error: string | null;

  // Hotline CRUD
  loadHotlines: (groupId: string) => Promise<void>;
  createHotline: (
    groupId: string,
    data: CreateHotlineData,
    userPubkey: string
  ) => Promise<Hotline>;
  updateHotline: (id: string, updates: UpdateHotlineData) => Promise<void>;
  deleteHotline: (id: string) => Promise<void>;
  setCurrentHotline: (id: string | null) => void;

  // Call management
  loadActiveCalls: (hotlineId: string) => Promise<void>;
  loadCallHistory: (hotlineId: string, options?: CallLogOptions) => Promise<void>;
  startCall: (
    hotlineId: string,
    callerData: CallerData,
    operatorPubkey: string
  ) => Promise<HotlineCall>;
  updateCall: (callId: string, updates: UpdateCallData) => Promise<void>;
  endCall: (callId: string, summary: string) => Promise<void>;

  // Dispatch
  dispatchVolunteer: (
    callId: string,
    volunteerPubkey: string
  ) => Promise<HotlineDispatch>;
  updateDispatchStatus: (
    dispatchId: string,
    status: DispatchStatus
  ) => Promise<void>;

  // Operators
  loadOperators: (hotlineId: string) => Promise<void>;
  startShift: (hotlineId: string, operatorPubkey: string) => Promise<void>;
  endShift: (hotlineId: string, operatorPubkey: string) => Promise<void>;
  getActiveOperators: (hotlineId: string) => Promise<string[]>;

  // Stats
  loadStats: (hotlineId: string) => Promise<void>;

  // CRM Integration
  linkCallToRecord: (
    callId: string,
    recordId: string,
    tableKey: string
  ) => Promise<void>;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  hotlines: [],
  activeCalls: [],
  callHistory: [],
  dispatches: [],
  operators: [],
  currentHotlineId: null,
  stats: null,
  isLoading: false,
  error: null,
};

export const useHotlinesStore = create<HotlinesState>((set, get) => {
  const manager = new HotlinesManager();

  return {
    ...initialState,

    // Hotline CRUD
    loadHotlines: async (groupId: string) => {
      set({ isLoading: true, error: null });
      try {
        const hotlines = await manager.getHotlines(groupId);
        set({ hotlines, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load hotlines',
          isLoading: false,
        });
      }
    },

    createHotline: async (
      groupId: string,
      data: CreateHotlineData,
      userPubkey: string
    ) => {
      set({ isLoading: true, error: null });
      try {
        const hotline = await manager.createHotline(groupId, data, userPubkey);
        set((state) => ({
          hotlines: [...state.hotlines, hotline],
          isLoading: false,
        }));
        return hotline;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to create hotline',
          isLoading: false,
        });
        throw error;
      }
    },

    updateHotline: async (id: string, updates: UpdateHotlineData) => {
      set({ isLoading: true, error: null });
      try {
        await manager.updateHotline(id, updates);
        set((state) => ({
          hotlines: state.hotlines.map((h) =>
            h.id === id ? { ...h, ...updates, updated: Date.now() } : h
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update hotline',
          isLoading: false,
        });
        throw error;
      }
    },

    deleteHotline: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        await manager.deleteHotline(id);
        set((state) => ({
          hotlines: state.hotlines.filter((h) => h.id !== id),
          currentHotlineId:
            state.currentHotlineId === id ? null : state.currentHotlineId,
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to delete hotline',
          isLoading: false,
        });
        throw error;
      }
    },

    setCurrentHotline: (id: string | null) => {
      set({ currentHotlineId: id });
    },

    // Call management
    loadActiveCalls: async (hotlineId: string) => {
      set({ isLoading: true, error: null });
      try {
        const activeCalls = await manager.getActiveCalls(hotlineId);
        set({ activeCalls, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load active calls',
          isLoading: false,
        });
      }
    },

    loadCallHistory: async (hotlineId: string, options?: CallLogOptions) => {
      set({ isLoading: true, error: null });
      try {
        const callHistory = await manager.getCallLog(hotlineId, options);
        set({ callHistory, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load call history',
          isLoading: false,
        });
      }
    },

    startCall: async (
      hotlineId: string,
      callerData: CallerData,
      operatorPubkey: string
    ) => {
      set({ isLoading: true, error: null });
      try {
        const call = await manager.startCall(hotlineId, callerData, operatorPubkey);
        set((state) => ({
          activeCalls: [...state.activeCalls, call],
          isLoading: false,
        }));
        return call;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to start call',
          isLoading: false,
        });
        throw error;
      }
    },

    updateCall: async (callId: string, updates: UpdateCallData) => {
      set({ isLoading: true, error: null });
      try {
        await manager.updateCall(callId, updates);
        set((state) => ({
          activeCalls: state.activeCalls.map((c) =>
            c.id === callId ? { ...c, ...updates, updated: Date.now() } : c
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update call',
          isLoading: false,
        });
        throw error;
      }
    },

    endCall: async (callId: string, summary: string) => {
      set({ isLoading: true, error: null });
      try {
        await manager.endCall(callId, summary);
        const call = get().activeCalls.find((c) => c.id === callId);
        if (call) {
          const completedCall = {
            ...call,
            status: 'completed' as const,
            summary,
            endTime: Date.now(),
            updated: Date.now(),
          };
          set((state) => ({
            activeCalls: state.activeCalls.filter((c) => c.id !== callId),
            callHistory: [completedCall, ...state.callHistory],
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to end call',
          isLoading: false,
        });
        throw error;
      }
    },

    // Dispatch
    dispatchVolunteer: async (callId: string, volunteerPubkey: string) => {
      set({ isLoading: true, error: null });
      try {
        const dispatch = await manager.dispatchVolunteer(callId, volunteerPubkey);
        set((state) => ({
          dispatches: [...state.dispatches, dispatch],
          isLoading: false,
        }));
        return dispatch;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to dispatch volunteer',
          isLoading: false,
        });
        throw error;
      }
    },

    updateDispatchStatus: async (dispatchId: string, status: DispatchStatus) => {
      set({ isLoading: true, error: null });
      try {
        await manager.updateDispatchStatus(dispatchId, status);
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === dispatchId
              ? { ...d, status, responseTime: Date.now(), updated: Date.now() }
              : d
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update dispatch',
          isLoading: false,
        });
        throw error;
      }
    },

    // Operators
    loadOperators: async (hotlineId: string) => {
      set({ isLoading: true, error: null });
      try {
        const operators = await manager.getOperators(hotlineId);
        set({ operators, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load operators',
          isLoading: false,
        });
      }
    },

    startShift: async (hotlineId: string, operatorPubkey: string) => {
      set({ isLoading: true, error: null });
      try {
        await manager.startShift(hotlineId, operatorPubkey);
        await get().loadOperators(hotlineId);
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to start shift',
          isLoading: false,
        });
        throw error;
      }
    },

    endShift: async (hotlineId: string, operatorPubkey: string) => {
      set({ isLoading: true, error: null });
      try {
        await manager.endShift(hotlineId, operatorPubkey);
        await get().loadOperators(hotlineId);
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to end shift',
          isLoading: false,
        });
        throw error;
      }
    },

    getActiveOperators: async (hotlineId: string) => {
      try {
        return await manager.getActiveOperators(hotlineId);
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to get operators',
        });
        return [];
      }
    },

    // Stats
    loadStats: async (hotlineId: string) => {
      set({ isLoading: true, error: null });
      try {
        const stats = await manager.getStats(hotlineId);
        set({ stats, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load stats',
          isLoading: false,
        });
      }
    },

    // CRM Integration
    linkCallToRecord: async (
      callId: string,
      recordId: string,
      tableKey: string
    ) => {
      set({ isLoading: true, error: null });
      try {
        await manager.linkCallToRecord(callId, recordId, tableKey);
        set((state) => ({
          activeCalls: state.activeCalls.map((c) =>
            c.id === callId
              ? { ...c, linkedRecordId: recordId, linkedRecordTable: tableKey }
              : c
          ),
          callHistory: state.callHistory.map((c) =>
            c.id === callId
              ? { ...c, linkedRecordId: recordId, linkedRecordTable: tableKey }
              : c
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to link call to record',
          isLoading: false,
        });
        throw error;
      }
    },

    // Utilities
    clearError: () => set({ error: null }),
    reset: () => set(initialState),
  };
});

export default useHotlinesStore;
