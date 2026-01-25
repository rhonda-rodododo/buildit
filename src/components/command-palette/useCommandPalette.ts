/**
 * Hook for programmatic command palette access
 */

import { useContext, useCallback, useEffect } from 'react';
import { CommandPaletteContext } from './CommandPaletteContext';
import type { CommandAction } from './types';

/**
 * Hook to access command palette functionality
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { open, registerAction } = useCommandPalette();
 *
 *   // Register a custom action
 *   useEffect(() => {
 *     registerAction({
 *       id: 'my-action',
 *       label: 'My Custom Action',
 *       category: 'create',
 *       onSelect: () => console.log('Action executed!'),
 *     });
 *   }, [registerAction]);
 *
 *   return <button onClick={open}>Open Command Palette</button>;
 * }
 * ```
 */
export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);

  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }

  return context;
}

/**
 * Hook to register a command action
 * Automatically unregisters on unmount
 *
 * @example
 * ```tsx
 * function MyFeature() {
 *   useRegisterAction({
 *     id: 'feature-action',
 *     label: 'Do Feature Thing',
 *     category: 'create',
 *     onSelect: () => doThing(),
 *   });
 *
 *   return <div>My Feature</div>;
 * }
 * ```
 */
export function useRegisterAction(action: CommandAction) {
  const { registerAction, unregisterAction } = useCommandPalette();

  useEffect(() => {
    registerAction(action);
    return () => unregisterAction(action.id);
  }, [action, registerAction, unregisterAction]);
}

/**
 * Hook to register multiple command actions
 * Automatically unregisters on unmount
 *
 * @example
 * ```tsx
 * function MyModule() {
 *   useRegisterActions([
 *     { id: 'action-1', label: 'Action 1', category: 'create', onSelect: action1 },
 *     { id: 'action-2', label: 'Action 2', category: 'create', onSelect: action2 },
 *   ]);
 *
 *   return <div>My Module</div>;
 * }
 * ```
 */
export function useRegisterActions(actions: CommandAction[]) {
  const { registerActions, unregisterAction } = useCommandPalette();

  useEffect(() => {
    registerActions(actions);
    return () => {
      for (const action of actions) {
        unregisterAction(action.id);
      }
    };
  }, [actions, registerActions, unregisterAction]);
}

/**
 * Hook for keyboard shortcut registration
 * Registers a global keyboard shortcut that executes when pressed
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useCommandShortcut('Mod+n', () => {
 *     // Create new item
 *   });
 * }
 * ```
 */
export function useCommandShortcut(shortcut: string, callback: () => void) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const isMod = isMac ? e.metaKey : e.ctrlKey;

      // Parse shortcut
      const parts = shortcut.split('+');
      const key = parts[parts.length - 1].toLowerCase();
      const needsShift = parts.includes('Shift');
      const needsMod = parts.includes('Mod') || parts.includes('Ctrl') || parts.includes('Cmd');

      // Check modifiers
      if (needsMod && !isMod) return;
      if (needsShift && !e.shiftKey) return;

      // Check key
      if (e.key.toLowerCase() !== key) return;

      e.preventDefault();
      callback();
    },
    [shortcut, callback]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useCommandPalette;
