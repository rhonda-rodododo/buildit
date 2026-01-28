// TrainingEventsIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration between Training and Events modules for training events.

import Foundation
import os.log

/// Training event configuration
public struct TrainingEventConfig: Sendable {
    public var courseId: String
    public var lessonId: String?
    public var title: String
    public var description: String?
    public var startTime: Date
    public var endTime: Date
    public var location: String?
    public var maxParticipants: Int?
    public var requiresRSVP: Bool
    public var isVirtual: Bool

    public init(
        courseId: String,
        lessonId: String? = nil,
        title: String,
        description: String? = nil,
        startTime: Date,
        endTime: Date,
        location: String? = nil,
        maxParticipants: Int? = nil,
        requiresRSVP: Bool = true,
        isVirtual: Bool = false
    ) {
        self.courseId = courseId
        self.lessonId = lessonId
        self.title = title
        self.description = description
        self.startTime = startTime
        self.endTime = endTime
        self.location = location
        self.maxParticipants = maxParticipants
        self.requiresRSVP = requiresRSVP
        self.isVirtual = isVirtual
    }
}

/// Event linked to training
public struct TrainingLinkedEvent: Identifiable, Sendable {
    public var id: String { eventId }
    public var eventId: String
    public var courseId: String
    public var lessonId: String?
    public var courseName: String
    public var lessonName: String?
    public var trainingType: TrainingType

    public enum TrainingType: String, Sendable {
        case course
        case liveSession = "live-session"
        case workshop
    }

    public init(
        eventId: String,
        courseId: String,
        lessonId: String? = nil,
        courseName: String,
        lessonName: String? = nil,
        trainingType: TrainingType
    ) {
        self.eventId = eventId
        self.courseId = courseId
        self.lessonId = lessonId
        self.courseName = courseName
        self.lessonName = lessonName
        self.trainingType = trainingType
    }
}

/// Upcoming training event with start time
public struct UpcomingTrainingEvent: Identifiable, Sendable {
    public var id: String { linkedEvent.eventId }
    public var linkedEvent: TrainingLinkedEvent
    public var eventStartTime: Date

    public init(linkedEvent: TrainingLinkedEvent, eventStartTime: Date) {
        self.linkedEvent = linkedEvent
        self.eventStartTime = eventStartTime
    }
}

/// Integration between Training and Events modules
@MainActor
public class TrainingEventsIntegration {
    // MARK: - Properties

    private let manager: TrainingManager
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingEventsIntegration")

    // In-memory storage for event links (would use database in production)
    private var eventLinks: [String: TrainingLinkedEvent] = [:] // eventId -> link

    // MARK: - Initialization

    public init(manager: TrainingManager) {
        self.manager = manager
    }

    // MARK: - Event Management

    /// Create an event for a training course
    public func createTrainingEvent(config: TrainingEventConfig) async throws -> String {
        guard let course = try await manager.getCourse(id: config.courseId) else {
            throw TrainingError.courseNotFound
        }

        var lessonName: String?
        if let lessonId = config.lessonId {
            let lesson = try await manager.getLesson(id: lessonId)
            lessonName = lesson?.title
        }

        // In a real implementation, this would create an event via the events module
        let eventId = "training-event-\(Int(Date().timeIntervalSince1970))"

        // Store link
        let link = TrainingLinkedEvent(
            eventId: eventId,
            courseId: config.courseId,
            lessonId: config.lessonId,
            courseName: course.title,
            lessonName: lessonName,
            trainingType: config.lessonId != nil ? .liveSession : .course
        )
        eventLinks[eventId] = link

        logger.info("Created training event \(eventId) for course \(course.title)\(lessonName.map { " - \($0)" } ?? "")")

        return eventId
    }

    /// Link an existing event to a training course or lesson
    public func linkEventToTraining(
        eventId: String,
        courseId: String,
        lessonId: String? = nil
    ) async throws {
        guard let course = try await manager.getCourse(id: courseId) else {
            throw TrainingError.courseNotFound
        }

        var lessonName: String?
        if let lessonId = lessonId {
            let lesson = try await manager.getLesson(id: lessonId)
            lessonName = lesson?.title
        }

        let link = TrainingLinkedEvent(
            eventId: eventId,
            courseId: courseId,
            lessonId: lessonId,
            courseName: course.title,
            lessonName: lessonName,
            trainingType: lessonId != nil ? .liveSession : .course
        )
        eventLinks[eventId] = link

        logger.info("Linked event \(eventId) to training course \(courseId)")
    }

    /// Get events linked to a specific course
    public func getEventsForCourse(courseId: String) async throws -> [TrainingLinkedEvent] {
        eventLinks.values.filter { $0.courseId == courseId }
    }

    /// Get training info for an event
    public func getTrainingForEvent(eventId: String) async throws -> TrainingLinkedEvent? {
        eventLinks[eventId]
    }

    /// Unlink an event from training
    public func unlinkEvent(eventId: String) async throws {
        eventLinks.removeValue(forKey: eventId)
        logger.info("Unlinked event \(eventId) from training")
    }

    // MARK: - Live Session Management

    /// Create live session from scheduled event
    public func createLiveSessionFromEvent(
        eventId: String,
        courseId: String,
        moduleId: String,
        instructorPubkey: String,
        scheduledAt: Date,
        duration: Int
    ) async throws -> String {
        // Create a live session lesson in the training module
        let lessonData = CreateLessonData(
            moduleId: moduleId,
            type: .liveSession,
            title: "Live Training Session - \(scheduledAt.formatted(date: .abbreviated, time: .shortened))",
            content: .liveSession(LiveSessionContent(
                scheduledAt: scheduledAt,
                duration: duration,
                instructorPubkey: instructorPubkey,
                requiresRSVP: true
            )),
            estimatedMinutes: duration,
            requiredForCertification: true
        )

        let lesson = try await manager.createLesson(data: lessonData)

        // Link event to the new lesson
        try await linkEventToTraining(eventId: eventId, courseId: courseId, lessonId: lesson.id)

        logger.info("Created live session \(lesson.id) from event \(eventId)")

        return lesson.id
    }

    // MARK: - RSVP Sync

    /// Sync event RSVP to training enrollment
    public func syncEventRSVPToTraining(
        eventId: String,
        pubkey: String,
        rsvpStatus: RSVPSyncStatus
    ) async throws {
        guard let trainingInfo = eventLinks[eventId] else {
            return // Not a training event
        }

        if rsvpStatus == .attending {
            // Enroll in course
            // In a real implementation, would call enrollment method
            logger.info("Enrolling \(pubkey) in course \(trainingInfo.courseId) from event RSVP")

            // If there's a specific lesson, RSVP to it
            if let lessonId = trainingInfo.lessonId {
                try await manager.rsvpLiveSession(lessonId, status: .confirmed)
            }
        }

        logger.info("Synced RSVP for \(pubkey) to training \(trainingInfo.courseId): \(rsvpStatus.rawValue)")
    }

    /// RSVP sync status
    public enum RSVPSyncStatus: String, Sendable {
        case attending
        case notAttending = "not_attending"
        case maybe
    }

    // MARK: - Queries

    /// Get upcoming training events
    public func getUpcomingTrainingEvents(
        groupId: String? = nil,
        limit: Int = 10
    ) async throws -> [UpcomingTrainingEvent] {
        // In a real implementation, would query events module for training-linked events
        // filtered by group and sorted by start time
        return []
    }

    /// Check if events module is available
    public func isEventsModuleAvailable() async -> Bool {
        // In a real implementation, would check if events module is enabled
        return true
    }

    // MARK: - Attendance Tracking

    /// Track event attendance for training progress
    public func trackEventAttendance(
        eventId: String,
        pubkey: String,
        checkInTime: Date,
        checkOutTime: Date? = nil
    ) async throws {
        guard let trainingInfo = eventLinks[eventId],
              let lessonId = trainingInfo.lessonId else {
            return
        }

        // Record attendance
        try await manager.recordLiveAttendance(
            lessonId: lessonId,
            joinedAt: checkInTime,
            leftAt: checkOutTime
        )

        // If attended long enough, mark lesson complete
        let duration = (checkOutTime ?? Date()).timeIntervalSince(checkInTime)
        if duration > 30 * 60 { // 30 minutes
            try await manager.completeLesson(lessonId)
        }

        logger.info("Tracked event attendance for \(pubkey) at training event \(eventId)")
    }

    // MARK: - Calendar Integration

    /// Generate calendar data for training events
    public func getTrainingCalendarEvents(
        courseId: String? = nil,
        startDate: Date,
        endDate: Date
    ) async throws -> [TrainingCalendarEvent] {
        // In a real implementation, would query and format events for calendar display
        return []
    }

    /// Export training events to iCal format
    public func exportToICal(events: [TrainingLinkedEvent]) async throws -> String {
        // In a real implementation, would generate iCal string
        var ical = """
        BEGIN:VCALENDAR
        VERSION:2.0
        PRODID:-//BuildIt//Training//EN
        """

        for event in events {
            ical += """

            BEGIN:VEVENT
            UID:\(event.eventId)
            SUMMARY:\(event.courseName)
            DESCRIPTION:Training event for \(event.courseName)
            END:VEVENT
            """
        }

        ical += "\nEND:VCALENDAR"
        return ical
    }
}

/// Calendar event for training
public struct TrainingCalendarEvent: Identifiable, Sendable {
    public var id: String
    public var eventId: String
    public var title: String
    public var startDate: Date
    public var endDate: Date
    public var courseId: String
    public var lessonId: String?
    public var isVirtual: Bool
    public var location: String?

    public init(
        id: String,
        eventId: String,
        title: String,
        startDate: Date,
        endDate: Date,
        courseId: String,
        lessonId: String? = nil,
        isVirtual: Bool = false,
        location: String? = nil
    ) {
        self.id = id
        self.eventId = eventId
        self.title = title
        self.startDate = startDate
        self.endDate = endDate
        self.courseId = courseId
        self.lessonId = lessonId
        self.isVirtual = isVirtual
        self.location = location
    }
}
