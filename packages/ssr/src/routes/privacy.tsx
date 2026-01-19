import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy | BuildIt Network' },
      {
        name: 'description',
        content:
          'BuildIt Network privacy policy. Learn how we protect your data with end-to-end encryption and the Nostr protocol.',
      },
      { property: 'og:title', content: 'Privacy Policy | BuildIt Network' },
      {
        property: 'og:description',
        content: 'How BuildIt Network protects your privacy',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/privacy' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/privacy' }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-muted" style={{ fontSize: '1rem' }}>
            Last updated: January 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: '0 0 4rem' }}>
        <div className="container container-md">
          <div className="prose" style={{ maxWidth: 'none' }}>
            <h2>Our Privacy Commitment</h2>
            <p>
              BuildIt Network is built with privacy as a core principle, not an afterthought.
              We use end-to-end encryption and the decentralized Nostr protocol to minimize
              the data we can access and maximize your control over your information.
            </p>

            <h2>Data We Cannot Access</h2>
            <p>
              Due to our use of end-to-end encryption (NIP-17/NIP-44), we <strong>cannot</strong> read:
            </p>
            <ul>
              <li>Your private messages (direct messages and group chats)</li>
              <li>Private group content and discussions</li>
              <li>Encrypted files you share within groups</li>
              <li>Your private keys or passwords</li>
            </ul>
            <p>
              This data is encrypted on your device before being transmitted, and only
              you and your intended recipients hold the keys to decrypt it.
            </p>

            <h2>Public Content</h2>
            <p>
              Some content on BuildIt Network is intentionally public:
            </p>
            <ul>
              <li>Public articles you choose to publish</li>
              <li>Public wiki pages</li>
              <li>Public events (when you mark them as public)</li>
              <li>Your public profile information</li>
            </ul>
            <p>
              This content is published to Nostr relays and is visible to anyone. You
              have full control over what you make public through privacy settings
              on each piece of content.
            </p>

            <h2>Your Nostr Identity</h2>
            <p>
              Your identity on BuildIt Network is based on cryptographic keys:
            </p>
            <ul>
              <li>
                <strong>Public Key (npub)</strong>: This is your public identifier, similar
                to a username. It's visible to others and used to find and verify you.
              </li>
              <li>
                <strong>Private Key (nsec)</strong>: This is your secret key. We never
                have access to it. It's stored locally on your device and you should
                back it up securely.
              </li>
            </ul>

            <h2>Local Storage</h2>
            <p>
              BuildIt Network stores data locally on your device using IndexedDB:
            </p>
            <ul>
              <li>Your messages and conversations</li>
              <li>Group data and content</li>
              <li>Cached public content for offline access</li>
              <li>Your preferences and settings</li>
            </ul>
            <p>
              This data stays on your device unless you explicitly sync it to
              Nostr relays.
            </p>

            <h2>Relay Communication</h2>
            <p>
              BuildIt Network communicates with Nostr relays to send and receive data.
              Relays may log:
            </p>
            <ul>
              <li>Your IP address when connecting</li>
              <li>Timestamps of your connections</li>
              <li>Encrypted message metadata (sender/recipient public keys, timestamps)</li>
            </ul>
            <p>
              We recommend using a VPN or Tor if you need to protect your IP address.
              The actual content of encrypted messages remains unreadable to relays.
            </p>

            <h2>Analytics</h2>
            <p>
              This public website (buildit.network) may use privacy-respecting analytics
              to understand how people find and use the site. We do not track individual
              users or use invasive tracking technologies.
            </p>

            <h2>Third-Party Services</h2>
            <p>
              The public site uses:
            </p>
            <ul>
              <li><strong>Cloudflare</strong> for hosting and DDoS protection</li>
              <li><strong>Google Fonts</strong> for typography (Inter font family)</li>
            </ul>

            <h2>Your Rights</h2>
            <p>
              Because BuildIt Network is built on decentralized, user-controlled
              infrastructure:
            </p>
            <ul>
              <li>
                <strong>Data Portability</strong>: Your data is yours. You can export
                it and use it with any Nostr-compatible application.
              </li>
              <li>
                <strong>Right to Delete</strong>: You can delete your local data at
                any time. Published public content on Nostr relays may persist, but
                you can request deletion from specific relays.
              </li>
              <li>
                <strong>No Lock-in</strong>: You can leave at any time and take your
                identity (keys) with you.
              </li>
            </ul>

            <h2>Contact</h2>
            <p>
              If you have questions about this privacy policy or how BuildIt Network
              handles data, please reach out through our{' '}
              <Link to="/contact" className="link">contact page</Link> or open an
              issue on{' '}
              <a href="https://github.com/buildn/buildit-network" className="link" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Significant changes
              will be announced on the website. The "Last updated" date at the top
              indicates when the policy was last revised.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
