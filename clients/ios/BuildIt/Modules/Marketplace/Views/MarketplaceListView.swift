// MarketplaceListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main marketplace view with tab navigation for listings, co-ops, skills, and resources.

import SwiftUI

/// Main marketplace list view with tab navigation
public struct MarketplaceListView: View {
    @StateObject private var viewModel: MarketplaceViewModel
    @State private var selectedTab: MarketplaceTab = .listings
    @State private var showingCreateSheet = false
    @State private var searchText = ""
    @State private var filterType: ListingType?

    public init(service: MarketplaceService) {
        _viewModel = StateObject(wrappedValue: MarketplaceViewModel(service: service))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker
                Picker("", selection: $selectedTab) {
                    Label("marketplace_listings".localized, systemImage: "bag")
                        .tag(MarketplaceTab.listings)
                    Label("marketplace_coops".localized, systemImage: "person.3")
                        .tag(MarketplaceTab.coops)
                    Label("marketplace_skills".localized, systemImage: "arrow.left.arrow.right")
                        .tag(MarketplaceTab.skills)
                    Label("marketplace_resources".localized, systemImage: "wrench")
                        .tag(MarketplaceTab.resources)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                // Content
                switch selectedTab {
                case .listings:
                    listingsView
                case .coops:
                    coopsView
                case .skills:
                    skillsPlaceholderView
                case .resources:
                    resourcesPlaceholderView
                }
            }
            .navigationTitle("marketplace_title".localized)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .searchable(text: $searchText, prompt: Text("marketplace_search".localized))
            .sheet(isPresented: $showingCreateSheet) {
                CreateListingView(service: viewModel.service) {
                    showingCreateSheet = false
                    Task { await viewModel.loadListings() }
                }
            }
            .sheet(item: $viewModel.selectedListing) { listing in
                ListingDetailView(listing: listing, service: viewModel.service)
            }
            .task {
                await viewModel.loadListings()
                await viewModel.loadCoops()
            }
        }
    }

    // MARK: - Listings View

    private var listingsView: some View {
        VStack(spacing: 0) {
            // Type filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    TypeFilterChip(
                        title: "marketplace_all".localized,
                        icon: "square.grid.2x2",
                        isSelected: filterType == nil
                    ) {
                        filterType = nil
                    }

                    ForEach(ListingType.allCases, id: \.self) { type in
                        TypeFilterChip(
                            title: type.displayName,
                            icon: type.icon,
                            isSelected: filterType == type
                        ) {
                            filterType = type
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 8)

            // Listings
            if viewModel.isLoading && viewModel.listings.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredListings.isEmpty {
                MarketplaceEmptyStateView(
                    icon: "bag",
                    title: "marketplace_noListings".localized,
                    message: "marketplace_noListingsHint".localized
                )
            } else {
                ScrollView {
                    LazyVGrid(
                        columns: [
                            GridItem(.flexible(), spacing: 12),
                            GridItem(.flexible(), spacing: 12)
                        ],
                        spacing: 12
                    ) {
                        ForEach(filteredListings) { listing in
                            ListingCardView(listing: listing)
                                .onTapGesture {
                                    viewModel.selectedListing = listing
                                }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 16)
                }
                .refreshable {
                    await viewModel.loadListings()
                }
            }
        }
    }

    // MARK: - Co-ops View

    private var coopsView: some View {
        Group {
            if viewModel.coops.isEmpty {
                MarketplaceEmptyStateView(
                    icon: "person.3",
                    title: "marketplace_noCoops".localized,
                    message: "marketplace_noCoopsHint".localized
                )
            } else {
                List {
                    ForEach(filteredCoops) { coop in
                        CoopRow(coop: coop)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.loadCoops()
                }
            }
        }
    }

    // MARK: - Placeholders

    private var skillsPlaceholderView: some View {
        MarketplaceEmptyStateView(
            icon: "arrow.left.arrow.right",
            title: "marketplace_skillExchange".localized,
            message: "marketplace_skillExchangeHint".localized
        )
    }

    private var resourcesPlaceholderView: some View {
        MarketplaceEmptyStateView(
            icon: "wrench.and.screwdriver",
            title: "marketplace_resourceLibrary".localized,
            message: "marketplace_resourceLibraryHint".localized
        )
    }

    // MARK: - Filtering

    private var filteredListings: [Listing] {
        var listings = viewModel.listings

        if let type = filterType {
            listings = listings.filter { $0.type == type }
        }

        if !searchText.isEmpty {
            listings = listings.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                $0.tags.contains(where: { $0.localizedCaseInsensitiveContains(searchText) })
            }
        }

        return listings
    }

    private var filteredCoops: [CoopProfile] {
        if searchText.isEmpty {
            return viewModel.coops
        }
        return viewModel.coops.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false) ||
            $0.industry.localizedCaseInsensitiveContains(searchText)
        }
    }
}

// MARK: - Tab Enum

enum MarketplaceTab: String, CaseIterable {
    case listings
    case coops
    case skills
    case resources
}

// MARK: - Listing Card View

struct ListingCardView: View {
    let listing: Listing

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Image placeholder
            ZStack {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .aspectRatio(4/3, contentMode: .fill)

                if let firstImage = listing.images.first {
                    AsyncImage(url: URL(string: firstImage)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Image(systemName: listing.type.icon)
                            .font(.title)
                            .foregroundColor(.secondary)
                    }
                } else {
                    Image(systemName: listing.type.icon)
                        .font(.title)
                        .foregroundColor(.secondary)
                }
            }
            .cornerRadius(8)
            .clipped()

            // Type badge
            Text(listing.type.displayName)
                .font(.caption2)
                .fontWeight(.medium)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.accentColor.opacity(0.15))
                .foregroundColor(.accentColor)
                .clipShape(Capsule())

            // Title
            Text(listing.title)
                .font(.subheadline)
                .fontWeight(.semibold)
                .lineLimit(2)

            // Price
            Text(listing.formattedPrice)
                .font(.headline)
                .foregroundColor(.accentColor)

            // Location
            if let location = listing.location {
                HStack(spacing: 4) {
                    Image(systemName: "mappin")
                        .font(.caption2)
                    Text(location.label)
                        .font(.caption)
                }
                .foregroundColor(.secondary)
                .lineLimit(1)
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.08), radius: 4, y: 2)
    }
}

// MARK: - Co-op Row

struct CoopRow: View {
    let coop: CoopProfile

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color(.systemGray4))
                    .frame(width: 48, height: 48)

                if let image = coop.image {
                    AsyncImage(url: URL(string: image)) { img in
                        img.resizable()
                            .aspectRatio(contentMode: .fill)
                            .clipShape(Circle())
                            .frame(width: 48, height: 48)
                    } placeholder: {
                        Text(String(coop.name.prefix(1)).uppercased())
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
                } else {
                    Text(String(coop.name.prefix(1)).uppercased())
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(coop.name)
                    .font(.headline)

                if !coop.industry.isEmpty {
                    Text(coop.industry)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                HStack(spacing: 12) {
                    Label("\(coop.memberCount)", systemImage: "person.2")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(coop.governanceModel.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if coop.vouchCount > 0 {
                        Label("\(coop.vouchCount)", systemImage: "checkmark.seal")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
                .font(.caption)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Type Filter Chip

struct TypeFilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color(.systemGray5))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

// MARK: - Empty State View

struct MarketplaceEmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - ViewModel

@MainActor
class MarketplaceViewModel: ObservableObject {
    let service: MarketplaceService

    @Published var listings: [Listing] = []
    @Published var coops: [CoopProfile] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedListing: Listing?

    init(service: MarketplaceService) {
        self.service = service
    }

    func loadListings() async {
        isLoading = true
        do {
            listings = try service.getListings(activeOnly: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadCoops() async {
        do {
            coops = try service.getCoopProfiles()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
