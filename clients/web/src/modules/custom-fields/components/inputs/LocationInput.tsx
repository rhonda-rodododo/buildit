/**
 * LocationInput Component
 * Custom field input for geographic locations with privacy controls.
 *
 * Features:
 * - Manual address entry with Nominatim OSM geocoding
 * - GPS auto-fill with explicit permission prompt
 * - Precision selector with privacy warnings
 * - Inline map preview using Leaflet + OpenStreetMap
 *
 * PRIVACY: Fuzzy precision (neighborhood) is the default. Exact location
 * requires opt-in with a clear privacy warning displayed to the user.
 */

import { FC, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapView } from '@/components/ui/MapView';
import type { CustomField, LocationValue, LocationPrecision } from '../../types';
import {
  geocodeAddress,
  reverseGeocode,
  getPrecisionDescription,
} from '@/lib/geo/distance';
import { MapPin, Navigation, Search, AlertTriangle, Loader2 } from 'lucide-react';

interface LocationInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export const LocationInput: FC<LocationInputProps> = ({
  field,
  register,
  error,
  value,
  onChange,
}) => {
  const { t } = useTranslation('custom-fields');
  const { schema, widget } = field;

  const locationValue = value as LocationValue | undefined;
  const defaultPrecision = widget.defaultPrecision || 'neighborhood';
  const allowExact = widget.allowExactLocation ?? false;
  const showMapPreview = widget.showMapPreview ?? true;

  const [searchQuery, setSearchQuery] = useState(locationValue?.label || '');
  const [searchResults, setSearchResults] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [precision, setPrecision] = useState<LocationPrecision>(
    locationValue?.precision || defaultPrecision,
  );
  const [showExactWarning, setShowExactWarning] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Close results dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Emit value changes
  const emitChange = useCallback(
    (lat: number, lng: number, label: string, prec: LocationPrecision) => {
      const newValue: LocationValue = { lat, lng, label, precision: prec };
      onChange?.(newValue);
    },
    [onChange],
  );

  // Debounced geocoding search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.trim().length < 3) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await geocodeAddress(query);
          setSearchResults(results);
          setShowResults(results.length > 0);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    },
    [],
  );

  // Select a geocoding result
  const handleSelectResult = useCallback(
    (result: { lat: number; lng: number; label: string }) => {
      setSearchQuery(result.label);
      setShowResults(false);
      setSearchResults([]);
      emitChange(result.lat, result.lng, result.label, precision);
    },
    [emitChange, precision],
  );

  // GPS auto-fill
  const handleGetCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation API not available');
      return;
    }

    setIsGeolocating(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get a label
      const label = await reverseGeocode(latitude, longitude);

      setSearchQuery(label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      emitChange(
        latitude,
        longitude,
        label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        precision,
      );
    } catch (err) {
      console.warn('Geolocation failed:', err);
    } finally {
      setIsGeolocating(false);
    }
  }, [emitChange, precision]);

  // Handle precision change
  const handlePrecisionChange = useCallback(
    (newPrecision: LocationPrecision) => {
      if (newPrecision === 'exact' && !showExactWarning) {
        setShowExactWarning(true);
        return;
      }

      setPrecision(newPrecision);
      setShowExactWarning(false);

      if (locationValue) {
        emitChange(locationValue.lat, locationValue.lng, locationValue.label, newPrecision);
      }
    },
    [emitChange, locationValue, showExactWarning],
  );

  // Confirm exact precision after warning
  const confirmExactPrecision = useCallback(() => {
    setPrecision('exact');
    setShowExactWarning(false);
    if (locationValue) {
      emitChange(locationValue.lat, locationValue.lng, locationValue.label, 'exact');
    }
  }, [emitChange, locationValue]);

  // Handle map click to set pin
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      const label = await reverseGeocode(lat, lng);
      const displayLabel = label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSearchQuery(displayLabel);
      emitChange(lat, lng, displayLabel, precision);
    },
    [emitChange, precision],
  );

  // Build precision options based on config
  const precisionOptions: LocationPrecision[] = allowExact
    ? ['exact', 'neighborhood', 'city', 'region']
    : ['neighborhood', 'city', 'region'];

  return (
    <div className="space-y-3">
      <Label htmlFor={field.name}>
        <MapPin className="h-4 w-4 inline mr-1" />
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Search input with GPS button */}
      <div className="relative" ref={resultsRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id={field.name}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={widget.placeholder || t('location.searchPlaceholder', 'Search for a location...')}
              className={`pl-9 ${error ? 'border-destructive' : ''}`}
              disabled={widget.disabled}
              autoComplete="off"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetCurrentLocation}
            disabled={isGeolocating || widget.disabled}
            title={t('location.useGPS', 'Use current location')}
            aria-label={t('location.useGPS', 'Use current location')}
          >
            {isGeolocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0"
                onClick={() => handleSelectResult(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span className="line-clamp-2">{result.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Precision selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t('location.precisionLabel', 'Location precision')}
        </Label>
        <Select
          value={precision}
          onValueChange={(val) => handlePrecisionChange(val as LocationPrecision)}
          disabled={widget.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {precisionOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {getPrecisionDescription(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exact precision warning */}
      {showExactWarning && (
        <div className="p-3 border border-yellow-500/50 bg-yellow-500/10 rounded-md space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">
                {t('location.exactWarningTitle', 'Privacy Warning')}
              </p>
              <p className="text-yellow-600 dark:text-yellow-500 mt-1">
                {t(
                  'location.exactWarningMessage',
                  'Exact location data can identify you. Use neighborhood or city precision for safety.',
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowExactWarning(false)}
            >
              {t('location.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmExactPrecision}
            >
              {t('location.useExact', 'Use Exact Location')}
            </Button>
          </div>
        </div>
      )}

      {/* Neighborhood/City precision info */}
      {precision === 'neighborhood' && (
        <p className="text-xs text-muted-foreground">
          {t(
            'location.neighborhoodInfo',
            'Your location will be shown within ~500m of the actual position.',
          )}
        </p>
      )}

      {/* Map preview */}
      {showMapPreview && locationValue && (
        <MapView
          pins={[
            {
              lat: locationValue.lat,
              lng: locationValue.lng,
              label: locationValue.label,
              precision: locationValue.precision,
            },
          ]}
          height="180px"
          interactive={true}
          onMapClick={handleMapClick}
        />
      )}

      {/* Hidden input for react-hook-form */}
      <input type="hidden" {...register(field.name)} />

      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
