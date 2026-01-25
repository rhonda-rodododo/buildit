/**
 * TypeScript types for Tauri integration layer
 * Provides type-safe interfaces for Tauri APIs with graceful browser fallbacks
 */

/**
 * Platform detection result
 */
export interface PlatformInfo {
  /** Whether running in Tauri desktop app */
  isTauri: boolean;
  /** Operating system: 'macos' | 'windows' | 'linux' | 'browser' */
  os: 'macos' | 'windows' | 'linux' | 'browser';
  /** Platform-specific modifier key name */
  modifierKey: 'Cmd' | 'Ctrl';
  /** Platform-specific modifier symbol */
  modifierSymbol: '⌘' | 'Ctrl';
}

/**
 * Tauri event payload types
 */
export interface TauriEventPayloads {
  /** Navigation event from tray or deep link */
  navigate: string;
  /** Tray action event */
  'tray-action': TrayAction;
  /** Status change event */
  'status-change': UserStatus;
  /** Deep link event */
  'deep-link': string;
  /** BLE scan result */
  'ble-scan-result': BLEScanResult;
  /** Window state change */
  'window-state': WindowState;
}

/**
 * Tray menu actions
 */
export type TrayAction =
  | 'show-window'
  | 'hide-window'
  | 'toggle-window'
  | 'open-settings'
  | 'start-ble-scan'
  | 'stop-ble-scan'
  | 'quit';

/**
 * User online status
 */
export type UserStatus = 'online' | 'away' | 'busy' | 'invisible';

/**
 * BLE scan result from Tauri backend
 */
export interface BLEScanResult {
  deviceId: string;
  name: string | null;
  rssi: number;
  services: string[];
}

/**
 * Window state information
 */
export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Window creation options for multi-window support
 */
export interface WindowOptions {
  /** Window label (unique identifier) */
  label: string;
  /** URL to load in the window */
  url: string;
  /** Window title */
  title?: string;
  /** Window width in pixels */
  width?: number;
  /** Window height in pixels */
  height?: number;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Whether window is resizable */
  resizable?: boolean;
  /** Whether to center window on screen */
  center?: boolean;
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
  /** Whether window should be always on top */
  alwaysOnTop?: boolean;
  /** Whether to focus window on creation */
  focus?: boolean;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body?: string;
  /** Icon path or name */
  icon?: string;
  /** Sound to play */
  sound?: string;
  /** Action identifier for click handling */
  actionId?: string;
}

/**
 * Notification permission state
 */
export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Result of opening external URL
 */
export interface OpenResult {
  success: boolean;
  error?: string;
}

/**
 * Tauri capability flags
 */
export interface TauriCapabilities {
  shell: boolean;
  dialog: boolean;
  fs: boolean;
  notification: boolean;
  deepLink: boolean;
  tray: boolean;
  ble: boolean;
  keyring: boolean;
}

/**
 * Event unsubscribe function
 */
export type UnlistenFn = () => void;

/**
 * Event listener callback
 */
export type EventCallback<T> = (payload: T) => void;
