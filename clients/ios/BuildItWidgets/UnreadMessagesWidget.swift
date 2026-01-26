// UnreadMessagesWidget.swift
// BuildIt - Decentralized Mesh Communication
//
// Home screen widget showing unread message count and recent messages.
// Supports small and medium widget sizes with different layouts.

import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

/// Entry for the unread messages widget timeline
struct UnreadMessagesEntry: TimelineEntry {
    let date: Date
    let unreadCount: Int
    let recentMessages: [MessagePreview]

    static var placeholder: UnreadMessagesEntry {
        UnreadMessagesEntry(
            date: Date(),
            unreadCount: 3,
            recentMessages: [
                MessagePreview(
                    id: "placeholder-1",
                    senderName: "Alex",
                    senderPublicKey: "placeholder",
                    content: "Hey, are you coming to the meeting?",
                    timestamp: Date().addingTimeInterval(-300)
                ),
                MessagePreview(
                    id: "placeholder-2",
                    senderName: "Community Group",
                    senderPublicKey: "placeholder",
                    content: "New update posted about the event",
                    timestamp: Date().addingTimeInterval(-3600),
                    isGroupMessage: true,
                    groupName: "Community Group"
                )
            ]
        )
    }

    static var empty: UnreadMessagesEntry {
        UnreadMessagesEntry(
            date: Date(),
            unreadCount: 0,
            recentMessages: []
        )
    }
}

// MARK: - Timeline Provider

/// Provides timeline entries for the unread messages widget
struct UnreadMessagesProvider: TimelineProvider {
    typealias Entry = UnreadMessagesEntry

    func placeholder(in context: Context) -> UnreadMessagesEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (UnreadMessagesEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
        } else {
            let entry = createEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UnreadMessagesEntry>) -> Void) {
        let entry = createEntry()

        // Request update in 15 minutes
        let nextUpdateDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!

        let timeline = Timeline(
            entries: [entry],
            policy: .after(nextUpdateDate)
        )

        completion(timeline)
    }

    private func createEntry() -> UnreadMessagesEntry {
        let manager = SharedDataManager.shared
        return UnreadMessagesEntry(
            date: Date(),
            unreadCount: manager.unreadMessageCount,
            recentMessages: Array(manager.recentMessages.prefix(3))
        )
    }
}

// MARK: - Widget Views

/// Small widget view showing unread count
struct UnreadMessagesSmallView: View {
    let entry: UnreadMessagesEntry

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "message.fill")
                .font(.system(size: 28))
                .foregroundStyle(.blue)
                .accessibilityHidden(true)

            if entry.unreadCount > 0 {
                Text("\(entry.unreadCount)")
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)

                Text(entry.unreadCount == 1 ? "Unread Message" : "Unread Messages")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            } else {
                Text("No New")
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Text("Messages")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        if entry.unreadCount > 0 {
            return "\(entry.unreadCount) unread \(entry.unreadCount == 1 ? "message" : "messages")"
        }
        return "No unread messages"
    }
}

/// Medium widget view showing unread count and recent messages
struct UnreadMessagesMediumView: View {
    let entry: UnreadMessagesEntry

    var body: some View {
        HStack(spacing: 16) {
            // Left side: Unread count
            VStack(spacing: 4) {
                Image(systemName: "message.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(.blue)
                    .accessibilityHidden(true)

                if entry.unreadCount > 0 {
                    Text("\(entry.unreadCount)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)

                    Text("Unread")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Text("0")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.secondary)

                    Text("Unread")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 80)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(entry.unreadCount) unread messages")

            Divider()

            // Right side: Recent messages
            VStack(alignment: .leading, spacing: 8) {
                if entry.recentMessages.isEmpty {
                    Spacer()
                    Text("No recent messages")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Spacer()
                } else {
                    ForEach(entry.recentMessages.prefix(2)) { message in
                        Link(destination: message.deepLinkURL) {
                            MessagePreviewRow(message: message)
                        }
                    }
                    if entry.recentMessages.count < 2 {
                        Spacer()
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 4)
    }
}

/// Row displaying a single message preview
struct MessagePreviewRow: View {
    let message: MessagePreview

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(message.isGroupMessage ? (message.groupName ?? "Group") : message.senderName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Spacer()

                Text(relativeTime(from: message.timestamp))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text(message.truncatedContent)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(message.isGroupMessage ? "Group message from \(message.groupName ?? "group")" : "Message from \(message.senderName)"): \(message.content)")
    }

    private func relativeTime(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// Main view that adapts to widget family
struct UnreadMessagesWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: UnreadMessagesEntry

    var body: some View {
        switch family {
        case .systemSmall:
            UnreadMessagesSmallView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://messages")!)

        case .systemMedium:
            UnreadMessagesMediumView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://messages")!)

        default:
            // Fallback for unsupported sizes
            UnreadMessagesSmallView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "buildit://messages")!)
        }
    }
}

// MARK: - Widget Configuration

/// Unread messages widget configuration
struct UnreadMessagesWidget: Widget {
    let kind: String = "com.buildit.widget.unread-messages"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UnreadMessagesProvider()) { entry in
            UnreadMessagesWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Unread Messages")
        .description("Shows your unread message count and recent messages.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    UnreadMessagesWidget()
} timeline: {
    UnreadMessagesEntry.placeholder
    UnreadMessagesEntry.empty
}

#Preview("Medium", as: .systemMedium) {
    UnreadMessagesWidget()
} timeline: {
    UnreadMessagesEntry.placeholder
    UnreadMessagesEntry.empty
}
