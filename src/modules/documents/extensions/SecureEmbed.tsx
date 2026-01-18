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
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { FC, useState, useCallback } from 'react'
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
            <span className="text-sm font-medium">Untrusted embed source</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            This content is from an untrusted source and cannot be embedded securely.
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open in new tab
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
              {provider.name} embed
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLoadEmbed(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Load {provider.name}
            </Button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Open externally
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
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectedProvider = url ? detectProvider(url) : null

  const handleInsert = useCallback(() => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!detectedProvider) {
      setError(`Unsupported provider. Supported: ${getSupportedProviderNames().join(', ')}`)
      return
    }

    onInsert(url)
    setUrl('')
    setError(null)
    setOpen(false)
  }, [url, detectedProvider, onInsert])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Embed Media</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Paste URL (YouTube, Vimeo, SoundCloud, Spotify...)"
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
                Detected: {detectedProvider.provider.name}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Supported providers:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>YouTube (privacy-enhanced mode)</li>
              <li>Vimeo (do-not-track mode)</li>
              <li>PeerTube (any instance)</li>
              <li>SoundCloud</li>
              <li>Spotify</li>
              <li>CodePen</li>
              <li>CodeSandbox</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!detectedProvider}>
              Embed
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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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
