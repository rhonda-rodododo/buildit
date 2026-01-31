/**
 * Database Search Provider
 * Provides search indexing and formatting for the Database (Airtable-like) module
 */

import type {
  ModuleSearchProvider,
  SearchDocument,
  SearchResult,
  FormattedSearchResult,
  FacetDefinition,
  ParsedQuery,
} from '../types';
import { dal } from '@/core/storage/dal';

// ============================================================================
// Types (Database module types)
// ============================================================================

interface DatabaseRecord {
  id: string;
  tableId: string;
  groupId: string;
  fields: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface DatabaseTable {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  schema: Array<{
    key: string;
    label: string;
    type: string;
    isPrimary?: boolean;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract searchable text from record fields
 */
function extractSearchableText(fields: Record<string, unknown>): string {
  const textParts: string[] = [];

  for (const [_key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      textParts.push(value);
    } else if (Array.isArray(value)) {
      textParts.push(value.filter((v) => typeof v === 'string').join(' '));
    } else if (typeof value === 'number') {
      textParts.push(String(value));
    }
  }

  return textParts.join(' ');
}

/**
 * Get primary field value for title
 */
function getPrimaryFieldValue(
  fields: Record<string, unknown>,
  schema: DatabaseTable['schema']
): string {
  const primaryField = schema.find((f) => f.isPrimary);
  if (primaryField && fields[primaryField.key]) {
    return String(fields[primaryField.key]);
  }
  // Fall back to first text field
  const firstTextField = schema.find((f) => f.type === 'text' || f.type === 'title');
  if (firstTextField && fields[firstTextField.key]) {
    return String(fields[firstTextField.key]);
  }
  return 'Untitled Record';
}

/**
 * Create an excerpt from record fields
 */
function createExcerpt(fields: Record<string, unknown>, maxLength: number = 150): string {
  const text = extractSearchableText(fields);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// Store table cache for lookup
const tableCache = new Map<string, DatabaseTable>();

// ============================================================================
// Database Search Provider
// ============================================================================

export const databaseSearchProvider: ModuleSearchProvider = {
  moduleType: 'database',

  /**
   * Index a database record for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const record = entity as DatabaseRecord;
    if (!record || !record.id) return null;

    // Get table info for proper title extraction
    const table = tableCache.get(record.tableId);
    const title = table
      ? getPrimaryFieldValue(record.fields, table.schema)
      : 'Database Record';

    const searchableContent = extractSearchableText(record.fields);

    // Extract tags from tags field if present
    const tagsField = record.fields.tags;
    const tags = Array.isArray(tagsField)
      ? tagsField.filter((t): t is string => typeof t === 'string')
      : [];

    return {
      id: `database:${record.id}`,
      moduleType: 'database',
      entityId: record.id,
      groupId,
      title,
      content: searchableContent,
      tags,
      excerpt: createExcerpt(record.fields, 150),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      authorPubkey: record.createdBy,
      facets: {
        tableId: record.tableId,
        tableName: table?.name || 'Unknown Table',
        fieldCount: Object.keys(record.fields).length,
        hasAttachments: Object.values(record.fields).some(
          (v) => typeof v === 'object' && v !== null && 'url' in v
        ),
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for database
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'tableId',
        label: 'Table',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'tableName',
        label: 'Table Name',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'hasAttachments',
        label: 'Has Attachments',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a database record search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const record = result.document;
    const tableName = record.facets?.tableName as string;

    const badges: FormattedSearchResult['badges'] = [];

    // Table name badge
    if (tableName && tableName !== 'Unknown Table') {
      badges.push({ label: tableName, variant: 'secondary' });
    }

    // Tags
    record.tags.slice(0, 2).forEach((tag) => {
      badges.push({ label: tag, variant: 'outline' });
    });

    return {
      title: record.title,
      subtitle: tableName || 'Database Record',
      icon: 'table',
      path: `/groups/${record.groupId}/database/${record.facets?.tableId}/${record.entityId}`,
      preview: result.highlightedExcerpt || record.excerpt,
      timestamp: record.updatedAt,
      badges: badges.slice(0, 3),
    };
  },

  /**
   * Enhance query with database-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const dbExpansions: Record<string, string[]> = {
      record: ['entry', 'row', 'item'],
      table: ['database', 'collection', 'sheet'],
      field: ['column', 'property', 'attribute'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = dbExpansions[keyword.toLowerCase()];
      if (expansion) {
        for (const term of expansion) {
          if (!enhancedTerms.includes(term)) {
            enhancedTerms.push(term);
          }
        }
      }
    }

    return {
      ...query,
      expandedTerms: enhancedTerms,
    };
  },

  /**
   * Get all database records for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    try {
      // First load tables for this group to populate cache
      const tables = await dal.query<DatabaseTable>('databaseTables', {
        whereClause: { groupId },
      });

      // Update table cache
      for (const table of tables) {
        tableCache.set(table.id, table);
      }

      // Get all records for tables in this group
      const tableIds = tables.map((t) => t.id);
      if (tableIds.length === 0) return [];

      const records = await dal.queryCustom<DatabaseRecord>({
        sql: `SELECT * FROM database_records WHERE table_id IN (${tableIds.map(() => '?').join(',')})`,
        params: tableIds,
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { table: (name: string) => { where: (key: string) => { anyOf: (ids: string[]) => { toArray: () => Promise<DatabaseRecord[]> } } } };
          return dexieDb.table('databaseRecords').where('tableId').anyOf(tableIds).toArray();
        },
      });

      return records;
    } catch (error) {
      console.error('Failed to fetch database records for indexing:', error);
      return [];
    }
  },
};

/**
 * Update the table cache (called when tables are created/updated)
 */
export function updateTableCache(table: DatabaseTable): void {
  tableCache.set(table.id, table);
}

/**
 * Clear the table cache
 */
export function clearTableCache(): void {
  tableCache.clear();
}

export default databaseSearchProvider;
