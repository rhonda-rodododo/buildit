// CampaignsListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main view for browsing and managing fundraising campaigns.

import SwiftUI

// Import localization
private typealias Strings = L10n.Fundraising

/// Main campaigns list view
public struct CampaignsListView: View {
    @StateObject private var viewModel: CampaignsViewModel
    @State private var showingCreateSheet = false
    @State private var filterStatus: CampaignStatus?
    @State private var searchText = ""

    public init(service: FundraisingService) {
        _viewModel = StateObject(wrappedValue: CampaignsViewModel(service: service))
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Status filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        StatusFilterChip(
                            title: "common_all".localized,
                            isSelected: filterStatus == nil
                        ) {
                            filterStatus = nil
                        }

                        ForEach([CampaignStatus.active, .draft, .completed], id: \.self) { status in
                            StatusFilterChip(
                                title: status.displayName,
                                color: statusColor(status),
                                isSelected: filterStatus == status
                            ) {
                                filterStatus = status
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)

                // Campaigns list
                if viewModel.isLoading && viewModel.campaigns.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredCampaigns.isEmpty {
                    FundraisingEmptyStateView(
                        icon: "dollarsign.circle",
                        title: "fundraising_noCampaigns".localized,
                        message: "fundraising_startCampaignHint".localized
                    )
                } else {
                    List {
                        ForEach(filteredCampaigns) { campaign in
                            CampaignRow(campaign: campaign)
                                .onTapGesture {
                                    viewModel.selectedCampaign = campaign
                                }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await viewModel.loadCampaigns()
                    }
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
            .searchable(text: $searchText, prompt: Text("fundraising_searchPlaceholder".localized))
            .sheet(isPresented: $showingCreateSheet) {
                CreateCampaignView(service: viewModel.service) {
                    showingCreateSheet = false
                    Task { await viewModel.loadCampaigns() }
                }
            }
            .sheet(item: $viewModel.selectedCampaign) { campaign in
                CampaignDetailView(campaign: campaign, service: viewModel.service)
            }
            .task {
                await viewModel.loadCampaigns()
            }
        }
    }

    private var filteredCampaigns: [Campaign] {
        var campaigns = viewModel.campaigns

        if let status = filterStatus {
            campaigns = campaigns.filter { $0.status == status }
        }

        if !searchText.isEmpty {
            campaigns = campaigns.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                ($0.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        return campaigns
    }

    private func statusColor(_ status: CampaignStatus) -> Color {
        switch status {
        case .draft: return .gray
        case .active: return .green
        case .paused: return .yellow
        case .completed: return .blue
        case .cancelled: return .red
        }
    }
}

/// Status filter chip
struct StatusFilterChip: View {
    let title: String
    var color: Color = .accentColor
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? color : Color(.systemGray5))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}

/// Campaign row
struct CampaignRow: View {
    let campaign: Campaign

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(campaign.title)
                        .font(.headline)

                    if let creatorName = campaign.creatorName {
                        Text("fundraising_by".localized(creatorName))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                CampaignStatusBadge(status: campaign.status)
            }

            // Description
            if let description = campaign.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            // Progress
            VStack(spacing: 4) {
                CampaignProgressBar(progress: campaign.progressPercentage)

                HStack {
                    Text(formatCurrency(campaign.raised, currency: campaign.currency))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.accentColor)

                    Text("fundraising_raisedOf".localized(formatCurrency(campaign.goal, currency: campaign.currency)))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    if let days = campaign.daysRemaining {
                        Label("fundraising_daysLeft".localized(days), systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Stats
            HStack(spacing: 16) {
                Label("\(campaign.donorCount)", systemImage: "person.2")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if campaign.cryptoPayment?.hasAnyAddress == true {
                    Label("Crypto", systemImage: "bitcoinsign.circle")
                        .font(.caption)
                        .foregroundColor(.orange)
                }

                Spacer()

                Text(campaign.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 8)
    }

    private func formatCurrency(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Campaign status badge
struct CampaignStatusBadge: View {
    let status: CampaignStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch status {
        case .draft: return .gray
        case .active: return .green
        case .paused: return .yellow
        case .completed: return .blue
        case .cancelled: return .red
        }
    }
}

/// Campaign progress bar
struct CampaignProgressBar: View {
    let progress: Double

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .frame(height: 8)
                    .cornerRadius(4)

                Rectangle()
                    .fill(progressColor)
                    .frame(width: geometry.size.width * progress, height: 8)
                    .cornerRadius(4)
            }
        }
        .frame(height: 8)
    }

    private var progressColor: Color {
        if progress >= 1.0 {
            return .green
        } else if progress >= 0.75 {
            return .accentColor
        } else if progress >= 0.5 {
            return .blue
        } else {
            return .orange
        }
    }
}

/// Empty state view for fundraising
struct FundraisingEmptyStateView: View {
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

/// ViewModel for campaigns list
@MainActor
class CampaignsViewModel: ObservableObject {
    let service: FundraisingService

    @Published var campaigns: [Campaign] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedCampaign: Campaign?

    init(service: FundraisingService) {
        self.service = service
    }

    func loadCampaigns() async {
        isLoading = true
        do {
            campaigns = try await service.getCampaigns()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
