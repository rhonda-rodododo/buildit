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
    schema: 'id, [groupId+moduleId], groupId, state, updatedAt',
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
  private schemaInitialized: boolean = false;

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

    console.log('🏗️  BuildItDB constructor called with', moduleSchemas.size, 'module schemas');

    // Store module schemas BEFORE initializing
    this.moduleSchemas = moduleSchemas;

    // Schema MUST be initialized in constructor before db.open()
    // Initialize with core + all module schemas
    this._initializeSchema(CORE_SCHEMA);
    this.schemaInitialized = true;
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
          console.warn(`Table ${table.name} from module $ conflicts with existing table`);
        } else {
          schemaMap[table.name] = table.schema;
        }
      }
    }

    // Use version based on number of module schemas + 1 for core
    // This ensures schema updates when modules are added
    const version = this.moduleSchemas.size + 1;
    console.log(`Initializing database version ${version} with ${Object.keys(schemaMap).length} tables`);
    this.version(version).stores(schemaMap);
  }

  // This method is no longer needed - schemas are passed to constructor
  // Keeping for backward compatibility during transition
  addModuleSchema(moduleId: string, schema: TableSchema[]): void {
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
    console.log('⚠️  reinitializeWithModules() is deprecated - schema initialized in constructor');
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
    console.warn(`⚠️  DB already initialized, skipping schema registration for: $`);
    return;
  }

  schemaRegistry.set(moduleId, schema);
  console.log(`📋 Registered schema for module: $ (${schema.length} tables)`);
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
  get(target, prop) {
    return getDB()[prop as keyof BuildItDB];
  }
});

/**
 * Initialize database (call this on app startup AFTER modules are registered)
 */
export async function initializeDatabase(): Promise<void> {
  // Prevent re-initialization (important for HMR)
  if (_dbInstance) {
    console.warn('⚠️  Database already initialized, skipping...');
    return;
  }

  try {
    console.log('🔧 Initializing database...');
    console.log(`📦 Module schemas collected: ${schemaRegistry.size}`);

    // Create database instance with all collected module schemas
    _dbInstance = new BuildItDB(schemaRegistry);

    // Setup encryption hooks before opening
    const { setupEncryptionHooks } = await import('./encryption');
    setupEncryptionHooks(_dbInstance);

    // Open the database
    await _dbInstance.open();

    const tables = _dbInstance.tables.map(t => t.name);
    console.log(`✅ Database initialized successfully`);
    console.log(`📊 Total tables: ${tables.length}`, tables);
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
