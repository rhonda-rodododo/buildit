// QuadraticVotingView.swift
// BuildIt - Decentralized Mesh Communication
//
// Token allocation UI for quadratic voting.

import SwiftUI

/// View for allocating tokens across options in a quadratic vote.
///
/// Each voter gets a token budget. The cost of N effective votes = N^2 tokens.
/// This encourages spreading tokens across multiple options.
struct QuadraticVotingView: View {
    let options: [VoteOption]
    let config: QuadraticVotingConfig
    let onSubmit: (QuadraticBallot) -> Void
    let isSubmitting: Bool

    @State private var allocations: [String: Int] = [:]

    init(
        options: [VoteOption],
        config: QuadraticVotingConfig,
        isSubmitting: Bool = false,
        onSubmit: @escaping (QuadraticBallot) -> Void
    ) {
        self.options = options
        self.config = config
        self.isSubmitting = isSubmitting
        self.onSubmit = onSubmit
    }

    private var totalUsed: Int {
        allocations.values.reduce(0, +)
    }

    private var remaining: Int {
        config.tokenBudget - totalUsed
    }

    private var budgetPercentUsed: Double {
        Double(totalUsed) / Double(config.tokenBudget)
    }

    private var hasAnyAllocation: Bool {
        totalUsed > 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Budget overview
            budgetSection

            // How it works
            explanationSection

            // Option allocation controls
            ForEach(options.sorted(by: { $0.order < $1.order })) { option in
                optionAllocationRow(option: option)
            }

            // Submit button
            Button(action: submitBallot) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text(isSubmitting ? "governance_submitting".localized : "governance_submitQuadraticBallot".localized)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(canSubmit ? Color.accentColor : Color.gray)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(!canSubmit)
        }
        .onAppear {
            // Initialize allocations for all options
            for option in options {
                if allocations[option.id] == nil {
                    allocations[option.id] = 0
                }
            }
        }
    }

    // MARK: - Budget Section

    private var budgetSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("governance_tokenBudget".localized)
                    .font(.headline)

                Spacer()

                Text("\(totalUsed) / \(config.tokenBudget)")
                    .font(.subheadline)
                    .foregroundColor(remaining < 0 ? .red : .secondary)
            }

            ProgressView(value: min(budgetPercentUsed, 1.0))
                .tint(remaining < 0 ? .red : .accentColor)

            if remaining > 0 {
                Text("\(remaining) tokens remaining")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else if remaining < 0 {
                Text("Over budget! Please reduce allocations.")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Explanation Section

    private var explanationSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("governance_howQuadraticWorks".localized)
                .font(.caption)
                .fontWeight(.semibold)

            Text("1 token = 1 vote, 4 tokens = 2 votes, 9 tokens = 3 votes, 16 tokens = 4 votes")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Option Row

    private func optionAllocationRow(option: VoteOption) -> some View {
        let tokens = allocations[option.id] ?? 0
        let effectiveVotes = tokens > 0 ? sqrt(Double(tokens)) : 0

        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label)
                        .font(.headline)

                    if let desc = option.description {
                        Text(desc)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.2f votes", effectiveVotes))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)

                    Text("\(tokens) tokens")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            HStack(spacing: 12) {
                Button(action: {
                    updateAllocation(optionId: option.id, delta: -1)
                }) {
                    Image(systemName: "minus.circle.fill")
                        .font(.title2)
                        .foregroundColor(tokens > 0 ? .accentColor : .gray)
                }
                .disabled(tokens <= 0)

                TextField("0", value: Binding(
                    get: { allocations[option.id] ?? 0 },
                    set: { setAllocation(optionId: option.id, value: $0) }
                ), format: .number)
                .textFieldStyle(.roundedBorder)
                .frame(width: 80)
                .multilineTextAlignment(.center)
                .keyboardType(.numberPad)

                Button(action: {
                    updateAllocation(optionId: option.id, delta: 1)
                }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(remaining > 0 ? .accentColor : .gray)
                }
                .disabled(remaining <= 0)

                Spacer()

                // Quick preset buttons
                HStack(spacing: 4) {
                    ForEach([1, 4, 9, 16], id: \.self) { preset in
                        if preset <= config.tokenBudget {
                            Button("\(preset)") {
                                setAllocation(optionId: option.id, value: preset)
                            }
                            .font(.caption)
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Actions

    private var canSubmit: Bool {
        hasAnyAllocation && remaining >= 0 && !isSubmitting
    }

    private func updateAllocation(optionId: String, delta: Int) {
        let current = allocations[optionId] ?? 0
        setAllocation(optionId: optionId, value: current + delta)
    }

    private func setAllocation(optionId: String, value: Int) {
        let maxForOption = config.maxTokensPerOption ?? config.tokenBudget

        // Calculate how much room we have
        let otherAllocations = allocations
            .filter { $0.key != optionId }
            .values
            .reduce(0, +)

        let maxAllowable = min(maxForOption, config.tokenBudget - otherAllocations)
        let clamped = max(0, min(value, maxAllowable))

        allocations[optionId] = clamped
    }

    private func submitBallot() {
        var nonZero: [String: Int] = [:]
        for (optionId, tokens) in allocations {
            if tokens > 0 {
                nonZero[optionId] = tokens
            }
        }

        let ballot = QuadraticBallot(allocations: nonZero)
        onSubmit(ballot)
    }
}

// MARK: - Preview

#Preview {
    QuadraticVotingView(
        options: [
            VoteOption(id: "1", label: "Expand community garden", description: "Add 20 new plots", order: 0),
            VoteOption(id: "2", label: "Install solar panels", description: "Rooftop solar array", order: 1),
            VoteOption(id: "3", label: "Create tool library", description: "Shared community tools", order: 2),
        ],
        config: QuadraticVotingConfig(tokenBudget: 100),
        onSubmit: { ballot in
            print("Submitted ballot: \(ballot)")
        }
    )
    .padding()
}
