import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { NostrEvent } from 'nostr-tools';
import {
  generateRobotsMetaContent,
  DEFAULT_INDEXABILITY,
} from '@buildit/shared/types';
import { fetchEventById } from '../../lib/nostr';
import { CTABanner } from '../../components/CTABanner';
import {
  generateEventSeoMeta,
  generateBreadcrumbStructuredData,
  type SeoEvent,
} from '../../seo';

interface ParsedEvent {
  id: string;
  title: string;
  description: string;
  content: string;
  startTime: number | null;
  endTime: number | null;
  location: string | undefined;
  isOnline: boolean;
  image?: string;
  organizer?: string;
  tags: string[];
}

function parseEventFromNostr(event: NostrEvent): ParsedEvent {
  const getTag = (name: string): string | undefined => {
    const tag = event.tags.find((t: string[]) => t[0] === name);
    return tag ? tag[1] : undefined;
  };

  const startTag = getTag('start');
  const endTag = getTag('end');
  const locationTag = getTag('location');

  return {
    id: event.id,
    title: getTag('title') || getTag('name') || 'Untitled Event',
    description: getTag('summary') || event.content.slice(0, 200),
    content: event.content,
    startTime: startTag ? parseInt(startTag) * 1000 : null,
    endTime: endTag ? parseInt(endTag) * 1000 : null,
    location: locationTag,
    isOnline: locationTag?.toLowerCase().includes('online') || false,
    image: getTag('image'),
    organizer: getTag('organizer'),
    tags: event.tags.filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1]),
  };
}

const getEvent = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<ParsedEvent> => {
    const event = await fetchEventById(id);
    if (!event) {
      throw notFound();
    }
    return parseEventFromNostr(event);
  });

export const Route = createFileRoute('/events/$id')({
  loader: async ({ params }) => {
    const event = await getEvent({ data: params.id });
    return { event };
  },
  head: ({ loaderData }) => {
    const data = loaderData as { event: ParsedEvent } | undefined;
    if (!data) {
      return { meta: [{ title: 'Event | BuildIt Network' }] };
    }
    const { event } = data;
    const seoEvent: SeoEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      isOnline: event.isOnline,
      image: event.image,
      organizer: event.organizer,
      tags: event.tags,
    };
    const seo = generateEventSeoMeta(seoEvent);
    const breadcrumbs = generateBreadcrumbStructuredData([
      { name: 'Home', url: 'https://buildit.network' },
      { name: 'Events', url: 'https://buildit.network/events' },
      { name: event.title, url: `https://buildit.network/events/${event.id}` },
    ]);

    return {
      meta: [
        { title: `${event.title} | BuildIt Network` },
        ...seo.meta,
      ],
      links: seo.links,
      scripts: [
        { type: 'application/ld+json', children: seo.structuredData },
        { type: 'application/ld+json', children: breadcrumbs },
      ],
    };
  },
  component: EventDetailPage,
  notFoundComponent: NotFound,
});

function EventDetailPage() {
  const loaderData = Route.useLoaderData() as { event: ParsedEvent } | undefined;
  if (!loaderData) {
    return null;
  }
  const { event } = loaderData;

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'TBD';
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div>
      {/* Event Header */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container container-md">
          {/* Breadcrumb */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Link to="/events" className="link" style={{ fontSize: '0.875rem' }}>
              ← Back to Events
            </Link>
          </div>

          {/* Event Image */}
          {event.image && (
            <img
              src={event.image}
              alt={event.title}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '300px',
                objectFit: 'cover',
                borderRadius: 'var(--radius)',
                marginBottom: '2rem',
              }}
            />
          )}

          {/* Event Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
            }}
          >
            {/* Main Content */}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '1rem' }}>
                {event.isOnline ? (
                  <span className="badge badge-primary">Online Event</span>
                ) : (
                  <span className="badge badge-secondary">In Person</span>
                )}
              </div>

              <h1
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: '1rem',
                }}
              >
                {event.title}
              </h1>

              <p
                className="text-muted"
                style={{
                  fontSize: '1.125rem',
                  lineHeight: 1.6,
                  marginBottom: '1.5rem',
                }}
              >
                {event.description}
              </p>

              {event.tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginBottom: '1.5rem',
                  }}
                >
                  {event.tags.map((tag) => (
                    <span key={tag} className="badge badge-secondary">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Event Details Card */}
            <div
              className="card card-shadow"
              style={{ padding: '1.5rem', height: 'fit-content' }}
            >
              <h2
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Event Details
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Date & Time */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>📅</span>
                    <span style={{ fontWeight: 500 }}>Date & Time</span>
                  </div>
                  <div className="text-muted" style={{ paddingLeft: '1.75rem' }}>
                    <p style={{ margin: 0 }}>{formatDate(event.startTime)}</p>
                    {event.startTime && (
                      <p style={{ margin: 0, fontSize: '0.875rem' }}>
                        {formatTime(event.startTime)}
                        {event.endTime && ` - ${formatTime(event.endTime)}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Location */}
                {event.location && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>📍</span>
                      <span style={{ fontWeight: 500 }}>Location</span>
                    </div>
                    <p
                      className="text-muted"
                      style={{ margin: 0, paddingLeft: '1.75rem' }}
                    >
                      {event.location}
                    </p>
                  </div>
                )}

                {/* Organizer */}
                {event.organizer && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>👤</span>
                      <span style={{ fontWeight: 500 }}>Organizer</span>
                    </div>
                    <p
                      className="text-muted"
                      style={{ margin: 0, paddingLeft: '1.75rem' }}
                    >
                      {event.organizer}
                    </p>
                  </div>
                )}
              </div>

              <a
                href="https://app.buildit.network/login"
                className="btn btn-primary btn-lg"
                style={{
                  width: '100%',
                  marginTop: '1.5rem',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                RSVP on BuildIt
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Event Content */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-md">
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            About This Event
          </h2>
          <div
            className="prose"
            style={{ maxWidth: 'none' }}
            dangerouslySetInnerHTML={{ __html: event.content }}
          />
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            variant="minimal"
            title="Want to create your own events?"
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
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📅</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Event Not Found
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          The event you're looking for doesn't exist or has ended.
        </p>
        <Link
          to="/events"
          className="btn btn-outline btn-md"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Events
        </Link>
      </div>
    </div>
  );
}
