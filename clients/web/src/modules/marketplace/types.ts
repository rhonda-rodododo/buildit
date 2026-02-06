/**
 * Marketplace Module Types
 * Cooperative marketplace, skill exchange, resource sharing, and co-op directory
 */

// ============================================================================
// Listing Types
// ============================================================================

export type ListingType = 'product' | 'service' | 'co-op' | 'initiative' | 'resource';
export type ListingStatus = 'active' | 'sold' | 'expired' | 'removed';
export type ContactMethod = 'dm' | 'public-reply';

/** Location value from custom-fields module */
export interface LocationValue {
  lat: number;
  lng: number;
  label: string;
  precision: 'exact' | 'neighborhood' | 'city' | 'region';
}

/**
 * Marketplace Listing
 */
export interface Listing {
  id: string;
  groupId: string;
  type: ListingType;
  title: string;
  description: string;
  price?: number; // in cents, null for free/negotiable
  currency?: string; // ISO 4217
  images: string[];
  location?: LocationValue;
  availability?: string;
  tags: string[];
  createdBy: string; // pubkey
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  status: ListingStatus;
  coopId?: string; // linked co-op profile
  contactMethod: ContactMethod;
}

// ============================================================================
// Co-op Profile Types
// ============================================================================

export type GovernanceModel = 'consensus' | 'democratic' | 'sociocracy' | 'holacracy' | 'hybrid' | 'other';

/**
 * Worker Co-op / Collective Profile
 */
export interface CoopProfile {
  id: string;
  groupId: string;
  name: string;
  description: string;
  memberCount: number;
  governanceModel: GovernanceModel;
  industry: string;
  location?: LocationValue;
  website?: string;
  nostrPubkey: string;
  verifiedBy: string[]; // pubkeys who vouched
  image?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Review Types
// ============================================================================

/**
 * Review for a listing or co-op
 */
export interface Review {
  id: string;
  listingId: string; // or coopId - the entity being reviewed
  reviewerPubkey: string;
  rating: number; // 1-5
  text: string;
  createdAt: number;
}

// ============================================================================
// Skill Exchange Types
// ============================================================================

export type SkillExchangeStatus = 'active' | 'matched' | 'completed' | 'cancelled';

/**
 * Skill Exchange / Timebank Offer
 */
export interface SkillExchange {
  id: string;
  groupId: string;
  offeredSkill: string;
  requestedSkill: string;
  availableHours: number;
  hourlyTimebank: number; // accumulated hours
  location?: LocationValue;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  status: SkillExchangeStatus;
}

// ============================================================================
// Resource Share Types
// ============================================================================

export type ResourceType = 'tool' | 'space' | 'vehicle';
export type ResourceStatus = 'available' | 'borrowed' | 'unavailable';

export interface AvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startHour: number;
  endHour: number;
}

/**
 * Shared Resource (tool, space, vehicle)
 */
export interface ResourceShare {
  id: string;
  groupId: string;
  resourceType: ResourceType;
  name: string;
  description: string;
  availability: AvailabilitySlot[];
  location?: LocationValue;
  depositRequired: boolean;
  depositAmount?: number;
  depositCurrency?: string;
  images: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  status: ResourceStatus;
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
  listings: Map<string, Listing>;
  coopProfiles: Map<string, CoopProfile>;
  reviews: Map<string, Review>;
  skillExchanges: Map<string, SkillExchange>;
  resourceShares: Map<string, ResourceShare>;

  // UI state
  activeTab: MarketplaceTab;
  filters: MarketplaceFilters;
  viewMode: 'grid' | 'list';

  // Loading state
  loading: boolean;
  error: string | null;
}
