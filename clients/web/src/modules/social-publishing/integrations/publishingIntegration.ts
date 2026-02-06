/**
 * Publishing → Social Publishing Integration
 *
 * Reads from the publishing store to provide articles for scheduling
 * and sharing through the social-publishing system.
 */

import { logger } from '@/lib/logger';

export interface SchedulableArticle {
  id: string;
  title: string;
  slug: string;
  publicationSlug: string;
  publicationName: string;
  authorName: string;
  excerpt?: string;
  sourceModule: 'publishing';
  sourceContentId: string;
}

/**
 * Publishing Integration
 * Adapts articles from publishing module for social-publishing
 */
export class PublishingIntegration {
  private static instance: PublishingIntegration | null = null;

  static getInstance(): PublishingIntegration {
    if (!this.instance) {
      this.instance = new PublishingIntegration();
    }
    return this.instance;
  }

  /**
   * Get articles that can be scheduled for publishing.
   * Reads from publishing store (draft articles with content).
   */
  async getSchedulableArticles(): Promise<SchedulableArticle[]> {
    try {
      // Dynamic import to avoid circular dependencies
      const { usePublishingStore } = await import('@/modules/publishing/publishingStore');
      const store = usePublishingStore.getState();

      return Array.from(store.articles.values())
        .filter((a) => a.status === 'draft' && a.content)
        .map((article) => {
          const publication = Array.from(store.publications.values()).find(
            (p) => p.id === article.publicationId
          );
          return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            publicationSlug: publication?.slug || '',
            publicationName: publication?.name || '',
            authorName: article.authorName || '',
            excerpt: article.excerpt,
            sourceModule: 'publishing' as const,
            sourceContentId: article.id,
          };
        });
    } catch (error) {
      logger.warn('Failed to load publishing store for integration', { error });
      return [];
    }
  }

  /**
   * Get the public URL for a published article.
   */
  getArticleUrl(publicationSlug: string, articleSlug: string): string {
    return `https://buildit.network/p/${publicationSlug}/${articleSlug}`;
  }
}
