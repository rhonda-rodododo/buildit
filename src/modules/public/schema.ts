/**
 * Public Module Database Schema
 * Contains all database table definitions for public pages and analytics
 */

import type { TableSchema } from '@/types/modules';
import type {
  PublicPage,
  Analytics,
  AnalyticsSummary,
} from './types';

// ============================================================================
// Database Table Types (exported for Dexie)
// ============================================================================

/** Public Pages table - SEO-optimized public pages for groups */
export type DBPublicPage = PublicPage;

/** Analytics table - Privacy-preserving analytics events */
export type DBAnalytics = Analytics;

/** Analytics Summaries table - Aggregated analytics for dashboards */
export type DBAnalyticsSummary = AnalyticsSummary;

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Public module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const publicSchema: TableSchema[] = [
  // Public Pages
  {
    name: 'publicPages',
    schema: 'id, groupId, slug, type, status, created, [status+indexability.isSearchIndexable]',
    indexes: ['id', 'groupId', 'slug', 'type', 'status', 'created', '[status+indexability.isSearchIndexable]'],
  },

  // Analytics
  {
    name: 'analytics',
    schema: 'id, groupId, resourceType, resourceId, event, timestamp',
    indexes: ['id', 'groupId', 'resourceType', 'resourceId', 'event', 'timestamp'],
  },
  {
    name: 'analyticsSummaries',
    schema: '[resourceType+resourceId+timeframe], resourceType, resourceId, timeframe, computedAt',
    indexes: ['[resourceType+resourceId+timeframe]', 'resourceType', 'resourceId', 'timeframe', 'computedAt'],
  },
];

// Export type-safe table names
export const PUBLIC_TABLES = {
  PUBLIC_PAGES: 'publicPages',
  ANALYTICS: 'analytics',
  ANALYTICS_SUMMARIES: 'analyticsSummaries',
} as const;
