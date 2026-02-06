/**
 * Social Publishing Module Database Schema
 *
 * Re-exports generated types from protocol schemas.
 * All types are generated from protocol/schemas/modules/social-publishing/v1.json
 */

export {
  SOCIAL_PUBLISHING_TABLE_SCHEMAS,
  SOCIAL_PUBLISHING_TABLES,
  type DBScheduledContent,
  type DBShareLink,
  type DBSocialAccount,
  type DBContentCalendarEntry,
  type DBOutreachAnalytics,
  type CrossPostConfig,
  type PlatformPost,
  type RecurrenceRule,
  type SEOOverrides,
} from '@/generated/db/social-publishing.db';

// Re-export table schemas under legacy name
export { SOCIAL_PUBLISHING_TABLE_SCHEMAS as socialPublishingSchema } from '@/generated/db/social-publishing.db';
