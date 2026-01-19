import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'BuildIt Network - Privacy-First Organizing' },
      {
        name: 'description',
        content:
          'A privacy-first organizing platform for activist groups, co-ops, unions, and community organizers. Built on Nostr protocol with end-to-end encryption.',
      },
      { property: 'og:title', content: 'BuildIt Network' },
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
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold">BuildIt Network</span>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/articles"
                className="text-white/80 hover:text-white transition"
              >
                Articles
              </a>
              <a
                href="/wiki"
                className="text-white/80 hover:text-white transition"
              >
                Wiki
              </a>
              <a
                href="/events"
                className="text-white/80 hover:text-white transition"
              >
                Events
              </a>
              <a
                href="https://app.buildit.network"
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                Launch App
              </a>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Organize Securely.
            <br />
            Build Power Together.
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            A privacy-first platform for activist groups, co-ops, unions, and
            community organizers. End-to-end encrypted. Decentralized. Built for
            the movement.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://app.buildit.network"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              Get Started
            </a>
            <a
              href="/articles"
              className="border border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition"
            >
              Read Articles
            </a>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Organizers
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">BuildIt Network</h3>
              <p className="text-gray-400">
                Privacy-first organizing for the digital age.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="/articles" className="hover:text-white">
                    Articles
                  </a>
                </li>
                <li>
                  <a href="/wiki" className="hover:text-white">
                    Wiki
                  </a>
                </li>
                <li>
                  <a href="/events" className="hover:text-white">
                    Events
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="/about" className="hover:text-white">
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/buildit-network"
                    className="hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="/privacy" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} BuildIt Network. Open Source.</p>
          </div>
        </div>
      </footer>
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
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
