// EventJoinButton.swift
// BuildIt - Decentralized Mesh Communication
//
// Join button component for virtual events.
// Part of the Events-Calling integration.

import SwiftUI

/// Button to join a virtual event conference
public struct EventJoinButton: View {
    let event: EventEntity
    let integration: EventCallingIntegration
    let onJoin: ((String) -> Void)?

    @State private var isLoading: Bool = false
    @State private var error: String?

    public init(
        event: EventEntity,
        integration: EventCallingIntegration,
        onJoin: ((String) -> Void)? = nil
    ) {
        self.event = event
        self.integration = integration
        self.onJoin = onJoin
    }

    public var body: some View {
        Group {
            if let error = error {
                errorView(error)
            } else if let conference = integration.getConferenceRoom(eventId: event.id) {
                activeConferenceView(conference)
            } else if event.hasVirtualAttendance {
                pendingConferenceView
            } else {
                EmptyView()
            }
        }
    }

    // MARK: - Subviews

    private func activeConferenceView(_ conference: EventConferenceRoom) -> some View {
        VStack(spacing: 12) {
            Button {
                onJoin?(conference.joinUrl)
            } label: {
                HStack {
                    Image(systemName: "video.fill")
                    Text("Join Virtual Event")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)

            HStack(spacing: 16) {
                Label(
                    "\(conference.participantCount) participants",
                    systemImage: "person.2.fill"
                )
                .font(.caption)
                .foregroundColor(.secondary)

                if conference.isActive {
                    Label("Live", systemImage: "circle.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var pendingConferenceView: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "video")
                Text("Virtual Event")
            }
            .font(.headline)

            if let config = event.virtualConfig {
                Text("Conference will open \(config.autoStartMinutes) minutes before the event")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            countdownView
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var countdownView: some View {
        Group {
            let timeUntilStart = event.startAt.timeIntervalSinceNow
            let autoStartMinutes = event.virtualConfig?.autoStartMinutes ?? 15
            let timeUntilConference = timeUntilStart - TimeInterval(autoStartMinutes * 60)

            if timeUntilConference > 0 {
                VStack(spacing: 4) {
                    Text("Conference opens in")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(formatTimeInterval(timeUntilConference))
                        .font(.title3)
                        .monospacedDigit()
                        .fontWeight(.semibold)
                }
            } else if timeUntilStart > 0 {
                VStack(spacing: 4) {
                    Text("Event starts in")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(formatTimeInterval(timeUntilStart))
                        .font(.title3)
                        .monospacedDigit()
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 8) {
            Label(message, systemImage: "exclamationmark.triangle")
                .font(.caption)
                .foregroundColor(.orange)

            Button("Retry") {
                error = nil
            }
            .font(.caption)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    // MARK: - Helpers

    private func formatTimeInterval(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = Int(interval) / 60 % 60
        let seconds = Int(interval) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
}

// MARK: - Compact Join Button

/// Compact version of the join button for list views
public struct CompactEventJoinButton: View {
    let event: EventEntity
    let integration: EventCallingIntegration
    let onJoin: ((String) -> Void)?

    public init(
        event: EventEntity,
        integration: EventCallingIntegration,
        onJoin: ((String) -> Void)? = nil
    ) {
        self.event = event
        self.integration = integration
        self.onJoin = onJoin
    }

    public var body: some View {
        if let conference = integration.getConferenceRoom(eventId: event.id), conference.isActive {
            Button {
                onJoin?(conference.joinUrl)
            } label: {
                Label("Join", systemImage: "video.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .controlSize(.small)
        } else if event.hasVirtualAttendance {
            Label("Virtual", systemImage: "video")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Event Conference Status Badge

/// Badge showing the conference status for an event
public struct EventConferenceStatusBadge: View {
    let event: EventEntity
    let integration: EventCallingIntegration

    public init(event: EventEntity, integration: EventCallingIntegration) {
        self.event = event
        self.integration = integration
    }

    public var body: some View {
        if let conference = integration.getConferenceRoom(eventId: event.id) {
            HStack(spacing: 4) {
                Circle()
                    .fill(conference.isActive ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)

                Text(conference.isActive ? "Live" : "Starting...")
                    .font(.caption2)
                    .foregroundColor(conference.isActive ? .green : .orange)

                if conference.isActive && conference.participantCount > 0 {
                    Text("\(conference.participantCount)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(conference.isActive ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
            )
        } else if event.hasVirtualAttendance {
            HStack(spacing: 4) {
                Image(systemName: "video")
                    .font(.caption2)
                Text("Virtual")
                    .font(.caption2)
            }
            .foregroundColor(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.secondary.opacity(0.1))
            )
        }
    }
}

// MARK: - Preview

#Preview("Join Button States") {
    struct PreviewWrapper: View {
        var body: some View {
            ScrollView {
                VStack(spacing: 24) {
                    // These would use actual event data in real usage
                    Text("Active Conference")
                        .font(.headline)

                    Text("Pending Conference")
                        .font(.headline)

                    Text("Status Badges")
                        .font(.headline)
                }
                .padding()
            }
        }
    }

    return PreviewWrapper()
}
