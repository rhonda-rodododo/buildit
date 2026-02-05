# BuildIt Workers

Cloudflare Workers powering the BuildIt network infrastructure. All workers follow zero-knowledge principles: they never have access to plaintext user data, private keys, or decrypted content.

## Overview

| Worker | Name | Purpose | Cloudflare Features |
|--------|------|---------|---------------------|
| **api** | `buildit-api` | Link preview, image proxy, oEmbed | Workers |
| **relay** | `buildit-relay` | Nostr relay (Nosflare-based) | Workers, D1, Durable Objects |
| **ssr** | `buildit-public` | SSR public pages for logged-out visitors | Workers, Vite + TanStack Start |

## What Each Worker Does

### API Worker (`workers/api/`)

Shared API services used by all client platforms (desktop, iOS, Android):

- `GET /api/link-preview?url=...` - Fetches Open Graph metadata from public URLs
- `GET /api/image-proxy?url=...` - Proxies image fetches (CORS bypass, IP hiding)
- `GET /api/oembed?url=...` - Fetches oEmbed data from trusted providers
- `GET /health` - Health check

The API worker only fetches public URLs. It has no access to user data.

### Relay Worker (`workers/relay/`)

A Nostr relay built on [Nosflare](https://github.com/Spl0itable/nosflare). Stores and relays NIP-17 gift-wrapped encrypted events.

- WebSocket endpoint for Nostr protocol (NIP-01, 02, 04, 09, 11, 12, 15, 16, 17, 20, 22, 28, 33, 40, 42, 44, 45, 50, 59)
- D1 database for event storage
- Durable Objects for WebSocket session management
- Rate limiting, moderation, allowlist/blocklist support
- Scheduled database maintenance (daily at 3 AM UTC)

The relay stores encrypted ciphertext blobs. It cannot decrypt message content.

### SSR Worker (`workers/ssr/`)

Server-side rendered public pages for logged-out visitors. Built with TanStack Start + Cloudflare Vite plugin.

- Landing page, about, privacy policy, docs
- Public event listings and campaign pages
- Article and publication pages (sourced from Nostr)
- Wiki pages
- RSS feed (`/feed.xml`)

The SSR worker only renders publicly available, non-authenticated content.

## Local Development

From the repository root:

```bash
# Start individual workers
bun run workers:dev:api        # API worker on localhost:8787
bun run workers:dev:relay      # Relay worker (requires D1 setup, see below)
bun run workers:dev:ssr        # SSR worker

# Type-check all workers
bun run workers:typecheck
```

Or from each worker directory:

```bash
cd workers/api && bun run dev
cd workers/relay && bun run dev
cd workers/ssr && bun run dev
```

## Deployment

From the repository root:

```bash
bun run workers:deploy:api
bun run workers:deploy:relay
bun run workers:deploy:ssr
```

Or from each worker directory:

```bash
cd workers/api && bun run deploy
cd workers/relay && bun run deploy
cd workers/ssr && bun run deploy
```

### Preview deployments

The API and relay workers support preview environments:

```bash
cd workers/api && bun run deploy:preview
cd workers/relay && bun run deploy:preview
```

## Environment Requirements

### All Workers

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- `wrangler` CLI (installed as dev dependency)
- Authenticate with: `bunx wrangler login`

### Relay Worker (Additional)

The relay requires a D1 database:

```bash
# Create the D1 database
cd workers/relay
bunx wrangler d1 create buildit-relay

# Copy the database_id from output into wrangler.toml
# Then initialize the schema after first deploy:
curl -X POST http://localhost:8787/admin/init-db
```

### SSR Worker (Additional)

The SSR worker depends on `@buildit/shared` (workspace package at `clients/web/packages/shared/`). Ensure dependencies are installed at the monorepo root:

```bash
bun install
```

## Configuration

- **API**: `workers/api/wrangler.toml` - CORS origins, environment settings
- **Relay**: `workers/relay/wrangler.toml` - D1 binding, relay identity, environments
- **Relay config**: `workers/relay/src/config.ts` - Rate limits, moderation, allowlists
- **SSR**: `workers/ssr/wrangler.jsonc` - Nostr relay URLs, site metadata

## Custom Domains

After deploying, add custom domains in the Cloudflare Dashboard:

- API: `api.buildit.network`
- Relay: `relay.buildit.network`
- SSR: `buildit.network` (or `www.buildit.network`)
