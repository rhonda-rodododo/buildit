/**
 * Marketplace Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (filters, store state) are defined here.
 */

// Re-export all generated Zod schemas and types
export {
  ListingSchema,
  type Listing,
  CoopProfileSchema,
  type CoopProfile,
  ReviewSchema,
  type Review,
  SkillExchangeSchema,
  type SkillExchange,
  ResourceShareSchema,
  type ResourceShare,
  MARKETPLACE_SCHEMA_VERSION,
} from '@/generated/validation/marketplace.zod';

// ── UI-Only Types ────────────────────────────────────────────────

/** Location value from custom-fields module */
export interface LocationValue {
  lat: number;
  lng: number;
  label: string;
  precision: 'exact' | 'neighborhood' | 'city' | 'region';
}

export type ListingType = 'product' | 'service' | 'co-op' | 'initiative' | 'resource';
export type ListingStatus = 'active' | 'sold' | 'expired' | 'removed';
export type ContactMethod = 'dm' | 'public-reply';
export type GovernanceModel = 'consensus' | 'democratic' | 'sociocracy' | 'holacracy' | 'hybrid' | 'other';
export type SkillExchangeStatus = 'active' | 'matched' | 'completed' | 'cancelled';
export type ResourceType = 'tool' | 'space' | 'vehicle';
export type ResourceStatus = 'available' | 'borrowed' | 'unavailable';

export interface AvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startHour: number;
  endHour: number;
}

// ============================================================================
// Store State Types
// ============================================================================

export type ListingSortBy = 'newest' | 'price-low' | 'price-high' | 'nearest';
export type MarketplaceTab = 'listings' | 'coops' | 'skills' | 'resources';

export interface MarketplaceFilters {
  search: string;
  listingType?: ListingType;
  priceMin?: number;
  priceMax?: number;
  tags: string[];
  status: ListingStatus;
  sortBy: ListingSortBy;
}

export interface MarketplaceState {
  // Data
  listings: Map<string, import('@/generated/validation/marketplace.zod').Listing>;
  coopProfiles: Map<string, import('@/generated/validation/marketplace.zod').CoopProfile>;
  reviews: Map<string, import('@/generated/validation/marketplace.zod').Review>;
  skillExchanges: Map<string, import('@/generated/validation/marketplace.zod').SkillExchange>;
  resourceShares: Map<string, import('@/generated/validation/marketplace.zod').ResourceShare>;

  // UI state
  activeTab: MarketplaceTab;
  filters: MarketplaceFilters;
  viewMode: 'grid' | 'list';

  // Loading state
  loading: boolean;
  error: string | null;
}
