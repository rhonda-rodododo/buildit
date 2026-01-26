/**
 * Wiki Module Database Schema
 * Contains all database table definitions for the wiki module
 */

import type { TableSchema } from '@/types/modules';
import type { IndexabilitySettings } from '@/types/indexability';
import type { PageStatus, PageVisibility, PagePermissions } from './types';

/**
 * Wiki Page table interface (matches protocol WikiPage)
 */
export interface DBWikiPage {
  // Schema version
  _v: string;

  // Core fields
  id: string; // uuid (primary key)
  groupId: string;
  title: string;
  slug: string; // URL-friendly identifier
  content: string; // markdown

  // Organization
  categoryId?: string; // Protocol uses categoryId
  tags: string[]; // Stored as array in IndexedDB
  parentId?: string;

  // Status and visibility (protocol fields)
  status: PageStatus;
  visibility: PageVisibility;
  permissions?: PagePermissions;

  // Versioning
  version: number;

  // Timestamps (protocol uses 'At' suffix)
  createdAt: number;
  createdBy: string; // pubkey
  updatedAt: number;
  lastEditedBy?: string; // pubkey of last editor

  // Optional protocol fields
  summary?: string;
  aliases?: string[];
  contributors?: string[];
  archivedAt?: number;
  deletedAt?: number;
  publishedAt?: number;
  lockedBy?: string;
  lockedAt?: number;
  metadata?: Record<string, unknown>;

  // Custom extension: indexability for search engines
  indexability: IndexabilitySettings;
}

/**
 * Wiki Page Revision table interface (matches protocol PageRevision)
 */
export interface DBWikiPageRevision {
  _v: string;
  id: string;
  pageId: string;
  version: number;
  title?: string;
  content: string;
  diff?: string;
  summary?: string;
  editedBy: string;
  createdAt: number;
  editType?: 'create' | 'edit' | 'revert' | 'merge' | 'move';
  revertedFrom?: number;
}

/**
 * Wiki Category table interface (matches protocol WikiCategory)
 */
export interface DBWikiCategory {
  _v: string;
  id: string;
  groupId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  parentId?: string;
  pageCount: number;
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
}

/**
 * Wiki module schema definition
 */
export const wikiSchema: TableSchema[] = [
  {
    name: 'wikiPages',
    schema: 'id, groupId, slug, title, categoryId, status, visibility, updatedAt, createdBy, lastEditedBy',
    indexes: ['id', 'groupId', 'slug', 'title', 'categoryId', 'status', 'visibility', 'updatedAt', 'createdBy', 'lastEditedBy'],
  },
  {
    name: 'wikiPageRevisions',
    schema: 'id, pageId, version, editedBy, createdAt',
    indexes: ['id', 'pageId', 'version', 'editedBy', 'createdAt'],
  },
  {
    name: 'wikiCategories',
    schema: 'id, groupId, slug, name, parentId, order',
    indexes: ['id', 'groupId', 'slug', 'name', 'parentId', 'order'],
  },
];
