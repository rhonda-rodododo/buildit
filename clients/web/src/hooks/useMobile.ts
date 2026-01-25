/**
 * Mobile detection and responsive hooks
 * Provides utilities for mobile-first UX
 */

import { useState, useEffect, useCallback } from 'react';

// Breakpoints matching Tailwind defaults
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook to detect if the viewport is mobile-sized
 * Uses matchMedia for performance and updates on resize
 */
export function useIsMobile(breakpoint: Breakpoint = 'md'): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < BREAKPOINTS[breakpoint];
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Initial check
    handleChange(mql);

    // Add listener
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mql.addListener(handleChange);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleChange);
      } else {
        mql.removeListener(handleChange);
      }
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to detect touch device capability
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE-specific
        navigator.msMaxTouchPoints > 0
      );
    };
    setIsTouch(checkTouch());
  }, []);

  return isTouch;
}

/**
 * Hook to get current viewport dimensions
 */
export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

/**
 * Hook for haptic feedback support
 * Uses Vibration API where available
 */
export function useHapticFeedback(): {
  isSupported: boolean;
  vibrate: (pattern?: number | number[]) => void;
  lightTap: () => void;
  mediumTap: () => void;
  heavyTap: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
} {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('vibrate' in navigator);
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if (isSupported && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, [isSupported]);

  const lightTap = useCallback(() => vibrate(5), [vibrate]);
  const mediumTap = useCallback(() => vibrate(10), [vibrate]);
  const heavyTap = useCallback(() => vibrate(20), [vibrate]);
  const success = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
  const warning = useCallback(() => vibrate([20, 50, 20]), [vibrate]);
  const error = useCallback(() => vibrate([50, 100, 50]), [vibrate]);

  return {
    isSupported,
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    warning,
    error,
  };
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: {
    threshold?: number;
    maxPull?: number;
    enabled?: boolean;
  } = {}
): {
  pullDistance: number;
  isPulling: boolean;
  isRefreshing: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
} {
  const { threshold = 80, maxPull = 120, enabled = true } = options;
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;

    // Only enable pull to refresh when at top of scroll container
    const target = e.target as HTMLElement;
    const scrollContainer = target.closest('[data-pull-refresh]') || document.scrollingElement;
    if (scrollContainer && scrollContainer.scrollTop > 0) return;

    setStartY(e.touches[0].clientY);
    setIsPulling(true);
  }, [enabled, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // Only allow pulling down
    if (diff > 0) {
      // Apply resistance to pull
      const resistance = 0.5;
      const adjustedDiff = Math.min(diff * resistance, maxPull);
      setPullDistance(adjustedDiff);
    }
  }, [isPulling, isRefreshing, startY, maxPull]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}

/**
 * Hook for swipe gesture detection
 */
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  options: {
    threshold?: number;
    enabled?: boolean;
  } = {}
): {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  swipeOffset: number;
  isSwiping: boolean;
} {
  const { threshold = 50, enabled = true } = options;
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsSwiping(true);
  }, [enabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    setCurrentX(e.touches[0].clientX);
  }, [isSwiping]);

  const onTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    const diff = currentX - startX;

    if (Math.abs(diff) >= threshold) {
      if (diff > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (diff < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setIsSwiping(false);
    setStartX(0);
    setCurrentX(0);
  }, [isSwiping, currentX, startX, threshold, onSwipeLeft, onSwipeRight]);

  const swipeOffset = isSwiping ? currentX - startX : 0;

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    swipeOffset,
    isSwiping,
  };
}

/**
 * Hook for safe area insets (notch, home indicator, etc.)
 */
export function useSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const computeInsets = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue('--sat') || '0', 10) ||
             parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10) ||
               parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) ||
                parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10) ||
              parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      });
    };

    computeInsets();
    window.addEventListener('resize', computeInsets);
    return () => window.removeEventListener('resize', computeInsets);
  }, []);

  return insets;
}

/**
 * Hook for keyboard visibility on mobile
 */
export function useKeyboardVisible(): boolean {
  const [isVisible, setIsVisible] = useState(false);
  const { height: viewportHeight } = useViewportSize();
  const [initialHeight, setInitialHeight] = useState(0);

  useEffect(() => {
    if (initialHeight === 0 && viewportHeight > 0) {
      setInitialHeight(viewportHeight);
    }
  }, [viewportHeight, initialHeight]);

  useEffect(() => {
    if (initialHeight > 0) {
      // Keyboard is likely visible if viewport shrinks significantly
      const heightDiff = initialHeight - viewportHeight;
      setIsVisible(heightDiff > 150);
    }
  }, [viewportHeight, initialHeight]);

  return isVisible;
}

/**
 * Hook for orientation detection
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    const handleOrientation = () => {
      if (window.screen?.orientation) {
        const type = window.screen.orientation.type;
        setOrientation(type.includes('portrait') ? 'portrait' : 'landscape');
      } else {
        setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
      }
    };

    handleOrientation();

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientation);
    }
    window.addEventListener('resize', handleOrientation);

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientation);
      }
      window.removeEventListener('resize', handleOrientation);
    };
  }, []);

  return orientation;
}
