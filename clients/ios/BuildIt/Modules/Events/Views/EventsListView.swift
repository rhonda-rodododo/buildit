// EventsListView.swift
// BuildIt - Decentralized Mesh Communication
//
// List view for displaying events.

import SwiftUI

/// Main events list view
public struct EventsListView: View {
    @ObservedObject var store: EventsStore
    let service: EventsService

    @State private var showCreateEvent = false
    @State private var selectedEvent: EventEntity?
    @State private var searchQuery = ""

    public init(store: EventsStore, service: EventsService) {
        self.store = store
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            Group {
                if store.events.isEmpty {
                    emptyState
                } else {
                    eventsList
                }
            }
            .navigationTitle("Events")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreateEvent = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showCreateEvent) {
                CreateEventView(service: service, store: store)
            }
            .sheet(item: $selectedEvent) { event in
                EventDetailView(event: event, service: service, store: store)
            }
            .refreshable {
                store.loadEvents()
            }
        }
        .searchable(text: $searchQuery, prompt: "Search events")
    }

    private var eventsList: some View {
        List {
            let upcomingEvents = store.getUpcomingEvents()
            let pastEvents = store.getPastEvents()

            if !upcomingEvents.isEmpty {
                Section("Upcoming") {
                    ForEach(filteredEvents(upcomingEvents)) { event in
                        EventRow(event: event)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedEvent = event
                            }
                    }
                }
            }

            if !pastEvents.isEmpty {
                Section("Past") {
                    ForEach(filteredEvents(pastEvents)) { event in
                        EventRow(event: event)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedEvent = event
                            }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Events", systemImage: "calendar")
        } description: {
            Text("Create an event to get started")
        } actions: {
            Button("Create Event") {
                showCreateEvent = true
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func filteredEvents(_ events: [EventEntity]) -> [EventEntity] {
        if searchQuery.isEmpty {
            return events
        }
        return events.filter { event in
            event.title.localizedCaseInsensitiveContains(searchQuery) ||
            event.eventDescription?.localizedCaseInsensitiveContains(searchQuery) == true
        }
    }
}

/// Row view for a single event
struct EventRow: View {
    let event: EventEntity

    var body: some View {
        HStack(spacing: 12) {
            // Date badge
            VStack(spacing: 2) {
                Text(event.startAt.formatted(.dateTime.month(.abbreviated)))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(event.startAt.formatted(.dateTime.day()))
                    .font(.title2)
                    .fontWeight(.bold)
            }
            .frame(width: 50)
            .padding(.vertical, 8)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption)
                    Text(event.startAt.formatted(.dateTime.hour().minute()))
                        .font(.caption)
                }
                .foregroundColor(.secondary)

                if let location = event.locationName {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle")
                            .font(.caption)
                        Text(location)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundColor(.secondary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}
