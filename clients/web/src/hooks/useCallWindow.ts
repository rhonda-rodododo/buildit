/**
 * Call Window Hook for Tauri Desktop
 *
 * Provides functions to manage separate call windows similar to Microsoft Teams.
 * Only functional when running inside Tauri desktop environment.
 */

import { useCallback } from 'react';

/**
 * Check if running inside Tauri
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Call type for window configuration
 */
export type CallWindowType = 'onetoone' | 'group' | 'conference' | 'hotline' | 'ptt';

/**
 * Configuration for creating a call window
 */
export interface CallWindowConfig {
  /** Unique call identifier */
  callId: string;
  /** Type of call */
  callType: CallWindowType;
  /** List of participant names or identifiers */
  participants: string[];
  /** Window title */
  title: string;
  /** Group ID if this is a group call */
  groupId?: string;
  /** Whether to start in Picture-in-Picture mode */
  startMinimized?: boolean;
}

/**
 * State of a call window
 */
export interface CallWindowState {
  callId: string;
  windowLabel: string;
  isMinimized: boolean;
  isAlwaysOnTop: boolean;
}

/**
 * Get Tauri invoke function (dynamic import to avoid build errors)
 */
async function getTauriInvoke() {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

/**
 * Hook for managing call windows in Tauri desktop
 *
 * Features:
 * - Create separate windows for calls (like Microsoft Teams)
 * - Minimize to Picture-in-Picture mode
 * - Toggle always-on-top
 * - Update window title dynamically
 */
export function useCallWindow() {
  /**
   * Create a new call window
   * Opens a separate window for the call that can be moved independently.
   */
  const createCallWindow = useCallback(
    async (config: CallWindowConfig): Promise<string> => {
      if (!isTauri()) {
        console.warn('Call windows are only available in Tauri desktop');
        return config.callId;
      }

      try {
        const invoke = await getTauriInvoke();
        const windowLabel = await invoke<string>('create_call_window', { config });
        return windowLabel;
      } catch (error) {
        console.error('Failed to create call window:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Close a call window
   */
  const closeCallWindow = useCallback(async (callId: string): Promise<void> => {
    if (!isTauri()) return;

    try {
      const invoke = await getTauriInvoke();
      await invoke('close_call_window', { callId });
    } catch (error) {
      console.error('Failed to close call window:', error);
      throw error;
    }
  }, []);

  /**
   * Minimize call window to Picture-in-Picture mode
   * Creates a small floating window in the corner of the screen.
   */
  const minimizeCallWindow = useCallback(async (callId: string): Promise<void> => {
    if (!isTauri()) return;

    try {
      const invoke = await getTauriInvoke();
      await invoke('minimize_call_window', { callId });
    } catch (error) {
      console.error('Failed to minimize call window:', error);
      throw error;
    }
  }, []);

  /**
   * Maximize call window from PiP mode
   * Restores the window to full size.
   */
  const maximizeCallWindow = useCallback(async (callId: string): Promise<void> => {
    if (!isTauri()) return;

    try {
      const invoke = await getTauriInvoke();
      await invoke('maximize_call_window', { callId });
    } catch (error) {
      console.error('Failed to maximize call window:', error);
      throw error;
    }
  }, []);

  /**
   * Toggle always-on-top for a call window
   */
  const toggleAlwaysOnTop = useCallback(
    async (callId: string, onTop: boolean): Promise<void> => {
      if (!isTauri()) return;

      try {
        const invoke = await getTauriInvoke();
        await invoke('toggle_call_window_always_on_top', { callId, onTop });
      } catch (error) {
        console.error('Failed to toggle always on top:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Update call window title
   * Useful when participants join/leave.
   */
  const updateCallWindowTitle = useCallback(
    async (callId: string, title: string): Promise<void> => {
      if (!isTauri()) return;

      try {
        const invoke = await getTauriInvoke();
        await invoke('update_call_window_title', { callId, title });
      } catch (error) {
        console.error('Failed to update call window title:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Focus a call window
   * Brings the window to the front.
   */
  const focusCallWindow = useCallback(async (callId: string): Promise<void> => {
    if (!isTauri()) return;

    try {
      const invoke = await getTauriInvoke();
      await invoke('focus_call_window', { callId });
    } catch (error) {
      console.error('Failed to focus call window:', error);
      throw error;
    }
  }, []);

  /**
   * Check if a call window exists
   */
  const callWindowExists = useCallback(async (callId: string): Promise<boolean> => {
    if (!isTauri()) return false;

    try {
      const invoke = await getTauriInvoke();
      return await invoke<boolean>('call_window_exists', { callId });
    } catch (error) {
      console.error('Failed to check call window:', error);
      return false;
    }
  }, []);

  /**
   * Get all active call windows
   */
  const getCallWindows = useCallback(async (): Promise<CallWindowState[]> => {
    if (!isTauri()) return [];

    try {
      const invoke = await getTauriInvoke();
      return await invoke<CallWindowState[]>('get_call_windows');
    } catch (error) {
      console.error('Failed to get call windows:', error);
      return [];
    }
  }, []);

  /**
   * Close all call windows
   * Used when logging out or shutting down.
   */
  const closeAllCallWindows = useCallback(async (): Promise<void> => {
    if (!isTauri()) return;

    try {
      const invoke = await getTauriInvoke();
      await invoke('close_all_call_windows');
    } catch (error) {
      console.error('Failed to close all call windows:', error);
      throw error;
    }
  }, []);

  return {
    isTauri: isTauri(),
    createCallWindow,
    closeCallWindow,
    minimizeCallWindow,
    maximizeCallWindow,
    toggleAlwaysOnTop,
    updateCallWindowTitle,
    focusCallWindow,
    callWindowExists,
    getCallWindows,
    closeAllCallWindows,
  };
}

export default useCallWindow;
