import { Link, useLocation } from '@tanstack/react-router';

const APP_URL = 'https://app.buildit.network';

interface NavLink {
  href: string;
  label: string;
  isExternal?: boolean;
}

const navLinks: NavLink[] = [
  { href: '/articles', label: 'Articles' },
  { href: '/wiki', label: 'Wiki' },
  { href: '/events', label: 'Events' },
];

export function PublicHeader() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <header className="header">
      <div className="container container-xl">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 0',
          }}
        >
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', flexDirection: 'column' }}>
            <h1
              className="text-gradient"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
              }}
            >
              BuildIt Network
            </h1>
            <span
              className="text-muted"
              style={{
                fontSize: '0.75rem',
                display: 'none',
              }}
            >
              A social action network
            </span>
          </Link>

          {/* Navigation */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >
            {/* Desktop Nav Links */}
            <div
              style={{
                display: 'none',
                alignItems: 'center',
                gap: '1rem',
              }}
              className="desktop-nav"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={isActive(link.href) ? 'link' : 'link-muted'}
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: isActive(link.href) ? 500 : 400,
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Auth Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <a
                href={`${APP_URL}/login`}
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Log in
              </a>
              <a
                href={`${APP_URL}/login`}
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Get Started
              </a>
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Nav Links */}
      <div
        className="mobile-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0 1rem 0.75rem',
          overflowX: 'auto',
        }}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={isActive(link.href) ? 'link' : 'link-muted'}
            style={{
              fontSize: '0.875rem',
              fontWeight: isActive(link.href) ? 500 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
