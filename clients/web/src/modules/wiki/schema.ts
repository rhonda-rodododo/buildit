/**
 * Wiki Module Database Schema
 *
 * Re-exports generated types from protocol schemas.
 * All types are generated directly from protocol/schemas/modules/wiki/v1.json
 */

export {
  WIKI_TABLE_SCHEMAS,
  WIKI_TABLES,
  type DBWikiPage,
  type DBPageRevision as DBWikiPageRevision,
  type DBWikiCategory,
  type PagePermissions,
} from '@/generated/db/wiki.db';

// Re-export table schemas under legacy name
export { WIKI_TABLE_SCHEMAS as wikiSchema } from '@/generated/db/wiki.db';
