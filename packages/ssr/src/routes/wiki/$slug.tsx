import { createFileRoute, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { fetchWikiPageBySlug } from '../../lib/nostr';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';

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
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const event = await fetchWikiPageBySlug(slug);
    if (!event) {
      throw notFound();
    }

    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t) => t[0] === name);
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
    const { page } = loaderData;
    const robotsContent = generateRobotsMetaContent(DEFAULT_INDEXABILITY);

    return {
      meta: [
        { title: `${page.title} | Wiki | BuildIt Network` },
        {
          name: 'description',
          content: page.summary || page.content.slice(0, 160),
        },
        { name: 'robots', content: robotsContent },
        // Open Graph
        { property: 'og:title', content: page.title },
        {
          property: 'og:description',
          content: page.summary || page.content.slice(0, 160),
        },
        { property: 'og:type', content: 'article' },
        {
          property: 'og:url',
          content: `https://buildit.network/wiki/${page.slug}`,
        },
        // Twitter
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: page.title },
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://buildit.network/wiki/${page.slug}`,
        },
      ],
    };
  },
  component: WikiPageComponent,
  notFoundComponent: NotFound,
});

function WikiPageComponent() {
  const { page } = Route.useLoaderData();
  const formattedDate = new Date(page.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
      <main className="max-w-3xl mx-auto px-4 py-12">
        <article>
          {/* Breadcrumbs */}
          <div className="mb-4 text-sm">
            <a href="/wiki" className="text-blue-600 hover:underline">
              Wiki
            </a>
            {page.category && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">{page.category}</span>
              </>
            )}
          </div>

          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{page.title}</h1>
            <div className="text-gray-500 text-sm">
              Last updated: {formattedDate}
            </div>
          </header>

          {/* Content */}
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content }}
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
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          The wiki page you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <a href="/wiki" className="text-blue-600 hover:underline">
          &larr; Back to Wiki
        </a>
      </div>
    </div>
  );
}
