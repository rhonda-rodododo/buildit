/**
 * Custom Fields Module Types
 * JSON Schema-based custom fields with react-hook-form integration
 */

import { z } from 'zod';

/**
 * Field Types (Widget Types)
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'relationship'
  | 'pubkey';

/**
 * Entity Types that can have custom fields
 */
export type EntityType =
  | 'event'
  | 'aid-request'
  | 'aid-offer'
  | 'contact'
  | 'proposal'
  | 'wiki-page'
  | 'database-record';

/**
 * JSON Schema type definitions
 * Using a subset of JSON Schema spec
 */
export interface JSONSchemaField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;

  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'uri' | 'date' | 'date-time' | 'uuid';

  // Number validations
  minimum?: number;
  maximum?: number;
  multipleOf?: number;

  // Array validations
  items?: JSONSchemaField;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Enum/Select options
  enum?: (string | number)[];
  enumLabels?: string[]; // Display labels for enum values

  // Required
  required?: boolean;
}

/**
 * UI Widget Configuration
 * Additional metadata for rendering form fields
 */
export interface FieldWidgetConfig {
  widget: FieldType;
  placeholder?: string;
  helpText?: string;
  className?: string;

  // Select/Multi-select specific
  options?: Array<{ value: string | number; label: string }>;

  // File upload specific
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;

  // Relationship specific
  relationshipType?: EntityType;
  relationshipLabel?: string;
  relationshipTargetTable?: string; // Table ID for database relationships
  relationshipDisplayField?: string; // Field to display for linked records

  // Pubkey specific (social linking)
  pubkeySource?: 'group_members' | 'friends' | 'any'; // Where to search for users
  pubkeyDisplayFormat?: 'name' | 'name_with_avatar' | 'avatar_only'; // How to display

  // Layout
  gridColumn?: string; // CSS grid column value
  hidden?: boolean;
  disabled?: boolean;
}

/**
 * Field Visibility Rule
 * Used for conditional field visibility and dynamic required validation
 */
export type VisibilityOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'not-empty'
  | 'empty'
  | 'greater-than'
  | 'less-than'
  | 'in'
  | 'not-in';

export interface FieldVisibilityRule {
  field: string; // Field name to check
  operator: VisibilityOperator;
  value?: unknown; // Value to compare against (not needed for 'empty' / 'not-empty')
}

/**
 * Custom Field Definition
 * Combines JSON Schema with UI widget config
 */
export interface CustomField {
  id: string;
  groupId: string;
  entityType: EntityType;

  // Field metadata
  name: string; // Field key (e.g., "dietary_preferences")
  label: string; // Display label

  // JSON Schema definition
  schema: JSONSchemaField;

  // UI Widget configuration
  widget: FieldWidgetConfig;

  // Display order
  order: number;

  // Conditional visibility
  visibilityRules?: FieldVisibilityRule[]; // Show only if ALL rules pass (AND logic)
  requiredIf?: FieldVisibilityRule[]; // Required only if ALL rules pass (AND logic)

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Field Values by Key (for easy access in forms)
 * Stored directly in each entity's customFields property
 */
export type CustomFieldValues = Record<string, unknown>;

/**
 * Form Schema
 * Generated from custom fields for react-hook-form
 */
export interface FormSchema {
  fields: CustomField[];
  jsonSchema: Record<string, JSONSchemaField>;
  defaultValues: Record<string, unknown>;
}

/**
 * Zod Schemas for Validation
 */

export const JSONSchemaFieldSchema: z.ZodType<JSONSchemaField> = z.object({
  type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  format: z.enum(['email', 'uri', 'date', 'date-time', 'uuid']).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  multipleOf: z.number().optional(),
  items: z.lazy(() => JSONSchemaFieldSchema).optional(),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  uniqueItems: z.boolean().optional(),
  enum: z.array(z.union([z.string(), z.number()])).optional(),
  enumLabels: z.array(z.string()).optional(),
  required: z.boolean().optional(),
}) as z.ZodType<JSONSchemaField>;

export const FieldWidgetConfigSchema = z.object({
  widget: z.enum(['text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi-select', 'checkbox', 'radio', 'file', 'relationship', 'pubkey']),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  className: z.string().optional(),
  options: z.array(z.object({ value: z.union([z.string(), z.number()]), label: z.string() })).optional(),
  accept: z.string().optional(),
  maxSize: z.number().optional(),
  multiple: z.boolean().optional(),
  relationshipType: z.enum(['event', 'aid-request', 'aid-offer', 'contact', 'proposal', 'wiki-page', 'database-record']).optional(),
  relationshipLabel: z.string().optional(),
  relationshipTargetTable: z.string().optional(),
  relationshipDisplayField: z.string().optional(),
  pubkeySource: z.enum(['group_members', 'friends', 'any']).optional(),
  pubkeyDisplayFormat: z.enum(['name', 'name_with_avatar', 'avatar_only']).optional(),
  gridColumn: z.string().optional(),
  hidden: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

/**
 * Field Visibility Rule Schema
 */
export const FieldVisibilityRuleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not-equals',
    'contains',
    'not-contains',
    'not-empty',
    'empty',
    'greater-than',
    'less-than',
    'in',
    'not-in',
  ]),
  value: z.unknown().optional(),
});

export const CustomFieldSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string(),
  entityType: z.enum(['event', 'aid-request', 'aid-offer', 'contact', 'proposal', 'wiki-page', 'database-record']),
  name: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(100),
  schema: JSONSchemaFieldSchema,
  widget: FieldWidgetConfigSchema,
  order: z.number().int().min(0),
  visibilityRules: z.array(FieldVisibilityRuleSchema).optional(),
  requiredIf: z.array(FieldVisibilityRuleSchema).optional(),
  created: z.number(),
  createdBy: z.string(),
  updated: z.number(),
});

// Custom field values are stored directly in each entity's customFields property
// No separate schema needed

/**
 * Field Type Definitions for UI (Widget Metadata)
 */
export interface FieldTypeDefinition {
  widget: FieldType;
  label: string;
  description: string;
  icon: string;
  jsonSchemaType: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  supportsOptions: boolean;
}

export const FIELD_TYPE_DEFINITIONS: Record<FieldType, FieldTypeDefinition> = {
  text: {
    widget: 'text',
    label: 'Text',
    description: 'Short text input',
    icon: 'Type',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  textarea: {
    widget: 'textarea',
    label: 'Long Text',
    description: 'Multi-line text input',
    icon: 'AlignLeft',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  number: {
    widget: 'number',
    label: 'Number',
    description: 'Numeric input',
    icon: 'Hash',
    jsonSchemaType: 'number',
    supportsOptions: false,
  },
  date: {
    widget: 'date',
    label: 'Date',
    description: 'Date picker',
    icon: 'Calendar',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  datetime: {
    widget: 'datetime',
    label: 'Date & Time',
    description: 'Date and time picker',
    icon: 'Clock',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  select: {
    widget: 'select',
    label: 'Select',
    description: 'Single choice dropdown',
    icon: 'ListFilter',
    jsonSchemaType: 'string',
    supportsOptions: true,
  },
  'multi-select': {
    widget: 'multi-select',
    label: 'Multi-Select',
    description: 'Multiple choice select',
    icon: 'CheckSquare',
    jsonSchemaType: 'array',
    supportsOptions: true,
  },
  checkbox: {
    widget: 'checkbox',
    label: 'Checkbox',
    description: 'Yes/No checkbox',
    icon: 'Check',
    jsonSchemaType: 'boolean',
    supportsOptions: false,
  },
  radio: {
    widget: 'radio',
    label: 'Radio Buttons',
    description: 'Single choice radio group',
    icon: 'Circle',
    jsonSchemaType: 'string',
    supportsOptions: true,
  },
  file: {
    widget: 'file',
    label: 'File Upload',
    description: 'File attachment',
    icon: 'Paperclip',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  relationship: {
    widget: 'relationship',
    label: 'Relationship',
    description: 'Link to another entity',
    icon: 'Link',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
  pubkey: {
    widget: 'pubkey',
    label: 'User (Pubkey)',
    description: 'Link to a Nostr user profile',
    icon: 'User',
    jsonSchemaType: 'string',
    supportsOptions: false,
  },
};
