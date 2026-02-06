/**
 * LocationDisplay Component
 * Read-only display of a location custom field value.
 *
 * Privacy behavior by precision level:
 * - exact: Show full label and precise pin
 * - neighborhood: Show label + pin with ~500m random offset
 * - city: Show city center only, no detailed address
 * - region: Show region name only, no pin (circle overlay)
 */

import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapView } from '@/components/ui/MapView';
import type { LocationValue } from '../../types';
import {
  getOpenStreetMapUrl,
  getPrecisionDescription,
} from '@/lib/geo/distance';
import { MapPin, ExternalLink, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LocationDisplayProps {
  value: LocationValue;
  showMap?: boolean;
  compact?: boolean;
  className?: string;
}

export const LocationDisplay: FC<LocationDisplayProps> = ({
  value,
  showMap = true,
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation('custom-fields');

  // Compute display label based on precision
  const displayLabel = useMemo(() => {
    switch (value.precision) {
      case 'region':
        // For region, strip detailed address - show only the last 2 parts (typically region, country)
        const parts = value.label.split(',').map((p) => p.trim());
        return parts.length > 2 ? parts.slice(-2).join(', ') : value.label;
      case 'city':
        // Show city + region + country (last 3 parts)
        const cityParts = value.label.split(',').map((p) => p.trim());
        return cityParts.length > 3 ? cityParts.slice(-3).join(', ') : value.label;
      default:
        return value.label;
    }
  }, [value.label, value.precision]);

  // Compute OSM URL
  const osmUrl = useMemo(() => {
    if (value.precision === 'region') {
      return getOpenStreetMapUrl(value.lat, value.lng, 8);
    }
    return getOpenStreetMapUrl(value.lat, value.lng);
  }, [value]);

  // Precision indicator color
  const precisionColor = useMemo(() => {
    switch (value.precision) {
      case 'exact':
        return 'destructive' as const;
      case 'neighborhood':
        return 'default' as const;
      case 'city':
        return 'secondary' as const;
      case 'region':
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  }, [value.precision]);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate">{displayLabel}</span>
        {value.precision !== 'exact' && (
          <Shield className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-label={getPrecisionDescription(value.precision)} />
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Location label + precision badge */}
      <div className="flex items-start gap-2">
        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{displayLabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={precisionColor} className="text-xs">
              {getPrecisionDescription(value.precision)}
            </Badge>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground"
              asChild
            >
              <a
                href={osmUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {t('location.openInOSM', 'Open in OpenStreetMap')}
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Map thumbnail */}
      {showMap && value.precision !== 'region' && (
        <MapView
          pins={[
            {
              lat: value.lat,
              lng: value.lng,
              label: displayLabel,
              precision: value.precision,
            },
          ]}
          height="150px"
          interactive={false}
          className="mt-2"
        />
      )}

      {/* Region-only: show text description, no map pin */}
      {showMap && value.precision === 'region' && (
        <MapView
          pins={[
            {
              lat: value.lat,
              lng: value.lng,
              label: displayLabel,
              precision: 'region',
            },
          ]}
          height="120px"
          interactive={false}
          className="mt-2"
        />
      )}
    </div>
  );
};
