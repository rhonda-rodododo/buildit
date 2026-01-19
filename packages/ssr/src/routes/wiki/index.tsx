import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { fetchWikiPages } from '../../lib/nostr';

const getWikiPages = createServerFn({ method: 'GET' }).handler(async () => {
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
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  loader: async () => {
    const pages = await getWikiPages();
    return { pages };
  },
  component: WikiPage,
});

function WikiPage() {
  const { pages } = Route.useLoaderData();

  // Parse wiki pages from Nostr events
  const parsedPages = pages.map((event) => {
    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t) => t[0] === name);
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
  const categories = parsedPages.reduce(
    (acc, page) => {
      const category = page.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(page);
      return acc;
    },
    {} as Record<string, typeof parsedPages>
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
              <a href="/articles" className="text-gray-600 hover:text-gray-900">
                Articles
              </a>
              <a href="/wiki" className="text-blue-600 font-medium">
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
        <h1 className="text-3xl font-bold mb-4">Wiki</h1>
        <p className="text-gray-600 mb-8">
          Collaborative knowledge base for organizing resources, guides, and
          best practices.
        </p>

        {parsedPages.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="text-lg">No public wiki pages yet.</p>
            <p className="mt-2">
              Check back soon for resources from the BuildIt community.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(categories).map(([category, categoryPages]) => (
              <section key={category}>
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  {category}
                </h2>
                <div className="grid gap-4">
                  {categoryPages.map((page) => (
                    <a
                      key={page.id}
                      href={`/wiki/${page.slug}`}
                      className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition"
                    >
                      <h3 className="font-medium text-blue-600 mb-1">
                        {page.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {page.summary}
                      </p>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
