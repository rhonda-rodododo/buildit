/**
 * MapView Component
 * Reusable map using Leaflet + OpenStreetMap tiles.
 * Supports single pin mode (field display) and multi-pin mode (list views).
 */

import { FC, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fuzzyLocation, getZoomForPrecision } from '@/lib/geo/distance';
import type { LocationPrecision } from '@/modules/custom-fields/types';

// Fix for default Leaflet marker icon paths in bundled environments
// Leaflet expects these images in a specific path that Vite changes
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
  precision?: LocationPrecision;
  color?: 'red' | 'blue' | 'green' | 'orange' | 'purple';
  onClick?: () => void;
}

interface MapViewProps {
  /** Pins to display on the map */
  pins: MapPin[];
  /** Map height in CSS units */
  height?: string;
  /** Map width in CSS units */
  width?: string;
  /** Initial zoom level (auto-calculated from pins if not provided) */
  zoom?: number;
  /** Initial center (auto-calculated from pins if not provided) */
  center?: { lat: number; lng: number };
  /** Whether the map is interactive (scroll, zoom, click) */
  interactive?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Whether to cluster pins in multi-pin mode */
  cluster?: boolean;
  /** Callback when the map is clicked (returns coordinates) */
  onMapClick?: (lat: number, lng: number) => void;
}

/**
 * Create a colored marker icon using an SVG data URI.
 * Avoids needing additional image assets.
 */
function createColoredIcon(color: string = 'red'): L.DivIcon {
  const colorMap: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f97316',
    purple: '#a855f7',
  };

  const fillColor = colorMap[color] || colorMap.red;

  return L.divIcon({
    className: 'custom-map-pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${fillColor}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

export const MapView: FC<MapViewProps> = ({
  pins,
  height = '200px',
  width = '100%',
  zoom,
  center,
  interactive = true,
  className = '',
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Apply precision-based fuzzing to pins
  const processedPins = useMemo(() => {
    return pins.map((pin) => {
      if (pin.precision && pin.precision !== 'exact') {
        const fuzzed = fuzzyLocation(pin.lat, pin.lng, pin.precision);
        return { ...pin, lat: fuzzed.lat, lng: fuzzed.lng };
      }
      return pin;
    });
  }, [pins]);

  // Calculate center and zoom from pins if not provided
  const { effectiveCenter, effectiveZoom } = useMemo(() => {
    if (processedPins.length === 0) {
      return {
        effectiveCenter: center || { lat: 0, lng: 0 },
        effectiveZoom: zoom || 2,
      };
    }

    let effectiveCenter: { lat: number; lng: number };
    let effectiveZoom: number;

    if (center) {
      effectiveCenter = center;
    } else if (processedPins.length === 1) {
      effectiveCenter = { lat: processedPins[0].lat, lng: processedPins[0].lng };
    } else {
      // Calculate centroid
      const sumLat = processedPins.reduce((sum, pin) => sum + pin.lat, 0);
      const sumLng = processedPins.reduce((sum, pin) => sum + pin.lng, 0);
      effectiveCenter = {
        lat: sumLat / processedPins.length,
        lng: sumLng / processedPins.length,
      };
    }

    if (zoom !== undefined) {
      effectiveZoom = zoom;
    } else if (processedPins.length === 1 && processedPins[0].precision) {
      effectiveZoom = getZoomForPrecision(processedPins[0].precision);
    } else {
      effectiveZoom = 13;
    }

    return { effectiveCenter, effectiveZoom };
  }, [processedPins, center, zoom]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map if re-rendering
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapContainerRef.current, {
      center: [effectiveCenter.lat, effectiveCenter.lng],
      zoom: effectiveZoom,
      scrollWheelZoom: interactive,
      dragging: interactive,
      zoomControl: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      attributionControl: true,
    });

    // Use OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add click handler
    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [effectiveCenter.lat, effectiveCenter.lng, effectiveZoom, interactive, onMapClick]);

  // Update markers when pins change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    processedPins.forEach((pin) => {
      // For 'region' precision, don't show a pin - just a circle
      if (pin.precision === 'region') {
        const circle = L.circle([pin.lat, pin.lng], {
          radius: 50000, // 50km radius
          color: '#3b82f6',
          fillColor: '#3b82f680',
          fillOpacity: 0.2,
          weight: 1,
        }).addTo(map);

        if (pin.label) {
          circle.bindPopup(pin.label);
        }
        return;
      }

      const icon = pin.color ? createColoredIcon(pin.color) : defaultIcon;
      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);

      if (pin.label) {
        marker.bindPopup(pin.label);
      }

      if (pin.onClick) {
        marker.on('click', pin.onClick);
      }

      // For neighborhood/city precision, add a circle to show fuzzy area
      if (pin.precision === 'neighborhood') {
        L.circle([pin.lat, pin.lng], {
          radius: 500, // 500m
          color: '#3b82f680',
          fillColor: '#3b82f620',
          fillOpacity: 0.2,
          weight: 1,
        }).addTo(map);
      } else if (pin.precision === 'city') {
        L.circle([pin.lat, pin.lng], {
          radius: 5000, // 5km
          color: '#3b82f680',
          fillColor: '#3b82f620',
          fillOpacity: 0.2,
          weight: 1,
        }).addTo(map);
      }

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple pins
    if (processedPins.length > 1) {
      const bounds = L.latLngBounds(processedPins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [processedPins]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width }}
      className={`rounded-md border overflow-hidden ${className}`}
      role="img"
      aria-label="Map view"
    />
  );
};
