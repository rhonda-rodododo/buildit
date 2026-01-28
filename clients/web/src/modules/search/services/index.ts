/**
 * Search Services Index
 * Re-exports all search services for convenient imports
 */

// Query Parser
export { parseQuery, formatParsedQuery, isEmptyQuery, getConceptExpansions, addConceptExpansion } from './queryParser';

// MiniSearch Engine
export { MiniSearchEngine, getMiniSearchEngine, resetMiniSearchEngine } from './miniSearchEngine';

// TF-IDF Engine
export { TFIDFEngine, getTFIDFEngine, resetTFIDFEngine } from './tfidfEngine';

// Facet Engine
export { FacetEngine, getFacetEngine, resetFacetEngine } from './facetEngine';

// Tag Manager
export { TagManager, getTagManager, resetTagManager } from './tagManager';

// Index Sync Manager
export { IndexSyncManager, getIndexSyncManager, resetIndexSyncManager } from './indexSyncManager';

// Search Coordinator
export { SearchCoordinator, getSearchCoordinator, resetSearchCoordinator } from './searchCoordinator';
