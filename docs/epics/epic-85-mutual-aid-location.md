# Epic 85: Location Custom Field & Geographic Features

**Status**: Not Started
**Priority**: P3 - Feature Enhancement
**Effort**: 20-28 hours
**Platforms**: All (custom-fields is cross-platform)
**Dependencies**: None (custom-fields module already exists)

---

## Context

Location awareness is a cross-cutting concern that should be a first-class custom field type, not siloed in any single module. By implementing location as a custom field type in the custom-fields module, it becomes available everywhere custom fields are used: Events (venue location), Mutual Aid (request/offer location), CRM (contact addresses), Database (any user-defined table), and Posts (location tagging). The custom-fields module is the foundation that Events, Mutual Aid, Database, and CRM all extend.

**Sources**:
- `clients/web/NEXT_ROADMAP.md` - Backlog Item 6 (Advanced Mutual Aid)
- `clients/web/docs/TECH_DEBT.md` - Advanced Features (location tagging, geolocation matching)

---

## Tasks

### Custom Field: Location Type (6-8h)

#### Schema & Type Definition
- [ ] Add `location` field type to custom-fields module schema
- [ ] Define `LocationFieldValue`: `{ lat: number, lng: number, label?: string, precision: 'exact' | 'neighborhood' | 'city' | 'region' }`
- [ ] Add to `protocol/schemas/modules/custom-fields/` and run codegen
- [ ] Add validation rules (lat: -90..90, lng: -180..180)

#### Location Field UI Component
- [ ] Create `LocationFieldInput` component for custom-fields renderer
- [ ] Manual text entry with geocoding (Nominatim/OSM, NOT Google)
- [ ] Optional GPS auto-fill with explicit permission prompt
- [ ] Precision selector (exact → neighborhood → city → region)
- [ ] Privacy warning when precision is "exact"
- [ ] Map pin preview (small inline OpenStreetMap)

#### Location Field Display Component
- [ ] Create `LocationFieldDisplay` for rendering location values
- [ ] Show label + small map thumbnail
- [ ] Respect precision level (blur pin for lower precision)
- [ ] "Open in maps" link (OpenStreetMap, not Google)

#### Privacy-Preserving Storage
- [ ] Location stored encrypted in custom field value (NIP-44)
- [ ] Relay sees encrypted blob only
- [ ] Strip GPS EXIF metadata from any attached media
- [ ] Location history deletable

### Module Integration (4-6h)

#### Events Module
- [ ] Add default "Venue Location" custom field to event schema
- [ ] Display venue on event detail with map
- [ ] "Get Directions" link
- [ ] Filter events by proximity

#### Mutual Aid Module
- [ ] Add default "Location" custom field to requests and offers
- [ ] Enable radius-based matching (see below)
- [ ] Display location on request/offer cards

#### CRM Module
- [ ] Add default "Address" custom field to CRM contact templates
- [ ] Support multiple addresses per contact (home, work, etc.)
- [ ] Geocode addresses for proximity features

#### Database Module
- [ ] Location available as column type in user-defined tables
- [ ] Filter/sort database rows by proximity to a point

#### Post Composer
- [ ] Add optional location tag using location custom field component
- [ ] Display location on posts in feed
- **File**: `clients/web/src/modules/microblogging/PostComposer.tsx`

### Geographic Matching Engine (4-6h)

#### Distance Calculation
- [ ] Implement Haversine distance calculation utility
- [ ] Support configurable radius matching (1mi, 5mi, 10mi, 25mi, etc.)
- [ ] Rank results by distance (nearest first)
- [ ] Handle items without location (show at end)

#### Mutual Aid Radius Matching
- [ ] Match aid requests with offers within configurable radius
- [ ] Auto-suggest matches to providers
- [ ] Notification when new request appears within user's radius
- [ ] "Willing to travel" flag support

### Map View Component (4-6h)

#### Shared Map Component
- [ ] Create reusable `MapView` component using Leaflet + OpenStreetMap
- [ ] Support pin markers with custom icons per type
- [ ] Pin clustering at zoom levels
- [ ] Filter controls (category, urgency, date range, type)
- [ ] Respect precision levels (blur pins for low-precision locations)

#### Module-Specific Map Views
- [ ] Mutual aid: requests (red pins) vs offers (green pins) map
- [ ] Events: upcoming events map
- [ ] Solidarity rideshare: route visualization with pickup/dropoff
- [ ] CRM: contact map view

### Cross-Platform (2-4h)
- [ ] iOS: `LocationFieldInput`/`Display` in SwiftUI using MapKit
- [ ] Android: `LocationFieldInput`/`Display` in Compose using OSM
- [ ] Consistent precision controls and privacy warnings across platforms

---

## Acceptance Criteria

- [ ] `location` is a first-class custom field type available in all modules
- [ ] Events, Mutual Aid, CRM, Database, and Posts all support location
- [ ] Mutual aid requests match by geographic proximity
- [ ] Reusable map component shows pins with clustering
- [ ] Location encrypted end-to-end (relay cannot see coordinates)
- [ ] Users control precision granularity per field instance
- [ ] No GPS data leaks through metadata or relays
- [ ] Works without location (graceful degradation)
- [ ] All geocoding uses OSM/Nominatim (not Google)

---

## Privacy Considerations

This is a **high-sensitivity feature** for the target audience:

- **State actors** could use location data to map organizer networks
- Location must NEVER be sent in cleartext to relays
- Fuzzy precision ("neighborhood") should be the default
- GPS permission must be explicit opt-in with clear explanation
- Show warning: "Location data can identify you. Use neighborhood or city precision for safety."
- Location history must be deletable
- Map tile requests to OSM reveal user's viewport - consider tile proxy or pre-caching
- Geocoding queries (address → lat/lng) reveal what locations user is interested in - batch/proxy

---

**Git Commit Format**: `feat(custom-fields): add location field type with geographic features (Epic 85)`
**Git Tag**: `v0.85.0-location-fields`
