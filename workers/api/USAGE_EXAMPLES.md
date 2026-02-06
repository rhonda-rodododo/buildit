# OG Image Usage Examples

## HTML Meta Tags

Add these meta tags to your HTML `<head>` to use generated OG images:

### Article

```html
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=article&title=How%20to%20Build%20a%20Worker%20Cooperative&author=BuildIt%20Community&description=A%20comprehensive%20guide" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### Event

```html
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=event&title=Community%20Organizing%20Workshop&date=March%2015%2C%202026&location=Community%20Center" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### Campaign

```html
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=campaign&title=Community%20Garden%20Fundraiser&progress=65&goal=$10%2C000" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### Listing

```html
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=listing&title=Shared%20Workshop%20Space&price=$50/month&description=Access%20to%20tools" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### Profile

```html
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=profile&title=Alex%20Smith&description=Community%20organizer%20and%20activist" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

## TypeScript/JavaScript Integration

### React/Next.js

```tsx
import { useMemo } from 'react';

interface OgImageProps {
  type: 'article' | 'event' | 'listing' | 'campaign' | 'profile' | 'default';
  title: string;
  description?: string;
  author?: string;
  date?: string;
  location?: string;
  price?: string;
  progress?: number;
  goal?: string;
  brand?: string;
}

function generateOgImageUrl(props: OgImageProps): string {
  const params = new URLSearchParams({
    type: props.type,
    title: props.title,
  });

  if (props.description) params.set('description', props.description);
  if (props.author) params.set('author', props.author);
  if (props.date) params.set('date', props.date);
  if (props.location) params.set('location', props.location);
  if (props.price) params.set('price', props.price);
  if (props.progress !== undefined) params.set('progress', props.progress.toString());
  if (props.goal) params.set('goal', props.goal);
  if (props.brand) params.set('brand', props.brand);

  return `https://api.buildit.network/api/og-image?${params.toString()}`;
}

// Usage in component
export function ArticlePage({ article }) {
  const ogImageUrl = useMemo(
    () =>
      generateOgImageUrl({
        type: 'article',
        title: article.title,
        author: article.author,
        description: article.excerpt,
      }),
    [article]
  );

  return (
    <>
      <Head>
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:type" content="image/svg+xml" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
      </Head>
      {/* ... */}
    </>
  );
}
```

### Direct Fetch

```typescript
// Generate and fetch OG image
async function getOgImage(props: OgImageProps): Promise<string> {
  const url = generateOgImageUrl(props);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to generate OG image: ${response.status}`);
  }

  return response.text(); // Returns SVG as string
}

// Usage
const svg = await getOgImage({
  type: 'campaign',
  title: 'Community Garden Fund',
  progress: 73,
  goal: '$15,000',
});

console.log(svg); // <svg width="1200" height="630" ...
```

## Testing Locally

When running the API worker locally with `bun run dev`:

```bash
# Start the worker
cd workers/api
bun run dev

# Test in browser
open "http://localhost:8787/api/og-image?type=article&title=Test%20Article&author=Test%20Author"

# Test with curl
curl "http://localhost:8787/api/og-image?type=event&title=Test%20Event&date=2026-03-15&location=Test%20Location"

# Save to file
curl "http://localhost:8787/api/og-image?type=campaign&title=Test&progress=50&goal=1000" > test.svg
```

## Custom Branding

Override the default blue brand color:

```html
<!-- Use custom color (without # prefix) -->
<meta property="og:image" content="https://api.buildit.network/api/og-image?type=default&title=BuildIt&brand=10b981" />
```

```typescript
// Green brand color
generateOgImageUrl({
  type: 'article',
  title: 'Environment Co-op News',
  brand: '10b981', // emerald-500
});

// Red brand color
generateOgImageUrl({
  type: 'event',
  title: 'Solidarity March',
  brand: 'ef4444', // red-500
});
```

## Social Platform Testing

Test how your OG images appear on social platforms:

- **Twitter/X**: https://cards-dev.twitter.com/validator
- **Facebook**: https://developers.facebook.com/tools/debug/
- **LinkedIn**: https://www.linkedin.com/post-inspector/

**Note:** Some platforms may not support SVG OG images. If you encounter issues, you can use the image-proxy endpoint to convert the SVG to PNG/JPEG (requires additional server-side rendering).

## Performance Considerations

- OG images are cached for 24 hours in Cloudflare KV
- SVG images are typically 1-3KB (very lightweight)
- Cache key is based on all parameters
- Rate limited to 30 requests/minute per IP

## Error Handling

```typescript
async function safeGetOgImage(props: OgImageProps): Promise<string | null> {
  try {
    const url = generateOgImageUrl(props);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('OG image generation failed:', error);
      return null;
    }

    return response.text();
  } catch (error) {
    console.error('Failed to fetch OG image:', error);
    return null;
  }
}
```

## Complete Example: SSR Worker Integration

```typescript
// In your SSR worker (workers/ssr)
import { generateOgImageUrl } from './utils/og-image';

export async function renderEventPage(event: Event) {
  const ogImage = generateOgImageUrl({
    type: 'event',
    title: event.title,
    date: event.startDate.toLocaleDateString(),
    location: event.location,
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${event.title}</title>

        <!-- Open Graph -->
        <meta property="og:title" content="${event.title}" />
        <meta property="og:type" content="event" />
        <meta property="og:url" content="https://buildit.network/events/${event.id}" />
        <meta property="og:image" content="${ogImage}" />
        <meta property="og:image:type" content="image/svg+xml" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${event.title}" />
        <meta name="twitter:image" content="${ogImage}" />
      </head>
      <body>
        <!-- Event content -->
      </body>
    </html>
  `;
}
```
