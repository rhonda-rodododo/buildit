/**
 * Wiki Search Provider
 * Provides search indexing and formatting for the Wiki module
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
// Types (Wiki module types)
// ============================================================================

interface WikiPage {
  id: string;
  groupId: string;
  title: string;
  content: string; // Markdown content
  slug: string;
  parentId?: string;
  category?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  visibility: 'public' | 'group' | 'private';
  tags?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Strip markdown formatting and extract plain text
 */
function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  return markdown
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create an excerpt from wiki content
 */
function createExcerpt(content: string, maxLength: number = 200): string {
  const plain = stripMarkdown(content);
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// Wiki Search Provider
// ============================================================================

export const wikiSearchProvider: ModuleSearchProvider = {
  moduleType: 'wiki',

  /**
   * Index a wiki page for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const page = entity as WikiPage;
    if (!page || !page.id) return null;

    // Extract plain text from markdown
    const plainContent = stripMarkdown(page.content || '');

    return {
      id: `wiki:${page.id}`,
      moduleType: 'wiki',
      entityId: page.id,
      groupId,
      title: page.title || 'Untitled Page',
      content: plainContent,
      tags: page.tags || [],
      excerpt: createExcerpt(page.content, 200),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      authorPubkey: page.createdBy,
      facets: {
        visibility: page.visibility,
        ...(page.category && { category: page.category }),
        hasParent: !!page.parentId,
        ...(page.parentId && { parentId: page.parentId }),
        slug: page.slug,
        version: page.version,
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for wiki pages
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'hasParent',
        label: 'Is Subpage',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a wiki page search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const page = result.document;
    const visibility = page.facets?.visibility as string;
    const category = page.facets?.category as string | undefined;

    const badges: FormattedSearchResult['badges'] = [];

    if (category) {
      badges.push({ label: category, variant: 'secondary' });
    }

    if (visibility === 'public') {
      badges.push({ label: 'Public', variant: 'outline' });
    } else if (visibility === 'private') {
      badges.push({ label: 'Private', variant: 'outline' });
    }

    return {
      title: page.title || 'Untitled Page',
      subtitle: 'Wiki',
      icon: 'book-open',
      path: `/groups/${page.groupId}/wiki/${page.facets?.slug || page.entityId}`,
      preview: result.highlightedExcerpt || page.excerpt,
      timestamp: page.updatedAt,
      badges,
    };
  },

  /**
   * Enhance query with wiki-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const wikiExpansions: Record<string, string[]> = {
      wiki: ['knowledge', 'documentation', 'guide', 'page'],
      docs: ['documentation', 'wiki', 'guide', 'reference'],
      guide: ['documentation', 'tutorial', 'howto', 'wiki'],
      howto: ['guide', 'tutorial', 'instructions'],
      faq: ['questions', 'answers', 'help'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = wikiExpansions[keyword.toLowerCase()];
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
   * Get all wiki pages for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    try {
      return await dal.query<WikiPage>('wikiPages', {
        whereClause: { groupId },
      });
    } catch (error) {
      console.error('Failed to fetch wiki pages for indexing:', error);
      return [];
    }
  },
};

export default wikiSearchProvider;
