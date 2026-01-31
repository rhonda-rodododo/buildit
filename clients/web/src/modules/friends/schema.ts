/**
 * Friends System - Database Schema
 * Dexie table definitions for friend relationships
 */

import type { TableSchema } from '@/types/modules';
import type { DBFriend, FriendRequest, FriendInviteLink } from './types';

/**
 * Database table interfaces for TypeScript
 */
export type { DBFriend, FriendRequest, FriendInviteLink };

/**
 * Dexie table definitions for friends system
 */
export const friendsSchema: TableSchema[] = [
  {
    name: 'friends',
    schema:
      'id, [userPubkey+friendPubkey], userPubkey, friendPubkey, status, trustTier, verifiedInPerson, isFavorite, addedAt, acceptedAt, *tags',
    indexes: [
      'id',
      '[userPubkey+friendPubkey]', // Unique constraint
      'userPubkey', // Query all friends for a user
      'friendPubkey', // Reverse lookup
      'status', // Filter by status
      'trustTier', // Filter by trust level
      'verifiedInPerson', // Query verified friends
      'isFavorite', // Query favorites
      'addedAt', // Sort by date added
      'acceptedAt', // Sort by acceptance date
      '*tags', // Multi-entry index for tag searches
    ],
  },
  {
    name: 'friendRequests',
    schema: 'id, fromPubkey, toPubkey, createdAt, expiresAt, [fromPubkey+toPubkey]',
    indexes: [
      'id',
      'fromPubkey', // Query requests sent by user
      'toPubkey', // Query requests received by user
      'createdAt', // Sort by date
      'expiresAt', // Clean up expired requests
      '[fromPubkey+toPubkey]', // Prevent duplicate requests
    ],
  },
  {
    name: 'friendInviteLinks',
    schema: 'id, code, creatorPubkey, createdAt, expiresAt, maxUses, currentUses',
    indexes: ['id', 'code', 'creatorPubkey', 'createdAt', 'expiresAt'],
  },
];

/**
 * Indexes explanation:
 *
 * friends:
 * - [userPubkey+friendPubkey]: Unique constraint to prevent duplicate friendships
 * - userPubkey: Query all friends for a user
 * - friendPubkey: Reverse lookup (who has this person as a friend)
 * - status: Filter by pending/accepted/blocked
 * - trustTier: Filter by trust level
 * - verifiedInPerson: Find verified contacts
 * - isFavorite: Show pinned friends
 * - *tags: Multi-entry index for searching by tags
 *
 * friendRequests:
 * - [fromPubkey+toPubkey]: Prevent duplicate requests between same users
 * - fromPubkey/toPubkey: Query sent/received requests
 * - expiresAt: Clean up expired requests
 *
 * friendInviteLinks:
 * - code: Look up invite by code
 * - expiresAt: Clean up expired invites
 */

/**
 * Migration functions for friends system
 */
export const friendsMigrations = [
  // Version 1: Initial schema
  {
    version: 1,
    description: 'Initialize friends system schema',
    migrate: async () => {
      // Default values are now ensured by the schema definition
      // No data exists at v1, so no migration logic needed
    },
  },
];

/**
 * Default data/seeds for friends system
 * NOTE: These are example seeds using test user public keys
 * Real data will be generated when users create friend relationships
 */
export const friendsSeeds = {
  friends: [
    // Example: Alice and Bob are friends (verified in person)
    {
      id: 'friend-seed-1',
      userPubkey: 'test-user-alice',
      friendPubkey: 'test-user-bob',
      username: 'bob-organizer',
      displayName: 'Bob Martinez',
      status: 'accepted' as const,
      addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      acceptedAt: Date.now() - 29 * 24 * 60 * 60 * 1000,
      notes: 'Met at community organizing event',
      tags: ['organizer', 'local'],
      verifiedInPerson: true,
      isFavorite: true,
      trustTier: 'verified' as const,
      privacySettings: {
        canSeeOnlineStatus: true,
        canSeeGroups: true,
        canSeeActivity: false,
        canTagInPosts: true,
      },
    },
    // Example: Alice and Charlie are friends (not verified)
    {
      id: 'friend-seed-2',
      userPubkey: 'test-user-alice',
      friendPubkey: 'test-user-charlie',
      username: 'charlie-dev',
      displayName: 'Charlie Johnson',
      status: 'accepted' as const,
      addedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
      acceptedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
      notes: '',
      tags: ['tech'],
      verifiedInPerson: false,
      isFavorite: false,
      trustTier: 'friend' as const,
      privacySettings: {
        canSeeOnlineStatus: true,
        canSeeGroups: false,
        canSeeActivity: false,
        canTagInPosts: false,
      },
    },
  ],
  friendRequests: [
    // Example: Pending request from Dana to Alice
    {
      id: 'request-seed-1',
      fromPubkey: 'test-user-dana',
      fromUsername: 'dana-activist',
      toPubkey: 'test-user-alice',
      message: 'Hi! I saw you at the climate march. Would love to connect!',
      method: 'username' as const,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      expiresAt: Date.now() + 28 * 24 * 60 * 60 * 1000, // 28 days from now
    },
  ],
  friendInviteLinks: [
    // Example: Alice's invite link
    {
      id: 'invite-seed-1',
      creatorPubkey: 'test-user-alice',
      code: 'DEMO2024',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      maxUses: 10,
      currentUses: 2,
      createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
    },
  ],
};
