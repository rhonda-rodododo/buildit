/**
 * Types for Command Palette
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Command action categories
 */
export type CommandCategory =
  | 'navigation'
  | 'actions'
  | 'groups'
  | 'messages'
  | 'search'
  | 'settings'
  | 'create'
  | 'tauri';

/**
 * Single command action
 */
export interface CommandAction {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Optional icon */
  icon?: LucideIcon;
  /** Keywords for fuzzy search */
  keywords?: string[];
  /** Keyboard shortcut (e.g., "Mod+1") */
  shortcut?: string;
  /** Action handler */
  onSelect: () => void;
  /** Whether this action is only available in Tauri */
  tauriOnly?: boolean;
  /** Whether this action requires authentication */
  requiresAuth?: boolean;
  /** Optional description */
  description?: string;
  /** Priority for sorting (higher = shown first) */
  priority?: number;
  /** Whether this action is disabled */
  disabled?: boolean;
  /** Optional group ID if action is group-specific */
  groupId?: string;
}

/**
 * Command group (for rendering)
 */
export interface CommandGroup {
  /** Category ID */
  category: CommandCategory;
  /** Display heading */
  heading: string;
  /** Actions in this group */
  actions: CommandAction[];
}

/**
 * Command palette state
 */
export interface CommandPaletteState {
  /** Whether palette is open */
  isOpen: boolean;
  /** Current search query */
  query: string;
  /** Available actions */
  actions: CommandAction[];
  /** Filtered actions based on query */
  filteredActions: CommandAction[];
  /** Selected action index */
  selectedIndex: number;
}

/**
 * Command palette context value
 */
export interface CommandPaletteContextValue {
  /** Whether palette is open */
  isOpen: boolean;
  /** Open the palette */
  open: () => void;
  /** Close the palette */
  close: () => void;
  /** Toggle the palette */
  toggle: () => void;
  /** Register an action */
  registerAction: (action: CommandAction) => void;
  /** Unregister an action */
  unregisterAction: (actionId: string) => void;
  /** Register multiple actions */
  registerActions: (actions: CommandAction[]) => void;
  /** Execute an action by ID */
  executeAction: (actionId: string) => void;
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
}

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<CommandCategory, { heading: string; priority: number }> = {
  actions: { heading: 'Actions', priority: 110 },
  navigation: { heading: 'Navigation', priority: 100 },
  search: { heading: 'Search', priority: 90 },
  create: { heading: 'Create', priority: 80 },
  groups: { heading: 'Groups', priority: 70 },
  messages: { heading: 'Messages', priority: 60 },
  settings: { heading: 'Settings', priority: 50 },
  tauri: { heading: 'Desktop', priority: 40 },
};
