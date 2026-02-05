import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchArticles } from '../../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';
import { CTABanner } from '../../components/CTABanner';

// Group articles by author to create "publications"
interface PublicationSummary {
  id: string;
  name: string;
  authorPubkey: string;
  description: string;
  articleCount: number;
  latestArticle?: ArticleContent;
}

const getPublications = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicationSummary[]> => {
    const articles = await fetchArticles({ limit: 100 });

    // Group by author
    const byAuthor = articles.reduce<Record<string, ArticleContent[]>>((acc, article) => {
      if (!acc[article.authorPubkey]) {
        acc[article.authorPubkey] = [];
      }
      acc[article.authorPubkey].push(article);
      return acc;
    }, {});

    // Convert to publication summaries
    return Object.entries(byAuthor).map(([pubkey, authorArticles]) => {
      const latestArticle = authorArticles[0]; // Already sorted by date
      return {
        id: pubkey.slice(0, 16),
        name: latestArticle.authorName || `Publication ${pubkey.slice(0, 8)}`,
        authorPubkey: pubkey,
        description: `${authorArticles.length} articles published`,
        articleCount: authorArticles.length,
        latestArticle,
      };
    });
  }
);

export const Route = createFileRoute('/publications/')({
  head: () => ({
    meta: [
      { title: 'Publications | BuildIt Network' },
      {
        name: 'description',
        content:
          'Discover publications from writers and organizers on the BuildIt Network.',
      },
      { property: 'og:title', content: 'Publications | BuildIt Network' },
      {
        property: 'og:description',
        content: 'Community publications from organizers and activists',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/publications' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/publications' }],
  }),
  loader: async () => {
    const publications = await getPublications();
    return { publications };
  },
  component: PublicationsPage,
});

function PublicationsPage() {
  const loaderData = Route.useLoaderData() as { publications: PublicationSummary[] } | undefined;
  const publications = loaderData?.publications ?? [];

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
            Publications
          </h1>
          <p className="text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px' }}>
            Discover publications from writers, organizers, and activists on BuildIt Network.
          </p>
        </div>
      </section>

      {/* Publications List */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-lg">
          {publications.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {publications.map((pub) => (
                <PublicationCard key={pub.id} publication={pub} />
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
            title="Want to start your own publication?"
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
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📰</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        No publications yet
      </h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Check back soon for publications from the BuildIt community.
      </p>
      <Link to="/" className="btn btn-outline btn-md" style={{ textDecoration: 'none' }}>
        Back to Home
      </Link>
    </div>
  );
}

function PublicationCard({ publication }: { publication: PublicationSummary }) {
  return (
    <article
      className="card card-shadow"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          {publication.name}
        </h2>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>
          {publication.description}
        </p>
      </div>

      {publication.latestArticle && (
        <div
          className="card"
          style={{
            padding: '1rem',
            background: 'var(--muted-alpha-10)',
          }}
        >
          <p
            className="text-muted"
            style={{
              fontSize: '0.75rem',
              marginBottom: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Latest Article
          </p>
          <Link
            to="/articles/$slug"
            params={{ slug: publication.latestArticle.slug }}
            className="link"
            style={{ fontWeight: 500 }}
          >
            {publication.latestArticle.title}
          </Link>
        </div>
      )}

      <Link
        to="/publications/$slug"
        params={{ slug: publication.authorPubkey }}
        className="btn btn-outline btn-md"
        style={{ textDecoration: 'none', marginTop: 'auto' }}
      >
        View Publication →
      </Link>
    </article>
  );
}
