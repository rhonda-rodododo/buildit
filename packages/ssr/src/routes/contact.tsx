import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: 'Contact | BuildIt Network' },
      {
        name: 'description',
        content:
          'Get in touch with the BuildIt Network team. Find us on GitHub, Nostr, or through community channels.',
      },
      { property: 'og:title', content: 'Contact BuildIt Network' },
      {
        property: 'og:description',
        content: 'Get in touch with the BuildIt Network team',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/contact' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/contact' }],
  }),
  component: ContactPage,
});

function ContactPage() {
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
            Contact Us
          </h1>
          <p className="text-muted" style={{ fontSize: '1.125rem' }}>
            We'd love to hear from you. Here's how to get in touch.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section style={{ padding: '0 0 4rem' }}>
        <div className="container container-md">
          <div
            style={{
              display: 'grid',
              gap: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            {/* GitHub */}
            <div className="card card-shadow" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💻</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                GitHub
              </h2>
              <p
                className="text-muted"
                style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
              >
                Report bugs, request features, or contribute to the codebase.
              </p>
              <Link
                to="https://github.com/buildn/buildit-network"
                className="btn btn-outline btn-md"
                style={{ textDecoration: 'none' }}
              >
                Open GitHub
              </Link>
            </div>

            {/* Nostr */}
            <div className="card card-shadow" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🟣</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Nostr
              </h2>
              <p
                className="text-muted"
                style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
              >
                Follow us on Nostr for updates, discussions, and community news.
              </p>
              <Link
                to="https://njump.me/buildit"
                className="btn btn-outline btn-md"
                style={{ textDecoration: 'none' }}
              >
                Find on Nostr
              </Link>
            </div>

            {/* Community */}
            <div className="card card-shadow" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👥</div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Community
              </h2>
              <p
                className="text-muted"
                style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
              >
                Join the BuildIt Network community to connect with other organizers.
              </p>
              <Link
                to="https://app.buildit.network/login"
                className="btn btn-primary btn-md"
                style={{ textDecoration: 'none' }}
              >
                Join Community
              </Link>
            </div>
          </div>

          {/* Additional Info */}
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
              Before reaching out
            </h3>
            <ul
              className="text-muted"
              style={{
                fontSize: '0.875rem',
                paddingLeft: '1.25rem',
                margin: 0,
              }}
            >
              <li style={{ marginBottom: '0.5rem' }}>
                Check our{' '}
                <Link to="/wiki" className="link">
                  Wiki
                </Link>{' '}
                for documentation and guides
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Read{' '}
                <Link to="/articles" className="link">
                  Articles
                </Link>{' '}
                for tutorials and insights
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Search existing{' '}
                <Link
                  to="https://github.com/buildn/buildit-network/issues"
                  className="link"
                >
                  GitHub issues
                </Link>{' '}
                for known problems
              </li>
              <li>
                Review the{' '}
                <Link to="/privacy" className="link">
                  Privacy Policy
                </Link>{' '}
                for data questions
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
