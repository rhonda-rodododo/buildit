/**
 * Advanced Social Features Module
 * Polls, Stories, Moderation, Lists, Trending, Suggested Follows, Notifications
 */

import { registerModuleSchema } from '@/core/storage/db';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import { socialSchema } from './schema';
import socialTranslations from './i18n';

// Register the schema
registerModuleSchema('social', socialSchema);

// Register translations
registerModuleTranslations('social', socialTranslations);

// Export types
export * from './types';

// Export store
export { useSocialStore } from './socialStore';

// Export schema
export { socialSchema, socialMigrations, socialSeeds } from './schema';

// Export components (will be added)
export * from './components';
