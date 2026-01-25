// EventDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view for a single event with RSVP functionality.

import SwiftUI

/// Detailed view for an event
public struct EventDetailView: View {
    let event: EventEntity
    let service: EventsService
    @ObservedObject var store: EventsStore

    @Environment(\.dismiss) private var dismiss
    @State private var currentRsvp: Rsvp?
    @State private var rsvpCounts: (going: Int, maybe: Int, notGoing: Int) = (0, 0, 0)
    @State private var showRsvpSheet = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    public init(event: EventEntity, service: EventsService, store: EventsStore) {
        self.event = event
        self.service = service
        self.store = store
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    eventHeader

                    Divider()

                    // Details
                    eventDetails

                    if let description = event.eventDescription {
                        Divider()
                        eventDescription(description)
                    }

                    if event.locationName != nil || event.virtualURL != nil {
                        Divider()
                        locationSection
                    }

                    Divider()

                    // RSVP section
                    rsvpSection
                }
                .padding()
            }
            .navigationTitle("Event Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showRsvpSheet) {
                RSVPView(event: event, service: service, currentRsvp: currentRsvp) { newRsvp in
                    currentRsvp = newRsvp
                    loadRsvpData()
                }
            }
            .task {
                await loadData()
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let error = errorMessage {
                    Text(error)
                }
            }
        }
    }

    private var eventHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.title)
                .font(.title)
                .fontWeight(.bold)

            HStack(spacing: 16) {
                Label(
                    event.startAt.formatted(date: .abbreviated, time: .shortened),
                    systemImage: "calendar"
                )

                if let endAt = event.endAt {
                    Text("to")
                        .foregroundColor(.secondary)
                    Label(
                        endAt.formatted(date: .abbreviated, time: .shortened),
                        systemImage: "calendar"
                    )
                }
            }
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
    }

    private var eventDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            DetailRow(icon: "person.fill", title: "Organizer", value: event.createdBy.prefix(8) + "...")

            if let timezone = event.timezone {
                DetailRow(icon: "clock.fill", title: "Timezone", value: timezone)
            }

            if let maxAttendees = event.maxAttendees {
                DetailRow(icon: "person.3.fill", title: "Capacity", value: "\(maxAttendees) people")
            }

            if let rsvpDeadline = event.rsvpDeadline {
                DetailRow(
                    icon: "clock.badge.checkmark",
                    title: "RSVP By",
                    value: rsvpDeadline.formatted(date: .abbreviated, time: .shortened)
                )
            }
        }
    }

    private func eventDescription(_ description: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Description")
                .font(.headline)
            Text(description)
                .font(.body)
        }
    }

    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Location")
                .font(.headline)

            if let locationName = event.locationName {
                HStack(spacing: 8) {
                    Image(systemName: "mappin.circle.fill")
                        .foregroundColor(.red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(locationName)
                            .font(.body)
                        if let address = event.locationAddress {
                            Text(address)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            if let virtualURL = event.virtualURL {
                Link(destination: URL(string: virtualURL)!) {
                    HStack {
                        Image(systemName: "video.fill")
                        Text("Join Virtual Meeting")
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var rsvpSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Attendance")
                .font(.headline)

            // RSVP counts
            HStack(spacing: 20) {
                RSVPCountBadge(icon: "checkmark.circle.fill", count: rsvpCounts.going, label: "Going", color: .green)
                RSVPCountBadge(icon: "questionmark.circle.fill", count: rsvpCounts.maybe, label: "Maybe", color: .orange)
                RSVPCountBadge(icon: "xmark.circle.fill", count: rsvpCounts.notGoing, label: "Can't Go", color: .gray)
            }

            // Current RSVP status
            if let rsvp = currentRsvp {
                HStack {
                    Text("Your response:")
                        .foregroundColor(.secondary)
                    Text(rsvp.status.rawValue.capitalized)
                        .fontWeight(.semibold)
                    Spacer()
                    Button("Change") {
                        showRsvpSheet = true
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)
            } else {
                Button {
                    showRsvpSheet = true
                } label: {
                    HStack {
                        Image(systemName: "calendar.badge.plus")
                        Text("RSVP to Event")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            currentRsvp = try await service.getUserRsvp(eventId: event.id)
            loadRsvpData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadRsvpData() {
        Task {
            do {
                rsvpCounts = try await service.getRsvpCounts(eventId: event.id)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct DetailRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 24)
            Text(title)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

struct RSVPCountBadge: View {
    let icon: String
    let count: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            Text("\(count)")
                .font(.title2)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}
