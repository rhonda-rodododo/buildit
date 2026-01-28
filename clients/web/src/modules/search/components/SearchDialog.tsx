/**
 * Search Dialog Component
 * Global search modal with faceted filtering (Cmd+K)
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SearchScope, SearchResults as SearchResultsType, FacetFilters, SearchResult } from '../types';
import { getSearchCoordinator } from '../services';
import SearchResultsComponent from './SearchResults';
import FacetPanel from './FacetPanel';

// ============================================================================
// Types
// ============================================================================

interface SearchDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Initial search query */
  initialQuery?: string;
  /** Initial scope (determined by context) */
  initialScope?: SearchScope;
  /** Current group ID (for context-aware scoping) */
  currentGroupId?: string;
  /** Current group name */
  currentGroupName?: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Search Dialog Component
// ============================================================================

export function SearchDialog({
  open,
  onOpenChange,
  initialQuery = '',
  initialScope,
  currentGroupId,
  currentGroupName,
}: SearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(
    initialScope || (currentGroupId ? { type: 'group', groupId: currentGroupId } : { type: 'global' })
  );
  const [filters, setFilters] = useState<FacetFilters>({});
  const [results, setResults] = useState<SearchResultsType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [semanticEnabled, setSemanticEnabled] = useState(false);

  // Debounced query for search
  const debouncedQuery = useDebounce(query, 300);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.moduleTypes?.length) count += filters.moduleTypes.length;
    if (filters.groupIds?.length) count += filters.groupIds.length;
    if (filters.tags?.length) count += filters.tags.length;
    if (filters.authors?.length) count += filters.authors.length;
    if (filters.dateRange) count += 1;
    return count;
  }, [filters]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setScope(
        initialScope || (currentGroupId ? { type: 'group', groupId: currentGroupId } : { type: 'global' })
      );
      setFilters({});
      setResults(null);
    }
  }, [open, initialQuery, initialScope, currentGroupId]);

  // Perform search when query or filters change
  useEffect(() => {
    if (!open) return;

    const performSearch = async () => {
      if (!debouncedQuery.trim() && activeFilterCount === 0) {
        setResults(null);
        return;
      }

      setIsSearching(true);

      try {
        const coordinator = getSearchCoordinator();
        const searchResults = await coordinator.search(
          debouncedQuery,
          scope,
          filters,
          {
            limit: 50,
            semantic: semanticEnabled,
            highlight: true,
          }
        );
        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [open, debouncedQuery, scope, filters, activeFilterCount, semanticEnabled]);

  // Get suggestions when typing
  useEffect(() => {
    if (!open || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const coordinator = getSearchCoordinator();
    const newSuggestions = coordinator.getSuggestions(query, 5);
    setSuggestions(newSuggestions);
  }, [open, query]);

  // Handle result click
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      const coordinator = getSearchCoordinator();
      const formatted = coordinator.formatResult(result);

      // Close dialog and navigate
      onOpenChange(false);

      // Navigate to result
      navigate(formatted.path);
    },
    [navigate, onOpenChange]
  );

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setQuery(suggestion);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes the dialog (handled by Dialog component)
      // Cmd/Ctrl+F toggles filters panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFilters((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 gap-0 overflow-hidden"
        fullScreenMobile={true}
      >
        {/* Search Header */}
        <div className="border-b">
          <div className="flex items-center px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search:placeholder', 'Search everything...')}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Scope and Filter Toggles */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-4">
              {/* Scope Selector */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('search:scope.label', 'Scope:')}</span>
                <select
                  value={scope.type === 'group' ? 'group' : 'global'}
                  onChange={(e) => {
                    if (e.target.value === 'global') {
                      setScope({ type: 'global' });
                    } else if (currentGroupId) {
                      setScope({ type: 'group', groupId: currentGroupId });
                    }
                  }}
                  className="bg-transparent border rounded px-2 py-1 text-sm"
                >
                  <option value="global">{t('search:scope.global', 'All groups')}</option>
                  {currentGroupId && (
                    <option value="group">
                      {currentGroupName || t('search:scope.currentGroup', 'Current group')}
                    </option>
                  )}
                </select>
              </div>

              {/* Semantic Search Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="semantic-search"
                  checked={semanticEnabled}
                  onCheckedChange={setSemanticEnabled}
                />
                <Label htmlFor="semantic-search" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('search:semantic', 'Smart search')}
                </Label>
              </div>
            </div>

            {/* Filter Toggle (Desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant={showFilters ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1"
              >
                <Filter className="h-4 w-4" />
                {t('search:filters.title', 'Filters')}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Toggle (Mobile) */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" className="gap-1">
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>{t('search:filters.title', 'Filters')}</SheetTitle>
                </SheetHeader>
                {results && (
                  <FacetPanel
                    facetCounts={results.facetCounts}
                    filters={filters}
                    onFiltersChange={setFilters}
                    className="mt-4"
                  />
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex h-[60vh] md:h-[400px]">
          {/* Results */}
          <div className={cn('flex-1 overflow-hidden', showFilters && 'md:border-r')}>
            {/* Suggestions */}
            {suggestions.length > 0 && !results && (
              <div className="p-2 border-b">
                <p className="text-xs text-muted-foreground px-2 mb-1">
                  {t('search:suggestions', 'Suggestions')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="px-2 py-1 text-sm bg-muted rounded hover:bg-accent transition-colors"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            <SearchResultsComponent
              results={results?.results || []}
              totalCount={results?.totalCount || 0}
              isLoading={isSearching}
              searchTimeMs={results?.searchTimeMs}
              onResultClick={handleResultClick}
              query={query}
              maxHeight="100%"
            />
          </div>

          {/* Filters Panel (Desktop) */}
          {showFilters && results && (
            <div className="hidden md:block w-64 p-4 overflow-auto">
              <FacetPanel
                facetCounts={results.facetCounts}
                filters={filters}
                onFiltersChange={setFilters}
                collapsible={true}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> {t('search:shortcuts.navigate', 'navigate')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> {t('search:shortcuts.select', 'select')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded">esc</kbd> {t('search:shortcuts.close', 'close')}
            </span>
          </div>
          <div className="hidden md:block">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">⌘F</kbd> {t('search:shortcuts.toggleFilters', 'toggle filters')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SearchDialog;
