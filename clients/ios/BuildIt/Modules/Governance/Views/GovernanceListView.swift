// GovernanceListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main list view for proposals and voting.

import SwiftUI

// MARK: - Main List View

struct GovernanceListView: View {
    @ObservedObject var service: GovernanceService
    @State private var selectedTab = 0
    @State private var selectedType: ProposalType?
    @State private var showCreateProposal = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab selector
                Picker("View", selection: $selectedTab) {
                    Text("Active").tag(0)
                    Text("Completed").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                // Type filter
                TypeFilterRow(selectedType: $selectedType)

                // Content
                if service.isLoading {
                    Spacer()
                    ProgressView("Loading proposals...")
                    Spacer()
                } else {
                    let proposals = selectedTab == 0 ? service.activeProposals : service.completedProposals
                    let filtered = selectedType == nil ? proposals : proposals.filter { $0.type == selectedType }

                    if filtered.isEmpty {
                        emptyState
                    } else {
                        List(filtered) { proposal in
                            NavigationLink(destination: ProposalDetailView(proposal: proposal, service: service)) {
                                ProposalRow(proposal: proposal)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
            .navigationTitle("Governance")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showCreateProposal = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateProposal) {
                CreateProposalView(service: service, isPresented: $showCreateProposal)
            }
            .task {
                await service.refreshProposals()
            }
            .refreshable {
                await service.refreshProposals()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: selectedTab == 0 ? "checkmark.seal" : "archivebox")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(selectedTab == 0 ? "No Active Proposals" : "No Completed Proposals")
                .font(.title2)
                .fontWeight(.semibold)

            Text(selectedTab == 0 ? "Create a new proposal to start a group decision" : "Completed proposals will appear here")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if selectedTab == 0 {
                Button("Create Proposal") {
                    showCreateProposal = true
                }
                .buttonStyle(.borderedProminent)
                .padding(.top)
            }
        }
        .padding()
    }
}

// MARK: - Type Filter Row

struct TypeFilterRow: View {
    @Binding var selectedType: ProposalType?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(
                    title: "All",
                    isSelected: selectedType == nil
                ) {
                    selectedType = nil
                }

                ForEach(ProposalType.allCases, id: \.self) { type in
                    FilterChip(
                        title: type.displayName,
                        icon: type.icon,
                        isSelected: selectedType == type
                    ) {
                        selectedType = type
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 8)
    }
}

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
                    .font(.subheadline)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.2))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

// MARK: - Proposal Row

struct ProposalRow: View {
    let proposal: Proposal

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Type icon
                Image(systemName: proposal.type.icon)
                    .foregroundColor(.accentColor)
                    .font(.caption)

                Text(proposal.type.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                StatusBadge(status: proposal.status)
            }

            Text(proposal.title)
                .font(.headline)
                .lineLimit(2)

            if let description = proposal.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                // Voting system
                Label(proposal.votingSystem.displayName, systemImage: "hand.raised")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                // Time info
                if proposal.canVote {
                    let remaining = proposal.votingPeriod.remainingTime
                    Text(formatTimeRemaining(remaining))
                        .font(.caption)
                        .foregroundColor(.orange)
                } else if proposal.isInDiscussion {
                    Text("In Discussion")
                        .font(.caption)
                        .foregroundColor(.blue)
                } else {
                    Text(formatDate(proposal.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func formatTimeRemaining(_ interval: TimeInterval) -> String {
        let hours = Int(interval / 3600)
        let days = hours / 24

        if days > 0 {
            return "\(days)d left"
        } else if hours > 0 {
            return "\(hours)h left"
        } else {
            let minutes = Int(interval / 60)
            return "\(max(1, minutes))m left"
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: ProposalStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(textColor)
            .clipShape(Capsule())
    }

    private var backgroundColor: Color {
        switch status {
        case .draft: return Color.gray.opacity(0.2)
        case .discussion: return Color.blue.opacity(0.2)
        case .voting: return Color.orange.opacity(0.2)
        case .passed: return Color.green.opacity(0.2)
        case .rejected: return Color.red.opacity(0.2)
        case .expired, .withdrawn: return Color.gray.opacity(0.2)
        case .implemented: return Color.purple.opacity(0.2)
        }
    }

    private var textColor: Color {
        switch status {
        case .draft: return .gray
        case .discussion: return .blue
        case .voting: return .orange
        case .passed: return .green
        case .rejected: return .red
        case .expired, .withdrawn: return .gray
        case .implemented: return .purple
        }
    }
}

// MARK: - ViewModel

@MainActor
class GovernanceListViewModel: ObservableObject {
    let service: GovernanceService

    @Published var activeProposals: [Proposal] = []
    @Published var completedProposals: [Proposal] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    init(service: GovernanceService) {
        self.service = service
    }

    func loadProposals(groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let all = try await service.getProposals(groupId: groupId)
            activeProposals = all.filter { $0.status.isActive }
            completedProposals = all.filter { !$0.status.isActive }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
