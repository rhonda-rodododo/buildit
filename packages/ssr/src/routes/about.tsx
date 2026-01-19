import { createFileRoute, Link } from '@tanstack/react-router';
import { CTABanner } from '../components/CTABanner';

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About | BuildIt Network' },
      {
        name: 'description',
        content:
          'Learn about BuildIt Network, a privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, unions, and community organizers.',
      },
      { property: 'og:title', content: 'About BuildIt Network' },
      {
        property: 'og:description',
        content: 'Privacy-first organizing platform built on Nostr',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/about' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/about' }],
  }),
  component: AboutPage,
});

function AboutPage() {
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
            About BuildIt Network
          </h1>
          <p
            className="text-muted"
            style={{ fontSize: '1.125rem' }}
          >
            A privacy-first platform built by organizers, for organizers.
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-md">
          <div className="prose" style={{ maxWidth: 'none' }}>
            <h2>Our Mission</h2>
            <p>
              BuildIt Network exists to provide activists, unions, co-ops, and community
              organizers with the tools they need to coordinate securely and effectively.
              We believe that the right to organize is fundamental, and that digital tools
              should protect—not exploit—those who use them.
            </p>

            <h2>Why Privacy Matters</h2>
            <p>
              Organizers face unique security challenges. Whether you're coordinating a
              union drive, planning community mutual aid, or building political power,
              your communications and data should remain yours. BuildIt Network uses
              end-to-end encryption powered by the Nostr protocol to ensure that only
              you and your intended recipients can access your messages.
            </p>

            <h2>Built on Nostr</h2>
            <p>
              <Link to="https://nostr.com" className="link">Nostr</Link> is a decentralized
              protocol that puts users in control. Unlike traditional platforms:
            </p>
            <ul>
              <li><strong>No central authority</strong> can shut down your community or censor your content</li>
              <li><strong>Your identity is cryptographic</strong>—you control your keys, you control your account</li>
              <li><strong>Data portability</strong> means you're never locked into a single provider</li>
              <li><strong>Open protocol</strong> ensures transparency and community-driven development</li>
            </ul>

            <h2>Features for Organizers</h2>
            <p>
              BuildIt Network provides a comprehensive suite of tools designed for
              real organizing work:
            </p>
            <ul>
              <li><strong>Secure Messaging</strong>—End-to-end encrypted DMs and group chats</li>
              <li><strong>Events & Campaigns</strong>—Coordinate actions with RSVP tracking</li>
              <li><strong>Mutual Aid</strong>—Connect those who need help with those who can provide it</li>
              <li><strong>Governance</strong>—Democratic decision-making with multiple voting systems</li>
              <li><strong>Knowledge Base</strong>—Collaborative wiki for shared resources</li>
              <li><strong>Contact Management</strong>—CRM tools built for organizers, not sales</li>
            </ul>

            <h2>Open Source</h2>
            <p>
              BuildIt Network is open source software. We believe that security tools must
              be auditable, and that the communities who use them should be able to
              contribute to their development. You can find our code on{' '}
              <Link to="https://github.com/buildn/buildit-network" className="link">
                GitHub
              </Link>.
            </p>

            <h2>Get Involved</h2>
            <p>
              Whether you're an organizer looking for better tools, a developer who wants
              to contribute, or someone who believes in the mission—we'd love to hear
              from you.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-md">
          <CTABanner
            variant="full"
            title="Ready to organize securely?"
            description="Join thousands of activists and organizers using BuildIt Network."
            primaryCTA="Create Free Account"
            secondaryCTA="Read Articles"
            secondaryLink="/articles"
          />
        </div>
      </section>
    </div>
  );
}
