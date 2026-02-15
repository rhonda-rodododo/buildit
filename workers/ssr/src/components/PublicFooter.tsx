import { Link } from '@tanstack/react-router';

const APP_URL = 'https://app.buildit.network';

interface FooterLink {
  href: string;
  label: string;
  isExternal?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: 'Explore',
    links: [
      { href: '/articles', label: 'Articles' },
      { href: '/wiki', label: 'Wiki' },
      { href: '/events', label: 'Events' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { href: `${APP_URL}/login`, label: 'Get Started', isExternal: true },
      { href: '/downloads', label: 'Downloads' },
      { href: '/about', label: 'About Us' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: 'https://github.com/buildn/buildit-network', label: 'GitHub', isExternal: true },
      { href: '/docs', label: 'Documentation' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container container-xl" style={{ padding: '3rem 1rem' }}>
        {/* Main Footer Content */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '2rem',
            marginBottom: '2rem',
          }}
        >
          {/* Brand Column */}
          <div>
            <Link to="/" style={{ display: 'block', marginBottom: '1rem' }}>
              <span
                className="text-gradient"
                style={{ fontSize: '1.125rem', fontWeight: 700 }}
              >
                BuildIt Network
              </span>
            </Link>
            <p
              className="text-muted"
              style={{ fontSize: '0.875rem', lineHeight: 1.6 }}
            >
              A privacy-first organizing platform built on Nostr protocol for
              activist groups, co-ops, unions, and community organizers.
            </p>
          </div>

          {/* Link Sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                {section.title}
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.isExternal ? (
                      <a
                        href={link.href}
                        className="link-muted"
                        style={{ fontSize: '0.875rem' }}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="link-muted"
                        style={{ fontSize: '0.875rem' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <p className="text-muted" style={{ fontSize: '0.875rem', margin: 0 }}>
            &copy; {currentYear} BuildIt Network. Built with{' '}
            <a
              href="https://nostr.com"
              className="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Nostr
            </a>
            .
          </p>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              Ready to organize?
            </span>
            <a
              href={`${APP_URL}/login`}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Join Now
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          footer .container > div:last-child {
            flex-direction: row;
          }
        }
      `}</style>
    </footer>
  );
}
