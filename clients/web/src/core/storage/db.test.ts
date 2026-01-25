/**
 * Database (db.ts) Tests
 * Uses the test utilities for proper database setup/teardown
 * @vitest-environment happy-dom
 */

// MUST be imported first to set up IndexedDB before Dexie
import 'fake-indexeddb/auto';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '@/test/test-utils';
import { enableTestMode, disableTestMode } from './EncryptedDB';

describe('Database Module', () => {
  beforeEach(async () => {
    enableTestMode();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    disableTestMode();
    vi.clearAllMocks();
  });

  describe('getDB', () => {
    it('should provide access to database after initialization', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      expect(db).toBeDefined();
      expect(db.isOpen()).toBe(true);
    });

    it('should have core tables', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const tableNames = db.tables.map(t => t.name);

      // Core tables should exist
      expect(tableNames).toContain('identities');
      expect(tableNames).toContain('groups');
      expect(tableNames).toContain('groupMembers');
      expect(tableNames).toContain('messages');
      expect(tableNames).toContain('nostrEvents');
      expect(tableNames).toContain('friends');
      expect(tableNames).toContain('conversations');
    });
  });

  describe('BuildItDB operations', () => {
    it('should add and retrieve groups', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const testGroup = {
        id: 'test-group-1',
        name: 'Test Group',
        description: 'A test group for unit testing',
        adminPubkeys: ['pubkey1', 'pubkey2'],
        created: Date.now(),
        privacy: 'private' as const,
        enabledModules: ['messaging'],
      };

      await db.groups.add(testGroup);

      const retrieved = await db.groups.get('test-group-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Group');
      expect(retrieved?.adminPubkeys).toHaveLength(2);
    });

    it('should add and retrieve identities', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const testIdentity = {
        publicKey: 'testpubkey123',
        encryptedPrivateKey: 'encrypted-key-here',
        salt: 'test-salt',
        iv: 'test-iv',
        webAuthnProtected: false,
        keyVersion: 1,
        name: 'Test User',
        username: 'testuser',
        displayName: 'Test User Display',
        created: Date.now(),
        lastUsed: Date.now(),
      };

      await db.identities.add(testIdentity);

      const retrieved = await db.identities.get('testpubkey123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test User');
      expect(retrieved?.username).toBe('testuser');
    });

    it('should add and retrieve messages', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const testMessage = {
        id: 'msg-1',
        groupId: 'group-1',
        authorPubkey: 'author-pubkey',
        content: 'Hello, world!',
        kind: 1,
        timestamp: Date.now(),
        tags: [['p', 'recipient']],
      };

      await db.messages.add(testMessage);

      const retrieved = await db.messages.get('msg-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Hello, world!');
    });

    it('should add group members with compound index', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const member1 = {
        groupId: 'group-1',
        pubkey: 'member-1',
        role: 'admin' as const,
        joined: Date.now(),
      };

      const member2 = {
        groupId: 'group-1',
        pubkey: 'member-2',
        role: 'member' as const,
        joined: Date.now(),
      };

      await db.groupMembers.add(member1);
      await db.groupMembers.add(member2);

      // Query by group
      const groupMembers = await db.groupMembers
        .where('groupId')
        .equals('group-1')
        .toArray();

      expect(groupMembers).toHaveLength(2);
    });

    it('should clear all tables', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      // Add test data
      await db.groups.add({
        id: 'group-1',
        name: 'Group 1',
        description: 'Test',
        adminPubkeys: [],
        created: Date.now(),
        privacy: 'private',
        enabledModules: [],
      });

      expect(await db.groups.count()).toBe(1);

      await db.clearAll();

      expect(await db.groups.count()).toBe(0);
    });

    it('should get database size estimate', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      // Add test data
      await db.groups.add({
        id: 'group-1',
        name: 'Group 1',
        description: 'Test',
        adminPubkeys: [],
        created: Date.now(),
        privacy: 'private',
        enabledModules: [],
      });

      const sizes = await db.getSize();

      expect(Array.isArray(sizes)).toBe(true);
      expect(sizes.length).toBeGreaterThan(0);

      const groupsEntry = sizes.find(s => s.name === 'groups');
      expect(groupsEntry?.records).toBe(1);
    });

    it('should get typed table reference', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const groupsTable = db.getTable<{ id: string; name: string }>('groups');
      expect(groupsTable).toBeDefined();
      expect(groupsTable.name).toBe('groups');
    });

    it('should return module schemas', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const schemas = db.getModuleSchemas();

      // Should be a Map
      expect(schemas instanceof Map).toBe(true);
      // Should have module schemas registered from setupTestDatabase
      expect(schemas.size).toBeGreaterThan(0);
    });
  });

  describe('Friends table', () => {
    it('should add and query friends', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const friend = {
        id: 'friend-1',
        userPubkey: 'user-1',
        friendPubkey: 'friend-pubkey-1',
        status: 'accepted' as const,
        trustTier: 'trusted' as const,
        verifiedInPerson: false,
        isFavorite: true,
        addedAt: Date.now(),
        acceptedAt: Date.now(),
        tags: ['work', 'activist'],
      };

      await db.friends.add(friend);

      // Query by user
      const userFriends = await db.friends
        .where('userPubkey')
        .equals('user-1')
        .toArray();

      expect(userFriends).toHaveLength(1);
      expect(userFriends[0].isFavorite).toBe(true);
    });
  });

  describe('Conversations table', () => {
    it('should add and query conversations', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const conversation = {
        id: 'conv-1',
        type: 'direct' as const,
        createdBy: 'user-1',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        participants: ['user-1', 'user-2'],
        isPinned: false,
        isMuted: false,
        isArchived: false,
      };

      await db.conversations.add(conversation);

      const retrieved = await db.conversations.get('conv-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('direct');
      expect(retrieved?.participants).toHaveLength(2);
    });
  });

  describe('Module instance table', () => {
    it('should track module instances per group', async () => {
      await setupTestDatabase();

      const { getDB } = await import('./db');
      const db = getDB();

      const instance = {
        id: 'group-1:events',
        moduleId: 'events',
        groupId: 'group-1',
        state: 'enabled' as const,
        config: { maxRsvps: 100 },
        enabledAt: Date.now(),
        enabledBy: 'admin-pubkey',
        updatedAt: Date.now(),
      };

      await db.moduleInstances.add(instance);

      // Query by group
      const groupModules = await db.moduleInstances
        .where('groupId')
        .equals('group-1')
        .toArray();

      expect(groupModules).toHaveLength(1);
      expect(groupModules[0].moduleId).toBe('events');
    });
  });
});
