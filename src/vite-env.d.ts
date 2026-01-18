/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OEMBED_PROXY_URL?: string
  // Add other VITE_ env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
