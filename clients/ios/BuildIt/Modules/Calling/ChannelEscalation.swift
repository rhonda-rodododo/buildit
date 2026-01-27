// ChannelEscalation.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles transitions between messaging and voice channels.
// Maintains thread/call linkage for seamless channel switching.

import Foundation
import Combine
import os.log

/// Direction of channel escalation
public enum EscalationDirection: String, Codable, Sendable {
    case toVoice = "to-voice"
    case toMessaging = "to-messaging"
}

/// Who initiated the escalation
public enum EscalationInitiator: String, Codable, Sendable {
    case `operator`
    case caller
    case system
}

/// Status of an escalation request
public enum EscalationStatus: String, Codable, Sendable {
    case pending
    case accepted
    case declined
    case completed
    case failed
}

/// Escalation request for channel switching
public struct EscalationRequest: Codable, Sendable, Identifiable {
    public let id: String
    public var threadId: String
    public var callId: String?
    public let direction: EscalationDirection
    public let initiatedBy: EscalationInitiator
    public var reason: String?
    public var status: EscalationStatus
    public let createdAt: Int
    public var completedAt: Int?

    public init(
        id: String = UUID().uuidString,
        threadId: String,
        callId: String? = nil,
        direction: EscalationDirection,
        initiatedBy: EscalationInitiator,
        reason: String? = nil,
        status: EscalationStatus = .pending,
        createdAt: Int = Int(Date().timeIntervalSince1970),
        completedAt: Int? = nil
    ) {
        self.id = id
        self.threadId = threadId
        self.callId = callId
        self.direction = direction
        self.initiatedBy = initiatedBy
        self.reason = reason
        self.status = status
        self.createdAt = createdAt
        self.completedAt = completedAt
    }
}

/// Result of an escalation operation
public struct EscalationResult: Sendable {
    public let success: Bool
    public let escalationId: String
    public var newCallId: String?
    public var newThreadId: String?
    public var error: String?

    public init(
        success: Bool,
        escalationId: String,
        newCallId: String? = nil,
        newThreadId: String? = nil,
        error: String? = nil
    ) {
        self.success = success
        self.escalationId = escalationId
        self.newCallId = newCallId
        self.newThreadId = newThreadId
        self.error = error
    }
}

/// Escalation event for observation
public enum EscalationEvent: Sendable {
    case started(EscalationRequest)
    case requested(request: EscalationRequest, callerPubkey: String)
    case accepted(EscalationRequest)
    case declined(EscalationRequest)
    case completed(EscalationRequest, callId: String?, threadId: String?)
    case failed(EscalationRequest, String)
    case linkCleared(channelId: String)
}

/// Service for handling channel escalation between messaging and voice
@MainActor
public class ChannelEscalation: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var escalations: [String: EscalationRequest] = [:]
    @Published public private(set) var pendingEscalations: [EscalationRequest] = []

    // MARK: - Properties

    private var threadToCall: [String: String] = [:] // threadId -> callId
    private var callToThread: [String: String] = [:] // callId -> threadId
    private var operatorPubkey: String = ""
    private let logger = Logger(subsystem: "com.buildit", category: "ChannelEscalation")

    /// Event stream for escalation changes
    public let eventSubject = PassthroughSubject<EscalationEvent, Never>()

    // Weak references to related managers
    private weak var messagingQueueManager: MessagingQueueManager?
    private weak var callingService: CallingService?

    // MARK: - Initialization

    public init() {}

    /// Initialize with operator context and related services
    public func initialize(
        operatorPubkey: String,
        messagingQueueManager: MessagingQueueManager? = nil,
        callingService: CallingService? = nil
    ) {
        self.operatorPubkey = operatorPubkey
        self.messagingQueueManager = messagingQueueManager
        self.callingService = callingService
        logger.info("Initialized ChannelEscalation")
    }

    // MARK: - Escalate to Voice

    /// Escalate a messaging thread to a voice call
    public func escalateToVoice(
        threadId: String,
        thread: MessagingThread? = nil,
        reason: String? = nil
    ) async -> EscalationResult {
        let escalationId = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        var escalation = EscalationRequest(
            id: escalationId,
            threadId: threadId,
            direction: .toVoice,
            initiatedBy: .operator,
            reason: reason,
            status: .pending,
            createdAt: now
        )

        escalations[escalationId] = escalation
        eventSubject.send(.started(escalation))

        do {
            // Create a call ID for the new voice call
            let callId = UUID().uuidString

            // Link the thread and call
            threadToCall[threadId] = callId
            callToThread[callId] = threadId

            // Update thread with linked call ID
            messagingQueueManager?.linkToCall(threadId, callId: callId)

            // Add transition message to thread
            if let thread = thread ?? messagingQueueManager?.getThread(threadId) {
                let message = reason.map {
                    "This conversation has been escalated to a voice call: \($0)"
                } ?? "This conversation has been escalated to a voice call"

                _ = try? await messagingQueueManager?.addMessage(
                    to: threadId,
                    content: message,
                    senderType: .system
                )
            }

            // Initiate the actual call
            if let service = callingService, let callerPubkey = thread?.thread.contact?.pubkey {
                try await service.startCall(to: callerPubkey, type: .voice)
            }

            // Update escalation
            escalation.callId = callId
            escalation.status = .completed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation

            eventSubject.send(.completed(escalation, callId: callId, threadId: nil))

            logger.info("Escalated thread \(threadId) to voice call \(callId)")
            return EscalationResult(
                success: true,
                escalationId: escalationId,
                newCallId: callId
            )
        } catch {
            escalation.status = .failed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation

            eventSubject.send(.failed(escalation, error.localizedDescription))

            logger.error("Failed to escalate to voice: \(error.localizedDescription)")
            return EscalationResult(
                success: false,
                escalationId: escalationId,
                error: error.localizedDescription
            )
        }
    }

    // MARK: - De-escalate to Messaging

    /// De-escalate a voice call back to messaging
    public func deescalateToMessaging(
        callId: String,
        reason: String? = nil
    ) async -> EscalationResult {
        let escalationId = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        // Check if there's an existing thread linked to this call
        var threadId = callToThread[callId]

        var escalation = EscalationRequest(
            id: escalationId,
            threadId: threadId ?? "",
            callId: callId,
            direction: .toMessaging,
            initiatedBy: .operator,
            reason: reason,
            status: .pending,
            createdAt: now
        )

        escalations[escalationId] = escalation
        eventSubject.send(.started(escalation))

        do {
            // If no existing thread, create a new one
            if threadId == nil {
                threadId = UUID().uuidString
                threadToCall[threadId!] = callId
                callToThread[callId] = threadId!
            }

            escalation.threadId = threadId!
            escalation.status = .completed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation

            // Add transition message
            let message = reason.map {
                "This conversation has been moved to messaging: \($0)"
            } ?? "This conversation has been moved to messaging"

            _ = try? await messagingQueueManager?.addMessage(
                to: threadId!,
                content: message,
                senderType: .system
            )

            eventSubject.send(.completed(escalation, callId: nil, threadId: threadId))

            logger.info("De-escalated call \(callId) to thread \(threadId!)")
            return EscalationResult(
                success: true,
                escalationId: escalationId,
                newThreadId: threadId
            )
        } catch {
            escalation.status = .failed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation

            eventSubject.send(.failed(escalation, error.localizedDescription))

            logger.error("Failed to de-escalate to messaging: \(error.localizedDescription)")
            return EscalationResult(
                success: false,
                escalationId: escalationId,
                error: error.localizedDescription
            )
        }
    }

    // MARK: - Caller-Initiated Escalation

    /// Request escalation from caller (caller wants to switch channels)
    public func requestEscalation(
        currentChannelId: String,
        direction: EscalationDirection,
        callerPubkey: String
    ) async -> EscalationRequest {
        let escalationId = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        let escalation = EscalationRequest(
            id: escalationId,
            threadId: direction == .toVoice ? currentChannelId : "",
            callId: direction == .toMessaging ? currentChannelId : nil,
            direction: direction,
            initiatedBy: .caller,
            status: .pending,
            createdAt: now
        )

        escalations[escalationId] = escalation
        updatePendingEscalations()

        eventSubject.send(.requested(request: escalation, callerPubkey: callerPubkey))

        logger.info("Caller requested escalation \(direction.rawValue)")
        return escalation
    }

    /// Accept a pending escalation request
    public func acceptEscalation(_ escalationId: String) async -> EscalationResult {
        guard var escalation = escalations[escalationId] else {
            return EscalationResult(
                success: false,
                escalationId: escalationId,
                error: "Escalation not found"
            )
        }

        guard escalation.status == .pending else {
            return EscalationResult(
                success: false,
                escalationId: escalationId,
                error: "Escalation is not pending"
            )
        }

        escalation.status = .accepted
        escalations[escalationId] = escalation

        eventSubject.send(.accepted(escalation))

        // Perform the actual escalation
        if escalation.direction == .toVoice {
            let callId = UUID().uuidString
            escalation.callId = callId
            threadToCall[escalation.threadId] = callId
            callToThread[callId] = escalation.threadId

            // Update thread with linked call
            messagingQueueManager?.linkToCall(escalation.threadId, callId: callId)

            escalation.status = .completed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation
            updatePendingEscalations()

            eventSubject.send(.completed(escalation, callId: callId, threadId: nil))

            return EscalationResult(
                success: true,
                escalationId: escalationId,
                newCallId: callId
            )
        } else {
            let threadId = UUID().uuidString
            escalation.threadId = threadId
            if let callId = escalation.callId {
                callToThread[callId] = threadId
                threadToCall[threadId] = callId
            }

            escalation.status = .completed
            escalation.completedAt = Int(Date().timeIntervalSince1970)
            escalations[escalationId] = escalation
            updatePendingEscalations()

            eventSubject.send(.completed(escalation, callId: nil, threadId: threadId))

            return EscalationResult(
                success: true,
                escalationId: escalationId,
                newThreadId: threadId
            )
        }
    }

    /// Decline a pending escalation request
    public func declineEscalation(_ escalationId: String, reason: String? = nil) -> Bool {
        guard var escalation = escalations[escalationId],
              escalation.status == .pending else {
            return false
        }

        escalation.status = .declined
        escalation.completedAt = Int(Date().timeIntervalSince1970)
        if let reason = reason {
            escalation.reason = reason
        }

        escalations[escalationId] = escalation
        updatePendingEscalations()

        eventSubject.send(.declined(escalation))

        logger.info("Declined escalation: \(escalationId)")
        return true
    }

    // MARK: - Linkage Queries

    /// Get call ID linked to a thread
    public func getLinkedCall(_ threadId: String) -> String? {
        threadToCall[threadId]
    }

    /// Get thread ID linked to a call
    public func getLinkedThread(_ callId: String) -> String? {
        callToThread[callId]
    }

    /// Check if thread has a linked call
    public func hasLinkedCall(_ threadId: String) -> Bool {
        threadToCall[threadId] != nil
    }

    /// Check if call has a linked thread
    public func hasLinkedThread(_ callId: String) -> Bool {
        callToThread[callId] != nil
    }

    /// Clear link between thread and call (on call end)
    public func clearLink(_ channelId: String) {
        // Try to find and clear by thread ID
        if let callId = threadToCall[channelId] {
            threadToCall.removeValue(forKey: channelId)
            callToThread.removeValue(forKey: callId)
            eventSubject.send(.linkCleared(channelId: channelId))
            logger.debug("Cleared link for thread: \(channelId)")
            return
        }

        // Try to find and clear by call ID
        if let threadId = callToThread[channelId] {
            callToThread.removeValue(forKey: channelId)
            threadToCall.removeValue(forKey: threadId)
            eventSubject.send(.linkCleared(channelId: channelId))
            logger.debug("Cleared link for call: \(channelId)")
        }
    }

    // MARK: - Escalation Queries

    /// Get escalation by ID
    public func getEscalation(_ escalationId: String) -> EscalationRequest? {
        escalations[escalationId]
    }

    /// Get pending escalation requests for a thread or call
    public func getPendingEscalations(for channelId: String) -> [EscalationRequest] {
        escalations.values.filter {
            $0.status == .pending &&
            ($0.threadId == channelId || $0.callId == channelId)
        }
    }

    /// Get escalation history for a channel
    public func getHistory(for channelId: String) -> [EscalationRequest] {
        escalations.values
            .filter { $0.threadId == channelId || $0.callId == channelId }
            .sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: - Private Helpers

    private func updatePendingEscalations() {
        pendingEscalations = escalations.values
            .filter { $0.status == .pending }
            .sorted { $0.createdAt < $1.createdAt }
    }

    /// Create thread from call context
    public func createThreadFromCall(
        callId: String,
        callerPubkey: String,
        callerName: String? = nil,
        hotlineId: String
    ) async -> String? {
        guard let manager = messagingQueueManager else {
            logger.warning("MessagingQueueManager not available")
            return nil
        }

        do {
            let thread = try await manager.createThread(
                callerPubkey: callerPubkey,
                callerName: callerName,
                contactType: .buildit,
                initialMessage: "Call initiated - transitioning to messaging",
                priority: .medium
            )

            // Link the thread and call
            threadToCall[thread.threadId] = callId
            callToThread[callId] = thread.threadId

            // Update thread with linked call
            manager.linkToCall(thread.threadId, callId: callId)

            logger.info("Created thread \(thread.threadId) from call \(callId)")
            return thread.threadId
        } catch {
            logger.error("Failed to create thread from call: \(error.localizedDescription)")
            return nil
        }
    }

    /// Resume thread from previous call
    public func resumeThreadFromCall(
        callId: String,
        threadId: String
    ) {
        // Re-establish linkage
        threadToCall[threadId] = callId
        callToThread[callId] = threadId

        // Update thread with linked call
        messagingQueueManager?.linkToCall(threadId, callId: callId)

        logger.info("Resumed thread \(threadId) for call \(callId)")
    }
}

// MARK: - Errors

public enum EscalationError: LocalizedError {
    case notFound
    case notPending
    case escalationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Escalation not found"
        case .notPending:
            return "Escalation is not pending"
        case .escalationFailed(let reason):
            return "Escalation failed: \(reason)"
        }
    }
}
