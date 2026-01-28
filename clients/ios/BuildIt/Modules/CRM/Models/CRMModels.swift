// CRMModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Core CRM models for contact management and call history.
// Used by the CRM-Calling integration.

import Foundation

// MARK: - CRM Contact

/// CRM Contact record structure
public struct CRMContact: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let tableId: String
    public let groupId: String

    // Common fields
    public var name: String?
    public var fullName: String?
    public var email: String?
    public var phone: String?
    public var mobile: String?
    public var workPhone: String?
    public var pubkey: String? // Nostr identity link

    // Custom fields (dynamic)
    public var customFields: [String: AnyCodableValue]

    // Metadata
    public let created: Date
    public let createdBy: String
    public var updated: Date
    public var updatedBy: String

    public init(
        id: String,
        tableId: String,
        groupId: String,
        name: String? = nil,
        fullName: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        mobile: String? = nil,
        workPhone: String? = nil,
        pubkey: String? = nil,
        customFields: [String: AnyCodableValue] = [:],
        created: Date = Date(),
        createdBy: String,
        updated: Date = Date(),
        updatedBy: String
    ) {
        self.id = id
        self.tableId = tableId
        self.groupId = groupId
        self.name = name
        self.fullName = fullName
        self.email = email
        self.phone = phone
        self.mobile = mobile
        self.workPhone = workPhone
        self.pubkey = pubkey
        self.customFields = customFields
        self.created = created
        self.createdBy = createdBy
        self.updated = updated
        self.updatedBy = updatedBy
    }

    /// Display name for the contact
    public var displayName: String {
        fullName ?? name ?? email ?? phone ?? "Unknown"
    }

    /// All phone numbers for this contact
    public var allPhoneNumbers: [String] {
        [phone, mobile, workPhone].compactMap { $0 }
    }
}

// MARK: - Call Direction

/// Direction of a phone call
public enum CallDirection: String, Codable, Sendable, CaseIterable {
    case inbound
    case outbound

    public var displayName: String {
        switch self {
        case .inbound: return "Inbound"
        case .outbound: return "Outbound"
        }
    }

    public var icon: String {
        switch self {
        case .inbound: return "phone.arrow.down.left"
        case .outbound: return "phone.arrow.up.right"
        }
    }
}

// MARK: - Call Status

/// Status of a call
public enum CallStatus: String, Codable, Sendable, CaseIterable {
    case completed
    case missed
    case voicemail
    case failed

    public var displayName: String {
        switch self {
        case .completed: return "Completed"
        case .missed: return "Missed"
        case .voicemail: return "Voicemail"
        case .failed: return "Failed"
        }
    }

    public var icon: String {
        switch self {
        case .completed: return "checkmark.circle"
        case .missed: return "phone.down"
        case .voicemail: return "mic"
        case .failed: return "exclamationmark.triangle"
        }
    }

    public var tintColor: String {
        switch self {
        case .completed: return "green"
        case .missed: return "red"
        case .voicemail: return "orange"
        case .failed: return "gray"
        }
    }
}

// MARK: - Call History Record

/// Record of a call with a contact
public struct CallHistoryRecord: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let contactId: String
    public let direction: CallDirection
    public let phoneNumber: String
    public let startedAt: Date
    public var endedAt: Date?
    public var duration: Int // seconds
    public var status: CallStatus
    public var recordingUrl: String?
    public var transcriptUrl: String?
    public var notes: String?
    public var operatorPubkey: String?
    public var hotlineId: String?
    public let created: Date

    public init(
        id: String,
        contactId: String,
        direction: CallDirection,
        phoneNumber: String,
        startedAt: Date,
        endedAt: Date? = nil,
        duration: Int = 0,
        status: CallStatus = .completed,
        recordingUrl: String? = nil,
        transcriptUrl: String? = nil,
        notes: String? = nil,
        operatorPubkey: String? = nil,
        hotlineId: String? = nil,
        created: Date = Date()
    ) {
        self.id = id
        self.contactId = contactId
        self.direction = direction
        self.phoneNumber = phoneNumber
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.duration = duration
        self.status = status
        self.recordingUrl = recordingUrl
        self.transcriptUrl = transcriptUrl
        self.notes = notes
        self.operatorPubkey = operatorPubkey
        self.hotlineId = hotlineId
        self.created = created
    }

    /// Formatted duration string
    public var formattedDuration: String {
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        let seconds = duration % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }

    /// Whether the call has a recording
    public var hasRecording: Bool {
        recordingUrl != nil
    }

    /// Whether the call has a transcript
    public var hasTranscript: Bool {
        transcriptUrl != nil
    }
}

// MARK: - Call History Options

/// Options for filtering call history
public struct CallHistoryOptions: Sendable {
    public var limit: Int?
    public var offset: Int?
    public var direction: CallDirection?
    public var dateFrom: Date?
    public var dateTo: Date?

    public init(
        limit: Int? = nil,
        offset: Int? = nil,
        direction: CallDirection? = nil,
        dateFrom: Date? = nil,
        dateTo: Date? = nil
    ) {
        self.limit = limit
        self.offset = offset
        self.direction = direction
        self.dateFrom = dateFrom
        self.dateTo = dateTo
    }

    public static var recentCalls: CallHistoryOptions {
        CallHistoryOptions(limit: 50)
    }

    public static func lastWeek() -> CallHistoryOptions {
        CallHistoryOptions(dateFrom: Date().addingTimeInterval(-7 * 24 * 60 * 60))
    }
}

// MARK: - Phone Field Type

/// Type of phone field that matched in lookup
public enum PhoneFieldType: String, Codable, Sendable {
    case phone
    case mobile
    case workPhone = "work_phone"

    public var displayName: String {
        switch self {
        case .phone: return "Phone"
        case .mobile: return "Mobile"
        case .workPhone: return "Work Phone"
        }
    }
}

// MARK: - Caller Lookup Result

/// Result of looking up a caller by phone number
public struct CallerLookupResult: Sendable {
    public let found: Bool
    public let contact: CRMContact?
    public let matchedField: PhoneFieldType?
    public let previousCalls: Int?
    public let lastCallDate: Date?

    public init(
        found: Bool,
        contact: CRMContact? = nil,
        matchedField: PhoneFieldType? = nil,
        previousCalls: Int? = nil,
        lastCallDate: Date? = nil
    ) {
        self.found = found
        self.contact = contact
        self.matchedField = matchedField
        self.previousCalls = previousCalls
        self.lastCallDate = lastCallDate
    }

    public static var notFound: CallerLookupResult {
        CallerLookupResult(found: false)
    }
}

// MARK: - Call Engagement Update

/// Result of updating engagement score from a call
public struct CallEngagementUpdate: Sendable {
    public let contactId: String
    public let previousScore: Int
    public let newScore: Int
    public let callDuration: Int
    public let callDirection: CallDirection

    public init(
        contactId: String,
        previousScore: Int,
        newScore: Int,
        callDuration: Int,
        callDirection: CallDirection
    ) {
        self.contactId = contactId
        self.previousScore = previousScore
        self.newScore = newScore
        self.callDuration = callDuration
        self.callDirection = callDirection
    }

    public var scoreChange: Int {
        newScore - previousScore
    }
}

// MARK: - Contact Call Stats

/// Call statistics for a contact
public struct ContactCallStats: Sendable {
    public let totalCalls: Int
    public let inboundCalls: Int
    public let outboundCalls: Int
    public let totalDuration: Int // seconds
    public let averageDuration: Int // seconds
    public let lastCallDate: Date?
    public let missedCalls: Int

    public init(
        totalCalls: Int = 0,
        inboundCalls: Int = 0,
        outboundCalls: Int = 0,
        totalDuration: Int = 0,
        averageDuration: Int = 0,
        lastCallDate: Date? = nil,
        missedCalls: Int = 0
    ) {
        self.totalCalls = totalCalls
        self.inboundCalls = inboundCalls
        self.outboundCalls = outboundCalls
        self.totalDuration = totalDuration
        self.averageDuration = averageDuration
        self.lastCallDate = lastCallDate
        self.missedCalls = missedCalls
    }

    /// Formatted total duration string
    public var formattedTotalDuration: String {
        let hours = totalDuration / 3600
        let minutes = (totalDuration % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    public static var empty: ContactCallStats {
        ContactCallStats()
    }
}

// MARK: - Create Contact From Call Data

/// Data for creating a contact from a call
public struct CreateContactFromCallData: Sendable {
    public let phoneNumber: String
    public var name: String?
    public var notes: String?
    public var hotlineId: String?
    public var operatorPubkey: String?

    public init(
        phoneNumber: String,
        name: String? = nil,
        notes: String? = nil,
        hotlineId: String? = nil,
        operatorPubkey: String? = nil
    ) {
        self.phoneNumber = phoneNumber
        self.name = name
        self.notes = notes
        self.hotlineId = hotlineId
        self.operatorPubkey = operatorPubkey
    }
}

// MARK: - AnyCodableValue

/// Type-erased codable value for custom fields
public enum AnyCodableValue: Codable, Sendable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodableValue])
    case dictionary([String: AnyCodableValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([AnyCodableValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: AnyCodableValue].self) {
            self = .dictionary(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unable to decode value"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .dictionary(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var intValue: Int? {
        if case .int(let value) = self { return value }
        return nil
    }
}
