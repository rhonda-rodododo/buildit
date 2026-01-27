// OperatorStatusManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages operator status, shift tracking, and availability.
// Handles break management and shift statistics.

import Foundation
import Combine
import os.log

// MARK: - Shift Statistics

/// Statistics for an operator's shift
public struct ShiftStats: Equatable, Sendable {
    /// When the shift started
    public let shiftStart: Date

    /// Total shift duration in seconds
    public var shiftDuration: TimeInterval

    /// Number of calls handled
    public var callCount: Int

    /// Average call duration in seconds
    public var avgCallDuration: TimeInterval

    /// Total time talking in seconds
    public var totalTalkTime: TimeInterval

    /// Total time calls were on hold in seconds
    public var totalHoldTime: TimeInterval

    /// Total time in wrap-up state in seconds
    public var totalWrapUpTime: TimeInterval

    /// Duration of longest call in seconds
    public var longestCall: TimeInterval

    /// Duration of shortest call in seconds
    public var shortestCall: TimeInterval

    public init(
        shiftStart: Date = Date(),
        shiftDuration: TimeInterval = 0,
        callCount: Int = 0,
        avgCallDuration: TimeInterval = 0,
        totalTalkTime: TimeInterval = 0,
        totalHoldTime: TimeInterval = 0,
        totalWrapUpTime: TimeInterval = 0,
        longestCall: TimeInterval = 0,
        shortestCall: TimeInterval = .infinity
    ) {
        self.shiftStart = shiftStart
        self.shiftDuration = shiftDuration
        self.callCount = callCount
        self.avgCallDuration = avgCallDuration
        self.totalTalkTime = totalTalkTime
        self.totalHoldTime = totalHoldTime
        self.totalWrapUpTime = totalWrapUpTime
        self.longestCall = longestCall
        self.shortestCall = shortestCall
    }
}

// MARK: - Break Types

/// Types of breaks an operator can take
public enum BreakType: String, CaseIterable, Sendable {
    case short
    case meal
    case personal

    /// Maximum duration for this break type in seconds
    public var maxDuration: TimeInterval {
        switch self {
        case .short:
            return 15 * 60  // 15 minutes
        case .meal:
            return 60 * 60  // 60 minutes
        case .personal:
            return 30 * 60  // 30 minutes
        }
    }

    /// Display name for the break type
    public var displayName: String {
        switch self {
        case .short:
            return "Short Break"
        case .meal:
            return "Meal Break"
        case .personal:
            return "Personal Break"
        }
    }
}

// MARK: - Operator Status

/// Full status information for an operator
public struct OperatorStatus: Equatable, Sendable {
    public let hotlineId: String
    public let pubkey: String
    public var status: HotlineOperatorState
    public var currentCallId: String?
    public var callCount: Int
    public let shiftStart: Date
    public var shiftEnd: Date?
    public let timestamp: Date

    public init(
        hotlineId: String,
        pubkey: String,
        status: HotlineOperatorState = .available,
        currentCallId: String? = nil,
        callCount: Int = 0,
        shiftStart: Date = Date(),
        shiftEnd: Date? = nil,
        timestamp: Date = Date()
    ) {
        self.hotlineId = hotlineId
        self.pubkey = pubkey
        self.status = status
        self.currentCallId = currentCallId
        self.callCount = callCount
        self.shiftStart = shiftStart
        self.shiftEnd = shiftEnd
        self.timestamp = timestamp
    }
}

// MARK: - Manager Errors

public enum OperatorStatusError: LocalizedError {
    case noActiveShift
    case cannotBreakWhileOnCall
    case invalidBreakType
    case notOnBreak

    public var errorDescription: String? {
        switch self {
        case .noActiveShift:
            return "No active shift"
        case .cannotBreakWhileOnCall:
            return "Cannot start break while on call"
        case .invalidBreakType:
            return "Invalid break type"
        case .notOnBreak:
            return "Not currently on break"
        }
    }
}

// MARK: - Operator Status Manager

/// Manages operator status, shift tracking, and break times
@MainActor
public class OperatorStatusManager: ObservableObject {
    // MARK: - Published Properties

    /// Current operator status
    @Published public private(set) var currentStatus: OperatorStatus?

    /// Current shift statistics
    @Published public private(set) var shiftStats: ShiftStats?

    /// Whether operator is currently on break
    @Published public private(set) var isOnBreak: Bool = false

    /// Current break type if on break
    @Published public private(set) var currentBreakType: BreakType?

    /// Time remaining in break (seconds)
    @Published public private(set) var breakTimeRemaining: TimeInterval?

    // MARK: - Private Properties

    private let localPubkey: String
    private let logger = Logger(subsystem: "com.buildit", category: "OperatorStatusManager")

    /// Individual call durations for averaging
    private var callDurations: [TimeInterval] = []

    /// Break start time
    private var breakStartTime: Date?

    /// Break overtime timer
    private var breakTimer: Task<Void, Never>?

    /// Break countdown timer
    private var breakCountdownTimer: Task<Void, Never>?

    /// Wrap-up tracking
    private var wrapUpStartTime: Date?

    // MARK: - Event Publishers

    /// Emits when status changes
    public let statusChanged = PassthroughSubject<OperatorStatus, Never>()

    /// Emits when shift starts
    public let shiftStarted = PassthroughSubject<(pubkey: String, hotlineId: String), Never>()

    /// Emits when shift ends
    public let shiftEnded = PassthroughSubject<(pubkey: String, stats: ShiftStats), Never>()

    /// Emits when break starts
    public let breakStartedEvent = PassthroughSubject<(pubkey: String, breakType: BreakType), Never>()

    /// Emits when break ends
    public let breakEndedEvent = PassthroughSubject<String, Never>()

    /// Emits when break goes overtime
    public let breakOvertime = PassthroughSubject<String, Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(localPubkey: String) {
        self.localPubkey = localPubkey
    }

    deinit {
        breakTimer?.cancel()
        breakCountdownTimer?.cancel()
    }

    // MARK: - Shift Management

    /// Start a new shift
    /// - Parameter hotlineId: The hotline identifier
    public func startShift(hotlineId: String) async {
        let now = Date()

        shiftStats = ShiftStats(
            shiftStart: now,
            shiftDuration: 0,
            callCount: 0,
            avgCallDuration: 0,
            totalTalkTime: 0,
            totalHoldTime: 0,
            totalWrapUpTime: 0,
            longestCall: 0,
            shortestCall: .infinity
        )

        callDurations = []

        let status = OperatorStatus(
            hotlineId: hotlineId,
            pubkey: localPubkey,
            status: .available,
            callCount: 0,
            shiftStart: now,
            timestamp: now
        )

        await setStatus(status)
        shiftStarted.send((pubkey: localPubkey, hotlineId: hotlineId))

        logger.info("Shift started for hotline \(hotlineId)")
    }

    /// End the current shift
    /// - Returns: Final shift statistics, or nil if no active shift
    @discardableResult
    public func endShift() async -> ShiftStats? {
        guard var status = currentStatus, var stats = shiftStats else {
            return nil
        }

        let now = Date()
        stats.shiftDuration = now.timeIntervalSince(stats.shiftStart)

        // Calculate average call duration
        if !callDurations.isEmpty {
            stats.avgCallDuration = callDurations.reduce(0, +) / TimeInterval(callDurations.count)
        }

        // Fix shortestCall if no calls were taken
        if stats.shortestCall == .infinity {
            stats.shortestCall = 0
        }

        let finalStats = stats

        // Set status to offline
        status.status = .offline
        status.shiftEnd = now
        await setStatus(status)

        // Clear state
        shiftStats = nil
        currentStatus = nil

        shiftEnded.send((pubkey: localPubkey, stats: finalStats))

        logger.info("Shift ended - \(finalStats.callCount) calls handled")

        return finalStats
    }

    // MARK: - Status Management

    /// Set operator status
    /// - Parameter status: The new status
    public func setStatus(_ status: OperatorStatus) async {
        let previousStatus = currentStatus?.status
        currentStatus = status

        statusChanged.send(status)

        // Handle wrap-up time tracking
        if previousStatus == .wrapUp {
            if let wrapUpStart = wrapUpStartTime {
                shiftStats?.totalWrapUpTime += Date().timeIntervalSince(wrapUpStart)
                wrapUpStartTime = nil
            }
        }

        if status.status == .wrapUp {
            wrapUpStartTime = Date()
        }

        // Handle break end
        if previousStatus == .break && status.status != .break {
            handleBreakEnd()
        }
    }

    /// Update current status
    /// - Parameter newStatus: The new operator state
    public func updateStatus(_ newStatus: HotlineOperatorState) async {
        guard var status = currentStatus else { return }
        status.status = newStatus
        await setStatus(OperatorStatus(
            hotlineId: status.hotlineId,
            pubkey: status.pubkey,
            status: newStatus,
            currentCallId: status.currentCallId,
            callCount: status.callCount,
            shiftStart: status.shiftStart,
            shiftEnd: status.shiftEnd,
            timestamp: Date()
        ))
    }

    // MARK: - Break Management

    /// Start a break
    /// - Parameter breakType: The type of break
    public func startBreak(_ breakType: BreakType) async throws {
        guard var status = currentStatus else {
            throw OperatorStatusError.noActiveShift
        }

        guard status.status != .onCall else {
            throw OperatorStatusError.cannotBreakWhileOnCall
        }

        currentBreakType = breakType
        breakStartTime = Date()
        isOnBreak = true
        breakTimeRemaining = breakType.maxDuration

        status.status = .break
        await setStatus(OperatorStatus(
            hotlineId: status.hotlineId,
            pubkey: status.pubkey,
            status: .break,
            currentCallId: nil,
            callCount: status.callCount,
            shiftStart: status.shiftStart,
            timestamp: Date()
        ))

        // Start overtime warning timer
        breakTimer = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(breakType.maxDuration) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            self?.breakOvertime.send(self?.localPubkey ?? "")
        }

        // Start countdown timer
        breakCountdownTimer = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                guard !Task.isCancelled else { return }
                if let start = self?.breakStartTime, let maxDuration = self?.currentBreakType?.maxDuration {
                    let elapsed = Date().timeIntervalSince(start)
                    let remaining = max(0, maxDuration - elapsed)
                    self?.breakTimeRemaining = remaining
                }
            }
        }

        breakStartedEvent.send((pubkey: localPubkey, breakType: breakType))

        logger.info("Started \(breakType.displayName)")
    }

    /// End break and return to available
    public func endBreak() async throws {
        guard currentStatus?.status == .break else {
            throw OperatorStatusError.notOnBreak
        }

        handleBreakEnd()

        await updateStatus(.available)

        breakEndedEvent.send(localPubkey)

        logger.info("Break ended, returning to available")
    }

    /// Handle break end cleanup
    private func handleBreakEnd() {
        breakTimer?.cancel()
        breakTimer = nil

        breakCountdownTimer?.cancel()
        breakCountdownTimer = nil

        breakStartTime = nil
        currentBreakType = nil
        isOnBreak = false
        breakTimeRemaining = nil
    }

    // MARK: - Call Tracking

    /// Record a call completion
    /// - Parameters:
    ///   - duration: Total call duration in seconds
    ///   - holdTime: Time the call was on hold in seconds
    public func recordCallCompletion(duration: TimeInterval, holdTime: TimeInterval = 0) {
        guard var stats = shiftStats else { return }

        callDurations.append(duration)
        stats.callCount += 1
        stats.totalTalkTime += duration - holdTime
        stats.totalHoldTime += holdTime

        if duration > stats.longestCall {
            stats.longestCall = duration
        }
        if duration < stats.shortestCall {
            stats.shortestCall = duration
        }

        shiftStats = stats

        // Update current status call count
        if var status = currentStatus {
            status.callCount = stats.callCount
            statusChanged.send(status)
        }

        logger.debug("Recorded call completion: \(duration)s duration")
    }

    // MARK: - Status Queries

    /// Get current status
    public func getStatus() -> OperatorStatus? {
        currentStatus
    }

    /// Get current shift stats
    public func getShiftStats() -> ShiftStats? {
        guard var stats = shiftStats else { return nil }

        // Update duration to current time
        stats.shiftDuration = Date().timeIntervalSince(stats.shiftStart)

        return stats
    }

    /// Get break time remaining (in seconds)
    public func getBreakTimeRemaining() -> TimeInterval? {
        breakTimeRemaining
    }

    /// Check if operator is available to take calls
    public func isAvailable() -> Bool {
        currentStatus?.status == .available
    }

    /// Check if operator is on a call
    public func isOnCall() -> Bool {
        currentStatus?.status == .onCall
    }

    /// Get formatted shift duration string
    public func getFormattedShiftDuration() -> String {
        guard let stats = getShiftStats() else { return "0:00:00" }

        let hours = Int(stats.shiftDuration) / 3600
        let minutes = (Int(stats.shiftDuration) % 3600) / 60
        let seconds = Int(stats.shiftDuration) % 60

        return String(format: "%d:%02d:%02d", hours, minutes, seconds)
    }

    /// Get formatted break time remaining
    public func getFormattedBreakTimeRemaining() -> String {
        guard let remaining = breakTimeRemaining else { return "0:00" }

        let minutes = Int(remaining) / 60
        let seconds = Int(remaining) % 60

        return String(format: "%d:%02d", minutes, seconds)
    }

    // MARK: - Cleanup

    public func cleanup() {
        breakTimer?.cancel()
        breakTimer = nil

        breakCountdownTimer?.cancel()
        breakCountdownTimer = nil

        currentStatus = nil
        shiftStats = nil
        callDurations = []
        breakStartTime = nil
        currentBreakType = nil
        isOnBreak = false
        breakTimeRemaining = nil
        wrapUpStartTime = nil

        cancellables.removeAll()
    }
}

// MARK: - Shift Stats Extensions

extension ShiftStats {
    /// Average handle time per call
    public var averageHandleTime: TimeInterval {
        guard callCount > 0 else { return 0 }
        return totalTalkTime / TimeInterval(callCount)
    }

    /// Occupancy rate (percentage of shift spent on calls)
    public var occupancyRate: Double {
        guard shiftDuration > 0 else { return 0 }
        return (totalTalkTime / shiftDuration) * 100
    }

    /// Calls per hour
    public var callsPerHour: Double {
        guard shiftDuration > 0 else { return 0 }
        let hours = shiftDuration / 3600
        return Double(callCount) / hours
    }

    /// Formatted longest call duration
    public var formattedLongestCall: String {
        formatDuration(longestCall)
    }

    /// Formatted shortest call duration
    public var formattedShortestCall: String {
        let adjusted = shortestCall == .infinity ? 0 : shortestCall
        return formatDuration(adjusted)
    }

    /// Formatted average call duration
    public var formattedAvgCallDuration: String {
        formatDuration(avgCallDuration)
    }

    /// Formatted total talk time
    public var formattedTotalTalkTime: String {
        formatDuration(totalTalkTime)
    }

    /// Format duration as MM:SS or HH:MM:SS
    private func formatDuration(_ duration: TimeInterval) -> String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        let seconds = Int(duration) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
}
