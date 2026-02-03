# BuildIt Network Nostr Relay

A serverless Nostr relay built on Cloudflare Workers, based on [Nosflare](https://github.com/Spl0itable/nosflare).

## Features

- **Serverless**: Runs on Cloudflare Workers with D1 database
- **Multi-Region**: Durable Objects mesh for low-latency global access
- **WebSocket Hibernation**: Cost-effective idle connection handling
- **NIP Support**: NIP-01, 02, 04, 09, 11, 12, 15, 16, 17, 20, 22, 28, 33, 40, 42, 44, 45, 50, 59
- **Moderation**: Pubkey/kind/content/tag filtering with allowlists and blocklists
- **Rate Limiting**: Token bucket algorithm for request throttling
- **Optional Payments**: Pay-to-relay with Lightning support

## Quick Start

### 1. Install Dependencies

```bash
cd workers/relay
bun install
```

### 2. Create D1 Database

```bash
wrangler d1 create buildit-relay
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "RELAY_DATABASE"
database_name = "buildit-relay"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Local Development

```bash
wrangler dev
```

Then initialize the database by POSTing to `/admin/init-db`:

```bash
curl -X POST http://localhost:8787/admin/init-db
```

### 4. Deploy to Production

```bash
wrangler deploy
```

After deploying, initialize the database:

```bash
curl -X POST https://buildit-relay.rikki-schulte.workers.dev/admin/init-db
```

## Configuration

Edit `src/config.ts` to customize:

- **Relay Identity**: Name, description, contact info
- **Authentication**: Enable/disable NIP-42 auth requirement
- **Payments**: Enable pay-to-relay with satoshi pricing
- **Rate Limits**: Token bucket settings for events and REQs
- **Moderation**: Pubkey/kind/content/tag filtering

### Pubkey Allowlist Mode

To run a private relay that only accepts events from specific pubkeys:

```typescript
export const PUBKEY_ALLOWLIST_MODE = true;

export const pubkeyAllowlist = new Set<string>([
  'hex_pubkey_1',
  'hex_pubkey_2',
]);
```

### Content Filtering

Block specific phrases or domains:

```typescript
export const blockedPhrases: string[] = [
  'spam phrase',
  'blocked content',
];

export const blockedDomains: string[] = [
  'malicious-site.com',
];
```

## API Endpoints

- `GET /` - Welcome message
- `GET /` with `Accept: application/nostr+json` - NIP-11 relay info
- `GET /health` - Health check
- `POST /admin/init-db` - Initialize database schema
- `WebSocket /` - Nostr protocol

## Custom Domain

After deploying, add a custom domain in Cloudflare Dashboard:

1. Go to Workers & Pages > buildit-relay
2. Click "Custom Domains"
3. Add your domain (e.g., `relay.buildit.network`)

## Scripts

From the project root:

```bash
bun run relay:install    # Install dependencies
bun run relay:dev        # Local development
bun run relay:deploy     # Deploy to production
bun run relay:tail       # View live logs
```

From the relay directory:

```bash
bun run dev              # Local development
bun run deploy           # Deploy to production
bun run deploy:preview   # Deploy to preview env
bun run tail             # View live logs
bun run typecheck        # Type check
```

## Architecture

```
workers/relay/
├── src/
│   ├── index.ts          # Entry point
│   ├── types.ts          # TypeScript interfaces
│   ├── config.ts         # Configuration
│   ├── relay-worker.ts   # HTTP handling, DB operations
│   └── durable-object.ts # WebSocket handling
├── wrangler.toml         # Cloudflare config
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies
```

## Credits

Based on [Nosflare](https://github.com/Spl0itable/nosflare) by Spl0itable.
