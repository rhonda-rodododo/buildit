/**
 * Desktop Call Manager
 *
 * Handles desktop-specific call functionality, particularly managing separate
 * call windows similar to Microsoft Teams.
 *
 * This manager works alongside the main CallingManager to provide:
 * - Opening calls in separate Tauri windows
 * - Managing PiP (Picture-in-Picture) mode
 * - Window state synchronization
 */

import { logger } from '@/lib/logger';
import { isTauri, type CallWindowConfig, type CallWindowState } from '@/hooks/useCallWindow';
import { CallType } from '../types';

/**
 * Map our CallType to the window CallType
 */
function mapCallType(callType: CallType): CallWindowConfig['callType'] {
  switch (callType) {
    case CallType.Video:
    case CallType.Voice:
      return 'onetoone';
    default:
      return 'onetoone';
  }
}

/**
 * Map call type string to window type
 */
function mapCallTypeString(callType: string): CallWindowConfig['callType'] {
  switch (callType.toLowerCase()) {
    case 'group':
      return 'group';
    case 'conference':
      return 'conference';
    case 'hotline':
      return 'hotline';
    case 'ptt':
      return 'ptt';
    default:
      return 'onetoone';
  }
}

/**
 * Generate window title from participants
 */
function generateWindowTitle(
  callType: CallWindowConfig['callType'],
  participants: string[],
  remoteName?: string
): string {
  switch (callType) {
    case 'group':
      return participants.length > 0
        ? `Group call with ${participants.length} participants`
        : 'Group call';
    case 'conference':
      return participants.length > 0
        ? `Conference - ${participants.length} participants`
        : 'Conference call';
    case 'hotline':
      return remoteName ? `Hotline: ${remoteName}` : 'Hotline call';
    case 'ptt':
      return 'Push-to-Talk channel';
    default:
      return remoteName ? `Call with ${remoteName}` : 'Call';
  }
}

/**
 * Desktop Call Manager class
 *
 * Manages call windows for the Tauri desktop application.
 */
class DesktopCallManager {
  private activeWindows: Map<string, CallWindowState> = new Map();
  private invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

  /**
   * Initialize the desktop call manager
   */
  async initialize(): Promise<void> {
    if (!isTauri()) {
      logger.debug('Desktop call manager: Not in Tauri environment, skipping');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      this.invoke = invoke;
      logger.info('Desktop call manager initialized');
    } catch (error) {
      logger.error('Failed to initialize desktop call manager:', error);
    }
  }

  /**
   * Start a call in a new window
   */
  async startCallInWindow(config: {
    callId: string;
    callType: CallType | string;
    remotePubkey: string;
    remoteName?: string;
    participants?: string[];
    groupId?: string;
    startMinimized?: boolean;
  }): Promise<string | null> {
    if (!this.invoke) {
      logger.debug('Not in Tauri, cannot open call window');
      return null;
    }

    try {
      const windowCallType =
        typeof config.callType === 'string'
          ? mapCallTypeString(config.callType)
          : mapCallType(config.callType);

      const participants = config.participants ?? [config.remotePubkey];
      const title = generateWindowTitle(windowCallType, participants, config.remoteName);

      const windowConfig: CallWindowConfig = {
        callId: config.callId,
        callType: windowCallType,
        participants,
        title,
        groupId: config.groupId,
        startMinimized: config.startMinimized,
      };

      const windowLabel = await this.invoke('create_call_window', {
        config: windowConfig,
      });

      this.activeWindows.set(config.callId, {
        callId: config.callId,
        windowLabel: windowLabel as string,
        isMinimized: config.startMinimized ?? false,
        isAlwaysOnTop: config.startMinimized ?? false,
      });

      logger.info('Opened call window:', { callId: config.callId, windowLabel });
      return windowLabel as string;
    } catch (error) {
      logger.error('Failed to open call window:', error);
      return null;
    }
  }

  /**
   * End a call and close its window
   */
  async endCallWindow(callId: string): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('close_call_window', { callId });
      this.activeWindows.delete(callId);
      logger.info('Closed call window:', { callId });
    } catch (error) {
      logger.error('Failed to close call window:', error);
    }
  }

  /**
   * Minimize a call window to PiP mode
   */
  async minimizeToPiP(callId: string): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('minimize_call_window', { callId });
      const state = this.activeWindows.get(callId);
      if (state) {
        state.isMinimized = true;
        state.isAlwaysOnTop = true;
      }
      logger.debug('Minimized call to PiP:', { callId });
    } catch (error) {
      logger.error('Failed to minimize call window:', error);
    }
  }

  /**
   * Restore a call window from PiP mode
   */
  async restoreFromPiP(callId: string): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('maximize_call_window', { callId });
      const state = this.activeWindows.get(callId);
      if (state) {
        state.isMinimized = false;
        state.isAlwaysOnTop = false;
      }
      logger.debug('Restored call from PiP:', { callId });
    } catch (error) {
      logger.error('Failed to restore call window:', error);
    }
  }

  /**
   * Toggle always-on-top for a call window
   */
  async toggleAlwaysOnTop(callId: string, onTop: boolean): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('toggle_call_window_always_on_top', { callId, onTop });
      const state = this.activeWindows.get(callId);
      if (state) {
        state.isAlwaysOnTop = onTop;
      }
      logger.debug('Toggled always on top:', { callId, onTop });
    } catch (error) {
      logger.error('Failed to toggle always on top:', error);
    }
  }

  /**
   * Update a call window's title
   */
  async updateWindowTitle(callId: string, title: string): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('update_call_window_title', { callId, title });
      logger.debug('Updated call window title:', { callId, title });
    } catch (error) {
      logger.error('Failed to update window title:', error);
    }
  }

  /**
   * Focus a call window
   */
  async focusCallWindow(callId: string): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('focus_call_window', { callId });
      logger.debug('Focused call window:', { callId });
    } catch (error) {
      logger.error('Failed to focus call window:', error);
    }
  }

  /**
   * Check if a call window exists
   */
  async hasCallWindow(callId: string): Promise<boolean> {
    if (!this.invoke) return false;

    try {
      return (await this.invoke('call_window_exists', { callId })) as boolean;
    } catch (error) {
      logger.error('Failed to check call window:', error);
      return false;
    }
  }

  /**
   * Get all active call windows
   */
  async getActiveWindows(): Promise<CallWindowState[]> {
    if (!this.invoke) return [];

    try {
      const windows = (await this.invoke('get_call_windows')) as CallWindowState[];
      // Update local cache
      this.activeWindows.clear();
      for (const window of windows) {
        this.activeWindows.set(window.callId, window);
      }
      return windows;
    } catch (error) {
      logger.error('Failed to get call windows:', error);
      return [];
    }
  }

  /**
   * Close all call windows
   */
  async closeAllWindows(): Promise<void> {
    if (!this.invoke) return;

    try {
      await this.invoke('close_all_call_windows');
      this.activeWindows.clear();
      logger.info('Closed all call windows');
    } catch (error) {
      logger.error('Failed to close all call windows:', error);
    }
  }

  /**
   * Get the local state of a call window
   */
  getWindowState(callId: string): CallWindowState | undefined {
    return this.activeWindows.get(callId);
  }

  /**
   * Check if running in Tauri
   */
  get isDesktop(): boolean {
    return isTauri();
  }
}

/**
 * Singleton instance
 */
let desktopCallManagerInstance: DesktopCallManager | null = null;

export function getDesktopCallManager(): DesktopCallManager {
  if (!desktopCallManagerInstance) {
    desktopCallManagerInstance = new DesktopCallManager();
  }
  return desktopCallManagerInstance;
}

export async function initializeDesktopCallManager(): Promise<void> {
  const manager = getDesktopCallManager();
  await manager.initialize();
}

export function closeDesktopCallManager(): void {
  if (desktopCallManagerInstance) {
    desktopCallManagerInstance.closeAllWindows().catch(() => {});
    desktopCallManagerInstance = null;
  }
}

export type { DesktopCallManager };
