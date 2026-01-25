import Dexie, { type Table } from 'dexie';
import type { TableSchema } from '@/types/modules';
import type { DBFriend, FriendRequest, FriendInviteLink } from '@/modules/friends/types';
import { logger } from '@/lib/logger';
import type {
  DBConversation,
  ConversationMember,
  ConversationMessage,
  UserPresence,
  ChatWindow,
} from '@/core/messaging/conversationSchema';
import type {
  DBGroupEntity,
  DBGroupEntityMessage,
  DBCoalition,
  DBChannel,
} from '@/core/groupEntity/types';
import type { DBOfflineQueueItem, DBCacheMetadata } from '@/core/offline/types';

/**
 * CORE DATABASE SCHEMA INTERFACES
 * These are always present regardless of module configuration
 */

export interface DBIdentity {
  publicKey: string; // primary key
  encryptedPrivateKey: string; // AES-GCM encrypted private key (base64)
  salt: string; // PBKDF2 salt (base64) - unique per identity
  iv: string; // AES-GCM initialization vector (base64)
  webAuthnProtected: boolean; // Whether WebAuthn quick-unlock is enabled
  credentialId?: string; // WebAuthn credential ID (if webAuthnProtected)
  keyVersion: number; // For key rotation tracking
  name: string;
  npub?: string; // bech32-encoded public key
  username?: string; // Human-readable username (e.g., "alice-organizer")
  displayName?: string; // Display name (e.g., "Alice Martinez")
  nip05?: string; // Verified identifier (alice@domain.com)
  nip05Verified?: boolean; // NIP-05 verification status
  created: number;
  lastUsed: number;
  // Security settings stored per-identity
  securitySettings?: string; // JSON-encoded SecuritySettings
  // Backup tracking - for recovery UX
  recoveryPhraseShownAt?: number; // When recovery phrase was first displayed
  recoveryPhraseConfirmedAt?: number; // When user verified they saved recovery phrase
  lastBackupAt?: number; // When last backup file was created
  importedWithoutBackup?: boolean; // True if imported via nsec (skipped backup flow)
}

export interface DBGroup {
  id: string; // primary key
  name: string;
  description: string;
  adminPubkeys: string[];
  created: number;
  privacy: 'public' | 'private';
  encryptedGroupKey?: string;
  enabledModules: string[];
}

export interface DBGroupMember {
  id?: number;
  groupId: string;
  pubkey: string;
  role: 'admin' | 'moderator' | 'member' | 'read-only';
  joined: number;
}

export interface DBGroupInvitation {
  id: string;
  groupId: string;
  inviterPubkey: string;
  inviteePubkey?: string; // For direct invites; undefined for link invites
  code?: string; // For link invites
  role: 'admin' | 'moderator' | 'member' | 'read-only';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  message?: string;
  createdAt: number;
  expiresAt?: number;
  acceptedAt?: number;
}

export interface DBMessage {
  id: string; // event id
  groupId: string | null;
  authorPubkey: string;
  recipientPubkey?: string;
  content: string;
  kind: number;
  timestamp: number;
  tags: string[][];
  parentId?: string;
  threadId?: string;
}

export interface DBNostrEvent {
  id: string; // primary key
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig: string;
}

export interface DBModuleInstance {
  id: string; // primary key: `${groupId}:$`
  moduleId: string;
  groupId: string;
  state: 'disabled' | 'enabled' | 'loading' | 'error';
  config: Record<string, unknown>;
  enabledAt: number;
  enabledBy: string;
  lastError?: string;
  updatedAt: number;
}

export interface DBUsernameSettings {
  pubkey: string; // primary key
  allowUsernameSearch: boolean; // Can be found by username
  allowEmailDiscovery: boolean; // Can be found by email
  visibleTo: 'public' | 'friends' | 'groups' | 'none'; // Who can see your profile
  showInDirectory: boolean; // Appear in user directory
  updatedAt: number;
}

// Re-export friends types for convenience
export type { DBFriend, FriendRequest, FriendInviteLink };

// Re-export conversation types for convenience
export type {
  DBConversation,
  ConversationMember,
  ConversationMessage,
  UserPresence,
  ChatWindow,
};

// Re-export group entity types for convenience
export type {
  DBGroupEntity,
  DBGroupEntityMessage,
  DBCoalition,
  DBChannel,
};

// Re-export offline queue types for convenience
export type { DBOfflineQueueItem, DBCacheMetadata };

/**
 * MULTI-DEVICE SUPPORT INTERFACES
 */

export interface DBLinkedDevice {
  id: string;
  identityPubkey: string;
  type: 'primary' | 'linked' | 'bunker';
  name: string;
  deviceInfo: string; // JSON-encoded DeviceInfo
  lastSeen: number;
  isCurrent: boolean;
  createdAt: number;
}

export interface DBDeviceTransfer {
  id: string;
  identityPubkey: string;
  direction: 'outgoing' | 'incoming';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  deviceName: string;
  sessionData?: string; // JSON-encoded session data (encrypted)
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface DBBunkerConnection {
  id: string;
  identityPubkey: string;
  remotePubkey: string; // The requesting app's pubkey
  name: string; // User-friendly name for the connection
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  permissions: string; // JSON-encoded NIP-46 permissions
  relays: string; // JSON-encoded relay list
  lastConnected: number;
  createdAt: number;
}

export interface DBIdentityBackup {
  id: string;
  identityPubkey: string;
  type: 'recovery_phrase' | 'encrypted_file' | 'device_transfer';
  encryptedData?: string; // For encrypted file backups
  checksum: string; // SHA-256 checksum for verification
  deviceId: string; // Device that created the backup
  createdAt: number;
}

/**
 * Core database schema (always present)
 */
const CORE_SCHEMA: TableSchema[] = [
  {
    name: 'identities',
    schema: 'publicKey, name, username, nip05, webAuthnProtected, created, lastUsed',
    indexes: ['publicKey', 'name', 'username', 'nip05', 'webAuthnProtected', 'created', 'lastUsed'],
  },
  {
    name: 'groups',
    schema: 'id, name, created, privacy',
    indexes: ['id', 'name', 'created', 'privacy'],
  },
  {
    name: 'groupMembers',
    schema: '++id, [groupId+pubkey], groupId, pubkey, role',
    indexes: ['++id', '[groupId+pubkey]', 'groupId', 'pubkey', 'role'],
  },
  {
    name: 'groupInvitations',
    schema: 'id, groupId, inviterPubkey, inviteePubkey, code, status, createdAt, expiresAt',
    indexes: ['id', 'groupId', 'inviterPubkey', 'inviteePubkey', 'code', 'status', 'createdAt', 'expiresAt'],
  },
  {
    name: 'messages',
    schema: 'id, groupId, authorPubkey, recipientPubkey, timestamp, threadId',
    indexes: ['id', 'groupId', 'authorPubkey', 'recipientPubkey', 'timestamp', 'threadId'],
  },
  {
    name: 'nostrEvents',
    schema: 'id, kind, pubkey, created_at',
    indexes: ['id', 'kind', 'pubkey', 'created_at'],
  },
  {
    name: 'moduleInstances',
    schema: 'id, [groupId+moduleId], groupId, state, updatedAt',
    indexes: ['id', '[groupId+moduleId]', 'groupId', 'moduleId', 'state', 'updatedAt'],
  },
  {
    name: 'usernameSettings',
    schema: 'pubkey, visibleTo, updatedAt',
    indexes: ['pubkey', 'visibleTo', 'updatedAt'],
  },
  {
    name: 'friends',
    schema:
      'id, [userPubkey+friendPubkey], userPubkey, friendPubkey, status, trustTier, verifiedInPerson, isFavorite, addedAt, acceptedAt, *tags',
    indexes: [
      'id',
      '[userPubkey+friendPubkey]',
      'userPubkey',
      'friendPubkey',
      'status',
      'trustTier',
      'verifiedInPerson',
      'isFavorite',
      'addedAt',
      'acceptedAt',
      '*tags',
    ],
  },
  {
    name: 'friendRequests',
    schema: 'id, fromPubkey, toPubkey, createdAt, expiresAt, [fromPubkey+toPubkey]',
    indexes: ['id', 'fromPubkey', 'toPubkey', 'createdAt', 'expiresAt', '[fromPubkey+toPubkey]'],
  },
  {
    name: 'friendInviteLinks',
    schema: 'id, code, creatorPubkey, createdAt, expiresAt, maxUses, currentUses',
    indexes: ['id', 'code', 'creatorPubkey', 'createdAt', 'expiresAt'],
  },
  {
    name: 'conversations',
    schema:
      'id, type, createdBy, createdAt, lastMessageAt, groupId, isPinned, isMuted, isArchived, *participants',
    indexes: [
      'id',
      'type',
      'createdBy',
      'createdAt',
      'lastMessageAt',
      'groupId',
      'isPinned',
      'isMuted',
      'isArchived',
      '*participants',
    ],
  },
  {
    name: 'conversationMembers',
    schema: 'id, conversationId, pubkey, [conversationId+pubkey], role, joinedAt, lastReadAt',
    indexes: [
      'id',
      'conversationId',
      'pubkey',
      '[conversationId+pubkey]',
      'role',
      'joinedAt',
      'lastReadAt',
    ],
  },
  {
    name: 'conversationMessages',
    schema: 'id, conversationId, from, timestamp, replyTo, isEdited',
    indexes: ['id', 'conversationId', 'from', 'timestamp', 'replyTo', 'isEdited'],
  },
  {
    name: 'userPresence',
    schema: 'pubkey, status, lastSeen',
    indexes: ['pubkey', 'status', 'lastSeen'],
  },
  {
    name: 'chatWindows',
    schema: 'id, conversationId, isMinimized, zIndex',
    indexes: ['id', 'conversationId', 'isMinimized', 'zIndex'],
  },
  {
    name: 'groupEntities',
    schema: 'id, groupId, pubkey, createdBy, createdAt',
    indexes: ['id', 'groupId', 'pubkey', 'createdBy', 'createdAt'],
  },
  {
    name: 'groupEntityMessages',
    schema: 'id, groupId, messageId, authorizedBy, authorizedAt, conversationId',
    indexes: ['id', 'groupId', 'messageId', 'authorizedBy', 'authorizedAt', 'conversationId'],
  },
  {
    name: 'coalitions',
    schema: 'id, conversationId, createdBy, createdAt',
    indexes: ['id', 'conversationId', 'createdBy', 'createdAt'],
  },
  {
    name: 'channels',
    schema: 'id, groupId, conversationId, type, createdBy, createdAt',
    indexes: ['id', 'groupId', 'conversationId', 'type', 'createdBy', 'createdAt'],
  },
  // Epic 60: Offline queue for messages, posts, file uploads
  {
    name: 'offlineQueue',
    schema: 'id, type, status, authorPubkey, createdAt, updatedAt, nextRetryAt',
    indexes: ['id', 'type', 'status', 'authorPubkey', 'createdAt', 'updatedAt', 'nextRetryAt'],
  },
  // Epic 60: Cache metadata for LRU eviction
  {
    name: 'cacheMetadata',
    schema: 'key, type, size, lastAccessedAt, createdAt',
    indexes: ['key', 'type', 'size', 'lastAccessedAt', 'createdAt'],
  },
  // Multi-device support: Linked devices tracking
  {
    name: 'linkedDevices',
    schema: 'id, identityPubkey, type, name, lastSeen, isCurrent, createdAt',
    indexes: ['id', 'identityPubkey', 'type', 'lastSeen', 'isCurrent', 'createdAt'],
  },
  // Multi-device support: Device transfer sessions
  {
    name: 'deviceTransfers',
    schema: 'id, identityPubkey, direction, status, deviceName, createdAt, completedAt',
    indexes: ['id', 'identityPubkey', 'direction', 'status', 'createdAt'],
  },
  // Multi-device support: NIP-46 bunker connections
  {
    name: 'bunkerConnections',
    schema: 'id, identityPubkey, remotePubkey, name, status, permissions, lastConnected, createdAt',
    indexes: ['id', 'identityPubkey', 'remotePubkey', 'status', 'lastConnected'],
  },
  // Multi-device support: Identity backups
  {
    name: 'identityBackups',
    schema: 'id, identityPubkey, type, createdAt, deviceId',
    indexes: ['id', 'identityPubkey', 'type', 'createdAt'],
  },
];

/**
 * BuildIt Network Database
 * Supports dynamic schema composition from modules
 */
export class BuildItDB extends Dexie {
  // Core tables (always present)
  identities!: Table<DBIdentity, string>;
  groups!: Table<DBGroup, string>;
  groupMembers!: Table<DBGroupMember, number>;
  groupInvitations!: Table<DBGroupInvitation, string>;
  messages!: Table<DBMessage, string>;
  nostrEvents!: Table<DBNostrEvent, string>;
  moduleInstances!: Table<DBModuleInstance, string>;
  usernameSettings!: Table<DBUsernameSettings, string>;
  friends!: Table<DBFriend, string>;
  friendRequests!: Table<FriendRequest, string>;
  friendInviteLinks!: Table<FriendInviteLink, string>;
  conversations!: Table<DBConversation, string>;
  conversationMembers!: Table<ConversationMember, string>;
  conversationMessages!: Table<ConversationMessage, string>;
  userPresence!: Table<UserPresence, string>;
  chatWindows!: Table<ChatWindow, string>;
  groupEntities!: Table<DBGroupEntity, string>;
  groupEntityMessages!: Table<DBGroupEntityMessage, string>;
  coalitions!: Table<DBCoalition, string>;
  channels!: Table<DBChannel, string>;
  // Epic 60: Offline queue and cache management
  offlineQueue!: Table<DBOfflineQueueItem, string>;
  cacheMetadata!: Table<DBCacheMetadata, string>;

  // Multi-device support tables
  linkedDevices!: Table<DBLinkedDevice, string>;
  deviceTransfers!: Table<DBDeviceTransfer, string>;
  bunkerConnections!: Table<DBBunkerConnection, string>;
  identityBackups!: Table<DBIdentityBackup, string>;

  // Store module schemas for reference
  private moduleSchemas: Map<string, TableSchema[]> = new Map();

  // Dynamic tables from modules
  // Modules access via: db['tableName'] or db.table('tableName')
  events?: Table<any, any>;
  rsvps?: Table<any, any>;
  mutualAidRequests?: Table<any, any>;
  proposals?: Table<any, any>;
  wikiPages?: Table<any, any>;
  databaseTables?: Table<any, any>;
  databaseRecords?: Table<any, any>;
  databaseViews?: Table<any, any>;
  customFields?: Table<any, any>;
  [key: string]: any;

  constructor(moduleSchemas: Map<string, TableSchema[]>) {
    super('BuildItNetworkDB');

    logger.info('🏗️  BuildItDB constructor called with', moduleSchemas.size, 'module schemas');

    // Store module schemas BEFORE initializing
    this.moduleSchemas = moduleSchemas;

    // Schema MUST be initialized in constructor before db.open()
    // Initialize with core + all module schemas
    this._initializeSchema(CORE_SCHEMA);
  }

  /**
   * Initialize database schema with core + module schemas
   */
  private _initializeSchema(coreSchema: TableSchema[]) {
    const schemaMap: Record<string, string> = {};

    // Add core schema
    for (const table of coreSchema) {
      schemaMap[table.name] = table.schema;
    }

    // Add all registered module schemas
    for (const schemas of this.moduleSchemas.values()) {
      for (const table of schemas) {
        if (schemaMap[table.name]) {
          logger.warn(`Table ${table.name} conflicts with existing table`);
        } else {
          schemaMap[table.name] = table.schema;
        }
      }
    }

    // Use version based on number of module schemas + 1 for core
    // This ensures schema updates when modules are added
    // Note: This only DEFINES the schema - Dexie only runs upgrades when version actually changes
    const version = this.moduleSchemas.size + 1;
    logger.info(`🏗️  Defining database schema v${version} (${Object.keys(schemaMap).length} tables)`);
    this.version(version).stores(schemaMap);
  }

  // This method is no longer needed - schemas are passed to constructor
  // Keeping for backward compatibility during transition
  addModuleSchema(_moduleId: string, _schema: TableSchema[]): void {
    throw new Error('addModuleSchema() is deprecated. Schemas must be passed to constructor.');
  }

  /**
   * Get all module schemas
   */
  getModuleSchemas(): Map<string, TableSchema[]> {
    return new Map(this.moduleSchemas);
  }

  // No longer needed - schema is initialized in constructor
  reinitializeWithModules(): void {
    logger.info('⚠️  reinitializeWithModules() is deprecated - schema initialized in constructor');
  }

  /**
   * Get a typed table reference
   * Modules should use this for type-safe access
   */
  getTable<T>(tableName: string): Table<T, any> {
    return this.table(tableName);
  }

  /**
   * Clear all data (use with caution!)
   */
  async clearAll(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }

  /**
   * Get database size estimate
   */
  async getSize(): Promise<{ name: string; records: number }[]> {
    const sizes = await Promise.all(
      this.tables.map(async (table) => ({
        name: table.name,
        records: await table.count(),
      }))
    );
    return sizes;
  }
}

// Schema registry - collects schemas from modules BEFORE db is created
const schemaRegistry = new Map<string, TableSchema[]>();

/**
 * Register a module schema (called during module loading)
 * This must be called BEFORE initializeDatabase()
 */
export function registerModuleSchema(moduleId: string, schema: TableSchema[]): void {
  if (_dbInstance) {
    // Database already initialized (probably due to HMR), skip registration
    logger.warn(`⚠️  DB already initialized, skipping schema registration for: $`);
    return;
  }

  schemaRegistry.set(moduleId, schema);
  logger.info(`📋 Registered schema for module: $ (${schema.length} tables)`);
}

/**
 * Get count of registered module schemas (for debugging)
 */
export function getRegisteredSchemaCount(): number {
  return schemaRegistry.size;
}

// Singleton instance - created only in initializeDatabase()
let _dbInstance: BuildItDB | null = null;

/**
 * Get the database instance
 * NOTE: This will throw if called before initializeDatabase()
 */
export function getDB(): BuildItDB {
  if (!_dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _dbInstance;
}

// Legacy export for backward compatibility during transition
export const db = new Proxy({} as BuildItDB, {
  get(_target, prop) {
    return getDB()[prop as keyof BuildItDB];
  }
});

/**
 * Initialize database (call this on app startup AFTER modules are registered)
 */
export async function initializeDatabase(): Promise<void> {
  // Prevent re-initialization (important for HMR)
  if (_dbInstance) {
    logger.warn('⚠️  Database already initialized, skipping...');
    return;
  }

  try {
    logger.info('🔧 Initializing database...');
    logger.info(`📦 Module schemas collected: ${schemaRegistry.size}`);

    // Create database instance with all collected module schemas
    _dbInstance = new BuildItDB(schemaRegistry);

    // Setup local encryption hooks before opening
    // Uses NIP-44 with a locally-derived encryption key for at-rest encryption
    const { setupLocalEncryptionHooks, initializeHashCache } = await import('./EncryptedDB');

    // SECURITY: Initialize cryptographic hash cache before using encryption
    // This pre-computes SHA-256 hashes needed for key derivation
    await initializeHashCache();

    setupLocalEncryptionHooks(_dbInstance);

    // Open the database
    await _dbInstance.open();

    const tables = _dbInstance.tables.map(t => t.name);
    logger.info(`✅ Database initialized successfully`);
    logger.info(`📊 Total tables: ${tables.length}`, tables);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (_dbInstance) {
    _dbInstance.close();
    _dbInstance = null;
  }
}
