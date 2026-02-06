import { createFileRoute, notFound, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchWikiPageBySlug } from '../../lib/nostr';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';
import { CTABanner } from '../../components/CTABanner';
import {
  generateWikiSeoMeta,
  generateBreadcrumbStructuredData,
} from '../../seo';

interface WikiPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  category?: string;
  updatedAt: number;
  author?: string;
}

const getWikiPage = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<WikiPage> => {
    const event = await fetchWikiPageBySlug(slug);
    if (!event) {
      throw notFound();
    }

    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t: string[]) => t[0] === name);
      return tag ? tag[1] : undefined;
    };

    const page: WikiPage = {
      id: event.id,
      slug: getTag('d') || event.id,
      title: getTag('title') || 'Untitled',
      content: event.content,
      summary: getTag('summary'),
      category: getTag('c'),
      updatedAt: event.created_at * 1000,
      author: event.pubkey,
    };

    return page;
  });

export const Route = createFileRoute('/wiki/$slug')({
  loader: async ({ params }) => {
    const page = await getWikiPage({ data: params.slug });
    return { page };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { page: WikiPage } | undefined;
    if (!data) {
      return { meta: [{ title: 'Wiki | BuildIt Network' }] };
    }
    const { page } = data;
    const seo = generateWikiSeoMeta(page);
    const breadcrumbs = generateBreadcrumbStructuredData([
      { name: 'Home', url: 'https://buildit.network' },
      { name: 'Wiki', url: 'https://buildit.network/wiki' },
      ...(page.category
        ? [{ name: page.category, url: `https://buildit.network/wiki?category=${encodeURIComponent(page.category)}` }]
        : []),
      { name: page.title, url: `https://buildit.network/wiki/${page.slug}` },
    ]);

    return {
      meta: [
        { title: `${page.title} | Wiki | BuildIt Network` },
        ...seo.meta,
      ],
      links: seo.links,
      scripts: [
        { type: 'application/ld+json', children: seo.structuredData },
        { type: 'application/ld+json', children: breadcrumbs },
      ],
    };
  },
  component: WikiPageComponent,
  notFoundComponent: NotFound,
});

function WikiPageComponent() {
  const loaderData = Route.useLoaderData() as { page: WikiPage } | undefined;
  if (!loaderData) {
    return null;
  }
  const { page } = loaderData;
  const formattedDate = new Date(page.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Wiki Page Content */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-md">
          <article>
            {/* Breadcrumbs */}
            <div
              style={{
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <Link to="/wiki" className="link">
                Wiki
              </Link>
              {page.category && (
                <>
                  <span className="text-muted">/</span>
                  <span className="text-muted">{page.category}</span>
                </>
              )}
            </div>

            {/* Header */}
            <header style={{ marginBottom: '2rem' }}>
              <h1
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: '0.75rem',
                }}
              >
                {page.title}
              </h1>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                Last updated: {formattedDate}
              </p>
            </header>

            {/* Content */}
            <div
              className="prose"
              style={{ maxWidth: 'none' }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </article>

          {/* CTA */}
          <div style={{ marginTop: '3rem' }}>
            <CTABanner
              variant="minimal"
              title="Want to contribute or edit this page?"
              primaryCTA="Create Account"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 0',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📚</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Page Not Found
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The wiki page you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/wiki"
          className="btn btn-outline btn-md"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Wiki
        </Link>
      </div>
    </div>
  );
}
