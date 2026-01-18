/**
 * Advanced Social Features Module
 * Polls, Stories, Moderation, Lists, Trending, Suggested Follows, Notifications
 */

import { registerModuleSchema } from '@/core/storage/db';
import { socialSchema } from './schema';

// Register the schema
registerModuleSchema('social', socialSchema);

// Export types
export * from './types';

// Export store
export { useSocialStore } from './socialStore';

// Export schema
export { socialSchema, socialMigrations, socialSeeds } from './schema';

// Export components (will be added)
export * from './components';
