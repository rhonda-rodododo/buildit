/**
 * Wiki Module Database Schema
 *
 * Re-exports generated types from protocol schemas.
 * DB-only field overrides (e.g., IndexabilitySettings) are applied here.
 */

import type { IndexabilitySettings } from '@/types/indexability';
import {
  WIKI_TABLE_SCHEMAS,
  WIKI_TABLES,
  type DBWikiPage as GeneratedDBWikiPage,
  type DBPageRevision,
  type DBWikiCategory,
  type PagePermissions,
} from '@/generated/db/wiki.db';

/**
 * DBWikiPage with typed indexability (generated uses Record<string, unknown>)
 */
export interface DBWikiPage extends Omit<GeneratedDBWikiPage, 'indexability'> {
  indexability: IndexabilitySettings;
}

// Re-export generated types
export type { DBPageRevision as DBWikiPageRevision, DBWikiCategory, PagePermissions };

// Re-export table schemas and constants
export { WIKI_TABLE_SCHEMAS, WIKI_TABLES };

/** @deprecated Use WIKI_TABLE_SCHEMAS instead */
export const wikiSchema = WIKI_TABLE_SCHEMAS;
