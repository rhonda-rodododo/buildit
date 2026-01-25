/**
 * ResponsiveImage Component
 * Optimized image loading for mobile with lazy loading,
 * placeholder, and responsive sizing
 */

import { FC, useState, useRef, useEffect, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ImageOff, Loader2 } from 'lucide-react';

interface ResponsiveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  /** Source URL for the image */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Aspect ratio (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Blur placeholder data URL */
  blurDataURL?: string;
  /** Enable lazy loading (default: true) */
  lazy?: boolean;
  /** Root margin for lazy loading (default: "100px") */
  rootMargin?: string;
  /** Show loading spinner */
  showSpinner?: boolean;
  /** Fallback component when image fails to load */
  fallback?: React.ReactNode;
  /** Container class name */
  containerClassName?: string;
  /** Callback when image loads successfully */
  onLoadComplete?: () => void;
  /** Callback when image fails to load */
  onLoadError?: (error: Error) => void;
}

export const ResponsiveImage: FC<ResponsiveImageProps> = ({
  src,
  alt,
  aspectRatio,
  blurDataURL,
  lazy = true,
  rootMargin = '100px',
  showSpinner = true,
  fallback,
  containerClassName,
  className,
  onLoadComplete,
  onLoadError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (!lazy) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [lazy, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoadComplete?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onLoadError?.(new Error('Failed to load image'));
  };

  // Note: srcset generation is disabled by default
  // Enable for CDN-hosted images that support width parameters

  const aspectRatioStyle = aspectRatio
    ? { aspectRatio: aspectRatio.replace('/', ' / ') }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={aspectRatioStyle}
    >
      {/* Blur placeholder */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg"
        />
      )}

      {/* Loading spinner */}
      {!isLoaded && showSpinner && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        fallback || (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 mb-2" />
            <span className="text-sm">Failed to load</span>
          </div>
        )
      )}

      {/* Main image */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      )}
    </div>
  );
};

/**
 * Avatar variant for profile images
 */
interface ResponsiveAvatarProps {
  src?: string;
  alt: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export const ResponsiveAvatar: FC<ResponsiveAvatarProps> = ({
  src,
  alt,
  fallbackText,
  size = 'md',
  className,
}) => {
  const [hasError, setHasError] = useState(false);

  const initials = fallbackText
    ? fallbackText
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : alt.slice(0, 2).toUpperCase();

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium',
          avatarSizes[size],
          className
        )}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={cn(
        'rounded-full object-cover',
        avatarSizes[size],
        className
      )}
    />
  );
};

/**
 * Example usage:
 *
 * <ResponsiveImage
 *   src="/images/hero.jpg"
 *   alt="Hero image"
 *   aspectRatio="16/9"
 *   className="rounded-lg"
 * />
 *
 * <ResponsiveAvatar
 *   src={user.avatarUrl}
 *   alt={user.name}
 *   fallbackText={user.name}
 *   size="lg"
 * />
 */
