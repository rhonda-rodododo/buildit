// PSTNCreditsManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles credit balance tracking and usage for PSTN calls.
// Provides alerts for low credit thresholds.

import Foundation
import SwiftUI
import os.log

// MARK: - Credit Thresholds

/// Credit usage thresholds for alerts
public enum CreditThreshold {
    /// 80% used - warning threshold
    public static let warning: Double = 0.80
    /// 95% used - critical threshold
    public static let critical: Double = 0.95
}

// MARK: - PSTN Credits Manager Delegate

/// Delegate protocol for credit events
public protocol PSTNCreditsManagerDelegate: AnyObject {
    func creditsManager(_ manager: PSTNCreditsManager, didUpdateBalance balance: LocalCreditBalance)
    func creditsManager(_ manager: PSTNCreditsManager, creditsLow balance: LocalCreditBalance)
    func creditsManager(_ manager: PSTNCreditsManager, creditsCritical balance: LocalCreditBalance)
    func creditsManager(_ manager: PSTNCreditsManager, creditsExhausted balance: LocalCreditBalance)
    func creditsManager(_ manager: PSTNCreditsManager, didRecordUsage record: PSTNUsageRecord)
}

// MARK: - Local Credit Balance

/// Local credit balance state for UI
public struct LocalCreditBalance: Identifiable, Equatable {
    public let groupId: String
    public var monthlyAllocation: Double
    public var used: Double
    public var remaining: Double
    public var percentUsed: Double
    public var resetDate: Date
    public var isLow: Bool

    public var id: String { groupId }

    public init(
        groupId: String,
        monthlyAllocation: Double,
        used: Double,
        remaining: Double,
        percentUsed: Double,
        resetDate: Date,
        isLow: Bool
    ) {
        self.groupId = groupId
        self.monthlyAllocation = monthlyAllocation
        self.used = used
        self.remaining = remaining
        self.percentUsed = percentUsed
        self.resetDate = resetDate
        self.isLow = isLow
    }

    /// Status color based on usage
    public var statusColor: Color {
        PSTNCreditsManager.getStatusColor(percentUsed: percentUsed)
    }
}

// MARK: - PSTN Usage Record

/// Record of PSTN call usage
public struct PSTNUsageRecord: Identifiable, Codable, Equatable {
    public let callSid: String
    public let direction: PSTNCallDirection
    public let duration: Int // seconds
    public let creditsCost: Double
    public let timestamp: Int
    public let targetPhone: String?

    public var id: String { callSid }

    public init(
        callSid: String,
        direction: PSTNCallDirection,
        duration: Int,
        creditsCost: Double,
        timestamp: Int,
        targetPhone: String? = nil
    ) {
        self.callSid = callSid
        self.direction = direction
        self.duration = duration
        self.creditsCost = creditsCost
        self.timestamp = timestamp
        self.targetPhone = targetPhone
    }

    /// Date of the call
    public var date: Date {
        Date(timeIntervalSince1970: TimeInterval(timestamp))
    }

    /// Formatted duration
    public var formattedDuration: String {
        let minutes = duration / 60
        let seconds = duration % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Usage Summary

/// Usage summary statistics
public struct UsageSummary {
    public let totalCalls: Int
    public let totalMinutes: Int
    public let totalCost: Double
    public let inboundCalls: Int
    public let outboundCalls: Int
    public let averageCallDuration: Int // seconds
    public let peakHour: Int // 0-23

    public init(
        totalCalls: Int = 0,
        totalMinutes: Int = 0,
        totalCost: Double = 0,
        inboundCalls: Int = 0,
        outboundCalls: Int = 0,
        averageCallDuration: Int = 0,
        peakHour: Int = 0
    ) {
        self.totalCalls = totalCalls
        self.totalMinutes = totalMinutes
        self.totalCost = totalCost
        self.inboundCalls = inboundCalls
        self.outboundCalls = outboundCalls
        self.averageCallDuration = averageCallDuration
        self.peakHour = peakHour
    }
}

// MARK: - PSTN Credits Manager

/// Manages credit balances and usage tracking for PSTN calling
@MainActor
public class PSTNCreditsManager: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var balances: [String: LocalCreditBalance] = [:]
    @Published public private(set) var usageHistory: [String: [PSTNUsageRecord]] = [:]
    @Published public private(set) var isLoading: Bool = false

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "PSTNCreditsManager")

    private let workerUrl: String
    private let pollingInterval: TimeInterval

    private var pollingTimer: Timer?
    private var pollingGroupIds: [String] = []

    public weak var delegate: PSTNCreditsManagerDelegate?

    // MARK: - Initialization

    public init(workerUrl: String, pollingInterval: TimeInterval = 60.0) {
        self.workerUrl = workerUrl
        self.pollingInterval = pollingInterval

        logger.info("PSTN Credits Manager initialized")
    }

    // MARK: - Signaling Event Handling

    /// Handle credit event from signaling
    public func handleSignalingEvent(kind: Int, content: String) {
        // PSTN_CREDITS: 24383
        guard kind == 24383 else { return }

        guard let data = content.data(using: .utf8) else {
            logger.warning("Failed to parse credits content")
            return
        }

        let decoder = JSONDecoder()

        do {
            let event = try decoder.decode(CreditsEvent.self, from: data)
            handleCreditsEvent(event)
        } catch {
            logger.error("Failed to decode credits event: \(error.localizedDescription)")
        }
    }

    /// Handle credits event from signaling
    private func handleCreditsEvent(_ data: CreditsEvent) {
        switch data.type {
        case "balance_update":
            guard let monthlyAllocation = data.monthlyAllocation,
                  let used = data.used,
                  let remaining = data.remaining,
                  let resetDate = data.resetDate else {
                logger.warning("Incomplete balance update event")
                return
            }

            let percentUsed = (used / monthlyAllocation) * 100
            let balance = LocalCreditBalance(
                groupId: data.groupId,
                monthlyAllocation: monthlyAllocation,
                used: used,
                remaining: remaining,
                percentUsed: percentUsed,
                resetDate: Date(timeIntervalSince1970: TimeInterval(resetDate)),
                isLow: (used / monthlyAllocation) >= CreditThreshold.warning
            )
            updateBalance(balance)

        case "usage":
            guard let callSid = data.callSid,
                  let direction = data.direction,
                  let duration = data.duration,
                  let creditsCost = data.creditsCost,
                  let timestamp = data.timestamp else {
                logger.warning("Incomplete usage event")
                return
            }

            let record = PSTNUsageRecord(
                callSid: callSid,
                direction: direction == "inbound" ? .inbound : .outbound,
                duration: duration,
                creditsCost: creditsCost,
                timestamp: timestamp,
                targetPhone: data.targetPhone
            )
            recordUsage(data.groupId, record: record)

        default:
            logger.debug("Unknown credits event type: \(data.type)")
        }
    }

    // MARK: - Fetch Balance

    /// Fetch current balance from backend
    public func getBalance(_ groupId: String) async throws -> LocalCreditBalance {
        // Check cache first
        if let cached = balances[groupId] {
            return cached
        }

        isLoading = true
        defer { isLoading = false }

        let url = URL(string: "\(workerUrl)/api/pstn/credits/\(groupId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw CreditsError.fetchFailed("Failed to fetch credit balance")
        }

        let balanceResponse = try JSONDecoder().decode(BalanceResponse.self, from: data)

        let percentUsed = (balanceResponse.used / balanceResponse.monthlyAllocation) * 100
        let balance = LocalCreditBalance(
            groupId: groupId,
            monthlyAllocation: balanceResponse.monthlyAllocation,
            used: balanceResponse.used,
            remaining: balanceResponse.remaining,
            percentUsed: percentUsed,
            resetDate: Date(timeIntervalSince1970: TimeInterval(balanceResponse.resetDate)),
            isLow: (balanceResponse.used / balanceResponse.monthlyAllocation) >= CreditThreshold.warning
        )

        updateBalance(balance)
        return balance
    }

    // MARK: - Fetch Usage History

    /// Get usage history for a group
    public func getUsageHistory(_ groupId: String, days: Int = 30) async throws -> [PSTNUsageRecord] {
        // Check cache first
        if let cached = usageHistory[groupId], !cached.isEmpty {
            let cutoff = Date().addingTimeInterval(-Double(days * 24 * 60 * 60))
            return cached.filter { $0.date >= cutoff }
        }

        let url = URL(string: "\(workerUrl)/api/pstn/credits/\(groupId)/usage?days=\(days)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw CreditsError.fetchFailed("Failed to fetch usage history")
        }

        let usageResponse = try JSONDecoder().decode(UsageHistoryResponse.self, from: data)

        // Cache the records
        usageHistory[groupId] = usageResponse.records

        return usageResponse.records
    }

    // MARK: - Usage Summary

    /// Get usage summary for a group
    public func getUsageSummary(_ groupId: String) async throws -> UsageSummary {
        let records = try await getUsageHistory(groupId)

        guard !records.isEmpty else {
            return UsageSummary()
        }

        let totalCalls = records.count
        let totalMinutes = records.reduce(0) { $0 + $1.duration } / 60
        let totalCost = records.reduce(0.0) { $0 + $1.creditsCost }
        let inboundCalls = records.filter { $0.direction == .inbound }.count
        let outboundCalls = records.filter { $0.direction == .outbound }.count
        let averageCallDuration = records.reduce(0) { $0 + $1.duration } / totalCalls

        // Calculate peak hour
        var hourCounts = [Int](repeating: 0, count: 24)
        for record in records {
            let hour = Calendar.current.component(.hour, from: record.date)
            hourCounts[hour] += 1
        }
        let peakHour = hourCounts.enumerated().max(by: { $0.element < $1.element })?.offset ?? 0

        return UsageSummary(
            totalCalls: totalCalls,
            totalMinutes: totalMinutes,
            totalCost: totalCost,
            inboundCalls: inboundCalls,
            outboundCalls: outboundCalls,
            averageCallDuration: averageCallDuration,
            peakHour: peakHour
        )
    }

    // MARK: - Credits Check

    /// Check if group has sufficient credits for a call
    public func hasCredits(_ groupId: String, estimatedMinutes: Double = 1.0) async -> Bool {
        do {
            let balance = try await getBalance(groupId)
            return balance.remaining >= estimatedMinutes
        } catch {
            logger.error("Failed to check credits: \(error.localizedDescription)")
            return false
        }
    }

    /// Get cached balance (synchronous)
    public func getCachedBalance(_ groupId: String) -> LocalCreditBalance? {
        return balances[groupId]
    }

    /// Get all cached balances
    public func getAllCachedBalances() -> [LocalCreditBalance] {
        return Array(balances.values)
    }

    // MARK: - Balance Updates

    /// Update balance and emit events if needed
    private func updateBalance(_ balance: LocalCreditBalance) {
        let previousBalance = balances[balance.groupId]
        balances[balance.groupId] = balance

        delegate?.creditsManager(self, didUpdateBalance: balance)

        // Check for threshold crossings
        let previousPercent = previousBalance?.percentUsed ?? 0

        if balance.remaining <= 0 {
            delegate?.creditsManager(self, creditsExhausted: balance)
        } else if balance.percentUsed >= CreditThreshold.critical * 100 &&
                  previousPercent < CreditThreshold.critical * 100 {
            delegate?.creditsManager(self, creditsCritical: balance)
        } else if balance.percentUsed >= CreditThreshold.warning * 100 &&
                  previousPercent < CreditThreshold.warning * 100 {
            delegate?.creditsManager(self, creditsLow: balance)
        }
    }

    /// Record a usage event
    private func recordUsage(_ groupId: String, record: PSTNUsageRecord) {
        // Add to history
        var history = usageHistory[groupId] ?? []
        history.append(record)
        usageHistory[groupId] = history

        delegate?.creditsManager(self, didRecordUsage: record)

        // Update balance (deduct credits)
        if var balance = balances[groupId] {
            balance.used += record.creditsCost
            balance.remaining = balance.monthlyAllocation - balance.used
            balance.percentUsed = (balance.used / balance.monthlyAllocation) * 100
            balance.isLow = balance.percentUsed >= CreditThreshold.warning * 100
            updateBalance(balance)
        }
    }

    // MARK: - Polling

    /// Start polling for balance updates
    public func startPolling(groupIds: [String]) {
        stopPolling()
        pollingGroupIds = groupIds

        pollingTimer = Timer.scheduledTimer(withTimeInterval: pollingInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                for groupId in self.pollingGroupIds {
                    _ = try? await self.getBalance(groupId)
                }
            }
        }

        // Fetch immediately
        Task {
            for groupId in groupIds {
                _ = try? await getBalance(groupId)
            }
        }

        logger.info("Started polling for \(groupIds.count) groups")
    }

    /// Stop polling for balance updates
    public func stopPolling() {
        pollingTimer?.invalidate()
        pollingTimer = nil
        pollingGroupIds = []
    }

    // MARK: - Static Helpers

    /// Format credits for display
    public static func formatCredits(_ credits: Double) -> String {
        let creditsInt = Int(credits)
        if creditsInt >= 60 {
            let hours = creditsInt / 60
            let mins = creditsInt % 60
            return mins > 0 ? "\(hours)h \(mins)m" : "\(hours)h"
        }
        return "\(creditsInt)m"
    }

    /// Format percentage for display
    public static func formatPercentage(_ percent: Double) -> String {
        return "\(Int(percent.rounded()))%"
    }

    /// Get status color based on usage
    public static func getStatusColor(percentUsed: Double) -> Color {
        if percentUsed >= CreditThreshold.critical * 100 {
            return .red
        } else if percentUsed >= CreditThreshold.warning * 100 {
            return .yellow
        }
        return .green
    }

    /// Calculate days until reset
    public static func getDaysUntilReset(_ resetDate: Date) -> Int {
        let now = Date()
        let diff = resetDate.timeIntervalSince(now)
        return max(0, Int(ceil(diff / (24 * 60 * 60))))
    }

    // MARK: - Cleanup

    /// Cleanup resources
    public func destroy() {
        stopPolling()
        balances.removeAll()
        usageHistory.removeAll()

        logger.info("PSTN Credits Manager destroyed")
    }
}

// MARK: - Error Types

/// Credits related errors
public enum CreditsError: LocalizedError {
    case fetchFailed(String)

    public var errorDescription: String? {
        switch self {
        case .fetchFailed(let message):
            return "Credits fetch failed: \(message)"
        }
    }
}

// MARK: - API Response Types

private struct CreditsEvent: Codable {
    let type: String
    let groupId: String
    // Balance update fields
    let monthlyAllocation: Double?
    let used: Double?
    let remaining: Double?
    let resetDate: Int?
    // Usage fields
    let callSid: String?
    let direction: String?
    let duration: Int?
    let creditsCost: Double?
    let timestamp: Int?
    let targetPhone: String?
}

private struct BalanceResponse: Codable {
    let monthlyAllocation: Double
    let used: Double
    let remaining: Double
    let resetDate: Int
}

private struct UsageHistoryResponse: Codable {
    let records: [PSTNUsageRecord]
}
