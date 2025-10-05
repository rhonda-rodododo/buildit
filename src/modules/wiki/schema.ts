/**
 * Wiki Module Database Schema
 * Contains all database table definitions for the wiki module
 */

import type { TableSchema } from '@/types/modules';

/**
 * Wiki Page table interface
 */
export interface DBWikiPage {
  id: string; // uuid (primary key)
  groupId: string;
  title: string;
  content: string; // markdown
  category?: string;
  tags: string[];
  version: number;
  created: number;
  updated: number;
  updatedBy: string;
}

/**
 * Wiki module schema definition
 */
export const wikiSchema: TableSchema[] = [
  {
    name: 'wikiPages',
    schema: 'id, groupId, title, category, updated, updatedBy',
    indexes: ['id', 'groupId', 'title', 'category', 'updated', 'updatedBy'],
  },
];

// Note: DBWikiPage is already exported from @/core/storage/db
// No need to re-export it here
