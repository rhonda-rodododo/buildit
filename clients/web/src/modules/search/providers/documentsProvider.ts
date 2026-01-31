/**
 * Documents Search Provider
 * Provides search indexing and formatting for the Documents module
 */

import type { Document } from '@/modules/documents/types';
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
// Helper Functions
// ============================================================================

/**
 * Strip HTML tags and extract plain text
 */
function stripHtml(html: string): string {
  if (!html) return '';
  // Simple HTML tag removal - could use DOMParser for more accuracy
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create an excerpt from content
 */
function createExcerpt(content: string, maxLength: number = 200): string {
  const plain = stripHtml(content);
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// Documents Search Provider
// ============================================================================

export const documentsSearchProvider: ModuleSearchProvider = {
  moduleType: 'documents',

  /**
   * Index a document for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const doc = entity as Document;
    if (!doc || !doc.id) return null;

    // Extract plain text from rich content
    const plainContent = stripHtml(doc.content || '');

    return {
      id: `documents:${doc.id}`,
      moduleType: 'documents',
      entityId: doc.id,
      groupId,
      title: doc.title || 'Untitled Document',
      content: plainContent,
      tags: doc.tags || [],
      excerpt: createExcerpt(doc.content, 200),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      authorPubkey: doc.authorPubkey,
      facets: {
        isPublic: doc.isPublic,
        hasFolder: !!doc.folderId,
        ...(doc.folderId && { folderId: doc.folderId }),
        version: doc.version,
        hasTemplate: !!doc.template,
        collaboratorCount: doc.collaborators?.length || 0,
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for documents
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'isPublic',
        label: 'Visibility',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'hasFolder',
        label: 'In Folder',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'folderId',
        label: 'Folder',
        type: 'keyword',
        multiSelect: true,
      },
    ];
  },

  /**
   * Format a document search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const doc = result.document;
    const isPublic = doc.facets?.isPublic;
    const hasFolder = doc.facets?.hasFolder;

    const badges: FormattedSearchResult['badges'] = [];

    if (isPublic) {
      badges.push({ label: 'Public', variant: 'secondary' });
    }

    if (hasFolder) {
      badges.push({ label: 'In Folder', variant: 'outline' });
    }

    if (result.document.tags.length > 0) {
      // Add first 2 tags
      result.document.tags.slice(0, 2).forEach((tag) => {
        badges.push({ label: tag, variant: 'outline' });
      });
    }

    return {
      title: doc.title || 'Untitled Document',
      subtitle: 'Document',
      icon: 'file-text',
      path: `/groups/${doc.groupId}/documents/${doc.entityId}`,
      preview: result.highlightedExcerpt || doc.excerpt,
      timestamp: doc.updatedAt,
      badges,
    };
  },

  /**
   * Enhance query with document-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    // Add document-specific expansions
    const docExpansions: Record<string, string[]> = {
      doc: ['document', 'file', 'paper'],
      draft: ['document', 'unfinished', 'wip'],
      report: ['document', 'summary', 'analysis'],
      notes: ['document', 'memo', 'minutes'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = docExpansions[keyword.toLowerCase()];
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
   * Get all documents for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    try {
      return await dal.query<Document>('documents', {
        whereClause: { groupId },
      });
    } catch (error) {
      console.error('Failed to fetch documents for indexing:', error);
      return [];
    }
  },
};

export default documentsSearchProvider;
