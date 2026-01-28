// EventCallingIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration between Events and Calling modules for hybrid/virtual events.
// Enables virtual attendance, conference room management, and attendance tracking.

import Foundation
import Combine
import os.log

// MARK: - Supporting Types

/// Attendee action for tracking virtual attendance
public enum AttendeeAction: String, Codable, Sendable {
    case join
    case leave
}

/// Conference room details for an event
public struct EventConferenceRoom: Sendable, Codable, Identifiable {
    public let id: String
    public let roomId: String
    public let joinUrl: String
    public let hostKey: String?
    public var isActive: Bool
    public var participantCount: Int
    public let created: Date

    public init(
        roomId: String,
        joinUrl: String,
        hostKey: String? = nil,
        isActive: Bool = true,
        participantCount: Int = 0,
        created: Date = Date()
    ) {
        self.id = roomId
        self.roomId = roomId
        self.joinUrl = joinUrl
        self.hostKey = hostKey
        self.isActive = isActive
        self.participantCount = participantCount
        self.created = created
    }
}

/// Virtual attendance record for an event attendee
public struct VirtualAttendance: Sendable, Codable, Identifiable {
    public let id: String
    public let eventId: String
    public let pubkey: String
    public let joinedAt: Date
    public var leftAt: Date?
    public var durationSeconds: Int
    public var breakoutRoomId: String?

    public init(
        id: String,
        eventId: String,
        pubkey: String,
        joinedAt: Date,
        leftAt: Date? = nil,
        durationSeconds: Int = 0,
        breakoutRoomId: String? = nil
    ) {
        self.id = id
        self.eventId = eventId
        self.pubkey = pubkey
        self.joinedAt = joinedAt
        self.leftAt = leftAt
        self.durationSeconds = durationSeconds
        self.breakoutRoomId = breakoutRoomId
    }
}

/// Virtual attendance statistics for an event
public struct VirtualAttendanceStats: Sendable, Codable {
    public let totalVirtualAttendees: Int
    public let peakConcurrentAttendees: Int
    public let averageDurationMinutes: Double
    public let attendees: [AttendeeInfo]

    public init(
        totalVirtualAttendees: Int = 0,
        peakConcurrentAttendees: Int = 0,
        averageDurationMinutes: Double = 0,
        attendees: [AttendeeInfo] = []
    ) {
        self.totalVirtualAttendees = totalVirtualAttendees
        self.peakConcurrentAttendees = peakConcurrentAttendees
        self.averageDurationMinutes = averageDurationMinutes
        self.attendees = attendees
    }
}

/// Attendee information for stats
public struct AttendeeInfo: Sendable, Codable, Identifiable {
    public let id: String
    public let pubkey: String
    public let totalDurationMinutes: Double
    public let joinedAt: Date

    public init(pubkey: String, totalDurationMinutes: Double, joinedAt: Date) {
        self.id = pubkey
        self.pubkey = pubkey
        self.totalDurationMinutes = totalDurationMinutes
        self.joinedAt = joinedAt
    }
}

/// Configuration for join reminders
public struct JoinReminderConfig: Sendable, Codable {
    public let minutesBefore: Int
    public let message: String?

    public init(minutesBefore: Int = 15, message: String? = nil) {
        self.minutesBefore = minutesBefore
        self.message = message
    }
}

// MARK: - Event Calling Integration

/// Integration between Events and Calling modules for hybrid/virtual events
@MainActor
public class EventCallingIntegration: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var activeConferences: [String: EventConferenceRoom] = [:]
    @Published public private(set) var attendanceRecords: [String: [VirtualAttendance]] = [:]
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let callingStore: CallingStore
    private let eventsStore: EventsStore
    private let logger = Logger(subsystem: "com.buildit", category: "EventCallingIntegration")
    private var scheduledConferences: [String: Task<Void, Never>] = [:]

    // MARK: - Initialization

    public init(callingStore: CallingStore, eventsStore: EventsStore) {
        self.callingStore = callingStore
        self.eventsStore = eventsStore
    }

    // MARK: - Conference Room Management

    /// Start conference room for an event
    /// - Parameters:
    ///   - event: The event to start a conference for
    ///   - config: Virtual configuration for the event
    /// - Returns: Conference room details with join URL
    public func startEventConference(
        event: EventEntity,
        config: EventVirtualConfig
    ) async throws -> EventConferenceRoom {
        guard config.enabled else {
            throw EventCallingError.virtualNotEnabled
        }

        // Generate conference room ID if not already assigned
        let conferenceRoomId = config.conferenceRoomId ?? "event-\(event.id)-\(UUID().uuidString.prefix(8))"

        logger.info("Starting conference room for event: \(event.title)")

        // Create conference room via calling module
        // In production, this would integrate with the SFU conference manager
        let conferenceRoom = EventConferenceRoom(
            roomId: conferenceRoomId,
            joinUrl: "/conference/\(conferenceRoomId)",
            hostKey: UUID().uuidString.prefix(12).description,
            isActive: true,
            participantCount: 0,
            created: Date()
        )

        activeConferences[event.id] = conferenceRoom

        // Log the conference creation
        logger.info("Created conference room: \(conferenceRoomId) for event: \(event.id)")

        // Would integrate with CallingStore to create actual room
        // try await callingStore.saveGroupCall(
        //     roomId: conferenceRoomId,
        //     groupId: event.groupId,
        //     callType: .video,
        //     createdBy: event.createdBy
        // )

        return conferenceRoom
    }

    /// End conference and save recording
    /// - Parameter eventId: The event ID to end conference for
    /// - Returns: Recording URL if recording was enabled
    public func endEventConference(eventId: String) async throws -> String? {
        guard let conference = activeConferences[eventId] else {
            logger.warning("No active conference found for event: \(eventId)")
            return nil
        }

        logger.info("Ending conference for event: \(eventId)")

        let duration = Date().timeIntervalSince(conference.created)

        // In production, would:
        // 1. End the conference room via calling module
        // 2. Process and save recording if enabled
        // 3. Return recording URL

        // Clean up
        activeConferences.removeValue(forKey: eventId)

        // End group call in store
        // try callingStore.endGroupCall(roomId: conference.roomId)

        logger.info("Ended conference \(conference.roomId), duration: \(duration)s")

        // Return nil for now - in production would return actual recording URL
        return nil
    }

    /// Send join reminders to RSVPs
    /// - Parameters:
    ///   - event: The event to send reminders for
    ///   - rsvpPubkeys: List of pubkeys to send reminders to
    ///   - config: Reminder configuration
    public func sendJoinReminders(
        event: EventEntity,
        rsvpPubkeys: [String],
        config: JoinReminderConfig = JoinReminderConfig()
    ) async throws {
        guard let conference = activeConferences[event.id] else {
            logger.warning("No active conference to send reminders for: \(event.id)")
            return
        }

        let message = config.message ?? "The virtual event \"\(event.title)\" is starting in \(config.minutesBefore) minutes. Click to join: \(conference.joinUrl)"

        logger.info("Sending join reminders for event: \(event.title)")
        logger.info("Sending to \(rsvpPubkeys.count) recipients")

        // In production, would integrate with messaging module
        // for pubkey in rsvpPubkeys {
        //     try await messagingStore.sendNotification(to: pubkey, message: message)
        // }
    }

    // MARK: - Attendance Tracking

    /// Track virtual attendee for CRM
    /// - Parameters:
    ///   - eventId: The event ID
    ///   - pubkey: The attendee's pubkey
    ///   - action: Join or leave action
    /// - Returns: Virtual attendance record
    public func trackVirtualAttendee(
        eventId: String,
        pubkey: String,
        action: AttendeeAction
    ) async throws -> VirtualAttendance? {
        guard activeConferences[eventId] != nil else {
            logger.warning("No active conference to track attendance: \(eventId)")
            return nil
        }

        let now = Date()
        var records = attendanceRecords[eventId] ?? []

        switch action {
        case .join:
            let attendance = VirtualAttendance(
                id: "attendance-\(eventId)-\(pubkey)-\(Int(now.timeIntervalSince1970))",
                eventId: eventId,
                pubkey: pubkey,
                joinedAt: now,
                durationSeconds: 0
            )
            records.append(attendance)
            attendanceRecords[eventId] = records

            // Update participant count
            if var conference = activeConferences[eventId] {
                conference.participantCount += 1
                activeConferences[eventId] = conference
            }

            logger.info("Tracked join: \(pubkey) joined event \(eventId)")
            return attendance

        case .leave:
            // Find the most recent join record for this user
            if let index = records.lastIndex(where: { $0.pubkey == pubkey && $0.leftAt == nil }) {
                var record = records[index]
                record.leftAt = now
                record.durationSeconds = Int(now.timeIntervalSince(record.joinedAt))
                records[index] = record
                attendanceRecords[eventId] = records

                // Update participant count
                if var conference = activeConferences[eventId] {
                    conference.participantCount = max(0, conference.participantCount - 1)
                    activeConferences[eventId] = conference
                }

                logger.info("Tracked leave: \(pubkey) left event \(eventId), duration: \(record.durationSeconds)s")
                return record
            }
        }

        return nil
    }

    /// Get virtual attendance stats for an event
    /// - Parameter eventId: The event ID
    /// - Returns: Virtual attendance statistics
    public func getVirtualAttendanceStats(eventId: String) async throws -> VirtualAttendanceStats {
        let records = attendanceRecords[eventId] ?? []

        guard !records.isEmpty else {
            return VirtualAttendanceStats()
        }

        // Calculate unique attendees
        let uniquePubkeys = Set(records.map { $0.pubkey })

        // Calculate total duration per attendee
        var attendeeStats: [String: (duration: Int, joinedAt: Date)] = [:]
        for record in records {
            let duration = record.durationSeconds
            if let existing = attendeeStats[record.pubkey] {
                attendeeStats[record.pubkey] = (existing.duration + duration, min(existing.joinedAt, record.joinedAt))
            } else {
                attendeeStats[record.pubkey] = (duration, record.joinedAt)
            }
        }

        // Calculate average duration
        let totalDuration = attendeeStats.values.reduce(0) { $0 + $1.duration }
        let averageDuration = uniquePubkeys.isEmpty ? 0 : Double(totalDuration) / Double(uniquePubkeys.count) / 60.0

        // Calculate peak concurrent (simplified - would need time-series analysis in production)
        let peakConcurrent = activeConferences[eventId]?.participantCount ?? records.count

        // Build attendee info list
        let attendees = attendeeStats.map { pubkey, stats in
            AttendeeInfo(
                pubkey: pubkey,
                totalDurationMinutes: Double(stats.duration) / 60.0,
                joinedAt: stats.joinedAt
            )
        }.sorted { $0.joinedAt < $1.joinedAt }

        return VirtualAttendanceStats(
            totalVirtualAttendees: uniquePubkeys.count,
            peakConcurrentAttendees: peakConcurrent,
            averageDurationMinutes: averageDuration,
            attendees: attendees
        )
    }

    // MARK: - Conference Scheduling

    /// Schedule automatic conference start
    /// - Parameters:
    ///   - event: The event to schedule
    ///   - config: Virtual configuration
    ///   - rsvpPubkeys: List of RSVPs to notify
    public func scheduleConferenceStart(
        event: EventEntity,
        config: EventVirtualConfig,
        rsvpPubkeys: [String]
    ) {
        // Cancel any existing scheduled task
        scheduledConferences[event.id]?.cancel()

        let startTime = event.startAt.addingTimeInterval(TimeInterval(-config.autoStartMinutes * 60))
        let delay = startTime.timeIntervalSinceNow

        if delay <= 0 {
            // Event is starting or has started, start conference immediately
            Task {
                do {
                    _ = try await startEventConference(event: event, config: config)
                    try await sendJoinReminders(event: event, rsvpPubkeys: rsvpPubkeys)
                } catch {
                    logger.error("Failed to start conference: \(error.localizedDescription)")
                    lastError = error.localizedDescription
                }
            }
            return
        }

        logger.info("Scheduled conference start for event: \(event.title)")
        logger.info("Starting in \(Int(delay))s, autoStartMinutes: \(config.autoStartMinutes)")

        // Schedule the conference start
        let task = Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

            guard !Task.isCancelled else { return }

            do {
                _ = try await startEventConference(event: event, config: config)
                try await sendJoinReminders(event: event, rsvpPubkeys: rsvpPubkeys)
            } catch {
                await MainActor.run {
                    self.logger.error("Failed to start scheduled conference: \(error.localizedDescription)")
                    self.lastError = error.localizedDescription
                }
            }
        }

        scheduledConferences[event.id] = task
    }

    /// Cancel scheduled conference
    /// - Parameter eventId: The event ID to cancel
    public func cancelScheduledConference(eventId: String) {
        scheduledConferences[eventId]?.cancel()
        scheduledConferences.removeValue(forKey: eventId)
        logger.info("Cancelled scheduled conference for event: \(eventId)")
    }

    // MARK: - Breakout Rooms

    /// Create breakout rooms for an event conference
    /// - Parameters:
    ///   - eventId: The event ID
    ///   - config: Breakout room configuration
    /// - Returns: List of created room IDs
    public func createBreakoutRooms(
        eventId: String,
        config: BreakoutRoomConfig
    ) async throws -> [String] {
        guard let conference = activeConferences[eventId] else {
            throw EventCallingError.conferenceNotFound
        }

        guard config.enabled, let roomCount = config.roomCount, roomCount > 0 else {
            throw EventCallingError.invalidBreakoutConfig
        }

        var roomIds: [String] = []

        for i in 0..<roomCount {
            let roomId = "\(conference.roomId)-breakout-\(i + 1)"
            let roomName = config.roomNames?[safe: i] ?? "Breakout Room \(i + 1)"

            roomIds.append(roomId)

            logger.info("Created breakout room: \(roomName)")
            logger.info("Event: \(eventId), Room ID: \(roomId)")
        }

        // In production, would integrate with calling module to create actual breakout rooms
        // await callingStore.createBreakoutRooms(conference.roomId, rooms: roomIds, autoAssign: config.autoAssign)

        return roomIds
    }

    // MARK: - Conference Status

    /// Get conference room for an event
    /// - Parameter eventId: The event ID
    /// - Returns: Conference room details if active
    public func getConferenceRoom(eventId: String) -> EventConferenceRoom? {
        activeConferences[eventId]
    }

    /// Check if event has an active conference
    /// - Parameter eventId: The event ID
    /// - Returns: True if conference is active
    public func isConferenceActive(eventId: String) -> Bool {
        activeConferences[eventId]?.isActive ?? false
    }

    /// Get join URL for an event
    /// - Parameter eventId: The event ID
    /// - Returns: Join URL if conference is active
    public func getJoinUrl(eventId: String) -> String? {
        activeConferences[eventId]?.joinUrl
    }

    /// Check if calling module is available
    /// - Returns: True if calling module is available
    public func isCallingModuleAvailable() async -> Bool {
        // In production, would check if calling module is enabled and configured
        return true
    }
}

// MARK: - Errors

/// Errors for event calling integration
public enum EventCallingError: LocalizedError, Sendable {
    case virtualNotEnabled
    case conferenceNotFound
    case invalidBreakoutConfig
    case callingModuleUnavailable

    public var errorDescription: String? {
        switch self {
        case .virtualNotEnabled:
            return "Virtual attendance is not enabled for this event"
        case .conferenceNotFound:
            return "No active conference found for this event"
        case .invalidBreakoutConfig:
            return "Invalid breakout room configuration"
        case .callingModuleUnavailable:
            return "Calling module is not available"
        }
    }
}

// MARK: - Array Extension

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
