/**
 * Geographic Utility Functions
 * Privacy-preserving location calculations using haversine formula.
 * All coordinates use decimal degrees (WGS84).
 */

import type { LocationPrecision } from '@/modules/custom-fields/types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/**
 * Precision offsets in decimal degrees.
 * Used to add random noise to coordinates for privacy.
 * - exact: no offset (full precision)
 * - neighborhood: ~500m random offset
 * - city: ~5km random offset
 * - region: ~50km random offset
 */
export const PRECISION_OFFSETS: Record<LocationPrecision, number> = {
  exact: 0,
  neighborhood: 0.005,
  city: 0.05,
  region: 0.5,
};

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 *
 * @param lat1 - Latitude of point 1 (decimal degrees)
 * @param lng1 - Longitude of point 1 (decimal degrees)
 * @param lat2 - Latitude of point 2 (decimal degrees)
 * @param lng2 - Longitude of point 2 (decimal degrees)
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Check if two points are within a given radius.
 *
 * @param point1 - First point {lat, lng}
 * @param point2 - Second point {lat, lng}
 * @param radiusKm - Radius in kilometers
 * @returns true if the distance between points is within the radius
 */
export function isWithinRadius(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  const distance = haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
  return distance <= radiusKm;
}

/**
 * Apply a random offset to coordinates based on the precision level.
 * This is used to protect user privacy by fuzzing location data before display.
 *
 * SECURITY: The random offset is generated using crypto.getRandomValues for
 * unpredictability. For "exact" precision, no offset is applied.
 *
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @param precision - Privacy precision level
 * @returns Fuzzy coordinates with applied offset
 */
export function fuzzyLocation(
  lat: number,
  lng: number,
  precision: LocationPrecision,
): { lat: number; lng: number } {
  const offset = PRECISION_OFFSETS[precision];

  if (offset === 0) {
    return { lat, lng };
  }

  // Use crypto-secure random for unpredictable offsets
  const randomValues = new Uint32Array(2);
  crypto.getRandomValues(randomValues);

  // Convert to range [-1, 1]
  const randomLat = (randomValues[0] / 0xffffffff) * 2 - 1;
  const randomLng = (randomValues[1] / 0xffffffff) * 2 - 1;

  return {
    lat: lat + randomLat * offset,
    lng: lng + randomLng * offset,
  };
}

/**
 * Get the appropriate map zoom level for a given precision.
 *
 * @param precision - Location precision level
 * @returns Leaflet zoom level (higher = more zoomed in)
 */
export function getZoomForPrecision(precision: LocationPrecision): number {
  switch (precision) {
    case 'exact':
      return 16;
    case 'neighborhood':
      return 14;
    case 'city':
      return 11;
    case 'region':
      return 8;
    default:
      return 14;
  }
}

/**
 * Get human-readable description for precision level.
 */
export function getPrecisionDescription(precision: LocationPrecision): string {
  switch (precision) {
    case 'exact':
      return 'Exact address (least private)';
    case 'neighborhood':
      return 'Neighborhood area (~500m)';
    case 'city':
      return 'City area (~5km)';
    case 'region':
      return 'Regional area (~50km)';
    default:
      return 'Unknown precision';
  }
}

/**
 * Geocode an address string using Nominatim OSM API.
 * IMPORTANT: Uses OpenStreetMap Nominatim - NOT Google Geocoding.
 *
 * @param query - Address or place name to geocode
 * @returns Array of geocoding results, or empty array on failure
 */
export async function geocodeAddress(
  query: string,
): Promise<Array<{ lat: number; lng: number; label: string }>> {
  if (!query.trim()) return [];

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          // Nominatim requires a user-agent or they may block requests
          'User-Agent': 'BuildIt/1.0 (https://buildit.network)',
        },
      },
    );

    if (!response.ok) {
      console.warn('Geocoding request failed:', response.status);
      return [];
    }

    const results = await response.json();

    return results.map(
      (result: { lat: string; lon: string; display_name: string }) => ({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        label: result.display_name,
      }),
    );
  } catch (error) {
    console.warn('Geocoding failed:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to an address label.
 * Uses Nominatim OSM API.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Human-readable address label, or null on failure
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'User-Agent': 'BuildIt/1.0 (https://buildit.network)',
        },
      },
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Build an OpenStreetMap URL for the given coordinates.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param zoom - Zoom level
 * @returns OpenStreetMap URL
 */
export function getOpenStreetMapUrl(lat: number, lng: number, zoom: number = 15): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
