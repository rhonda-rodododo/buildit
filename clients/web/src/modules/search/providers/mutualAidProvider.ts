/**
 * Mutual Aid Search Provider
 * Provides search indexing and formatting for the Mutual Aid module
 */

import type {
  ModuleSearchProvider,
  SearchDocument,
  SearchResult,
  FormattedSearchResult,
  FacetDefinition,
  ParsedQuery,
} from '../types';
import { getDB } from '@/core/storage/db';

// ============================================================================
// Types (Mutual Aid module types)
// ============================================================================

interface MutualAidRequest {
  id: string;
  groupId: string;
  type: 'request' | 'offer';
  category: 'material' | 'service' | 'rideshare' | 'housing' | 'food' | 'other';
  title: string;
  description: string;
  requesterPubkey: string;
  status: 'open' | 'pending' | 'fulfilled' | 'closed' | 'expired';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  tags?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an excerpt from description
 */
function createExcerpt(description: string | undefined, maxLength: number = 200): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  return description.slice(0, maxLength).trim() + '...';
}

/**
 * Get urgency display label
 */
function getUrgencyLabel(urgency: MutualAidRequest['urgency']): string | undefined {
  if (!urgency) return undefined;
  const labels: Record<NonNullable<MutualAidRequest['urgency']>, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Urgent',
  };
  return labels[urgency];
}

// ============================================================================
// Mutual Aid Search Provider
// ============================================================================

export const mutualAidSearchProvider: ModuleSearchProvider = {
  moduleType: 'mutual-aid',

  /**
   * Index a mutual aid request/offer for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const item = entity as MutualAidRequest;
    if (!item || !item.id) return null;

    // Combine searchable text
    const searchableContent = [
      item.description,
      item.location,
    ].filter(Boolean).join(' ');

    return {
      id: `mutual-aid:${item.id}`,
      moduleType: 'mutual-aid',
      entityId: item.id,
      groupId,
      title: item.title || (item.type === 'request' ? 'Request' : 'Offer'),
      content: searchableContent,
      tags: item.tags || [],
      excerpt: createExcerpt(item.description, 200),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      authorPubkey: item.requesterPubkey,
      facets: {
        type: item.type,
        category: item.category,
        status: item.status,
        ...(item.urgency && { urgency: item.urgency }),
        hasLocation: !!item.location,
        isOpen: item.status === 'open',
        isUrgent: item.urgency === 'high' || item.urgency === 'critical',
        isExpired: item.expiresAt ? item.expiresAt < Date.now() : false,
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for mutual aid
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'type',
        label: 'Type',
        type: 'keyword',
        multiSelect: false,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'urgency',
        label: 'Urgency',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'isOpen',
        label: 'Open',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'isUrgent',
        label: 'Urgent',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'hasLocation',
        label: 'Has Location',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a mutual aid search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const item = result.document;
    const type = item.facets?.type as MutualAidRequest['type'];
    const category = item.facets?.category as string;
    const urgency = item.facets?.urgency as MutualAidRequest['urgency'];
    const isOpen = item.facets?.isOpen;

    const badges: FormattedSearchResult['badges'] = [];

    // Type badge
    badges.push({
      label: type === 'request' ? 'Request' : 'Offer',
      variant: type === 'request' ? 'default' : 'secondary',
    });

    // Category badge
    if (category) {
      badges.push({ label: category, variant: 'outline' });
    }

    // Urgency badge for urgent items
    const urgencyLabel = getUrgencyLabel(urgency);
    if (urgencyLabel && (urgency === 'high' || urgency === 'critical')) {
      badges.push({ label: urgencyLabel, variant: 'default' });
    }

    // Status indicator
    if (!isOpen) {
      badges.push({ label: 'Closed', variant: 'outline' });
    }

    return {
      title: item.title || (type === 'request' ? 'Request' : 'Offer'),
      subtitle: 'Mutual Aid',
      icon: type === 'request' ? 'hand-helping' : 'gift',
      path: `/groups/${item.groupId}/mutual-aid/${item.entityId}`,
      preview: result.highlightedExcerpt || item.excerpt,
      timestamp: item.updatedAt,
      badges: badges.slice(0, 3), // Limit to 3 badges
    };
  },

  /**
   * Enhance query with mutual aid-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const aidExpansions: Record<string, string[]> = {
      help: ['request', 'need', 'assistance', 'support'],
      need: ['request', 'help', 'required', 'urgent'],
      offer: ['provide', 'give', 'share', 'donate'],
      ride: ['rideshare', 'transport', 'carpool', 'lift'],
      food: ['meal', 'groceries', 'supplies'],
      housing: ['shelter', 'accommodation', 'room'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = aidExpansions[keyword.toLowerCase()];
      if (expansion) {
        for (const term of expansion) {
          if (!enhancedTerms.includes(term)) {
            enhancedTerms.push(term);
          }
        }
      }
    }

    return {
      ...query,
      expandedTerms: enhancedTerms,
    };
  },

  /**
   * Get all mutual aid items for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    const db = getDB();
    if (!db.mutualAidRequests) return [];

    try {
      const items = await db.mutualAidRequests
        .where('groupId')
        .equals(groupId)
        .toArray();

      return items;
    } catch (error) {
      console.error('Failed to fetch mutual aid items for indexing:', error);
      return [];
    }
  },
};

export default mutualAidSearchProvider;
