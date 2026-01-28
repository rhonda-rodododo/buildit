/**
 * Search Providers Index
 * Re-exports all module search providers
 *
 * Each module implements a SearchProvider that defines:
 * - How to index its entities into SearchDocuments
 * - What facets are available for filtering
 * - How to format results for display
 * - Query enhancements specific to the module's domain
 *
 * This pattern aligns with the protocol schema at:
 * protocol/schemas/modules/search/v1.json
 */

// Core module providers
export { documentsSearchProvider, default as documentsProvider } from './documentsProvider';
export { messagesSearchProvider, default as messagesProvider } from './messagesProvider';
export { eventsSearchProvider, default as eventsProvider } from './eventsProvider';
export { wikiSearchProvider, default as wikiProvider } from './wikiProvider';

// Additional module providers
export { governanceSearchProvider, default as governanceProvider } from './governanceProvider';
export { mutualAidSearchProvider, default as mutualAidProvider } from './mutualAidProvider';
export { crmSearchProvider, default as crmProvider } from './crmProvider';
export {
  databaseSearchProvider,
  default as databaseProvider,
  updateTableCache,
  clearTableCache,
} from './databaseProvider';

// Import all providers for bulk registration
import { documentsSearchProvider } from './documentsProvider';
import { messagesSearchProvider } from './messagesProvider';
import { eventsSearchProvider } from './eventsProvider';
import { wikiSearchProvider } from './wikiProvider';
import { governanceSearchProvider } from './governanceProvider';
import { mutualAidSearchProvider } from './mutualAidProvider';
import { crmSearchProvider } from './crmProvider';
import { databaseSearchProvider } from './databaseProvider';
import type { ModuleSearchProvider } from '../types';

/**
 * All available search providers
 * Modules self-register their providers for cross-module search
 */
export const allSearchProviders: ModuleSearchProvider[] = [
  // Core modules
  documentsSearchProvider,
  messagesSearchProvider,
  eventsSearchProvider,
  wikiSearchProvider,
  // Extended modules
  governanceSearchProvider,
  mutualAidSearchProvider,
  crmSearchProvider,
  databaseSearchProvider,
];

/**
 * Map of module type to provider for direct access
 */
export const providersByModule = new Map<string, ModuleSearchProvider>(
  allSearchProviders.map((p) => [p.moduleType, p])
);

/**
 * Register all search providers with the index sync manager
 */
export async function registerAllProviders(): Promise<void> {
  const { getIndexSyncManager } = await import('../services');
  const syncManager = getIndexSyncManager();

  for (const provider of allSearchProviders) {
    syncManager.registerProvider(provider);
  }
}

/**
 * Get a specific provider by module type
 */
export function getProviderForModule(moduleType: string): ModuleSearchProvider | undefined {
  return providersByModule.get(moduleType);
}
