/**
 * CRM Module Database Schema
 * Contains all database table definitions for the CRM module
 */

import type { TableSchema } from '@/types/modules';

/**
 * Contact table interface
 */
export interface DBContact {
  id: string; // uuid (primary key)
  groupId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  customFields: Record<string, unknown>;
  tags: string[];
  created: number;
  updated: number;
}

/**
 * Custom CRM Template (user-created)
 * Stores user-customized templates that can be shared within a group
 */
export interface DBCustomTemplate {
  id: string; // uuid (primary key)
  groupId: string; // Scoped to group (or null for org-wide)
  name: string;
  description: string;
  icon: string;
  category: string; // CRMTemplateCategory
  templateData: string; // JSON serialized CRMMultiTableTemplate
  createdBy: string; // pubkey
  created: number;
  updated: number;
  isPublic: boolean; // Share with all groups (org-wide)
  sourceTemplateId?: string; // Original template this was cloned from
  version: string; // Semantic version (e.g., "1.0.0")
}

/**
 * Applied Template Instance
 * Tracks which templates have been applied to which groups
 */
export interface DBAppliedTemplate {
  id: string; // uuid (primary key)
  groupId: string;
  templateId: string; // Built-in or custom template ID
  isCustom: boolean; // True if from customTemplates table
  appliedAt: number;
  appliedBy: string; // pubkey
  // Maps template table keys to actual database table IDs
  tableMapping: string; // JSON: Record<string, string>
}

/**
 * CRM module schema definition
 */
export const crmSchema: TableSchema[] = [
  {
    name: 'contacts',
    schema: 'id, groupId, name, email, created, updated',
    indexes: ['id', 'groupId', 'name', 'email', 'created', 'updated'],
  },
  {
    name: 'crmCustomTemplates',
    schema: 'id, groupId, name, category, createdBy, created, updated, isPublic, sourceTemplateId',
    indexes: ['id', 'groupId', 'name', 'category', 'createdBy', 'created', 'isPublic'],
  },
  {
    name: 'crmAppliedTemplates',
    schema: 'id, groupId, templateId, isCustom, appliedAt, appliedBy',
    indexes: ['id', 'groupId', 'templateId', 'appliedAt'],
  },
];

// Note: DBContact is already exported from @/core/storage/db
// No need to re-export it here
