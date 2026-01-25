/**
 * LinkPreviewCard Component
 *
 * Renders a static link preview without making third-party requests.
 * The image and metadata were fetched by the sender and encrypted
 * into the post content.
 *
 * Features:
 * - Static preview from encrypted data
 * - No third-party requests (privacy-preserving)
 * - Responsive design
 * - Click opens link in new tab
 * - Accessible and mobile-friendly
 */

import { FC, useMemo, useCallback } from 'react'
import type { LinkPreview } from './types'
import { ExternalLink, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTauriShell } from '@/lib/tauri'

interface LinkPreviewCardProps {
  /** Link preview data */
  preview: LinkPreview

  /** Additional CSS classes */
  className?: string

  /** Compact mode for inline display */
  compact?: boolean

  /** Whether to show the remove button (for composer) */
  showRemove?: boolean

  /** Callback when remove button is clicked */
  onRemove?: () => void

  /** Callback when card is clicked */
  onClick?: () => void
}

/**
 * Extract domain from URL for display
 */
function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}


/**
 * Convert base64 image data to data URL
 */
function getImageSrc(imageData: string | undefined, imageType: string | undefined): string | null {
  if (!imageData) {
    return null
  }
  const mimeType = imageType || 'image/jpeg'
  return `data:${mimeType};base64,${imageData}`
}

/**
 * LinkPreviewCard renders a static preview without third-party requests
 */
export const LinkPreviewCard: FC<LinkPreviewCardProps> = ({
  preview,
  className,
  compact = false,
  showRemove = false,
  onRemove,
  onClick,
}) => {
  const domain = useMemo(() => getDomainFromUrl(preview.url), [preview.url])
  const imageSrc = useMemo(
    () => getImageSrc(preview.imageData, preview.imageType),
    [preview.imageData, preview.imageType]
  )
  const faviconSrc = useMemo(
    () => getImageSrc(preview.faviconData, preview.faviconType),
    [preview.faviconData, preview.faviconType]
  )
  const { openUrl } = useTauriShell()

  const handleClick = useCallback(() => {
    onClick?.()
    openUrl(preview.url)
  }, [onClick, openUrl, preview.url])

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Compact layout (horizontal)
  if (compact) {
    return (
      <div
        className={cn(
          'group relative flex items-center gap-3 rounded-lg border bg-muted/30 p-3',
          'hover:bg-muted/50 transition-colors cursor-pointer',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={0}
        aria-label={`Open ${preview.title || domain} in new tab`}
      >
        {/* Thumbnail */}
        {imageSrc && (
          <div className="shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
            <img
              src={imageSrc}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          {preview.title && (
            <p className="font-medium text-sm line-clamp-1">
              {preview.title}
            </p>
          )}

          {/* Description */}
          {preview.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {preview.description}
            </p>
          )}

          {/* Domain */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {faviconSrc ? (
              <img src={faviconSrc} alt="" className="w-3 h-3" />
            ) : (
              <Globe className="w-3 h-3" />
            )}
            <span>{domain}</span>
          </div>
        </div>

        {/* Remove button */}
        {showRemove && (
          <button
            onClick={handleRemove}
            className={cn(
              'absolute top-2 right-2 p-1 rounded-full bg-background/80 shadow-sm',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-destructive/10 hover:text-destructive'
            )}
            aria-label="Remove preview"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* External link indicator */}
        <ExternalLink className="shrink-0 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    )
  }

  // Full layout (vertical with large image)
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-muted/30',
        'hover:bg-muted/50 transition-colors cursor-pointer',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Open ${preview.title || domain} in new tab`}
    >
      {/* Image */}
      {imageSrc && (
        <div
          className="w-full bg-muted"
          style={{
            aspectRatio: preview.imageWidth && preview.imageHeight
              ? `${preview.imageWidth}/${preview.imageHeight}`
              : '16/9',
            maxHeight: '250px',
          }}
        >
          <img
            src={imageSrc}
            alt={preview.title || 'Link preview'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Title */}
        {preview.title && (
          <h3 className="font-medium text-base line-clamp-2">
            {preview.title}
          </h3>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* Footer: domain and site name */}
        <div className="flex items-center gap-2 pt-1">
          {faviconSrc ? (
            <img src={faviconSrc} alt="" className="w-4 h-4" />
          ) : (
            <Globe className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {preview.siteName || domain}
          </span>
        </div>
      </div>

      {/* Remove button */}
      {showRemove && (
        <button
          onClick={handleRemove}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-full bg-background/80 shadow-sm',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-destructive/10 hover:text-destructive'
          )}
          aria-label="Remove preview"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* External link indicator */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-background/80 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        <span>Open</span>
      </div>
    </div>
  )
}

/**
 * Compact version for inline use
 */
export const LinkPreviewCardCompact: FC<Omit<LinkPreviewCardProps, 'compact'>> = (props) => {
  return <LinkPreviewCard {...props} compact />
}

/**
 * Loading skeleton for link previews
 */
export const LinkPreviewSkeleton: FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className,
}) => {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border bg-muted/30 p-3', className)}>
        <div className="shrink-0 w-16 h-16 rounded bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-muted/30', className)}>
      <div className="w-full aspect-video bg-muted animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
      </div>
    </div>
  )
}

export default LinkPreviewCard
