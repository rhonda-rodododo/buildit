// MutualAidListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main view for browsing and managing mutual aid requests and offers.

import SwiftUI

// Import localization
private typealias Strings = L10n.MutualAid

/// Main mutual aid list view with tabs for requests and offers
public struct MutualAidListView: View {
    @StateObject private var viewModel: MutualAidViewModel
    @State private var selectedTab = 0
    @State private var showingCreateSheet = false
    @State private var selectedCategory: AidCategory?

    public init(service: MutualAidService) {
        _viewModel = StateObject(wrappedValue: MutualAidViewModel(service: service))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker
                Picker("mutualaid_view".localized, selection: $selectedTab) {
                    Text("mutualaid_requests".localized).tag(0)
                    Text("mutualaid_offers".localized).tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                // Category filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(
                            title: "common_all".localized,
                            isSelected: selectedCategory == nil
                        ) {
                            selectedCategory = nil
                        }

                        ForEach(AidCategory.allCases, id: \.self) { category in
                            FilterChip(
                                title: category.displayName,
                                icon: category.icon,
                                isSelected: selectedCategory == category
                            ) {
                                selectedCategory = category
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.bottom, 8)

                // Content
                if selectedTab == 0 {
                    RequestsListView(
                        requests: filteredRequests,
                        isLoading: viewModel.isLoading,
                        onRefresh: { await viewModel.loadRequests() },
                        onSelect: { request in viewModel.selectedRequest = request }
                    )
                } else {
                    OffersListView(
                        offers: filteredOffers,
                        isLoading: viewModel.isLoading,
                        onRefresh: { await viewModel.loadOffers() },
                        onSelect: { offer in viewModel.selectedOffer = offer }
                    )
                }
            }
            .navigationTitle(Strings.title)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingCreateSheet) {
                if selectedTab == 0 {
                    CreateRequestView(service: viewModel.service) {
                        showingCreateSheet = false
                        Task { await viewModel.loadRequests() }
                    }
                } else {
                    CreateOfferView(service: viewModel.service) {
                        showingCreateSheet = false
                        Task { await viewModel.loadOffers() }
                    }
                }
            }
            .sheet(item: $viewModel.selectedRequest) { request in
                RequestDetailView(request: request, service: viewModel.service)
            }
            .sheet(item: $viewModel.selectedOffer) { offer in
                OfferDetailView(offer: offer, service: viewModel.service)
            }
            .task {
                await viewModel.loadRequests()
                await viewModel.loadOffers()
            }
        }
    }

    private var filteredRequests: [AidRequest] {
        guard let category = selectedCategory else {
            return viewModel.requests
        }
        return viewModel.requests.filter { $0.category == category }
    }

    private var filteredOffers: [AidOffer] {
        guard let category = selectedCategory else {
            return viewModel.offers
        }
        return viewModel.offers.filter { $0.category == category }
    }
}

/// Filter chip component
struct FilterChip: View {
    let title: String
    var icon: String? = nil
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.caption)
                }
                Text(title)
                    .font(.caption)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color(.systemGray5))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

/// Requests list view
struct RequestsListView: View {
    let requests: [AidRequest]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onSelect: (AidRequest) -> Void

    var body: some View {
        Group {
            if isLoading && requests.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if requests.isEmpty {
                EmptyStateView(
                    icon: "hands.sparkles",
                    title: "mutualaid_noRequests".localized,
                    message: "mutualaid_createRequestHint".localized
                )
            } else {
                List {
                    ForEach(requests) { request in
                        RequestRow(request: request)
                            .onTapGesture { onSelect(request) }
                    }
                }
                .listStyle(.plain)
                .refreshable { await onRefresh() }
            }
        }
    }
}

/// Single request row
struct RequestRow: View {
    let request: AidRequest

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: request.category.icon)
                    .foregroundColor(.accentColor)

                Text(request.title)
                    .font(.headline)

                Spacer()

                UrgencyBadge(urgency: request.urgency)
            }

            if let description = request.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let location = request.location {
                    Label(location.displayString, systemImage: "location")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if request.quantityNeeded != nil {
                    ProgressView(value: request.progressPercentage)
                        .frame(width: 60)
                }

                Text(request.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Urgency badge
struct UrgencyBadge: View {
    let urgency: UrgencyLevel

    var body: some View {
        Text(urgency.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(urgencyColor.opacity(0.2))
            .foregroundColor(urgencyColor)
            .clipShape(Capsule())
    }

    private var urgencyColor: Color {
        switch urgency {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

/// Offers list view
struct OffersListView: View {
    let offers: [AidOffer]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onSelect: (AidOffer) -> Void

    var body: some View {
        Group {
            if isLoading && offers.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if offers.isEmpty {
                EmptyStateView(
                    icon: "gift",
                    title: "mutualaid_noOffers".localized,
                    message: "mutualaid_createOfferHint".localized
                )
            } else {
                List {
                    ForEach(offers) { offer in
                        OfferRow(offer: offer)
                            .onTapGesture { onSelect(offer) }
                    }
                }
                .listStyle(.plain)
                .refreshable { await onRefresh() }
            }
        }
    }
}

/// Single offer row
struct OfferRow: View {
    let offer: AidOffer

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: offer.category.icon)
                    .foregroundColor(.green)

                Text(offer.title)
                    .font(.headline)

                Spacer()

                if offer.isActive {
                    Text("mutualaid_available".localized)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.2))
                        .foregroundColor(.green)
                        .clipShape(Capsule())
                }
            }

            if let description = offer.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let location = offer.location {
                    Label(location.displayString, systemImage: "location")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let until = offer.availableUntil {
                    Text("mutualaid_until".localized) + Text(" \(until, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Empty state view
struct EmptyStateView: View {
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

/// ViewModel for the mutual aid list
@MainActor
class MutualAidViewModel: ObservableObject {
    let service: MutualAidService

    @Published var requests: [AidRequest] = []
    @Published var offers: [AidOffer] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedRequest: AidRequest?
    @Published var selectedOffer: AidOffer?

    init(service: MutualAidService) {
        self.service = service
    }

    func loadRequests() async {
        isLoading = true
        do {
            requests = try await service.getRequests(activeOnly: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadOffers() async {
        isLoading = true
        do {
            offers = try await service.getOffers(activeOnly: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
