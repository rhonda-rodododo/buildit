import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchArticles } from '../../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';
import { CTABanner } from '../../components/CTABanner';

interface PublicationData {
  id: string;
  name: string;
  authorPubkey: string;
  description: string;
  articles: ArticleContent[];
}

const getPublication = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<PublicationData> => {
    // Fetch articles by this author
    const allArticles = await fetchArticles({ limit: 100, authors: [slug] });

    if (allArticles.length === 0) {
      throw notFound();
    }

    const firstArticle = allArticles[0];
    return {
      id: slug.slice(0, 16),
      name: firstArticle.authorName || `Publication ${slug.slice(0, 8)}`,
      authorPubkey: slug,
      description: `${allArticles.length} articles published`,
      articles: allArticles,
    };
  });

export const Route = createFileRoute('/publications/$slug')({
  loader: async ({ params }) => {
    const publication = await getPublication({ data: params.slug });
    return { publication };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { publication: PublicationData } | undefined;
    if (!data) {
      return { meta: [{ title: 'Publication | BuildIt Network' }] };
    }
    const { publication } = data;
    const robotsContent = generateRobotsMetaContent(DEFAULT_INDEXABILITY);

    return {
      meta: [
        { title: `${publication.name} | BuildIt Network` },
        {
          name: 'description',
          content: publication.description,
        },
        { name: 'robots', content: robotsContent },
        // Open Graph
        { property: 'og:title', content: publication.name },
        { property: 'og:description', content: publication.description },
        { property: 'og:type', content: 'website' },
        {
          property: 'og:url',
          content: `https://buildit.network/publications/${publication.authorPubkey}`,
        },
        // Twitter
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: publication.name },
        { name: 'twitter:description', content: publication.description },
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://buildit.network/publications/${publication.authorPubkey}`,
        },
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: `${publication.name} RSS Feed`,
          href: `https://buildit.network/publications/${publication.authorPubkey}/feed.xml`,
        },
      ],
    };
  },
  component: PublicationPage,
  notFoundComponent: NotFound,
});

function PublicationPage() {
  const loaderData = Route.useLoaderData() as { publication: PublicationData } | undefined;
  if (!loaderData) {
    return null;
  }
  const { publication } = loaderData;

  return (
    <div>
      {/* Publication Header */}
      <section
        style={{
          background: 'linear-gradient(to right, var(--primary-alpha-10), var(--primary-alpha-5))',
          borderBottom: '1px solid var(--border)',
          padding: '3rem 0',
        }}
      >
        <div className="container container-lg">
          <div style={{ marginBottom: '1.5rem' }}>
            <Link to="/publications" className="link" style={{ fontSize: '0.875rem' }}>
              ← Back to Publications
            </Link>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 2.5rem)',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            {publication.name}
          </h1>
          <p className="text-muted" style={{ fontSize: '1.125rem' }}>
            {publication.description}
          </p>
        </div>
      </section>

      {/* Articles List */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container container-lg">
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '1.5rem',
            }}
          >
            All Articles
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            {publication.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
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
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              {article.title}
            </h3>
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
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📰</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Publication Not Found
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The publication you're looking for doesn't exist.
        </p>
        <Link
          to="/publications"
          className="btn btn-outline btn-md"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Publications
        </Link>
      </div>
    </div>
  );
}
