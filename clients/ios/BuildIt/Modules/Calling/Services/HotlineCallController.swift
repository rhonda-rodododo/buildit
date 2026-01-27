// HotlineCallController.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles call control operations for hotline operators:
// hold, resume, transfer, escalate, 3-way calling, and call notes.

import Foundation
import Combine
import AVFoundation
import os.log

// MARK: - Transfer Request

/// Represents a pending call transfer request
public struct TransferRequest: Equatable, Sendable {
    public let callId: String
    public let fromOperator: String
    public let toOperator: String
    public let reason: String?
    public let requestedAt: Date
    public let expiresAt: Date
    public var status: TransferStatus

    public enum TransferStatus: String, Sendable {
        case pending
        case accepted
        case declined
        case expired
    }

    public init(
        callId: String,
        fromOperator: String,
        toOperator: String,
        reason: String? = nil,
        requestedAt: Date = Date(),
        expiresAt: Date,
        status: TransferStatus = .pending
    ) {
        self.callId = callId
        self.fromOperator = fromOperator
        self.toOperator = toOperator
        self.reason = reason
        self.requestedAt = requestedAt
        self.expiresAt = expiresAt
        self.status = status
    }
}

// MARK: - Three-Way Call

/// Represents an active 3-way call
public struct ThreeWayCall: Equatable, Sendable {
    public let callId: String
    public let participants: [String] // operator pubkeys
    public let initiatedBy: String
    public let startedAt: Date

    public init(
        callId: String,
        participants: [String],
        initiatedBy: String,
        startedAt: Date = Date()
    ) {
        self.callId = callId
        self.participants = participants
        self.initiatedBy = initiatedBy
        self.startedAt = startedAt
    }
}

// MARK: - Call Controller Errors

public enum HotlineCallControllerError: LocalizedError {
    case callNotActive
    case callNotOnHold
    case callNotFound
    case noOperator
    case operatorNotFound
    case operatorNotAvailable
    case noPendingTransfer
    case noSupervisorAvailable
    case transferFailed(String)

    public var errorDescription: String? {
        switch self {
        case .callNotActive:
            return "Call is not active"
        case .callNotOnHold:
            return "Call is not on hold"
        case .callNotFound:
            return "Call not found"
        case .noOperator:
            return "Call has no operator"
        case .operatorNotFound:
            return "Target operator not found"
        case .operatorNotAvailable:
            return "Target operator is not available"
        case .noPendingTransfer:
            return "No pending transfer request"
        case .noSupervisorAvailable:
            return "No supervisor available"
        case .transferFailed(let reason):
            return "Transfer failed: \(reason)"
        }
    }
}

// MARK: - Hotline Call Controller

/// Manages active call controls for hotline operators
@MainActor
public class HotlineCallController: ObservableObject {
    // MARK: - Published Properties

    /// Pending transfer requests by call ID
    @Published public private(set) var pendingTransfers: [String: TransferRequest] = [:]

    /// Active 3-way calls by call ID
    @Published public private(set) var activeThreeWays: [String: ThreeWayCall] = [:]

    /// Call notes by call ID
    @Published public private(set) var callNotes: [String: String] = [:]

    // MARK: - Dependencies

    private let queueManager: HotlineQueueManager
    private weak var webRTCManager: WebRTCManager?
    private weak var callKitManager: CallKitManager?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "HotlineCallController")

    /// Transfer timeout in seconds
    private let transferTimeout: TimeInterval = 30

    /// Auto-save delay for notes
    private let notesAutoSaveDelay: TimeInterval = 5

    /// Active calls state
    private var activeCalls: [String: HotlineCallInfo] = [:]

    /// Notes auto-save timers by call ID
    private var notesAutoSaveTimers: [String: Task<Void, Never>] = [:]

    /// Transfer timeout timers by call ID
    private var transferTimers: [String: Task<Void, Never>] = [:]

    /// Hold music player
    private var holdMusicPlayer: AVAudioPlayer?

    // MARK: - Event Publishers

    /// Emits when a call is put on hold
    public let callHeld = PassthroughSubject<String, Never>()

    /// Emits when a call is resumed from hold
    public let callResumed = PassthroughSubject<String, Never>()

    /// Emits when a transfer is requested
    public let transferRequested = PassthroughSubject<TransferRequest, Never>()

    /// Emits when a transfer is accepted
    public let transferAccepted = PassthroughSubject<TransferRequest, Never>()

    /// Emits when a transfer is declined
    public let transferDeclined = PassthroughSubject<TransferRequest, Never>()

    /// Emits when a transfer is completed
    public let transferCompleted = PassthroughSubject<(callId: String, toOperator: String), Never>()

    /// Emits when a call is escalated to supervisor
    public let callEscalated = PassthroughSubject<(callId: String, supervisorPubkey: String), Never>()

    /// Emits when a 3-way call starts
    public let threeWayStarted = PassthroughSubject<ThreeWayCall, Never>()

    /// Emits when a 3-way call ends
    public let threeWayEnded = PassthroughSubject<String, Never>()

    /// Emits when a call ends
    public let callEnded = PassthroughSubject<(callId: String, summary: String), Never>()

    /// Emits when notes are updated
    public let notesUpdated = PassthroughSubject<(callId: String, notes: String), Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(
        queueManager: HotlineQueueManager,
        webRTCManager: WebRTCManager? = nil,
        callKitManager: CallKitManager? = nil
    ) {
        self.queueManager = queueManager
        self.webRTCManager = webRTCManager
        self.callKitManager = callKitManager

        initializeHoldMusic()
    }

    deinit {
        notesAutoSaveTimers.values.forEach { $0.cancel() }
        transferTimers.values.forEach { $0.cancel() }
    }

    // MARK: - Active Call Management

    /// Register an active call
    public func registerActiveCall(_ callInfo: HotlineCallInfo) {
        activeCalls[callInfo.callId] = callInfo
        logger.info("Registered active call: \(callInfo.callId)")
    }

    /// Get active call info
    public func getActiveCall(_ callId: String) -> HotlineCallInfo? {
        activeCalls[callId]
    }

    /// Update active call info
    public func updateActiveCall(_ callId: String, update: (inout HotlineCallInfo) -> Void) {
        guard var call = activeCalls[callId] else { return }
        update(&call)
        activeCalls[callId] = call
    }

    // MARK: - Hold/Resume

    /// Put a call on hold
    /// - Parameter callId: The call identifier
    public func holdCall(_ callId: String) async throws {
        guard var call = activeCalls[callId], call.state == .active else {
            throw HotlineCallControllerError.callNotActive
        }

        // Mute audio to caller (they hear hold music)
        webRTCManager?.setAudioEnabled(false)

        // Play hold music to caller
        startHoldMusic()

        // Update call state
        call.state = .onHold
        activeCalls[callId] = call

        // Update CallKit if available
        if let callUUID = UUID(uuidString: callId) {
            try? await callKitManager?.setOnHold(callId: callUUID, onHold: true)
        }

        callHeld.send(callId)
        logger.info("Call \(callId) placed on hold")
    }

    /// Resume a call from hold
    /// - Parameter callId: The call identifier
    public func resumeCall(_ callId: String) async throws {
        guard var call = activeCalls[callId], call.state == .onHold else {
            throw HotlineCallControllerError.callNotOnHold
        }

        // Stop hold music
        stopHoldMusic()

        // Resume audio
        webRTCManager?.setAudioEnabled(true)

        // Update call state
        call.state = .active
        activeCalls[callId] = call

        // Update CallKit if available
        if let callUUID = UUID(uuidString: callId) {
            try? await callKitManager?.setOnHold(callId: callUUID, onHold: false)
        }

        callResumed.send(callId)
        logger.info("Call \(callId) resumed from hold")
    }

    // MARK: - Call Transfer

    /// Request to transfer a call to another operator
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - targetOperatorPubkey: The target operator's public key
    ///   - reason: Optional reason for transfer
    /// - Returns: The transfer request
    public func transferCall(
        _ callId: String,
        to targetOperatorPubkey: String,
        reason: String? = nil
    ) async throws -> TransferRequest {
        guard let call = activeCalls[callId] else {
            throw HotlineCallControllerError.callNotFound
        }

        guard let currentOperator = call.operatorPubkey else {
            throw HotlineCallControllerError.noOperator
        }

        // Check target is available
        let operators = queueManager.getOperators(hotlineId: call.hotlineId)
        guard let targetOperator = operators.first(where: { $0.pubkey == targetOperatorPubkey }) else {
            throw HotlineCallControllerError.operatorNotFound
        }

        guard targetOperator.status == .available else {
            throw HotlineCallControllerError.operatorNotAvailable
        }

        // Create transfer request
        let request = TransferRequest(
            callId: callId,
            fromOperator: currentOperator,
            toOperator: targetOperatorPubkey,
            reason: reason,
            expiresAt: Date().addingTimeInterval(transferTimeout)
        )

        pendingTransfers[callId] = request

        // Put call on hold during transfer
        try await holdCall(callId)

        // Update call state
        updateActiveCall(callId) { $0.state = .transferred }

        transferRequested.send(request)

        logger.info("Transfer requested for call \(callId) to operator \(targetOperatorPubkey.prefix(8))")

        // Set timeout for transfer
        transferTimers[callId] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.transferTimeout ?? 30) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.handleTransferExpired(callId: callId)
        }

        return request
    }

    /// Accept a transfer request
    /// - Parameter callId: The call identifier
    public func acceptTransfer(_ callId: String) async throws {
        guard var request = pendingTransfers[callId], request.status == .pending else {
            throw HotlineCallControllerError.noPendingTransfer
        }

        request.status = .accepted
        pendingTransfers.removeValue(forKey: callId)

        // Cancel timeout timer
        transferTimers[callId]?.cancel()
        transferTimers.removeValue(forKey: callId)

        // Update call with new operator
        updateActiveCall(callId) {
            $0.operatorPubkey = request.toOperator
            $0.state = .active
        }

        // Release original operator
        await queueManager.handleCallEnd(callId: callId, operatorPubkey: request.fromOperator)

        // Resume call for new operator
        try await resumeCall(callId)

        transferAccepted.send(request)
        transferCompleted.send((callId: callId, toOperator: request.toOperator))

        logger.info("Transfer accepted for call \(callId)")
    }

    /// Decline a transfer request
    /// - Parameter callId: The call identifier
    public func declineTransfer(_ callId: String) async throws {
        guard var request = pendingTransfers[callId], request.status == .pending else {
            throw HotlineCallControllerError.noPendingTransfer
        }

        request.status = .declined
        pendingTransfers.removeValue(forKey: callId)

        // Cancel timeout timer
        transferTimers[callId]?.cancel()
        transferTimers.removeValue(forKey: callId)

        // Resume call with original operator
        try await resumeCall(callId)

        // Update state back to active
        updateActiveCall(callId) { $0.state = .active }

        transferDeclined.send(request)

        logger.info("Transfer declined for call \(callId)")
    }

    /// Handle transfer timeout
    private func handleTransferExpired(callId: String) async {
        guard var request = pendingTransfers[callId], request.status == .pending else { return }

        request.status = .expired
        pendingTransfers.removeValue(forKey: callId)

        // Resume call with original operator
        do {
            try await resumeCall(callId)
            updateActiveCall(callId) { $0.state = .active }
        } catch {
            // Call may have ended
            logger.warning("Failed to resume call after transfer timeout: \(error.localizedDescription)")
        }

        logger.info("Transfer expired for call \(callId)")
    }

    // MARK: - Call Escalation

    /// Escalate call to a supervisor (creates 3-way call)
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - reason: Reason for escalation
    public func escalateCall(_ callId: String, reason: String) async throws {
        guard let call = activeCalls[callId] else {
            throw HotlineCallControllerError.callNotFound
        }

        // Find an available supervisor
        let operators = queueManager.getOperators(hotlineId: call.hotlineId)
        guard let supervisor = operators.first(where: {
            $0.status == .available && $0.pubkey != call.operatorPubkey
            // In a real implementation, would also check for supervisor role
        }) else {
            throw HotlineCallControllerError.noSupervisorAvailable
        }

        // Create 3-way call
        let threeWay = ThreeWayCall(
            callId: callId,
            participants: [call.operatorPubkey ?? "", supervisor.pubkey],
            initiatedBy: call.operatorPubkey ?? ""
        )

        activeThreeWays[callId] = threeWay

        // Update call state
        updateActiveCall(callId) {
            $0.state = .escalated
            $0.notes = ($0.notes ?? "") + "\n[ESCALATED: \(reason)]"
        }

        callEscalated.send((callId: callId, supervisorPubkey: supervisor.pubkey))
        threeWayStarted.send(threeWay)

        logger.info("Call \(callId) escalated to supervisor \(supervisor.pubkey.prefix(8))")
    }

    // MARK: - 3-Way Calling

    /// Start a 3-way call with another operator
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - thirdPartyPubkey: The third party's public key
    /// - Returns: The 3-way call info
    public func startThreeWayCall(
        _ callId: String,
        with thirdPartyPubkey: String
    ) throws -> ThreeWayCall {
        guard let call = activeCalls[callId] else {
            throw HotlineCallControllerError.callNotFound
        }

        let threeWay = ThreeWayCall(
            callId: callId,
            participants: [call.operatorPubkey ?? "", thirdPartyPubkey],
            initiatedBy: call.operatorPubkey ?? ""
        )

        activeThreeWays[callId] = threeWay

        // In a real implementation, would set up the 3-way WebRTC connections
        threeWayStarted.send(threeWay)

        logger.info("3-way call started for \(callId)")

        return threeWay
    }

    /// End a 3-way call (drop the third party)
    /// - Parameter callId: The call identifier
    public func endThreeWayCall(_ callId: String) {
        guard activeThreeWays.removeValue(forKey: callId) != nil else { return }

        updateActiveCall(callId) { $0.state = .active }

        threeWayEnded.send(callId)

        logger.info("3-way call ended for \(callId)")
    }

    // MARK: - Call Notes

    /// Update call notes with auto-save
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - notes: The notes content
    public func updateNotes(callId: String, notes: String) {
        callNotes[callId] = notes

        // Clear existing timer
        notesAutoSaveTimers[callId]?.cancel()

        // Auto-save after delay
        notesAutoSaveTimers[callId] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.notesAutoSaveDelay ?? 5) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            self?.saveNotes(callId: callId)
        }
    }

    /// Save notes immediately
    /// - Parameter callId: The call identifier
    public func saveNotes(callId: String) {
        guard let notes = callNotes[callId] else { return }

        updateActiveCall(callId) { $0.notes = notes }

        notesUpdated.send((callId: callId, notes: notes))

        // Clear timer
        notesAutoSaveTimers[callId]?.cancel()
        notesAutoSaveTimers.removeValue(forKey: callId)
    }

    /// Get call notes
    /// - Parameter callId: The call identifier
    /// - Returns: The notes, or empty string if none
    public func getNotes(callId: String) -> String {
        callNotes[callId] ?? ""
    }

    // MARK: - End Call

    /// End a call with summary
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - summary: Call summary
    public func endCall(_ callId: String, summary: String) async throws {
        // Save any pending notes
        saveNotes(callId: callId)

        guard let call = activeCalls[callId] else { return }

        // Stop hold music if playing
        stopHoldMusic()

        // Clean up any 3-way call
        activeThreeWays.removeValue(forKey: callId)

        // Update call state
        let finalNotes = (call.notes ?? "") + "\n\n---\nSummary: \(summary)"
        updateActiveCall(callId) {
            $0.state = .completed
            $0.endedAt = Date()
            $0.notes = finalNotes
        }

        // Release operator
        if let operatorPubkey = call.operatorPubkey {
            await queueManager.handleCallEnd(callId: callId, operatorPubkey: operatorPubkey)
        }

        // Hangup WebRTC
        webRTCManager?.close()

        // Clean up notes
        callNotes.removeValue(forKey: callId)
        notesAutoSaveTimers[callId]?.cancel()
        notesAutoSaveTimers.removeValue(forKey: callId)

        // Remove from active calls
        activeCalls.removeValue(forKey: callId)

        callEnded.send((callId: callId, summary: summary))

        logger.info("Call \(callId) ended with summary")
    }

    // MARK: - Call Properties

    /// Set call category
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - category: The category
    public func setCategory(callId: String, category: String) {
        updateActiveCall(callId) { $0.category = category }
    }

    /// Set call priority
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - priority: The priority
    public func setPriority(callId: String, priority: HotlineCallPriority) {
        updateActiveCall(callId) { $0.priority = priority }
    }

    // MARK: - Hold Music

    private func initializeHoldMusic() {
        // In production, this would load an actual hold music file
        // For now, we prepare but don't load any audio
        // let audioSession = AVAudioSession.sharedInstance()
        // try? audioSession.setCategory(.playback, mode: .default)
    }

    private func startHoldMusic() {
        guard let holdMusicURL = Bundle.main.url(forResource: "hold_music", withExtension: "mp3") else {
            logger.warning("Hold music file not found")
            return
        }

        do {
            holdMusicPlayer = try AVAudioPlayer(contentsOf: holdMusicURL)
            holdMusicPlayer?.numberOfLoops = -1 // Loop indefinitely
            holdMusicPlayer?.play()
        } catch {
            logger.error("Failed to play hold music: \(error.localizedDescription)")
        }
    }

    private func stopHoldMusic() {
        holdMusicPlayer?.stop()
        holdMusicPlayer?.currentTime = 0
    }

    // MARK: - Cleanup

    public func cleanup() {
        stopHoldMusic()
        holdMusicPlayer = nil

        notesAutoSaveTimers.values.forEach { $0.cancel() }
        notesAutoSaveTimers.removeAll()

        transferTimers.values.forEach { $0.cancel() }
        transferTimers.removeAll()

        pendingTransfers.removeAll()
        activeThreeWays.removeAll()
        callNotes.removeAll()
        activeCalls.removeAll()

        cancellables.removeAll()
    }
}

// MARK: - Hotline Call Info

/// Information about an active hotline call
public struct HotlineCallInfo: Identifiable, Equatable, Sendable {
    public let id: String
    public let callId: String
    public let hotlineId: String
    public let groupId: String?
    public let callType: HotlineCallType
    public var state: HotlineCallState
    public let callerPubkey: String?
    public let callerPhone: String?
    public let callerName: String?
    public var operatorPubkey: String?
    public let queuedAt: Date
    public var answeredAt: Date?
    public var endedAt: Date?
    public var priority: HotlineCallPriority
    public var category: String?
    public var notes: String?
    public var isEncrypted: Bool

    public init(
        callId: String,
        hotlineId: String,
        groupId: String? = nil,
        callType: HotlineCallType = .internal,
        state: HotlineCallState = .queued,
        callerPubkey: String? = nil,
        callerPhone: String? = nil,
        callerName: String? = nil,
        operatorPubkey: String? = nil,
        queuedAt: Date = Date(),
        answeredAt: Date? = nil,
        endedAt: Date? = nil,
        priority: HotlineCallPriority = .medium,
        category: String? = nil,
        notes: String? = nil,
        isEncrypted: Bool = true
    ) {
        self.id = callId
        self.callId = callId
        self.hotlineId = hotlineId
        self.groupId = groupId
        self.callType = callType
        self.state = state
        self.callerPubkey = callerPubkey
        self.callerPhone = callerPhone
        self.callerName = callerName
        self.operatorPubkey = operatorPubkey
        self.queuedAt = queuedAt
        self.answeredAt = answeredAt
        self.endedAt = endedAt
        self.priority = priority
        self.category = category
        self.notes = notes
        self.isEncrypted = isEncrypted
    }
}

// MARK: - Hotline Call Type

/// Type of hotline call
public enum HotlineCallType: String, Codable, Sendable {
    case `internal` // BuildIt-to-BuildIt
    case pstn       // PSTN gateway
}

// MARK: - Hotline Call State

/// State of a hotline call
public enum HotlineCallState: String, Codable, Sendable {
    case queued
    case ringing
    case active
    case onHold
    case transferred
    case completed
    case abandoned
    case escalated
}
