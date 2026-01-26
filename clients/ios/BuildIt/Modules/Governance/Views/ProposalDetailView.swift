// ProposalDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view for a proposal with voting interface.

import SwiftUI

// Import localization
private typealias Strings = L10n.Governance

struct ProposalDetailView: View {
    let proposal: Proposal
    @ObservedObject var service: GovernanceService
    @StateObject private var viewModel: ProposalDetailViewModel

    @State private var showVoteSheet = false
    @State private var selectedOption: String?
    @State private var voteComment = ""

    init(proposal: Proposal, service: GovernanceService) {
        self.proposal = proposal
        self.service = service
        self._viewModel = StateObject(wrappedValue: ProposalDetailViewModel(service: service, proposalId: proposal.id))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                headerSection

                Divider()

                // Description
                if let description = proposal.description {
                    descriptionSection(description)
                }

                Divider()

                // Voting info
                votingInfoSection

                Divider()

                // Current results
                if !viewModel.voteCounts.isEmpty {
                    resultsSection
                    Divider()
                }

                // Actions
                if proposal.canVote && !viewModel.hasVoted {
                    votingSection
                } else if viewModel.hasVoted {
                    votedSection
                }

                Spacer(minLength: 40)
            }
            .padding()
        }
        .navigationTitle("governance_proposal".localized)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadData()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: proposal.type.icon)
                    .foregroundColor(.accentColor)

                Text(proposal.type.displayName)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                StatusBadge(status: proposal.status)
            }

            Text(proposal.title)
                .font(.title2)
                .fontWeight(.bold)

            // Tags
            if !proposal.tags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(proposal.tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.secondary.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    // MARK: - Description Section

    private func descriptionSection(_ description: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("governance_description".localized)
                .font(.headline)

            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Voting Info Section

    private var votingInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("governance_votingDetails".localized)
                .font(.headline)

            VStack(spacing: 8) {
                InfoRow(icon: "hand.raised", title: "governance_votingSystem".localized, value: proposal.votingSystem.displayName)

                if let quorum = proposal.quorum, quorum.type != .none {
                    let quorumText = quorum.type == .percentage ? "\(Int(quorum.value ?? 0))%" : "\(Int(quorum.value ?? 0)) votes"
                    InfoRow(icon: "person.3", title: "governance_quorum".localized, value: quorumText)
                }

                if let threshold = proposal.threshold {
                    let thresholdText = threshold.type == .supermajority ? "governance_supermajority".localized : "governance_simpleMajority".localized
                    InfoRow(icon: "checkmark.circle", title: "governance_threshold".localized, value: thresholdText)
                }

                // Voting period
                InfoRow(
                    icon: "calendar",
                    title: "governance_votingPeriod".localized,
                    value: formatPeriod(proposal.votingPeriod)
                )

                if proposal.canVote {
                    InfoRow(
                        icon: "clock",
                        title: "governance_timeRemaining".localized,
                        value: formatTimeRemaining(proposal.votingPeriod.remainingTime),
                        valueColor: .orange
                    )
                }
            }
        }
    }

    // MARK: - Results Section

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("governance_currentResults".localized)
                .font(.headline)

            let totalVotes = viewModel.voteCounts.values.reduce(0, +)

            ForEach(proposal.options.sorted(by: { $0.order < $1.order })) { option in
                let count = viewModel.voteCounts[option.id] ?? 0
                let percentage = totalVotes > 0 ? Double(count) / Double(totalVotes) * 100 : 0

                VoteOptionBar(
                    option: option,
                    count: count,
                    percentage: percentage,
                    isLeading: count == viewModel.voteCounts.values.max()
                )
            }

            Text("governance_votesCast".localized(totalVotes))
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Voting Section

    private var votingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("governance_castYourVote".localized)
                .font(.headline)

            ForEach(proposal.options.sorted(by: { $0.order < $1.order })) { option in
                VoteOptionButton(
                    option: option,
                    isSelected: selectedOption == option.id
                ) {
                    selectedOption = option.id
                }
            }

            // Comment field
            VStack(alignment: .leading, spacing: 4) {
                Text("governance_commentOptional".localized)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                TextField("governance_addCommentPlaceholder".localized, text: $voteComment, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...6)
            }

            // Submit button
            Button(action: castVote) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text("governance_submitVote".localized)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(selectedOption == nil ? Color.gray : Color.accentColor)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(selectedOption == nil || viewModel.isSubmitting)
        }
    }

    // MARK: - Voted Section

    private var votedSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.green)

            Text("governance_youHaveVoted".localized)
                .font(.headline)

            if let userVote = viewModel.userVote,
               let optionId = userVote.choice.first,
               let option = proposal.options.first(where: { $0.id == optionId }) {
                Text("governance_yourVote".localized(option.label))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.green.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Actions

    private func castVote() {
        guard let optionId = selectedOption else { return }
        Task {
            await viewModel.castVote(choice: [optionId], comment: voteComment.isEmpty ? nil : voteComment)
        }
    }

    // MARK: - Helpers

    private func formatPeriod(_ period: TimePeriod) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return "\(formatter.string(from: period.startsAt)) - \(formatter.string(from: period.endsAt))"
    }

    private func formatTimeRemaining(_ interval: TimeInterval) -> String {
        let hours = Int(interval / 3600)
        let days = hours / 24

        if days > 0 {
            return "governance_daysRemaining".localized(days)
        } else if hours > 0 {
            return "governance_hoursRemaining".localized(hours)
        } else {
            let minutes = Int(interval / 60)
            return "governance_minutesRemaining".localized(max(1, minutes))
        }
    }
}

// MARK: - Supporting Views

struct InfoRow: View {
    let icon: String
    let title: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.secondary)
                .frame(width: 24)

            Text(title)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .fontWeight(.medium)
                .foregroundColor(valueColor)
        }
        .font(.subheadline)
    }
}

struct VoteOptionBar: View {
    let option: VoteOption
    let count: Int
    let percentage: Double
    let isLeading: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(option.label)
                    .font(.subheadline)
                    .fontWeight(isLeading ? .semibold : .regular)

                Spacer()

                Text("\(count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text(String(format: "%.1f%%", percentage))
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.2))
                        .frame(height: 8)

                    Rectangle()
                        .fill(barColor)
                        .frame(width: geometry.size.width * (percentage / 100), height: 8)
                }
                .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .frame(height: 8)
        }
    }

    private var barColor: Color {
        if let colorName = option.color {
            switch colorName {
            case "green": return .green
            case "red": return .red
            case "gray": return .gray
            case "blue": return .blue
            case "orange": return .orange
            default: return .accentColor
            }
        }
        return .accentColor
    }
}

struct VoteOptionButton: View {
    let option: VoteOption
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label)
                        .font(.headline)

                    if let description = option.description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                    .font(.title2)
            }
            .padding()
            .background(isSelected ? Color.accentColor.opacity(0.1) : Color.secondary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposalSizeProtocol, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        return layout(sizes: sizes, containerWidth: proposal.size.width).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposalSizeProtocol, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let offsets = layout(sizes: sizes, containerWidth: bounds.width).offsets

        for (offset, subview) in zip(offsets, subviews) {
            subview.place(at: CGPoint(x: bounds.minX + offset.x, y: bounds.minY + offset.y), proposal: .unspecified)
        }
    }

    private func layout(sizes: [CGSize], containerWidth: CGFloat) -> (offsets: [CGPoint], size: CGSize) {
        var offsets: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxWidth: CGFloat = 0

        for size in sizes {
            if currentX + size.width > containerWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            offsets.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            maxWidth = max(maxWidth, currentX)
        }

        return (offsets, CGSize(width: maxWidth, height: currentY + lineHeight))
    }
}

// MARK: - ViewModel

@MainActor
class ProposalDetailViewModel: ObservableObject {
    let service: GovernanceService
    let proposalId: String

    @Published var voteCounts: [String: Int] = [:]
    @Published var userVote: Vote?
    @Published var hasVoted = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    init(service: GovernanceService, proposalId: String) {
        self.service = service
        self.proposalId = proposalId
    }

    func loadData() async {
        do {
            voteCounts = try await service.getVoteCounts(proposalId: proposalId)

            // In production, get actual user ID
            let userId = "current-user-id"
            hasVoted = try await service.hasVoted(proposalId: proposalId, userId: userId)
            if hasVoted {
                userVote = try await service.getUserVote(proposalId: proposalId, userId: userId)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func castVote(choice: [String], comment: String?) async {
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            // In production, get actual user ID
            let userId = "current-user-id"
            userVote = try await service.castVote(
                proposalId: proposalId,
                voterId: userId,
                choice: choice,
                comment: comment
            )
            hasVoted = true
            voteCounts = try await service.getVoteCounts(proposalId: proposalId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
