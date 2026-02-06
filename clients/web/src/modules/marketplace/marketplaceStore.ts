/**
 * Marketplace Module Store
 * Zustand store for listings, co-ops, reviews, skill exchanges, and resource shares
 */

import { create } from 'zustand';
import type {
  Listing,
  CoopProfile,
  Review,
  SkillExchange,
  ResourceShare,
  MarketplaceState,
  MarketplaceFilters,
  MarketplaceTab,
} from './types';

interface MarketplaceStoreState extends MarketplaceState {
  // ============================================================================
  // Listing Actions
  // ============================================================================

  addListing: (listing: Listing) => void;
  updateListing: (listingId: string, updates: Partial<Listing>) => void;
  deleteListing: (listingId: string) => void;
  getListing: (listingId: string) => Listing | undefined;
  getListingsByGroup: (groupId: string) => Listing[];
  getActiveListings: (groupId: string) => Listing[];
  getListingsByCoop: (coopId: string) => Listing[];
  getFilteredListings: (groupId: string) => Listing[];

  // ============================================================================
  // Co-op Profile Actions
  // ============================================================================

  addCoopProfile: (coop: CoopProfile) => void;
  updateCoopProfile: (coopId: string, updates: Partial<CoopProfile>) => void;
  deleteCoopProfile: (coopId: string) => void;
  getCoopProfile: (coopId: string) => CoopProfile | undefined;
  getCoopsByGroup: (groupId: string) => CoopProfile[];
  vouchForCoop: (coopId: string, voucherPubkey: string) => void;

  // ============================================================================
  // Review Actions
  // ============================================================================

  addReview: (review: Review) => void;
  deleteReview: (reviewId: string) => void;
  getReviewsForListing: (listingId: string) => Review[];
  getAverageRating: (listingId: string) => number;

  // ============================================================================
  // Skill Exchange Actions
  // ============================================================================

  addSkillExchange: (exchange: SkillExchange) => void;
  updateSkillExchange: (exchangeId: string, updates: Partial<SkillExchange>) => void;
  deleteSkillExchange: (exchangeId: string) => void;
  getSkillExchangesByGroup: (groupId: string) => SkillExchange[];
  getActiveSkillExchanges: (groupId: string) => SkillExchange[];

  // ============================================================================
  // Resource Share Actions
  // ============================================================================

  addResourceShare: (resource: ResourceShare) => void;
  updateResourceShare: (resourceId: string, updates: Partial<ResourceShare>) => void;
  deleteResourceShare: (resourceId: string) => void;
  getResourceSharesByGroup: (groupId: string) => ResourceShare[];
  getAvailableResources: (groupId: string) => ResourceShare[];

  // ============================================================================
  // UI State Actions
  // ============================================================================

  setActiveTab: (tab: MarketplaceTab) => void;
  setFilters: (filters: Partial<MarketplaceFilters>) => void;
  resetFilters: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;

  // ============================================================================
  // Utility Actions
  // ============================================================================

  clearAll: () => void;
  loadData: (data: Partial<MarketplaceState>) => void;
}

const defaultFilters: MarketplaceFilters = {
  search: '',
  listingType: undefined,
  priceMin: undefined,
  priceMax: undefined,
  tags: [],
  status: 'active',
  sortBy: 'newest',
};

export const useMarketplaceStore = create<MarketplaceStoreState>()(
  (set, get) => ({
    // Initial state
    listings: new Map(),
    coopProfiles: new Map(),
    reviews: new Map(),
    skillExchanges: new Map(),
    resourceShares: new Map(),
    activeTab: 'listings',
    filters: { ...defaultFilters },
    viewMode: 'grid',
    loading: false,
    error: null,

    // ========================================================================
    // Listing Actions
    // ========================================================================

    addListing: (listing) => set((state) => {
      const newListings = new Map(state.listings);
      newListings.set(listing.id, listing);
      return { listings: newListings };
    }),

    updateListing: (listingId, updates) => set((state) => {
      const newListings = new Map(state.listings);
      const existing = newListings.get(listingId);
      if (existing) {
        newListings.set(listingId, { ...existing, ...updates, updatedAt: Date.now() });
      }
      return { listings: newListings };
    }),

    deleteListing: (listingId) => set((state) => {
      const newListings = new Map(state.listings);
      newListings.delete(listingId);

      // Delete related reviews
      const newReviews = new Map(state.reviews);
      Array.from(newReviews.values())
        .filter((r) => r.listingId === listingId)
        .forEach((r) => newReviews.delete(r.id));

      return { listings: newListings, reviews: newReviews };
    }),

    getListing: (listingId) => get().listings.get(listingId),

    getListingsByGroup: (groupId) => {
      return Array.from(get().listings.values())
        .filter((l) => l.groupId === groupId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getActiveListings: (groupId) => {
      const now = Date.now();
      return Array.from(get().listings.values())
        .filter(
          (l) =>
            l.groupId === groupId &&
            l.status === 'active' &&
            (!l.expiresAt || l.expiresAt > now)
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getListingsByCoop: (coopId) => {
      return Array.from(get().listings.values())
        .filter((l) => l.coopId === coopId && l.status === 'active')
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getFilteredListings: (groupId) => {
      const { filters } = get();
      const now = Date.now();
      let results = Array.from(get().listings.values()).filter(
        (l) =>
          l.groupId === groupId &&
          l.status === filters.status &&
          (!l.expiresAt || l.expiresAt > now)
      );

      // Filter by type
      if (filters.listingType) {
        results = results.filter((l) => l.type === filters.listingType);
      }

      // Filter by search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        results = results.filter(
          (l) =>
            l.title.toLowerCase().includes(query) ||
            (l.description?.toLowerCase().includes(query) ?? false) ||
            (l.tags?.some((t) => t.toLowerCase().includes(query)) ?? false)
        );
      }

      // Filter by price range
      if (filters.priceMin !== undefined) {
        results = results.filter((l) => (l.price ?? 0) >= (filters.priceMin ?? 0));
      }
      if (filters.priceMax !== undefined) {
        results = results.filter((l) => (l.price ?? 0) <= (filters.priceMax ?? Infinity));
      }

      // Filter by tags
      if (filters.tags.length > 0) {
        results = results.filter((l) =>
          filters.tags.some((tag) => (l.tags ?? []).includes(tag))
        );
      }

      // Sort
      switch (filters.sortBy) {
        case 'newest':
          results.sort((a, b) => b.createdAt - a.createdAt);
          break;
        case 'price-low':
          results.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
          break;
        case 'price-high':
          results.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
          break;
        case 'nearest':
          // Location-based sorting would require user location - fall back to newest
          results.sort((a, b) => b.createdAt - a.createdAt);
          break;
      }

      return results;
    },

    // ========================================================================
    // Co-op Profile Actions
    // ========================================================================

    addCoopProfile: (coop) => set((state) => {
      const newCoops = new Map(state.coopProfiles);
      newCoops.set(coop.id, coop);
      return { coopProfiles: newCoops };
    }),

    updateCoopProfile: (coopId, updates) => set((state) => {
      const newCoops = new Map(state.coopProfiles);
      const existing = newCoops.get(coopId);
      if (existing) {
        newCoops.set(coopId, { ...existing, ...updates, updatedAt: Date.now() });
      }
      return { coopProfiles: newCoops };
    }),

    deleteCoopProfile: (coopId) => set((state) => {
      const newCoops = new Map(state.coopProfiles);
      newCoops.delete(coopId);
      return { coopProfiles: newCoops };
    }),

    getCoopProfile: (coopId) => get().coopProfiles.get(coopId),

    getCoopsByGroup: (groupId) => {
      return Array.from(get().coopProfiles.values())
        .filter((c) => c.groupId === groupId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    },

    vouchForCoop: (coopId, voucherPubkey) => set((state) => {
      const newCoops = new Map(state.coopProfiles);
      const coop = newCoops.get(coopId);
      const verifiedBy = coop?.verifiedBy ?? [];
      if (coop && !verifiedBy.includes(voucherPubkey)) {
        newCoops.set(coopId, {
          ...coop,
          verifiedBy: [...verifiedBy, voucherPubkey],
          updatedAt: Date.now(),
        });
      }
      return { coopProfiles: newCoops };
    }),

    // ========================================================================
    // Review Actions
    // ========================================================================

    addReview: (review) => set((state) => {
      const newReviews = new Map(state.reviews);
      newReviews.set(review.id, review);
      return { reviews: newReviews };
    }),

    deleteReview: (reviewId) => set((state) => {
      const newReviews = new Map(state.reviews);
      newReviews.delete(reviewId);
      return { reviews: newReviews };
    }),

    getReviewsForListing: (listingId) => {
      return Array.from(get().reviews.values())
        .filter((r) => r.listingId === listingId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getAverageRating: (listingId) => {
      const reviews = Array.from(get().reviews.values()).filter(
        (r) => r.listingId === listingId
      );
      if (reviews.length === 0) return 0;
      return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    },

    // ========================================================================
    // Skill Exchange Actions
    // ========================================================================

    addSkillExchange: (exchange) => set((state) => {
      const newExchanges = new Map(state.skillExchanges);
      newExchanges.set(exchange.id, exchange);
      return { skillExchanges: newExchanges };
    }),

    updateSkillExchange: (exchangeId, updates) => set((state) => {
      const newExchanges = new Map(state.skillExchanges);
      const existing = newExchanges.get(exchangeId);
      if (existing) {
        newExchanges.set(exchangeId, { ...existing, ...updates, updatedAt: Date.now() });
      }
      return { skillExchanges: newExchanges };
    }),

    deleteSkillExchange: (exchangeId) => set((state) => {
      const newExchanges = new Map(state.skillExchanges);
      newExchanges.delete(exchangeId);
      return { skillExchanges: newExchanges };
    }),

    getSkillExchangesByGroup: (groupId) => {
      return Array.from(get().skillExchanges.values())
        .filter((e) => e.groupId === groupId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getActiveSkillExchanges: (groupId) => {
      return Array.from(get().skillExchanges.values())
        .filter((e) => e.groupId === groupId && e.status === 'active')
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    // ========================================================================
    // Resource Share Actions
    // ========================================================================

    addResourceShare: (resource) => set((state) => {
      const newResources = new Map(state.resourceShares);
      newResources.set(resource.id, resource);
      return { resourceShares: newResources };
    }),

    updateResourceShare: (resourceId, updates) => set((state) => {
      const newResources = new Map(state.resourceShares);
      const existing = newResources.get(resourceId);
      if (existing) {
        newResources.set(resourceId, { ...existing, ...updates, updatedAt: Date.now() });
      }
      return { resourceShares: newResources };
    }),

    deleteResourceShare: (resourceId) => set((state) => {
      const newResources = new Map(state.resourceShares);
      newResources.delete(resourceId);
      return { resourceShares: newResources };
    }),

    getResourceSharesByGroup: (groupId) => {
      return Array.from(get().resourceShares.values())
        .filter((r) => r.groupId === groupId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getAvailableResources: (groupId) => {
      return Array.from(get().resourceShares.values())
        .filter((r) => r.groupId === groupId && r.status === 'available')
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    // ========================================================================
    // UI State Actions
    // ========================================================================

    setActiveTab: (tab) => set({ activeTab: tab }),

    setFilters: (updates) => set((state) => ({
      filters: { ...state.filters, ...updates },
    })),

    resetFilters: () => set({ filters: { ...defaultFilters } }),

    setViewMode: (mode) => set({ viewMode: mode }),

    // ========================================================================
    // Utility Actions
    // ========================================================================

    clearAll: () =>
      set({
        listings: new Map(),
        coopProfiles: new Map(),
        reviews: new Map(),
        skillExchanges: new Map(),
        resourceShares: new Map(),
        activeTab: 'listings',
        filters: { ...defaultFilters },
        viewMode: 'grid',
        loading: false,
        error: null,
      }),

    loadData: (data) =>
      set((state) => ({
        ...state,
        ...data,
      })),
  })
);
