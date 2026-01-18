/**
 * PullToRefresh Component
 * Wraps content to add pull-to-refresh functionality on mobile
 */

import { FC, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePullToRefresh, useIsTouchDevice } from '@/hooks/useMobile';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  /** Callback function to refresh data */
  onRefresh: () => Promise<void>;
  /** Enable/disable pull to refresh */
  enabled?: boolean;
  /** Pull distance threshold to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 120) */
  maxPull?: number;
  /** Custom loading indicator */
  loadingIndicator?: ReactNode;
  /** Additional class names for the container */
  className?: string;
}

export const PullToRefresh: FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  enabled = true,
  threshold = 80,
  maxPull = 120,
  loadingIndicator,
  className,
}) => {
  const isTouch = useIsTouchDevice();
  const {
    pullDistance,
    isPulling,
    isRefreshing,
    handlers,
  } = usePullToRefresh(onRefresh, {
    threshold,
    maxPull,
    enabled: enabled && isTouch,
  });

  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShowIndicator = pullDistance > 10 || isRefreshing;

  // Don't add touch handlers on non-touch devices
  const touchHandlers = isTouch && enabled ? handlers : {};

  return (
    <div
      className={cn('relative', className)}
      data-pull-refresh
      {...touchHandlers}
    >
      {/* Pull indicator */}
      {shouldShowIndicator && (
        <div
          className={cn(
            'absolute left-0 right-0 flex items-center justify-center transition-opacity pointer-events-none z-10',
            isRefreshing ? 'opacity-100' : 'opacity-80'
          )}
          style={{
            top: 0,
            height: `${Math.max(pullDistance, isRefreshing ? 56 : 0)}px`,
          }}
          aria-live="polite"
          aria-busy={isRefreshing}
        >
          <div
            className={cn(
              'flex flex-col items-center justify-center transition-transform',
              isRefreshing && 'animate-pulse'
            )}
            style={{
              transform: `scale(${0.5 + progress * 0.5})`,
            }}
          >
            {isRefreshing ? (
              loadingIndicator || (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Refreshing...</span>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ArrowDown
                  className={cn(
                    'h-6 w-6 text-muted-foreground transition-transform',
                    progress >= 1 && 'rotate-180 text-primary'
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        className="transition-transform"
        style={{
          transform: shouldShowIndicator
            ? `translateY(${Math.max(pullDistance, isRefreshing ? 56 : 0)}px)`
            : 'translateY(0)',
          transitionDuration: isPulling ? '0ms' : '200ms',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Example usage:
 *
 * <PullToRefresh onRefresh={async () => {
 *   await fetchLatestData();
 * }}>
 *   <div className="space-y-4">
 *     {items.map(item => <ItemCard key={item.id} {...item} />)}
 *   </div>
 * </PullToRefresh>
 */
