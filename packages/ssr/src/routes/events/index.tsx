import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { NostrEvent } from 'nostr-tools';
import { fetchPublicEvents } from '../../lib/nostr';
import { CTABanner } from '../../components/CTABanner';

const getEvents = createServerFn({ method: 'GET' }).handler(async (): Promise<NostrEvent[]> => {
  const events = await fetchPublicEvents({ limit: 50 });
  return events;
});

export const Route = createFileRoute('/events/')({
  head: () => ({
    meta: [
      { title: 'Events | BuildIt Network' },
      {
        name: 'description',
        content:
          'Discover upcoming events, meetings, and gatherings from the BuildIt Network community.',
      },
      { property: 'og:title', content: 'Events | BuildIt Network' },
      {
        property: 'og:description',
        content: 'Community events and gatherings for organizers',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://buildit.network/events' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://buildit.network/events' }],
  }),
  loader: async () => {
    const events = await getEvents();
    return { events };
  },
  component: EventsPage,
});

interface ParsedEvent {
  id: string;
  title: string;
  description: string;
  startTime: number | null;
  endTime: number | null;
  location: string | undefined;
  isOnline: boolean;
}

function EventsPage() {
  const loaderData = Route.useLoaderData() as { events: NostrEvent[] } | undefined;
  const events = loaderData?.events ?? [];

  // Parse events from Nostr events
  const parsedEvents: ParsedEvent[] = events.map((event: NostrEvent) => {
    const getTag = (name: string): string | undefined => {
      const tag = event.tags.find((t: string[]) => t[0] === name);
      return tag ? tag[1] : undefined;
    };

    const startTag = getTag('start');
    const endTag = getTag('end');

    return {
      id: event.id,
      title: getTag('title') || getTag('name') || 'Untitled Event',
      description: event.content.slice(0, 200) || getTag('summary') || '',
      startTime: startTag ? parseInt(startTag) * 1000 : null,
      endTime: endTag ? parseInt(endTag) * 1000 : null,
      location: getTag('location'),
      isOnline: getTag('location')?.toLowerCase().includes('online') || false,
    };
  });

  // Sort by start time (upcoming first)
  const sortedEvents = parsedEvents
    .filter((e) => e.startTime && e.startTime > Date.now() - 86400000) // Include events from last 24h
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  return (
    <div>
      {/* Page Header */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="container container-lg">
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Events
          </h1>
          <p
            className="text-muted"
            style={{ fontSize: '1.125rem', maxWidth: '600px' }}
          >
            Discover upcoming events, meetings, and gatherings from the BuildIt
            community.
          </p>
        </div>
      </section>

      {/* Events List */}
      <section style={{ padding: '0 0 3rem' }}>
        <div className="container container-lg">
          {sortedEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '1.5rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              }}
            >
              {sortedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container container-lg">
          <CTABanner
            variant="minimal"
            title="Want to host your own events?"
            primaryCTA="Get Started"
          />
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="card"
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
      <h2
        style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}
      >
        No upcoming events
      </h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Check back soon for community events and gatherings.
      </p>
      <Link
        to="/"
        className="btn btn-outline btn-md"
        style={{ textDecoration: 'none' }}
      >
        Back to Home
      </Link>
    </div>
  );
}

function EventCard({ event }: { event: ParsedEvent }) {
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'TBD';
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <article
      className="card card-shadow"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {event.isOnline ? (
            <span className="badge badge-primary">Online</span>
          ) : (
            <span className="badge badge-secondary">In Person</span>
          )}
        </div>
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          {event.title}
        </h3>
        {event.description && (
          <p
            className="text-muted line-clamp-2"
            style={{ fontSize: '0.875rem' }}
          >
            {event.description}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📆</span>
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>
            {formatDate(event.startTime)}
            {event.startTime && ` at ${formatTime(event.startTime)}`}
          </span>
        </div>
        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>📍</span>
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {event.location}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
