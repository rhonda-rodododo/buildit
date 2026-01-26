// CreateEventView.swift
// BuildIt - Decentralized Mesh Communication
//
// Form for creating a new event.

import SwiftUI

// Import localization
private typealias Strings = L10n.Events

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
                Section("events_details".localized) {
                    TextField("events_title".localized, text: $title)

                    TextField("events_description".localized, text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("events_dateTime".localized) {
                    DatePicker("events_starts".localized, selection: $startDate)

                    DatePicker("events_ends".localized, selection: $endDate)

                    Toggle("events_allDay".localized, isOn: $allDay)
                }

                Section("events_location".localized) {
                    TextField("events_locationName".localized, text: $locationName)

                    TextField("events_address".localized, text: $locationAddress, axis: .vertical)
                        .lineLimit(2...4)

                    TextField("events_virtualURL".localized, text: $virtualURL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }

                Section("events_rsvpSettings".localized) {
                    TextField("events_maxAttendees".localized, text: $maxAttendees)
                        .keyboardType(.numberPad)

                    Toggle("events_setRsvpDeadline".localized, isOn: $hasRsvpDeadline)

                    if hasRsvpDeadline {
                        DatePicker("events_rsvpBy".localized, selection: $rsvpDeadline)
                    }
                }
            }
            .navigationTitle(Strings.createEvent)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(L10n.Common.cancel) {
                        dismiss()
                    }
                    .disabled(isCreating)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(L10n.Common.create) {
                        createEvent()
                    }
                    .disabled(title.isEmpty || isCreating)
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
