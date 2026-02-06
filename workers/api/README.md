# BuildIt Network API Worker

Shared API services for all BuildIt platforms (desktop, iOS, Android).

## Endpoints

### `/api/link-preview`

Fetches Open Graph metadata from URLs for Signal-style encrypted link previews.

**Query Parameters:**
- `url` (required): HTTPS URL to fetch preview data from

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Page Title",
    "description": "Page description",
    "imageUrl": "https://example.com/image.jpg",
    "siteName": "Example Site",
    "type": "article",
    "faviconUrl": "https://example.com/favicon.ico"
  },
  "cached": false
}
```

**Features:**
- SSRF protection (blocks private IP ranges)
- 1 hour cache
- 5 second timeout
- HTML entity decoding

---

### `/api/image-proxy`

Proxies image fetches for link preview thumbnails and favicons.

**Query Parameters:**
- `url` (required): HTTPS URL to image

**Response:**
Binary image data with appropriate `Content-Type` header.

**Features:**
- SSRF protection
- 500KB size limit
- 10 second timeout
- Only allows image/* content types
- 24 hour cache

---

### `/api/oembed`

Returns oEmbed data for supported providers.

**Query Parameters:**
- `url` (required): URL to fetch oEmbed data for

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "video",
    "version": "1.0",
    "title": "Video Title",
    "author_name": "Author",
    "provider_name": "YouTube",
    "thumbnail_url": "https://...",
    "html": "<iframe ...>"
  }
}
```

**Supported Providers:**
- YouTube
- Vimeo
- SoundCloud
- Spotify
- And more...

---

### `/api/og-image`

Generates branded Open Graph images as SVG for social media sharing.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Template type: `article`, `event`, `listing`, `campaign`, `profile`, or `default` |
| `title` | string | Yes | Main title text |
| `description` | string | No | Subtitle/description text |
| `author` | string | No | Author name (for articles) |
| `date` | string | No | Date string (for events) |
| `location` | string | No | Location (for events) |
| `price` | string | No | Price (for listings) |
| `progress` | number | No | Progress percentage 0-100 (for campaigns) |
| `goal` | string | No | Goal amount (for campaigns) |
| `avatar` | string | No | Avatar URL (for profiles) |
| `brand` | string | No | Custom brand color hex code (without #) |

**Response:**
SVG image (1200x630px) with `Content-Type: image/svg+xml`

**Examples:**

```
# Article
GET /api/og-image?type=article&title=How%20to%20Build%20a%20Co-op&author=Jane%20Doe

# Event
GET /api/og-image?type=event&title=Workshop&date=2026-03-15&location=Community%20Center

# Campaign with progress
GET /api/og-image?type=campaign&title=Garden%20Fund&progress=65&goal=$10,000

# Profile
GET /api/og-image?type=profile&title=Alex%20Smith&description=Organizer%20and%20activist

# Custom brand color
GET /api/og-image?type=default&title=BuildIt&brand=3b82f6
```

**Features:**
- SVG-based generation (works in modern browsers/social platforms)
- Proper XSS protection (XML escaping)
- Text truncation and word wrapping
- 24 hour cache
- 6 different template types
- Branded BuildIt design (gradient background, logo)
- Customizable brand color

**Design Specs:**
- Size: 1200x630 (standard OG image size)
- Background: Gradient from slate-800 to slate-900
- Primary color: Blue-500 (customizable)
- Text: White for titles, slate-400 for secondary text
- Font: System UI stack
- BuildIt logo in bottom-right corner

---

### `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1234567890
}
```

---

## Rate Limiting

- 30 requests per minute per IP address
- Returns 429 status code when exceeded
- Includes `Retry-After: 60` header

## CORS

Controlled via `ALLOWED_ORIGINS` environment variable:
- `*` - Allow all origins (default)
- Comma-separated list - Allow specific origins

## Caching

All endpoints use Cloudflare KV for caching:
- Link previews: 1 hour
- Images: 24 hours
- OG images: 24 hours
- oEmbed: 24 hours (provider-dependent)

## Security Features

- HTTPS-only for external fetches
- SSRF protection (blocks private IPs)
- XSS protection (XML/HTML escaping)
- Rate limiting
- Content-Type validation
- Size limits
- Timeout protection

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Type check
bun run typecheck

# Deploy to Cloudflare
bun run deploy

# Deploy to preview environment
bun run deploy:preview

# Tail logs
bun run tail
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | `production` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `CACHE` | KV namespace binding | (auto-bound) |
