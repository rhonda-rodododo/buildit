/**
 * Database Module Schema
 * Airtable-like database with custom tables, views, and relationships
 */

import type { TableSchema } from '@/types/modules';

/**
 * Database Table Definition
 * User-created tables with custom fields
 */
export interface DBTable {
  id: string; // uuid (primary key)
  groupId: string; // which group this table belongs to
  name: string; // table name (e.g., "contacts", "donations")
  description?: string;
  icon?: string; // emoji or icon name

  // Access control
  createdBy: string;
  created: number;
  updated: number;
}

/**
 * Database View Definition
 * Different ways to view the same table data
 */
export interface DBView {
  id: string; // uuid (primary key)
  tableId: string; // which table this view belongs to
  groupId: string;
  name: string;

  // View type
  type: 'table' | 'board' | 'calendar' | 'gallery'; // view type

  // View configuration (JSON string)
  config: string; // ViewConfig serialized

  // Filter/sort/group settings
  filters: string; // JSON array of filter rules
  sorts: string; // JSON array of sort rules
  groups: string; // JSON array of grouping rules

  // Visible columns/fields
  visibleFields: string; // JSON array of field IDs

  // Display order
  order: number;

  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Database Record
 * Actual data rows in user-created tables
 */
export interface DBRecord {
  id: string; // uuid (primary key)
  tableId: string; // which table this record belongs to
  groupId: string;

  // Custom field values
  customFields: string; // JSON object - Record<string, unknown>

  // Metadata
  created: number;
  createdBy: string;
  updated: number;
  updatedBy: string;
}

/**
 * Database Relationship Definition
 * Defines relationships between tables
 */
export interface DBRelationship {
  id: string; // uuid (primary key)
  groupId: string;

  // Source table
  sourceTableId: string;
  sourceFieldName: string;

  // Target table
  targetTableId: string;
  targetFieldName: string;

  // Relationship type
  type: 'one-to-many' | 'many-to-many' | 'many-to-one';

  // Cascading deletes
  onDelete: 'cascade' | 'set-null' | 'restrict';

  created: number;
  createdBy: string;
}

/**
 * Database module schema definition
 */
export const databaseSchema: TableSchema[] = [
  {
    name: 'databaseTables',
    schema: 'id, groupId, name, description, icon, createdBy, created',
    indexes: ['id', 'groupId', 'name', 'createdBy', 'created'],
  },
  {
    name: 'databaseViews',
    schema: 'id, tableId, groupId, name, type, config, filters, sorts, groups, visibleFields, order, created, createdBy',
    indexes: ['id', 'tableId', 'groupId', 'type', 'created', 'createdBy'],
  },
  {
    name: 'databaseRecords',
    schema: 'id, tableId, groupId, customFields, created, createdBy, updated, updatedBy',
    indexes: ['id', 'tableId', 'groupId', 'created', 'createdBy', 'updated', 'updatedBy'],
  },
  {
    name: 'databaseRelationships',
    schema: 'id, groupId, sourceTableId, sourceFieldName, targetTableId, targetFieldName, type, onDelete, created, createdBy',
    indexes: ['id', 'groupId', 'sourceTableId', 'targetTableId', 'created', 'createdBy'],
  },
];
