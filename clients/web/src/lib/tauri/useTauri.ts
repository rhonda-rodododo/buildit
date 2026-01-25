/**
 * Core Tauri detection and platform info hook
 * Provides unified interface for detecting Tauri environment and platform capabilities
 */

import { useState, useEffect, useMemo } from 'react';
import type { PlatformInfo, TauriCapabilities } from './types';
import { TAURI_CAPABILITIES, MODIFIER_BY_PLATFORM } from './constants';

/**
 * Check if running in Tauri environment
 * Uses the __TAURI_INTERNALS__ global set by Tauri
 */
export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window as any).__TAURI_INTERNALS__
  );
}

/**
 * Detect operating system
 */
export function detectOS(): PlatformInfo['os'] {
  if (typeof navigator === 'undefined') return 'browser';

  const platform = navigator.platform?.toLowerCase() || '';
  const userAgent = navigator.userAgent?.toLowerCase() || '';

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'macos';
  }
  if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows';
  }
  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux';
  }

  return 'browser';
}

/**
 * Get platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const isTauri = isTauriEnvironment();
  const os = detectOS();
  const modifier = MODIFIER_BY_PLATFORM[os];

  return {
    isTauri,
    os,
    modifierKey: modifier.key as PlatformInfo['modifierKey'],
    modifierSymbol: modifier.symbol as PlatformInfo['modifierSymbol'],
  };
}

/**
 * Hook for Tauri detection and platform information
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isTauri, os, modifierKey } = useTauri();
 *
 *   return (
 *     <div>
 *       {isTauri ? 'Running in desktop app' : 'Running in browser'}
 *       <kbd>{modifierKey}+K</kbd> to open command palette
 *     </div>
 *   );
 * }
 * ```
 */
export function useTauri(): PlatformInfo & { capabilities: TauriCapabilities } {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => ({
    isTauri: false,
    os: 'browser',
    modifierKey: 'Ctrl',
    modifierSymbol: 'Ctrl',
  }));

  useEffect(() => {
    // Detect platform on mount (handles SSR)
    setPlatformInfo(getPlatformInfo());
  }, []);

  // Capabilities are only available in Tauri
  const capabilities = useMemo<TauriCapabilities>(() => {
    if (!platformInfo.isTauri) {
      return {
        shell: false,
        dialog: false,
        fs: false,
        notification: false,
        deepLink: false,
        tray: false,
        ble: false,
        keyring: false,
      };
    }
    return TAURI_CAPABILITIES;
  }, [platformInfo.isTauri]);

  return {
    ...platformInfo,
    capabilities,
  };
}

/**
 * Hook that returns true only when in Tauri environment
 * Useful for conditional rendering
 *
 * @example
 * ```tsx
 * function TauriOnlyFeature() {
 *   const isTauri = useIsTauri();
 *   if (!isTauri) return null;
 *   return <BLEScanButton />;
 * }
 * ```
 */
export function useIsTauri(): boolean {
  const { isTauri } = useTauri();
  return isTauri;
}

/**
 * Hook for getting platform-aware modifier key display
 *
 * @example
 * ```tsx
 * function ShortcutHint({ shortcut }: { shortcut: string }) {
 *   const { formatShortcut } = useModifierKey();
 *   return <kbd>{formatShortcut(shortcut)}</kbd>;
 * }
 * // formatShortcut('Mod+K') => '⌘K' on macOS, 'Ctrl+K' on Windows/Linux
 * ```
 */
export function useModifierKey() {
  const { os, modifierKey, modifierSymbol } = useTauri();

  const formatShortcut = (shortcut: string): string => {
    // Replace 'Mod' with platform-specific modifier
    return shortcut
      .replace(/Mod\+/g, `${modifierSymbol}+`)
      .replace(/Ctrl\+/g, os === 'macos' ? '⌃+' : 'Ctrl+')
      .replace(/Alt\+/g, os === 'macos' ? '⌥+' : 'Alt+')
      .replace(/Shift\+/g, os === 'macos' ? '⇧+' : 'Shift+')
      // Clean up for macOS display (no plus signs between modifiers)
      .replace(/⌘\+/g, '⌘')
      .replace(/⌃\+/g, '⌃')
      .replace(/⌥\+/g, '⌥')
      .replace(/⇧\+/g, '⇧');
  };

  return {
    modifierKey,
    modifierSymbol,
    os,
    formatShortcut,
  };
}

export default useTauri;
