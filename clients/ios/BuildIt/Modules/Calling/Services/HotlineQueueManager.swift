// HotlineQueueManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages call queues with priority ordering and automatic call distribution (ACD).
// Handles operator registration, status tracking, and ring timeout management.

import Foundation
import Combine
import os.log

// MARK: - Priority Weights

/// Priority weights for queue ordering
/// Higher weight = higher priority
private let priorityWeights: [HotlineCallPriority: Int] = [
    .urgent: 1000,
    .high: 100,
    .medium: 10,
    .low: 1
]

// MARK: - ACD Configuration

/// Configuration for Automatic Call Distribution (ACD) behavior
public struct ACDConfig: Sendable {
    /// Seconds before returning call to queue when operator doesn't answer
    public let ringTimeout: TimeInterval

    /// Seconds in wrap-up state after call ends
    public let wrapUpDuration: TimeInterval

    /// Maximum calls allowed in queue
    public let maxQueueSize: Int

    /// Average call duration for wait estimation (seconds)
    public let averageHandleTime: TimeInterval

    public static let `default` = ACDConfig(
        ringTimeout: 30,
        wrapUpDuration: 60,
        maxQueueSize: 50,
        averageHandleTime: 300 // 5 minutes
    )

    public init(
        ringTimeout: TimeInterval = 30,
        wrapUpDuration: TimeInterval = 60,
        maxQueueSize: Int = 50,
        averageHandleTime: TimeInterval = 300
    ) {
        self.ringTimeout = ringTimeout
        self.wrapUpDuration = wrapUpDuration
        self.maxQueueSize = maxQueueSize
        self.averageHandleTime = averageHandleTime
    }
}

// MARK: - Queued Call

/// Represents a call waiting in the queue
public struct QueuedCall: Identifiable, Equatable, Sendable {
    public let id: String
    public let callId: String
    public let hotlineId: String
    public let groupId: String?
    public let callerPubkey: String?
    public let callerPhone: String?
    public let callerName: String?
    public var priority: HotlineCallPriority
    public let category: String?
    public let queuedAt: Date
    public var position: Int
    public var estimatedWaitTime: TimeInterval
    public var assignedOperator: String?
    public var ringStartedAt: Date?

    public init(
        callId: String,
        hotlineId: String,
        groupId: String? = nil,
        callerPubkey: String? = nil,
        callerPhone: String? = nil,
        callerName: String? = nil,
        priority: HotlineCallPriority = .medium,
        category: String? = nil,
        queuedAt: Date = Date(),
        position: Int = 0,
        estimatedWaitTime: TimeInterval = 0,
        assignedOperator: String? = nil,
        ringStartedAt: Date? = nil
    ) {
        self.id = callId
        self.callId = callId
        self.hotlineId = hotlineId
        self.groupId = groupId
        self.callerPubkey = callerPubkey
        self.callerPhone = callerPhone
        self.callerName = callerName
        self.priority = priority
        self.category = category
        self.queuedAt = queuedAt
        self.position = position
        self.estimatedWaitTime = estimatedWaitTime
        self.assignedOperator = assignedOperator
        self.ringStartedAt = ringStartedAt
    }
}

// MARK: - Operator State

/// Represents an operator's current state
public struct OperatorState: Identifiable, Equatable, Sendable {
    public let id: String
    public let pubkey: String
    public let displayName: String?
    public let hotlineId: String
    public var status: HotlineOperatorState
    public var currentCallId: String?
    public var callCount: Int
    public let shiftStart: Date
    public var lastCallEndedAt: Date?

    public init(
        pubkey: String,
        displayName: String? = nil,
        hotlineId: String,
        status: HotlineOperatorState = .available,
        currentCallId: String? = nil,
        callCount: Int = 0,
        shiftStart: Date = Date(),
        lastCallEndedAt: Date? = nil
    ) {
        self.id = pubkey
        self.pubkey = pubkey
        self.displayName = displayName
        self.hotlineId = hotlineId
        self.status = status
        self.currentCallId = currentCallId
        self.callCount = callCount
        self.shiftStart = shiftStart
        self.lastCallEndedAt = lastCallEndedAt
    }
}

// MARK: - Queue Statistics

/// Statistics for a hotline queue
public struct QueueStats: Equatable, Sendable {
    public let totalCalls: Int
    public let avgWaitTime: TimeInterval
    public let longestWait: TimeInterval
    public let byPriority: [HotlineCallPriority: Int]
    public let availableOperators: Int
    public let onCallOperators: Int

    public init(
        totalCalls: Int = 0,
        avgWaitTime: TimeInterval = 0,
        longestWait: TimeInterval = 0,
        byPriority: [HotlineCallPriority: Int] = [:],
        availableOperators: Int = 0,
        onCallOperators: Int = 0
    ) {
        self.totalCalls = totalCalls
        self.avgWaitTime = avgWaitTime
        self.longestWait = longestWait
        self.byPriority = byPriority
        self.availableOperators = availableOperators
        self.onCallOperators = onCallOperators
    }
}

// MARK: - Queue Manager Errors

public enum HotlineQueueError: LocalizedError {
    case queueFull
    case callNotFound
    case operatorNotFound
    case operatorNotAvailable
    case noAvailableOperators

    public var errorDescription: String? {
        switch self {
        case .queueFull:
            return "Queue is full"
        case .callNotFound:
            return "Call not found in queue"
        case .operatorNotFound:
            return "Operator not found"
        case .operatorNotAvailable:
            return "Operator is not available"
        case .noAvailableOperators:
            return "No available operators"
        }
    }
}

// MARK: - Hotline Queue Manager

/// Manages call queues with priority ordering and automatic call distribution (ACD)
@MainActor
public class HotlineQueueManager: ObservableObject {
    // MARK: - Published Properties

    /// Current queued calls by hotline ID
    @Published public private(set) var queues: [String: [QueuedCall]] = [:]

    /// Registered operators by pubkey
    @Published public private(set) var operators: [String: OperatorState] = [:]

    // MARK: - Private Properties

    private let config: ACDConfig
    private let logger = Logger(subsystem: "com.buildit", category: "HotlineQueueManager")

    /// Ring timers by call ID
    private var ringTimers: [String: Task<Void, Never>] = [:]

    /// Wrap-up timers by operator pubkey
    private var wrapUpTimers: [String: Task<Void, Never>] = [:]

    // MARK: - Event Publishers

    /// Emits when a call is added to the queue
    public let callQueued = PassthroughSubject<QueuedCall, Never>()

    /// Emits when a call is assigned to an operator
    public let callAssigned = PassthroughSubject<(call: QueuedCall, operator: OperatorState), Never>()

    /// Emits when an operator answers a call
    public let callAnswered = PassthroughSubject<(callId: String, operatorPubkey: String), Never>()

    /// Emits when a caller abandons (hangs up while waiting)
    public let callAbandoned = PassthroughSubject<String, Never>()

    /// Emits when a call returns to queue (ring timeout)
    public let callReturnedToQueue = PassthroughSubject<String, Never>()

    /// Emits when queue is updated
    public let queueUpdated = PassthroughSubject<(hotlineId: String, queue: [QueuedCall]), Never>()

    /// Emits when operator status changes
    public let operatorStatusChanged = PassthroughSubject<OperatorState, Never>()

    /// Emits when wait time estimate is updated
    public let waitTimeUpdated = PassthroughSubject<(hotlineId: String, estimatedWait: TimeInterval), Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(config: ACDConfig = .default) {
        self.config = config
    }

    deinit {
        // Cancel all timers
        ringTimers.values.forEach { $0.cancel() }
        wrapUpTimers.values.forEach { $0.cancel() }
    }

    // MARK: - Queue Operations

    /// Enqueue a new incoming call
    /// - Parameters:
    ///   - hotlineId: The hotline identifier
    ///   - callData: Call data including caller info and priority
    /// - Returns: The queued call
    public func enqueueCall(
        hotlineId: String,
        callId: String? = nil,
        groupId: String? = nil,
        callerPubkey: String? = nil,
        callerPhone: String? = nil,
        callerName: String? = nil,
        priority: HotlineCallPriority = .medium,
        category: String? = nil
    ) async throws -> QueuedCall {
        var queue = queues[hotlineId] ?? []

        // Check queue size limit
        guard queue.count < config.maxQueueSize else {
            throw HotlineQueueError.queueFull
        }

        let callIdValue = callId ?? UUID().uuidString
        let estimatedWait = estimateWaitTime(hotlineId: hotlineId, priority: priority)

        var call = QueuedCall(
            callId: callIdValue,
            hotlineId: hotlineId,
            groupId: groupId,
            callerPubkey: callerPubkey,
            callerPhone: callerPhone,
            callerName: callerName,
            priority: priority,
            category: category,
            queuedAt: Date(),
            position: queue.count + 1,
            estimatedWaitTime: estimatedWait
        )

        // Insert in priority order
        insertByPriority(&queue, call: &call)
        queues[hotlineId] = queue
        updatePositions(hotlineId: hotlineId)

        callQueued.send(call)
        queueUpdated.send((hotlineId: hotlineId, queue: Array(queues[hotlineId] ?? [])))

        logger.info("Call \(callIdValue) enqueued to hotline \(hotlineId) with priority \(priority.rawValue)")

        // Try to distribute immediately
        await attemptDistribution(hotlineId: hotlineId)

        // Return updated call with correct position
        return queues[hotlineId]?.first { $0.callId == callIdValue } ?? call
    }

    /// Remove a call from the queue
    /// - Parameter callId: The call identifier
    /// - Returns: The removed call, if found
    @discardableResult
    public func dequeueCall(callId: String) -> QueuedCall? {
        for (hotlineId, var queue) in queues {
            if let index = queue.firstIndex(where: { $0.callId == callId }) {
                let call = queue.remove(at: index)
                queues[hotlineId] = queue
                updatePositions(hotlineId: hotlineId)
                queueUpdated.send((hotlineId: hotlineId, queue: Array(queues[hotlineId] ?? [])))
                return call
            }
        }
        return nil
    }

    /// Mark a call as abandoned (caller hung up while waiting)
    /// - Parameter callId: The call identifier
    public func abandonCall(callId: String) {
        if let call = dequeueCall(callId: callId) {
            callAbandoned.send(callId)
            logger.info("Call \(callId) abandoned")
        }
        clearRingTimer(callId: callId)
    }

    // MARK: - Operator Management

    /// Register an operator for a hotline
    /// - Parameters:
    ///   - pubkey: The operator's public key
    ///   - hotlineId: The hotline identifier
    ///   - displayName: Optional display name
    /// - Returns: The registered operator state
    @discardableResult
    public func registerOperator(
        pubkey: String,
        hotlineId: String,
        displayName: String? = nil
    ) async -> OperatorState {
        let operatorState = OperatorState(
            pubkey: pubkey,
            displayName: displayName,
            hotlineId: hotlineId,
            status: .available,
            callCount: 0,
            shiftStart: Date()
        )

        operators[pubkey] = operatorState
        operatorStatusChanged.send(operatorState)

        logger.info("Operator \(pubkey.prefix(8)) registered for hotline \(hotlineId)")

        // Try to distribute calls to new operator
        await attemptDistribution(hotlineId: hotlineId)

        return operatorState
    }

    /// Unregister an operator (end shift)
    /// - Parameter pubkey: The operator's public key
    public func unregisterOperator(pubkey: String) {
        guard var operatorState = operators[pubkey] else { return }

        clearWrapUpTimer(pubkey: pubkey)

        operatorState.status = .offline
        operatorStatusChanged.send(operatorState)

        operators.removeValue(forKey: pubkey)

        logger.info("Operator \(pubkey.prefix(8)) unregistered")
    }

    /// Update an operator's status
    /// - Parameters:
    ///   - pubkey: The operator's public key
    ///   - status: The new status
    public func setOperatorStatus(pubkey: String, status: HotlineOperatorState) async {
        guard var operatorState = operators[pubkey] else { return }

        let previousStatus = operatorState.status
        operatorState.status = status
        operators[pubkey] = operatorState

        // Clear wrap-up timer if changing status
        if previousStatus == .wrapUp {
            clearWrapUpTimer(pubkey: pubkey)
        }

        operatorStatusChanged.send(operatorState)

        // Try to distribute if becoming available
        if status == .available {
            await attemptDistribution(hotlineId: operatorState.hotlineId)
        }
    }

    /// Get available operators for a hotline
    /// - Parameter hotlineId: The hotline identifier
    /// - Returns: Array of available operators
    public func getAvailableOperators(hotlineId: String) -> [OperatorState] {
        operators.values.filter {
            $0.hotlineId == hotlineId && $0.status == .available
        }
    }

    /// Get all operators for a hotline
    /// - Parameter hotlineId: The hotline identifier
    /// - Returns: Array of all operators
    public func getOperators(hotlineId: String) -> [OperatorState] {
        operators.values.filter { $0.hotlineId == hotlineId }
    }

    // MARK: - Queue Access

    /// Get the current queue for a hotline
    /// - Parameter hotlineId: The hotline identifier
    /// - Returns: Array of queued calls
    public func getQueue(hotlineId: String) -> [QueuedCall] {
        queues[hotlineId] ?? []
    }

    /// Get queue position for a specific call
    /// - Parameter callId: The call identifier
    /// - Returns: The position, or nil if not found
    public func getQueuePosition(callId: String) -> Int? {
        for queue in queues.values {
            if let call = queue.first(where: { $0.callId == callId }) {
                return call.position
            }
        }
        return nil
    }

    /// Get queue statistics for a hotline
    /// - Parameter hotlineId: The hotline identifier
    /// - Returns: Queue statistics
    public func getQueueStats(hotlineId: String) -> QueueStats {
        let queue = queues[hotlineId] ?? []
        let allOperators = getOperators(hotlineId: hotlineId)
        let now = Date()

        var byPriority: [HotlineCallPriority: Int] = [
            .urgent: 0,
            .high: 0,
            .medium: 0,
            .low: 0
        ]

        var totalWait: TimeInterval = 0
        var longestWait: TimeInterval = 0

        for call in queue {
            byPriority[call.priority, default: 0] += 1
            let waitTime = now.timeIntervalSince(call.queuedAt)
            totalWait += waitTime
            longestWait = max(longestWait, waitTime)
        }

        return QueueStats(
            totalCalls: queue.count,
            avgWaitTime: queue.isEmpty ? 0 : totalWait / Double(queue.count),
            longestWait: longestWait,
            byPriority: byPriority,
            availableOperators: allOperators.filter { $0.status == .available }.count,
            onCallOperators: allOperators.filter { $0.status == .onCall }.count
        )
    }

    // MARK: - Call Distribution

    /// Attempt to distribute calls to available operators
    /// - Parameter hotlineId: The hotline identifier
    public func attemptDistribution(hotlineId: String) async {
        guard let queue = queues[hotlineId], !queue.isEmpty else { return }

        let availableOperators = getAvailableOperators(hotlineId: hotlineId)
        guard !availableOperators.isEmpty else { return }

        // Get the highest priority call that isn't already being rung
        guard let callToAssign = queue.first(where: { $0.assignedOperator == nil }) else { return }

        // Find the best operator (round-robin based on call count)
        guard let bestOperator = availableOperators.min(by: { $0.callCount < $1.callCount }) else { return }

        await assignCallToOperator(call: callToAssign, operator: bestOperator)
    }

    /// Assign a call to a specific operator
    /// - Parameters:
    ///   - call: The call to assign
    ///   - operator: The target operator
    public func assignCallToOperator(call: QueuedCall, operator operatorState: OperatorState) async {
        guard var queue = queues[call.hotlineId],
              let index = queue.firstIndex(where: { $0.callId == call.callId }) else {
            return
        }

        var updatedCall = queue[index]
        updatedCall.assignedOperator = operatorState.pubkey
        updatedCall.ringStartedAt = Date()
        queue[index] = updatedCall
        queues[call.hotlineId] = queue

        // Update operator status to on-call (ringing)
        var updatedOperator = operatorState
        updatedOperator.status = .onCall
        updatedOperator.currentCallId = call.callId
        operators[operatorState.pubkey] = updatedOperator

        callAssigned.send((call: updatedCall, operator: updatedOperator))
        operatorStatusChanged.send(updatedOperator)

        logger.info("Call \(call.callId) assigned to operator \(operatorState.pubkey.prefix(8))")

        // Set ring timeout
        let callId = call.callId
        ringTimers[callId] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.config.ringTimeout ?? 30) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.handleRingTimeout(callId: callId)
        }
    }

    /// Handle operator answering a call
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - operatorPubkey: The operator's public key
    public func handleOperatorAnswer(callId: String, operatorPubkey: String) {
        clearRingTimer(callId: callId)

        guard let call = dequeueCall(callId: callId) else { return }

        if var operatorState = operators[operatorPubkey] {
            operatorState.status = .onCall
            operatorState.currentCallId = callId
            operatorState.callCount += 1
            operators[operatorPubkey] = operatorState
            operatorStatusChanged.send(operatorState)
        }

        callAnswered.send((callId: callId, operatorPubkey: operatorPubkey))

        logger.info("Call \(callId) answered by operator \(operatorPubkey.prefix(8))")
    }

    /// Handle call ending
    /// - Parameters:
    ///   - callId: The call identifier
    ///   - operatorPubkey: The operator's public key
    public func handleCallEnd(callId: String, operatorPubkey: String) async {
        guard var operatorState = operators[operatorPubkey] else { return }

        operatorState.currentCallId = nil
        operatorState.lastCallEndedAt = Date()

        // Enter wrap-up state
        operatorState.status = .wrapUp
        operators[operatorPubkey] = operatorState
        operatorStatusChanged.send(operatorState)

        logger.info("Call \(callId) ended, operator \(operatorPubkey.prefix(8)) in wrap-up")

        // Auto-return to available after wrap-up duration
        wrapUpTimers[operatorPubkey] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.config.wrapUpDuration ?? 60) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.setOperatorStatus(pubkey: operatorPubkey, status: .available)
        }
    }

    // MARK: - Wait Time Estimation

    /// Estimate wait time for a new call at given priority
    /// - Parameters:
    ///   - hotlineId: The hotline identifier
    ///   - priority: The call priority
    /// - Returns: Estimated wait time in seconds
    public func estimateWaitTime(hotlineId: String, priority: HotlineCallPriority) -> TimeInterval {
        let queue = queues[hotlineId] ?? []
        let availableOperators = getAvailableOperators(hotlineId: hotlineId)

        let priorityWeight = priorityWeights[priority] ?? 10

        if availableOperators.isEmpty {
            // No operators: estimate based on average handle time
            let callsAhead = queue.filter {
                (priorityWeights[$0.priority] ?? 10) >= priorityWeight
            }.count
            return TimeInterval(callsAhead) * config.averageHandleTime
        }

        // With available operators, estimate is lower
        let callsAhead = queue.filter {
            (priorityWeights[$0.priority] ?? 10) >= priorityWeight
        }.count

        return (TimeInterval(callsAhead) * config.averageHandleTime) / TimeInterval(availableOperators.count)
    }

    /// Update wait time estimates for all calls in queue
    /// - Parameter hotlineId: The hotline identifier
    public func updateWaitEstimates(hotlineId: String) {
        guard var queue = queues[hotlineId], !queue.isEmpty else { return }

        let availableOperators = getAvailableOperators(hotlineId: hotlineId)
        let operatorCount = max(1, availableOperators.count)

        for i in 0..<queue.count {
            queue[i].estimatedWaitTime = (TimeInterval(i + 1) * config.averageHandleTime) / TimeInterval(operatorCount)
        }

        queues[hotlineId] = queue

        let averageWait = queue.reduce(0) { $0 + $1.estimatedWaitTime } / TimeInterval(queue.count)
        waitTimeUpdated.send((hotlineId: hotlineId, estimatedWait: averageWait))
    }

    // MARK: - Private Methods

    /// Handle ring timeout - return call to queue
    private func handleRingTimeout(callId: String) async {
        clearRingTimer(callId: callId)

        for (hotlineId, var queue) in queues {
            guard let index = queue.firstIndex(where: { $0.callId == callId }),
                  let assignedOperator = queue[index].assignedOperator else {
                continue
            }

            // Reset the operator back to available
            if var operatorState = operators[assignedOperator] {
                operatorState.status = .available
                operatorState.currentCallId = nil
                operators[assignedOperator] = operatorState
                operatorStatusChanged.send(operatorState)
            }

            // Remove assignment and potentially bump priority
            var call = queue[index]
            call.assignedOperator = nil
            call.ringStartedAt = nil

            // Bump priority for long-waiting callers
            if call.priority != .urgent {
                let priorities: [HotlineCallPriority] = [.low, .medium, .high, .urgent]
                if let currentIndex = priorities.firstIndex(of: call.priority),
                   currentIndex < priorities.count - 1 {
                    call.priority = priorities[currentIndex + 1]

                    // Re-sort queue
                    queue.remove(at: index)
                    insertByPriority(&queue, call: &call)
                } else {
                    queue[index] = call
                }
            } else {
                queue[index] = call
            }

            queues[hotlineId] = queue
            updatePositions(hotlineId: hotlineId)

            callReturnedToQueue.send(callId)

            logger.info("Call \(callId) returned to queue due to ring timeout")

            // Try to assign to another operator
            await attemptDistribution(hotlineId: hotlineId)
            break
        }
    }

    /// Insert call into queue by priority order
    private func insertByPriority(_ queue: inout [QueuedCall], call: inout QueuedCall) {
        let callWeight = priorityWeights[call.priority] ?? 10

        let insertIndex = queue.firstIndex { existingCall in
            let existingWeight = priorityWeights[existingCall.priority] ?? 10
            return existingWeight < callWeight ||
                (existingWeight == callWeight && existingCall.queuedAt > call.queuedAt)
        }

        if let index = insertIndex {
            queue.insert(call, at: index)
        } else {
            queue.append(call)
        }
    }

    /// Update queue positions after changes
    private func updatePositions(hotlineId: String) {
        guard var queue = queues[hotlineId] else { return }

        for i in 0..<queue.count {
            queue[i].position = i + 1
        }

        queues[hotlineId] = queue
    }

    /// Clear ring timer for a call
    private func clearRingTimer(callId: String) {
        ringTimers[callId]?.cancel()
        ringTimers.removeValue(forKey: callId)
    }

    /// Clear wrap-up timer for an operator
    private func clearWrapUpTimer(pubkey: String) {
        wrapUpTimers[pubkey]?.cancel()
        wrapUpTimers.removeValue(forKey: pubkey)
    }

    /// Clean up all resources
    public func cleanup() {
        ringTimers.values.forEach { $0.cancel() }
        ringTimers.removeAll()

        wrapUpTimers.values.forEach { $0.cancel() }
        wrapUpTimers.removeAll()

        queues.removeAll()
        operators.removeAll()

        cancellables.removeAll()
    }
}

// MARK: - Hotline Call Priority

/// Priority levels for hotline calls
public enum HotlineCallPriority: String, Codable, CaseIterable, Sendable {
    case urgent
    case high
    case medium
    case low
}

// MARK: - Hotline Operator State

/// Status of a hotline operator
public enum HotlineOperatorState: String, Codable, CaseIterable, Sendable {
    case available
    case onCall
    case wrapUp
    case `break`
    case offline
}
