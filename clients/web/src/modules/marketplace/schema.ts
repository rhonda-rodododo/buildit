/**
 * Marketplace Module Database Schema
 * Contains all database table definitions for marketplace, co-ops, reviews, exchanges, and resources
 */

import type { TableSchema } from '@/types/modules';
import type {
  Listing,
  CoopProfile,
  Review,
  SkillExchange,
  ResourceShare,
} from './types';

// ============================================================================
// Database Table Types (exported for Dexie)
// ============================================================================

export type DBListing = Listing;
export type DBCoopProfile = CoopProfile;
export type DBReview = Review;
export type DBSkillExchange = SkillExchange;
export type DBResourceShare = ResourceShare;

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Marketplace module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const marketplaceSchema: TableSchema[] = [
  {
    name: 'marketplaceListings',
    schema: 'id, groupId, type, status, createdBy, createdAt, expiresAt, coopId',
    indexes: ['id', 'groupId', 'type', 'status', 'createdBy', 'createdAt', 'expiresAt', 'coopId'],
  },
  {
    name: 'coopProfiles',
    schema: 'id, groupId, nostrPubkey, industry, governanceModel, createdAt',
    indexes: ['id', 'groupId', 'nostrPubkey', 'industry', 'governanceModel', 'createdAt'],
  },
  {
    name: 'marketplaceReviews',
    schema: 'id, listingId, reviewerPubkey, rating, createdAt',
    indexes: ['id', 'listingId', 'reviewerPubkey', 'rating', 'createdAt'],
  },
  {
    name: 'skillExchanges',
    schema: 'id, groupId, status, createdBy, createdAt',
    indexes: ['id', 'groupId', 'status', 'createdBy', 'createdAt'],
  },
  {
    name: 'resourceShares',
    schema: 'id, groupId, resourceType, status, createdBy, createdAt',
    indexes: ['id', 'groupId', 'resourceType', 'status', 'createdBy', 'createdAt'],
  },
];

// Export type-safe table names
export const MARKETPLACE_TABLES = {
  LISTINGS: 'marketplaceListings',
  COOP_PROFILES: 'coopProfiles',
  REVIEWS: 'marketplaceReviews',
  SKILL_EXCHANGES: 'skillExchanges',
  RESOURCE_SHARES: 'resourceShares',
} as const;
