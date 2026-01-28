// EventVirtualConfig.swift
// BuildIt - Decentralized Mesh Communication
//
// Virtual event configuration for hybrid/virtual events.
// Enables conference room auto-creation, recording, and breakout rooms.

import Foundation

// MARK: - Event Attendance Type

/// Event attendance type for hybrid events
public enum EventAttendanceType: String, Codable, Sendable, CaseIterable {
    case inPerson = "in-person"
    case virtual
    case hybrid

    public var displayName: String {
        switch self {
        case .inPerson:
            return "In-Person"
        case .virtual:
            return "Virtual"
        case .hybrid:
            return "Hybrid"
        }
    }

    public var icon: String {
        switch self {
        case .inPerson:
            return "person.3.fill"
        case .virtual:
            return "video.fill"
        case .hybrid:
            return "rectangle.on.rectangle.angled"
        }
    }
}

// MARK: - Breakout Room Configuration

/// Configuration for breakout rooms in virtual events
public struct BreakoutRoomConfig: Codable, Sendable, Equatable {
    /// Whether breakout rooms are enabled
    public var enabled: Bool

    /// Automatically assign participants to rooms
    public var autoAssign: Bool

    /// Number of breakout rooms to create
    public var roomCount: Int?

    /// Custom names for breakout rooms
    public var roomNames: [String]?

    /// Allow participants to select their own room
    public var allowSelfSelect: Bool

    /// Duration of breakout session in minutes
    public var duration: Int?

    public init(
        enabled: Bool = false,
        autoAssign: Bool = true,
        roomCount: Int? = nil,
        roomNames: [String]? = nil,
        allowSelfSelect: Bool = false,
        duration: Int? = nil
    ) {
        self.enabled = enabled
        self.autoAssign = autoAssign
        self.roomCount = roomCount
        self.roomNames = roomNames
        self.allowSelfSelect = allowSelfSelect
        self.duration = duration
    }

    // MARK: - Validation

    /// Validates the breakout room configuration
    public var isValid: Bool {
        if !enabled { return true }
        guard let count = roomCount, count >= 2, count <= 50 else { return false }
        if let names = roomNames, names.count != count { return false }
        if let dur = duration, dur < 1 || dur > 240 { return false }
        return true
    }

    /// Creates a default configuration with specified room count
    public static func defaultConfig(roomCount: Int) -> BreakoutRoomConfig {
        BreakoutRoomConfig(
            enabled: true,
            autoAssign: true,
            roomCount: roomCount,
            allowSelfSelect: false
        )
    }
}

// MARK: - Virtual Event Configuration

/// Virtual event configuration for hybrid/virtual events
/// Enables conference room auto-creation, recording, and breakout rooms
public struct EventVirtualConfig: Codable, Sendable, Equatable {
    /// Whether virtual attendance is enabled
    public var enabled: Bool

    /// Auto-created conference room ID when event starts
    public var conferenceRoomId: String?

    /// Minutes before event to auto-start room (default: 15)
    public var autoStartMinutes: Int

    /// Enable waiting room before admitting participants
    public var waitingRoomEnabled: Bool

    /// Enable recording of the conference
    public var recordingEnabled: Bool

    /// Require explicit consent for recording
    public var recordingConsentRequired: Bool

    /// Maximum number of virtual attendees
    public var maxVirtualAttendees: Int?

    /// Enable breakout room functionality
    public var breakoutRoomsEnabled: Bool

    /// Breakout room configuration
    public var breakoutConfig: BreakoutRoomConfig?

    /// Recording URL (available after event if recorded)
    public var recordingUrl: String?

    /// Require end-to-end encryption
    public var e2eeRequired: Bool

    // MARK: - Initialization

    public init(
        enabled: Bool = false,
        conferenceRoomId: String? = nil,
        autoStartMinutes: Int = 15,
        waitingRoomEnabled: Bool = true,
        recordingEnabled: Bool = false,
        recordingConsentRequired: Bool = true,
        maxVirtualAttendees: Int? = nil,
        breakoutRoomsEnabled: Bool = false,
        breakoutConfig: BreakoutRoomConfig? = nil,
        recordingUrl: String? = nil,
        e2eeRequired: Bool = true
    ) {
        self.enabled = enabled
        self.conferenceRoomId = conferenceRoomId
        self.autoStartMinutes = autoStartMinutes
        self.waitingRoomEnabled = waitingRoomEnabled
        self.recordingEnabled = recordingEnabled
        self.recordingConsentRequired = recordingConsentRequired
        self.maxVirtualAttendees = maxVirtualAttendees
        self.breakoutRoomsEnabled = breakoutRoomsEnabled
        self.breakoutConfig = breakoutConfig
        self.recordingUrl = recordingUrl
        self.e2eeRequired = e2eeRequired
    }

    // MARK: - Factory Methods

    /// Creates a default virtual-only event configuration
    public static var virtualDefault: EventVirtualConfig {
        EventVirtualConfig(
            enabled: true,
            autoStartMinutes: 15,
            waitingRoomEnabled: true,
            recordingEnabled: false,
            recordingConsentRequired: true,
            breakoutRoomsEnabled: false,
            e2eeRequired: true
        )
    }

    /// Creates a default hybrid event configuration
    public static var hybridDefault: EventVirtualConfig {
        EventVirtualConfig(
            enabled: true,
            autoStartMinutes: 10,
            waitingRoomEnabled: false,
            recordingEnabled: true,
            recordingConsentRequired: true,
            breakoutRoomsEnabled: false,
            e2eeRequired: true
        )
    }

    /// Creates a webinar-style configuration (large audience)
    public static func webinar(maxAttendees: Int) -> EventVirtualConfig {
        EventVirtualConfig(
            enabled: true,
            autoStartMinutes: 30,
            waitingRoomEnabled: true,
            recordingEnabled: true,
            recordingConsentRequired: true,
            maxVirtualAttendees: maxAttendees,
            breakoutRoomsEnabled: false,
            e2eeRequired: false // May be disabled for large webinars
        )
    }

    /// Creates a workshop-style configuration with breakout rooms
    public static func workshop(breakoutRooms: Int) -> EventVirtualConfig {
        EventVirtualConfig(
            enabled: true,
            autoStartMinutes: 15,
            waitingRoomEnabled: true,
            recordingEnabled: false,
            recordingConsentRequired: true,
            breakoutRoomsEnabled: true,
            breakoutConfig: BreakoutRoomConfig.defaultConfig(roomCount: breakoutRooms),
            e2eeRequired: true
        )
    }

    // MARK: - Validation

    /// Validates the virtual configuration
    public var isValid: Bool {
        if !enabled { return true }
        if autoStartMinutes < 0 || autoStartMinutes > 60 { return false }
        if let max = maxVirtualAttendees, max < 1 { return false }
        if breakoutRoomsEnabled, let config = breakoutConfig, !config.isValid { return false }
        return true
    }

    /// Returns validation errors if any
    public var validationErrors: [String] {
        var errors: [String] = []

        if autoStartMinutes < 0 || autoStartMinutes > 60 {
            errors.append("Auto-start minutes must be between 0 and 60")
        }

        if let max = maxVirtualAttendees, max < 1 {
            errors.append("Maximum attendees must be at least 1")
        }

        if breakoutRoomsEnabled {
            if let config = breakoutConfig {
                if !config.isValid {
                    errors.append("Invalid breakout room configuration")
                }
            } else {
                errors.append("Breakout rooms enabled but no configuration provided")
            }
        }

        return errors
    }
}

// MARK: - Event Entity Extension

extension EventEntity {
    /// Virtual configuration for the event (JSON encoded)
    public var virtualConfig: EventVirtualConfig? {
        get {
            guard let data = virtualConfigJSON else { return nil }
            return try? JSONDecoder().decode(EventVirtualConfig.self, from: data)
        }
        set {
            virtualConfigJSON = try? JSONEncoder().encode(newValue)
        }
    }

    /// Attendance type for the event
    public var attendanceType: EventAttendanceType {
        get {
            guard let type = attendanceTypeRaw else { return .inPerson }
            return EventAttendanceType(rawValue: type) ?? .inPerson
        }
        set {
            attendanceTypeRaw = newValue.rawValue
        }
    }

    /// Whether this event has virtual attendance enabled
    public var hasVirtualAttendance: Bool {
        virtualConfig?.enabled ?? false
    }

    /// Whether this event is a hybrid event
    public var isHybrid: Bool {
        attendanceType == .hybrid
    }

    /// Whether this event is virtual-only
    public var isVirtualOnly: Bool {
        attendanceType == .virtual
    }
}

// MARK: - Additional EventEntity Properties (to be added to EventEntity.swift)

extension EventEntity {
    /// Raw storage for virtual config JSON - add this property to EventEntity model
    @objc dynamic var virtualConfigJSON: Data? {
        get { return nil } // Placeholder - actual implementation in SwiftData model
        set { } // Placeholder
    }

    /// Raw storage for attendance type - add this property to EventEntity model
    @objc dynamic var attendanceTypeRaw: String? {
        get { return nil } // Placeholder - actual implementation in SwiftData model
        set { } // Placeholder
    }
}
