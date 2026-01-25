import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchArticles } from '../../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';
import { CTABanner } from '../../components/CTABanner';

const getArticles = createServerFn({ method: 'GET' }).handler(async (): Promise<ArticleContent[]> => {
  const articles = await fetchArticles({ limit: 20 });
  return articles;
});

export const Route = createFileRoute('/articles/')({
  head: () => ({
    meta: [
      { title: 'Articles | BuildIt Network' },
      {
        name: 'description',
        content:
          'Read articles from the BuildIt Network community on organizing, activism, and building power.',
      },
      { property: 'og:title', content: 'Articles | BuildIt Network' },
      {
        property: 'og:description',
        content: 'Community articles on organizing and activism',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/articles' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/articles' }],
  }),
  loader: async () => {
    const articles = await getArticles();
    return { articles };
  },
  component: ArticlesPage,
});

function ArticlesPage() {
  const loaderData = Route.useLoaderData() as { articles: ArticleContent[] } | undefined;
  const articles = loaderData?.articles ?? [];

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
            Articles
          </h1>
          <p className="text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px' }}>
            Guides, tutorials, and insights for digital organizing from the
            BuildIt community.
          </p>
        </div>
      </section>

      {/* Articles List */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-lg">
          {articles.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              {articles.map((article: ArticleContent) => (
                <ArticleCard key={article.id} article={article} />
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
            title="Want to publish your own articles?"
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
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        No articles published yet
      </h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Check back soon for content from the BuildIt community.
      </p>
      <Link to="/" className="btn btn-outline btn-md" style={{ textDecoration: 'none' }}>
        Back to Home
      </Link>
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleContent }) {
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article
      className="card card-shadow"
      style={{
        padding: '1.5rem',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <Link
        to="/articles/$slug"
        params={{ slug: article.slug }}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          {article.image && (
            <img
              src={article.image}
              alt={article.title}
              style={{
                width: '180px',
                height: '120px',
                objectFit: 'cover',
                borderRadius: 'var(--radius)',
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                transition: 'color 0.15s ease',
              }}
            >
              {article.title}
            </h2>
            {article.summary && (
              <p
                className="text-muted line-clamp-2"
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  marginBottom: '0.75rem',
                }}
              >
                {article.summary}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                {formattedDate}
              </span>
              {article.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {article.tags.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="badge badge-secondary">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
