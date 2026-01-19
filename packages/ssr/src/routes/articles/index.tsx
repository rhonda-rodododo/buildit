import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { fetchArticles } from '../../lib/nostr';
import type { ArticleContent } from '@buildit/shared/nostr';

const getArticles = createServerFn({ method: 'GET' }).handler(async () => {
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
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  loader: async () => {
    const articles = await getArticles();
    return { articles };
  },
  component: ArticlesPage,
});

function ArticlesPage() {
  const { articles } = Route.useLoaderData();

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

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Articles</h1>

        {articles.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="text-lg">No articles published yet.</p>
            <p className="mt-2">
              Check back soon for content from the BuildIt community.
            </p>
          </div>
        ) : (
          <div className="grid gap-8">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleContent }) {
  const formattedDate = new Date(article.publishedAt).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <article className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
      <a href={`/articles/${article.slug}`}>
        <div className="flex items-start gap-6">
          {article.image && (
            <img
              src={article.image}
              alt={article.title}
              className="w-48 h-32 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold mb-2 hover:text-blue-600 transition">
              {article.title}
            </h2>
            {article.summary && (
              <p className="text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{formattedDate}</span>
              {article.tags.length > 0 && (
                <div className="flex gap-2">
                  {article.tags.slice(0, 3).map((tag) => (
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
          </div>
        </div>
      </a>
    </article>
  );
}
