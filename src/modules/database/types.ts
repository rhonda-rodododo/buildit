/**
 * Database Module Types
 * Airtable-like database system
 */

import { z } from 'zod';
import type { CustomField, CustomFieldValues } from '../custom-fields/types';

/**
 * View Types
 */
export type ViewType = 'table' | 'board' | 'calendar' | 'gallery';

/**
 * Relationship Types
 */
export type RelationshipType = 'one-to-many' | 'many-to-many' | 'many-to-one';

/**
 * On Delete Actions
 */
export type OnDeleteAction = 'cascade' | 'set-null' | 'restrict';

/**
 * Filter Operators
 */
export type FilterOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'starts-with'
  | 'ends-with'
  | 'is-empty'
  | 'is-not-empty'
  | 'greater-than'
  | 'less-than'
  | 'greater-or-equal'
  | 'less-or-equal'
  | 'in'
  | 'not-in';

/**
 * Filter Rule
 */
export interface FilterRule {
  fieldName: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Sort Direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort Rule
 */
export interface SortRule {
  fieldName: string;
  direction: SortDirection;
}

/**
 * Group Rule
 */
export interface GroupRule {
  fieldName: string;
  direction?: SortDirection;
}

/**
 * View Configuration
 */
export interface ViewConfig {
  // Table view config
  columnWidths?: Record<string, number>;
  columnOrder?: string[];

  // Board view config
  boardGroupBy?: string; // field name to group by (status, priority, etc.)
  boardCardFields?: string[]; // fields to show on cards

  // Calendar view config
  calendarDateField?: string; // field name for date
  calendarEndDateField?: string; // field name for end date (optional)
  calendarViewMode?: 'month' | 'week' | 'day' | 'agenda';

  // Gallery view config
  galleryImageField?: string; // field name for image
  galleryTitleField?: string; // field name for title
  galleryDescriptionField?: string; // field name for description
  galleryColumns?: number; // number of columns
}

/**
 * Database Table
 */
export interface DatabaseTable {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  icon?: string;

  // Custom fields for this table
  fields: CustomField[];

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Database View
 */
export interface DatabaseView {
  id: string;
  tableId: string;
  groupId: string;
  name: string;
  type: ViewType;
  config: ViewConfig;

  // Filter/sort/group
  filters: FilterRule[];
  sorts: SortRule[];
  groups: GroupRule[];

  // Visible fields
  visibleFields: string[];

  // Display order
  order: number;

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Database Record
 */
export interface DatabaseRecord {
  id: string;
  tableId: string;
  groupId: string;

  // Custom field values
  customFields: CustomFieldValues;

  // Metadata
  created: number;
  createdBy: string;
  updated: number;
  updatedBy: string;
}

/**
 * Database Relationship
 */
export interface DatabaseRelationship {
  id: string;
  groupId: string;

  // Source
  sourceTableId: string;
  sourceFieldName: string;

  // Target
  targetTableId: string;
  targetFieldName: string;

  // Config
  type: RelationshipType;
  onDelete: OnDeleteAction;

  // Timestamps
  created: number;
  createdBy: string;
}

/**
 * Zod Schemas for Validation
 */

export const FilterRuleSchema = z.object({
  fieldName: z.string(),
  operator: z.enum([
    'equals',
    'not-equals',
    'contains',
    'not-contains',
    'starts-with',
    'ends-with',
    'is-empty',
    'is-not-empty',
    'greater-than',
    'less-than',
    'greater-or-equal',
    'less-or-equal',
    'in',
    'not-in',
  ]),
  value: z.unknown(),
});

export const SortRuleSchema = z.object({
  fieldName: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export const GroupRuleSchema = z.object({
  fieldName: z.string(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const ViewConfigSchema = z.object({
  columnWidths: z.record(z.string(), z.number()).optional(),
  columnOrder: z.array(z.string()).optional(),
  boardGroupBy: z.string().optional(),
  boardCardFields: z.array(z.string()).optional(),
  calendarDateField: z.string().optional(),
  calendarEndDateField: z.string().optional(),
  calendarViewMode: z.enum(['month', 'week', 'day', 'agenda']).optional(),
  galleryImageField: z.string().optional(),
  galleryTitleField: z.string().optional(),
  galleryDescriptionField: z.string().optional(),
  galleryColumns: z.number().optional(),
});

export const DatabaseTableSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  fields: z.array(z.any()), // CustomField[] from custom-fields module
  created: z.number(),
  createdBy: z.string(),
  updated: z.number(),
});

export const DatabaseViewSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(['table', 'board', 'calendar', 'gallery']),
  config: ViewConfigSchema,
  filters: z.array(FilterRuleSchema),
  sorts: z.array(SortRuleSchema),
  groups: z.array(GroupRuleSchema),
  visibleFields: z.array(z.string()),
  order: z.number().int().min(0),
  created: z.number(),
  createdBy: z.string(),
  updated: z.number(),
});

export const DatabaseRecordSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  groupId: z.string(),
  customFields: z.record(z.string(), z.unknown()),
  created: z.number(),
  createdBy: z.string(),
  updated: z.number(),
  updatedBy: z.string(),
});

export const DatabaseRelationshipSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  sourceTableId: z.string(),
  sourceFieldName: z.string(),
  targetTableId: z.string(),
  targetFieldName: z.string(),
  type: z.enum(['one-to-many', 'many-to-many', 'many-to-one']),
  onDelete: z.enum(['cascade', 'set-null', 'restrict']),
  created: z.number(),
  createdBy: z.string(),
});

/**
 * Database Template
 * Pre-configured table templates for quick setup
 */
export interface DatabaseTemplate {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'crm' | 'project' | 'inventory' | 'custom';
  icon?: string;

  // Template configuration
  tables: DatabaseTableTemplate[];
  relationships: DatabaseRelationshipTemplate[];

  // Metadata
  isBuiltIn: boolean; // System templates vs user templates
  groupId?: string; // If user template
  created: number;
  createdBy?: string;
  updated: number;
}

/**
 * Table Template (without group/time metadata)
 */
export interface DatabaseTableTemplate {
  name: string;
  description?: string;
  icon?: string;
  fields: CustomField[];
  defaultViews?: DatabaseViewTemplate[];
}

/**
 * View Template (without group/time metadata)
 */
export interface DatabaseViewTemplate {
  name: string;
  type: ViewType;
  config: ViewConfig;
  filters?: FilterRule[];
  sorts?: SortRule[];
  groups?: GroupRule[];
  visibleFields?: string[];
  order: number;
}

/**
 * Relationship Template (without group/time metadata)
 */
export interface DatabaseRelationshipTemplate {
  sourceTableName: string;
  sourceFieldName: string;
  targetTableName: string;
  targetFieldName: string;
  type: RelationshipType;
  onDelete: OnDeleteAction;
}

/**
 * Zod Schema for Templates
 */
export const DatabaseTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string(),
  category: z.enum(['general', 'crm', 'project', 'inventory', 'custom']),
  icon: z.string().optional(),
  tables: z.array(z.any()), // DatabaseTableTemplate[]
  relationships: z.array(z.any()), // DatabaseRelationshipTemplate[]
  isBuiltIn: z.boolean(),
  groupId: z.string().optional(),
  created: z.number(),
  createdBy: z.string().optional(),
  updated: z.number(),
});
