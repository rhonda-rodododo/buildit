import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';
import { fetchCampaignBySlug, type CampaignContent } from '../../lib/nostr';
import { CTABanner } from '../../components/CTABanner';

const getCampaign = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<CampaignContent> => {
    const campaign = await fetchCampaignBySlug(slug);
    if (!campaign) {
      throw notFound();
    }
    return campaign;
  });

export const Route = createFileRoute('/campaigns/$slug')({
  loader: async ({ params }) => {
    const campaign = await getCampaign({ data: params.slug });
    return { campaign };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { campaign: CampaignContent } | undefined;
    if (!data) {
      return { meta: [{ title: 'Campaign | BuildIt Network' }] };
    }
    const { campaign } = data;
    const robotsContent = generateRobotsMetaContent(DEFAULT_INDEXABILITY);

    return {
      meta: [
        { title: `${campaign.title} | BuildIt Network` },
        {
          name: 'description',
          content: campaign.description.slice(0, 160),
        },
        { name: 'robots', content: robotsContent },
        // Open Graph
        { property: 'og:title', content: campaign.title },
        {
          property: 'og:description',
          content: campaign.description.slice(0, 160),
        },
        { property: 'og:type', content: 'website' },
        {
          property: 'og:url',
          content: `https://buildit.network/campaigns/${campaign.slug}`,
        },
        ...(campaign.image ? [{ property: 'og:image', content: campaign.image }] : []),
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: campaign.title },
        {
          name: 'twitter:description',
          content: campaign.description.slice(0, 160),
        },
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://buildit.network/campaigns/${campaign.slug}`,
        },
      ],
    };
  },
  component: CampaignPage,
  notFoundComponent: NotFound,
});

function CampaignPage() {
  const loaderData = Route.useLoaderData() as { campaign: CampaignContent } | undefined;
  if (!loaderData) {
    return null;
  }
  const { campaign } = loaderData;

  const progressPercent = Math.min(
    100,
    Math.round((campaign.currentAmount / campaign.goal) * 100)
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: campaign.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div>
      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(to right, var(--primary-alpha-10), var(--primary-alpha-5))',
          borderBottom: '1px solid var(--border)',
          padding: '3rem 0',
        }}
      >
        <div className="container container-lg">
          <div style={{ marginBottom: '1.5rem' }}>
            <Link to="/" className="link" style={{ fontSize: '0.875rem' }}>
              ← Back to Home
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '1rem' }}>
                {campaign.category.replace('-', ' ')}
              </span>
              <h1
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: '1rem',
                }}
              >
                {campaign.title}
              </h1>
              <p
                className="text-muted"
                style={{
                  fontSize: '1.125rem',
                  lineHeight: 1.6,
                  marginBottom: '1.5rem',
                }}
              >
                {campaign.description}
              </p>
            </div>

            {/* Progress Card */}
            <div
              className="card card-shadow"
              style={{ padding: '1.5rem' }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '1.5rem' }}>
                    {formatCurrency(campaign.currentAmount)}
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                    of {formatCurrency(campaign.goal)} goal
                  </span>
                </div>
                <div
                  style={{
                    height: '8px',
                    backgroundColor: 'var(--muted)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <p
                  className="text-muted"
                  style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}
                >
                  {progressPercent}% funded
                </p>
              </div>

              <a
                href="https://app.buildit.network/login"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
              >
                Donate Now
              </a>

              <p
                className="text-muted"
                style={{
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  marginTop: '0.75rem',
                }}
              >
                Secure donations powered by BuildIt Network
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Content */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container container-lg">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
            }}
          >
            {/* Main Content */}
            <div>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                About This Campaign
              </h2>
              <div
                className="prose"
                style={{ maxWidth: 'none' }}
                dangerouslySetInnerHTML={{ __html: campaign.content }}
              />
            </div>

            {/* Donation Tiers */}
            {campaign.tiers && campaign.tiers.length > 0 && (
              <div>
                <h2
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                  }}
                >
                  Donation Tiers
                </h2>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  {campaign.tiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="card"
                      style={{
                        padding: '1rem',
                        borderColor: tier.featured ? 'var(--primary)' : undefined,
                      }}
                    >
                      {tier.featured && (
                        <span
                          className="badge badge-primary"
                          style={{ marginBottom: '0.5rem' }}
                        >
                          Popular
                        </span>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <h3 style={{ fontWeight: 600 }}>{tier.name}</h3>
                        <span style={{ fontWeight: 700 }}>
                          {formatCurrency(tier.amount)}
                        </span>
                      </div>
                      {tier.description && (
                        <p
                          className="text-muted"
                          style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}
                        >
                          {tier.description}
                        </p>
                      )}
                      {tier.benefits && tier.benefits.length > 0 && (
                        <ul
                          style={{
                            fontSize: '0.875rem',
                            paddingLeft: '1rem',
                            margin: 0,
                          }}
                        >
                          {tier.benefits.map((benefit, i) => (
                            <li key={i} style={{ marginBottom: '0.25rem' }}>
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            variant="minimal"
            title="Want to start your own fundraising campaign?"
            primaryCTA="Get Started"
          />
        </div>
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 0',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💰</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Campaign Not Found
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The campaign you're looking for doesn't exist or is not public.
        </p>
        <Link
          to="/"
          className="btn btn-outline btn-md"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
