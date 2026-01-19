const APP_URL = 'https://app.buildit.network';

interface CTABannerProps {
  title?: string;
  description?: string;
  primaryCTA?: string;
  secondaryCTA?: string;
  variant?: 'default' | 'minimal';
}

export function CTABanner({
  title = 'Ready to start organizing?',
  description = 'Join thousands of activists, unions, and community organizers using BuildIt Network for privacy-first collaboration.',
  primaryCTA = 'Get Started Free',
  secondaryCTA = 'Learn More',
  variant = 'default',
}: CTABannerProps) {
  if (variant === 'minimal') {
    return (
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.5rem',
          background: 'var(--muted)',
          border: 'none',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.875rem' }}>{title}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a
            href={`${APP_URL}/login`}
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            {primaryCTA}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="cta-banner">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '1rem',
            opacity: 0.9,
            maxWidth: '600px',
            margin: 0,
          }}
        >
          {description}
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '0.5rem',
          }}
        >
          <a
            href={`${APP_URL}/login`}
            className="btn btn-lg"
            style={{
              textDecoration: 'none',
              background: 'white',
              color: 'var(--primary)',
            }}
          >
            {primaryCTA}
          </a>
          <a
            href="/about"
            className="btn btn-lg"
            style={{
              textDecoration: 'none',
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            {secondaryCTA}
          </a>
        </div>
      </div>
    </div>
  );
}
