/**
 * Marketplace Module Manager
 * Business logic for publishing listings, searching, review aggregation, and expiration
 */

import { logger } from '@/lib/logger';
import type {
  Listing,
  CoopProfile,
  Review,
  SkillExchange,
  ResourceShare,
} from './types';

/** Nostr event kinds for marketplace */
export const MARKETPLACE_NOSTR_KINDS = {
  LISTING: 40131,
  COOP_PROFILE: 40132,
  REVIEW: 40133,
  SKILL_EXCHANGE: 40134,
  RESOURCE_SHARE: 40135,
} as const;

/**
 * Build Nostr tags for a marketplace entity
 */
function buildMarketplaceTags(entityId: string, entityType: string, groupId?: string): string[][] {
  const tags: string[][] = [
    ['d', entityId],
    ['module', 'marketplace'],
    ['type', entityType],
  ];
  if (groupId) {
    tags.push(['g', groupId]);
  }
  return tags;
}

/**
 * Create a Nostr-publishable event payload for a listing
 */
export function buildListingEventPayload(listing: Listing) {
  return {
    kind: MARKETPLACE_NOSTR_KINDS.LISTING,
    content: JSON.stringify({
      _v: '1.0.0',
      id: listing.id,
      type: listing.type,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: listing.currency,
      images: listing.images,
      location: listing.location,
      availability: listing.availability,
      tags: listing.tags,
      createdBy: listing.createdBy,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
      status: listing.status,
      coopId: listing.coopId,
      contactMethod: listing.contactMethod,
    }),
    tags: buildMarketplaceTags(listing.id, 'listing', listing.groupId),
  };
}

/**
 * Create a Nostr-publishable event payload for a co-op profile
 */
export function buildCoopProfileEventPayload(coop: CoopProfile) {
  return {
    kind: MARKETPLACE_NOSTR_KINDS.COOP_PROFILE,
    content: JSON.stringify({
      _v: '1.0.0',
      id: coop.id,
      name: coop.name,
      description: coop.description,
      memberCount: coop.memberCount,
      governanceModel: coop.governanceModel,
      industry: coop.industry,
      location: coop.location,
      website: coop.website,
      nostrPubkey: coop.nostrPubkey,
      verifiedBy: coop.verifiedBy,
      image: coop.image,
    }),
    tags: buildMarketplaceTags(coop.id, 'coop', coop.groupId),
  };
}

/**
 * Create a Nostr-publishable event payload for a review
 */
export function buildReviewEventPayload(review: Review) {
  return {
    kind: MARKETPLACE_NOSTR_KINDS.REVIEW,
    content: JSON.stringify({
      _v: '1.0.0',
      id: review.id,
      listingId: review.listingId,
      reviewerPubkey: review.reviewerPubkey,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt,
    }),
    tags: [
      ['e', review.listingId],
      ['module', 'marketplace'],
      ['type', 'review'],
    ],
  };
}

/**
 * Create a Nostr-publishable event payload for a skill exchange
 */
export function buildSkillExchangeEventPayload(exchange: SkillExchange) {
  return {
    kind: MARKETPLACE_NOSTR_KINDS.SKILL_EXCHANGE,
    content: JSON.stringify({
      _v: '1.0.0',
      id: exchange.id,
      offeredSkill: exchange.offeredSkill,
      requestedSkill: exchange.requestedSkill,
      availableHours: exchange.availableHours,
      hourlyTimebank: exchange.hourlyTimebank,
      location: exchange.location,
      createdBy: exchange.createdBy,
      createdAt: exchange.createdAt,
      status: exchange.status,
    }),
    tags: buildMarketplaceTags(exchange.id, 'skill-exchange', exchange.groupId),
  };
}

/**
 * Create a Nostr-publishable event payload for a resource share
 */
export function buildResourceShareEventPayload(resource: ResourceShare) {
  return {
    kind: MARKETPLACE_NOSTR_KINDS.RESOURCE_SHARE,
    content: JSON.stringify({
      _v: '1.0.0',
      id: resource.id,
      resourceType: resource.resourceType,
      name: resource.name,
      description: resource.description,
      availability: resource.availability,
      location: resource.location,
      depositRequired: resource.depositRequired,
      depositAmount: resource.depositAmount,
      depositCurrency: resource.depositCurrency,
      images: resource.images,
      createdBy: resource.createdBy,
      createdAt: resource.createdAt,
      status: resource.status,
    }),
    tags: buildMarketplaceTags(resource.id, 'resource-share', resource.groupId),
  };
}

/**
 * Compute aggregate review stats for a listing
 */
export function computeReviewStats(reviews: Review[]) {
  if (reviews.length === 0) {
    return { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const review of reviews) {
    sum += review.rating;
    const rating = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[rating]++;
  }

  return {
    average: sum / reviews.length,
    count: reviews.length,
    distribution,
  };
}

/**
 * Check if a listing has expired and should be marked accordingly
 */
export function isListingExpired(listing: Listing): boolean {
  if (!listing.expiresAt) return false;
  return listing.expiresAt < Date.now();
}

/**
 * Find skill exchange matches:
 * Where one user's offered skill matches another user's requested skill and vice versa
 */
export function findSkillMatches(
  exchange: SkillExchange,
  allExchanges: SkillExchange[]
): SkillExchange[] {
  return allExchanges.filter(
    (other) =>
      other.id !== exchange.id &&
      other.status === 'active' &&
      other.offeredSkill.toLowerCase().includes(exchange.requestedSkill.toLowerCase()) &&
      other.requestedSkill.toLowerCase().includes(exchange.offeredSkill.toLowerCase())
  );
}

/**
 * Format price for display
 */
export function formatListingPrice(price: number | undefined, currency = 'USD'): string {
  if (price === undefined || price === null || price === 0) {
    return 'Free / Negotiable';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price / 100);
  } catch {
    return `${(price / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Get day of week label
 */
export function getDayLabel(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] ?? '';
}

logger.debug('Marketplace manager loaded');
