/**
 * Database Module Manager
 * Business logic for database operations
 */

import { db } from '@/core/storage/db';
import type {
  DatabaseTable,
  DatabaseView,
  DatabaseRecord,
  DatabaseRelationship,
  FilterRule,
  SortRule,
} from './types';
import type { DBTable, DBView, DBRecord, DBRelationship } from './schema';
import { useDatabaseStore } from './databaseStore';
import type { CustomField } from '../custom-fields/types';

export class DatabaseManager {
  /**
   * Create a new table
   */
  async createTable(
    groupId: string,
    userPubkey: string,
    name: string,
    description?: string,
    icon?: string
  ): Promise<DatabaseTable> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const table: DatabaseTable = {
      id,
      groupId,
      name,
      description,
      icon,
      fields: [],
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    // Save to DB
    const dbTable: DBTable = {
      id: table.id,
      groupId: table.groupId,
      name: table.name,
      description: table.description,
      icon: table.icon,
      createdBy: table.createdBy,
      created: table.created,
      updated: table.updated,
    };

    await db.databaseTables?.add(dbTable);

    // Add to store
    useDatabaseStore.getState().addTable(table);

    // Create default table view
    await this.createView(table.id, groupId, userPubkey, 'All Records', 'table');

    return table;
  }

  /**
   * Update a table
   */
  async updateTable(
    id: string,
    updates: Partial<Pick<DatabaseTable, 'name' | 'description' | 'icon'>>
  ): Promise<void> {
    const now = Date.now();

    await db.databaseTables.update(id, {
      ...updates,
      updated: now,
    });

    useDatabaseStore.getState().updateTable(id, { ...updates, updated: now });
  }

  /**
   * Delete a table
   */
  async deleteTable(id: string): Promise<void> {
    // Delete all records in this table
    const records = useDatabaseStore.getState().getRecordsByTable(id);
    for (const record of records) {
      await this.deleteRecord(record.id, id);
    }

    // Delete all views for this table
    const views = useDatabaseStore.getState().getViewsByTable(id);
    for (const view of views) {
      await this.deleteView(view.id);
    }

    // Delete all relationships involving this table
    const relationships = useDatabaseStore.getState().getRelationshipsByTable(id);
    for (const rel of relationships) {
      await this.deleteRelationship(rel.id);
    }

    // Delete the table
    await db.databaseTables.delete(id);
    useDatabaseStore.getState().deleteTable(id);
  }

  /**
   * Add field to table
   */
  async addFieldToTable(tableId: string, field: CustomField): Promise<void> {
    const table = useDatabaseStore.getState().getTable(tableId);
    if (!table) throw new Error('Table not found');

    const updatedFields = [...table.fields, field];
    useDatabaseStore.getState().updateTable(tableId, { fields: updatedFields });
  }

  /**
   * Remove field from table
   */
  async removeFieldFromTable(tableId: string, fieldId: string): Promise<void> {
    const table = useDatabaseStore.getState().getTable(tableId);
    if (!table) throw new Error('Table not found');

    const updatedFields = table.fields.filter((f) => f.id !== fieldId);
    useDatabaseStore.getState().updateTable(tableId, { fields: updatedFields });

    // Remove field values from all records
    const records = useDatabaseStore.getState().getRecordsByTable(tableId);
    for (const record of records) {
      const updatedCustomFields = { ...record.customFields };
      delete updatedCustomFields[fieldId];
      await this.updateRecord(record.id, tableId, { customFields: updatedCustomFields });
    }
  }

  /**
   * Create a new view
   */
  async createView(
    tableId: string,
    groupId: string,
    userPubkey: string,
    name: string,
    type: DatabaseView['type']
  ): Promise<DatabaseView> {
    const now = Date.now();
    const id = crypto.randomUUID();

    // Get all existing views for this table to determine order
    const existingViews = useDatabaseStore.getState().getViewsByTable(tableId);
    const order = existingViews.length;

    const view: DatabaseView = {
      id,
      tableId,
      groupId,
      name,
      type,
      config: {},
      filters: [],
      sorts: [],
      groups: [],
      visibleFields: [],
      order,
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    // Save to DB
    const dbView: DBView = {
      id: view.id,
      tableId: view.tableId,
      groupId: view.groupId,
      name: view.name,
      type: view.type,
      config: JSON.stringify(view.config),
      filters: JSON.stringify(view.filters),
      sorts: JSON.stringify(view.sorts),
      groups: JSON.stringify(view.groups),
      visibleFields: JSON.stringify(view.visibleFields),
      order: view.order,
      created: view.created,
      createdBy: view.createdBy,
      updated: view.updated,
    };

    await db.databaseViews?.add(dbView);
    useDatabaseStore.getState().addView(view);

    return view;
  }

  /**
   * Update a view
   */
  async updateView(id: string, updates: Partial<DatabaseView>): Promise<void> {
    const now = Date.now();

    const dbUpdates: Partial<DBView> = {
      ...updates,
      config: updates.config ? JSON.stringify(updates.config) : undefined,
      filters: updates.filters ? JSON.stringify(updates.filters) : undefined,
      sorts: updates.sorts ? JSON.stringify(updates.sorts) : undefined,
      groups: updates.groups ? JSON.stringify(updates.groups) : undefined,
      visibleFields: updates.visibleFields ? JSON.stringify(updates.visibleFields) : undefined,
      updated: now,
    };

    await db.databaseViews.update(id, dbUpdates);
    useDatabaseStore.getState().updateView(id, { ...updates, updated: now });
  }

  /**
   * Delete a view
   */
  async deleteView(id: string): Promise<void> {
    await db.databaseViews.delete(id);
    useDatabaseStore.getState().deleteView(id);
  }

  /**
   * Create a new record
   */
  async createRecord(
    tableId: string,
    groupId: string,
    userPubkey: string,
    customFields: Record<string, unknown>
  ): Promise<DatabaseRecord> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const record: DatabaseRecord = {
      id,
      tableId,
      groupId,
      customFields,
      created: now,
      createdBy: userPubkey,
      updated: now,
      updatedBy: userPubkey,
    };

    // Save to DB
    const dbRecord: DBRecord = {
      id: record.id,
      tableId: record.tableId,
      groupId: record.groupId,
      customFields: JSON.stringify(record.customFields),
      created: record.created,
      createdBy: record.createdBy,
      updated: record.updated,
      updatedBy: record.updatedBy,
    };

    await db.databaseRecords?.add(dbRecord);
    useDatabaseStore.getState().addRecord(record);

    return record;
  }

  /**
   * Update a record
   */
  async updateRecord(
    id: string,
    tableId: string,
    updates: Partial<Pick<DatabaseRecord, 'customFields'>>
  ): Promise<void> {
    const now = Date.now();

    const dbUpdates = {
      customFields: updates.customFields ? JSON.stringify(updates.customFields) : undefined,
      updated: now,
    };

    await db.databaseRecords.update(id, dbUpdates);
    useDatabaseStore.getState().updateRecord(id, tableId, { ...updates, updated: now });
  }

  /**
   * Delete a record
   */
  async deleteRecord(id: string, tableId: string): Promise<void> {
    await db.databaseRecords.delete(id);
    useDatabaseStore.getState().deleteRecord(id, tableId);
  }

  /**
   * Filter records based on filter rules
   */
  filterRecords(records: DatabaseRecord[], filters: FilterRule[]): DatabaseRecord[] {
    if (filters.length === 0) return records;

    return records.filter((record) => {
      return filters.every((filter) => {
        const value = record.customFields[filter.fieldName];

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'not-equals':
            return value !== filter.value;
          case 'contains':
            return String(value).includes(String(filter.value));
          case 'not-contains':
            return !String(value).includes(String(filter.value));
          case 'starts-with':
            return String(value).startsWith(String(filter.value));
          case 'ends-with':
            return String(value).endsWith(String(filter.value));
          case 'is-empty':
            return value === null || value === undefined || value === '';
          case 'is-not-empty':
            return value !== null && value !== undefined && value !== '';
          case 'greater-than':
            return Number(value) > Number(filter.value);
          case 'less-than':
            return Number(value) < Number(filter.value);
          case 'greater-or-equal':
            return Number(value) >= Number(filter.value);
          case 'less-or-equal':
            return Number(value) <= Number(filter.value);
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'not-in':
            return Array.isArray(filter.value) && !filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Sort records based on sort rules
   */
  sortRecords(records: DatabaseRecord[], sorts: SortRule[]): DatabaseRecord[] {
    if (sorts.length === 0) return records;

    return [...records].sort((a, b) => {
      for (const sort of sorts) {
        const aValue = a.customFields[sort.fieldName];
        const bValue = b.customFields[sort.fieldName];

        const comparison =
          aValue === bValue ? 0 : (aValue as number | string) > (bValue as number | string) ? 1 : -1;

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Load tables for a group
   */
  async loadTablesForGroup(groupId: string): Promise<void> {
    const dbTables = await db.databaseTables.where('groupId').equals(groupId).toArray();

    for (const dbTable of dbTables) {
      const table: DatabaseTable = {
        id: dbTable.id,
        groupId: dbTable.groupId,
        name: dbTable.name,
        description: dbTable.description,
        icon: dbTable.icon,
        fields: [], // Will be populated from custom fields
        created: dbTable.created,
        createdBy: dbTable.createdBy,
        updated: dbTable.updated,
      };

      useDatabaseStore.getState().addTable(table);
    }
  }

  /**
   * Load views for a table
   */
  async loadViewsForTable(tableId: string): Promise<void> {
    const dbViews = await db.databaseViews.where('tableId').equals(tableId).toArray();

    for (const dbView of dbViews) {
      const view: DatabaseView = {
        id: dbView.id,
        tableId: dbView.tableId,
        groupId: dbView.groupId,
        name: dbView.name,
        type: dbView.type as DatabaseView['type'],
        config: JSON.parse(dbView.config),
        filters: JSON.parse(dbView.filters),
        sorts: JSON.parse(dbView.sorts),
        groups: JSON.parse(dbView.groups),
        visibleFields: JSON.parse(dbView.visibleFields),
        order: dbView.order,
        created: dbView.created,
        createdBy: dbView.createdBy,
        updated: dbView.updated,
      };

      useDatabaseStore.getState().addView(view);
    }
  }

  /**
   * Load records for a table
   */
  async loadRecordsForTable(tableId: string): Promise<void> {
    const dbRecords = await db.databaseRecords.where('tableId').equals(tableId).toArray();

    for (const dbRecord of dbRecords) {
      const record: DatabaseRecord = {
        id: dbRecord.id,
        tableId: dbRecord.tableId,
        groupId: dbRecord.groupId,
        customFields: JSON.parse(dbRecord.customFields),
        created: dbRecord.created,
        createdBy: dbRecord.createdBy,
        updated: dbRecord.updated,
        updatedBy: dbRecord.updatedBy,
      };

      useDatabaseStore.getState().addRecord(record);
    }
  }

  /**
   * Create a relationship between tables
   */
  async createRelationship(
    groupId: string,
    userPubkey: string,
    sourceTableId: string,
    sourceFieldName: string,
    targetTableId: string,
    targetFieldName: string,
    type: DatabaseRelationship['type'],
    onDelete: DatabaseRelationship['onDelete']
  ): Promise<DatabaseRelationship> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const relationship: DatabaseRelationship = {
      id,
      groupId,
      sourceTableId,
      sourceFieldName,
      targetTableId,
      targetFieldName,
      type,
      onDelete,
      created: now,
      createdBy: userPubkey,
    };

    // Save to DB
    const dbRelationship: DBRelationship = {
      id: relationship.id,
      groupId: relationship.groupId,
      sourceTableId: relationship.sourceTableId,
      sourceFieldName: relationship.sourceFieldName,
      targetTableId: relationship.targetTableId,
      targetFieldName: relationship.targetFieldName,
      type: relationship.type,
      onDelete: relationship.onDelete,
      created: relationship.created,
      createdBy: relationship.createdBy,
    };

    await db.databaseRelationships?.add(dbRelationship);
    useDatabaseStore.getState().addRelationship(relationship);

    return relationship;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    await db.databaseRelationships.delete(id);
    useDatabaseStore.getState().deleteRelationship(id);
  }
}

export const databaseManager = new DatabaseManager();
