import Dexie, { type Table } from 'dexie';
import type { TableSchema } from '@/types/modules';

/**
 * CORE DATABASE SCHEMA INTERFACES
 * These are always present regardless of module configuration
 */

export interface DBIdentity {
  publicKey: string; // primary key
  encryptedPrivateKey: string;
  name: string;
  npub?: string; // Added for WebAuthn user handles
  created: number;
  lastUsed: number;
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
  id: string; // primary key: `${groupId}:${moduleId}`
  moduleId: string;
  groupId: string;
  state: 'disabled' | 'enabled' | 'loading' | 'error';
  config: Record<string, unknown>;
  enabledAt: number;
  enabledBy: string;
  lastError?: string;
  updatedAt: number;
}

/**
 * MODULE SCHEMA INTERFACES
 * Re-exported from module schema files for convenience
 * These types are always available even when modules are disabled
 */

// Events module
export interface DBEvent {
  id: string;
  groupId?: string;
  title: string;
  description: string;
  startTime: number;
  endTime?: number;
  location?: string;
  privacy: 'public' | 'group' | 'private' | 'direct-action';
  capacity?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tags: string;
  imageUrl?: string;
  locationRevealTime?: number;
}

export interface DBRSVP {
  id?: number;
  eventId: string;
  userPubkey: string;
  status: 'going' | 'maybe' | 'not-going';
  timestamp: number;
  note?: string;
}

// Governance module
export interface DBProposal {
  id: string;
  groupId: string;
  title: string;
  description: string;
  status: 'draft' | 'discussion' | 'voting' | 'decided';
  votingMethod: 'simple' | 'ranked-choice' | 'quadratic' | 'dhondt' | 'consensus';
  votingDeadline?: number;
  createdBy: string;
  created: number;
}

export interface DBVote {
  id?: number;
  proposalId: string;
  voterPubkey: string;
  encryptedBallot: string;
  timestamp: number;
}

// CRM module
export interface DBContact {
  id: string;
  groupId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  customFields: Record<string, unknown>;
  tags: string[];
  created: number;
  updated: number;
}

// Wiki module
export interface DBWikiPage {
  id: string;
  groupId: string;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  version: number;
  created: number;
  updated: number;
  updatedBy: string;
}

// Mutual Aid module
export interface DBMutualAidRequest {
  id: string;
  groupId: string;
  type: 'request' | 'offer';
  category: string;
  title: string;
  description: string;
  status: 'open' | 'matched' | 'fulfilled' | 'closed';
  location?: string;
  createdBy: string;
  created: number;
  expiresAt?: number;
}

// Custom Fields module
export interface DBCustomField {
  id: string;
  groupId: string;
  entityType: string;
  name: string;
  label: string;
  schema: string; // JSON
  widget: string; // JSON
  order: number;
  created: number;
  createdBy: string;
  updated: number;
}


/**
 * Core database schema (always present)
 */
const CORE_SCHEMA: TableSchema[] = [
  {
    name: 'identities',
    schema: 'publicKey, name, created, lastUsed',
    indexes: ['publicKey', 'name', 'created', 'lastUsed'],
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
    schema: 'id, [groupId+moduleId], groupId, moduleId, state, updatedAt',
    indexes: ['id', '[groupId+moduleId]', 'groupId', 'moduleId', 'state', 'updatedAt'],
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
  messages!: Table<DBMessage, string>;
  nostrEvents!: Table<DBNostrEvent, string>;
  moduleInstances!: Table<DBModuleInstance, string>;

  // Module tables (loaded dynamically, but always available)
  events!: Table<DBEvent, string>;
  rsvps!: Table<DBRSVP, number>;
  proposals!: Table<DBProposal, string>;
  votes!: Table<DBVote, number>;
  contacts!: Table<DBContact, string>;
  wikiPages!: Table<DBWikiPage, string>;
  mutualAidRequests!: Table<DBMutualAidRequest, string>;
  customFields!: Table<DBCustomField, string>;

  // Store module schemas for reference
  private moduleSchemas: Map<string, TableSchema[]> = new Map();

  constructor() {
    super('BuildItNetworkDB');

    // Initialize with core schema only
    // Module schemas will be added via addModuleSchema()
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
    for (const [moduleId, schemas] of this.moduleSchemas.entries()) {
      for (const table of schemas) {
        if (schemaMap[table.name]) {
          console.warn(`Table ${table.name} from module ${moduleId} conflicts with existing table`);
        } else {
          schemaMap[table.name] = table.schema;
        }
      }
    }

    this.version(1).stores(schemaMap);
  }

  /**
   * Add module schema to database
   * This should be called during module registration (before db.open())
   */
  addModuleSchema(moduleId: string, schema: TableSchema[]): void {
    if (this.isOpen()) {
      throw new Error('Cannot add module schema after database is opened');
    }

    this.moduleSchemas.set(moduleId, schema);
    console.log(`Registered schema for module: ${moduleId} (${schema.length} tables)`);
  }

  /**
   * Get all module schemas
   */
  getModuleSchemas(): Map<string, TableSchema[]> {
    return new Map(this.moduleSchemas);
  }

  /**
   * Reinitialize database with all registered module schemas
   * Call this after all modules have registered their schemas
   */
  reinitializeWithModules(): void {
    if (this.isOpen()) {
      throw new Error('Cannot reinitialize schema while database is open');
    }

    this._initializeSchema(CORE_SCHEMA);
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

// Singleton instance
export const db = new BuildItDB();

/**
 * Initialize database (call this on app startup AFTER modules are registered)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Reinitialize with all module schemas
    db.reinitializeWithModules();

    // Open the database
    await db.open();
    console.log('Database initialized successfully with all module schemas');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  db.close();
}
