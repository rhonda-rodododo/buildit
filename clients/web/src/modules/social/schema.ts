/**
 * Advanced Social Features Module - Database Schema
 * Dexie table definitions for polls, stories, moderation, lists, etc.
 */

import type { TableSchema } from '@/types/modules';

/**
 * Dexie table definitions for social features module
 */
export const socialSchema: TableSchema[] = [
  // Polls
  {
    name: 'polls',
    schema: 'id, authorId, status, endsAt, createdAt, nostrEventId',
    indexes: ['id', 'authorId', 'status', 'endsAt', 'createdAt', 'nostrEventId'],
  },
  {
    name: 'pollVotes',
    schema: 'id, pollId, optionId, voterId, createdAt, [pollId+voterId]',
    indexes: ['id', 'pollId', 'optionId', 'voterId', 'createdAt', '[pollId+voterId]'],
  },

  // Stories
  {
    name: 'stories',
    schema: 'id, authorId, contentType, expiresAt, createdAt, [privacy.visibility]',
    indexes: ['id', 'authorId', 'contentType', 'expiresAt', 'createdAt', '[privacy.visibility]'],
  },
  {
    name: 'storyReplies',
    schema: 'id, storyId, authorId, createdAt',
    indexes: ['id', 'storyId', 'authorId', 'createdAt'],
  },
  {
    name: 'storyViews',
    schema: 'id, storyId, viewerId, viewedAt, [storyId+viewerId]',
    indexes: ['id', 'storyId', 'viewerId', 'viewedAt', '[storyId+viewerId]'],
  },

  // Moderation
  {
    name: 'muteRecords',
    schema: 'id, userPubkey, mutedPubkey, createdAt, expiresAt, [userPubkey+mutedPubkey]',
    indexes: ['id', 'userPubkey', 'mutedPubkey', 'createdAt', 'expiresAt', '[userPubkey+mutedPubkey]'],
  },
  {
    name: 'blockRecords',
    schema: 'id, userPubkey, blockedPubkey, createdAt, [userPubkey+blockedPubkey]',
    indexes: ['id', 'userPubkey', 'blockedPubkey', 'createdAt', '[userPubkey+blockedPubkey]'],
  },
  {
    name: 'contentReports',
    schema: 'id, reporterPubkey, reportedPubkey, reportedContentType, status, reason, createdAt',
    indexes: ['id', 'reporterPubkey', 'reportedPubkey', 'reportedContentType', 'status', 'reason', 'createdAt'],
  },
  {
    name: 'autoModerationRules',
    schema: 'id, groupId, ruleType, isEnabled, createdAt',
    indexes: ['id', 'groupId', 'ruleType', 'isEnabled', 'createdAt'],
  },
  {
    name: 'moderationLogs',
    schema: 'id, moderatorPubkey, action, targetPubkey, groupId, createdAt',
    indexes: ['id', 'moderatorPubkey', 'action', 'targetPubkey', 'groupId', 'createdAt'],
  },

  // User Lists
  {
    name: 'userLists',
    schema: 'id, ownerPubkey, name, type, isPrivate, createdAt, *members',
    indexes: ['id', 'ownerPubkey', 'name', 'type', 'isPrivate', 'createdAt', '*members'],
  },

  // Trending
  {
    name: 'trendingTopics',
    schema: 'hashtag, postCount, trend, lastSeen',
    indexes: ['hashtag', 'postCount', 'trend', 'lastSeen'],
  },

  // Notifications
  {
    name: 'notifications',
    schema: 'id, userPubkey, type, actorPubkey, isRead, createdAt',
    indexes: ['id', 'userPubkey', 'type', 'actorPubkey', 'isRead', 'createdAt'],
  },

  // Bookmark Collections
  {
    name: 'bookmarkCollections',
    schema: 'id, ownerPubkey, name, isDefault, createdAt',
    indexes: ['id', 'ownerPubkey', 'name', 'isDefault', 'createdAt'],
  },
];

/**
 * Indexes explanation:
 *
 * polls:
 * - id: Primary key
 * - authorId: Query polls by creator
 * - status: Filter active/ended polls
 * - endsAt: Find polls about to end
 *
 * pollVotes:
 * - [pollId+voterId]: Prevent duplicate votes
 *
 * stories:
 * - expiresAt: Clean up expired stories
 * - [privacy.visibility]: Filter by privacy level
 *
 * storyViews:
 * - [storyId+viewerId]: Unique view tracking
 *
 * muteRecords/blockRecords:
 * - [userPubkey+mutedPubkey]: Unique constraint
 *
 * contentReports:
 * - status: Find pending reports
 * - reason: Analytics on report types
 *
 * userLists:
 * - *members: Multi-entry for member lookup
 *
 * notifications:
 * - isRead: Filter unread notifications
 */

/**
 * Migration functions
 */
export const socialMigrations = [
  {
    version: 1,
    description: 'Initialize social features schema',
    migrate: async (_db: unknown) => {
      // Initial migration - no data transformation needed
    },
  },
];

/**
 * Default seed data for demo
 */
export const socialSeeds = {
  polls: [
    {
      id: 'seed-poll-1',
      authorId: 'system',
      question: 'What organizing topic would you like to learn more about?',
      options: [
        { id: 'opt-1', text: 'Union organizing strategies', voteCount: 12 },
        { id: 'opt-2', text: 'Mutual aid networks', voteCount: 8 },
        { id: 'opt-3', text: 'Direct action planning', voteCount: 15 },
        { id: 'opt-4', text: 'Community defense', voteCount: 6 },
      ],
      choiceType: 'single' as const,
      status: 'active' as const,
      endsAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
      createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      totalVotes: 41,
      voterPubkeys: [],
      isAnonymous: true,
      showResultsBeforeEnd: true,
    },
  ],
  userLists: [
    {
      id: 'default-close-friends',
      ownerPubkey: 'system',
      name: 'Close Friends',
      description: 'Your trusted inner circle',
      type: 'close-friends' as const,
      members: [],
      isPrivate: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  bookmarkCollections: [
    {
      id: 'default-saved',
      ownerPubkey: 'system',
      name: 'Saved',
      description: 'Default bookmark collection',
      isDefault: true,
      itemCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  autoModerationRules: [
    {
      id: 'default-spam-rule',
      name: 'Basic Spam Detection',
      isEnabled: true,
      ruleType: 'spam-detection' as const,
      action: 'flag' as const,
      notifyModerators: true,
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      triggerCount: 0,
    },
  ],
};
