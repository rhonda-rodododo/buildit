import { createFileRoute, notFound, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { fetchArticleBySlug } from '../../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';
import { CTABanner } from '../../components/CTABanner';

const getArticle = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<ArticleContent> => {
    const article = await fetchArticleBySlug(slug);
    if (!article) {
      throw notFound();
    }
    return article;
  });

export const Route = createFileRoute('/articles/$slug')({
  loader: async ({ params }) => {
    const article = await getArticle({ data: params.slug });
    return { article };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { article: ArticleContent } | undefined;
    if (!data) {
      return { meta: [{ title: 'Article | BuildIt Network' }] };
    }
    const { article } = data;
    const robotsContent = generateRobotsMetaContent(DEFAULT_INDEXABILITY);

    return {
      meta: [
        { title: `${article.title} | BuildIt Network` },
        {
          name: 'description',
          content: article.summary || article.content.slice(0, 160),
        },
        { name: 'robots', content: robotsContent },
        // Open Graph
        { property: 'og:title', content: article.title },
        {
          property: 'og:description',
          content: article.summary || article.content.slice(0, 160),
        },
        { property: 'og:type', content: 'article' },
        {
          property: 'og:url',
          content: `https://buildit.network/articles/${article.slug}`,
        },
        ...(article.image ? [{ property: 'og:image', content: article.image }] : []),
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: article.title },
        {
          name: 'twitter:description',
          content: article.summary || article.content.slice(0, 160),
        },
        // Article metadata
        {
          property: 'article:published_time',
          content: new Date(article.publishedAt).toISOString(),
        },
        ...article.tags.map((tag: string) => ({
          property: 'article:tag',
          content: tag,
        })),
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://buildit.network/articles/${article.slug}`,
        },
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: NotFound,
});

function ArticlePage() {
  const loaderData = Route.useLoaderData() as { article: ArticleContent } | undefined;
  if (!loaderData) {
    return null;
  }
  const { article } = loaderData;
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Article */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-md">
          <article>
            {/* Breadcrumb */}
            <div style={{ marginBottom: '1.5rem' }}>
              <Link to="/articles" className="link" style={{ fontSize: '0.875rem' }}>
                ← Back to Articles
              </Link>
            </div>

            {/* Header */}
            <header style={{ marginBottom: '2rem' }}>
              <h1
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: '1rem',
                }}
              >
                {article.title}
              </h1>

              {article.summary && (
                <p
                  className="text-muted"
                  style={{
                    fontSize: '1.25rem',
                    lineHeight: 1.6,
                    marginBottom: '1rem',
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
                <time
                  dateTime={new Date(article.publishedAt).toISOString()}
                  className="text-muted"
                  style={{ fontSize: '0.875rem' }}
                >
                  {formattedDate}
                </time>
                {article.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {article.tags.map((tag: string) => (
                      <span key={tag} className="badge badge-secondary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* Cover Image */}
            {article.image && (
              <img
                src={article.image}
                alt={article.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '400px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius)',
                  marginBottom: '2rem',
                }}
              />
            )}

            {/* Content */}
            <div
              className="prose"
              style={{ maxWidth: 'none' }}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </article>

          {/* CTA */}
          <div style={{ marginTop: '3rem' }}>
            <CTABanner
              variant="minimal"
              title="Want to join the discussion?"
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
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Article Not Found
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The article you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/articles"
          className="btn btn-outline btn-md"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Articles
        </Link>
      </div>
    </div>
  );
}
