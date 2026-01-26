// RSVPView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for submitting or updating an RSVP.

import SwiftUI

// Import localization
private typealias Strings = L10n.Events

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
                Section("events_yourResponseTitle".localized) {
                    Picker("events_status".localized, selection: $selectedStatus) {
                        Label("events_going".localized, systemImage: "checkmark.circle.fill")
                            .tag(Status.going)
                        Label("events_maybe".localized, systemImage: "questionmark.circle.fill")
                            .tag(Status.maybe)
                        Label("events_cantGo".localized, systemImage: "xmark.circle.fill")
                            .tag(Status.notGoing)
                    }
                    .pickerStyle(.segmented)
                }

                if selectedStatus == .going {
                    Section("events_additionalGuests".localized) {
                        TextField("events_numberOfGuests".localized, text: $guestCount)
                            .keyboardType(.numberPad)

                        Text("events_includingYourself".localized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Section("events_noteOptional".localized) {
                    TextField("events_addNote".localized, text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let maxAttendees = event.maxAttendees {
                    Section {
                        Text("events_capacityLimit".localized(maxAttendees))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if let rsvpDeadline = event.rsvpDeadline {
                    Section {
                        if rsvpDeadline > Date() {
                            Text("events_rsvpBy".localized + " " + rsvpDeadline.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            Text("events_rsvpDeadlinePassed".localized)
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                }
            }
            .navigationTitle("events_rsvp".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(L10n.Common.cancel) {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("events_submit".localized) {
                        submitRsvp()
                    }
                    .disabled(isSubmitting)
                }
            }
            .alert(L10n.Common.error, isPresented: .constant(errorMessage != nil)) {
                Button("common_ok".localized) {
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
