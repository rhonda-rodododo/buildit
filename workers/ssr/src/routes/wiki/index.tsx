import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { NostrEvent } from 'nostr-tools';
import { fetchWikiPages } from '../../lib/nostr';
import { CTABanner } from '../../components/CTABanner';

const getWikiPages = createServerFn({ method: 'GET' }).handler(async (): Promise<NostrEvent[]> => {
  const pages = await fetchWikiPages({ limit: 50 });
  return pages;
});

export const Route = createFileRoute('/wiki/')({
  head: () => ({
    meta: [
      { title: 'Wiki | BuildIt Network' },
      {
        name: 'description',
        content:
          'Collaborative knowledge base for organizing resources, guides, and best practices.',
      },
      { property: 'og:title', content: 'Wiki | BuildIt Network' },
      {
        property: 'og:description',
        content: 'Collaborative knowledge base for organizers',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/wiki' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/wiki' }],
  }),
  loader: async () => {
    const pages = await getWikiPages();
    return { pages };
  },
  component: WikiPage,
});

interface ParsedWikiPage {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string | undefined;
  updatedAt: number;
}

function WikiPage() {
  const loaderData = Route.useLoaderData() as { pages: NostrEvent[] } | undefined;
  const pages = loaderData?.pages ?? [];

  // Parse wiki pages from Nostr events
  const parsedPages: ParsedWikiPage[] = pages.map((event: NostrEvent) => {
    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t: string[]) => t[0] === name);
      return tag ? tag[1] : undefined;
    };

    return {
      id: event.id,
      slug: getTag('d') || event.id,
      title: getTag('title') || 'Untitled',
      summary: getTag('summary') || event.content.slice(0, 160),
      category: getTag('c'),
      updatedAt: event.created_at * 1000,
    };
  });

  // Group by category
  const categories = parsedPages.reduce<Record<string, ParsedWikiPage[]>>(
    (acc, page) => {
      const category = page.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(page);
      return acc;
    },
    {}
  );

  return (
    <div>
      {/* Page Header */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="container container-lg">
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Wiki
          </h1>
          <p
            className="text-muted"
            style={{ fontSize: '1.125rem', maxWidth: '600px' }}
          >
            Collaborative knowledge base for organizing resources, guides, and
            best practices.
          </p>
        </div>
      </section>

      {/* Wiki Content */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-lg">
          {parsedPages.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
              }}
            >
              {Object.entries(categories).map(([category, categoryPages]) => (
                <section key={category}>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {category}
                  </h2>
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.75rem',
                    }}
                  >
                    {categoryPages.map((page) => (
                      <WikiPageCard key={page.id} page={page} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            variant="minimal"
            title="Want to contribute to the wiki?"
            primaryCTA="Get Started"
          />
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="card"
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
      <h2
        style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}
      >
        No public wiki pages yet
      </h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Check back soon for resources from the BuildIt community.
      </p>
      <Link
        to="/"
        className="btn btn-outline btn-md"
        style={{ textDecoration: 'none' }}
      >
        Back to Home
      </Link>
    </div>
  );
}

function WikiPageCard({ page }: { page: ParsedWikiPage }) {
  return (
    <Link
      to="/wiki/$slug"
      params={{ slug: page.slug }}
      className="card"
      style={{
        padding: '1rem 1.25rem',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        transition: 'background 0.15s ease',
      }}
    >
      <h3
        className="link"
        style={{
          fontSize: '1rem',
          fontWeight: 500,
          marginBottom: '0.25rem',
        }}
      >
        {page.title}
      </h3>
      <p
        className="text-muted line-clamp-2"
        style={{ fontSize: '0.875rem', margin: 0 }}
      >
        {page.summary}
      </p>
    </Link>
  );
}
