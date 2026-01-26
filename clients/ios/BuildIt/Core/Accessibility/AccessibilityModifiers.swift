// AccessibilityModifiers.swift
// BuildIt - Decentralized Mesh Communication
//
// Reusable accessibility view modifiers and utilities for VoiceOver,
// Dynamic Type, and other accessibility features.

import SwiftUI
import UIKit

// MARK: - Accessibility Announcements

/// Announces a message to VoiceOver users
/// - Parameters:
///   - message: The message to announce
///   - delay: Optional delay before announcement (default 0.1s for UI settling)
func announceToVoiceOver(_ message: String, delay: TimeInterval = 0.1) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}

/// Announces a layout change and optionally focuses an element
/// - Parameter element: The element to focus after the layout change
func announceLayoutChange(focusOn element: Any? = nil) {
    UIAccessibility.post(notification: .layoutChanged, argument: element)
}

/// Announces a screen change (e.g., navigation)
/// - Parameter element: The element to focus after the screen change
func announceScreenChange(focusOn element: Any? = nil) {
    UIAccessibility.post(notification: .screenChanged, argument: element)
}

// MARK: - Accessibility View Modifiers

/// Makes an element a semantic heading for VoiceOver navigation
struct HeadingModifier: ViewModifier {
    let level: Int

    func body(content: Content) -> some View {
        content
            .accessibilityAddTraits(.isHeader)
            .accessibilityHeading(headingLevel)
    }

    private var headingLevel: AccessibilityHeadingLevel {
        switch level {
        case 1: return .h1
        case 2: return .h2
        case 3: return .h3
        case 4: return .h4
        case 5: return .h5
        case 6: return .h6
        default: return .unspecified
        }
    }
}

extension View {
    /// Marks this view as a semantic heading
    /// - Parameter level: The heading level (1-6, where 1 is most important)
    func accessibilityHeading(level: Int) -> some View {
        modifier(HeadingModifier(level: level))
    }
}

/// Groups related content for VoiceOver
struct AccessibilityGroupModifier: ViewModifier {
    let label: String
    let hint: String?

    func body(content: Content) -> some View {
        content
            .accessibilityElement(children: .combine)
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
    }
}

extension View {
    /// Groups children into a single accessibility element
    /// - Parameters:
    ///   - label: Combined label for the group
    ///   - hint: Optional hint for the group
    func accessibilityGroup(label: String, hint: String? = nil) -> some View {
        modifier(AccessibilityGroupModifier(label: label, hint: hint))
    }
}

/// Makes a view behave as an accessible button with haptic feedback
struct AccessibleButtonModifier: ViewModifier {
    let label: String
    let hint: String?
    let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
    let action: () -> Void

    func body(content: Content) -> some View {
        content
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
            .accessibilityAddTraits(.isButton)
            .onTapGesture {
                let generator = UIImpactFeedbackGenerator(style: feedbackStyle)
                generator.impactOccurred()
                action()
            }
    }
}

extension View {
    /// Makes this view an accessible button with haptic feedback
    /// - Parameters:
    ///   - label: The accessibility label
    ///   - hint: Optional accessibility hint
    ///   - feedbackStyle: The haptic feedback style (default: .light)
    ///   - action: The action to perform on tap
    func accessibleButton(
        label: String,
        hint: String? = nil,
        feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle = .light,
        action: @escaping () -> Void
    ) -> some View {
        modifier(AccessibleButtonModifier(
            label: label,
            hint: hint,
            feedbackStyle: feedbackStyle,
            action: action
        ))
    }
}

/// Adds standard accessibility for a toggle/switch
struct AccessibleToggleModifier: ViewModifier {
    let label: String
    let isOn: Bool
    let hint: String?

    func body(content: Content) -> some View {
        content
            .accessibilityLabel(label)
            .accessibilityValue(isOn ? "On" : "Off")
            .accessibilityHint(hint ?? "Double tap to toggle")
            .accessibilityAddTraits(.isButton)
    }
}

extension View {
    /// Adds standard accessibility for a toggle
    /// - Parameters:
    ///   - label: The label describing the toggle
    ///   - isOn: The current state of the toggle
    ///   - hint: Optional additional hint
    func accessibleToggle(label: String, isOn: Bool, hint: String? = nil) -> some View {
        modifier(AccessibleToggleModifier(label: label, isOn: isOn, hint: hint))
    }
}

/// Adds accessibility for a text input field
struct AccessibleTextFieldModifier: ViewModifier {
    let label: String
    let hint: String?
    let isRequired: Bool

    func body(content: Content) -> some View {
        content
            .accessibilityLabel(isRequired ? "\(label), required" : label)
            .accessibilityHint(hint ?? "")
    }
}

extension View {
    /// Adds accessibility for a text input field
    /// - Parameters:
    ///   - label: The field label
    ///   - hint: Optional hint describing expected input
    ///   - isRequired: Whether the field is required
    func accessibleTextField(label: String, hint: String? = nil, isRequired: Bool = false) -> some View {
        modifier(AccessibleTextFieldModifier(label: label, hint: hint, isRequired: isRequired))
    }
}

/// Adds accessibility for an image or icon
struct AccessibleImageModifier: ViewModifier {
    let label: String?
    let isDecorative: Bool

    func body(content: Content) -> some View {
        if isDecorative {
            content.accessibilityHidden(true)
        } else {
            content
                .accessibilityLabel(label ?? "")
                .accessibilityAddTraits(.isImage)
        }
    }
}

extension View {
    /// Adds accessibility for an image
    /// - Parameters:
    ///   - label: The image description (nil for decorative images)
    ///   - isDecorative: Whether the image is purely decorative
    func accessibleImage(label: String? = nil, isDecorative: Bool = false) -> some View {
        modifier(AccessibleImageModifier(label: label, isDecorative: isDecorative))
    }
}

/// Adds accessibility for a badge or counter
struct AccessibleBadgeModifier: ViewModifier {
    let count: Int
    let label: String

    func body(content: Content) -> some View {
        content
            .accessibilityLabel("\(count) \(label)")
    }
}

extension View {
    /// Adds accessibility for a badge showing a count
    /// - Parameters:
    ///   - count: The number to display
    ///   - label: The label for what is being counted (e.g., "unread messages")
    func accessibleBadge(count: Int, label: String) -> some View {
        modifier(AccessibleBadgeModifier(count: count, label: label))
    }
}

// MARK: - Dynamic Type Support

/// Scales a value based on Dynamic Type settings
@available(iOS 14.0, *)
struct ScaledValue: ViewModifier {
    @ScaledMetric var scale: CGFloat
    let baseValue: CGFloat
    let maxScale: CGFloat

    init(baseValue: CGFloat, maxScale: CGFloat = 2.0) {
        self.baseValue = baseValue
        self.maxScale = maxScale
        _scale = ScaledMetric(wrappedValue: 1.0)
    }

    var scaledValue: CGFloat {
        min(baseValue * scale, baseValue * maxScale)
    }

    func body(content: Content) -> some View {
        content
    }
}

// MARK: - Minimum Touch Target

/// Ensures minimum touch target size (44x44 points per Apple HIG)
struct MinimumTouchTargetModifier: ViewModifier {
    let minSize: CGFloat

    func body(content: Content) -> some View {
        content
            .frame(minWidth: minSize, minHeight: minSize)
            .contentShape(Rectangle())
    }
}

extension View {
    /// Ensures the view meets minimum touch target size (44x44)
    /// - Parameter minSize: The minimum size (default 44)
    func minimumTouchTarget(minSize: CGFloat = 44) -> some View {
        modifier(MinimumTouchTargetModifier(minSize: minSize))
    }
}

// MARK: - Accessibility Identifiers (for UI Testing)

extension View {
    /// Adds both accessibility identifier and label
    /// - Parameters:
    ///   - identifier: The identifier for UI testing
    ///   - label: The VoiceOver label
    func accessibilityID(_ identifier: String, label: String) -> some View {
        self
            .accessibilityIdentifier(identifier)
            .accessibilityLabel(label)
    }
}

// MARK: - Message Bubble Accessibility

/// Accessibility modifier specifically for chat message bubbles
struct MessageBubbleAccessibilityModifier: ViewModifier {
    let content: String
    let senderName: String?
    let timestamp: Date
    let isFromMe: Bool
    let isDelivered: Bool

    func body(content: Content) -> some View {
        content
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint("Double tap to open message options")
    }

    private var accessibilityLabel: String {
        var label = ""

        if isFromMe {
            label = "You said: \(self.content)"
        } else if let sender = senderName {
            label = "\(sender) said: \(self.content)"
        } else {
            label = "Message: \(self.content)"
        }

        let timeString = timestamp.formatted(date: .omitted, time: .shortened)
        label += ". Sent at \(timeString)"

        if isFromMe {
            label += isDelivered ? ". Delivered" : ". Pending"
        }

        return label
    }
}

extension View {
    /// Adds accessibility for a chat message bubble
    func messageBubbleAccessibility(
        content: String,
        senderName: String?,
        timestamp: Date,
        isFromMe: Bool,
        isDelivered: Bool
    ) -> some View {
        modifier(MessageBubbleAccessibilityModifier(
            content: content,
            senderName: senderName,
            timestamp: timestamp,
            isFromMe: isFromMe,
            isDelivered: isDelivered
        ))
    }
}

// MARK: - Conversation Row Accessibility

/// Accessibility modifier for conversation list rows
struct ConversationRowAccessibilityModifier: ViewModifier {
    let participantName: String
    let lastMessage: String?
    let unreadCount: Int
    let timestamp: Date?

    func body(content: Content) -> some View {
        content
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint("Double tap to open conversation")
            .accessibilityAddTraits(.isButton)
    }

    private var accessibilityLabel: String {
        var label = "Conversation with \(participantName)"

        if unreadCount > 0 {
            label += ". \(unreadCount) unread \(unreadCount == 1 ? "message" : "messages")"
        }

        if let message = lastMessage {
            let truncated = message.count > 50 ? String(message.prefix(50)) + "..." : message
            label += ". Last message: \(truncated)"
        }

        if let time = timestamp {
            label += ". \(time.formatted(.relative(presentation: .named)))"
        }

        return label
    }
}

extension View {
    /// Adds accessibility for a conversation list row
    func conversationRowAccessibility(
        participantName: String,
        lastMessage: String?,
        unreadCount: Int,
        timestamp: Date?
    ) -> some View {
        modifier(ConversationRowAccessibilityModifier(
            participantName: participantName,
            lastMessage: lastMessage,
            unreadCount: unreadCount,
            timestamp: timestamp
        ))
    }
}

// MARK: - Status Indicator Accessibility

/// Accessibility modifier for status indicators (online/offline, connected/disconnected)
struct StatusIndicatorAccessibilityModifier: ViewModifier {
    let statusText: String
    let context: String

    func body(content: Content) -> some View {
        content
            .accessibilityLabel("\(context): \(statusText)")
    }
}

extension View {
    /// Adds accessibility for a status indicator
    /// - Parameters:
    ///   - statusText: The status (e.g., "Online", "Connected")
    ///   - context: The context (e.g., "Bluetooth", "Network")
    func statusIndicatorAccessibility(statusText: String, context: String) -> some View {
        modifier(StatusIndicatorAccessibilityModifier(statusText: statusText, context: context))
    }
}

// MARK: - Haptic Feedback Utilities

/// Provides haptic feedback for various actions
enum HapticFeedback {
    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    static func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }

    static func warning() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }

    static func light() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    static func medium() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    static func heavy() {
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.impactOccurred()
    }

    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// MARK: - Color Contrast Utilities

extension Color {
    /// Returns whether this color has sufficient contrast with the given background
    /// for WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
    func hassufficientContrast(with background: Color, forLargeText: Bool = false) -> Bool {
        // This is a simplified check - in production, convert to luminance values
        // and calculate the actual contrast ratio
        let ratio = forLargeText ? 3.0 : 4.5
        // Implementation would require converting to RGB and calculating luminance
        return true // Placeholder - actual implementation would calculate contrast
    }
}

// MARK: - Accessibility Preference Helpers

/// Environment key for reduced motion preference
struct ReducedMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var prefersReducedMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }
}

extension View {
    /// Conditionally applies animation based on reduced motion preference
    func animationRespectingReducedMotion<V: Equatable>(
        _ animation: Animation?,
        value: V
    ) -> some View {
        self.modifier(ReducedMotionAnimationModifier(animation: animation, value: value))
    }
}

struct ReducedMotionAnimationModifier<V: Equatable>: ViewModifier {
    let animation: Animation?
    let value: V
    @Environment(\.accessibilityReduceMotion) var reduceMotion

    func body(content: Content) -> some View {
        content.animation(reduceMotion ? nil : animation, value: value)
    }
}
