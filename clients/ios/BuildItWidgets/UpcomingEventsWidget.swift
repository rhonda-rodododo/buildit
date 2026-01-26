// UpcomingEventsWidget.swift
// BuildIt - Decentralized Mesh Communication
//
// Home screen widget showing upcoming events.
// Displays the next 3 events with title, date/time, and location.

import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

/// Entry for the upcoming events widget timeline
struct UpcomingEventsEntry: TimelineEntry {
    let date: Date
    let events: [EventPreview]

    static var placeholder: UpcomingEventsEntry {
        UpcomingEventsEntry(
            date: Date(),
            events: [
                EventPreview(
                    id: "placeholder-1",
                    title: "Community Meeting",
                    startAt: Date().addingTimeInterval(3600),
                    endAt: Date().addingTimeInterval(7200),
                    locationName: "Community Center"
                ),
                EventPreview(
                    id: "placeholder-2",
                    title: "Weekly Standup",
                    startAt: Date().addingTimeInterval(86400),
                    endAt: nil,
                    locationName: nil,
                    isVirtual: true
                ),
                EventPreview(
                    id: "placeholder-3",
                    title: "Workshop",
                    startAt: Date().addingTimeInterval(172800),
                    endAt: Date().addingTimeInterval(180000),
                    locationName: "Main Hall"
                )
            ]
        )
    }

    static var empty: UpcomingEventsEntry {
        UpcomingEventsEntry(
            date: Date(),
            events: []
        )
    }
}

// MARK: - Timeline Provider

/// Provides timeline entries for the upcoming events widget
struct UpcomingEventsProvider: TimelineProvider {
    typealias Entry = UpcomingEventsEntry

    func placeholder(in context: Context) -> UpcomingEventsEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (UpcomingEventsEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
        } else {
            let entry = createEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UpcomingEventsEntry>) -> Void) {
        let entry = createEntry()

        // Calculate next update time - when the next event starts or 30 minutes
        let nextUpdateDate: Date
        if let firstEvent = entry.events.first, firstEvent.startAt > Date() {
            // Update when the first event starts (to show it as "now")
            nextUpdateDate = min(
                firstEvent.startAt,
                Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
            )
        } else {
            nextUpdateDate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        }

        let timeline = Timeline(
            entries: [entry],
            policy: .after(nextUpdateDate)
        )

        completion(timeline)
    }

    private func createEntry() -> UpcomingEventsEntry {
        let manager = SharedDataManager.shared
        let upcomingEvents = manager.upcomingEvents
            .filter { $0.startAt > Date() || ($0.endAt ?? $0.startAt) > Date() }
            .sorted { $0.startAt < $1.startAt }

        return UpcomingEventsEntry(
            date: Date(),
            events: Array(upcomingEvents.prefix(3))
        )
    }
}

// MARK: - Widget Views

/// Small widget view showing next event
struct UpcomingEventsSmallView: View {
    let entry: UpcomingEventsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "calendar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)

                Text("Next Event")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()
            }

            if let event = entry.events.first {
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)

                    Text(event.formattedDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    if let location = event.locationName {
                        HStack(spacing: 4) {
                            Image(systemName: event.isVirtual ? "video.fill" : "location.fill")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .accessibilityHidden(true)

                            Text(location)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    } else if event.isVirtual {
                        HStack(spacing: 4) {
                            Image(systemName: "video.fill")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .accessibilityHidden(true)

                            Text("Virtual")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(eventAccessibilityLabel(event))

                Spacer(minLength: 0)
            } else {
                Spacer()
                Text("No upcoming events")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            }
        }
    }

    private func eventAccessibilityLabel(_ event: EventPreview) -> String {
        var label = "\(event.title), \(event.formattedDate)"
        if let location = event.locationName {
            label += ", at \(location)"
        } else if event.isVirtual {
            label += ", virtual event"
        }
        return label
    }
}

/// Medium widget view showing up to 3 events
struct UpcomingEventsMediumView: View {
    let entry: UpcomingEventsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "calendar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)

                Text("Upcoming Events")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()

                Text("\(entry.events.count)")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(.orange.opacity(0.2))
                    .clipShape(Capsule())
                    .foregroundStyle(.orange)
            }

            if entry.events.isEmpty {
                Spacer()
                Text("No upcoming events")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(entry.events.prefix(3)) { event in
                    Link(destination: event.deepLinkURL) {
                        EventPreviewRow(event: event)
                    }
                }

                if entry.events.count < 3 {
                    Spacer()
                }
            }
        }
    }
}

/// Large widget view showing more event details
struct UpcomingEventsLargeView: View {
    let entry: UpcomingEventsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "calendar")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)

                Text("Upcoming Events")
                    .font(.headline)
                    .foregroundStyle(.primary)

                Spacer()
            }

            if entry.events.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)

                    Text("No upcoming events")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(entry.events) { event in
                    Link(destination: event.deepLinkURL) {
                        EventDetailRow(event: event)
                    }

                    if event.id != entry.events.last?.id {
                        Divider()
                    }
                }

                Spacer()
            }
        }
    }
}

/// Row displaying a single event preview (compact)
struct EventPreviewRow: View {
    let event: EventPreview

    var body: some View {
        HStack(spacing: 8) {
            // Date indicator
            VStack(spacing: 0) {
                Text(dayOfWeek(from: event.startAt))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.orange)

                Text(dayNumber(from: event.startAt))
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
            }
            .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    if let timeRange = event.formattedTimeRange {
                        Text(timeRange)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    if let location = event.locationName {
                        Text("•")
                            .font(.caption2)
                            .foregroundStyle(.secondary)

                        HStack(spacing: 2) {
                            Image(systemName: event.isVirtual ? "video.fill" : "location.fill")
                                .font(.system(size: 8))
                                .accessibilityHidden(true)

                            Text(location)
                                .lineLimit(1)
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var label = "\(event.title), \(event.formattedDate)"
        if let location = event.locationName {
            label += ", at \(location)"
        }
        return label
    }

    private func dayOfWeek(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).uppercased()
    }

    private func dayNumber(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

/// Row displaying detailed event information
struct EventDetailRow: View {
    let event: EventPreview

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Date card
            VStack(spacing: 2) {
                Text(monthAbbrev(from: event.startAt))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)

                Text(dayNumber(from: event.startAt))
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)
            .background(.orange.gradient)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)

                if let timeRange = event.formattedTimeRange {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption2)
                            .accessibilityHidden(true)

                        Text(timeRange)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                if let location = event.locationName {
                    HStack(spacing: 4) {
                        Image(systemName: event.isVirtual ? "video.fill" : "location.fill")
                            .font(.caption2)
                            .accessibilityHidden(true)

                        Text(location)
                            .lineLimit(1)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                } else if event.isVirtual {
                    HStack(spacing: 4) {
                        Image(systemName: "video.fill")
                            .font(.caption2)
                            .accessibilityHidden(true)

                        Text("Virtual")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var label = "\(event.title), \(event.formattedDate)"
        if let location = event.locationName {
            label += ", at \(location)"
        } else if event.isVirtual {
            label += ", virtual event"
        }
        return label
    }

    private func monthAbbrev(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date).uppercased()
    }

    private func dayNumber(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

/// Main view that adapts to widget family
struct UpcomingEventsWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: UpcomingEventsEntry

    var body: some View {
        switch family {
        case .systemSmall:
            UpcomingEventsSmallView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://events")!)

        case .systemMedium:
            UpcomingEventsMediumView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://events")!)

        case .systemLarge:
            UpcomingEventsLargeView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://events")!)

        default:
            UpcomingEventsSmallView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://events")!)
        }
    }
}

// MARK: - Widget Configuration

/// Upcoming events widget configuration
struct UpcomingEventsWidget: Widget {
    let kind: String = "com.buildit.widget.upcoming-events"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UpcomingEventsProvider()) { entry in
            UpcomingEventsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Upcoming Events")
        .description("Shows your next 3 upcoming events.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    UpcomingEventsWidget()
} timeline: {
    UpcomingEventsEntry.placeholder
    UpcomingEventsEntry.empty
}

#Preview("Medium", as: .systemMedium) {
    UpcomingEventsWidget()
} timeline: {
    UpcomingEventsEntry.placeholder
    UpcomingEventsEntry.empty
}

#Preview("Large", as: .systemLarge) {
    UpcomingEventsWidget()
} timeline: {
    UpcomingEventsEntry.placeholder
    UpcomingEventsEntry.empty
}
