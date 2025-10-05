/**
 * Database Module Store
 * Zustand store for database state management
 */

import { create } from 'zustand';
import type {
  DatabaseTable,
  DatabaseView,
  DatabaseRecord,
  DatabaseRelationship,
} from './types';

export interface DatabaseState {
  // Tables
  tables: Map<string, DatabaseTable>;
  currentTableId: string | null;

  // Views
  views: Map<string, DatabaseView>;
  currentViewId: string | null;

  // Records (keyed by tableId)
  recordsByTable: Map<string, Map<string, DatabaseRecord>>;

  // Relationships
  relationships: Map<string, DatabaseRelationship>;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions: Tables
  addTable: (table: DatabaseTable) => void;
  updateTable: (id: string, table: Partial<DatabaseTable>) => void;
  deleteTable: (id: string) => void;
  setCurrentTable: (id: string | null) => void;
  getTablesByGroup: (groupId: string) => DatabaseTable[];
  getTable: (id: string) => DatabaseTable | undefined;

  // Actions: Views
  addView: (view: DatabaseView) => void;
  updateView: (id: string, view: Partial<DatabaseView>) => void;
  deleteView: (id: string) => void;
  setCurrentView: (id: string | null) => void;
  getViewsByTable: (tableId: string) => DatabaseView[];
  getView: (id: string) => DatabaseView | undefined;

  // Actions: Records
  addRecord: (record: DatabaseRecord) => void;
  updateRecord: (id: string, tableId: string, record: Partial<DatabaseRecord>) => void;
  deleteRecord: (id: string, tableId: string) => void;
  getRecordsByTable: (tableId: string) => DatabaseRecord[];
  getRecord: (id: string, tableId: string) => DatabaseRecord | undefined;

  // Actions: Relationships
  addRelationship: (relationship: DatabaseRelationship) => void;
  deleteRelationship: (id: string) => void;
  getRelationshipsByTable: (tableId: string) => DatabaseRelationship[];

  // Loading
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Clear
  clear: () => void;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  // State
  tables: new Map(),
  currentTableId: null,
  views: new Map(),
  currentViewId: null,
  recordsByTable: new Map(),
  relationships: new Map(),
  loading: false,
  error: null,

  // Actions: Tables
  addTable: (table) => {
    set((state) => {
      const newTables = new Map(state.tables);
      newTables.set(table.id, table);
      // Initialize records map for this table
      if (!state.recordsByTable.has(table.id)) {
        const newRecordsByTable = new Map(state.recordsByTable);
        newRecordsByTable.set(table.id, new Map());
        return { tables: newTables, recordsByTable: newRecordsByTable };
      }
      return { tables: newTables };
    });
  },

  updateTable: (id, update) => {
    set((state) => {
      const newTables = new Map(state.tables);
      const existing = newTables.get(id);
      if (existing) {
        newTables.set(id, { ...existing, ...update, updated: Date.now() });
      }
      return { tables: newTables };
    });
  },

  deleteTable: (id) => {
    set((state) => {
      const newTables = new Map(state.tables);
      newTables.delete(id);
      // Delete all views for this table
      const newViews = new Map(state.views);
      for (const [viewId, view] of newViews.entries()) {
        if (view.tableId === id) {
          newViews.delete(viewId);
        }
      }
      // Delete all records for this table
      const newRecordsByTable = new Map(state.recordsByTable);
      newRecordsByTable.delete(id);
      return {
        tables: newTables,
        views: newViews,
        recordsByTable: newRecordsByTable,
        currentTableId: state.currentTableId === id ? null : state.currentTableId,
      };
    });
  },

  setCurrentTable: (id) => set({ currentTableId: id }),

  getTablesByGroup: (groupId) => {
    const tables = get().tables;
    return Array.from(tables.values()).filter((t) => t.groupId === groupId);
  },

  getTable: (id) => get().tables.get(id),

  // Actions: Views
  addView: (view) => {
    set((state) => {
      const newViews = new Map(state.views);
      newViews.set(view.id, view);
      return { views: newViews };
    });
  },

  updateView: (id, update) => {
    set((state) => {
      const newViews = new Map(state.views);
      const existing = newViews.get(id);
      if (existing) {
        newViews.set(id, { ...existing, ...update, updated: Date.now() });
      }
      return { views: newViews };
    });
  },

  deleteView: (id) => {
    set((state) => {
      const newViews = new Map(state.views);
      newViews.delete(id);
      return {
        views: newViews,
        currentViewId: state.currentViewId === id ? null : state.currentViewId,
      };
    });
  },

  setCurrentView: (id) => set({ currentViewId: id }),

  getViewsByTable: (tableId) => {
    const views = get().views;
    return Array.from(views.values())
      .filter((v) => v.tableId === tableId)
      .sort((a, b) => a.order - b.order);
  },

  getView: (id) => get().views.get(id),

  // Actions: Records
  addRecord: (record) => {
    set((state) => {
      const newRecordsByTable = new Map(state.recordsByTable);
      const tableRecords = newRecordsByTable.get(record.tableId) || new Map();
      const newTableRecords = new Map(tableRecords);
      newTableRecords.set(record.id, record);
      newRecordsByTable.set(record.tableId, newTableRecords);
      return { recordsByTable: newRecordsByTable };
    });
  },

  updateRecord: (id, tableId, update) => {
    set((state) => {
      const newRecordsByTable = new Map(state.recordsByTable);
      const tableRecords = newRecordsByTable.get(tableId);
      if (tableRecords) {
        const newTableRecords = new Map(tableRecords);
        const existing = newTableRecords.get(id);
        if (existing) {
          newTableRecords.set(id, { ...existing, ...update, updated: Date.now() });
        }
        newRecordsByTable.set(tableId, newTableRecords);
      }
      return { recordsByTable: newRecordsByTable };
    });
  },

  deleteRecord: (id, tableId) => {
    set((state) => {
      const newRecordsByTable = new Map(state.recordsByTable);
      const tableRecords = newRecordsByTable.get(tableId);
      if (tableRecords) {
        const newTableRecords = new Map(tableRecords);
        newTableRecords.delete(id);
        newRecordsByTable.set(tableId, newTableRecords);
      }
      return { recordsByTable: newRecordsByTable };
    });
  },

  getRecordsByTable: (tableId) => {
    const recordsMap = get().recordsByTable.get(tableId);
    return recordsMap ? Array.from(recordsMap.values()) : [];
  },

  getRecord: (id, tableId) => {
    return get().recordsByTable.get(tableId)?.get(id);
  },

  // Actions: Relationships
  addRelationship: (relationship) => {
    set((state) => {
      const newRelationships = new Map(state.relationships);
      newRelationships.set(relationship.id, relationship);
      return { relationships: newRelationships };
    });
  },

  deleteRelationship: (id) => {
    set((state) => {
      const newRelationships = new Map(state.relationships);
      newRelationships.delete(id);
      return { relationships: newRelationships };
    });
  },

  getRelationshipsByTable: (tableId) => {
    const relationships = get().relationships;
    return Array.from(relationships.values()).filter(
      (r) => r.sourceTableId === tableId || r.targetTableId === tableId
    );
  },

  // Loading
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Clear
  clear: () =>
    set({
      tables: new Map(),
      currentTableId: null,
      views: new Map(),
      currentViewId: null,
      recordsByTable: new Map(),
      relationships: new Map(),
      loading: false,
      error: null,
    }),
}));
