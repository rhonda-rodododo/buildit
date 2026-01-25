/**
 * Microblogging Module - Database Schema
 * Dexie table definitions for posts and social features
 */

import type { TableSchema } from '@/types/modules';
import type {
  Post,
  Reaction,
  Comment,
  Repost,
  Bookmark,
  ScheduledPost,
  Poll,
  PollVote,
  Story,
  StoryView,
  StoryReply,
  MutedUser,
  ContentReport,
  AutoModRule,
  ModerationLog,
  UserList,
} from './types';

/**
 * Database table interfaces for TypeScript
 */
export type {
  Post,
  Reaction,
  Comment,
  Repost,
  Bookmark,
  ScheduledPost,
  Poll,
  PollVote,
  Story,
  StoryView,
  StoryReply,
  MutedUser,
  ContentReport,
  AutoModRule,
  ModerationLog,
  UserList,
};

/**
 * Dexie table definitions for microblogging module
 */
export const microbloggingSchema: TableSchema[] = [
  {
    name: 'posts',
    schema: 'id, authorId, [visibility.privacy], createdAt, updatedAt, nostrEventId, *hashtags, *mentions, isPinned, pinnedAt',
    indexes: ['id', 'authorId', '[visibility.privacy]', 'createdAt', 'updatedAt', 'nostrEventId', '*hashtags', '*mentions', 'isPinned', 'pinnedAt'],
  },
  {
    name: 'reactions',
    schema: 'id, postId, userId, type, createdAt, [postId+userId]',
    indexes: ['id', 'postId', 'userId', 'type', 'createdAt', '[postId+userId]'],
  },
  {
    name: 'comments',
    schema: 'id, postId, authorId, parentCommentId, depth, createdAt',
    indexes: ['id', 'postId', 'authorId', 'parentCommentId', 'depth', 'createdAt'],
  },
  {
    name: 'reposts',
    schema: 'id, postId, userId, createdAt, [postId+userId]',
    indexes: ['id', 'postId', 'userId', 'createdAt', '[postId+userId]'],
  },
  {
    name: 'bookmarks',
    schema: 'id, postId, userId, createdAt, collectionId, [postId+userId]',
    indexes: ['id', 'postId', 'userId', 'createdAt', 'collectionId', '[postId+userId]'],
  },
  {
    name: 'scheduledPosts',
    schema: 'id, authorId, scheduledFor, status, createdAt, updatedAt',
    indexes: ['id', 'authorId', 'scheduledFor', 'status', 'createdAt', 'updatedAt'],
  },
  // Polls
  {
    name: 'polls',
    schema: 'id, postId, authorId, endsAt, isEnded, createdAt, nostrEventId',
    indexes: ['id', 'postId', 'authorId', 'endsAt', 'isEnded', 'createdAt', 'nostrEventId'],
  },
  {
    name: 'pollVotes',
    schema: 'id, pollId, voterId, createdAt, [pollId+voterId]',
    indexes: ['id', 'pollId', 'voterId', 'createdAt', '[pollId+voterId]'],
  },
  // Stories
  {
    name: 'stories',
    schema: 'id, authorId, contentType, expiresAt, createdAt, nostrEventId',
    indexes: ['id', 'authorId', 'contentType', 'expiresAt', 'createdAt', 'nostrEventId'],
  },
  {
    name: 'storyViews',
    schema: 'id, storyId, viewerId, viewedAt, [storyId+viewerId]',
    indexes: ['id', 'storyId', 'viewerId', 'viewedAt', '[storyId+viewerId]'],
  },
  {
    name: 'storyReplies',
    schema: 'id, storyId, authorId, createdAt',
    indexes: ['id', 'storyId', 'authorId', 'createdAt'],
  },
  // Moderation
  {
    name: 'mutedUsers',
    schema: 'id, userId, mutedUserId, expiresAt, createdAt, [userId+mutedUserId]',
    indexes: ['id', 'userId', 'mutedUserId', 'expiresAt', 'createdAt', '[userId+mutedUserId]'],
  },
  {
    name: 'contentReports',
    schema: 'id, reporterId, contentType, contentId, contentAuthorId, status, createdAt',
    indexes: ['id', 'reporterId', 'contentType', 'contentId', 'contentAuthorId', 'status', 'createdAt'],
  },
  {
    name: 'autoModRules',
    schema: 'id, groupId, ruleType, isEnabled, createdAt, createdBy',
    indexes: ['id', 'groupId', 'ruleType', 'isEnabled', 'createdAt', 'createdBy'],
  },
  {
    name: 'moderationLogs',
    schema: 'id, moderatorId, action, targetUserId, targetContentId, createdAt',
    indexes: ['id', 'moderatorId', 'action', 'targetUserId', 'targetContentId', 'createdAt'],
  },
  // User Lists
  {
    name: 'userLists',
    schema: 'id, ownerId, isPrivate, createdAt, nostrEventId',
    indexes: ['id', 'ownerId', 'isPrivate', 'createdAt', 'nostrEventId'],
  },
];

/**
 * Indexes explanation:
 *
 * posts:
 * - id: Primary key
 * - authorId: Query posts by author
 * - [visibility.privacy]: Query by privacy level
 * - createdAt: Sort by time
 * - nostrEventId: Sync with Nostr
 * - *hashtags: Multi-entry index for hashtag searches
 * - *mentions: Multi-entry index for mention queries
 * - isPinned: Query pinned posts
 * - pinnedAt: Sort pinned posts by pin time
 *
 * reactions:
 * - [postId+userId]: Unique constraint (one reaction per user per post)
 *
 * comments:
 * - postId: Query comments for a post
 * - parentCommentId: Get nested comments
 *
 * reposts:
 * - [postId+userId]: Unique constraint (one repost per user per post)
 *
 * bookmarks:
 * - [postId+userId]: Unique constraint (one bookmark per user per post)
 *
 * scheduledPosts:
 * - id: Primary key
 * - authorId: Query by author
 * - scheduledFor: Query posts due to be published
 * - status: Filter by publish status
 *
 * polls:
 * - postId: Link to associated post
 * - authorId: Query polls by author
 * - endsAt: Find active/expired polls
 *
 * pollVotes:
 * - [pollId+voterId]: Unique constraint (one vote per user per poll)
 *
 * stories:
 * - authorId: Get user's stories
 * - expiresAt: Clean up expired stories
 *
 * storyViews:
 * - [storyId+viewerId]: Unique constraint (one view record per viewer)
 *
 * mutedUsers:
 * - [userId+mutedUserId]: Unique constraint (one mute per relationship)
 * - expiresAt: Clean up expired mutes
 *
 * contentReports:
 * - status: Filter pending/reviewed reports
 * - contentId: Find reports for specific content
 *
 * autoModRules:
 * - groupId: Group-specific rules
 * - isEnabled: Filter active rules
 *
 * moderationLogs:
 * - moderatorId: Audit trail by moderator
 * - action: Filter by action type
 *
 * userLists:
 * - ownerId: Get user's lists
 * - isPrivate: Filter public/private lists
 */

/**
 * Migration functions for microblogging module
 */
export const microbloggingMigrations = [
  // Version 1: Initial schema
  {
    version: 1,
    description: 'Initialize microblogging schema with default values',
    migrate: async (db: any) => {
      // Posts table
      await db.posts.toCollection().modify((post: Post) => {
        // Ensure default values
        post.reactionCount = post.reactionCount || 0;
        post.commentCount = post.commentCount || 0;
        post.repostCount = post.repostCount || 0;
        post.bookmarkCount = post.bookmarkCount || 0;
        post.mentions = post.mentions || [];
        post.hashtags = post.hashtags || [];
        post.links = post.links || [];
      });
    },
  },
];

/**
 * Default data/seeds for microblogging module
 */
export const microbloggingSeeds = {
  posts: [
    {
      id: 'seed-post-1',
      authorId: 'system',
      content: '🎉 Welcome to BuildIt Network! This is your activity feed where you\'ll see updates from all your groups, events, mutual aid requests, and community posts. Start by creating your first post or joining a group!',
      contentType: 'text' as const,
      visibility: {
        privacy: 'public' as const,
      },
      reactionCount: 2,
      commentCount: 1,
      repostCount: 0,
      bookmarkCount: 0,
      mentions: [],
      hashtags: ['welcome', 'builditnetwork'],
      links: [],
      createdAt: Date.now(),
    },
    {
      id: 'seed-post-2',
      authorId: 'system',
      content: '✊ **Privacy-First Social Organizing**\n\nBuildIt Network uses end-to-end encryption (NIP-17) to keep your organizing safe. All posts, messages, and documents are encrypted before leaving your device.\n\n- 🔒 Group-only posts (default)\n- 🌍 Public posts (opt-in with warning)\n- 🔐 Encrypted DMs and group chats\n- 🕵️ Anonymous voting and reactions\n\n#privacy #encryption #organizing',
      contentType: 'text' as const,
      visibility: {
        privacy: 'public' as const,
      },
      reactionCount: 5,
      commentCount: 2,
      repostCount: 1,
      bookmarkCount: 1,
      mentions: [],
      hashtags: ['privacy', 'encryption', 'organizing'],
      links: [],
      createdAt: Date.now() - 3600000, // 1 hour ago
    },
    {
      id: 'seed-post-3',
      authorId: 'system',
      content: '📋 **How to use BuildIt Network:**\n\n1. **Create or join groups** - Unions, co-ops, collectives, mutual aid networks\n2. **Post updates** - Share news, coordinate actions, build solidarity\n3. **Organize events** - Rallies, workshops, meetings, direct actions\n4. **Mutual aid** - Post requests, offer help, coordinate resources\n5. **Governance** - Create proposals, vote democratically\n6. **Document & share** - Wikis, documents, encrypted files\n\nGet started by creating your first post below! 👇',
      contentType: 'text' as const,
      visibility: {
        privacy: 'public' as const,
      },
      reactionCount: 3,
      commentCount: 0,
      repostCount: 0,
      bookmarkCount: 2,
      mentions: [],
      hashtags: ['howto', 'gettingstarted'],
      links: [],
      createdAt: Date.now() - 7200000, // 2 hours ago
    },
  ],
  reactions: [
    {
      id: 'seed-reaction-1',
      postId: 'seed-post-1',
      userId: 'seed-user-1',
      type: '❤️' as const,
      createdAt: Date.now() - 1000,
    },
    {
      id: 'seed-reaction-2',
      postId: 'seed-post-1',
      userId: 'seed-user-2',
      type: '✊' as const,
      createdAt: Date.now() - 2000,
    },
    {
      id: 'seed-reaction-3',
      postId: 'seed-post-2',
      userId: 'seed-user-1',
      type: '🔥' as const,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'seed-reaction-4',
      postId: 'seed-post-2',
      userId: 'seed-user-2',
      type: '❤️' as const,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'seed-reaction-5',
      postId: 'seed-post-2',
      userId: 'seed-user-3',
      type: '✊' as const,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'seed-reaction-6',
      postId: 'seed-post-2',
      userId: 'seed-user-4',
      type: '👍' as const,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'seed-reaction-7',
      postId: 'seed-post-2',
      userId: 'seed-user-5',
      type: '🔥' as const,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'seed-reaction-8',
      postId: 'seed-post-3',
      userId: 'seed-user-1',
      type: '👍' as const,
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'seed-reaction-9',
      postId: 'seed-post-3',
      userId: 'seed-user-2',
      type: '❤️' as const,
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'seed-reaction-10',
      postId: 'seed-post-3',
      userId: 'seed-user-3',
      type: '😂' as const,
      createdAt: Date.now() - 7200000,
    },
  ],
  comments: [
    {
      id: 'seed-comment-1',
      postId: 'seed-post-1',
      authorId: 'seed-user-1',
      content: 'So excited to be part of this community! Let\'s build something amazing together! 🚀',
      parentCommentId: undefined,
      depth: 0,
      reactionCount: 0,
      createdAt: Date.now() - 500,
    },
    {
      id: 'seed-comment-2',
      postId: 'seed-post-2',
      authorId: 'seed-user-2',
      content: 'This is exactly what we need - privacy-first organizing is essential!',
      parentCommentId: undefined,
      depth: 0,
      reactionCount: 0,
      createdAt: Date.now() - 3500000,
    },
    {
      id: 'seed-comment-3',
      postId: 'seed-post-2',
      authorId: 'seed-user-3',
      content: 'Love the focus on encryption. Can we use Tor integration as well?',
      parentCommentId: undefined,
      depth: 0,
      reactionCount: 0,
      createdAt: Date.now() - 3400000,
    },
  ],
  reposts: [
    {
      id: 'seed-repost-1',
      postId: 'seed-post-2',
      userId: 'seed-user-1',
      isQuote: false,
      createdAt: Date.now() - 3500000,
    },
  ],
  bookmarks: [
    {
      id: 'seed-bookmark-1',
      postId: 'seed-post-2',
      userId: 'seed-user-1',
      createdAt: Date.now() - 3500000,
      collectionId: 'important',
      tags: ['privacy', 'security'],
      notes: 'Reference for explaining encryption to new members',
    },
    {
      id: 'seed-bookmark-2',
      postId: 'seed-post-3',
      userId: 'seed-user-1',
      createdAt: Date.now() - 7100000,
      collectionId: 'guides',
      tags: ['tutorial', 'getting-started'],
      notes: 'Share with new group members',
    },
    {
      id: 'seed-bookmark-3',
      postId: 'seed-post-3',
      userId: 'seed-user-2',
      createdAt: Date.now() - 7100000,
    },
  ],
};
