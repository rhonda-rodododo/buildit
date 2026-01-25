/**
 * Custom Fields Module Database Schema
 * Foundational module providing dynamic field capabilities to other modules
 */

import type { TableSchema } from '@/types/modules';

/**
 * Custom Field Definition table
 * Stores field definitions that can be attached to various entities
 * Uses JSON Schema for validation + widget config for UI
 */
export interface DBCustomField {
  id: string; // uuid (primary key)
  groupId: string; // which group this field belongs to
  entityType: string; // 'event', 'aid-request', 'contact', etc.
  name: string; // field key for storage (e.g., "dietary_preferences")
  label: string; // display label (e.g., "Dietary Preferences")
  schema: string; // JSON string - JSONSchemaField
  widget: string; // JSON string - FieldWidgetConfig
  order: number; // display order
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Custom Fields module schema definition
 *
 * Note: Custom field VALUES are stored in each module's own tables
 * (e.g., events.customFields, mutualAidRequests.customFields)
 * This table only stores field DEFINITIONS
 */
export const customFieldsSchema: TableSchema[] = [
  {
    name: 'customFields',
    schema: 'id, groupId, entityType, name, label, created, createdBy',
    indexes: ['id', 'groupId', 'entityType', 'name', 'label', 'created', 'createdBy'],
  },
];

// Note: DBCustomField will be added to core db.ts
