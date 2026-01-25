/**
 * Keyboard Shortcuts Hook
 * Provides a reusable way to register and handle keyboard shortcuts
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useTauri } from '@/lib/tauri';

/**
 * Shortcut configuration
 */
export interface ShortcutConfig {
  /** Unique identifier for the shortcut */
  id: string;
  /** Key to press (case-insensitive) */
  key: string;
  /** Require Ctrl/Cmd modifier */
  mod?: boolean;
  /** Require Shift modifier */
  shift?: boolean;
  /** Require Alt/Option modifier */
  alt?: boolean;
  /** Handler function */
  handler: () => void;
  /** Description for accessibility */
  description?: string;
  /** Only active when condition is true */
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

/**
 * Parse a shortcut string into ShortcutConfig modifiers
 * e.g., "Mod+Shift+N" -> { mod: true, shift: true, key: 'n' }
 */
export function parseShortcut(shortcut: string): Partial<ShortcutConfig> {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop() || '';

  return {
    key,
    mod: parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
  };
}

/**
 * Format a shortcut for display based on OS
 */
export function formatShortcut(shortcut: string, os: 'macos' | 'windows' | 'linux'): string {
  const parts = shortcut.split('+');

  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'mod' || lower === 'ctrl' || lower === 'cmd') {
        return os === 'macos' ? '⌘' : 'Ctrl';
      }
      if (lower === 'shift') return os === 'macos' ? '⇧' : 'Shift';
      if (lower === 'alt' || lower === 'option') return os === 'macos' ? '⌥' : 'Alt';
      if (lower === 'enter' || lower === 'return') return '↵';
      if (lower === 'escape' || lower === 'esc') return 'Esc';
      if (lower === 'backspace') return '⌫';
      if (lower === 'tab') return 'Tab';
      if (lower === 'space') return 'Space';
      // Arrow keys
      if (lower === 'arrowup' || lower === 'up') return '↑';
      if (lower === 'arrowdown' || lower === 'down') return '↓';
      if (lower === 'arrowleft' || lower === 'left') return '←';
      if (lower === 'arrowright' || lower === 'right') return '→';
      // Single letter or symbol
      return part.toUpperCase();
    })
    .join(os === 'macos' ? '' : '+');
}

/**
 * Check if a keyboard event matches a shortcut configuration
 */
function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig, isMac: boolean): boolean {
  const key = event.key.toLowerCase();
  const configKey = config.key.toLowerCase();

  // Check key match
  if (key !== configKey) return false;

  // Check modifiers
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  const modRequired = config.mod ?? false;
  if (modRequired !== modPressed) return false;

  const shiftRequired = config.shift ?? false;
  if (shiftRequired !== event.shiftKey) return false;

  const altRequired = config.alt ?? false;
  if (altRequired !== event.altKey) return false;

  return true;
}

/**
 * Hook to register keyboard shortcuts
 * @param shortcuts Array of shortcut configurations
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  const { os } = useTauri();
  const isMac = os === 'macos';

  // Memoize the handler to prevent unnecessary re-registrations
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (unless explicitly allowed)
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue;

        if (matchesShortcut(event, shortcut, isMac)) {
          // Allow some shortcuts even in inputs (e.g., Ctrl+/ for search)
          // Skip if in input and shortcut doesn't require modifiers
          if (isInput && !shortcut.mod && !shortcut.alt) continue;

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, isMac]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for a single keyboard shortcut
 * Simpler API for single shortcuts
 */
export function useKeyboardShortcut(
  shortcut: string,
  handler: () => void,
  options?: {
    enabled?: boolean;
    preventDefault?: boolean;
    description?: string;
  }
): void {
  const config = useMemo<ShortcutConfig>(() => {
    const parsed = parseShortcut(shortcut);
    return {
      id: shortcut,
      key: parsed.key || '',
      mod: parsed.mod,
      shift: parsed.shift,
      alt: parsed.alt,
      handler,
      enabled: options?.enabled ?? true,
      preventDefault: options?.preventDefault ?? true,
      description: options?.description,
    };
  }, [shortcut, handler, options?.enabled, options?.preventDefault, options?.description]);

  useKeyboardShortcuts([config]);
}

/**
 * Common keyboard shortcuts as constants
 */
export const COMMON_SHORTCUTS = {
  COMMAND_PALETTE: 'Mod+K',
  SEARCH: 'Mod+/',
  SETTINGS: 'Mod+,',
  NEW: 'Mod+N',
  NEW_GROUP: 'Mod+Shift+N',
  TOGGLE_SIDEBAR: 'Mod+B',
  CLOSE: 'Escape',
  MESSAGES: 'Mod+1',
  GROUPS: 'Mod+2',
  FRIENDS: 'Mod+3',
  EVENTS: 'Mod+4',
  FEED: 'Mod+5',
} as const;

export default useKeyboardShortcuts;
