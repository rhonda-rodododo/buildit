import { createFileRoute, Link } from '@tanstack/react-router';
import { CTABanner } from '../components/CTABanner';

const APP_URL = 'https://app.buildit.network';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'BuildIt Network - Privacy-First Organizing Platform' },
      {
        name: 'description',
        content:
          'A privacy-first organizing platform for activist groups, co-ops, unions, and community organizers. Built on Nostr protocol with end-to-end encryption.',
      },
      { property: 'og:title', content: 'BuildIt Network - Privacy-First Organizing' },
      {
        property: 'og:description',
        content: 'Privacy-first organizing platform for social action',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'BuildIt Network' },
      {
        name: 'twitter:description',
        content: 'Privacy-first organizing platform for social action',
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section style={{ padding: '4rem 0 3rem' }}>
        <div className="container container-xl">
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: '1.5rem',
              }}
            >
              <span className="text-gradient">Organize Securely.</span>
              <br />
              Build Power Together.
            </h1>
            <p
              className="text-muted"
              style={{
                fontSize: '1.25rem',
                lineHeight: 1.6,
                marginBottom: '2rem',
                maxWidth: '600px',
                margin: '0 auto 2rem',
              }}
            >
              A privacy-first platform for activist groups, co-ops, unions, and
              community organizers. End-to-end encrypted. Decentralized. Built for
              the movement.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
            >
              <a
                href={`${APP_URL}/login`}
                className="btn btn-primary btn-lg"
                style={{ textDecoration: 'none' }}
              >
                Get Started Free
              </a>
              <Link
                to="/articles"
                className="btn btn-outline btn-lg"
                style={{ textDecoration: 'none' }}
              >
                Read Articles
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container container-xl">
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '2.5rem',
            }}
          >
            Built for Organizers
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <FeatureCard
              title="End-to-End Encrypted"
              description="All private communications are encrypted using NIP-17. Only you and your intended recipients can read your messages."
              icon="🔐"
            />
            <FeatureCard
              title="Decentralized"
              description="Built on the Nostr protocol. No single point of failure. Your data, your control."
              icon="🌐"
            />
            <FeatureCard
              title="Community-First"
              description="Open source and built by organizers, for organizers. Every feature designed with real movement needs in mind."
              icon="✊"
            />
          </div>
        </div>
      </section>

      {/* Content Highlights */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container container-xl">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
            }}
          >
            <ContentSection
              title="Latest Articles"
              description="Guides, tutorials, and insights for digital organizing"
              href="/articles"
              linkText="View all articles"
            />
            <ContentSection
              title="Knowledge Base"
              description="Collaborative documentation and how-tos"
              href="/wiki"
              linkText="Browse wiki"
            />
            <ContentSection
              title="Upcoming Events"
              description="Connect with organizers and communities"
              href="/events"
              linkText="See events"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: '3rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            title="Ready to organize with privacy?"
            description="Join thousands of activists, unions, and community organizers using BuildIt Network. Free, open source, and built for the movement."
            primaryCTA="Create Free Account"
            secondaryCTA="Learn More"
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div
      className="card card-shadow"
      style={{
        padding: '1.5rem',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icon}</div>
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}

function ContentSection({
  title,
  description,
  href,
  linkText,
}: {
  title: string;
  description: string;
  href: string;
  linkText: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{title}</h3>
      <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
        {description}
      </p>
      <Link to={href} className="link" style={{ fontSize: '0.875rem' }}>
        {linkText} →
      </Link>
    </div>
  );
}
