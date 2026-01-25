/**
 * ExternalLink Component
 *
 * A unified component for external links that works in both
 * browser and Tauri desktop environments.
 *
 * In Tauri: Opens URL using the shell plugin
 * In Browser: Opens URL in a new tab
 */

import { type FC, type ReactNode, type AnchorHTMLAttributes, useCallback } from 'react';
import { useTauriShell } from '@/lib/tauri';
import { cn } from '@/lib/utils';

interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> {
  /** URL to open */
  href: string;
  /** Content to render */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Called when the link is clicked (before opening) */
  onClick?: () => void;
  /** Whether to show external link indicator */
  showExternalIcon?: boolean;
}

/**
 * ExternalLink renders an anchor that opens in the default browser
 *
 * @example
 * ```tsx
 * <ExternalLink href="https://example.com">
 *   Visit Example
 * </ExternalLink>
 * ```
 */
export const ExternalLink: FC<ExternalLinkProps> = ({
  href,
  children,
  className,
  onClick,
  showExternalIcon = false,
  ...props
}) => {
  const { openUrl } = useTauriShell();

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onClick?.();
      await openUrl(href);
    },
    [href, onClick, openUrl]
  );

  return (
    <a
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1',
        className
      )}
      {...props}
    >
      {children}
      {showExternalIcon && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 opacity-70"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" x2="21" y1="14" y2="3" />
        </svg>
      )}
    </a>
  );
};

/**
 * Hook to get an external link handler for imperative usage
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const openExternal = useExternalLink();
 *
 *   return (
 *     <Button onClick={() => openExternal('https://example.com')}>
 *       Open Example
 *     </Button>
 *   );
 * }
 * ```
 */
export function useExternalLink() {
  const { openUrl, openEmail, openPath } = useTauriShell();

  return {
    /** Open a URL in the default browser */
    openUrl,
    /** Open email client with mailto link */
    openEmail,
    /** Open a file path (Tauri only) */
    openPath,
  };
}

export default ExternalLink;
