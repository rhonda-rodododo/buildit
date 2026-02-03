/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for BuildIt API Worker (link-preview, image-proxy, oembed) */
  readonly VITE_API_URL?: string
  /** Override just the oEmbed proxy URL (defaults to VITE_API_URL + /api/oembed) */
  readonly VITE_OEMBED_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
