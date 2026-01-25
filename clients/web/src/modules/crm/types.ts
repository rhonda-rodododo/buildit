/**
 * CRM Module Types
 * Multi-table CRM template system for social CRM and case management
 */

import { z } from 'zod';
import type { CustomField } from '@/modules/custom-fields/types';
import type {
  DatabaseTable,
  DatabaseRelationship,
  DatabaseView,
  ViewConfig,
  ViewType,
  RelationshipType,
  OnDeleteAction,
} from '@/modules/database/types';

/**
 * CRM Template Categories
 */
export type CRMTemplateCategory =
  | 'organizing'
  | 'fundraising'
  | 'legal'
  | 'volunteer'
  | 'civil-defense'
  | 'tenant'
  | 'nonprofit'
  | 'member'
  | 'sales';

/**
 * CRM Table Definition (template)
 * Defines a single table within a multi-table CRM template
 */
export interface CRMTableDefinition {
  key: string; // Internal reference key (e.g., 'contacts', 'cases')
  name: string; // Display name
  description?: string;
  icon?: string;
  isPrimary?: boolean; // Main table (e.g., Contacts)
  fields: Partial<CustomField>[];
  defaultViews?: CRMViewTemplate[];

  // Form layout - how fields are grouped/displayed in forms
  formLayout?: CRMFormLayout;

  // Detail view config - how single records are displayed
  detailConfig?: CRMDetailConfig;
}

/**
 * CRM Form Layout (template)
 * Defines how form fields are grouped into sections
 */
export interface CRMFormLayout {
  sections: CRMFormSection[];
  submitLabel?: string;
  cancelLabel?: string;
  showSectionNumbers?: boolean;
}

/**
 * CRM Form Section (template)
 */
export interface CRMFormSection {
  id: string;
  label: string;
  description?: string;
  fields: string[]; // Field names in order
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  columns?: 1 | 2 | 3; // Multi-column layout
}

/**
 * CRM Detail View Config (template)
 */
export interface CRMDetailConfig {
  headerField?: string; // Main title field
  subtitleField?: string; // Subtitle field
  avatarField?: string; // Avatar/image field (for contact-like records)
  sections?: CRMDetailSection[];
  showTimeline?: boolean;
  showAttachments?: boolean;
  showRelatedRecords?: boolean;
}

/**
 * CRM Detail Section (template)
 */
export interface CRMDetailSection {
  id: string;
  label: string;
  type: 'fields' | 'related' | 'timeline' | 'attachments' | 'custom';
  fields?: string[]; // For 'fields' type
  relatedTableKey?: string; // For 'related' type
  columns?: 1 | 2 | 3;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * CRM View Template
 */
export interface CRMViewTemplate {
  name: string;
  type: ViewType;
  config: Partial<ViewConfig>;
  filters?: Array<{
    fieldName: string;
    operator: string;
    value: unknown;
  }>;
  sorts?: Array<{
    fieldName: string;
    direction: 'asc' | 'desc';
  }>;
}

/**
 * CRM Relationship Definition
 * Defines relationships between tables in a multi-table template
 */
export interface CRMRelationshipDefinition {
  sourceTable: string; // key from CRMTableDefinition
  sourceField: string; // field name
  targetTable: string; // key from CRMTableDefinition
  targetField: string; // display field from target
  type: RelationshipType;
  label?: string;
  required?: boolean;
  onDelete?: OnDeleteAction;
}

/**
 * CRM Seed Data Item
 */
export interface CRMSeedDataItem {
  tableKey: string;
  records: Array<Record<string, unknown>>;
}

/**
 * CRM Seed Data Set
 */
export interface CRMSeedDataSet {
  items: CRMSeedDataItem[];
}

/**
 * CRM Multi-Table Template
 * Complete template with multiple related tables
 */
export interface CRMMultiTableTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: CRMTemplateCategory;

  // Multiple tables
  tables: CRMTableDefinition[];

  // Relationships between tables
  relationships: CRMRelationshipDefinition[];

  // Default views per table
  defaultViews?: Record<string, CRMViewTemplate[]>;

  // Seed data
  seedData?: CRMSeedDataSet;

  // Integration hints
  integrations?: {
    events?: boolean; // Link contacts to event attendance
    files?: boolean; // Enable file attachments
    messaging?: boolean; // Enable DM from contact
    forms?: boolean; // Intake form integration
  };

  // Metadata
  version?: string;
  author?: string;
}

/**
 * Resolved Table (after template application)
 */
export interface ResolvedCRMTable {
  templateKey: string;
  table: DatabaseTable;
  views: DatabaseView[];
}

/**
 * Resolved Relationship (after template application)
 */
export interface ResolvedCRMRelationship {
  relationship: DatabaseRelationship;
  sourceTableKey: string;
  targetTableKey: string;
}

/**
 * Template Application Result
 */
export interface CRMTemplateApplicationResult {
  success: boolean;
  tables: ResolvedCRMTable[];
  relationships: ResolvedCRMRelationship[];
  errors?: string[];
}

/**
 * Contact Record (common structure)
 * Used when a CRM has a primary contacts table
 */
export interface CRMContact {
  id: string;
  tableId: string;
  groupId: string;

  // Common fields
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  pubkey?: string; // Social link to Nostr identity

  // All custom fields
  customFields: Record<string, unknown>;

  // Metadata
  created: number;
  createdBy: string;
  updated: number;
  updatedBy: string;
}

/**
 * Case Record (common structure)
 * Used when a CRM has a cases table
 */
export interface CRMCase {
  id: string;
  tableId: string;
  groupId: string;

  // Common fields
  case_name?: string;
  case_number?: string;
  status?: string;
  priority?: string;
  assigned_to?: string; // pubkey

  // Linked contact
  contact_id?: string;

  // All custom fields
  customFields: Record<string, unknown>;

  // Metadata
  created: number;
  createdBy: string;
  updated: number;
  updatedBy: string;
}

/**
 * CRM Instance (runtime state per group)
 */
export interface CRMInstance {
  groupId: string;
  templateId: string;
  tables: Map<string, DatabaseTable>; // key -> table
  relationships: DatabaseRelationship[];
  appliedAt: number;
  appliedBy: string;
}

/**
 * Zod Schemas for Validation
 */

export const CRMTableDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  isPrimary: z.boolean().optional(),
  fields: z.array(z.any()), // CustomField partial
  defaultViews: z.array(z.any()).optional(),
});

export const CRMRelationshipDefinitionSchema = z.object({
  sourceTable: z.string(),
  sourceField: z.string(),
  targetTable: z.string(),
  targetField: z.string(),
  type: z.enum(['one-to-many', 'many-to-many', 'many-to-one']),
  label: z.string().optional(),
  required: z.boolean().optional(),
  onDelete: z.enum(['cascade', 'set-null', 'restrict']).optional(),
});

export const CRMMultiTableTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string(),
  icon: z.string(),
  category: z.enum([
    'organizing',
    'fundraising',
    'legal',
    'volunteer',
    'civil-defense',
    'tenant',
    'nonprofit',
    'member',
    'sales',
  ]),
  tables: z.array(CRMTableDefinitionSchema),
  relationships: z.array(CRMRelationshipDefinitionSchema),
  defaultViews: z.record(z.string(), z.array(z.any())).optional(),
  seedData: z
    .object({
      items: z.array(
        z.object({
          tableKey: z.string(),
          records: z.array(z.record(z.string(), z.unknown())),
        })
      ),
    })
    .optional(),
  integrations: z
    .object({
      events: z.boolean().optional(),
      files: z.boolean().optional(),
      messaging: z.boolean().optional(),
      forms: z.boolean().optional(),
    })
    .optional(),
  version: z.string().optional(),
  author: z.string().optional(),
});

/**
 * CRM Dashboard Stats
 */
export interface CRMDashboardStats {
  totalRecords: number;
  recordsByTable: Record<string, number>;
  recentActivity: number; // Count in last 7 days
  openCases?: number;
  closedCases?: number;
}

/**
 * CRM Search Result
 */
export interface CRMSearchResult {
  recordId: string;
  tableId: string;
  tableKey: string;
  tableName: string;
  displayValue: string;
  matchedField: string;
  matchedValue: string;
}

/**
 * Field Types for common CRM fields
 */
export const CRM_FIELD_PRESETS = {
  // Contact fields
  name: {
    name: 'name',
    label: 'Name',
    schema: { type: 'string' as const, required: true },
    widget: { widget: 'text' as const, placeholder: 'Full name' },
  },
  full_name: {
    name: 'full_name',
    label: 'Full Name',
    schema: { type: 'string' as const, required: true },
    widget: { widget: 'text' as const, placeholder: 'Full name' },
  },
  email: {
    name: 'email',
    label: 'Email',
    schema: { type: 'string' as const, format: 'email' as const },
    widget: { widget: 'text' as const, placeholder: 'email@example.com' },
  },
  phone: {
    name: 'phone',
    label: 'Phone',
    schema: { type: 'string' as const },
    widget: { widget: 'text' as const, placeholder: '+1 (555) 123-4567' },
  },
  pubkey: {
    name: 'pubkey',
    label: 'Nostr Profile',
    schema: { type: 'string' as const },
    widget: {
      widget: 'pubkey' as const,
      pubkeySource: 'any' as const,
      pubkeyDisplayFormat: 'name_with_avatar' as const,
    },
  },
  notes: {
    name: 'notes',
    label: 'Notes',
    schema: { type: 'string' as const },
    widget: { widget: 'textarea' as const, placeholder: 'Additional notes...' },
  },

  // Case/Status fields
  status: {
    name: 'status',
    label: 'Status',
    schema: { type: 'string' as const },
    widget: {
      widget: 'select' as const,
      options: [
        { value: 'open', label: 'Open' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
      ],
    },
  },
  priority: {
    name: 'priority',
    label: 'Priority',
    schema: { type: 'string' as const },
    widget: {
      widget: 'select' as const,
      options: [
        { value: 'urgent', label: 'Urgent' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ],
    },
  },

  // Date fields
  date: {
    name: 'date',
    label: 'Date',
    schema: { type: 'string' as const, format: 'date' as const },
    widget: { widget: 'date' as const },
  },
  created_date: {
    name: 'created_date',
    label: 'Created Date',
    schema: { type: 'string' as const, format: 'date' as const },
    widget: { widget: 'date' as const },
  },
  due_date: {
    name: 'due_date',
    label: 'Due Date',
    schema: { type: 'string' as const, format: 'date' as const },
    widget: { widget: 'date' as const },
  },

  // Amount/Number fields
  amount: {
    name: 'amount',
    label: 'Amount',
    schema: { type: 'number' as const, minimum: 0 },
    widget: { widget: 'number' as const, placeholder: '0.00' },
  },
} as const;
