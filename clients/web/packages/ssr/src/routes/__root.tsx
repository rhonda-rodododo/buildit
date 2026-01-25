import {
  createRootRoute,
  Outlet,
  HeadContent,
  Scripts,
  Link,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  notFoundComponent: NotFoundPage,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#3b82f6' },
      // Default site meta (overridden by individual routes)
      { title: 'BuildIt Network - Privacy-First Organizing Platform' },
      {
        name: 'description',
        content:
          'A privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, unions, and community organizers.',
      },
      // Open Graph defaults
      { property: 'og:site_name', content: 'BuildIt Network' },
      { property: 'og:type', content: 'website' },
      // Twitter defaults
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <div
        className="bg-gradient-main"
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <PublicHeader />
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <div style={{ padding: '4rem 0' }}>
      <div className="container container-md" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          Page Not Found
        </h1>
        <p
          className="text-muted"
          style={{
            fontSize: '1.125rem',
            marginBottom: '2rem',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Sorry, we couldn't find the page you're looking for. It might have
          been moved or doesn't exist.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            to="/"
            className="btn btn-primary btn-lg"
            style={{ textDecoration: 'none' }}
          >
            Go Home
          </Link>
          <Link
            to="/articles"
            className="btn btn-outline btn-lg"
            style={{ textDecoration: 'none' }}
          >
            Browse Articles
          </Link>
        </div>
      </div>
    </div>
  );
}
