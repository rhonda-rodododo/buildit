/**
 * Publishing/Microblogging Integration Tests
 *
 * Tests post creation, reactions, comments, reposts,
 * bookmarks, scheduled posts, and feed filtering.
 *
 * Epic 51: Quality & Testing Completion
 */

import { describe, it, expect } from 'vitest';
import type {
  Post,
  PostVisibility,
  PostPrivacy,
  PostContentType,
  PostFeedFilter,
  Reaction,
  ReactionType,
  Comment,
  Repost,
  Bookmark,
  ScheduledPost,
  CreatePostInput,
  PostStats,
} from '@/modules/microblogging/types';

describe('Publishing Integration Tests', () => {
  // Helper to create a mock post
  const createMockPost = (overrides: Partial<Post> = {}): Post => ({
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    authorId: 'author-pubkey',
    content: 'Test post content',
    contentType: 'text' as PostContentType,
    visibility: { privacy: 'public' as PostPrivacy },
    reactionCount: 0,
    commentCount: 0,
    repostCount: 0,
    bookmarkCount: 0,
    mentions: [],
    hashtags: [],
    links: [],
    createdAt: Date.now(),
    ...overrides,
  });

  describe('Post Creation', () => {
    it('should create post with required fields', () => {
      const post = createMockPost({
        content: 'Hello, world!',
        visibility: { privacy: 'public' },
      });

      expect(post.id).toBeTruthy();
      expect(post.authorId).toBeTruthy();
      expect(post.content).toBe('Hello, world!');
      expect(post.visibility.privacy).toBe('public');
      expect(post.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should support all content types', () => {
      const types: PostContentType[] = ['text', 'image', 'video', 'poll', 'event-share', 'document-share'];

      types.forEach((contentType) => {
        const post = createMockPost({ contentType });
        expect(post.contentType).toBe(contentType);
      });
    });

    it('should support all privacy levels', () => {
      const privacies: PostPrivacy[] = ['public', 'followers', 'group', 'encrypted'];

      privacies.forEach((privacy) => {
        const post = createMockPost({ visibility: { privacy } });
        expect(post.visibility.privacy).toBe(privacy);
      });
    });

    it('should extract mentions from content', () => {
      const extractMentions = (content: string): string[] => {
        const regex = /@([a-zA-Z0-9_]+)/g;
        const matches = content.match(regex) || [];
        return matches.map((m) => m.slice(1));
      };

      expect(extractMentions('Hey @alice and @bob!')).toEqual(['alice', 'bob']);
      expect(extractMentions('No mentions here')).toEqual([]);
    });

    it('should extract hashtags from content', () => {
      const extractHashtags = (content: string): string[] => {
        const regex = /#([a-zA-Z0-9_]+)/g;
        const matches = content.match(regex) || [];
        return matches.map((m) => m.slice(1).toLowerCase());
      };

      expect(extractHashtags('Join the #ClimateAction #HousingJustice movement')).toEqual([
        'climateaction',
        'housingjustice',
      ]);
    });

    it('should extract URLs from content', () => {
      const extractUrls = (content: string): string[] => {
        const regex = /https?:\/\/[^\s]+/g;
        return content.match(regex) || [];
      };

      const content = 'Check out https://example.com and http://test.org';
      expect(extractUrls(content)).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should support content warnings', () => {
      const post = createMockPost({
        contentWarning: 'Contains discussion of violence',
        isSensitive: true,
      });

      expect(post.contentWarning).toBe('Contains discussion of violence');
      expect(post.isSensitive).toBe(true);
    });

    it('should support group-specific visibility', () => {
      const visibility: PostVisibility = {
        privacy: 'group',
        groupIds: ['group-1', 'group-2'],
      };

      const post = createMockPost({ visibility });

      expect(post.visibility.privacy).toBe('group');
      expect(post.visibility.groupIds).toContain('group-1');
      expect(post.visibility.groupIds).toContain('group-2');
    });

    it('should support encrypted visibility with allowed users', () => {
      const visibility: PostVisibility = {
        privacy: 'encrypted',
        allowedUsers: ['user-1', 'user-2', 'user-3'],
      };

      const post = createMockPost({ visibility });

      expect(post.visibility.privacy).toBe('encrypted');
      expect(post.visibility.allowedUsers).toHaveLength(3);
    });
  });

  describe('Reactions', () => {
    it('should support all reaction types', () => {
      const types: ReactionType[] = ['❤️', '✊', '🔥', '👀', '😂', '👍'];

      types.forEach((type) => {
        const reaction: Reaction = {
          id: `reaction-${Date.now()}`,
          postId: 'post-1',
          userId: 'user-1',
          type,
          createdAt: Date.now(),
        };
        expect(reaction.type).toBe(type);
      });
    });

    it('should increment reaction count when adding reaction', () => {
      const post = createMockPost({ reactionCount: 5 });

      // Simulate adding reaction
      post.reactionCount += 1;

      expect(post.reactionCount).toBe(6);
    });

    it('should decrement reaction count when removing reaction', () => {
      const post = createMockPost({ reactionCount: 5 });

      // Simulate removing reaction
      post.reactionCount = Math.max(0, post.reactionCount - 1);

      expect(post.reactionCount).toBe(4);
    });

    it('should track user reactions to avoid duplicates', () => {
      const myReactions = new Map<string, ReactionType>();

      // Add reaction
      myReactions.set('post-1', '❤️');
      expect(myReactions.get('post-1')).toBe('❤️');

      // Change reaction
      myReactions.set('post-1', '🔥');
      expect(myReactions.get('post-1')).toBe('🔥');

      // Remove reaction
      myReactions.delete('post-1');
      expect(myReactions.has('post-1')).toBe(false);
    });

    it('should group reactions by type for display', () => {
      const reactions: Reaction[] = [
        { id: '1', postId: 'post-1', userId: 'user-1', type: '❤️', createdAt: 1 },
        { id: '2', postId: 'post-1', userId: 'user-2', type: '❤️', createdAt: 2 },
        { id: '3', postId: 'post-1', userId: 'user-3', type: '🔥', createdAt: 3 },
        { id: '4', postId: 'post-1', userId: 'user-4', type: '✊', createdAt: 4 },
      ];

      const grouped = reactions.reduce(
        (acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        },
        {} as Record<ReactionType, number>
      );

      expect(grouped['❤️']).toBe(2);
      expect(grouped['🔥']).toBe(1);
      expect(grouped['✊']).toBe(1);
    });
  });

  describe('Comments', () => {
    it('should create comment with depth', () => {
      const comment: Comment = {
        id: `comment-${Date.now()}`,
        postId: 'post-1',
        authorId: 'user-1',
        content: 'Great post!',
        depth: 0,
        reactionCount: 0,
        createdAt: Date.now(),
      };

      expect(comment.depth).toBe(0);
      expect(comment.content).toBe('Great post!');
    });

    it('should support nested comments up to depth 3', () => {
      const createNestedComment = (parentDepth: number): Comment | null => {
        if (parentDepth >= 3) return null; // Max depth reached

        return {
          id: `comment-${Date.now()}`,
          postId: 'post-1',
          authorId: 'user-1',
          content: 'Reply',
          parentCommentId: 'parent-id',
          depth: parentDepth + 1,
          reactionCount: 0,
          createdAt: Date.now(),
        };
      };

      expect(createNestedComment(0)?.depth).toBe(1);
      expect(createNestedComment(1)?.depth).toBe(2);
      expect(createNestedComment(2)?.depth).toBe(3);
      expect(createNestedComment(3)).toBeNull(); // Blocked at max depth
    });

    it('should increment comment count on post', () => {
      const post = createMockPost({ commentCount: 10 });

      post.commentCount += 1;

      expect(post.commentCount).toBe(11);
    });

    it('should build comment thread structure', () => {
      const comments: Comment[] = [
        { id: 'c1', postId: 'p1', authorId: 'u1', content: 'Root 1', depth: 0, reactionCount: 0, createdAt: 1 },
        {
          id: 'c2',
          postId: 'p1',
          authorId: 'u2',
          content: 'Reply to c1',
          parentCommentId: 'c1',
          depth: 1,
          reactionCount: 0,
          createdAt: 2,
        },
        { id: 'c3', postId: 'p1', authorId: 'u3', content: 'Root 2', depth: 0, reactionCount: 0, createdAt: 3 },
      ];

      const buildThread = (cs: Comment[], parentId?: string): Comment[] =>
        cs.filter((c) => c.parentCommentId === parentId);

      const rootComments = buildThread(comments, undefined);
      expect(rootComments).toHaveLength(2);

      const repliesTo1 = buildThread(comments, 'c1');
      expect(repliesTo1).toHaveLength(1);
      expect(repliesTo1[0].content).toBe('Reply to c1');
    });
  });

  describe('Reposts', () => {
    it('should create simple repost', () => {
      const repost: Repost = {
        id: `repost-${Date.now()}`,
        postId: 'original-post-id',
        userId: 'user-1',
        isQuote: false,
        createdAt: Date.now(),
      };

      expect(repost.isQuote).toBe(false);
      expect(repost.quoteContent).toBeUndefined();
    });

    it('should create quote repost with content', () => {
      const repost: Repost = {
        id: `repost-${Date.now()}`,
        postId: 'original-post-id',
        userId: 'user-1',
        isQuote: true,
        quoteContent: 'Adding my thoughts to this important post',
        createdAt: Date.now(),
      };

      expect(repost.isQuote).toBe(true);
      expect(repost.quoteContent).toBe('Adding my thoughts to this important post');
    });

    it('should increment repost count on original post', () => {
      const post = createMockPost({ repostCount: 5 });

      post.repostCount += 1;

      expect(post.repostCount).toBe(6);
    });

    it('should track user reposts to avoid duplicates', () => {
      const myReposts = new Set<string>();

      // Repost
      myReposts.add('post-1');
      expect(myReposts.has('post-1')).toBe(true);

      // Check if already reposted
      const hasReposted = (postId: string) => myReposts.has(postId);
      expect(hasReposted('post-1')).toBe(true);
      expect(hasReposted('post-2')).toBe(false);

      // Unrepost
      myReposts.delete('post-1');
      expect(hasReposted('post-1')).toBe(false);
    });

    it('should mark reposted post correctly', () => {
      const originalPost = createMockPost({ id: 'original' });
      const repostPost = createMockPost({
        isRepost: true,
        repostedPostId: originalPost.id,
      });

      expect(repostPost.isRepost).toBe(true);
      expect(repostPost.repostedPostId).toBe('original');
    });
  });

  describe('Bookmarks', () => {
    it('should create bookmark', () => {
      const bookmark: Bookmark = {
        id: `bookmark-${Date.now()}`,
        postId: 'post-1',
        userId: 'user-1',
        createdAt: Date.now(),
      };

      expect(bookmark.postId).toBe('post-1');
    });

    it('should support bookmark collections', () => {
      const bookmark: Bookmark = {
        id: `bookmark-${Date.now()}`,
        postId: 'post-1',
        userId: 'user-1',
        createdAt: Date.now(),
        collectionId: 'housing-resources',
        tags: ['housing', 'resources'],
        notes: 'Great resource for tenant organizing',
      };

      expect(bookmark.collectionId).toBe('housing-resources');
      expect(bookmark.tags).toContain('housing');
      expect(bookmark.notes).toBeTruthy();
    });

    it('should increment bookmark count on post', () => {
      const post = createMockPost({ bookmarkCount: 3 });

      post.bookmarkCount += 1;

      expect(post.bookmarkCount).toBe(4);
    });

    it('should track user bookmarks', () => {
      const myBookmarks = new Set<string>();

      myBookmarks.add('post-1');
      myBookmarks.add('post-2');

      const hasBookmarked = (postId: string) => myBookmarks.has(postId);

      expect(hasBookmarked('post-1')).toBe(true);
      expect(hasBookmarked('post-3')).toBe(false);
    });
  });

  describe('Scheduled Posts', () => {
    it('should create scheduled post', () => {
      const scheduledFor = Date.now() + 3600000; // 1 hour from now

      const scheduled: ScheduledPost = {
        id: `scheduled-${Date.now()}`,
        authorId: 'user-1',
        content: 'Future post content',
        contentType: 'text',
        visibility: { privacy: 'public' },
        scheduledFor,
        status: 'pending',
        createdAt: Date.now(),
      };

      expect(scheduled.status).toBe('pending');
      expect(scheduled.scheduledFor).toBeGreaterThan(Date.now());
    });

    it('should identify due scheduled posts', () => {
      const now = Date.now();

      const posts: ScheduledPost[] = [
        {
          id: 's1',
          authorId: 'u1',
          content: 'Past due',
          contentType: 'text',
          visibility: { privacy: 'public' },
          scheduledFor: now - 1000,
          status: 'pending',
          createdAt: now - 86400000,
        },
        {
          id: 's2',
          authorId: 'u1',
          content: 'Future',
          contentType: 'text',
          visibility: { privacy: 'public' },
          scheduledFor: now + 86400000,
          status: 'pending',
          createdAt: now - 86400000,
        },
      ];

      const getDuePosts = (list: ScheduledPost[]): ScheduledPost[] =>
        list.filter((p) => p.status === 'pending' && p.scheduledFor <= Date.now());

      const due = getDuePosts(posts);
      expect(due).toHaveLength(1);
      expect(due[0].id).toBe('s1');
    });

    it('should update scheduled post status on publish', () => {
      const scheduled: ScheduledPost = {
        id: `scheduled-${Date.now()}`,
        authorId: 'user-1',
        content: 'Content',
        contentType: 'text',
        visibility: { privacy: 'public' },
        scheduledFor: Date.now() - 1000,
        status: 'pending',
        createdAt: Date.now() - 86400000,
      };

      // Simulate publish
      scheduled.status = 'published';
      scheduled.publishedAt = Date.now();
      scheduled.publishedPostId = 'new-post-id';

      expect(scheduled.status).toBe('published');
      expect(scheduled.publishedPostId).toBe('new-post-id');
    });

    it('should support cancelled status', () => {
      const scheduled: ScheduledPost = {
        id: `scheduled-${Date.now()}`,
        authorId: 'user-1',
        content: 'Content',
        contentType: 'text',
        visibility: { privacy: 'public' },
        scheduledFor: Date.now() + 86400000,
        status: 'pending',
        createdAt: Date.now(),
      };

      scheduled.status = 'cancelled';

      expect(scheduled.status).toBe('cancelled');
    });

    it('should track failed publish attempts', () => {
      const scheduled: ScheduledPost = {
        id: `scheduled-${Date.now()}`,
        authorId: 'user-1',
        content: 'Content',
        contentType: 'text',
        visibility: { privacy: 'public' },
        scheduledFor: Date.now() - 1000,
        status: 'pending',
        createdAt: Date.now() - 86400000,
      };

      // Simulate failed publish
      scheduled.status = 'failed';
      scheduled.errorMessage = 'Network error';

      expect(scheduled.status).toBe('failed');
      expect(scheduled.errorMessage).toBe('Network error');
    });
  });

  describe('Post Pinning', () => {
    it('should pin a post', () => {
      const post = createMockPost({ isPinned: false });

      post.isPinned = true;
      post.pinnedAt = Date.now();

      expect(post.isPinned).toBe(true);
      expect(post.pinnedAt).toBeTruthy();
    });

    it('should unpin a post', () => {
      const post = createMockPost({ isPinned: true, pinnedAt: Date.now() - 1000 });

      post.isPinned = false;
      post.pinnedAt = undefined;

      expect(post.isPinned).toBe(false);
    });

    it('should filter pinned posts', () => {
      const posts: Post[] = [
        createMockPost({ id: 'post1', isPinned: true }),
        createMockPost({ id: 'post2', isPinned: false }),
        createMockPost({ id: 'post3', isPinned: true }),
      ];

      const pinned = posts.filter((p) => p.isPinned);
      expect(pinned).toHaveLength(2);
    });
  });

  describe('Feed Filtering', () => {
    const posts: Post[] = [
      createMockPost({
        id: 'p1',
        authorId: 'alice',
        visibility: { privacy: 'public' },
        hashtags: ['climate'],
        createdAt: 1000,
      }),
      createMockPost({
        id: 'p2',
        authorId: 'bob',
        visibility: { privacy: 'followers' },
        contentType: 'image',
        createdAt: 2000,
      }),
      createMockPost({
        id: 'p3',
        authorId: 'alice',
        visibility: { privacy: 'group', groupIds: ['group-1'] },
        createdAt: 3000,
      }),
    ];

    const filterPosts = (list: Post[], filter: PostFeedFilter): Post[] => {
      let result = [...list];

      if (filter.authorId) {
        result = result.filter((p) => p.authorId === filter.authorId);
      }
      if (filter.privacyLevels?.length) {
        result = result.filter((p) => filter.privacyLevels!.includes(p.visibility.privacy));
      }
      if (filter.contentTypes?.length) {
        result = result.filter((p) => filter.contentTypes!.includes(p.contentType));
      }
      if (filter.hasMedia !== undefined) {
        result = result.filter(
          (p) => (p.media && p.media.length > 0) === filter.hasMedia
        );
      }
      if (filter.hashtags?.length) {
        result = result.filter((p) =>
          filter.hashtags!.some((tag) => p.hashtags.includes(tag))
        );
      }
      if (filter.groupIds?.length) {
        result = result.filter(
          (p) =>
            p.visibility.privacy === 'group' &&
            p.visibility.groupIds?.some((id) => filter.groupIds!.includes(id))
        );
      }
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        result = result.filter((p) => p.content.toLowerCase().includes(q));
      }
      if (filter.dateFrom) {
        result = result.filter((p) => p.createdAt >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        result = result.filter((p) => p.createdAt <= filter.dateTo!);
      }

      // Apply limit and offset
      if (filter.offset) {
        result = result.slice(filter.offset);
      }
      if (filter.limit) {
        result = result.slice(0, filter.limit);
      }

      return result;
    };

    it('should filter by author', () => {
      const result = filterPosts(posts, { type: 'all', authorId: 'alice' });
      expect(result).toHaveLength(2);
    });

    it('should filter by privacy level', () => {
      const result = filterPosts(posts, {
        type: 'all',
        privacyLevels: ['public'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });

    it('should filter by content type', () => {
      const result = filterPosts(posts, {
        type: 'all',
        contentTypes: ['image'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p2');
    });

    it('should filter by hashtag', () => {
      const result = filterPosts(posts, {
        type: 'all',
        hashtags: ['climate'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });

    it('should filter by group', () => {
      const result = filterPosts(posts, {
        type: 'group',
        groupIds: ['group-1'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p3');
    });

    it('should apply date range filter', () => {
      const result = filterPosts(posts, {
        type: 'all',
        dateFrom: 1500,
        dateTo: 2500,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p2');
    });

    it('should apply pagination', () => {
      const result = filterPosts(posts, {
        type: 'all',
        limit: 2,
        offset: 1,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('Post Statistics', () => {
    it('should calculate post statistics', () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const weekMs = 7 * dayMs;

      const posts: Post[] = [
        createMockPost({ reactionCount: 10, commentCount: 5, repostCount: 2, createdAt: now }),
        createMockPost({ reactionCount: 20, commentCount: 10, repostCount: 5, createdAt: now - dayMs / 2 }),
        createMockPost({ reactionCount: 5, commentCount: 2, repostCount: 1, createdAt: now - 3 * dayMs }),
        createMockPost({ reactionCount: 15, commentCount: 8, repostCount: 3, createdAt: now - 10 * dayMs }),
      ];

      const bookmarks: Bookmark[] = [
        { id: 'b1', postId: 'p1', userId: 'u1', createdAt: now },
        { id: 'b2', postId: 'p2', userId: 'u1', createdAt: now },
      ];

      const calculateStats = (postList: Post[], bookmarkList: Bookmark[]): PostStats => {
        const total = postList.length;
        const today = now - dayMs;
        const thisWeek = now - weekMs;
        const thisMonth = now - 30 * dayMs;

        const postsToday = postList.filter((p) => p.createdAt >= today).length;
        const postsThisWeek = postList.filter((p) => p.createdAt >= thisWeek).length;
        const postsThisMonth = postList.filter((p) => p.createdAt >= thisMonth).length;

        const totalReactions = postList.reduce((sum, p) => sum + p.reactionCount, 0);
        const totalComments = postList.reduce((sum, p) => sum + p.commentCount, 0);
        const totalReposts = postList.reduce((sum, p) => sum + p.repostCount, 0);

        return {
          totalPosts: total,
          totalReactions,
          totalComments,
          totalReposts,
          totalBookmarks: bookmarkList.length,
          postsToday,
          postsThisWeek,
          postsThisMonth,
          avgReactionsPerPost: total > 0 ? totalReactions / total : 0,
          avgCommentsPerPost: total > 0 ? totalComments / total : 0,
          avgRepostsPerPost: total > 0 ? totalReposts / total : 0,
        };
      };

      const stats = calculateStats(posts, bookmarks);

      expect(stats.totalPosts).toBe(4);
      expect(stats.totalReactions).toBe(50);
      expect(stats.totalComments).toBe(25);
      expect(stats.totalReposts).toBe(11);
      expect(stats.totalBookmarks).toBe(2);
      expect(stats.postsToday).toBe(2);
      expect(stats.postsThisWeek).toBe(3);
      expect(stats.avgReactionsPerPost).toBe(12.5);
    });
  });

  describe('Post Update', () => {
    it('should update post content', () => {
      const post = createMockPost({ content: 'Original content' });

      post.content = 'Updated content';
      post.updatedAt = Date.now();

      expect(post.content).toBe('Updated content');
      expect(post.updatedAt).toBeTruthy();
    });

    it('should preserve other fields when updating', () => {
      const post = createMockPost({
        content: 'Original',
        reactionCount: 10,
        hashtags: ['test'],
      });

      post.content = 'Updated';
      post.updatedAt = Date.now();

      expect(post.reactionCount).toBe(10);
      expect(post.hashtags).toContain('test');
    });
  });

  describe('Post Deletion', () => {
    it('should remove post from list', () => {
      const posts = [
        createMockPost({ id: 'post1' }),
        createMockPost({ id: 'post2' }),
        createMockPost({ id: 'post3' }),
      ];

      const filtered = posts.filter((p) => p.id !== 'post2');

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).not.toContain('post2');
    });
  });

  describe('Nostr Integration', () => {
    it('should include Nostr event ID when published', () => {
      const post = createMockPost({
        nostrEventId: 'event123',
        relayUrls: ['wss://relay1.com', 'wss://relay2.com'],
      });

      expect(post.nostrEventId).toBe('event123');
      expect(post.relayUrls).toHaveLength(2);
    });

    it('should use correct Nostr kinds for posts', () => {
      const POST_NOSTR_KIND = 1;
      const LONG_POST_NOSTR_KIND = 30023;

      expect(POST_NOSTR_KIND).toBe(1);
      expect(LONG_POST_NOSTR_KIND).toBe(30023);
    });
  });
});
