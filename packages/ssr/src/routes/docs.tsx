import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/docs')({
  head: () => ({
    meta: [
      { title: 'Documentation | BuildIt Network' },
      {
        name: 'description',
        content:
          'BuildIt Network documentation, guides, and developer resources.',
      },
      { property: 'og:title', content: 'Documentation | BuildIt Network' },
      {
        property: 'og:description',
        content: 'Guides and resources for BuildIt Network',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/docs' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/docs' }],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <div>
      {/* Page Header */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="container container-md">
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Documentation
          </h1>
          <p className="text-muted" style={{ fontSize: '1.125rem' }}>
            Guides, resources, and developer documentation for BuildIt Network.
          </p>
        </div>
      </section>

      {/* Documentation Links */}
      <section style={{ padding: '0 0 4rem' }}>
        <div className="container container-md">
          <div
            style={{
              display: 'grid',
              gap: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            {/* Wiki */}
            <Link
              to="/wiki"
              className="card card-shadow"
              style={{
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📚</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Wiki
              </h2>
              <p
                className="text-muted"
                style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}
              >
                Collaborative knowledge base with guides, how-tos, and community
                documentation.
              </p>
              <span className="link" style={{ fontSize: '0.875rem' }}>
                Browse wiki →
              </span>
            </Link>

            {/* Articles */}
            <Link
              to="/articles"
              className="card card-shadow"
              style={{
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Articles
              </h2>
              <p
                className="text-muted"
                style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}
              >
                Tutorials, guides, and insights for digital organizing from the
                community.
              </p>
              <span className="link" style={{ fontSize: '0.875rem' }}>
                Read articles →
              </span>
            </Link>

            {/* GitHub Docs */}
            <a
              href="https://github.com/buildn/buildit-network#readme"
              className="card card-shadow"
              style={{
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💻</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Developer Docs
              </h2>
              <p
                className="text-muted"
                style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}
              >
                Technical documentation, API references, and contribution guides
                on GitHub.
              </p>
              <span className="link" style={{ fontSize: '0.875rem' }}>
                View on GitHub →
              </span>
            </a>

            {/* Nostr Protocol */}
            <a
              href="https://nostr.com"
              className="card card-shadow"
              style={{
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🟣</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Nostr Protocol
              </h2>
              <p
                className="text-muted"
                style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}
              >
                Learn about the decentralized protocol that powers BuildIt
                Network.
              </p>
              <span className="link" style={{ fontSize: '0.875rem' }}>
                Learn about Nostr →
              </span>
            </a>
          </div>

          {/* Additional Resources */}
          <div
            className="card"
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: 'var(--muted)',
            }}
          >
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
              }}
            >
              Quick Links
            </h3>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <Link to="/about" className="link" style={{ fontSize: '0.875rem' }}>
                About BuildIt Network
              </Link>
              <Link to="/privacy" className="link" style={{ fontSize: '0.875rem' }}>
                Privacy Policy
              </Link>
              <a
                href="https://github.com/buildn/buildit-network/issues"
                className="link"
                style={{ fontSize: '0.875rem' }}
              >
                Report an Issue
              </a>
              <a
                href="https://github.com/nostr-protocol/nips"
                className="link"
                style={{ fontSize: '0.875rem' }}
              >
                Nostr NIPs
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
