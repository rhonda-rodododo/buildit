// CreateProposalView.swift
// BuildIt - Decentralized Mesh Communication
//
// Form for creating new proposals.

import SwiftUI

struct CreateProposalView: View {
    @ObservedObject var service: GovernanceService
    @Binding var isPresented: Bool

    @State private var title = ""
    @State private var description = ""
    @State private var selectedType: ProposalType = .general
    @State private var votingSystem: VotingSystem = .simpleMajority
    @State private var votingDuration = 7
    @State private var includeDiscussion = false
    @State private var discussionDuration = 3
    @State private var useCustomOptions = false
    @State private var customOptions: [CustomOption] = [
        CustomOption(label: "Option 1"),
        CustomOption(label: "Option 2")
    ]
    @State private var allowAbstain = true
    @State private var tags = ""

    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                // Basic Info
                Section("Basic Information") {
                    TextField("Title", text: $title)

                    VStack(alignment: .leading) {
                        Text("Description")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        TextEditor(text: $description)
                            .frame(minHeight: 100)
                    }

                    Picker("Type", selection: $selectedType) {
                        ForEach(ProposalType.allCases, id: \.self) { type in
                            Label(type.displayName, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                }

                // Voting Configuration
                Section("Voting Configuration") {
                    Picker("Voting System", selection: $votingSystem) {
                        ForEach([VotingSystem.simpleMajority, .supermajority, .approval], id: \.self) { system in
                            VStack(alignment: .leading) {
                                Text(system.displayName)
                            }
                            .tag(system)
                        }
                    }

                    Toggle("Include Discussion Period", isOn: $includeDiscussion)

                    if includeDiscussion {
                        Stepper("Discussion: \(discussionDuration) day\(discussionDuration == 1 ? "" : "s")", value: $discussionDuration, in: 1...30)
                    }

                    Stepper("Voting: \(votingDuration) day\(votingDuration == 1 ? "" : "s")", value: $votingDuration, in: 1...30)
                }

                // Options
                Section("Voting Options") {
                    Toggle("Use Custom Options", isOn: $useCustomOptions)

                    if useCustomOptions {
                        ForEach($customOptions) { $option in
                            HStack {
                                TextField("Option", text: $option.label)

                                Button(action: { removeOption(option) }) {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundColor(.red)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Button(action: addOption) {
                            Label("Add Option", systemImage: "plus.circle")
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Default options: Yes, No" + (allowAbstain ? ", Abstain" : ""))
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            Toggle("Allow Abstain", isOn: $allowAbstain)
                        }
                    }
                }

                // Tags
                Section("Tags (optional)") {
                    TextField("budget, policy, urgent (comma-separated)", text: $tags)
                        .textInputAutocapitalization(.never)
                }

                // Preview
                Section("Preview") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: selectedType.icon)
                                .foregroundColor(.accentColor)
                            Text(selectedType.displayName)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Text(title.isEmpty ? "Proposal Title" : title)
                            .font(.headline)
                            .foregroundColor(title.isEmpty ? .secondary : .primary)

                        HStack {
                            Label(votingSystem.displayName, systemImage: "hand.raised")
                            Spacer()
                            if includeDiscussion {
                                Text("\(discussionDuration)d discussion + \(votingDuration)d voting")
                            } else {
                                Text("\(votingDuration) day voting")
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New Proposal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createProposal()
                    }
                    .fontWeight(.semibold)
                    .disabled(!isValid || isSubmitting)
                }
            }
        }
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        (!useCustomOptions || customOptions.count >= 2)
    }

    private func addOption() {
        customOptions.append(CustomOption(label: "Option \(customOptions.count + 1)"))
    }

    private func removeOption(_ option: CustomOption) {
        customOptions.removeAll { $0.id == option.id }
    }

    private func createProposal() {
        guard isValid else { return }

        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                let options: [VoteOption]?
                if useCustomOptions {
                    options = customOptions.enumerated().map { index, opt in
                        VoteOption(label: opt.label, order: index)
                    }
                } else {
                    var defaultOptions = [
                        VoteOption(id: "yes", label: "Yes", description: "Vote in favor", color: "green", order: 0),
                        VoteOption(id: "no", label: "No", description: "Vote against", color: "red", order: 1)
                    ]
                    if allowAbstain {
                        defaultOptions.append(VoteOption(id: "abstain", label: "Abstain", description: "Neither for nor against", color: "gray", order: 2))
                    }
                    options = defaultOptions
                }

                let parsedTags = tags
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }

                _ = try await service.createProposal(
                    groupId: "default-group", // In production, get from context
                    title: title.trimmingCharacters(in: .whitespaces),
                    description: description.isEmpty ? nil : description,
                    type: selectedType,
                    votingSystem: votingSystem,
                    options: options,
                    discussionPeriod: includeDiscussion ? createDiscussionPeriod() : nil,
                    votingPeriod: createVotingPeriod(),
                    allowAbstain: allowAbstain,
                    createdBy: "current-user-id", // In production, get from identity
                    tags: parsedTags
                )

                await MainActor.run {
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmitting = false
                }
            }
        }
    }

    private func createDiscussionPeriod() -> TimePeriod {
        let start = Date()
        let end = Calendar.current.date(byAdding: .day, value: discussionDuration, to: start)!
        return TimePeriod(startsAt: start, endsAt: end)
    }

    private func createVotingPeriod() -> TimePeriod {
        let start: Date
        if includeDiscussion {
            start = Calendar.current.date(byAdding: .day, value: discussionDuration, to: Date())!
        } else {
            start = Date()
        }
        let end = Calendar.current.date(byAdding: .day, value: votingDuration, to: start)!
        return TimePeriod(startsAt: start, endsAt: end)
    }
}

// MARK: - Custom Option Model

struct CustomOption: Identifiable {
    let id = UUID()
    var label: String
}

// MARK: - Preview

#Preview {
    CreateProposalView(
        service: try! GovernanceService(store: GovernanceStore()),
        isPresented: .constant(true)
    )
}
