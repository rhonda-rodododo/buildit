/**
 * Command Palette Provider
 * Manages state, actions, and keyboard shortcuts
 */

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CommandPaletteContext } from './CommandPaletteContext';
import { CommandPalette } from './CommandPalette';
import { useTauri } from '@/lib/tauri';
import { useAuthStore } from '@/stores/authStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { useModuleStore } from '@/stores/moduleStore';
import { createNavigationActions } from './actions/navigation';
import { createGroupActions } from './actions/groups';
import { createSettingsActions } from './actions/settings';
import { createTauriActions } from './actions/tauri';
import type { CommandAction, CommandPaletteContextValue } from './types';

interface CommandPaletteProviderProps {
  children: ReactNode;
}

/**
 * Command Palette Provider Component
 */
export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customActions, setCustomActions] = useState<Map<string, CommandAction>>(new Map());

  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId?: string }>();
  const { isTauri, os } = useTauri();
  const { currentIdentity } = useAuthStore();
  const { groups, activeGroup } = useGroupsStore();
  const { registry } = useModuleStore();

  // Open/close handlers
  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Action registration
  const registerAction = useCallback((action: CommandAction) => {
    setCustomActions((prev) => {
      const next = new Map(prev);
      next.set(action.id, action);
      return next;
    });
  }, []);

  const unregisterAction = useCallback((actionId: string) => {
    setCustomActions((prev) => {
      const next = new Map(prev);
      next.delete(actionId);
      return next;
    });
  }, []);

  const registerActions = useCallback((actions: CommandAction[]) => {
    setCustomActions((prev) => {
      const next = new Map(prev);
      for (const action of actions) {
        next.set(action.id, action);
      }
      return next;
    });
  }, []);

  // Build all actions
  const allActions = useMemo(() => {
    const actions: CommandAction[] = [];

    // Navigation actions
    actions.push(...createNavigationActions(navigate));

    // Group actions
    actions.push(...createGroupActions(navigate, groups, activeGroup, groupId));

    // Settings actions
    actions.push(...createSettingsActions(navigate));

    // Tauri-specific actions (only in desktop app)
    if (isTauri) {
      actions.push(...createTauriActions());
    }

    // Custom registered actions
    actions.push(...Array.from(customActions.values()));

    // Filter by auth requirement
    const filteredActions = actions.filter((action) => {
      if (action.requiresAuth && !currentIdentity) {
        return false;
      }
      if (action.tauriOnly && !isTauri) {
        return false;
      }
      return true;
    });

    return filteredActions;
  }, [navigate, groups, activeGroup, groupId, isTauri, currentIdentity, customActions, registry]);

  // Execute action by ID
  const executeAction = useCallback(
    (actionId: string) => {
      const action = allActions.find((a) => a.id === actionId);
      if (action && !action.disabled) {
        close();
        action.onSelect();
      }
    },
    [allActions, close]
  );

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      const isMod = os === 'macos' ? e.metaKey : e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        toggle();
        return;
      }

      // Handle shortcuts when palette is closed
      if (!isOpen && isMod) {
        // Find action with matching shortcut
        for (const action of allActions) {
          if (action.shortcut && !action.disabled) {
            const shortcutKey = action.shortcut
              .replace('Mod+', '')
              .replace('Ctrl+', '')
              .replace('Cmd+', '')
              .toLowerCase();

            if (e.key.toLowerCase() === shortcutKey) {
              // Check for shift modifier
              const needsShift = action.shortcut.includes('Shift+');
              if (needsShift !== e.shiftKey) continue;

              e.preventDefault();
              action.onSelect();
              return;
            }
          }
        }
      }

      // Close on Escape
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [os, isOpen, toggle, close, allActions]);

  // Context value with actions exposed for CommandPalette to read
  const contextValue = useMemo<CommandPaletteContextValue & { _actions: CommandAction[] }>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      registerAction,
      unregisterAction,
      registerActions,
      executeAction,
      query,
      setQuery,
      _actions: allActions,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      registerAction,
      unregisterAction,
      registerActions,
      executeAction,
      query,
      setQuery,
      allActions,
    ]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
}

export default CommandPaletteProvider;
