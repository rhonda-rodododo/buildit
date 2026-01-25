/**
 * useDexieQuery Hook
 * Provides reactive data access from Dexie/IndexedDB
 *
 * This hook enables the "Dexie as sole source of truth" pattern by:
 * 1. Subscribing to Dexie table changes via liveQuery
 * 2. Returning reactive data that updates when the table changes
 * 3. Allowing components to directly query Dexie with automatic re-rendering
 *
 * Usage:
 * ```tsx
 * // Simple table query
 * const groups = useDexieQuery(
 *   () => db.groups.toArray(),
 *   [], // default value
 *   [userPubkey] // deps
 * );
 *
 * // Filtered query
 * const friends = useDexieQuery(
 *   () => db.friends.where('userPubkey').equals(userPubkey).toArray(),
 *   [],
 *   [userPubkey]
 * );
 *
 * // With transformation
 * const friendCount = useDexieQuery(
 *   async () => {
 *     const friends = await db.friends.where('userPubkey').equals(userPubkey).toArray();
 *     return friends.length;
 *   },
 *   0,
 *   [userPubkey]
 * );
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { liveQuery } from 'dexie';
import type { Observable } from 'dexie';

/**
 * Query function type
 */
type QueryFn<T> = () => T | Promise<T>;

/**
 * Hook options
 */
interface UseDexieQueryOptions {
  /**
   * Whether the query should be disabled
   * Useful for conditional queries
   */
  enabled?: boolean;
}

/**
 * Hook result type
 */
interface UseDexieQueryResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for reactive Dexie queries
 *
 * @param queryFn - The query function to execute
 * @param defaultValue - Default value while loading
 * @param deps - Dependencies that trigger re-query when changed
 * @param options - Query options
 * @returns Query result with data, loading state, error, and refetch function
 */
export function useDexieQuery<T>(
  queryFn: QueryFn<T>,
  defaultValue: T,
  deps: React.DependencyList = [],
  options: UseDexieQueryOptions = {}
): UseDexieQueryResult<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track subscription
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Refetch counter to force re-subscription
  const [refetchCounter, setRefetchCounter] = useState(0);

  const refetch = useCallback(() => {
    setRefetchCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    // Don't run if disabled
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create observable from query function
    const observable: Observable<T> = liveQuery(queryFn);

    // Subscribe to changes
    const subscription = observable.subscribe({
      next: (value) => {
        setData(value);
        setIsLoading(false);
        setError(null);
      },
      error: (err) => {
        console.error('useDexieQuery error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    subscriptionRef.current = subscription;

    // Cleanup
    return () => {
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [enabled, refetchCounter, ...deps]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook for a single Dexie record by primary key
 *
 * @param tableName - The table name
 * @param primaryKey - The primary key value
 * @param defaultValue - Default value while loading
 * @returns Query result
 */
export function useDexieRecord<T>(
  queryFn: () => Promise<T | undefined>,
  defaultValue: T | undefined = undefined,
  deps: React.DependencyList = []
): UseDexieQueryResult<T | undefined> {
  return useDexieQuery(queryFn, defaultValue, deps);
}

/**
 * Hook for counting records in a Dexie table
 *
 * @param queryFn - Count query function
 * @param deps - Dependencies
 * @returns Count result
 */
export function useDexieCount(
  queryFn: () => Promise<number>,
  deps: React.DependencyList = []
): UseDexieQueryResult<number> {
  return useDexieQuery(queryFn, 0, deps);
}

/**
 * Hook for checking if any records exist
 *
 * @param queryFn - Query function that returns first match
 * @param deps - Dependencies
 * @returns Boolean result
 */
export function useDexieExists(
  queryFn: () => Promise<unknown>,
  deps: React.DependencyList = []
): UseDexieQueryResult<boolean> {
  const wrappedQuery = useCallback(async () => {
    const result = await queryFn();
    return result !== undefined && result !== null;
  }, [queryFn]);

  return useDexieQuery(wrappedQuery, false, deps);
}

/**
 * Hook for paginated Dexie queries
 *
 * @param queryFn - Query function that accepts offset and limit
 * @param pageSize - Number of items per page
 * @param deps - Dependencies
 * @returns Paginated result with navigation functions
 */
export function useDexiePaginated<T>(
  queryFn: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number = 20,
  deps: React.DependencyList = []
) {
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const paginatedQuery = useCallback(async () => {
    const results = await queryFn(page * pageSize, pageSize + 1);
    setHasMore(results.length > pageSize);
    return results.slice(0, pageSize);
  }, [queryFn, page, pageSize]);

  const result = useDexieQuery<T[]>(paginatedQuery, [], [page, ...deps]);

  return {
    ...result,
    page,
    pageSize,
    hasMore,
    nextPage: () => hasMore && setPage((p) => p + 1),
    prevPage: () => page > 0 && setPage((p) => p - 1),
    goToPage: (p: number) => setPage(Math.max(0, p)),
  };
}

export default useDexieQuery;
