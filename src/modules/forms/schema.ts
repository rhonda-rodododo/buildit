/**
 * Forms Module Database Schema
 * Contains all database table definitions for the forms module
 */

import type { TableSchema } from '@/types/modules';
import type {
  Form,
  FormSubmission,
  Campaign,
  CampaignUpdate,
  Donation,
  DonationTier,
  PublicPage,
  Analytics,
  AnalyticsSummary,
} from './types';

// ============================================================================
// Database Table Interfaces (exported for Dexie)
// ============================================================================

/**
 * Forms table
 * Public-facing interfaces for database tables
 */
export interface DBForm extends Form {}

/**
 * Form Submissions table
 * Metadata about form submissions (actual data goes to database records)
 */
export interface DBFormSubmission extends FormSubmission {}

/**
 * Campaigns table
 * Fundraising campaigns
 */
export interface DBCampaign extends Campaign {}

/**
 * Campaign Updates table
 * Updates posted to campaigns
 */
export interface DBCampaignUpdate extends CampaignUpdate {}

/**
 * Donations table
 * Individual donation records
 */
export interface DBDonation extends Donation {}

/**
 * Donation Tiers table
 * Tiered donation levels for campaigns
 */
export interface DBDonationTier extends DonationTier {}

/**
 * Public Pages table
 * SEO-optimized public pages for groups
 */
export interface DBPublicPage extends PublicPage {}

/**
 * Analytics table
 * Privacy-preserving analytics events
 */
export interface DBAnalytics extends Analytics {}

/**
 * Analytics Summaries table
 * Aggregated analytics for dashboards
 */
export interface DBAnalyticsSummary extends AnalyticsSummary {}

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Forms module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const formsSchema: TableSchema[] = [
  // Forms
  {
    name: 'forms',
    schema: 'id, groupId, tableId, status, created',
    indexes: ['id', 'groupId', 'tableId', 'status', 'created'],
  },
  {
    name: 'formSubmissions',
    schema: 'id, formId, tableId, groupId, recordId, submittedAt, flaggedAsSpam',
    indexes: ['id', 'formId', 'tableId', 'groupId', 'recordId', 'submittedAt', 'flaggedAsSpam'],
  },

  // Campaigns
  {
    name: 'campaigns',
    schema: 'id, groupId, tableId, slug, category, status, created, endsAt',
    indexes: ['id', 'groupId', 'tableId', 'slug', 'category', 'status', 'created', 'endsAt'],
  },
  {
    name: 'campaignUpdates',
    schema: 'id, campaignId, groupId, created',
    indexes: ['id', 'campaignId', 'groupId', 'created'],
  },
  {
    name: 'donations',
    schema: 'id, campaignId, groupId, tierId, donorRecordId, status, created, isRecurring',
    indexes: ['id', 'campaignId', 'groupId', 'tierId', 'donorRecordId', 'status', 'created', 'isRecurring'],
  },
  {
    name: 'donationTiers',
    schema: 'id, campaignId, order',
    indexes: ['id', 'campaignId', 'order'],
  },

  // Public Pages
  {
    name: 'publicPages',
    schema: 'id, groupId, slug, type, status, created',
    indexes: ['id', 'groupId', 'slug', 'type', 'status', 'created'],
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
export const FORMS_TABLES = {
  FORMS: 'forms',
  FORM_SUBMISSIONS: 'formSubmissions',
  CAMPAIGNS: 'campaigns',
  CAMPAIGN_UPDATES: 'campaignUpdates',
  DONATIONS: 'donations',
  DONATION_TIERS: 'donationTiers',
  PUBLIC_PAGES: 'publicPages',
  ANALYTICS: 'analytics',
  ANALYTICS_SUMMARIES: 'analyticsSummaries',
} as const;
