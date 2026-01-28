/**
 * Messages Search Provider
 * Provides search indexing and formatting for the Messaging module
 */

import type { ConversationMessage } from '@/core/storage/db';
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
// Helper Functions
// ============================================================================

/**
 * Create an excerpt from message content
 */
function createExcerpt(content: string, maxLength: number = 150): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// Messages Search Provider
// ============================================================================

export const messagesSearchProvider: ModuleSearchProvider = {
  moduleType: 'messaging',

  /**
   * Index a message for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const msg = entity as ConversationMessage;
    if (!msg || !msg.id) return null;

    return {
      id: `messaging:${msg.id}`,
      moduleType: 'messaging',
      entityId: msg.id,
      groupId,
      title: '', // Messages don't have titles
      content: msg.content || '',
      tags: [], // Messages typically don't have tags
      excerpt: createExcerpt(msg.content, 150),
      createdAt: msg.timestamp,
      updatedAt: msg.timestamp,
      authorPubkey: msg.from,
      facets: {
        conversationId: msg.conversationId,
        isEdited: msg.isEdited || false,
        hasReply: !!msg.replyTo,
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for messages
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'conversationId',
        label: 'Conversation',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'isEdited',
        label: 'Edited',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a message search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const msg = result.document;

    return {
      title: result.highlightedExcerpt || msg.excerpt || 'Message',
      subtitle: 'Message',
      icon: 'message-square',
      path: `/groups/${msg.groupId}/messages?conversation=${msg.facets?.conversationId}&message=${msg.entityId}`,
      preview: undefined, // Already shown in title
      timestamp: msg.updatedAt,
      badges: [],
    };
  },

  /**
   * Enhance query with messaging-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const msgExpansions: Record<string, string[]> = {
      dm: ['message', 'direct', 'chat'],
      chat: ['message', 'conversation', 'thread'],
      thread: ['message', 'reply', 'conversation'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = msgExpansions[keyword.toLowerCase()];
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
   * Get all messages for indexing
   * Note: This could be expensive for large message histories
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    const db = getDB();
    if (!db.conversationMessages || !db.conversations) return [];

    try {
      // First get conversations for this group
      const conversations = await db.conversations
        .where('groupId')
        .equals(groupId)
        .toArray();

      const conversationIds = conversations.map((c) => c.id);
      if (conversationIds.length === 0) return [];

      // Then get messages for those conversations
      const messages = await db.conversationMessages
        .where('conversationId')
        .anyOf(conversationIds)
        .toArray();

      return messages;
    } catch (error) {
      console.error('Failed to fetch messages for indexing:', error);
      return [];
    }
  },
};

export default messagesSearchProvider;
