/**
 * Fundraising Module Database Schema
 * Contains all database table definitions for fundraising campaigns and donations
 */

import type { TableSchema } from '@/types/modules';
import type {
  Campaign,
  CampaignUpdate,
  Donation,
  DonationTier,
} from './types';

// ============================================================================
// Database Table Interfaces (exported for Dexie)
// ============================================================================

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

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Fundraising module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const fundraisingSchema: TableSchema[] = [
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
];

// Export type-safe table names
export const FUNDRAISING_TABLES = {
  CAMPAIGNS: 'campaigns',
  CAMPAIGN_UPDATES: 'campaignUpdates',
  DONATIONS: 'donations',
  DONATION_TIERS: 'donationTiers',
} as const;
