/**
 * Search Store
 * Zustand store for global search state management
 */

import { create } from 'zustand';
import type {
  SearchScope,
  SearchResults,
  FacetFilters,
  RecentSearch,
  SavedSearch,
} from './types';
import type { DBRecentSearch, DBSavedSearch } from './schema';
import { serializeScope, deserializeScope, serializeFilters, deserializeFilters } from './schema';
import { getDB } from '@/core/storage/db';
import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface SearchState {
  // Dialog state
  isDialogOpen: boolean;
  dialogQuery: string;
  dialogScope: SearchScope;

  // Current search state
  currentQuery: string;
  currentScope: SearchScope;
  currentFilters: FacetFilters;
  currentResults: SearchResults | null;
  isSearching: boolean;

  // History
  recentSearches: RecentSearch[];
  savedSearches: SavedSearch[];

  // Settings
  semanticEnabled: boolean;
  defaultScope: 'global' | 'current-group';

  // Actions - Dialog
  openDialog: (query?: string, scope?: SearchScope) => void;
  closeDialog: () => void;
  setDialogQuery: (query: string) => void;
  setDialogScope: (scope: SearchScope) => void;

  // Actions - Search
  setCurrentQuery: (query: string) => void;
  setCurrentScope: (scope: SearchScope) => void;
  setCurrentFilters: (filters: FacetFilters) => void;
  setCurrentResults: (results: SearchResults | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  clearCurrentSearch: () => void;

  // Actions - History
  addRecentSearch: (query: string, scope: SearchScope, resultCount: number, userPubkey: string) => Promise<void>;
  clearRecentSearches: (userPubkey: string) => Promise<void>;
  loadRecentSearches: (userPubkey: string) => Promise<void>;

  // Actions - Saved Searches
  saveSearch: (name: string, query: string, scope: SearchScope, filters: FacetFilters, userPubkey: string) => Promise<SavedSearch>;
  deleteSavedSearch: (id: string) => Promise<void>;
  loadSavedSearches: (userPubkey: string) => Promise<void>;
  updateSavedSearchUsage: (id: string) => Promise<void>;

  // Actions - Settings
  setSemanticEnabled: (enabled: boolean) => void;
  setDefaultScope: (scope: 'global' | 'current-group') => void;
}

// ============================================================================
// Store
// ============================================================================

export const useSearchStore = create<SearchState>()((set, get) => ({
  // Initial state
  isDialogOpen: false,
  dialogQuery: '',
  dialogScope: { type: 'global' },

  currentQuery: '',
  currentScope: { type: 'global' },
  currentFilters: {},
  currentResults: null,
  isSearching: false,

  recentSearches: [],
  savedSearches: [],

  semanticEnabled: false,
  defaultScope: 'global',

  // Dialog actions
  openDialog: (query = '', scope) => {
    set({
      isDialogOpen: true,
      dialogQuery: query,
      dialogScope: scope || get().currentScope,
    });
  },

  closeDialog: () => {
    set({ isDialogOpen: false });
  },

  setDialogQuery: (query) => {
    set({ dialogQuery: query });
  },

  setDialogScope: (scope) => {
    set({ dialogScope: scope });
  },

  // Search actions
  setCurrentQuery: (query) => {
    set({ currentQuery: query });
  },

  setCurrentScope: (scope) => {
    set({ currentScope: scope });
  },

  setCurrentFilters: (filters) => {
    set({ currentFilters: filters });
  },

  setCurrentResults: (results) => {
    set({ currentResults: results });
  },

  setIsSearching: (isSearching) => {
    set({ isSearching });
  },

  clearCurrentSearch: () => {
    set({
      currentQuery: '',
      currentFilters: {},
      currentResults: null,
    });
  },

  // History actions
  addRecentSearch: async (query, scope, resultCount, userPubkey) => {
    const db = getDB();
    if (!db.recentSearches) return;

    try {
      const recentSearch: DBRecentSearch = {
        id: nanoid(),
        userPubkey,
        query,
        scope: serializeScope(scope),
        timestamp: Date.now(),
        resultCount,
      };

      await db.recentSearches.add(recentSearch);

      // Keep only last 50 searches
      const count = await db.recentSearches
        .where('userPubkey')
        .equals(userPubkey)
        .count();

      if (count > 50) {
        const oldest = await db.recentSearches
          .where('userPubkey')
          .equals(userPubkey)
          .sortBy('timestamp');

        const toDelete = oldest.slice(0, count - 50);
        await db.recentSearches.bulkDelete(toDelete.map((r) => r.id));
      }

      // Update state
      await get().loadRecentSearches(userPubkey);
    } catch (error) {
      logger.error('Failed to add recent search:', error);
    }
  },

  clearRecentSearches: async (userPubkey) => {
    const db = getDB();
    if (!db.recentSearches) return;

    try {
      await db.recentSearches.where('userPubkey').equals(userPubkey).delete();
      set({ recentSearches: [] });
    } catch (error) {
      logger.error('Failed to clear recent searches:', error);
    }
  },

  loadRecentSearches: async (userPubkey) => {
    const db = getDB();
    if (!db.recentSearches) return;

    try {
      const dbRecent = await db.recentSearches
        .where('userPubkey')
        .equals(userPubkey)
        .reverse()
        .sortBy('timestamp');

      const recentSearches: RecentSearch[] = dbRecent.slice(0, 20).map((r) => ({
        id: r.id,
        userPubkey: r.userPubkey,
        query: r.query,
        scope: deserializeScope(r.scope),
        timestamp: r.timestamp,
        resultCount: r.resultCount,
      }));

      set({ recentSearches });
    } catch (error) {
      logger.error('Failed to load recent searches:', error);
    }
  },

  // Saved search actions
  saveSearch: async (name, query, scope, filters, userPubkey) => {
    const db = getDB();
    if (!db.savedSearches) {
      throw new Error('Saved searches table not initialized');
    }

    const now = Date.now();
    const savedSearch: DBSavedSearch = {
      id: nanoid(),
      userPubkey,
      name,
      query,
      scope: serializeScope(scope),
      filters: serializeFilters(filters),
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };

    await db.savedSearches.add(savedSearch);

    const result: SavedSearch = {
      id: savedSearch.id,
      userPubkey,
      name,
      query,
      scope,
      filters,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };

    // Update state
    await get().loadSavedSearches(userPubkey);

    return result;
  },

  deleteSavedSearch: async (id) => {
    const db = getDB();
    if (!db.savedSearches) return;

    try {
      await db.savedSearches.delete(id);
      set((state) => ({
        savedSearches: state.savedSearches.filter((s) => s.id !== id),
      }));
    } catch (error) {
      logger.error('Failed to delete saved search:', error);
    }
  },

  loadSavedSearches: async (userPubkey) => {
    const db = getDB();
    if (!db.savedSearches) return;

    try {
      const dbSaved = await db.savedSearches
        .where('userPubkey')
        .equals(userPubkey)
        .toArray();

      const savedSearches: SavedSearch[] = dbSaved.map((s) => ({
        id: s.id,
        userPubkey: s.userPubkey,
        name: s.name,
        query: s.query,
        scope: deserializeScope(s.scope),
        filters: deserializeFilters(s.filters),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastUsedAt: s.lastUsedAt,
        useCount: s.useCount,
      }));

      set({ savedSearches });
    } catch (error) {
      logger.error('Failed to load saved searches:', error);
    }
  },

  updateSavedSearchUsage: async (id) => {
    const db = getDB();
    if (!db.savedSearches) return;

    try {
      const saved = await db.savedSearches.get(id);
      if (saved) {
        await db.savedSearches.update(id, {
          lastUsedAt: Date.now(),
          useCount: saved.useCount + 1,
        });
      }
    } catch (error) {
      logger.error('Failed to update saved search usage:', error);
    }
  },

  // Settings actions
  setSemanticEnabled: (enabled) => {
    set({ semanticEnabled: enabled });
  },

  setDefaultScope: (scope) => {
    set({ defaultScope: scope });
  },
}));

export default useSearchStore;
