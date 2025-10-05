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
 * CRM module schema definition
 */
export const crmSchema: TableSchema[] = [
  {
    name: 'contacts',
    schema: 'id, groupId, name, email, created, updated',
    indexes: ['id', 'groupId', 'name', 'email', 'created', 'updated'],
  },
];

// Note: DBContact is already exported from @/core/storage/db
// No need to re-export it here
