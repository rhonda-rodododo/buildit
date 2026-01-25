// CreateEventView.swift
// BuildIt - Decentralized Mesh Communication
//
// Form for creating a new event.

import SwiftUI

/// View for creating a new event
public struct CreateEventView: View {
    let service: EventsService
    @ObservedObject var store: EventsStore

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var startDate = Date()
    @State private var endDate = Date().addingTimeInterval(3600)
    @State private var allDay = false
    @State private var locationName = ""
    @State private var locationAddress = ""
    @State private var virtualURL = ""
    @State private var maxAttendees = ""
    @State private var hasRsvpDeadline = false
    @State private var rsvpDeadline = Date()

    @State private var isCreating = false
    @State private var errorMessage: String?

    public init(service: EventsService, store: EventsStore) {
        self.service = service
        self.store = store
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Event Details") {
                    TextField("Title", text: $title)

                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Date & Time") {
                    DatePicker("Starts", selection: $startDate)

                    DatePicker("Ends", selection: $endDate)

                    Toggle("All Day Event", isOn: $allDay)
                }

                Section("Location") {
                    TextField("Location Name", text: $locationName)

                    TextField("Address", text: $locationAddress, axis: .vertical)
                        .lineLimit(2...4)

                    TextField("Virtual Meeting URL", text: $virtualURL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }

                Section("RSVP Settings") {
                    TextField("Max Attendees (optional)", text: $maxAttendees)
                        .keyboardType(.numberPad)

                    Toggle("Set RSVP Deadline", isOn: $hasRsvpDeadline)

                    if hasRsvpDeadline {
                        DatePicker("RSVP By", selection: $rsvpDeadline)
                    }
                }
            }
            .navigationTitle("Create Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isCreating)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        createEvent()
                    }
                    .disabled(title.isEmpty || isCreating)
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

    private func createEvent() {
        isCreating = true

        Task {
            defer { isCreating = false }

            do {
                let location: LocationClass? = locationName.isEmpty ? nil : LocationClass(
                    address: locationAddress.isEmpty ? nil : locationAddress,
                    coordinates: nil,
                    instructions: nil,
                    name: locationName
                )

                let maxAttendeesInt = Int(maxAttendees)

                _ = try await service.createEvent(
                    title: title,
                    description: description.isEmpty ? nil : description,
                    startAt: startDate,
                    endAt: endDate,
                    allDay: allDay,
                    location: location,
                    virtualURL: virtualURL.isEmpty ? nil : virtualURL,
                    visibility: .group,
                    groupId: nil,
                    maxAttendees: maxAttendeesInt,
                    rsvpDeadline: hasRsvpDeadline ? rsvpDeadline : nil,
                    timezone: TimeZone.current.identifier
                )

                store.loadEvents()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
