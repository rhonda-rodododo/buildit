/**
 * Tauri Integration Layer
 *
 * Provides unified hooks and utilities for Tauri desktop app features
 * with graceful fallbacks for browser environment.
 *
 * @example
 * ```tsx
 * import { useTauri, useTauriShell, useTauriNotifications } from '@/lib/tauri';
 *
 * function MyComponent() {
 *   const { isTauri, modifierKey } = useTauri();
 *   const { openUrl } = useTauriShell();
 *   const { sendNotification } = useTauriNotifications();
 *
 *   // ...
 * }
 * ```
 */

// Core detection and platform info
export {
  useTauri,
  useIsTauri,
  useModifierKey,
  isTauriEnvironment,
  detectOS,
  getPlatformInfo,
} from './useTauri';

// Shell operations (external URLs, file paths)
export { useTauriShell, createExternalLinkHandler } from './useTauriShell';

// Event subscriptions
export { useTauriEvents, useDeepLinkHandler } from './useTauriEvents';

// Window management
export { useTauriWindow } from './useTauriWindow';

// Notifications
export { useTauriNotifications } from './useTauriNotifications';

// Types
export type {
  PlatformInfo,
  TauriEventPayloads,
  TrayAction,
  UserStatus,
  BLEScanResult,
  WindowState,
  WindowOptions,
  NotificationOptions,
  NotificationPermission,
  OpenResult,
  TauriCapabilities,
  UnlistenFn,
  EventCallback,
} from './types';

// Constants
export {
  TAURI_CAPABILITIES,
  DEEP_LINK_SCHEME,
  DEFAULT_WINDOW_DIMENSIONS,
  FILE_PREVIEW_WINDOW_DIMENSIONS,
  MODIFIER_BY_PLATFORM,
  TAURI_EVENTS,
  TAURI_STORAGE_KEYS,
  TAURI_COMMANDS,
} from './constants';
