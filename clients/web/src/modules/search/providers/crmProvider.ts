/**
 * CRM Search Provider
 * Provides search indexing and formatting for the CRM module
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
// Types (CRM module types)
// ============================================================================

interface Contact {
  id: string;
  groupId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  organizerPubkey: string;
  status: 'active' | 'inactive' | 'prospective' | 'lost';
  source?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastContactedAt?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create searchable content from contact fields
 */
function createSearchableContent(contact: Contact): string {
  const parts = [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.notes,
    contact.source,
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Create an excerpt from contact notes
 */
function createExcerpt(notes: string | undefined, maxLength: number = 150): string {
  if (!notes) return '';
  if (notes.length <= maxLength) return notes;
  return notes.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// CRM Search Provider
// ============================================================================

export const crmSearchProvider: ModuleSearchProvider = {
  moduleType: 'crm',

  /**
   * Index a contact for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const contact = entity as Contact;
    if (!contact || !contact.id) return null;

    return {
      id: `crm:${contact.id}`,
      moduleType: 'crm',
      entityId: contact.id,
      groupId,
      title: contact.displayName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown Contact',
      content: createSearchableContent(contact),
      tags: contact.tags || [],
      excerpt: createExcerpt(contact.notes, 150),
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      authorPubkey: contact.organizerPubkey,
      facets: {
        status: contact.status,
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        hasNotes: !!contact.notes,
        ...(contact.source && { source: contact.source }),
        recentlyContacted: contact.lastContactedAt
          ? (Date.now() - contact.lastContactedAt < 30 * 24 * 60 * 60 * 1000) // 30 days
          : false,
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for CRM
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'status',
        label: 'Status',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'source',
        label: 'Source',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'hasEmail',
        label: 'Has Email',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'hasPhone',
        label: 'Has Phone',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'recentlyContacted',
        label: 'Recently Contacted',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a CRM contact search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const contact = result.document;
    const status = contact.facets?.status as Contact['status'];
    const hasEmail = contact.facets?.hasEmail;
    const hasPhone = contact.facets?.hasPhone;

    const badges: FormattedSearchResult['badges'] = [];

    // Status badge
    if (status) {
      const statusVariant = status === 'active' ? 'default' :
        status === 'prospective' ? 'secondary' : 'outline';
      badges.push({ label: status.charAt(0).toUpperCase() + status.slice(1), variant: statusVariant });
    }

    // Contact info badges
    if (hasEmail) {
      badges.push({ label: 'Email', variant: 'outline' });
    }
    if (hasPhone) {
      badges.push({ label: 'Phone', variant: 'outline' });
    }

    // Add tags (limited)
    contact.tags.slice(0, 2).forEach((tag) => {
      badges.push({ label: tag, variant: 'outline' });
    });

    return {
      title: contact.title,
      subtitle: 'Contact',
      icon: 'user',
      path: `/groups/${contact.groupId}/crm/contacts/${contact.entityId}`,
      preview: result.highlightedExcerpt || contact.excerpt,
      timestamp: contact.updatedAt,
      badges: badges.slice(0, 4), // Limit badges
    };
  },

  /**
   * Enhance query with CRM-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const crmExpansions: Record<string, string[]> = {
      contact: ['person', 'member', 'volunteer'],
      lead: ['prospective', 'potential', 'new'],
      member: ['contact', 'supporter', 'volunteer'],
      volunteer: ['member', 'helper', 'supporter'],
      donor: ['supporter', 'contributor', 'funder'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = crmExpansions[keyword.toLowerCase()];
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
   * Get all contacts for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    const db = getDB();
    if (!db.crmContacts) return [];

    try {
      const contacts = await db.crmContacts
        .where('groupId')
        .equals(groupId)
        .toArray();

      return contacts;
    } catch (error) {
      console.error('Failed to fetch CRM contacts for indexing:', error);
      return [];
    }
  },
};

export default crmSearchProvider;
