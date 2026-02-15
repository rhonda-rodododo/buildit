import { createFileRoute } from '@tanstack/react-router';
import { CTABanner } from '../components/CTABanner';

const GITHUB_RELEASES_URL =
  'https://github.com/buildit-network/buildit-network/releases/latest';
const APP_VERSION = '0.1.0';

export const Route = createFileRoute('/downloads')({
  head: () => ({
    meta: [
      { title: 'Download BuildIt | BuildIt Network' },
      {
        name: 'description',
        content:
          'Download BuildIt for Linux and Android. Privacy-first organizing with end-to-end encryption, BLE mesh networking, and offline support. Free and open source.',
      },
      {
        property: 'og:title',
        content: 'Download BuildIt - Privacy-First Organizing Platform',
      },
      {
        property: 'og:description',
        content:
          'Get BuildIt for Linux desktop or Android. End-to-end encrypted, decentralized, and built for organizers.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/downloads' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Download BuildIt' },
      {
        name: 'twitter:description',
        content:
          'Privacy-first organizing on every platform. Free and open source.',
      },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/downloads' }],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  return (
    <div>
      {/* Hero Section */}
      <section style={{ padding: '4rem 0 3rem' }}>
        <div className="container container-xl">
          <div
            style={{
              maxWidth: '700px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 3rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: '1.25rem',
              }}
            >
              <span className="text-gradient">Download BuildIt</span>
            </h1>
            <p
              className="text-muted"
              style={{
                fontSize: '1.125rem',
                lineHeight: 1.6,
                maxWidth: '550px',
                margin: '0 auto 0.75rem',
              }}
            >
              Privacy-first organizing on every platform. End-to-end encrypted,
              works offline, and built for the movement.
            </p>
            <p
              className="text-muted"
              style={{ fontSize: '0.875rem' }}
            >
              Current release: <strong style={{ color: 'var(--foreground)' }}>v{APP_VERSION}</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Platform Cards */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-xl">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              maxWidth: '960px',
              margin: '0 auto',
            }}
          >
            {/* Linux Desktop */}
            <PlatformCard
              platform="Linux Desktop"
              icon={
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
              available
            >
              <p
                className="text-muted"
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  marginBottom: '1rem',
                }}
              >
                Available as AppImage (runs on any distro) and .deb package (Debian, Ubuntu, and derivatives).
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <a
                  href={GITHUB_RELEASES_URL}
                  className="btn btn-primary"
                  style={{
                    textDecoration: 'none',
                    height: '2.5rem',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download AppImage
                </a>
                <a
                  href={GITHUB_RELEASES_URL}
                  className="btn btn-outline"
                  style={{
                    textDecoration: 'none',
                    height: '2.5rem',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download .deb Package
                </a>
              </div>
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--muted)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8125rem',
                }}
              >
                <p
                  style={{ fontWeight: 600, marginBottom: '0.375rem' }}
                >
                  Install instructions
                </p>
                <p
                  className="text-muted"
                  style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    marginBottom: '0.25rem',
                  }}
                >
                  <strong>AppImage:</strong> Make executable with{' '}
                  <code
                    style={{
                      background: 'var(--card)',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    chmod +x BuildIt-*.AppImage
                  </code>{' '}
                  then run.
                </p>
                <p
                  className="text-muted"
                  style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}
                >
                  <strong>.deb:</strong> Install with{' '}
                  <code
                    style={{
                      background: 'var(--card)',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    sudo dpkg -i buildit_*.deb
                  </code>
                </p>
              </div>
              <p
                className="text-muted"
                style={{
                  fontSize: '0.75rem',
                  marginTop: '0.75rem',
                }}
              >
                Requires: Linux with GTK3 and WebKit2GTK
              </p>
            </PlatformCard>

            {/* Android */}
            <PlatformCard
              platform="Android"
              icon={
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              }
              available
            >
              <p
                className="text-muted"
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  marginBottom: '1rem',
                }}
              >
                Sideload the APK directly from GitHub Releases. Full BLE mesh networking support on Android devices.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <a
                  href={GITHUB_RELEASES_URL}
                  className="btn btn-primary"
                  style={{
                    textDecoration: 'none',
                    height: '2.5rem',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download APK
                </a>
              </div>
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--muted)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8125rem',
                }}
              >
                <p
                  style={{ fontWeight: 600, marginBottom: '0.375rem' }}
                >
                  Install instructions
                </p>
                <p
                  className="text-muted"
                  style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}
                >
                  Enable sideloading in{' '}
                  <strong>Settings &gt; Apps &gt; Install unknown apps</strong>,
                  then open the downloaded APK to install.
                </p>
              </div>
              <p
                className="text-muted"
                style={{
                  fontSize: '0.75rem',
                  marginTop: '0.75rem',
                }}
              >
                Requires: Android 8.0 (Oreo) or later
              </p>
            </PlatformCard>
          </div>

          {/* Coming Soon Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              maxWidth: '960px',
              margin: '1.5rem auto 0',
            }}
          >
            <ComingSoonCard
              platform="macOS"
              icon={
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
            />
            <ComingSoonCard
              platform="Windows"
              icon={
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
            />
            <ComingSoonCard
              platform="iOS (TestFlight)"
              icon={
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container container-xl">
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '0.75rem',
            }}
          >
            What You Get
          </h2>
          <p
            className="text-muted"
            style={{
              textAlign: 'center',
              fontSize: '1rem',
              maxWidth: '550px',
              margin: '0 auto 2.5rem',
            }}
          >
            A complete organizing toolkit designed for privacy, resilience, and
            community power.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              maxWidth: '960px',
              margin: '0 auto',
            }}
          >
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              title="End-to-End Encrypted Messaging"
              description="All private communications use NIP-17 gift-wrapped encryption. Only you and your intended recipients can read your messages."
            />
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                </svg>
              }
              title="BLE Mesh Networking"
              description="Communicate device-to-device over Bluetooth Low Energy. No cell service or internet required. Built for the field."
            />
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              }
              title="Democratic Governance"
              description="Run votes, proposals, and consensus processes. Multiple voting systems including ranked choice, approval, and simple majority."
            />
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              title="Event Organizing & Mutual Aid"
              description="Coordinate actions and events with RSVP tracking. Connect those who need help with those who can provide it."
            />
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Privacy-First Contact Management"
              description="CRM tools built for organizers, not sales teams. Track engagement across the spectrum of support without compromising anyone's privacy."
            />
            <FeatureHighlight
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              }
              title="Open Source & Decentralized"
              description="Built on the Nostr protocol. No single point of failure, no central authority. Fully auditable code you can trust."
            />
          </div>
        </div>
      </section>

      {/* Source Code Banner */}
      <section style={{ padding: '2rem 0' }}>
        <div className="container container-lg">
          <div
            className="card"
            style={{
              padding: '1.5rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '0.75rem',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Build from Source
            </h3>
            <p
              className="text-muted"
              style={{
                fontSize: '0.875rem',
                maxWidth: '500px',
                lineHeight: 1.6,
              }}
            >
              BuildIt is free and open source software. You can build it yourself,
              audit the code, or contribute improvements.
            </p>
            <a
              href="https://github.com/buildit-network/buildit-network"
              className="btn btn-outline"
              style={{ textDecoration: 'none' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            variant="full"
            title="Ready to organize securely?"
            description="Download BuildIt and start coordinating with your community. Free, open source, and built for the movement."
            primaryCTA="Download Now"
            secondaryCTA="Learn More"
            secondaryLink="/about"
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlatformCard({
  platform,
  icon,
  available,
  children,
}: {
  platform: string;
  icon: React.ReactNode;
  available?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card card-shadow"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ color: 'var(--primary)' }}>{icon}</div>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{platform}</h3>
          {available && (
            <span
              className="badge badge-primary"
              style={{ marginTop: '0.25rem' }}
            >
              Available
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ComingSoonCard({
  platform,
  icon,
}: {
  platform: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        opacity: 0.7,
      }}
    >
      <div style={{ color: 'var(--muted-foreground)' }}>{icon}</div>
      <div>
        <h3
          style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.125rem' }}
        >
          {platform}
        </h3>
        <span
          className="text-muted"
          style={{ fontSize: '0.75rem' }}
        >
          Coming soon
        </span>
      </div>
    </div>
  );
}

function FeatureHighlight({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '2.5rem',
          height: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--muted)',
          borderRadius: 'var(--radius)',
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            marginBottom: '0.25rem',
          }}
        >
          {title}
        </h3>
        <p
          className="text-muted"
          style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
