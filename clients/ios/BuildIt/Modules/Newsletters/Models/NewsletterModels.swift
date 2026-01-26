// NewsletterModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for newsletters, issues, subscribers, and delivery tracking.
// Based on protocol/schemas/modules/newsletters/v1.json

import Foundation

/// Schema version for newsletters module
public enum NewsletterSchema {
    static let version = "1.0.0"
}

/// Nostr event kinds for newsletters
public enum NewsletterEventKind: Int {
    case newsletter = 40081
    case campaign = 40082
    case subscriber = 40083
    case template = 40084
}

// MARK: - Newsletter

/// Visibility options for newsletters
public enum NewsletterVisibility: String, Codable, CaseIterable, Sendable {
    case `private`
    case group
    case `public`

    var displayName: String {
        switch self {
        case .private: return "Private"
        case .group: return "Group Only"
        case .public: return "Public"
        }
    }

    var description: String {
        switch self {
        case .private: return "Only you can see this newsletter"
        case .group: return "Visible to group members"
        case .public: return "Anyone can subscribe"
        }
    }
}

/// A newsletter/mailing list configuration
public struct Newsletter: Codable, Identifiable, Sendable {
    public let id: String
    public var name: String
    public var description: String?
    public var groupId: String?
    public var fromName: String?
    public var replyTo: String?
    public var logo: String?
    public var subscriberCount: Int
    public var visibility: NewsletterVisibility
    public var doubleOptIn: Bool
    public var ownerPubkey: String
    public var editors: [String]
    public var createdAt: Date
    public var updatedAt: Date?

    private let _v: String

    public init(
        id: String = UUID().uuidString,
        name: String,
        description: String? = nil,
        groupId: String? = nil,
        fromName: String? = nil,
        replyTo: String? = nil,
        logo: String? = nil,
        subscriberCount: Int = 0,
        visibility: NewsletterVisibility = .group,
        doubleOptIn: Bool = true,
        ownerPubkey: String,
        editors: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self._v = NewsletterSchema.version
        self.id = id
        self.name = name
        self.description = description
        self.groupId = groupId
        self.fromName = fromName
        self.replyTo = replyTo
        self.logo = logo
        self.subscriberCount = subscriberCount
        self.visibility = visibility
        self.doubleOptIn = doubleOptIn
        self.ownerPubkey = ownerPubkey
        self.editors = editors
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case _v
        case id, name, description, groupId, fromName, replyTo, logo
        case subscriberCount, visibility, doubleOptIn, ownerPubkey, editors
        case createdAt, updatedAt
    }
}

// MARK: - Campaign/Issue

/// Status of a newsletter campaign/issue
public enum CampaignStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case scheduled
    case sending
    case sent
    case failed

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .scheduled: return "Scheduled"
        case .sending: return "Sending"
        case .sent: return "Sent"
        case .failed: return "Failed"
        }
    }

    var icon: String {
        switch self {
        case .draft: return "pencil"
        case .scheduled: return "calendar.badge.clock"
        case .sending: return "arrow.up.circle"
        case .sent: return "checkmark.circle"
        case .failed: return "exclamationmark.triangle"
        }
    }
}

/// Content type for campaign content
public enum ContentType: String, Codable, Sendable {
    case html
    case markdown
}

/// Campaign statistics
public struct CampaignStats: Codable, Sendable {
    public var recipientCount: Int
    public var deliveredCount: Int
    public var failedCount: Int
    public var openCount: Int
    public var clickCount: Int

    public init(
        recipientCount: Int = 0,
        deliveredCount: Int = 0,
        failedCount: Int = 0,
        openCount: Int = 0,
        clickCount: Int = 0
    ) {
        self.recipientCount = recipientCount
        self.deliveredCount = deliveredCount
        self.failedCount = failedCount
        self.openCount = openCount
        self.clickCount = clickCount
    }

    public var deliveryRate: Double {
        guard recipientCount > 0 else { return 0 }
        return Double(deliveredCount) / Double(recipientCount)
    }

    public var openRate: Double {
        guard deliveredCount > 0 else { return 0 }
        return Double(openCount) / Double(deliveredCount)
    }

    public var clickRate: Double {
        guard openCount > 0 else { return 0 }
        return Double(clickCount) / Double(openCount)
    }
}

/// A newsletter campaign/issue
public struct NewsletterIssue: Codable, Identifiable, Sendable {
    public let id: String
    public var newsletterId: String
    public var subject: String
    public var preheader: String?
    public var content: String
    public var contentType: ContentType
    public var status: CampaignStatus
    public var scheduledAt: Date?
    public var sentAt: Date?
    public var segments: [String]
    public var stats: CampaignStats
    public var createdBy: String
    public var createdAt: Date
    public var updatedAt: Date?

    private let _v: String

    public init(
        id: String = UUID().uuidString,
        newsletterId: String,
        subject: String,
        preheader: String? = nil,
        content: String = "",
        contentType: ContentType = .markdown,
        status: CampaignStatus = .draft,
        scheduledAt: Date? = nil,
        sentAt: Date? = nil,
        segments: [String] = [],
        stats: CampaignStats = CampaignStats(),
        createdBy: String,
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self._v = NewsletterSchema.version
        self.id = id
        self.newsletterId = newsletterId
        self.subject = subject
        self.preheader = preheader
        self.content = content
        self.contentType = contentType
        self.status = status
        self.scheduledAt = scheduledAt
        self.sentAt = sentAt
        self.segments = segments
        self.stats = stats
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case _v
        case id, newsletterId, subject, preheader, content, contentType
        case status, scheduledAt, sentAt, segments, stats
        case createdBy, createdAt, updatedAt
    }

    public var isDraft: Bool {
        status == .draft
    }

    public var canEdit: Bool {
        status == .draft || status == .scheduled
    }

    public var canSend: Bool {
        status == .draft && !subject.isEmpty && !content.isEmpty
    }
}

// MARK: - Subscriber

/// Status of a newsletter subscriber
public enum SubscriberStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case active
    case unsubscribed
    case bounced
    case complained

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .active: return "Active"
        case .unsubscribed: return "Unsubscribed"
        case .bounced: return "Bounced"
        case .complained: return "Complained"
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .active: return "checkmark.circle"
        case .unsubscribed: return "xmark.circle"
        case .bounced: return "exclamationmark.triangle"
        case .complained: return "flag"
        }
    }

    var canReceiveEmails: Bool {
        self == .active
    }
}

/// Subscriber preferences
public struct SubscriberPreferences: Codable, Sendable {
    public var frequency: String?
    public var format: ContentType?
    public var categories: [String]?

    public init(
        frequency: String? = nil,
        format: ContentType? = nil,
        categories: [String]? = nil
    ) {
        self.frequency = frequency
        self.format = format
        self.categories = categories
    }
}

/// A newsletter subscriber
public struct NewsletterSubscriber: Codable, Identifiable, Sendable {
    public let id: String
    public var newsletterId: String
    public var pubkey: String?
    public var email: String?
    public var name: String?
    public var status: SubscriberStatus
    public var segments: [String]
    public var customFields: [String: String]
    public var source: String?
    public var preferences: SubscriberPreferences?
    public var subscribedAt: Date
    public var confirmedAt: Date?
    public var unsubscribedAt: Date?

    private let _v: String

    public init(
        id: String = UUID().uuidString,
        newsletterId: String,
        pubkey: String? = nil,
        email: String? = nil,
        name: String? = nil,
        status: SubscriberStatus = .pending,
        segments: [String] = [],
        customFields: [String: String] = [:],
        source: String? = nil,
        preferences: SubscriberPreferences? = nil,
        subscribedAt: Date = Date(),
        confirmedAt: Date? = nil,
        unsubscribedAt: Date? = nil
    ) {
        self._v = NewsletterSchema.version
        self.id = id
        self.newsletterId = newsletterId
        self.pubkey = pubkey
        self.email = email
        self.name = name
        self.status = status
        self.segments = segments
        self.customFields = customFields
        self.source = source
        self.preferences = preferences
        self.subscribedAt = subscribedAt
        self.confirmedAt = confirmedAt
        self.unsubscribedAt = unsubscribedAt
    }

    enum CodingKeys: String, CodingKey {
        case _v
        case id, newsletterId, pubkey, email, name, status
        case segments, customFields, source, preferences
        case subscribedAt, confirmedAt, unsubscribedAt
    }

    public var displayName: String {
        name ?? email ?? pubkey?.prefix(16).description ?? "Unknown"
    }

    public var isActive: Bool {
        status == .active
    }
}

// MARK: - Delivery Status

/// Status of a message delivery to a specific subscriber
public enum DeliveryStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case sending
    case delivered
    case failed
    case bounced
    case opened
    case clicked

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .sending: return "Sending"
        case .delivered: return "Delivered"
        case .failed: return "Failed"
        case .bounced: return "Bounced"
        case .opened: return "Opened"
        case .clicked: return "Clicked"
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .sending: return "arrow.up.circle"
        case .delivered: return "checkmark.circle"
        case .failed: return "xmark.circle"
        case .bounced: return "exclamationmark.triangle"
        case .opened: return "eye"
        case .clicked: return "hand.tap"
        }
    }
}

/// Tracks delivery status for a specific subscriber
public struct DeliveryRecord: Codable, Identifiable, Sendable {
    public let id: String
    public var issueId: String
    public var subscriberId: String
    public var subscriberPubkey: String?
    public var subscriberEmail: String?
    public var status: DeliveryStatus
    public var nostrEventId: String?
    public var errorMessage: String?
    public var sentAt: Date?
    public var deliveredAt: Date?
    public var openedAt: Date?
    public var clickedAt: Date?
    public var retryCount: Int

    public init(
        id: String = UUID().uuidString,
        issueId: String,
        subscriberId: String,
        subscriberPubkey: String? = nil,
        subscriberEmail: String? = nil,
        status: DeliveryStatus = .pending,
        nostrEventId: String? = nil,
        errorMessage: String? = nil,
        sentAt: Date? = nil,
        deliveredAt: Date? = nil,
        openedAt: Date? = nil,
        clickedAt: Date? = nil,
        retryCount: Int = 0
    ) {
        self.id = id
        self.issueId = issueId
        self.subscriberId = subscriberId
        self.subscriberPubkey = subscriberPubkey
        self.subscriberEmail = subscriberEmail
        self.status = status
        self.nostrEventId = nostrEventId
        self.errorMessage = errorMessage
        self.sentAt = sentAt
        self.deliveredAt = deliveredAt
        self.openedAt = openedAt
        self.clickedAt = clickedAt
        self.retryCount = retryCount
    }
}

// MARK: - Email Template

/// An email template for newsletters
public struct EmailTemplate: Codable, Identifiable, Sendable {
    public let id: String
    public var newsletterId: String?
    public var name: String
    public var content: String
    public var contentType: ContentType
    public var thumbnail: String?
    public var createdBy: String
    public var createdAt: Date

    private let _v: String

    public init(
        id: String = UUID().uuidString,
        newsletterId: String? = nil,
        name: String,
        content: String,
        contentType: ContentType = .markdown,
        thumbnail: String? = nil,
        createdBy: String,
        createdAt: Date = Date()
    ) {
        self._v = NewsletterSchema.version
        self.id = id
        self.newsletterId = newsletterId
        self.name = name
        self.content = content
        self.contentType = contentType
        self.thumbnail = thumbnail
        self.createdBy = createdBy
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case _v
        case id, newsletterId, name, content, contentType, thumbnail
        case createdBy, createdAt
    }
}

// MARK: - CSV Import/Export

/// Represents a row from CSV import
public struct CSVSubscriberRow: Sendable {
    public var email: String?
    public var name: String?
    public var pubkey: String?
    public var segments: [String]
    public var customFields: [String: String]

    public init(
        email: String? = nil,
        name: String? = nil,
        pubkey: String? = nil,
        segments: [String] = [],
        customFields: [String: String] = [:]
    ) {
        self.email = email
        self.name = name
        self.pubkey = pubkey
        self.segments = segments
        self.customFields = customFields
    }

    public var isValid: Bool {
        // Must have either email or pubkey
        (email != nil && !email!.isEmpty) || (pubkey != nil && !pubkey!.isEmpty)
    }
}

/// Result of CSV import operation
public struct CSVImportResult: Sendable {
    public var imported: Int
    public var skipped: Int
    public var duplicates: Int
    public var errors: [String]

    public init(
        imported: Int = 0,
        skipped: Int = 0,
        duplicates: Int = 0,
        errors: [String] = []
    ) {
        self.imported = imported
        self.skipped = skipped
        self.duplicates = duplicates
        self.errors = errors
    }

    public var total: Int {
        imported + skipped + duplicates
    }
}

// MARK: - Batch Sending

/// Progress tracking for batch send operations
public struct BatchSendProgress: Sendable {
    public var total: Int
    public var sent: Int
    public var failed: Int
    public var remaining: Int
    public var isComplete: Bool
    public var startedAt: Date
    public var estimatedCompletion: Date?
    public var currentRate: Double // messages per second

    public init(
        total: Int,
        sent: Int = 0,
        failed: Int = 0,
        startedAt: Date = Date()
    ) {
        self.total = total
        self.sent = sent
        self.failed = failed
        self.remaining = total - sent - failed
        self.isComplete = (sent + failed) >= total
        self.startedAt = startedAt
        self.currentRate = 0
        self.estimatedCompletion = nil
    }

    public var progress: Double {
        guard total > 0 else { return 0 }
        return Double(sent + failed) / Double(total)
    }

    public var successRate: Double {
        let completed = sent + failed
        guard completed > 0 else { return 0 }
        return Double(sent) / Double(completed)
    }

    mutating public func updateProgress(sent: Int, failed: Int, rate: Double) {
        self.sent = sent
        self.failed = failed
        self.remaining = total - sent - failed
        self.isComplete = (sent + failed) >= total
        self.currentRate = rate

        if rate > 0 && remaining > 0 {
            let secondsRemaining = Double(remaining) / rate
            self.estimatedCompletion = Date().addingTimeInterval(secondsRemaining)
        }
    }
}
