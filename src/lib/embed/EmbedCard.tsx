/**
 * EmbedCard Component
 *
 * Standalone, reusable component for rendering social media embeds.
 * Uses click-to-load pattern by default for privacy.
 *
 * Features:
 * - Click-to-load by default (no third-party requests until user clicks)
 * - Provider name and "Load" button before loading
 * - Sandboxed iframe with proper security attributes after loading
 * - Fallback to external link for untrusted providers
 * - Responsive aspect ratio
 * - Accessible and mobile-friendly
 */

import { FC, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEmbed } from './useEmbed'
import type { EmbedCardProps } from './types'
import { formatEmbedUrlForDisplay } from './utils'
import { Button } from '@/components/ui/button'
import { ExternalLink, Play, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * EmbedCard renders a social media embed with click-to-load privacy pattern
 *
 * @example
 * ```tsx
 * <EmbedCard url="https://youtube.com/watch?v=abc123" />
 * <EmbedCard url="https://vimeo.com/123456" compact />
 * <EmbedCard url="https://spotify.com/track/abc" autoLoad />
 * ```
 */
export const EmbedCard: FC<EmbedCardProps> = ({
  url,
  className,
  autoLoad = false,
  compact = false,
  onLoadClick,
  onLoaded,
}) => {
  const { t } = useTranslation()
  const { loading, error, embedData, provider, load, isLoaded, isEmbeddable } = useEmbed(url, {
    autoLoad,
    onLoad: onLoaded,
  })

  const handleLoad = useCallback(() => {
    onLoadClick?.()
    load()
  }, [load, onLoadClick])

  // Not embeddable - show simple external link
  if (!isEmbeddable) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 text-sm text-primary hover:underline',
          className
        )}
      >
        <ExternalLink className="h-3 w-3" />
        {formatEmbedUrlForDisplay(url)}
      </a>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/20 bg-destructive/5 p-4',
          className
        )}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">{t('embedCard.error.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              {t('embedCard.error.openExternally')}
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Loaded - render embed
  if (isLoaded && embedData) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border bg-muted/30',
          className
        )}
        style={{
          aspectRatio: embedData.aspectRatio,
        }}
      >
        {embedData.embedUrl ? (
          <iframe
            src={embedData.embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            sandbox={embedData.sandbox.join(' ')}
            allow={embedData.allow.join('; ')}
            loading="lazy"
            referrerPolicy="no-referrer"
            title={embedData.title || `${embedData.provider} embed`}
          />
        ) : embedData.embedHtml ? (
          <iframe
            srcDoc={embedData.embedHtml}
            className="absolute inset-0 w-full h-full border-0"
            sandbox={embedData.sandbox.join(' ')}
            loading="lazy"
            referrerPolicy="no-referrer"
            title={embedData.title || `${embedData.provider} embed`}
          />
        ) : (
          // Fallback to thumbnail + link if no embed available
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-3 p-4">
            {embedData.thumbnail && (
              <img
                src={embedData.thumbnail}
                alt={embedData.title || 'Embed thumbnail'}
                className="max-h-32 rounded object-contain"
              />
            )}
            {embedData.title && (
              <p className="text-sm font-medium text-center line-clamp-2">{embedData.title}</p>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t('embedCard.openOn', { provider: embedData.provider })}
            </a>
          </div>
        )}
      </div>
    )
  }

  // Click-to-load state
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-muted/50',
        compact ? 'p-3' : 'p-4',
        className
      )}
      style={{
        aspectRatio: compact ? undefined : provider?.aspectRatio,
        minHeight: compact ? undefined : '200px',
      }}
    >
      <div className="flex flex-col items-center justify-center h-full gap-3">
        {/* Provider info */}
        <div className="text-sm text-muted-foreground text-center">
          {t('embedCard.providerEmbed', { provider: provider?.name })}
        </div>

        {/* Load button */}
        <Button
          variant="secondary"
          size={compact ? 'sm' : 'default'}
          onClick={handleLoad}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('embedCard.loading')}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {t('embedCard.loadProvider', { provider: provider?.name })}
            </>
          )}
        </Button>

        {/* External link option */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" />
          {t('embedCard.openExternally')}
        </a>

        {/* Privacy note */}
        {!compact && (
          <p className="text-xs text-muted-foreground text-center max-w-[200px] mt-2">
            {t('embedCard.privacyNote', { domain: provider?.domain || 'third-party servers' })}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version of EmbedCard for inline use in feeds
 */
export const EmbedCardCompact: FC<Omit<EmbedCardProps, 'compact'>> = (props) => {
  return <EmbedCard {...props} compact />
}

export default EmbedCard
