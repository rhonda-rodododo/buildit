/**
 * Listing search hook with debounce and filters
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMarketplaceStore } from '../marketplaceStore';
import { useGroupContext } from '@/contexts/GroupContext';
import type { Listing, ListingType, ListingSortBy } from '../types';

const DEBOUNCE_MS = 300;

interface UseListingSearchOptions {
  initialType?: ListingType;
  initialSortBy?: ListingSortBy;
}

interface UseListingSearchResult {
  results: Listing[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  listingType: ListingType | undefined;
  setListingType: (type: ListingType | undefined) => void;
  sortBy: ListingSortBy;
  setSortBy: (sort: ListingSortBy) => void;
  priceMin: number | undefined;
  setPriceMin: (min: number | undefined) => void;
  priceMax: number | undefined;
  setPriceMax: (max: number | undefined) => void;
  isSearching: boolean;
  totalCount: number;
  clearSearch: () => void;
}

export function useListingSearch(options: UseListingSearchOptions = {}): UseListingSearchResult {
  const { groupId } = useGroupContext();
  const setFilters = useMarketplaceStore((s) => s.setFilters);
  const resetFilters = useMarketplaceStore((s) => s.resetFilters);
  const getFilteredListings = useMarketplaceStore((s) => s.getFilteredListings);
  const getActiveListings = useMarketplaceStore((s) => s.getActiveListings);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [listingType, setListingType] = useState<ListingType | undefined>(options.initialType);
  const [sortBy, setSortBy] = useState<ListingSortBy>(options.initialSortBy ?? 'newest');
  const [priceMin, setPriceMin] = useState<number | undefined>();
  const [priceMax, setPriceMax] = useState<number | undefined>();
  const [isSearching, setIsSearching] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    setIsSearching(true);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Sync filters to store
  useEffect(() => {
    setFilters({
      search: debouncedQuery,
      listingType,
      sortBy,
      priceMin,
      priceMax,
    });
  }, [debouncedQuery, listingType, sortBy, priceMin, priceMax, setFilters]);

  const results = useMemo(() => getFilteredListings(groupId), [getFilteredListings, groupId]);
  const totalCount = useMemo(() => getActiveListings(groupId).length, [getActiveListings, groupId]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setListingType(undefined);
    setSortBy('newest');
    setPriceMin(undefined);
    setPriceMax(undefined);
    resetFilters();
  }, [resetFilters]);

  return {
    results,
    searchQuery,
    setSearchQuery,
    listingType,
    setListingType,
    sortBy,
    setSortBy,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    isSearching,
    totalCount,
    clearSearch,
  };
}
