/**
 * CoopProfilePage Component
 * Individual co-op profile with listings, reviews, and vouch button
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Users, Shield, Globe, ExternalLink, CheckCircle } from 'lucide-react';
import { useCoopProfiles } from '../hooks/useMarketplace';
import { useMarketplaceStore } from '../marketplaceStore';
import { useAuthStore } from '@/stores/authStore';
import { ListingCard } from './ListingCard';
import type { CoopProfile, Listing, LocationValue } from '../types';

interface CoopProfilePageProps {
  coop: CoopProfile;
  onBack: () => void;
  onSelectListing: (listing: Listing) => void;
}

const governanceLabels: Record<string, string> = {
  consensus: 'Consensus',
  democratic: 'Democratic',
  sociocracy: 'Sociocracy',
  holacracy: 'Holacracy',
  hybrid: 'Hybrid',
  other: 'Other',
};

export function CoopProfilePage({ coop, onBack, onSelectListing }: CoopProfilePageProps) {
  const { t } = useTranslation();
  const { vouch } = useCoopProfiles();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const getListingsByCoop = useMarketplaceStore((s) => s.getListingsByCoop);

  const coopListings = getListingsByCoop(coop.id);
  const verifiedBy = coop.verifiedBy ?? [];
  const location = coop.location as LocationValue | undefined;
  const hasVouched = currentIdentity?.publicKey
    ? verifiedBy.includes(currentIdentity.publicKey)
    : false;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('marketplace.backToDirectory', 'Back to Directory')}
      </Button>

      {/* Profile Header */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {coop.image ? (
            <img
              src={coop.image}
              alt={coop.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-10 w-10 text-primary" />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{coop.name}</h1>
              {verifiedBy.length >= 3 && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </div>
            <p className="text-muted-foreground mt-1">{coop.description}</p>

            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              {coop.memberCount != null && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{coop.memberCount} {t('marketplace.members')}</span>
                </div>
              )}
              {coop.governanceModel && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">
                    {governanceLabels[coop.governanceModel] ?? coop.governanceModel}
                  </Badge>
                </div>
              )}
              {coop.industry && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{coop.industry}</Badge>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{location.label}</span>
                </div>
              )}
              {coop.website && (
                <a
                  href={coop.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  <span>Website</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Vouch button */}
          <Button
            variant={hasVouched ? 'secondary' : 'default'}
            onClick={() => vouch(coop.id)}
            disabled={hasVouched}
          >
            <Shield className="h-4 w-4 mr-2" />
            {hasVouched ? t('marketplace.vouched') : t('marketplace.vouch')}
          </Button>
        </div>

        {/* Vouchers */}
        {verifiedBy.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-green-600" />
              <span>
                {t('marketplace.vouchedBy', 'Vouched for by {{count}} people', {
                  count: verifiedBy.length,
                })}
              </span>
            </div>
          </div>
        )}
      </Card>

      <Separator />

      {/* Active Listings */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {t('marketplace.activeListings')} ({coopListings.length})
        </h2>
        {coopListings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {t('marketplace.noCoopListings', 'This co-op has no active listings.')}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coopListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClick={onSelectListing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
