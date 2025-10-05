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

  // Store module schemas for reference
  private moduleSchemas: Map<string, TableSchema[]> = new Map();

  // Dynamic tables from modules
  // Modules access via: db['tableName'] or db.table('tableName')
  [key: string]: any;

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
