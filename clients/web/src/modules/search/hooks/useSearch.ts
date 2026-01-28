/**
 * useSearch Hook
 * React hook for search functionality with state management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  SearchScope,
  SearchResults,
  FacetFilters,
  SearchOptions,
  IndexStats,
} from '../types';
import { getSearchCoordinator } from '../services';

// ============================================================================
// Types
// ============================================================================

interface UseSearchOptions {
  /** Initial search query */
  initialQuery?: string;
  /** Initial search scope */
  initialScope?: SearchScope;
  /** Default search options */
  defaultOptions?: SearchOptions;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Enable semantic search */
  semantic?: boolean;
  /** Auto-search when query changes */
  autoSearch?: boolean;
  /** Current group ID for context-aware scoping */
  currentGroupId?: string;
}

interface UseSearchReturn {
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Current search scope */
  scope: SearchScope;
  /** Set search scope */
  setScope: (scope: SearchScope) => void;
  /** Current filters */
  filters: FacetFilters;
  /** Set filters */
  setFilters: (filters: FacetFilters) => void;
  /** Toggle a filter value */
  toggleFilter: (key: keyof FacetFilters, value: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Search results */
  results: SearchResults | null;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Perform search manually */
  search: (query?: string) => Promise<void>;
  /** Autocomplete suggestions */
  suggestions: string[];
  /** Whether semantic search is enabled */
  semanticEnabled: boolean;
  /** Toggle semantic search */
  setSemanticEnabled: (enabled: boolean) => void;
  /** Index statistics */
  stats: IndexStats | null;
  /** Trigger reindex */
  reindex: (groupIds?: string[]) => Promise<void>;
  /** Whether reindexing is in progress */
  isReindexing: boolean;
}

// ============================================================================
// Debounce Hook
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useSearch Hook
// ============================================================================

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    initialQuery = '',
    initialScope,
    defaultOptions = {},
    debounceMs = 300,
    semantic = false,
    autoSearch = true,
    currentGroupId,
  } = options;

  const location = useLocation();

  // State
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(
    initialScope || (currentGroupId ? { type: 'group', groupId: currentGroupId } : { type: 'global' })
  );
  const [filters, setFilters] = useState<FacetFilters>({});
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [semanticEnabled, setSemanticEnabled] = useState(semantic);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  // Debounced query
  const debouncedQuery = useDebounce(query, debounceMs);

  // Refs for cleanup
  const searchAbortController = useRef<AbortController | null>(null);

  // Determine scope from route if not explicitly set
  useEffect(() => {
    if (!initialScope && !currentGroupId) {
      // Check if we're on a group page
      const groupMatch = location.pathname.match(/\/groups\/([^/]+)/);
      if (groupMatch) {
        setScope({ type: 'group', groupId: groupMatch[1] });
      } else {
        setScope({ type: 'global' });
      }
    }
  }, [location.pathname, initialScope, currentGroupId]);

  // Perform search
  const search = useCallback(
    async (searchQuery?: string) => {
      const queryToSearch = searchQuery ?? debouncedQuery;

      // Cancel previous search
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }

      // Skip empty queries without filters
      if (!queryToSearch.trim() && Object.keys(filters).length === 0) {
        setResults(null);
        return;
      }

      setIsSearching(true);
      searchAbortController.current = new AbortController();

      try {
        const coordinator = getSearchCoordinator();
        const searchResults = await coordinator.search(
          queryToSearch,
          scope,
          filters,
          {
            ...defaultOptions,
            semantic: semanticEnabled,
            highlight: true,
          }
        );

        // Check if request was aborted
        if (searchAbortController.current?.signal.aborted) {
          return;
        }

        setResults(searchResults);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search failed:', error);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [debouncedQuery, scope, filters, semanticEnabled, defaultOptions]
  );

  // Auto-search when debounced query changes
  useEffect(() => {
    if (autoSearch) {
      search();
    }
  }, [debouncedQuery, scope, filters, semanticEnabled, autoSearch, search]);

  // Get suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const coordinator = getSearchCoordinator();
    const newSuggestions = coordinator.getSuggestions(query, 5);
    setSuggestions(newSuggestions);
  }, [query]);

  // Toggle filter
  const toggleFilter = useCallback(
    (key: keyof FacetFilters, value: string) => {
      setFilters((prev) => {
        const current = (prev[key] as string[] | undefined) || [];
        const updated = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];

        return {
          ...prev,
          [key]: updated.length > 0 ? updated : undefined,
        };
      });
    },
    []
  );

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const coordinator = getSearchCoordinator();
        const indexStats = await coordinator.getStats();
        setStats(indexStats);
      } catch (error) {
        console.error('Failed to load search stats:', error);
      }
    };

    loadStats();
  }, [results]); // Refresh stats after search

  // Reindex
  const reindex = useCallback(async (groupIds?: string[]) => {
    setIsReindexing(true);
    try {
      const coordinator = getSearchCoordinator();
      await coordinator.reindex(groupIds);

      // Refresh stats
      const indexStats = await coordinator.getStats();
      setStats(indexStats);

      // Re-run current search if there was one
      if (query.trim()) {
        await search();
      }
    } catch (error) {
      console.error('Reindex failed:', error);
      throw error;
    } finally {
      setIsReindexing(false);
    }
  }, [query, search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    scope,
    setScope,
    filters,
    setFilters,
    toggleFilter,
    clearFilters,
    results,
    isSearching,
    search,
    suggestions,
    semanticEnabled,
    setSemanticEnabled,
    stats,
    reindex,
    isReindexing,
  };
}

// ============================================================================
// useSearchDialog Hook
// ============================================================================

interface UseSearchDialogOptions {
  /** Keyboard shortcut to open (default: cmd+k) */
  shortcut?: string;
  /** Current group context */
  currentGroupId?: string;
  currentGroupName?: string;
}

interface UseSearchDialogReturn {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Open the dialog */
  open: (query?: string) => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle the dialog */
  toggle: () => void;
  /** Initial query for dialog */
  initialQuery: string;
  /** Current group context */
  currentGroupId?: string;
  currentGroupName?: string;
}

export function useSearchDialog(options: UseSearchDialogOptions = {}): UseSearchDialogReturn {
  const { shortcut = 'cmd+k', currentGroupId, currentGroupName } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  // Open dialog
  const open = useCallback((query?: string) => {
    setInitialQuery(query || '');
    setIsOpen(true);
  }, []);

  // Close dialog
  const close = useCallback(() => {
    setIsOpen(false);
    setInitialQuery('');
  }, []);

  // Toggle dialog
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse shortcut
      const parts = shortcut.toLowerCase().split('+');
      const key = parts[parts.length - 1];
      const requiresMeta = parts.includes('cmd') || parts.includes('meta');
      const requiresCtrl = parts.includes('ctrl');
      const requiresShift = parts.includes('shift');
      const requiresAlt = parts.includes('alt');

      // Check modifiers
      if (requiresMeta && !e.metaKey) return;
      if (requiresCtrl && !e.ctrlKey) return;
      if (requiresShift && !e.shiftKey) return;
      if (requiresAlt && !e.altKey) return;

      // Check key
      if (e.key.toLowerCase() === key) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    initialQuery,
    currentGroupId,
    currentGroupName,
  };
}

export default useSearch;
