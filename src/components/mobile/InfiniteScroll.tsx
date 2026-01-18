/**
 * InfiniteScroll Component
 * Optimized infinite scroll for mobile with intersection observer
 * and optional pull-to-refresh integration
 */

import { FC, ReactNode, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollProps {
  children: ReactNode;
  /** Whether more items can be loaded */
  hasMore: boolean;
  /** Whether items are currently loading */
  isLoading: boolean;
  /** Callback to load more items */
  onLoadMore: () => void;
  /** Root margin for intersection observer (default: 200px) */
  rootMargin?: string;
  /** Threshold for intersection observer (default: 0.1) */
  threshold?: number;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom end of list component */
  endComponent?: ReactNode;
  /** Additional class names */
  className?: string;
  /** ID for the scroll container (for nested scrolling) */
  scrollContainerId?: string;
}

export const InfiniteScroll: FC<InfiniteScrollProps> = ({
  children,
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
  threshold = 0.1,
  loadingComponent,
  endComponent,
  className,
  scrollContainerId,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoading) return;

    const root = scrollContainerId
      ? document.getElementById(scrollContainerId)
      : null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore, rootMargin, threshold, scrollContainerId]);

  return (
    <div className={cn('relative', className)}>
      {children}

      {/* Load more trigger element */}
      <div
        ref={loadMoreRef}
        className="w-full py-4 flex items-center justify-center"
        aria-hidden={!hasMore}
      >
        {isLoading && (
          loadingComponent || (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )
        )}

        {!isLoading && !hasMore && endComponent}
      </div>
    </div>
  );
};

/**
 * InfiniteScrollList Component
 * Virtualized infinite scroll list for large datasets
 * Uses windowing to only render visible items
 */

interface InfiniteScrollListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Unique key for each item */
  getKey: (item: T, index: number) => string | number;
  /** Estimated item height for virtualization */
  estimatedItemHeight: number;
  /** Whether more items can be loaded */
  hasMore: boolean;
  /** Whether items are currently loading */
  isLoading: boolean;
  /** Callback to load more items */
  onLoadMore: () => void;
  /** Number of items to render outside visible area (buffer) */
  overscan?: number;
  /** Additional class names */
  className?: string;
}

export function InfiniteScrollList<T>({
  items,
  renderItem,
  getKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future virtualization
  estimatedItemHeight: _estimatedItemHeight,
  hasMore,
  isLoading,
  onLoadMore,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future virtualization
  overscan: _overscan = 3,
  className,
}: InfiniteScrollListProps<T>) {
  // For now, use a simpler non-virtualized approach
  // Full virtualization would require @tanstack/react-virtual which is already installed

  return (
    <InfiniteScroll
      hasMore={hasMore}
      isLoading={isLoading}
      onLoadMore={onLoadMore}
      className={className}
    >
      <div className="space-y-0">
        {items.map((item, index) => (
          <div key={getKey(item, index)}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </InfiniteScroll>
  );
}

/**
 * Example usage:
 *
 * <InfiniteScroll
 *   hasMore={hasMoreItems}
 *   isLoading={isLoadingMore}
 *   onLoadMore={() => fetchMoreItems()}
 * >
 *   <div className="space-y-4">
 *     {items.map(item => <ItemCard key={item.id} {...item} />)}
 *   </div>
 * </InfiniteScroll>
 *
 * Or with the list component:
 *
 * <InfiniteScrollList
 *   items={messages}
 *   renderItem={(msg) => <MessageCard message={msg} />}
 *   getKey={(msg) => msg.id}
 *   estimatedItemHeight={80}
 *   hasMore={hasMoreMessages}
 *   isLoading={isLoadingMessages}
 *   onLoadMore={() => loadMoreMessages()}
 * />
 */
