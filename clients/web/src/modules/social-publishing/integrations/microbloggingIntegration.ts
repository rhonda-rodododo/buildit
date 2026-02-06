/**
 * Microblogging → Social Publishing Integration
 *
 * Reads from the microblogging store to provide posts for scheduling
 * through the social-publishing system.
 */

import { logger } from '@/lib/logger';

export interface SchedulablePost {
  id: string;
  content: string;
  authorPubkey: string;
  sourceModule: 'microblogging';
  sourceContentId: string;
}

/**
 * Microblogging Integration
 * Adapts posts from microblogging module for social-publishing
 */
export class MicrobloggingIntegration {
  private static instance: MicrobloggingIntegration | null = null;

  static getInstance(): MicrobloggingIntegration {
    if (!this.instance) {
      this.instance = new MicrobloggingIntegration();
    }
    return this.instance;
  }

  /**
   * Get draft posts that can be scheduled.
   */
  async getSchedulablePosts(): Promise<SchedulablePost[]> {
    try {
      const { usePostsStore } = await import('@/modules/microblogging/postsStore');
      const store = usePostsStore.getState();

      // Return recent posts that could be re-shared/boosted
      return store.posts.slice(0, 20).map((post) => ({
        id: post.id,
        content: post.content,
        authorPubkey: String(post.authorId || ''),
        sourceModule: 'microblogging' as const,
        sourceContentId: post.id,
      }));
    } catch (error) {
      logger.warn('Failed to load microblogging store for integration', { error });
      return [];
    }
  }
}
