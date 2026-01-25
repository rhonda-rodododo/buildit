/**
 * Tauri Shell hook for opening external URLs
 * Provides unified interface that falls back to window.open in browser
 */

import { useCallback } from 'react';
import { useTauri } from './useTauri';
import type { OpenResult } from './types';

/**
 * Open URL using Tauri shell or browser fallback
 */
async function openExternal(url: string, isTauri: boolean): Promise<OpenResult> {
  try {
    if (isTauri) {
      // Dynamic import to avoid bundling Tauri APIs in browser builds
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
      return { success: true };
    } else {
      // Browser fallback
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        return { success: true };
      }
      return { success: false, error: 'Popup blocked' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open URL',
    };
  }
}

/**
 * Hook for opening external URLs
 * Uses Tauri shell:open in desktop app, falls back to window.open in browser
 *
 * @example
 * ```tsx
 * function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
 *   const { openUrl } = useTauriShell();
 *
 *   return (
 *     <a
 *       href={href}
 *       onClick={(e) => {
 *         e.preventDefault();
 *         openUrl(href);
 *       }}
 *     >
 *       {children}
 *     </a>
 *   );
 * }
 * ```
 */
export function useTauriShell() {
  const { isTauri, capabilities } = useTauri();

  /**
   * Open a URL in the default browser/application
   */
  const openUrl = useCallback(
    async (url: string): Promise<OpenResult> => {
      return openExternal(url, isTauri && capabilities.shell);
    },
    [isTauri, capabilities.shell]
  );

  /**
   * Open a file path in the default application
   * Only works in Tauri environment
   */
  const openPath = useCallback(
    async (path: string): Promise<OpenResult> => {
      if (!isTauri || !capabilities.shell) {
        return { success: false, error: 'Not available in browser' };
      }

      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(path);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open path',
        };
      }
    },
    [isTauri, capabilities.shell]
  );

  /**
   * Open email client with mailto link
   */
  const openEmail = useCallback(
    async (email: string, subject?: string, body?: string): Promise<OpenResult> => {
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (body) params.set('body', body);
      const query = params.toString();
      const mailto = `mailto:${email}${query ? `?${query}` : ''}`;
      return openExternal(mailto, isTauri && capabilities.shell);
    },
    [isTauri, capabilities.shell]
  );

  return {
    /** Open URL in default browser */
    openUrl,
    /** Open file path in default application (Tauri only) */
    openPath,
    /** Open email client */
    openEmail,
    /** Whether shell operations are available */
    isAvailable: capabilities.shell,
  };
}

/**
 * Utility component for external links that use Tauri shell
 * Can be used to create a link component that handles both Tauri and browser
 */
export function createExternalLinkHandler(
  isTauri: boolean,
  hasShellCapability: boolean
): (e: React.MouseEvent<HTMLAnchorElement>, url: string) => void {
  return (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (isTauri && hasShellCapability) {
      e.preventDefault();
      openExternal(url, true);
    }
    // In browser, let the default anchor behavior work
  };
}

export default useTauriShell;
