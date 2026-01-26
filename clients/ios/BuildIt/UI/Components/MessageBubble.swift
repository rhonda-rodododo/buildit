// MessageBubble.swift
// BuildIt - Decentralized Mesh Communication
//
// Reusable message bubble component for chat interfaces.

import SwiftUI

/// A styled message bubble for chat messages
struct MessageBubble: View {
    let message: QueuedMessage
    let isFromMe: Bool

    var body: some View {
        HStack {
            if isFromMe { Spacer(minLength: 40) }

            VStack(alignment: isFromMe ? .trailing : .leading, spacing: 4) {
                // Message content
                Text(message.content)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(bubbleBackground)
                    .foregroundColor(isFromMe ? .white : .primary)
                    .clipShape(BubbleShape(isFromMe: isFromMe))

                // Timestamp and delivery status
                HStack(spacing: 4) {
                    Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    if isFromMe {
                        DeliveryStatusIcon(isDelivered: message.isDelivered)
                    }
                }
                .accessibilityHidden(true)
            }

            if !isFromMe { Spacer(minLength: 40) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(messageAccessibilityLabel)
        .accessibilityHint("Double tap to open message options")
    }

    private var bubbleBackground: Color {
        isFromMe ? .blue : Color(.systemGray5)
    }

    private var messageAccessibilityLabel: String {
        var label = isFromMe ? "You said: " : "Message: "
        label += message.content
        label += ". Sent at \(message.timestamp.formatted(date: .omitted, time: .shortened))"
        if isFromMe {
            label += message.isDelivered ? ". Delivered" : ". Pending"
        }
        return label
    }
}

/// Custom bubble shape with tail
struct BubbleShape: Shape {
    let isFromMe: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 16
        let tailWidth: CGFloat = 8
        let tailHeight: CGFloat = 6

        var path = Path()

        if isFromMe {
            // Rounded rectangle with tail on right
            path.addRoundedRect(
                in: CGRect(x: 0, y: 0, width: rect.width - tailWidth, height: rect.height),
                cornerSize: CGSize(width: radius, height: radius)
            )

            // Tail
            path.move(to: CGPoint(x: rect.width - tailWidth, y: rect.height - tailHeight - radius))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height - tailHeight))
            path.addLine(to: CGPoint(x: rect.width - tailWidth, y: rect.height - tailHeight + 4))
        } else {
            // Rounded rectangle with tail on left
            path.addRoundedRect(
                in: CGRect(x: tailWidth, y: 0, width: rect.width - tailWidth, height: rect.height),
                cornerSize: CGSize(width: radius, height: radius)
            )

            // Tail
            path.move(to: CGPoint(x: tailWidth, y: rect.height - tailHeight - radius))
            path.addLine(to: CGPoint(x: 0, y: rect.height - tailHeight))
            path.addLine(to: CGPoint(x: tailWidth, y: rect.height - tailHeight + 4))
        }

        return path
    }
}

/// Delivery status indicator icon
struct DeliveryStatusIcon: View {
    let isDelivered: Bool

    var body: some View {
        Image(systemName: isDelivered ? "checkmark.circle.fill" : "clock")
            .font(.caption2)
            .foregroundColor(isDelivered ? .green : .secondary)
            .accessibilityLabel(isDelivered ? "Delivered" : "Pending")
    }
}

/// Extended message bubble with sender info (for groups)
struct ExtendedMessageBubble: View {
    let message: QueuedMessage
    let isFromMe: Bool
    let senderName: String?

    var body: some View {
        HStack {
            if isFromMe { Spacer(minLength: 40) }

            VStack(alignment: isFromMe ? .trailing : .leading, spacing: 2) {
                // Sender name (for group chats)
                if !isFromMe, let name = senderName {
                    Text(name)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.blue)
                        .padding(.leading, 12)
                }

                // Message content
                Text(message.content)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(bubbleBackground)
                    .foregroundColor(isFromMe ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                // Timestamp
                Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 4)
            }

            if !isFromMe { Spacer(minLength: 40) }
        }
    }

    private var bubbleBackground: Color {
        isFromMe ? .blue : Color(.systemGray5)
    }
}

/// Typing indicator bubble
struct TypingIndicatorBubble: View {
    @State private var animationOffset: CGFloat = 0

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.secondary)
                        .frame(width: 8, height: 8)
                        .offset(y: animationOffset(for: index))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Spacer()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                animationOffset = -6
            }
        }
    }

    private func animationOffset(for index: Int) -> CGFloat {
        let delay = Double(index) * 0.15
        return animationOffset * sin(Date().timeIntervalSinceReferenceDate * 4 + delay * .pi * 2)
    }
}

/// Date separator for message list
struct DateSeparator: View {
    let date: Date

    var body: some View {
        HStack {
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)

            Text(formattedDate)
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal, 8)

            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)
        }
        .padding(.vertical, 8)
    }

    private var formattedDate: String {
        if Calendar.current.isDateInToday(date) {
            return "Today"
        } else if Calendar.current.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
    }
}

/// System message (e.g., "User joined the group")
struct SystemMessageBubble: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.caption)
            .foregroundColor(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(.systemGray6))
            .clipShape(Capsule())
            .frame(maxWidth: .infinity)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        MessageBubble(
            message: QueuedMessage(
                id: "1",
                content: "Hello! How are you?",
                senderPublicKey: "abc123",
                recipientPublicKey: nil,
                timestamp: Date(),
                eventId: nil
            ),
            isFromMe: false
        )

        MessageBubble(
            message: QueuedMessage(
                id: "2",
                content: "I'm doing great, thanks for asking! This is a longer message to test the bubble layout.",
                senderPublicKey: "def456",
                recipientPublicKey: nil,
                timestamp: Date(),
                eventId: nil,
                isRead: true,
                isDelivered: true
            ),
            isFromMe: true
        )

        TypingIndicatorBubble()

        DateSeparator(date: Date())

        SystemMessageBubble(message: "Alice joined the chat")
    }
    .padding()
}
