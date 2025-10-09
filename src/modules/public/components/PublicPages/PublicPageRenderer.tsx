/**
 * Public Page Renderer Component
 * Renders published public pages with SEO optimization
 */

import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import type { PublicPage } from '../../types';

interface PublicPageRendererProps {
  page: PublicPage;
  showMetadata?: boolean;
}

export function PublicPageRenderer({ page, showMetadata = false }: PublicPageRendererProps) {
  // Track page view analytics
  useEffect(() => {
    // TODO: Track analytics event
    // addAnalyticsEvent({
    //   id: nanoid(),
    //   groupId: page.groupId,
    //   resourceType: 'page',
    //   resourceId: page.id,
    //   event: 'view',
    //   timestamp: Date.now(),
    //   sessionId: getSessionId(),
    //   referrer: document.referrer,
    // });
  }, [page.id, page.groupId]);

  const siteUrl = window.location.origin;
  const pageUrl = `${siteUrl}/${page.groupId}/${page.slug}`;

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{page.seo.title || page.title}</title>
        {page.seo.description && (
          <meta name="description" content={page.seo.description} />
        )}
        {page.seo.keywords && (
          <meta name="keywords" content={page.seo.keywords.join(', ')} />
        )}
        {page.seo.robots && <meta name="robots" content={page.seo.robots} />}
        {page.seo.canonicalUrl && <link rel="canonical" href={page.seo.canonicalUrl} />}

        {/* Open Graph Tags */}
        <meta property="og:title" content={page.seo.ogTitle || page.title} />
        {page.seo.ogDescription && (
          <meta property="og:description" content={page.seo.ogDescription} />
        )}
        <meta property="og:type" content={page.seo.ogType || 'website'} />
        <meta property="og:url" content={pageUrl} />
        {page.seo.ogImage && <meta property="og:image" content={page.seo.ogImage} />}

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content={page.seo.twitterCard || 'summary'} />
        {page.seo.twitterTitle && (
          <meta name="twitter:title" content={page.seo.twitterTitle} />
        )}
        {page.seo.twitterDescription && (
          <meta name="twitter:description" content={page.seo.twitterDescription} />
        )}
        {page.seo.twitterImage && (
          <meta name="twitter:image" content={page.seo.twitterImage} />
        )}
        {page.seo.twitterSite && (
          <meta name="twitter:site" content={page.seo.twitterSite} />
        )}
        {page.seo.twitterCreator && (
          <meta name="twitter:creator" content={page.seo.twitterCreator} />
        )}

        {/* Schema.org JSON-LD */}
        {page.seo.schemaOrgJson && (
          <script type="application/ld+json">{page.seo.schemaOrgJson}</script>
        )}
      </Helmet>

      {/* Page Content */}
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Metadata (for development/preview) */}
        {showMetadata && (
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>
                Status: <strong>{page.status}</strong> • Type: <strong>{page.type}</strong> •
                URL: <code className="bg-background px-2 py-0.5 rounded">/{page.slug}</code>
              </span>
            </div>
          </Card>
        )}

        {/* Page Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
          {page.seo.description && (
            <p className="text-xl text-muted-foreground">{page.seo.description}</p>
          )}
        </div>

        {/* Page Content */}
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        {/* Metadata Footer */}
        {showMetadata && (
          <div className="text-xs text-muted-foreground border-t pt-4">
            Created {new Date(page.created).toLocaleString()}
            {page.publishedAt && (
              <> • Published {new Date(page.publishedAt).toLocaleString()}</>
            )}
            {page.updated && (
              <> • Updated {new Date(page.updated).toLocaleString()}</>
            )}
          </div>
        )}
      </div>
    </>
  );
}
