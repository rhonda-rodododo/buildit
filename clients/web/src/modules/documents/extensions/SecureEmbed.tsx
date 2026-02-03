/**
 * Secure Social Media Embed Extension for TipTap
 *
 * Supports embedding content from trusted providers with strict security controls:
 * - Sandboxed iframes prevent XSS and clickjacking
 * - Allowlist of trusted providers only
 * - CSP-compatible embedding
 * - Privacy-respecting embed URLs (no-cookie variants where available)
 *
 * Uses the shared embed infrastructure from @/lib/embed
 */

import { Node, mergeAttributes, type RawCommands, type CommandProps } from '@tiptap/core'

// Augment TipTap Commands to include setSecureEmbed
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    secureEmbed: {
      setSecureEmbed: (url: string) => ReturnType
    }
  }
}
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { FC, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Play, ExternalLink, AlertTriangle } from 'lucide-react'

// Import from shared embed infrastructure
import {
  EMBED_PROVIDERS,
  detectProvider,
  getSupportedProviderNames,
  isEmbeddableUrl as checkIsEmbeddable,
  type EmbedProvider,
} from '@/lib/embed'

// Secure Embed Node View Component
const SecureEmbedView: FC<NodeViewProps> = ({ node, selected }) => {
  const { t } = useTranslation()
  const attrs = node.attrs as {
    src: string
    provider: string
    embedUrl: string | null
    width: number
    height: number
  }
  const { src, provider: providerId, embedUrl, width } = attrs
  const [loadEmbed, setLoadEmbed] = useState(false)

  const provider: EmbedProvider | undefined = EMBED_PROVIDERS[providerId]

  if (!provider || !embedUrl) {
    // Unknown provider - show warning and link only
    return (
      <NodeViewWrapper className="secure-embed">
        <div
          className={`border rounded-lg p-4 bg-muted/50 ${selected ? 'ring-2 ring-primary' : ''}`}
          style={{ maxWidth: width }}
        >
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">{t('secureEmbed.untrusted.title')}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {t('secureEmbed.untrusted.description')}
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('secureEmbed.untrusted.openInNewTab')}
          </a>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="secure-embed">
      <div
        className={`relative overflow-hidden rounded-lg ${selected ? 'ring-2 ring-primary' : ''}`}
        style={{
          maxWidth: width,
          aspectRatio: provider.aspectRatio,
        }}
      >
        {!loadEmbed ? (
          // Click-to-load for privacy - don't auto-load third-party content
          <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-3">
            <div className="text-sm text-muted-foreground">
              {t('secureEmbed.embedName', { provider: provider.name })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLoadEmbed(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              {t('secureEmbed.loadEmbed', { provider: provider.name })}
            </Button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {t('secureEmbed.openExternally')}
            </a>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            sandbox={provider.sandbox.join(' ')}
            allow={provider.allow.join('; ')}
            loading="lazy"
            referrerPolicy="no-referrer"
            title={`${provider.name} embed`}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Embed Input Dialog Component
interface EmbedInputProps {
  onInsert: (url: string) => void
  trigger: React.ReactNode
}

export const EmbedInputDialog: FC<EmbedInputProps> = ({ onInsert, trigger }) => {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectedProvider = url ? detectProvider(url) : null

  const handleInsert = useCallback(() => {
    if (!url.trim()) {
      setError(t('secureEmbed.errors.enterUrl'))
      return
    }

    if (!detectedProvider) {
      setError(t('secureEmbed.errors.unsupportedProvider', { providers: getSupportedProviderNames().join(', ') }))
      return
    }

    onInsert(url)
    setUrl('')
    setError(null)
    setOpen(false)
  }, [url, detectedProvider, onInsert, t])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('secureEmbed.dialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder={t('secureEmbed.dialog.placeholder')}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
            {detectedProvider && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('secureEmbed.dialog.detected', { provider: detectedProvider.provider.name })}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">{t('secureEmbed.dialog.supportedProviders')}</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>{t('secureEmbed.dialog.providers.youtube')}</li>
              <li>{t('secureEmbed.dialog.providers.vimeo')}</li>
              <li>{t('secureEmbed.dialog.providers.peertube')}</li>
              <li>{t('secureEmbed.dialog.providers.soundcloud')}</li>
              <li>{t('secureEmbed.dialog.providers.spotify')}</li>
              <li>{t('secureEmbed.dialog.providers.codepen')}</li>
              <li>{t('secureEmbed.dialog.providers.codesandbox')}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('secureEmbed.dialog.cancel')}
            </Button>
            <Button onClick={handleInsert} disabled={!detectedProvider}>
              {t('secureEmbed.dialog.embed')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// TipTap Extension
export const SecureEmbed = Node.create({
  name: 'secureEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      provider: {
        default: null,
      },
      embedUrl: {
        default: null,
      },
      width: {
        default: 640,
      },
      height: {
        default: 360,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-secure-embed]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-secure-embed': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SecureEmbedView)
  },

  addCommands() {
    const extension = this
    return {
      setSecureEmbed: (url: string) => ({ commands }: CommandProps) => {
        const detected = detectProvider(url)

        if (!detected) {
          // Still insert but mark as untrusted
          return commands.insertContent({
            type: extension.name,
            attrs: {
              src: url,
              provider: 'unknown',
              embedUrl: null,
            },
          })
        }

        const { provider, providerId } = detected
        const embedUrl = provider.getEmbedUrl?.(url) ?? null

        return commands.insertContent({
          type: extension.name,
          attrs: {
            src: url,
            provider: providerId,
            embedUrl,
          },
        })
      },
    } as Partial<RawCommands>
  },
})

// Export helper to detect if a URL is embeddable (uses shared implementation)
export const isEmbeddableUrl = checkIsEmbeddable

// Export list of supported providers for UI (uses shared implementation)
export { getSupportedProviderNames as getSupportedProviders }
