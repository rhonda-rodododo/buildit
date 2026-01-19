import { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type PageLoaderVariant = 'spinner' | 'skeleton' | 'minimal';

interface PageLoaderProps {
  /** Loading variant: spinner (centered), skeleton (content placeholder), minimal (inline) */
  variant?: PageLoaderVariant;
  /** Optional message to display (spinner variant only) */
  message?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Page loading fallback component for React.lazy() Suspense boundaries.
 *
 * Variants:
 * - spinner: Centered spinner with optional message (default)
 * - skeleton: Content-like skeleton placeholders
 * - minimal: Small inline spinner for compact spaces
 */
export const PageLoader: FC<PageLoaderProps> = ({
  variant = 'spinner',
  message,
  className,
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-4 p-4', className)}>
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Card skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: spinner variant
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-3',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      <span className="sr-only">{message || 'Loading...'}</span>
    </div>
  );
};

/**
 * Pre-configured page loader for route suspense boundaries
 */
export const RouteLoader: FC = () => (
  <PageLoader variant="spinner" message="Loading page..." />
);
