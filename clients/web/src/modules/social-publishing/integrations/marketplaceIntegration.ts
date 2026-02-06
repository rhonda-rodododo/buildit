/**
 * Marketplace → Social Publishing Integration
 *
 * Reads from the marketplace store to provide public listings for sharing
 * through the social-publishing system.
 */

import { logger } from '@/lib/logger';
import type { Listing } from '@/modules/marketplace/types';

export interface ShareableListing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  sourceModule: 'marketplace';
  sourceContentId: string;
}

/**
 * Marketplace Integration
 * Adapts listings from marketplace module for social-publishing
 */
export class MarketplaceIntegration {
  private static instance: MarketplaceIntegration | null = null;

  static getInstance(): MarketplaceIntegration {
    if (!this.instance) {
      this.instance = new MarketplaceIntegration();
    }
    return this.instance;
  }

  /**
   * Get active listings that can be shared.
   */
  async getShareableListings(): Promise<ShareableListing[]> {
    try {
      const { useMarketplaceStore } = await import('@/modules/marketplace/marketplaceStore');
      const store = useMarketplaceStore.getState();

      return Array.from(store.listings.values() as Iterable<Listing>)
        .filter((l) => l.status === 'active')
        .map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description || '',
          price: listing.price ?? 0,
          currency: listing.currency || 'USD',
          category: String(listing.category || ''),
          sourceModule: 'marketplace' as const,
          sourceContentId: listing.id,
        }));
    } catch (error) {
      logger.warn('Failed to load marketplace store for integration', { error });
      return [];
    }
  }

  /**
   * Get the public URL for a listing.
   */
  getListingUrl(listingId: string): string {
    return `https://buildit.network/marketplace/${listingId}`;
  }
}
