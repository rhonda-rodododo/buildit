/**
 * Events → Social Publishing Integration
 *
 * Reads from the events store to provide public events for sharing
 * and cross-posting through the social-publishing system.
 */

import { logger } from '@/lib/logger';

export interface ShareableEvent {
  id: string;
  title: string;
  description: string;
  startAt: number;
  endAt?: number;
  location?: string;
  visibility: string;
  sourceModule: 'events';
  sourceContentId: string;
}

/**
 * Events Integration
 * Adapts events from events module for social-publishing
 */
export class EventsIntegration {
  private static instance: EventsIntegration | null = null;

  static getInstance(): EventsIntegration {
    if (!this.instance) {
      this.instance = new EventsIntegration();
    }
    return this.instance;
  }

  /**
   * Get public events that can be shared and cross-posted.
   */
  async getShareableEvents(): Promise<ShareableEvent[]> {
    try {
      const { useEventsStore } = await import('@/modules/events/eventsStore');
      const store = useEventsStore.getState();

      return store.events
        .filter((e) => e.visibility === 'public')
        .map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description || '',
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location?.name || event.location?.address,
          visibility: event.visibility,
          sourceModule: 'events' as const,
          sourceContentId: event.id,
        }));
    } catch (error) {
      logger.warn('Failed to load events store for integration', { error });
      return [];
    }
  }

  /**
   * Get the public URL for an event.
   */
  getEventUrl(eventId: string): string {
    return `https://buildit.network/events/${eventId}`;
  }
}
