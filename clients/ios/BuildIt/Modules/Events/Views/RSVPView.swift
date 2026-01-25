// RSVPView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for submitting or updating an RSVP.

import SwiftUI

/// View for RSVP submission
public struct RSVPView: View {
    let event: EventEntity
    let service: EventsService
    let currentRsvp: Rsvp?
    let onComplete: (Rsvp) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedStatus: Status
    @State private var guestCount = ""
    @State private var note = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    public init(
        event: EventEntity,
        service: EventsService,
        currentRsvp: Rsvp?,
        onComplete: @escaping (Rsvp) -> Void
    ) {
        self.event = event
        self.service = service
        self.currentRsvp = currentRsvp
        self.onComplete = onComplete
        _selectedStatus = State(initialValue: currentRsvp?.status ?? .maybe)
        _guestCount = State(initialValue: currentRsvp?.guestCount.map { String($0) } ?? "")
        _note = State(initialValue: currentRsvp?.note ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Your Response") {
                    Picker("Status", selection: $selectedStatus) {
                        Label("Going", systemImage: "checkmark.circle.fill")
                            .tag(Status.going)
                        Label("Maybe", systemImage: "questionmark.circle.fill")
                            .tag(Status.maybe)
                        Label("Can't Go", systemImage: "xmark.circle.fill")
                            .tag(Status.notGoing)
                    }
                    .pickerStyle(.segmented)
                }

                if selectedStatus == .going {
                    Section("Additional Guests") {
                        TextField("Number of guests", text: $guestCount)
                            .keyboardType(.numberPad)

                        Text("Including yourself")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Section("Note (Optional)") {
                    TextField("Add a note", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let maxAttendees = event.maxAttendees {
                    Section {
                        Text("This event has a capacity limit of \(maxAttendees) attendees.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if let rsvpDeadline = event.rsvpDeadline {
                    Section {
                        if rsvpDeadline > Date() {
                            Text("RSVP by \(rsvpDeadline.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            Text("RSVP deadline has passed")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                }
            }
            .navigationTitle("RSVP")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Submit") {
                        submitRsvp()
                    }
                    .disabled(isSubmitting)
                }
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

    private func submitRsvp() {
        isSubmitting = true

        Task {
            defer { isSubmitting = false }

            do {
                let guestCountInt = Int(guestCount)

                let rsvp = try await service.rsvp(
                    eventId: event.id,
                    status: selectedStatus,
                    guestCount: guestCountInt,
                    note: note.isEmpty ? nil : note
                )

                onComplete(rsvp)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
