import { createFileRoute, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { fetchArticleBySlug } from '../../lib/nostr';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';

const getArticle = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
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
    const { article } = loaderData;
    // For now, use default indexability. In production, this would come from the article data
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
        ...(article.image
          ? [{ property: 'og:image', content: article.image }]
          : []),
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
        ...article.tags.map((tag) => ({
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
  const { article } = Route.useLoaderData();
  const formattedDate = new Date(article.publishedAt).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <nav className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-blue-600">
              BuildIt Network
            </a>
            <div className="flex items-center space-x-4">
              <a href="/articles" className="text-blue-600 font-medium">
                Articles
              </a>
              <a href="/wiki" className="text-gray-600 hover:text-gray-900">
                Wiki
              </a>
              <a href="/events" className="text-gray-600 hover:text-gray-900">
                Events
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <article>
          {/* Header */}
          <header className="mb-8">
            <div className="mb-4">
              <a
                href="/articles"
                className="text-blue-600 hover:underline text-sm"
              >
                &larr; Back to Articles
              </a>
            </div>

            <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

            {article.summary && (
              <p className="text-xl text-gray-600 mb-4">{article.summary}</p>
            )}

            <div className="flex items-center gap-4 text-gray-500 text-sm">
              <time dateTime={new Date(article.publishedAt).toISOString()}>
                {formattedDate}
              </time>
              {article.tags.length > 0 && (
                <div className="flex gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-gray-100 px-2 py-1 rounded text-xs"
                    >
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
              className="w-full h-64 md:h-96 object-cover rounded-lg mb-8"
            />
          )}

          {/* Content */}
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </article>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Article Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          The article you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <a href="/articles" className="text-blue-600 hover:underline">
          &larr; Back to Articles
        </a>
      </div>
    </div>
  );
}
