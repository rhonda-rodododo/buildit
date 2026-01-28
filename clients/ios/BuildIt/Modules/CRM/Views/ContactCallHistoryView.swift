// ContactCallHistoryView.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI view for displaying call history for a contact.
// Part of the CRM-Calling integration.

import SwiftUI

/// View displaying call history for a contact
public struct ContactCallHistoryView: View {
    let contactId: String
    let integration: CRMCallingIntegration

    @State private var calls: [CallHistoryRecord] = []
    @State private var stats: ContactCallStats = .empty
    @State private var isLoading: Bool = true
    @State private var selectedCall: CallHistoryRecord?
    @State private var filterDirection: CallDirection?
    @State private var error: String?

    public init(contactId: String, integration: CRMCallingIntegration) {
        self.contactId = contactId
        self.integration = integration
    }

    public var body: some View {
        VStack(spacing: 0) {
            statsHeader

            filterBar

            if isLoading {
                loadingView
            } else if calls.isEmpty {
                emptyView
            } else {
                callsList
            }
        }
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
        .sheet(item: $selectedCall) { call in
            CallDetailSheet(call: call, integration: integration)
        }
    }

    // MARK: - Subviews

    private var statsHeader: some View {
        HStack(spacing: 24) {
            StatItem(
                title: "Total Calls",
                value: "\(stats.totalCalls)",
                icon: "phone.fill"
            )

            StatItem(
                title: "Inbound",
                value: "\(stats.inboundCalls)",
                icon: "phone.arrow.down.left"
            )

            StatItem(
                title: "Outbound",
                value: "\(stats.outboundCalls)",
                icon: "phone.arrow.up.right"
            )

            StatItem(
                title: "Total Time",
                value: stats.formattedTotalDuration,
                icon: "clock"
            )
        }
        .padding()
        .background(Color(.systemGray6))
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(
                    title: "All",
                    isSelected: filterDirection == nil
                ) {
                    filterDirection = nil
                    Task { await loadData() }
                }

                FilterChip(
                    title: "Inbound",
                    isSelected: filterDirection == .inbound,
                    icon: "phone.arrow.down.left"
                ) {
                    filterDirection = .inbound
                    Task { await loadData() }
                }

                FilterChip(
                    title: "Outbound",
                    isSelected: filterDirection == .outbound,
                    icon: "phone.arrow.up.right"
                ) {
                    filterDirection = .outbound
                    Task { await loadData() }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }

    private var callsList: some View {
        List(calls) { call in
            CallHistoryRow(call: call)
                .contentShape(Rectangle())
                .onTapGesture {
                    selectedCall = call
                }
        }
        .listStyle(.plain)
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading call history...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyView: some View {
        ContentUnavailableView(
            "No Calls",
            systemImage: "phone.slash",
            description: Text("No call history found for this contact.")
        )
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let options = CallHistoryOptions(direction: filterDirection)
            calls = try await integration.getContactCallHistory(
                contactId: contactId,
                options: options
            )
            stats = try await integration.getContactCallStats(contactId: contactId)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Call History Row

/// Single row in the call history list
struct CallHistoryRow: View {
    let call: CallHistoryRecord

    var body: some View {
        HStack(spacing: 12) {
            // Direction icon
            Image(systemName: call.direction.icon)
                .foregroundColor(iconColor)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(call.phoneNumber)
                    .font(.body)

                HStack(spacing: 8) {
                    Text(call.startedAt, style: .date)
                    Text(call.startedAt, style: .time)
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    if call.hasRecording {
                        Image(systemName: "waveform")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }

                    Image(systemName: call.status.icon)
                        .foregroundColor(statusColor)
                }

                Text(call.formattedDuration)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var iconColor: Color {
        switch call.direction {
        case .inbound:
            return .green
        case .outbound:
            return .blue
        }
    }

    private var statusColor: Color {
        switch call.status {
        case .completed:
            return .green
        case .missed:
            return .red
        case .voicemail:
            return .orange
        case .failed:
            return .gray
        }
    }
}

// MARK: - Call Detail Sheet

/// Detail view for a single call
struct CallDetailSheet: View {
    let call: CallHistoryRecord
    let integration: CRMCallingIntegration

    @Environment(\.dismiss) private var dismiss
    @State private var notes: String = ""
    @State private var isSaving: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Phone", value: call.phoneNumber)
                    LabeledContent("Direction", value: call.direction.displayName)
                    LabeledContent("Status", value: call.status.displayName)
                    LabeledContent("Duration", value: call.formattedDuration)
                }

                Section("Time") {
                    LabeledContent("Started", value: call.startedAt.formatted())
                    if let endedAt = call.endedAt {
                        LabeledContent("Ended", value: endedAt.formatted())
                    }
                }

                if call.hasRecording {
                    Section("Recording") {
                        Button {
                            // Play recording
                        } label: {
                            Label("Play Recording", systemImage: "play.circle")
                        }

                        if call.hasTranscript {
                            Button {
                                // View transcript
                            } label: {
                                Label("View Transcript", systemImage: "doc.text")
                            }
                        }
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle("Call Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveNotes()
                    }
                    .disabled(isSaving || notes == call.notes)
                }
            }
            .onAppear {
                notes = call.notes ?? ""
            }
        }
    }

    private func saveNotes() {
        isSaving = true

        Task {
            try? await integration.addCallNotes(
                contactId: call.contactId,
                callId: call.id,
                notes: notes
            )
            isSaving = false
            dismiss()
        }
    }
}

// MARK: - Supporting Views

struct StatItem: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(.secondary)

            Text(value)
                .font(.headline)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    var icon: String? = nil
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
            .background(isSelected ? Color.accentColor : Color(.systemGray5))
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Call History") {
    struct PreviewWrapper: View {
        var body: some View {
            NavigationStack {
                ContactCallHistoryView(
                    contactId: "test-contact",
                    integration: CRMCallingIntegration()
                )
                .navigationTitle("Call History")
            }
        }
    }

    return PreviewWrapper()
}
