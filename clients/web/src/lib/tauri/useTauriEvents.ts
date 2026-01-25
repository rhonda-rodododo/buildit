/**
 * Tauri Events hook for subscribing to backend events
 * Provides unified interface for Tauri event system
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTauri } from './useTauri';
import { TAURI_EVENTS } from './constants';
import type {
  EventCallback,
  UnlistenFn,
  TrayAction,
  UserStatus,
  BLEScanResult,
  WindowState,
} from './types';

/**
 * Subscribe to a Tauri event
 * Returns cleanup function
 */
async function subscribeToEvent<T>(
  eventName: string,
  callback: EventCallback<T>
): Promise<UnlistenFn> {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(eventName, (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    // Return no-op if not in Tauri
    return () => {};
  }
}

/**
 * Hook for subscribing to Tauri events
 *
 * @example
 * ```tsx
 * function DeepLinkHandler() {
 *   const { onDeepLink } = useTauriEvents();
 *
 *   useEffect(() => {
 *     return onDeepLink((url) => {
 *       console.log('Deep link received:', url);
 *       // Handle the deep link
 *     });
 *   }, [onDeepLink]);
 *
 *   return null;
 * }
 * ```
 */
export function useTauriEvents() {
  const { isTauri } = useTauri();
  const unlistenersRef = useRef<Map<string, UnlistenFn>>(new Map());

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
      unlistenersRef.current.clear();
    };
  }, []);

  /**
   * Generic event subscription
   */
  const subscribe = useCallback(
    <T>(eventName: string, callback: EventCallback<T>): UnlistenFn => {
      if (!isTauri) {
        return () => {};
      }

      // Create unique key for this subscription using crypto.randomUUID()
      const key = `${eventName}-${crypto.randomUUID()}`;

      // Subscribe and store unlistener
      subscribeToEvent<T>(eventName, callback).then((unlisten) => {
        unlistenersRef.current.set(key, unlisten);
      });

      // Return cleanup function
      return () => {
        const unlisten = unlistenersRef.current.get(key);
        if (unlisten) {
          unlisten();
          unlistenersRef.current.delete(key);
        }
      };
    },
    [isTauri]
  );

  /**
   * Subscribe to navigation events from tray or deep links
   */
  const onNavigate = useCallback(
    (callback: EventCallback<string>): UnlistenFn => {
      return subscribe<string>(TAURI_EVENTS.NAVIGATE, callback);
    },
    [subscribe]
  );

  /**
   * Subscribe to tray action events
   */
  const onTrayAction = useCallback(
    (callback: EventCallback<TrayAction>): UnlistenFn => {
      return subscribe<TrayAction>(TAURI_EVENTS.TRAY_ACTION, callback);
    },
    [subscribe]
  );

  /**
   * Subscribe to status change events
   */
  const onStatusChange = useCallback(
    (callback: EventCallback<UserStatus>): UnlistenFn => {
      return subscribe<UserStatus>(TAURI_EVENTS.STATUS_CHANGE, callback);
    },
    [subscribe]
  );

  /**
   * Subscribe to deep link events
   */
  const onDeepLink = useCallback(
    (callback: EventCallback<string>): UnlistenFn => {
      return subscribe<string>(TAURI_EVENTS.DEEP_LINK, callback);
    },
    [subscribe]
  );

  /**
   * Subscribe to BLE scan result events
   */
  const onBLEScanResult = useCallback(
    (callback: EventCallback<BLEScanResult>): UnlistenFn => {
      return subscribe<BLEScanResult>(TAURI_EVENTS.BLE_SCAN_RESULT, callback);
    },
    [subscribe]
  );

  /**
   * Subscribe to window state changes
   */
  const onWindowState = useCallback(
    (callback: EventCallback<WindowState>): UnlistenFn => {
      return subscribe<WindowState>(TAURI_EVENTS.WINDOW_STATE, callback);
    },
    [subscribe]
  );

  return {
    /** Generic event subscription */
    subscribe,
    /** Navigation events */
    onNavigate,
    /** Tray action events */
    onTrayAction,
    /** Status change events */
    onStatusChange,
    /** Deep link events */
    onDeepLink,
    /** BLE scan result events */
    onBLEScanResult,
    /** Window state events */
    onWindowState,
    /** Whether events are available */
    isAvailable: isTauri,
  };
}

/**
 * Hook for handling deep links
 * Automatically sets up listener and provides current deep link
 *
 * @example
 * ```tsx
 * function App() {
 *   const navigate = useNavigate();
 *
 *   useDeepLinkHandler((url) => {
 *     // Parse buildit://path/to/resource
 *     const path = url.replace('buildit://', '/');
 *     navigate(path);
 *   });
 *
 *   return <RouterOutlet />;
 * }
 * ```
 */
export function useDeepLinkHandler(handler: (url: string) => void) {
  const { isTauri } = useTauri();
  const { onDeepLink } = useTauriEvents();
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!isTauri) return;

    // Check for initial deep link
    const checkInitialDeepLink = async () => {
      try {
        const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
        const urls = await getCurrent();
        if (urls && urls.length > 0) {
          handlerRef.current(urls[0]);
        }
      } catch {
        // Ignore errors
      }
    };

    checkInitialDeepLink();

    // Subscribe to future deep links
    return onDeepLink((url) => {
      handlerRef.current(url);
    });
  }, [isTauri, onDeepLink]);
}

export default useTauriEvents;
