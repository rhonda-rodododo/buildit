/**
 * Tauri Window management hook
 * Provides unified interface for window operations with browser fallbacks
 */

import { useCallback, useEffect, useState } from 'react';
import { useTauri } from './useTauri';
import { TAURI_STORAGE_KEYS, FILE_PREVIEW_WINDOW_DIMENSIONS } from './constants';
import type { WindowOptions, WindowState } from './types';

/**
 * Get current window state
 */
async function getCurrentWindowState(): Promise<WindowState | null> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    const [isMaximized, isMinimized, isFocused, isVisible, position, size] = await Promise.all([
      win.isMaximized(),
      win.isMinimized(),
      win.isFocused(),
      win.isVisible(),
      win.outerPosition(),
      win.outerSize(),
    ]);

    return {
      isMaximized,
      isMinimized,
      isFocused,
      isVisible,
      position: { x: position.x, y: position.y },
      size: { width: size.width, height: size.height },
    };
  } catch {
    return null;
  }
}

/**
 * Save window state to localStorage
 */
function saveWindowState(state: WindowState) {
  try {
    localStorage.setItem(TAURI_STORAGE_KEYS.WINDOW_STATE, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load window state from localStorage
 */
function loadWindowState(): WindowState | null {
  try {
    const stored = localStorage.getItem(TAURI_STORAGE_KEYS.WINDOW_STATE);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Hook for Tauri window management
 *
 * @example
 * ```tsx
 * function WindowControls() {
 *   const { minimize, maximize, close, toggleFullscreen } = useTauriWindow();
 *
 *   return (
 *     <div className="window-controls">
 *       <button onClick={minimize}>-</button>
 *       <button onClick={maximize}>□</button>
 *       <button onClick={close}>×</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTauriWindow() {
  const { isTauri } = useTauri();
  const [windowState, setWindowState] = useState<WindowState | null>(null);

  // Track window state changes
  useEffect(() => {
    if (!isTauri) return;

    const updateState = async () => {
      const state = await getCurrentWindowState();
      if (state) {
        setWindowState(state);
        saveWindowState(state);
      }
    };

    // Initial state
    updateState();

    // Listen for window events
    let unlisten: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();

        const unlisteners = await Promise.all([
          win.onMoved(updateState),
          win.onResized(updateState),
          win.onFocusChanged(updateState),
        ]);

        unlisten = () => unlisteners.forEach((u) => u());
      } catch {
        // Ignore errors
      }
    };

    setupListeners();

    return () => {
      unlisten?.();
    };
  }, [isTauri]);

  /**
   * Minimize the current window
   */
  const minimize = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  /**
   * Maximize or restore the current window
   */
  const maximize = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  /**
   * Close the current window
   */
  const close = useCallback(async () => {
    if (!isTauri) {
      window.close();
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  }, [isTauri]);

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(async () => {
    if (!isTauri) {
      // Browser fullscreen API
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFullscreen = await win.isFullscreen();
      await win.setFullscreen(!isFullscreen);
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  /**
   * Set window always on top
   */
  const setAlwaysOnTop = useCallback(
    async (alwaysOnTop: boolean) => {
      if (!isTauri) return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
      } catch {
        // Ignore errors
      }
    },
    [isTauri]
  );

  /**
   * Focus the current window
   */
  const focus = useCallback(async () => {
    if (!isTauri) {
      window.focus();
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFocus();
    } catch {
      window.focus();
    }
  }, [isTauri]);

  /**
   * Show the window (if hidden)
   */
  const show = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().show();
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  /**
   * Hide the window (minimize to tray)
   */
  const hide = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  /**
   * Create a new window
   */
  const createWindow = useCallback(
    async (options: WindowOptions) => {
      if (!isTauri) {
        // Browser fallback - open in new tab/window
        window.open(options.url, options.label, 'noopener,noreferrer');
        return null;
      }

      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        const webview = new WebviewWindow(options.label, {
          url: options.url,
          title: options.title,
          width: options.width,
          height: options.height,
          minWidth: options.minWidth,
          minHeight: options.minHeight,
          resizable: options.resizable ?? true,
          center: options.center ?? true,
          x: options.x,
          y: options.y,
          alwaysOnTop: options.alwaysOnTop ?? false,
          focus: options.focus ?? true,
        });

        return webview;
      } catch {
        // Fallback to browser
        window.open(options.url, options.label, 'noopener,noreferrer');
        return null;
      }
    },
    [isTauri]
  );

  /**
   * Open file preview in a new window (Tauri) or new tab (browser)
   */
  const openFilePreview = useCallback(
    async (fileId: string, fileName?: string) => {
      const url = `/app/files/${fileId}`;
      const label = `file-preview-${fileId}`;

      return createWindow({
        label,
        url,
        title: fileName ? `Preview: ${fileName}` : 'File Preview',
        ...FILE_PREVIEW_WINDOW_DIMENSIONS,
        resizable: true,
        center: true,
      });
    },
    [createWindow]
  );

  /**
   * Restore window state from storage
   */
  const restoreWindowState = useCallback(async () => {
    if (!isTauri) return;

    const savedState = loadWindowState();
    if (!savedState) return;

    try {
      const { getCurrentWindow, PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      // Restore position and size
      await win.setPosition(new PhysicalPosition(savedState.position.x, savedState.position.y));
      await win.setSize(new PhysicalSize(savedState.size.width, savedState.size.height));

      // Restore maximized state
      if (savedState.isMaximized) {
        await win.maximize();
      }
    } catch {
      // Ignore errors
    }
  }, [isTauri]);

  return {
    /** Current window state */
    windowState,
    /** Minimize window */
    minimize,
    /** Maximize/restore window */
    maximize,
    /** Close window */
    close,
    /** Toggle fullscreen */
    toggleFullscreen,
    /** Set always on top */
    setAlwaysOnTop,
    /** Focus window */
    focus,
    /** Show window */
    show,
    /** Hide window */
    hide,
    /** Create new window */
    createWindow,
    /** Open file preview window */
    openFilePreview,
    /** Restore window state from storage */
    restoreWindowState,
    /** Whether window operations are available */
    isAvailable: isTauri,
  };
}

export default useTauriWindow;
