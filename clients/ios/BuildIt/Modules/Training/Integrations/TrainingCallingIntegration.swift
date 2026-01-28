// TrainingCallingIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration between Training and Calling modules for live training sessions.

import Foundation
import os.log

/// Conference room configuration for training
public struct TrainingConferenceConfig: Sendable {
    public var name: String
    public var maxParticipants: Int?
    public var waitingRoom: Bool
    public var allowRecording: Bool
    public var e2eeRequired: Bool
    public var instructorPubkey: String

    public init(
        name: String,
        maxParticipants: Int? = nil,
        waitingRoom: Bool = true,
        allowRecording: Bool = true,
        e2eeRequired: Bool = true,
        instructorPubkey: String
    ) {
        self.name = name
        self.maxParticipants = maxParticipants
        self.waitingRoom = waitingRoom
        self.allowRecording = allowRecording
        self.e2eeRequired = e2eeRequired
        self.instructorPubkey = instructorPubkey
    }
}

/// Result of creating a live session
public struct LiveSessionCreationResult: Sendable {
    public var conferenceRoomId: String
    public var joinUrl: String

    public init(conferenceRoomId: String, joinUrl: String) {
        self.conferenceRoomId = conferenceRoomId
        self.joinUrl = joinUrl
    }
}

/// Conference room details
public struct ConferenceDetails: Sendable {
    public var conferenceRoomId: String?
    public var isActive: Bool
    public var participantCount: Int

    public init(conferenceRoomId: String? = nil, isActive: Bool = false, participantCount: Int = 0) {
        self.conferenceRoomId = conferenceRoomId
        self.isActive = isActive
        self.participantCount = participantCount
    }
}

/// Integration between Training and Calling modules
@MainActor
public class TrainingCallingIntegration {
    // MARK: - Properties

    private let manager: TrainingManager
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingCallingIntegration")

    // MARK: - Initialization

    public init(manager: TrainingManager) {
        self.manager = manager
    }

    // MARK: - Live Session Management

    /// Create a conference room for a live training session
    public func createLiveSession(
        lesson: Lesson,
        config: TrainingConferenceConfig
    ) async throws -> LiveSessionCreationResult {
        guard lesson.type == .liveSession else {
            throw TrainingError.invalidData
        }

        // Generate conference room ID
        let conferenceRoomId = "training-\(lesson.id)-\(UUID().uuidString.prefix(8))"

        // In a real implementation, this would call the CallingModule to create a room
        logger.info("Creating conference room for training session: \(conferenceRoomId)")

        // Generate join URL
        let joinUrl = "/conference/\(conferenceRoomId)"

        // Update the lesson with conference room ID
        if case .liveSession(var liveContent) = lesson.content {
            liveContent.conferenceRoomId = conferenceRoomId
            logger.info("Created training conference room: \(conferenceRoomId)")
        }

        return LiveSessionCreationResult(
            conferenceRoomId: conferenceRoomId,
            joinUrl: joinUrl
        )
    }

    /// Start a live training session
    /// Sends join links to enrolled/RSVPed users
    public func startLiveSession(lessonId: String) async throws {
        guard let lesson = try await manager.getLesson(id: lessonId),
              lesson.type == .liveSession else {
            throw TrainingError.lessonNotFound
        }

        guard case .liveSession(let liveContent) = lesson.content,
              let _ = liveContent.conferenceRoomId else {
            throw TrainingError.invalidData
        }

        // In a real implementation, this would:
        // 1. Get all RSVPed users
        // 2. Send notifications with join links
        // 3. Start the conference room

        logger.info("Starting live training session: \(lessonId)")
    }

    /// End a live training session and save recording
    public func endLiveSession(lessonId: String) async throws -> String? {
        guard let lesson = try await manager.getLesson(id: lessonId),
              lesson.type == .liveSession else {
            throw TrainingError.lessonNotFound
        }

        guard case .liveSession(let liveContent) = lesson.content else {
            throw TrainingError.invalidData
        }

        // In a real implementation, this would:
        // 1. End the conference
        // 2. Get the recording URL
        // 3. Process and store the recording

        let recordingUrl = liveContent.recordingUrl

        logger.info("Ended live training session: \(lessonId), recording: \(recordingUrl ?? "none")")

        return recordingUrl
    }

    /// Track attendance for a live training session
    public func trackLiveAttendance(
        lessonId: String,
        pubkey: String,
        joinedAt: Date,
        leftAt: Date? = nil
    ) async throws {
        try await manager.recordLiveAttendance(
            lessonId: lessonId,
            joinedAt: joinedAt,
            leftAt: leftAt
        )

        let duration = (leftAt ?? Date()).timeIntervalSince(joinedAt)
        let durationMinutes = Int(duration / 60)

        logger.info("Recorded training attendance: \(pubkey) attended \(durationMinutes) minutes")

        // If attended for significant duration, mark progress
        if duration > 30 * 60 { // 30 minutes
            try await manager.completeLesson(lessonId)
        }
    }

    /// Get conference room details for a training session
    public func getConferenceDetails(lessonId: String) async throws -> ConferenceDetails {
        guard let lesson = try await manager.getLesson(id: lessonId),
              lesson.type == .liveSession else {
            return ConferenceDetails()
        }

        guard case .liveSession(let liveContent) = lesson.content else {
            return ConferenceDetails()
        }

        // In a real implementation, would query the CallingModule for room status
        return ConferenceDetails(
            conferenceRoomId: liveContent.conferenceRoomId,
            isActive: false, // Would check with CallingModule
            participantCount: 0 // Would get from CallingModule
        )
    }

    /// Check if CallingModule is available
    public func isCallingModuleAvailable() async -> Bool {
        // In a real implementation, would check if CallingModule is enabled
        // and properly configured
        return true
    }

    /// Create a group call for a training session
    public func createGroupCall(
        lesson: Lesson,
        invitedPubkeys: [String]
    ) async throws -> String {
        guard lesson.type == .liveSession else {
            throw TrainingError.invalidData
        }

        // In a real implementation, this would call CallingModule.createGroupCall()
        let roomId = "training-call-\(lesson.id)"

        logger.info("Created group call for training: \(roomId) with \(invitedPubkeys.count) invitees")

        return roomId
    }

    /// Join a training session call
    public func joinTrainingCall(roomId: String) async throws {
        // In a real implementation, would call CallingModule.joinGroupCall(roomId:)
        logger.info("Joining training call: \(roomId)")
    }

    /// Leave a training session call
    public func leaveTrainingCall(roomId: String) async throws {
        // In a real implementation, would call CallingModule.leaveGroupCall(roomId:)
        logger.info("Leaving training call: \(roomId)")
    }
}
