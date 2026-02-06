/**
 * Share Link Resolver Route
 *
 * Handles /s/:slug — short share links that:
 * 1. For social platform unfurlers: serves OG meta tags directly (no redirect)
 * 2. For humans: records a privacy-preserving analytics click then redirects
 *
 * Privacy design:
 * - No cookies set
 * - No user identification or fingerprinting
 * - Session ID is random per-visit (not stored)
 * - Referrer stripped to domain only
 * - No third-party scripts or tracking pixels
 */

import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { buildOgImageUrl } from '../../seo';

interface ShareLinkData {
  slug: string;
  targetUrl: string;
  title: string;
  description: string;
  ogImageUrl: string;
  isExpired: boolean;
  requiresPassword: boolean;
}

const getShareLink = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<ShareLinkData> => {
    // In production, this fetches from the relay/D1 via the federation worker.
    // For now, return not found for unknown slugs.
    // The SSR worker will query the relay for share link events (kind 40172).

    // TODO: Wire to actual relay query for share link Nostr events
    // const event = await fetchShareLinkBySlug(slug);
    // if (!event) throw notFound();

    throw notFound();
  });

export const Route = createFileRoute('/s/$slug')({
  loader: async ({ params }) => {
    const link = await getShareLink({ data: params.slug });
    return { link };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { link: ShareLinkData } | undefined;
    if (!data) {
      return { meta: [{ title: 'BuildIt Network' }] };
    }
    const { link } = data;

    // Serve OG meta for social platform unfurlers — no tracking, pure static HTML
    return {
      meta: [
        { title: link.title },
        { name: 'description', content: link.description },
        { name: 'robots', content: 'noindex, nofollow' },
        { property: 'og:title', content: link.title },
        { property: 'og:description', content: link.description },
        { property: 'og:url', content: `https://buildit.network/s/${link.slug}` },
        { property: 'og:image', content: link.ogImageUrl },
        { property: 'og:image:alt', content: link.title },
        { property: 'og:site_name', content: 'BuildIt Network' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: link.title },
        { name: 'twitter:description', content: link.description },
        { name: 'twitter:image', content: link.ogImageUrl },
      ],
    };
  },
  component: ShareLinkPage,
  notFoundComponent: ShareLinkNotFound,
});

function ShareLinkPage() {
  const loaderData = Route.useLoaderData() as { link: ShareLinkData } | undefined;
  if (!loaderData) return null;
  const { link } = loaderData;

  if (link.isExpired) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Link Expired</h1>
          <p style={{ color: 'var(--text-muted)' }}>This share link has expired.</p>
        </div>
      </div>
    );
  }

  // For human visitors: client-side redirect (no tracking scripts loaded)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Redirecting...
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Taking you to <strong>{link.title}</strong>
        </p>
        <a
          href={link.targetUrl}
          style={{ color: 'var(--primary)', textDecoration: 'underline' }}
        >
          Click here if not redirected
        </a>
        {/* Plain meta refresh — no JavaScript tracking */}
        <meta httpEquiv="refresh" content={`2;url=${link.targetUrl}`} />
      </div>
    </div>
  );
}

function ShareLinkNotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Link Not Found</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          This share link doesn't exist or has been removed.
        </p>
        <a
          href="https://buildit.network"
          style={{ color: 'var(--primary)', textDecoration: 'underline' }}
        >
          Go to BuildIt Network
        </a>
      </div>
    </div>
  );
}
