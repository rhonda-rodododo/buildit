/**
 * Database Module Types
 * Airtable-like database system
 */

import { z } from 'zod';
import type { CustomField, CustomFieldValues } from '../custom-fields/types';

// Re-export for convenience
export type { CustomFieldValues };

/**
 * View Types
 */
export type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'detail' | 'report';

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
  visibleFields?: string[]; // Alias for columnOrder, used in templates

  // Board view config
  boardGroupBy?: string; // field name to group by (status, priority, etc.)
  boardCardTitleField?: string; // field name for card title
  boardCardFields?: string[]; // fields to show on cards

  // Calendar view config
  calendarDateField?: string; // field name for date
  calendarEndDateField?: string; // field name for end date (optional)
  calendarTitleField?: string; // field name for event title
  calendarViewMode?: 'month' | 'week' | 'day' | 'agenda';

  // Gallery view config
  galleryImageField?: string; // field name for image
  galleryTitleField?: string; // field name for title
  galleryDescriptionField?: string; // field name for description
  galleryColumns?: number; // number of columns

  // Detail view config
  detailHeaderField?: string; // Main title field
  detailSubtitleField?: string; // Subtitle field
  detailAvatarField?: string; // Avatar/image field
  detailSections?: DetailViewSection[];
  detailShowTimeline?: boolean;
  detailShowAttachments?: boolean;
  detailShowRelatedRecords?: boolean;

  // Report view config
  reportType?: 'summary' | 'chart' | 'pivot';
  reportGroupBy?: string[];
  reportAggregations?: ReportAggregation[];
  reportChartType?: 'bar' | 'line' | 'pie' | 'donut';
  reportChartLabelField?: string;
  reportChartValueField?: string;
  reportChartGroupField?: string;
  reportPivotRowField?: string;
  reportPivotColumnField?: string;
  reportPivotValueField?: string;
  reportPivotAggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

/**
 * Detail View Section
 */
export interface DetailViewSection {
  id: string;
  label: string;
  type: 'fields' | 'related' | 'timeline' | 'attachments' | 'custom';
  fields?: string[]; // For 'fields' type - field names to display
  relatedTableKey?: string; // For 'related' type
  columns?: 1 | 2 | 3; // Multi-column layout
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * Report Aggregation
 */
export interface ReportAggregation {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'countDistinct';
  label?: string;
}

/**
 * Form Section for layout
 */
export interface FormSection {
  id: string;
  label: string;
  description?: string;
  fields: string[]; // Field names in order
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  columns?: 1 | 2 | 3; // Multi-column layout
}

/**
 * Form Layout configuration
 */
export interface FormLayout {
  sections: FormSection[];
  submitLabel?: string;
  cancelLabel?: string;
  showSectionNumbers?: boolean;
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

  // Form layout configuration (optional)
  formLayout?: FormLayout;

  // Detail view configuration (optional) - for single record views
  detailConfig?: {
    headerField?: string;
    subtitleField?: string;
    avatarField?: string;
    sections?: DetailViewSection[];
    showTimeline?: boolean;
    showAttachments?: boolean;
    showRelatedRecords?: boolean;
  };

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

/**
 * Activity Types for record timeline
 */
export type RecordActivityType =
  | 'created'
  | 'updated'
  | 'field_changed'
  | 'comment'
  | 'attachment_added'
  | 'attachment_removed'
  | 'status_changed'
  | 'assigned'
  | 'linked'
  | 'unlinked';

/**
 * Activity data for field changes
 */
export interface FieldChangeActivityData {
  fieldName: string;
  fieldLabel?: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Activity data for status changes
 */
export interface StatusChangeActivityData {
  fieldName: string;
  oldStatus: string;
  newStatus: string;
}

/**
 * Activity data for assignments
 */
export interface AssignmentActivityData {
  assigneeType: 'user' | 'persona';
  assigneePubkey: string;
  assigneeName?: string;
}

/**
 * Activity data for linking/unlinking records
 */
export interface LinkActivityData {
  linkedRecordId: string;
  linkedTableId: string;
  linkedTableName?: string;
  linkedRecordDisplayValue?: string;
}

/**
 * Activity data for comments
 */
export interface CommentActivityData {
  commentId: string;
  contentPreview: string;
  isReply: boolean;
  parentCommentId?: string;
}

/**
 * Activity data for attachments
 */
export interface AttachmentActivityData {
  attachmentId: string;
  fileId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}

/**
 * Union of all activity data types
 */
export type RecordActivityData =
  | FieldChangeActivityData
  | StatusChangeActivityData
  | AssignmentActivityData
  | LinkActivityData
  | CommentActivityData
  | AttachmentActivityData
  | Record<string, unknown>;

/**
 * Record Activity
 * Activity log for records (timeline)
 */
export interface RecordActivity {
  id: string;
  recordId: string;
  tableId: string;
  groupId: string;
  type: RecordActivityType;
  actorPubkey: string;
  data: RecordActivityData;
  createdAt: number;
}

/**
 * Record Comment
 * Comments/notes per record with threading support
 */
export interface RecordComment {
  id: string;
  recordId: string;
  tableId: string;
  groupId: string;
  authorPubkey: string;
  content: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  // Computed fields (not stored)
  replies?: RecordComment[];
}

/**
 * Record Attachment
 * File attachments linking records to files module
 */
export interface RecordAttachment {
  id: string;
  recordId: string;
  tableId: string;
  groupId: string;
  fileId: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  addedBy: string;
  addedAt: number;
}

/**
 * Zod Schemas for Activity Types
 */
export const RecordActivitySchema = z.object({
  id: z.string().uuid(),
  recordId: z.string(),
  tableId: z.string(),
  groupId: z.string(),
  type: z.enum([
    'created',
    'updated',
    'field_changed',
    'comment',
    'attachment_added',
    'attachment_removed',
    'status_changed',
    'assigned',
    'linked',
    'unlinked',
  ]),
  actorPubkey: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
});

export const RecordCommentSchema = z.object({
  id: z.string().uuid(),
  recordId: z.string(),
  tableId: z.string(),
  groupId: z.string(),
  authorPubkey: z.string(),
  content: z.string().min(1).max(10000),
  parentId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const RecordAttachmentSchema = z.object({
  id: z.string().uuid(),
  recordId: z.string(),
  tableId: z.string(),
  groupId: z.string(),
  fileId: z.string(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  addedBy: z.string(),
  addedAt: z.number(),
});
