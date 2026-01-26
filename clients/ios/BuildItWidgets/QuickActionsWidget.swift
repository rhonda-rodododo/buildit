// QuickActionsWidget.swift
// BuildIt - Decentralized Mesh Communication
//
// Home screen widget providing quick action buttons.
// Allows users to quickly compose messages, scan QR codes, and check-in.

import WidgetKit
import SwiftUI

// MARK: - Quick Action Types

/// Available quick actions for the widget
enum QuickAction: String, CaseIterable, Identifiable {
    case newMessage = "new-message"
    case scanQR = "scan-qr"
    case checkIn = "check-in"
    case newEvent = "new-event"
    case viewGroups = "view-groups"
    case settings = "settings"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .newMessage: return "New Message"
        case .scanQR: return "Scan QR"
        case .checkIn: return "Check In"
        case .newEvent: return "New Event"
        case .viewGroups: return "Groups"
        case .settings: return "Settings"
        }
    }

    var iconName: String {
        switch self {
        case .newMessage: return "square.and.pencil"
        case .scanQR: return "qrcode.viewfinder"
        case .checkIn: return "checkmark.circle"
        case .newEvent: return "calendar.badge.plus"
        case .viewGroups: return "person.3"
        case .settings: return "gear"
        }
    }

    var color: Color {
        switch self {
        case .newMessage: return .blue
        case .scanQR: return .purple
        case .checkIn: return .green
        case .newEvent: return .orange
        case .viewGroups: return .indigo
        case .settings: return .gray
        }
    }

    var deepLinkURL: URL {
        URL(string: "buildit://action/\(rawValue)")!
    }

    var accessibilityLabel: String {
        switch self {
        case .newMessage: return "Compose a new message"
        case .scanQR: return "Scan a QR code"
        case .checkIn: return "Check in to current location"
        case .newEvent: return "Create a new event"
        case .viewGroups: return "View your groups"
        case .settings: return "Open settings"
        }
    }
}

// MARK: - Timeline Entry

/// Entry for the quick actions widget timeline
struct QuickActionsEntry: TimelineEntry {
    let date: Date

    /// Actions to display - varies by widget size
    func actions(for family: WidgetFamily) -> [QuickAction] {
        switch family {
        case .systemSmall:
            return [.newMessage, .scanQR, .checkIn, .newEvent]
        case .systemMedium:
            return [.newMessage, .scanQR, .checkIn, .newEvent, .viewGroups, .settings]
        default:
            return [.newMessage, .scanQR, .checkIn, .newEvent]
        }
    }

    static var placeholder: QuickActionsEntry {
        QuickActionsEntry(date: Date())
    }
}

// MARK: - Timeline Provider

/// Provides timeline entries for the quick actions widget
struct QuickActionsProvider: TimelineProvider {
    typealias Entry = QuickActionsEntry

    func placeholder(in context: Context) -> QuickActionsEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickActionsEntry) -> Void) {
        completion(QuickActionsEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionsEntry>) -> Void) {
        let entry = QuickActionsEntry(date: Date())

        // Quick actions don't need frequent updates
        let timeline = Timeline(
            entries: [entry],
            policy: .never
        )

        completion(timeline)
    }
}

// MARK: - Widget Views

/// Small widget view showing 4 quick actions in a 2x2 grid
struct QuickActionsSmallView: View {
    let entry: QuickActionsEntry
    let actions: [QuickAction]

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(actions.prefix(2)) { action in
                    QuickActionButton(action: action, style: .compact)
                }
            }

            HStack(spacing: 0) {
                ForEach(actions.dropFirst(2).prefix(2)) { action in
                    QuickActionButton(action: action, style: .compact)
                }
            }
        }
    }
}

/// Medium widget view showing 6 quick actions in a row
struct QuickActionsMediumView: View {
    let entry: QuickActionsEntry
    let actions: [QuickAction]

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.yellow)
                    .accessibilityHidden(true)

                Text("Quick Actions")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()
            }
            .padding(.horizontal, 4)

            HStack(spacing: 8) {
                ForEach(actions.prefix(6)) { action in
                    QuickActionButton(action: action, style: .labeled)
                }
            }
        }
    }
}

/// Style options for quick action buttons
enum QuickActionButtonStyle {
    case compact  // Icon only, for small widget
    case labeled  // Icon with label
}

/// Individual quick action button
struct QuickActionButton: View {
    let action: QuickAction
    let style: QuickActionButtonStyle

    var body: some View {
        Link(destination: action.deepLinkURL) {
            switch style {
            case .compact:
                compactContent

            case .labeled:
                labeledContent
            }
        }
        .accessibilityLabel(action.accessibilityLabel)
    }

    private var compactContent: some View {
        VStack(spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(action.color.opacity(0.15))

                Image(systemName: action.iconName)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(action.color)
            }
            .frame(width: 48, height: 48)

            Text(action.title)
                .font(.caption2)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var labeledContent: some View {
        VStack(spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(action.color.opacity(0.15))

                Image(systemName: action.iconName)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(action.color)
            }
            .frame(width: 40, height: 40)

            Text(action.title)
                .font(.caption2)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Main view that adapts to widget family
struct QuickActionsWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: QuickActionsEntry

    var body: some View {
        let actions = entry.actions(for: family)

        switch family {
        case .systemSmall:
            QuickActionsSmallView(entry: entry, actions: actions)
                .containerBackground(.fill.tertiary, for: .widget)

        case .systemMedium:
            QuickActionsMediumView(entry: entry, actions: actions)
                .containerBackground(.fill.tertiary, for: .widget)

        default:
            QuickActionsSmallView(entry: entry, actions: actions)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

// MARK: - Widget Configuration

/// Quick actions widget configuration
struct QuickActionsWidget: Widget {
    let kind: String = "com.buildit.widget.quick-actions"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickActionsProvider()) { entry in
            QuickActionsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Quick Actions")
        .description("Quick access to common actions like composing messages and scanning QR codes.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    QuickActionsWidget()
} timeline: {
    QuickActionsEntry.placeholder
}

#Preview("Medium", as: .systemMedium) {
    QuickActionsWidget()
} timeline: {
    QuickActionsEntry.placeholder
}
