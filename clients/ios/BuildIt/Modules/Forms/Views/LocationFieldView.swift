// LocationFieldView.swift
// BuildIt - Decentralized Mesh Communication
//
// Location field component with MapKit display, CLLocationManager GPS,
// and privacy precision controls.
//
// PRIVACY: Neighborhood precision is the default. Exact location
// requires explicit opt-in with a privacy warning.

import SwiftUI
import MapKit
import CoreLocation

// MARK: - Location Precision

/// Privacy precision levels for location sharing
public enum LocationPrecision: String, Codable, CaseIterable, Sendable {
    case exact
    case neighborhood
    case city
    case region

    var displayName: String {
        switch self {
        case .exact: return "Exact address (least private)"
        case .neighborhood: return "Neighborhood area (~500m)"
        case .city: return "City area (~5km)"
        case .region: return "Regional area (~50km)"
        }
    }

    var icon: String {
        switch self {
        case .exact: return "mappin"
        case .neighborhood: return "mappin.circle"
        case .city: return "building.2"
        case .region: return "map"
        }
    }

    /// Offset in degrees for fuzzing location
    var offsetDegrees: Double {
        switch self {
        case .exact: return 0
        case .neighborhood: return 0.005
        case .city: return 0.05
        case .region: return 0.5
        }
    }

    /// Map zoom span for this precision level
    var mapSpan: MKCoordinateSpan {
        switch self {
        case .exact: return MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
        case .neighborhood: return MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
        case .city: return MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
        case .region: return MKCoordinateSpan(latitudeDelta: 1.0, longitudeDelta: 1.0)
        }
    }
}

// MARK: - Location Value

/// Structured location value stored by location fields
public struct LocationValue: Codable, Sendable, Equatable {
    public let lat: Double
    public let lng: Double
    public let label: String
    public let precision: LocationPrecision

    public init(lat: Double, lng: Double, label: String, precision: LocationPrecision = .neighborhood) {
        self.lat = lat
        self.lng = lng
        self.label = label
        self.precision = precision
    }

    /// Get coordinate with privacy-preserving offset applied
    public var fuzzyCoordinate: CLLocationCoordinate2D {
        let offset = precision.offsetDegrees
        if offset == 0 {
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        let latOffset = Double.random(in: -offset...offset)
        let lngOffset = Double.random(in: -offset...offset)
        return CLLocationCoordinate2D(
            latitude: lat + latOffset,
            longitude: lng + lngOffset
        )
    }

    /// OpenStreetMap URL
    public var openStreetMapURL: URL? {
        URL(string: "https://www.openstreetmap.org/?mlat=\(lat)&mlon=\(lng)#map=15/\(lat)/\(lng)")
    }
}

// MARK: - Location Manager

/// Observable location manager for GPS access
@MainActor
class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    @Published var location: CLLocationCoordinate2D?
    @Published var authorizationStatus: CLAuthorizationStatus
    @Published var isLocating = false

    override init() {
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestLocation() {
        isLocating = true
        if authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else {
            manager.requestLocation()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            self.location = locations.last?.coordinate
            self.isLocating = false
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            print("Location error: \(error.localizedDescription)")
            self.isLocating = false
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus
            if self.authorizationStatus == .authorizedWhenInUse || self.authorizationStatus == .authorizedAlways {
                if self.isLocating {
                    manager.requestLocation()
                }
            }
        }
    }
}

// MARK: - Location Field Input View

/// Location input field for forms with search, GPS, precision controls, and map preview
struct LocationFieldInputView: View {
    let label: String
    let isRequired: Bool
    let allowExactLocation: Bool
    @Binding var value: LocationValue?

    @StateObject private var locationManager = LocationManager()
    @State private var searchText = ""
    @State private var searchResults: [MKMapItem] = []
    @State private var precision: LocationPrecision = .neighborhood
    @State private var showExactWarning = false
    @State private var isSearching = false

    init(
        label: String,
        isRequired: Bool = false,
        allowExactLocation: Bool = false,
        value: Binding<LocationValue?>
    ) {
        self.label = label
        self.isRequired = isRequired
        self.allowExactLocation = allowExactLocation
        self._value = value
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Label
            HStack {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(.secondary)
                Text(label)
                    .font(.subheadline)
                    .fontWeight(.medium)
                if isRequired {
                    Text("*")
                        .foregroundStyle(.red)
                }
            }

            // Search bar with GPS button
            HStack {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search for a location...", text: $searchText)
                        .textFieldStyle(.plain)
                        .onSubmit {
                            performSearch()
                        }
                }
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(8)

                Button {
                    locationManager.requestLocation()
                } label: {
                    Image(systemName: locationManager.isLocating ? "location.fill" : "location")
                        .frame(width: 36, height: 36)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                }
                .disabled(locationManager.isLocating)
            }

            // Search results
            if !searchResults.isEmpty {
                VStack(spacing: 0) {
                    ForEach(searchResults, id: \.self) { item in
                        Button {
                            selectSearchResult(item)
                        } label: {
                            HStack {
                                Image(systemName: "mappin")
                                    .foregroundStyle(.secondary)
                                VStack(alignment: .leading) {
                                    Text(item.name ?? "Unknown")
                                        .font(.subheadline)
                                    if let address = item.placemark.formattedAddress {
                                        Text(address)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                Spacer()
                            }
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                        }
                        .buttonStyle(.plain)
                        Divider()
                    }
                }
                .background(Color(.systemBackground))
                .cornerRadius(8)
                .shadow(radius: 2)
            }

            // Precision selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Location precision")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Picker("Precision", selection: $precision) {
                    ForEach(availablePrecisions, id: \.self) { level in
                        HStack {
                            Image(systemName: level.icon)
                            Text(level.displayName)
                        }
                        .tag(level)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: precision) { _, newValue in
                    if newValue == .exact {
                        showExactWarning = true
                    } else if let loc = value {
                        value = LocationValue(
                            lat: loc.lat,
                            lng: loc.lng,
                            label: loc.label,
                            precision: newValue
                        )
                    }
                }
            }

            // Privacy warning for exact precision
            if showExactWarning {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.yellow)
                        Text("Privacy Warning")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                    Text("Exact location data can identify you. Use neighborhood or city precision for safety.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    HStack {
                        Button("Cancel") {
                            precision = .neighborhood
                            showExactWarning = false
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)

                        Button("Use Exact Location") {
                            showExactWarning = false
                            if let loc = value {
                                value = LocationValue(
                                    lat: loc.lat,
                                    lng: loc.lng,
                                    label: loc.label,
                                    precision: .exact
                                )
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                        .controlSize(.small)
                    }
                }
                .padding()
                .background(Color.yellow.opacity(0.1))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
                )
            }

            // Map preview
            if let location = value {
                let coordinate = location.fuzzyCoordinate
                let region = MKCoordinateRegion(
                    center: coordinate,
                    span: location.precision.mapSpan
                )

                Map(initialPosition: .region(region)) {
                    if location.precision != .region {
                        Marker(location.label, coordinate: coordinate)
                    }
                }
                .frame(height: 180)
                .cornerRadius(8)
                .disabled(true)
            }
        }
        .onChange(of: locationManager.location) { _, coordinate in
            guard let coordinate else { return }
            // Reverse geocode to get label
            let geocoder = CLGeocoder()
            let clLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            geocoder.reverseGeocodeLocation(clLocation) { placemarks, _ in
                let label = placemarks?.first?.formattedAddress ?? "\(coordinate.latitude), \(coordinate.longitude)"
                searchText = label
                value = LocationValue(
                    lat: coordinate.latitude,
                    lng: coordinate.longitude,
                    label: label,
                    precision: precision
                )
            }
        }
    }

    private var availablePrecisions: [LocationPrecision] {
        if allowExactLocation {
            return LocationPrecision.allCases
        }
        return LocationPrecision.allCases.filter { $0 != .exact }
    }

    private func performSearch() {
        guard !searchText.isEmpty else { return }
        isSearching = true

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchText

        let search = MKLocalSearch(request: request)
        search.start { response, error in
            isSearching = false
            if let response {
                searchResults = Array(response.mapItems.prefix(5))
            }
        }
    }

    private func selectSearchResult(_ item: MKMapItem) {
        let coordinate = item.placemark.coordinate
        let label = item.placemark.formattedAddress ?? item.name ?? "Selected location"
        searchText = label
        searchResults = []
        value = LocationValue(
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            label: label,
            precision: precision
        )
    }
}

// MARK: - Location Field Display View

/// Read-only location display with map thumbnail
struct LocationFieldDisplayView: View {
    let value: LocationValue
    let showMap: Bool

    init(value: LocationValue, showMap: Bool = true) {
        self.value = value
        self.showMap = showMap
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Label + precision badge
            HStack(alignment: .top) {
                Image(systemName: "mappin")
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayLabel)
                        .font(.subheadline)

                    HStack {
                        Text(value.precision.displayName)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(precisionColor.opacity(0.1))
                            .foregroundStyle(precisionColor)
                            .cornerRadius(4)

                        if let url = value.openStreetMapURL {
                            Link(destination: url) {
                                HStack(spacing: 2) {
                                    Image(systemName: "arrow.up.forward.square")
                                    Text("OpenStreetMap")
                                }
                                .font(.caption2)
                                .foregroundStyle(.blue)
                            }
                        }
                    }
                }
            }

            // Map thumbnail
            if showMap {
                let coordinate = value.fuzzyCoordinate
                let region = MKCoordinateRegion(
                    center: coordinate,
                    span: value.precision.mapSpan
                )

                Map(initialPosition: .region(region)) {
                    if value.precision != .region {
                        Marker(displayLabel, coordinate: coordinate)
                    }
                }
                .frame(height: 150)
                .cornerRadius(8)
                .disabled(true)
            }
        }
    }

    private var displayLabel: String {
        let parts = value.label.components(separatedBy: ", ")
        switch value.precision {
        case .region:
            return parts.count > 2 ? parts.suffix(2).joined(separator: ", ") : value.label
        case .city:
            return parts.count > 3 ? parts.suffix(3).joined(separator: ", ") : value.label
        default:
            return value.label
        }
    }

    private var precisionColor: Color {
        switch value.precision {
        case .exact: return .red
        case .neighborhood: return .blue
        case .city: return .green
        case .region: return .gray
        }
    }
}

// MARK: - CLPlacemark Extension

extension CLPlacemark {
    var formattedAddress: String? {
        var parts: [String] = []
        if let street = thoroughfare { parts.append(street) }
        if let subLocality = subLocality { parts.append(subLocality) }
        if let city = locality { parts.append(city) }
        if let state = administrativeArea { parts.append(state) }
        if let country = country { parts.append(country) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
}

// MARK: - Preview

#Preview("Location Field Input") {
    @Previewable @State var location: LocationValue? = nil

    Form {
        LocationFieldInputView(
            label: "Event Location",
            isRequired: true,
            allowExactLocation: true,
            value: $location
        )
    }
}

#Preview("Location Field Display") {
    LocationFieldDisplayView(
        value: LocationValue(
            lat: 40.7128,
            lng: -74.0060,
            label: "New York City, New York, United States",
            precision: .neighborhood
        )
    )
    .padding()
}
