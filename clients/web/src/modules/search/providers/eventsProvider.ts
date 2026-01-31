/**
 * Events Search Provider
 * Provides search indexing and formatting for the Events module
 */

import type {
  ModuleSearchProvider,
  SearchDocument,
  SearchResult,
  FormattedSearchResult,
  FacetDefinition,
  ParsedQuery,
} from '../types';
import { dal } from '@/core/storage/dal';

// ============================================================================
// Types (Events module types)
// ============================================================================

interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime?: number;
  isRecurring: boolean;
  privacy: 'public' | 'group' | 'private' | 'direct-action';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  campaignId?: string;
  maxAttendees?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an excerpt from event description
 */
function createExcerpt(description: string | undefined, maxLength: number = 200): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  return description.slice(0, maxLength).trim() + '...';
}

/**
 * Format event date for display
 */
function formatEventDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================================================
// Events Search Provider
// ============================================================================

export const eventsSearchProvider: ModuleSearchProvider = {
  moduleType: 'events',

  /**
   * Index an event for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const event = entity as Event;
    if (!event || !event.id) return null;

    // Combine searchable text
    const searchableContent = [
      event.description,
      event.location,
    ].filter(Boolean).join(' ');

    return {
      id: `events:${event.id}`,
      moduleType: 'events',
      entityId: event.id,
      groupId,
      title: event.title || 'Untitled Event',
      content: searchableContent,
      tags: event.tags || [],
      excerpt: createExcerpt(event.description, 200),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      authorPubkey: event.createdBy,
      facets: {
        privacy: event.privacy,
        startTime: event.startTime,
        ...(event.endTime !== undefined && { endTime: event.endTime }),
        isRecurring: event.isRecurring,
        hasLocation: !!event.location,
        hasCampaign: !!event.campaignId,
        ...(event.campaignId && { campaignId: event.campaignId }),
        isPast: event.startTime < Date.now(),
        isUpcoming: event.startTime > Date.now(),
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for events
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'privacy',
        label: 'Privacy',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'isRecurring',
        label: 'Recurring',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'hasLocation',
        label: 'Has Location',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'isPast',
        label: 'Past Events',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'isUpcoming',
        label: 'Upcoming Events',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'campaignId',
        label: 'Campaign',
        type: 'keyword',
        multiSelect: true,
      },
    ];
  },

  /**
   * Format an event search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const event = result.document;
    const privacy = event.facets?.privacy as string;
    const startTime = event.facets?.startTime as number | undefined;
    const isUpcoming = event.facets?.isUpcoming;

    const badges: FormattedSearchResult['badges'] = [];

    if (isUpcoming) {
      badges.push({ label: 'Upcoming', variant: 'default' });
    }

    if (privacy === 'direct-action') {
      badges.push({ label: 'Direct Action', variant: 'secondary' });
    } else if (privacy === 'private') {
      badges.push({ label: 'Private', variant: 'outline' });
    }

    // Add date as subtitle
    const subtitle = startTime
      ? formatEventDate(startTime)
      : 'Event';

    return {
      title: event.title || 'Untitled Event',
      subtitle,
      icon: 'calendar',
      path: `/groups/${event.groupId}/events/${event.entityId}`,
      preview: result.highlightedExcerpt || event.excerpt,
      timestamp: event.updatedAt,
      badges,
    };
  },

  /**
   * Enhance query with event-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const eventExpansions: Record<string, string[]> = {
      meeting: ['event', 'gathering', 'session'],
      rally: ['event', 'march', 'protest', 'demonstration'],
      action: ['event', 'protest', 'rally', 'demonstration'],
      party: ['event', 'celebration', 'gathering'],
      workshop: ['event', 'training', 'session'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = eventExpansions[keyword.toLowerCase()];
      if (expansion) {
        for (const term of expansion) {
          if (!enhancedTerms.includes(term)) {
            enhancedTerms.push(term);
          }
        }
      }
    }

    // Handle temporal intent
    if (query.intent?.type === 'temporal') {
      const direction = query.intent.params.direction;
      if (direction === 'future') {
        // Add filter for upcoming events
        query.filters.push({
          field: 'isUpcoming',
          operator: 'eq',
          value: true,
        });
      } else if (direction === 'past') {
        // Add filter for past events
        query.filters.push({
          field: 'isPast',
          operator: 'eq',
          value: true,
        });
      }
    }

    return {
      ...query,
      expandedTerms: enhancedTerms,
    };
  },

  /**
   * Get all events for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    try {
      return await dal.query<Event>('events', {
        whereClause: { groupId },
      });
    } catch (error) {
      console.error('Failed to fetch events for indexing:', error);
      return [];
    }
  },
};

export default eventsSearchProvider;
