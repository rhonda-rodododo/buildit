/**
 * Data Access Layer (DAL) — unified storage abstraction
 *
 * Routes all database operations through either:
 * - **Tauri IPC** → Rust SQLite backend (desktop app)
 * - **Dexie/IndexedDB** → browser-side storage (dev mode / fallback)
 *
 * This is the single entry point for all data persistence. Stores, managers,
 * and components should never touch Dexie or invoke() directly — only the DAL.
 *
 * ## Reactivity
 *
 * The DAL provides `subscribe(table, callback)` which fires on every change.
 * In Tauri mode, this listens to `db-change` events from Rust's update_hook.
 * In Dexie mode, it wraps Dexie's hooks.
 *
 * ## Column Naming
 *
 * Frontend uses camelCase (JS convention). The Rust backend handles the
 * camelCase↔snake_case conversion transparently. The DAL passes camelCase
 * objects directly to invoke().
 */

import type { BuildItDB } from './db';
import { logger } from '@/lib/logger';

// ── Types ───────────────────────────────────────────────────────────────────

/** Change event from the database */
export interface DataChangeEvent {
  /** The operation: INSERT, UPDATE, or DELETE */
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  /** The table that changed */
  table: string;
  /** The rowid of the changed row */
  rowid: number;
}

/** Query filter for DAL queries */
export interface QueryFilter {
  /** Column-value equality conditions (AND'd) */
  whereClause?: Record<string, unknown>;
  /** Column to order by */
  orderBy?: string;
  /** Sort direction */
  orderDir?: 'asc' | 'desc';
  /** Max results */
  limit?: number;
  /** Skip N results */
  offset?: number;
}

/** Options for raw/custom queries that need different implementations per backend */
export interface CustomQueryOptions<T> {
  /** SQL query string for Tauri/SQLite backend */
  sql: string;
  /** SQL parameters (positional) */
  params?: unknown[];
  /** Dexie fallback function — receives the Dexie db and returns results */
  dexieFallback: (db: BuildItDB) => Promise<T[] | void>;
}

type ChangeCallback = (event: DataChangeEvent) => void;
type UnsubscribeFn = () => void;

// ── Environment Detection ───────────────────────────────────────────────────

/** Check if running inside Tauri (desktop app) */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ── DAL Implementation ──────────────────────────────────────────────────────

class DataAccessLayer {
  private subscribers = new Map<string, Set<ChangeCallback>>();
  private globalSubscribers = new Set<ChangeCallback>();
  private tauriListenerUnlisten: (() => void) | null = null;
  private initialized = false;

  /**
   * Initialize the DAL. Must be called once at app startup.
   *
   * In Tauri mode, sets up the db-change event listener.
   * In Dexie mode, no-op (Dexie hooks are set up elsewhere).
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (isTauri()) {
      await this.initTauriListener();
    }

    this.initialized = true;
    logger.info(`DAL initialized (backend: ${isTauri() ? 'sqlite' : 'dexie'})`);
  }

  /** Current backend type */
  get backend(): 'sqlite' | 'dexie' {
    return isTauri() ? 'sqlite' : 'dexie';
  }

  // ── CRUD Operations ─────────────────────────────────────────────────────

  /** Insert or replace a record */
  async put<T extends object>(table: string, record: T): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('db_put', { table, record });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).put(record as Record<string, unknown>);
    }
  }

  /** Get a single record by primary key */
  async get<T>(table: string, key: string | number): Promise<T | undefined> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<T | null>('db_get', { table, key: String(key) });
      return result ?? undefined;
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      return db.table(table).get(key);
    }
  }

  /** Get all records from a table */
  async getAll<T>(table: string): Promise<T[]> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<T[]>('db_get_all', { table });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      return db.table(table).toArray();
    }
  }

  /** Query records with filtering, sorting, and pagination */
  async query<T>(table: string, filter: QueryFilter): Promise<T[]> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<T[]>('db_query', { table, filter });
    } else {
      // Dexie fallback: basic where/orderBy/limit support
      const { getDB } = await import('./db');
      const db = getDB();
      let collection = db.table(table).toCollection();

      if (filter.whereClause) {
        const entries = Object.entries(filter.whereClause);
        if (entries.length === 1) {
          const [key, value] = entries[0];
          collection = db.table(table).where(key).equals(value as string | number);
        } else if (entries.length > 1) {
          // Dexie compound filter: use filter()
          collection = db.table(table).filter((item: Record<string, unknown>) =>
            entries.every(([k, v]) => item[k] === v)
          );
        }
      }

      let results = await collection.toArray();

      if (filter.orderBy) {
        const dir = filter.orderDir === 'desc' ? -1 : 1;
        const key = filter.orderBy;
        results.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const aVal = a[key];
          const bVal = b[key];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return dir;
          if (bVal == null) return -dir;
          return aVal < bVal ? -dir : aVal > bVal ? dir : 0;
        });
      }

      if (filter.offset) {
        results = results.slice(filter.offset);
      }
      if (filter.limit) {
        results = results.slice(0, filter.limit);
      }

      return results as T[];
    }
  }

  /** Delete a record by primary key */
  async delete(table: string, key: string | number): Promise<boolean> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<boolean>('db_delete', { table, key: String(key) });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).delete(key);
      return true;
    }
  }

  /** Bulk insert/replace records */
  async bulkPut<T extends object>(table: string, records: T[]): Promise<number> {
    if (records.length === 0) return 0;

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<number>('db_bulk_put', { table, records });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).bulkPut(records as Record<string, unknown>[]);
      return records.length;
    }
  }

  /** Count records, optionally with a filter */
  async count(table: string, filter?: Record<string, unknown>): Promise<number> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<number>('db_count', { table, filter });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      if (filter) {
        const entries = Object.entries(filter);
        if (entries.length === 1) {
          const [key, value] = entries[0];
          return db.table(table).where(key).equals(value as string | number).count();
        }
        return db
          .table(table)
          .filter((item: Record<string, unknown>) =>
            entries.every(([k, v]) => item[k] === v)
          )
          .count();
      }
      return db.table(table).count();
    }
  }

  /** Clear all records from a table */
  async clearTable(table: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('db_clear_table', { table });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).clear();
    }
  }

  /** Update specific fields of a record by primary key */
  async update<T extends object>(
    table: string,
    key: string | number,
    changes: Partial<T>
  ): Promise<void> {
    if (isTauri()) {
      // For SQLite: read existing, merge, write back
      const { invoke } = await import('@tauri-apps/api/core');
      const existing = await invoke<T | null>('db_get', { table, key: String(key) });
      if (!existing) throw new Error(`Record not found in ${table} with key ${key}`);
      const merged = { ...existing, ...changes };
      await invoke('db_put', { table, record: merged });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).update(key, changes as Record<string, unknown>);
    }
  }

  /** Add a record (fails if key already exists) */
  async add<T extends object>(table: string, record: T): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      // Check existence first to mirror Dexie's add() behavior
      const pk = this.guessPrimaryKey(table, record);
      if (pk !== undefined) {
        const existing = await invoke('db_get', { table, key: String(pk) });
        if (existing) throw new Error(`Key already exists in ${table}`);
      }
      await invoke('db_put', { table, record });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      await db.table(table).add(record as Record<string, unknown>);
    }
  }

  /** Delete records matching a WHERE clause */
  async deleteWhere(table: string, whereClause: Record<string, unknown>): Promise<number> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<number>('db_delete_where', { table, whereClause });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      const entries = Object.entries(whereClause);
      if (entries.length === 1) {
        const [key, value] = entries[0];
        return db.table(table).where(key).equals(value as string | number).delete();
      }
      // Multi-condition: filter then delete
      const matches = await db.table(table).filter((item: Record<string, unknown>) =>
        entries.every(([k, v]) => item[k] === v)
      ).toArray();
      const keys = matches.map((m: Record<string, unknown>) =>
        m.id ?? m.publicKey ?? m.pubkey ?? m.key
      ).filter(Boolean) as (string | number)[];
      for (const key of keys) {
        await db.table(table).delete(key);
      }
      return keys.length;
    }
  }

  /**
   * Execute a custom query with different implementations per backend.
   * This is the escape hatch for complex queries (OR conditions, JOINs,
   * custom filters) that don't map to the simple QueryFilter.
   * NOTE: SQL must be a SELECT statement (Rust backend enforces this).
   */
  async queryCustom<T>(options: CustomQueryOptions<T>): Promise<T[]> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<T[]>('db_execute_query', {
        sql: options.sql,
        params: options.params ?? [],
      });
    } else {
      const { getDB } = await import('./db');
      const db = getDB();
      const result = await options.dexieFallback(db);
      return result ?? [];
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Guess the primary key value from a record based on table conventions */
  private guessPrimaryKey(table: string, record: object): unknown {
    const rec = record as Record<string, unknown>;
    // Tables with known primary keys
    const pkMap: Record<string, string> = {
      identities: 'publicKey',
      usernameSettings: 'publicKey',
      userPresence: 'pubkey',
      cacheMetadata: 'key',
    };
    const pkField = pkMap[table] ?? 'id';
    return rec[pkField];
  }

  // ── Database Lifecycle ──────────────────────────────────────────────────

  /** Open the SQLite database with an encryption key (Tauri only) */
  async open(key: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('db_open', { key });
    }
    // Dexie: handled by initializeDatabase() in db.ts
  }

  /** Close the SQLite database (Tauri only) */
  async close(): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('db_close');
    }
  }

  /** Check if database is open */
  async isOpen(): Promise<boolean> {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<boolean>('db_is_open');
    }
    return true; // Dexie is always "open" once initialized
  }

  // ── Reactive Subscriptions ──────────────────────────────────────────────

  /**
   * Subscribe to changes on a specific table.
   * Returns an unsubscribe function.
   */
  subscribe(table: string, callback: ChangeCallback): UnsubscribeFn {
    if (!this.subscribers.has(table)) {
      this.subscribers.set(table, new Set());
    }
    this.subscribers.get(table)!.add(callback);

    return () => {
      const subs = this.subscribers.get(table);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(table);
        }
      }
    };
  }

  /**
   * Subscribe to changes on ALL tables.
   * Returns an unsubscribe function.
   */
  subscribeAll(callback: ChangeCallback): UnsubscribeFn {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  /** Manually emit a change event (useful for Dexie fallback integration) */
  emitChange(event: DataChangeEvent): void {
    this.dispatchChange(event);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private async initTauriListener(): Promise<void> {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      this.tauriListenerUnlisten = await listen<DataChangeEvent>(
        'db-change',
        (event) => {
          this.dispatchChange(event.payload);
        }
      );
    } catch (error) {
      logger.warn('Failed to set up Tauri db-change listener:', error);
    }
  }

  private dispatchChange(event: DataChangeEvent): void {
    // Table-specific subscribers
    const subs = this.subscribers.get(event.table);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch (error) {
          logger.error(`DAL subscriber error for ${event.table}:`, error);
        }
      }
    }

    // Global subscribers
    for (const cb of this.globalSubscribers) {
      try {
        cb(event);
      } catch (error) {
        logger.error('DAL global subscriber error:', error);
      }
    }
  }

  /** Clean up listeners */
  destroy(): void {
    if (this.tauriListenerUnlisten) {
      this.tauriListenerUnlisten();
      this.tauriListenerUnlisten = null;
    }
    this.subscribers.clear();
    this.globalSubscribers.clear();
    this.initialized = false;
  }
}

// ── Singleton Export ─────────────────────────────────────────────────────────

/** Global DAL instance */
export const dal = new DataAccessLayer();
