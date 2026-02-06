/**
 * ListingCard Component
 * Card display for a marketplace listing
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Clock } from 'lucide-react';
import { formatListingPrice } from '../marketplaceManager';
import { useMarketplaceStore } from '../marketplaceStore';
import type { Listing, LocationValue } from '../types';

interface ListingCardProps {
  listing: Listing;
  onClick: (listing: Listing) => void;
}

const typeLabels: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  'co-op': 'Co-op',
  initiative: 'Initiative',
  resource: 'Resource',
};

const typeColors: Record<string, string> = {
  product: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  service: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'co-op': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  initiative: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  resource: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
};

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const { t } = useTranslation();
  const getAverageRating = useMarketplaceStore((s) => s.getAverageRating);
  const getReviewsForListing = useMarketplaceStore((s) => s.getReviewsForListing);

  const avgRating = getAverageRating(listing.id);
  const reviewCount = getReviewsForListing(listing.id).length;
  const images = listing.images ?? [];
  const location = listing.location as LocationValue | undefined;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary transition-colors group"
      onClick={() => onClick(listing)}
    >
      {/* Image thumbnail */}
      {images.length > 0 ? (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">{t('marketplace.noImage', 'No image')}</span>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Category badge */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={typeColors[listing.type] ?? ''}>
            {typeLabels[listing.type] ?? listing.type}
          </Badge>
          {listing.status !== 'active' && (
            <Badge variant="outline">{listing.status}</Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        <p className="text-lg font-bold">
          {formatListingPrice(listing.price, listing.currency)}
        </p>

        {/* Location (fuzzy) */}
        {location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{location.label}</span>
          </div>
        )}

        {/* Rating stars */}
        {reviewCount > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviewCount})</span>
          </div>
        )}

        {/* Expiry */}
        {listing.expiresAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {t('marketplace.expires')}{' '}
              {new Date(listing.expiresAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
