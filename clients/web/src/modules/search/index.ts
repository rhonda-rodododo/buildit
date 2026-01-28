/**
 * Search Module
 * E2EE-respecting client-side search with semantic capabilities
 *
 * This module provides:
 * - Full-text search using MiniSearch
 * - Semantic search using TF-IDF
 * - Faceted filtering
 * - User-defined tags with hierarchy
 * - Cross-group search with scope control
 * - Search history and saved searches
 */

import type { ModulePlugin } from '@/types/modules';
import { searchSchema } from './schema';
import { Search } from 'lucide-react';
import { logger } from '@/lib/logger';
import { registerModuleSchema } from '@/core/storage/db';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import searchTranslations from './i18n';

// Re-export types
export * from './types';

// Re-export services (explicitly to avoid conflict with component TagManager)
export {
  parseQuery,
  formatParsedQuery,
  isEmptyQuery,
  getConceptExpansions,
  addConceptExpansion,
  MiniSearchEngine,
  getMiniSearchEngine,
  resetMiniSearchEngine,
  TFIDFEngine,
  getTFIDFEngine,
  resetTFIDFEngine,
  FacetEngine,
  getFacetEngine,
  resetFacetEngine,
  TagManager as TagManagerService,
  getTagManager,
  resetTagManager,
  IndexSyncManager,
  getIndexSyncManager,
  resetIndexSyncManager,
  SearchCoordinator,
  getSearchCoordinator,
  resetSearchCoordinator,
} from './services';

// Re-export components
export {
  SearchDialog,
  SearchDialogDefault,
  SearchInput,
  SearchInputDefault,
  SearchResults,
  SearchResultsDefault,
  FacetPanel,
  FacetPanelDefault,
  TagManager as TagManagerComponent,
  TagManagerDefault,
} from './components';

// Re-export hooks
export * from './hooks';

// Re-export store
export { useSearchStore } from './searchStore';

/**
 * Register search module schema
 * Must be called before database initialization
 */
export function registerSearchSchema(): void {
  registerModuleSchema('search', searchSchema);
  logger.info('🔍 Search module schema registered');
}

/**
 * Search Module Plugin
 * Note: Search is a utility module that enhances all other modules
 * rather than providing its own group-level functionality
 */
export const searchModule: ModulePlugin = {
  metadata: {
    id: 'search',
    type: 'database', // Using database type as closest match for utility module
    name: 'Search',
    description: 'Powerful search across all content with semantic understanding and filtering',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Search,
    capabilities: [
      {
        id: 'full-text-search',
        name: 'Full-Text Search',
        description: 'Search across all content with typo tolerance and highlighting',
      },
      {
        id: 'semantic-search',
        name: 'Semantic Search',
        description: 'AI-powered search that understands meaning and synonyms',
      },
      {
        id: 'faceted-filtering',
        name: 'Faceted Filtering',
        description: 'Filter results by content type, tags, dates, and more',
      },
      {
        id: 'tagging',
        name: 'Tagging System',
        description: 'Organize content with custom hierarchical tags',
      },
      {
        id: 'cross-group-search',
        name: 'Cross-Group Search',
        description: 'Search across all accessible groups at once',
      },
      {
        id: 'saved-searches',
        name: 'Saved Searches',
        description: 'Save and reuse frequently used searches',
      },
    ],
    configSchema: [
      {
        key: 'enableSemanticSearch',
        label: 'Enable Semantic Search',
        type: 'boolean',
        defaultValue: true,
        description: 'Use AI-powered semantic matching for better results',
      },
      {
        key: 'defaultScope',
        label: 'Default Search Scope',
        type: 'select',
        defaultValue: 'current-group',
        options: [
          { label: 'Current Group', value: 'current-group' },
          { label: 'All Groups', value: 'global' },
        ],
        description: 'Default scope when opening search',
      },
      {
        key: 'maxRecentSearches',
        label: 'Recent Search History',
        type: 'number',
        defaultValue: 20,
        description: 'Number of recent searches to remember',
      },
    ],
    requiredPermission: 'all', // Search is available to everyone
    providesCapabilities: ['search', 'tagging'],
  },

  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('search', searchTranslations);
      logger.info('🔍 Search module registered');
    },
    onEnable: async (groupId: string) => {
      logger.info(`🔍 Search module enabled for group ${groupId}`);
      // Trigger indexing of existing content for this group
      const { getIndexSyncManager } = await import('./services');
      const syncManager = getIndexSyncManager();
      // Note: Full indexing happens in background, not blocking
      syncManager.fullReindex([groupId]).catch((error) => {
        logger.error(`Failed to index group ${groupId}:`, error);
      });
    },
    onDisable: async (groupId: string) => {
      logger.info(`🔍 Search module disabled for group ${groupId}`);
      // Note: We don't delete indexed content - it will be naturally cleaned up
      // or re-indexed when the module is re-enabled
    },
  },

  // Search doesn't have its own dedicated page - it's accessed via Cmd+K
  // or through the search component embedded in other pages
  routes: [],

  schema: searchSchema,

  migrations: [
    {
      version: 1,
      description: 'Initialize search module tables',
      migrate: async () => {
        logger.info('🔍 Running search module migration v1');
        // Initial migration - tables are created by schema definition
      },
    },
  ],

  seeds: [],

  getDefaultConfig: () => ({
    enableSemanticSearch: true,
    defaultScope: 'current-group',
    maxRecentSearches: 20,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enableSemanticSearch !== 'boolean') return false;
    if (!['current-group', 'global'].includes(config.defaultScope as string)) return false;
    if (typeof config.maxRecentSearches !== 'number') return false;
    if (config.maxRecentSearches < 0 || config.maxRecentSearches > 100) return false;
    return true;
  },
};

export default searchModule;
