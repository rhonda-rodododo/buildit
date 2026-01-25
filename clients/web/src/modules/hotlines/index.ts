/**
 * Hotlines Module
 * Provides jail support hotlines, dispatch coordination, and call logging
 *
 * Features:
 * - Multiple hotline types (jail support, legal intake, dispatch, crisis)
 * - Call logging and tracking
 * - Operator shift management
 * - Volunteer dispatch system
 * - CRM integration for linking calls to records
 */

import { registerModuleSchema } from '@/core/storage/db';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import { hotlinesSchema } from './schema';
import hotlinesTranslations from './i18n';

// Register module schema
registerModuleSchema('hotlines', hotlinesSchema);

// Register module translations
registerModuleTranslations('hotlines', hotlinesTranslations);

// Re-export types
export * from './types';
export * from './schema';

// Re-export store and manager
export { useHotlinesStore } from './hotlinesStore';
export { HotlinesManager } from './hotlinesManager';
