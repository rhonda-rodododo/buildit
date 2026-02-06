/**
 * Tests for geographic utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  isWithinRadius,
  fuzzyLocation,
  getZoomForPrecision,
  getPrecisionDescription,
  getOpenStreetMapUrl,
  PRECISION_OFFSETS,
} from '../distance';

describe('haversineDistance', () => {
  it('should return 0 for the same point', () => {
    const distance = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(distance).toBe(0);
  });

  it('should calculate distance between NYC and LA correctly', () => {
    // NYC: 40.7128, -74.0060
    // LA: 34.0522, -118.2437
    const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    // Expected: ~3944 km
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4000);
  });

  it('should calculate distance between London and Paris correctly', () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    const distance = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    // Expected: ~341 km
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(350);
  });

  it('should be symmetric', () => {
    const d1 = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    const d2 = haversineDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('should handle antipodal points', () => {
    // North pole to south pole
    const distance = haversineDistance(90, 0, -90, 0);
    // Half circumference: ~20,015 km
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20100);
  });
});

describe('isWithinRadius', () => {
  it('should return true for points within radius', () => {
    const point1 = { lat: 40.7128, lng: -74.006 };
    const point2 = { lat: 40.72, lng: -74.01 }; // Very close (~1km)
    expect(isWithinRadius(point1, point2, 5)).toBe(true);
  });

  it('should return false for points outside radius', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    expect(isWithinRadius(nyc, la, 100)).toBe(false);
  });

  it('should return true for same point with any radius', () => {
    const point = { lat: 40.7128, lng: -74.006 };
    expect(isWithinRadius(point, point, 0)).toBe(true);
  });
});

describe('fuzzyLocation', () => {
  it('should return exact coordinates for exact precision', () => {
    const result = fuzzyLocation(40.7128, -74.006, 'exact');
    expect(result.lat).toBe(40.7128);
    expect(result.lng).toBe(-74.006);
  });

  it('should add offset for neighborhood precision', () => {
    const results = new Set<string>();
    // Run multiple times to check randomness
    for (let i = 0; i < 10; i++) {
      const result = fuzzyLocation(40.7128, -74.006, 'neighborhood');
      results.add(`${result.lat.toFixed(6)},${result.lng.toFixed(6)}`);
      // Check that offset is within bounds
      expect(Math.abs(result.lat - 40.7128)).toBeLessThanOrEqual(PRECISION_OFFSETS.neighborhood);
      expect(Math.abs(result.lng - (-74.006))).toBeLessThanOrEqual(PRECISION_OFFSETS.neighborhood);
    }
    // Should produce different values due to randomness
    expect(results.size).toBeGreaterThan(1);
  });

  it('should add larger offset for city precision', () => {
    const result = fuzzyLocation(40.7128, -74.006, 'city');
    expect(Math.abs(result.lat - 40.7128)).toBeLessThanOrEqual(PRECISION_OFFSETS.city);
    expect(Math.abs(result.lng - (-74.006))).toBeLessThanOrEqual(PRECISION_OFFSETS.city);
  });

  it('should add even larger offset for region precision', () => {
    const result = fuzzyLocation(40.7128, -74.006, 'region');
    expect(Math.abs(result.lat - 40.7128)).toBeLessThanOrEqual(PRECISION_OFFSETS.region);
    expect(Math.abs(result.lng - (-74.006))).toBeLessThanOrEqual(PRECISION_OFFSETS.region);
  });
});

describe('getZoomForPrecision', () => {
  it('should return highest zoom for exact precision', () => {
    expect(getZoomForPrecision('exact')).toBe(16);
  });

  it('should return moderate zoom for neighborhood', () => {
    expect(getZoomForPrecision('neighborhood')).toBe(14);
  });

  it('should return lower zoom for city', () => {
    expect(getZoomForPrecision('city')).toBe(11);
  });

  it('should return lowest zoom for region', () => {
    expect(getZoomForPrecision('region')).toBe(8);
  });
});

describe('getPrecisionDescription', () => {
  it('should return descriptions for all precision levels', () => {
    expect(getPrecisionDescription('exact')).toContain('Exact');
    expect(getPrecisionDescription('neighborhood')).toContain('Neighborhood');
    expect(getPrecisionDescription('city')).toContain('City');
    expect(getPrecisionDescription('region')).toContain('Regional');
  });
});

describe('getOpenStreetMapUrl', () => {
  it('should return a valid OpenStreetMap URL', () => {
    const url = getOpenStreetMapUrl(40.7128, -74.006);
    expect(url).toContain('openstreetmap.org');
    expect(url).toContain('40.7128');
    expect(url).toContain('-74.006');
  });

  it('should include custom zoom level', () => {
    const url = getOpenStreetMapUrl(40.7128, -74.006, 10);
    expect(url).toContain('#map=10');
  });
});

describe('PRECISION_OFFSETS', () => {
  it('should have zero offset for exact', () => {
    expect(PRECISION_OFFSETS.exact).toBe(0);
  });

  it('should have increasing offsets', () => {
    expect(PRECISION_OFFSETS.neighborhood).toBeLessThan(PRECISION_OFFSETS.city);
    expect(PRECISION_OFFSETS.city).toBeLessThan(PRECISION_OFFSETS.region);
  });

  it('should cover all precision levels', () => {
    expect(PRECISION_OFFSETS).toHaveProperty('exact');
    expect(PRECISION_OFFSETS).toHaveProperty('neighborhood');
    expect(PRECISION_OFFSETS).toHaveProperty('city');
    expect(PRECISION_OFFSETS).toHaveProperty('region');
  });
});
