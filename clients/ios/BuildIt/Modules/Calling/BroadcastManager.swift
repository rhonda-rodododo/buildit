// BroadcastManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles multi-channel message broadcasts with scheduling and analytics.
// Supports NIP-17 batched delivery for contact lists.

import Foundation
import Combine
import MessageUI
import os.log

/// Delivery channel for broadcast recipients
public enum BroadcastChannel: String, Codable, Sendable {
    case buildit
    case sms
    case rcs
}

/// Delivery status for individual recipients
public enum DeliveryStatus: String, Codable, Sendable {
    case pending
    case sent
    case delivered
    case read
    case failed
}

/// Broadcast recipient with delivery tracking
public struct BroadcastRecipient: Codable, Sendable, Identifiable {
    public let id: String
    public let pubkey: String
    public var name: String?
    public var phone: String?
    public let channel: BroadcastChannel
    public var deliveryStatus: DeliveryStatus
    public var deliveredAt: Int?
    public var readAt: Int?
    public var repliedAt: Int?
    public var failureReason: String?

    public init(
        id: String = UUID().uuidString,
        pubkey: String,
        name: String? = nil,
        phone: String? = nil,
        channel: BroadcastChannel = .buildit,
        deliveryStatus: DeliveryStatus = .pending,
        deliveredAt: Int? = nil,
        readAt: Int? = nil,
        repliedAt: Int? = nil,
        failureReason: String? = nil
    ) {
        self.id = id
        self.pubkey = pubkey
        self.name = name
        self.phone = phone
        self.channel = channel
        self.deliveryStatus = deliveryStatus
        self.deliveredAt = deliveredAt
        self.readAt = readAt
        self.repliedAt = repliedAt
        self.failureReason = failureReason
    }
}

/// Extended broadcast state with recipients and analytics
public struct BroadcastState: Sendable {
    public var broadcast: Broadcast
    public var recipients: [BroadcastRecipient]
    public var totalRecipients: Int
    public var sentCount: Int
    public var deliveredCount: Int
    public var readCount: Int
    public var repliedCount: Int
    public var failedCount: Int
    public var progress: Double
    public var estimatedCompletionTime: Int?

    public var broadcastId: String { broadcast.broadcastID }
    public var status: BroadcastStatus? { broadcast.status }
    public var content: String { broadcast.content }
    public var title: String? { broadcast.title }

    public init(
        broadcast: Broadcast,
        recipients: [BroadcastRecipient] = [],
        totalRecipients: Int = 0,
        sentCount: Int = 0,
        deliveredCount: Int = 0,
        readCount: Int = 0,
        repliedCount: Int = 0,
        failedCount: Int = 0,
        progress: Double = 0,
        estimatedCompletionTime: Int? = nil
    ) {
        self.broadcast = broadcast
        self.recipients = recipients
        self.totalRecipients = totalRecipients
        self.sentCount = sentCount
        self.deliveredCount = deliveredCount
        self.readCount = readCount
        self.repliedCount = repliedCount
        self.failedCount = failedCount
        self.progress = progress
        self.estimatedCompletionTime = estimatedCompletionTime
    }
}

/// Repeat configuration for scheduled broadcasts
public struct RepeatConfig: Codable, Sendable {
    public let frequency: RepeatFrequency
    public var endDate: Int?
    public var daysOfWeek: [Int]?

    public init(frequency: RepeatFrequency, endDate: Int? = nil, daysOfWeek: [Int]? = nil) {
        self.frequency = frequency
        self.endDate = endDate
        self.daysOfWeek = daysOfWeek
    }
}

public enum RepeatFrequency: String, Codable, Sendable {
    case daily
    case weekly
    case monthly
}

/// Scheduled broadcast with timing and repeat options
public struct ScheduledBroadcast: Sendable {
    public var broadcast: BroadcastState
    public let scheduledFor: Int
    public let timezone: String
    public var repeatConfig: RepeatConfig?

    public init(
        broadcast: BroadcastState,
        scheduledFor: Int,
        timezone: String = "UTC",
        repeatConfig: RepeatConfig? = nil
    ) {
        self.broadcast = broadcast
        self.scheduledFor = scheduledFor
        self.timezone = timezone
        self.repeatConfig = repeatConfig
    }
}

/// Broadcast analytics
public struct BroadcastAnalytics: Sendable {
    public let deliveryRate: Double
    public let readRate: Double
    public let replyRate: Double
    public let avgDeliveryTime: Double
    public let avgReadTime: Double
}

/// Broadcast event for observation
public enum BroadcastEvent: Sendable {
    case created(BroadcastState)
    case updated(BroadcastState)
    case scheduled(ScheduledBroadcast)
    case cancelled(BroadcastState)
    case sending(BroadcastState)
    case progress(BroadcastState)
    case sent(BroadcastState)
    case failed(BroadcastState, String)
    case receipt(broadcast: BroadcastState, recipient: BroadcastRecipient, status: DeliveryStatus)
    case deleted(String)
}

/// Broadcast delivery manager
@MainActor
public class BroadcastManager: ObservableObject {
    // MARK: - Constants

    private static let BUILDIT_BATCH_SIZE = 50
    private static let SMS_RATE_LIMIT_MS: UInt64 = 1_000_000_000 // 1 second in nanoseconds

    // MARK: - Published Properties

    @Published public private(set) var broadcasts: [String: BroadcastState] = [:]
    @Published public private(set) var scheduledBroadcasts: [String: ScheduledBroadcast] = [:]
    @Published public private(set) var isSending: Bool = false

    // MARK: - Properties

    private var senderPubkey: String = ""
    private var schedulerTask: Task<Void, Never>?
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "BroadcastManager")

    // Messaging gateways
    private let smsGateway: SMSGateway
    private let rcsGateway: RCSGateway

    /// Event stream for broadcast changes
    public let eventSubject = PassthroughSubject<BroadcastEvent, Never>()

    // MARK: - Initialization

    public init(smsGateway: SMSGateway? = nil, rcsGateway: RCSGateway? = nil) {
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
        self.smsGateway = smsGateway ?? TwilioSMSGateway()
        self.rcsGateway = rcsGateway ?? RCSBusinessMessagingGateway()
    }

    /// Initialize with sender context
    public func initialize(senderPubkey: String) {
        self.senderPubkey = senderPubkey
        startScheduler()
        logger.info("Initialized BroadcastManager")
    }

    deinit {
        schedulerTask?.cancel()
    }

    // MARK: - Broadcast Creation

    /// Create a new broadcast draft
    public func createDraft(
        title: String,
        content: String,
        targetType: TargetType,
        targetId: String? = nil,
        priority: BroadcastPriority = .normal,
        recipientPubkeys: [String]? = nil,
        attachments: [String]? = nil,
        metadata: [String: String]? = nil
    ) -> BroadcastState {
        let broadcastId = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        let broadcast = Broadcast(
            v: CallingSchema.version,
            analytics: nil,
            broadcastID: broadcastId,
            content: content,
            createdBy: senderPubkey,
            priority: priority,
            scheduledAt: nil,
            sentAt: nil,
            status: .draft,
            targetIDS: targetId.map { [$0] },
            targetType: targetType,
            title: title
        )

        // Create recipients if provided
        var recipients: [BroadcastRecipient] = []
        if let pubkeys = recipientPubkeys {
            recipients = pubkeys.map { pubkey in
                BroadcastRecipient(
                    pubkey: pubkey,
                    channel: .buildit,
                    deliveryStatus: .pending
                )
            }
        }

        let state = BroadcastState(
            broadcast: broadcast,
            recipients: recipients,
            totalRecipients: recipients.count
        )

        broadcasts[broadcastId] = state
        eventSubject.send(.created(state))

        logger.info("Created broadcast draft: \(broadcastId)")
        return state
    }

    /// Update a draft broadcast
    public func updateDraft(
        _ broadcastId: String,
        title: String? = nil,
        content: String? = nil,
        targetType: TargetType? = nil,
        priority: BroadcastPriority? = nil,
        attachments: [String]? = nil
    ) -> BroadcastState? {
        guard var state = broadcasts[broadcastId],
              state.status == .draft else {
            return nil
        }

        let now = Int(Date().timeIntervalSince1970)

        state.broadcast = Broadcast(
            v: state.broadcast.v,
            analytics: state.broadcast.analytics,
            broadcastID: state.broadcast.broadcastID,
            content: content ?? state.broadcast.content,
            createdBy: state.broadcast.createdBy,
            priority: priority ?? state.broadcast.priority,
            scheduledAt: state.broadcast.scheduledAt,
            sentAt: state.broadcast.sentAt,
            status: state.broadcast.status,
            targetIDS: state.broadcast.targetIDS,
            targetType: targetType ?? state.broadcast.targetType,
            title: title ?? state.broadcast.title
        )

        broadcasts[broadcastId] = state
        eventSubject.send(.updated(state))

        return state
    }

    /// Set recipients for a broadcast
    public func setRecipients(
        _ broadcastId: String,
        recipients: [(pubkey: String, name: String?, phone: String?, channel: BroadcastChannel)]
    ) -> BroadcastState? {
        guard var state = broadcasts[broadcastId],
              state.status == .draft else {
            return nil
        }

        state.recipients = recipients.map { r in
            BroadcastRecipient(
                pubkey: r.pubkey,
                name: r.name,
                phone: r.phone,
                channel: r.channel,
                deliveryStatus: .pending
            )
        }
        state.totalRecipients = recipients.count

        broadcasts[broadcastId] = state
        eventSubject.send(.updated(state))

        return state
    }

    // MARK: - Scheduling

    /// Schedule a broadcast for future delivery
    public func scheduleBroadcast(
        _ broadcastId: String,
        scheduledFor: Int,
        timezone: String = "UTC",
        repeatConfig: RepeatConfig? = nil
    ) -> ScheduledBroadcast? {
        guard var state = broadcasts[broadcastId],
              state.status == .draft else {
            return nil
        }

        // Update broadcast status
        state.broadcast = Broadcast(
            v: state.broadcast.v,
            analytics: state.broadcast.analytics,
            broadcastID: state.broadcast.broadcastID,
            content: state.broadcast.content,
            createdBy: state.broadcast.createdBy,
            priority: state.broadcast.priority,
            scheduledAt: scheduledFor,
            sentAt: state.broadcast.sentAt,
            status: .scheduled,
            targetIDS: state.broadcast.targetIDS,
            targetType: state.broadcast.targetType,
            title: state.broadcast.title
        )

        broadcasts[broadcastId] = state

        let scheduled = ScheduledBroadcast(
            broadcast: state,
            scheduledFor: scheduledFor,
            timezone: timezone,
            repeatConfig: repeatConfig
        )

        scheduledBroadcasts[broadcastId] = scheduled
        eventSubject.send(.scheduled(scheduled))

        logger.info("Scheduled broadcast: \(broadcastId) for \(scheduledFor)")
        return scheduled
    }

    /// Cancel a scheduled broadcast
    public func cancelScheduled(_ broadcastId: String) -> Bool {
        guard var scheduled = scheduledBroadcasts[broadcastId] else {
            return false
        }

        // Revert to draft status
        scheduled.broadcast.broadcast = Broadcast(
            v: scheduled.broadcast.broadcast.v,
            analytics: scheduled.broadcast.broadcast.analytics,
            broadcastID: scheduled.broadcast.broadcast.broadcastID,
            content: scheduled.broadcast.broadcast.content,
            createdBy: scheduled.broadcast.broadcast.createdBy,
            priority: scheduled.broadcast.broadcast.priority,
            scheduledAt: nil,
            sentAt: scheduled.broadcast.broadcast.sentAt,
            status: .draft,
            targetIDS: scheduled.broadcast.broadcast.targetIDS,
            targetType: scheduled.broadcast.broadcast.targetType,
            title: scheduled.broadcast.broadcast.title
        )

        broadcasts[broadcastId] = scheduled.broadcast
        scheduledBroadcasts.removeValue(forKey: broadcastId)
        eventSubject.send(.cancelled(scheduled.broadcast))

        logger.info("Cancelled scheduled broadcast: \(broadcastId)")
        return true
    }

    // MARK: - Sending

    /// Send a broadcast immediately
    public func sendBroadcast(_ broadcastId: String) async throws -> BroadcastState {
        guard var state = broadcasts[broadcastId] else {
            throw BroadcastError.notFound
        }

        guard state.status == .draft || state.status == .scheduled else {
            throw BroadcastError.alreadySent
        }

        // Confirm emergency priority
        if state.broadcast.priority == .emergency {
            logger.warning("Sending emergency broadcast - this bypasses DND settings")
        }

        let now = Int(Date().timeIntervalSince1970)

        // Update to sending status
        state.broadcast = updateBroadcastStatus(state.broadcast, status: .sending, sentAt: now)
        broadcasts[broadcastId] = state

        isSending = true
        eventSubject.send(.sending(state))

        do {
            try await deliverToRecipients(&state)

            state.broadcast = updateBroadcastStatus(state.broadcast, status: .sent)
            state.progress = 100

            broadcasts[broadcastId] = state
            scheduledBroadcasts.removeValue(forKey: broadcastId)

            eventSubject.send(.sent(state))
            logger.info("Sent broadcast: \(broadcastId)")
        } catch {
            state.broadcast = updateBroadcastStatus(state.broadcast, status: .failed)
            broadcasts[broadcastId] = state

            eventSubject.send(.failed(state, error.localizedDescription))
            logger.error("Failed to send broadcast: \(error.localizedDescription)")
            throw error
        }

        isSending = false
        return state
    }

    // MARK: - Delivery

    private func deliverToRecipients(_ state: inout BroadcastState) async throws {
        let builtItRecipients = state.recipients.filter { $0.channel == .buildit }
        let smsRecipients = state.recipients.filter { $0.channel == .sms }
        let rcsRecipients = state.recipients.filter { $0.channel == .rcs }

        // Send to BuildIt users in batches
        if !builtItRecipients.isEmpty {
            try await sendToBuildIt(&state, recipients: builtItRecipients)
        }

        // Send to SMS recipients with rate limiting
        if !smsRecipients.isEmpty {
            try await sendToSMS(&state, recipients: smsRecipients)
        }

        // Send to RCS recipients
        if !rcsRecipients.isEmpty {
            try await sendToRCS(&state, recipients: rcsRecipients)
        }
    }

    /// Send to BuildIt users via NIP-17 DMs in batches
    private func sendToBuildIt(
        _ state: inout BroadcastState,
        recipients: [BroadcastRecipient]
    ) async throws {
        let batches = chunk(recipients, size: Self.BUILDIT_BATCH_SIZE)
        let totalBatches = batches.count

        for (batchIndex, batch) in batches.enumerated() {
            // Send batch in parallel
            await withTaskGroup(of: (String, Result<Void, Error>).self) { group in
                for recipient in batch {
                    group.addTask { [weak self] in
                        do {
                            try await self?.sendNIP17Message(
                                content: state.content,
                                to: recipient.pubkey
                            )
                            return (recipient.id, .success(()))
                        } catch {
                            return (recipient.id, .failure(error))
                        }
                    }
                }

                for await (recipientId, result) in group {
                    if let index = state.recipients.firstIndex(where: { $0.id == recipientId }) {
                        switch result {
                        case .success:
                            state.recipients[index].deliveryStatus = .sent
                            state.recipients[index].deliveredAt = Int(Date().timeIntervalSince1970)
                            state.sentCount += 1
                            state.deliveredCount += 1
                        case .failure(let error):
                            state.recipients[index].deliveryStatus = .failed
                            state.recipients[index].failureReason = error.localizedDescription
                            state.failedCount += 1
                        }
                    }
                }
            }

            // Update progress
            state.progress = Double(batchIndex + 1) / Double(totalBatches) * 100
            broadcasts[state.broadcastId] = state
            eventSubject.send(.progress(state))
        }
    }

    /// Send to SMS recipients with rate limiting
    private func sendToSMS(
        _ state: inout BroadcastState,
        recipients: [BroadcastRecipient]
    ) async throws {
        for recipient in recipients {
            guard let phone = recipient.phone else {
                updateRecipientStatus(&state, recipientId: recipient.id, status: .failed, reason: "No phone number")
                state.failedCount += 1
                broadcasts[state.broadcastId] = state
                eventSubject.send(.progress(state))
                continue
            }

            do {
                // Rate limiting: 1 message per second to respect carrier limits
                try await Task.sleep(nanoseconds: Self.SMS_RATE_LIMIT_MS)

                try await smsGateway.send(to: phone, body: state.content)

                updateRecipientStatus(&state, recipientId: recipient.id, status: .sent)
                state.sentCount += 1
                state.deliveredCount += 1
            } catch {
                updateRecipientStatus(&state, recipientId: recipient.id, status: .failed, reason: error.localizedDescription)
                state.failedCount += 1
            }

            broadcasts[state.broadcastId] = state
            eventSubject.send(.progress(state))
        }
    }

    /// Send to RCS recipients with SMS fallback
    private func sendToRCS(
        _ state: inout BroadcastState,
        recipients: [BroadcastRecipient]
    ) async throws {
        for recipient in recipients {
            guard let phone = recipient.phone else {
                updateRecipientStatus(&state, recipientId: recipient.id, status: .failed, reason: "No phone number")
                state.failedCount += 1
                broadcasts[state.broadcastId] = state
                eventSubject.send(.progress(state))
                continue
            }

            do {
                // Rate limiting
                try await Task.sleep(nanoseconds: Self.SMS_RATE_LIMIT_MS)

                // Try RCS first, fall back to SMS
                do {
                    try await rcsGateway.send(to: phone, body: state.content, richContent: nil)
                } catch RCSGatewayError.recipientNotSupported {
                    // Fallback to SMS when RCS is unavailable for this recipient
                    logger.info("RCS unavailable for \(phone.suffix(4)), falling back to SMS")
                    try await smsGateway.send(to: phone, body: state.content)
                }

                updateRecipientStatus(&state, recipientId: recipient.id, status: .sent)
                state.sentCount += 1
                state.deliveredCount += 1
            } catch {
                updateRecipientStatus(&state, recipientId: recipient.id, status: .failed, reason: error.localizedDescription)
                state.failedCount += 1
            }

            broadcasts[state.broadcastId] = state
            eventSubject.send(.progress(state))
        }
    }

    /// Send NIP-17 encrypted direct message
    private func sendNIP17Message(content: String, to recipientPubkey: String) async throws {
        _ = try await nostrClient.sendDirectMessage(content, to: recipientPubkey)
    }

    // MARK: - Receipt Handling

    /// Handle delivery receipt
    public func handleDeliveryReceipt(
        _ broadcastId: String,
        recipientPubkey: String,
        status: DeliveryStatus
    ) {
        guard var state = broadcasts[broadcastId] else { return }

        guard let index = state.recipients.firstIndex(where: { $0.pubkey == recipientPubkey }) else {
            return
        }

        let now = Int(Date().timeIntervalSince1970)
        var recipient = state.recipients[index]

        switch status {
        case .delivered:
            if recipient.deliveryStatus == .sent {
                recipient.deliveryStatus = .delivered
                recipient.deliveredAt = now
                state.deliveredCount += 1
            }
        case .read:
            if recipient.readAt == nil {
                recipient.readAt = now
                state.readCount += 1
            }
        case .pending, .sent, .failed:
            break
        }

        state.recipients[index] = recipient
        broadcasts[broadcastId] = state

        eventSubject.send(.receipt(broadcast: state, recipient: recipient, status: status))
    }

    // MARK: - Queries

    /// Get broadcast by ID
    public func get(_ broadcastId: String) -> BroadcastState? {
        broadcasts[broadcastId]
    }

    /// Get all broadcasts
    public func getAll() -> [BroadcastState] {
        Array(broadcasts.values).sorted { $0.broadcast.broadcastID > $1.broadcast.broadcastID }
    }

    /// Get broadcasts by status
    public func getByStatus(_ status: BroadcastStatus) -> [BroadcastState] {
        getAll().filter { $0.status == status }
    }

    /// Get analytics for a broadcast
    public func getAnalytics(_ broadcastId: String) -> BroadcastAnalytics? {
        guard let state = broadcasts[broadcastId] else { return nil }

        let deliveryRate = state.totalRecipients > 0
            ? Double(state.deliveredCount) / Double(state.totalRecipients) * 100
            : 0

        let readRate = state.deliveredCount > 0
            ? Double(state.readCount) / Double(state.deliveredCount) * 100
            : 0

        let replyRate = state.deliveredCount > 0
            ? Double(state.repliedCount) / Double(state.deliveredCount) * 100
            : 0

        // Calculate average delivery time
        let sentAt = state.broadcast.sentAt ?? 0
        let deliveryTimes = state.recipients
            .compactMap { $0.deliveredAt }
            .map { $0 - sentAt }
        let avgDeliveryTime = deliveryTimes.isEmpty ? 0 :
            Double(deliveryTimes.reduce(0, +)) / Double(deliveryTimes.count)

        // Calculate average read time
        let readTimes = state.recipients
            .compactMap { r -> Int? in
                guard let readAt = r.readAt, let deliveredAt = r.deliveredAt else { return nil }
                return readAt - deliveredAt
            }
        let avgReadTime = readTimes.isEmpty ? 0 :
            Double(readTimes.reduce(0, +)) / Double(readTimes.count)

        return BroadcastAnalytics(
            deliveryRate: deliveryRate,
            readRate: readRate,
            replyRate: replyRate,
            avgDeliveryTime: avgDeliveryTime,
            avgReadTime: avgReadTime
        )
    }

    /// Delete a broadcast (only drafts)
    public func delete(_ broadcastId: String) -> Bool {
        guard let state = broadcasts[broadcastId], state.status == .draft else {
            return false
        }

        broadcasts.removeValue(forKey: broadcastId)
        scheduledBroadcasts.removeValue(forKey: broadcastId)
        eventSubject.send(.deleted(broadcastId))

        logger.info("Deleted broadcast: \(broadcastId)")
        return true
    }

    // MARK: - Scheduler

    private func startScheduler() {
        schedulerTask?.cancel()
        schedulerTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.checkScheduledBroadcasts()
                try? await Task.sleep(nanoseconds: 60_000_000_000) // Check every minute
            }
        }
    }

    private func checkScheduledBroadcasts() async {
        let now = Int(Date().timeIntervalSince1970)

        for (broadcastId, scheduled) in scheduledBroadcasts {
            if scheduled.scheduledFor <= now {
                do {
                    _ = try await sendBroadcast(broadcastId)

                    // Handle repeat if configured
                    if let repeatConfig = scheduled.repeatConfig {
                        if let nextTime = calculateNextScheduleTime(scheduled) {
                            var newScheduled = scheduled
                            newScheduled.broadcast.broadcast = Broadcast(
                                v: scheduled.broadcast.broadcast.v,
                                analytics: nil,
                                broadcastID: UUID().uuidString, // New ID for repeat
                                content: scheduled.broadcast.broadcast.content,
                                createdBy: scheduled.broadcast.broadcast.createdBy,
                                priority: scheduled.broadcast.broadcast.priority,
                                scheduledAt: nextTime,
                                sentAt: nil,
                                status: .scheduled,
                                targetIDS: scheduled.broadcast.broadcast.targetIDS,
                                targetType: scheduled.broadcast.broadcast.targetType,
                                title: scheduled.broadcast.broadcast.title
                            )

                            let newId = newScheduled.broadcast.broadcastId
                            broadcasts[newId] = newScheduled.broadcast
                            scheduledBroadcasts[newId] = ScheduledBroadcast(
                                broadcast: newScheduled.broadcast,
                                scheduledFor: nextTime,
                                timezone: scheduled.timezone,
                                repeatConfig: repeatConfig
                            )
                        }
                    }
                } catch {
                    logger.error("Failed to send scheduled broadcast \(broadcastId): \(error.localizedDescription)")
                }
            }
        }
    }

    private func calculateNextScheduleTime(_ scheduled: ScheduledBroadcast) -> Int? {
        guard let repeatConfig = scheduled.repeatConfig else { return nil }

        let calendar = Calendar.current
        let currentDate = Date(timeIntervalSince1970: TimeInterval(scheduled.scheduledFor))
        var nextDate: Date

        switch repeatConfig.frequency {
        case .daily:
            nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
        case .weekly:
            nextDate = calendar.date(byAdding: .weekOfYear, value: 1, to: currentDate) ?? currentDate
        case .monthly:
            nextDate = calendar.date(byAdding: .month, value: 1, to: currentDate) ?? currentDate
        }

        // Handle specific days of week
        if let daysOfWeek = repeatConfig.daysOfWeek, !daysOfWeek.isEmpty {
            while let weekday = calendar.dateComponents([.weekday], from: nextDate).weekday,
                  !daysOfWeek.contains(weekday) {
                nextDate = calendar.date(byAdding: .day, value: 1, to: nextDate) ?? nextDate
            }
        }

        // Check end date
        if let endDate = repeatConfig.endDate {
            let endTime = TimeInterval(endDate)
            if nextDate.timeIntervalSince1970 > endTime {
                return nil
            }
        }

        return Int(nextDate.timeIntervalSince1970)
    }

    // MARK: - Helpers

    private func updateBroadcastStatus(
        _ broadcast: Broadcast,
        status: BroadcastStatus,
        sentAt: Int? = nil
    ) -> Broadcast {
        Broadcast(
            v: broadcast.v,
            analytics: broadcast.analytics,
            broadcastID: broadcast.broadcastID,
            content: broadcast.content,
            createdBy: broadcast.createdBy,
            priority: broadcast.priority,
            scheduledAt: broadcast.scheduledAt,
            sentAt: sentAt ?? broadcast.sentAt,
            status: status,
            targetIDS: broadcast.targetIDS,
            targetType: broadcast.targetType,
            title: broadcast.title
        )
    }

    private func updateRecipientStatus(
        _ state: inout BroadcastState,
        recipientId: String,
        status: DeliveryStatus,
        reason: String? = nil
    ) {
        guard let index = state.recipients.firstIndex(where: { $0.id == recipientId }) else {
            return
        }

        state.recipients[index].deliveryStatus = status
        if status == .sent {
            state.recipients[index].deliveredAt = Int(Date().timeIntervalSince1970)
        }
        if let reason = reason {
            state.recipients[index].failureReason = reason
        }
    }

    private func chunk<T>(_ array: [T], size: Int) -> [[T]] {
        stride(from: 0, to: array.count, by: size).map {
            Array(array[$0..<min($0 + size, array.count)])
        }
    }
}

// MARK: - Errors

public enum BroadcastError: LocalizedError {
    case notFound
    case alreadySent
    case sendFailed(String)

    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "Broadcast not found"
        case .alreadySent:
            return "Broadcast has already been sent"
        case .sendFailed(let reason):
            return "Failed to send broadcast: \(reason)"
        }
    }
}

// MARK: - SMS Gateway

/// Protocol for SMS delivery
public protocol SMSGateway: Sendable {
    /// Send an SMS message to a phone number
    func send(to phone: String, body: String) async throws

    /// Check delivery status for a message
    func checkDeliveryStatus(messageId: String) async throws -> DeliveryStatus
}

/// Errors specific to SMS delivery
public enum SMSGatewayError: LocalizedError {
    case invalidPhoneNumber
    case rateLimited
    case deliveryFailed(String)
    case configurationMissing

    public var errorDescription: String? {
        switch self {
        case .invalidPhoneNumber:
            return "Invalid phone number format"
        case .rateLimited:
            return "SMS rate limit exceeded"
        case .deliveryFailed(let reason):
            return "SMS delivery failed: \(reason)"
        case .configurationMissing:
            return "SMS gateway configuration is missing"
        }
    }
}

/// Twilio-based SMS gateway for server-side SMS delivery
public final class TwilioSMSGateway: SMSGateway {
    private let logger = Logger(subsystem: "com.buildit", category: "TwilioSMSGateway")

    // API endpoint configured via BuildIt worker
    private let apiBaseURL: String
    private let session: URLSession

    // Rate limiting state (not Sendable across isolation domains)
    private let rateLimiter = SMSRateLimiter()

    public init(apiBaseURL: String? = nil) {
        self.apiBaseURL = apiBaseURL ?? "https://api.buildit.network"
        self.session = URLSession.shared
    }

    public func send(to phone: String, body: String) async throws {
        // Validate phone number format (E.164)
        guard isValidE164(phone) else {
            throw SMSGatewayError.invalidPhoneNumber
        }

        // Check rate limit
        guard await rateLimiter.allowSend() else {
            throw SMSGatewayError.rateLimited
        }

        // Send via BuildIt API worker which proxies to Twilio
        let url = URL(string: "\(apiBaseURL)/api/sms/send")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = SMSSendRequest(to: phone, body: body)
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SMSGatewayError.deliveryFailed("Invalid response")
        }

        switch httpResponse.statusCode {
        case 200...299:
            let result = try JSONDecoder().decode(SMSSendResponse.self, from: data)
            logger.info("SMS sent successfully, messageId: \(result.messageId)")
        case 429:
            throw SMSGatewayError.rateLimited
        default:
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw SMSGatewayError.deliveryFailed(errorText)
        }
    }

    public func checkDeliveryStatus(messageId: String) async throws -> DeliveryStatus {
        let url = URL(string: "\(apiBaseURL)/api/sms/status/\(messageId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return .pending
        }

        let result = try JSONDecoder().decode(SMSStatusResponse.self, from: data)
        switch result.status {
        case "delivered": return .delivered
        case "sent": return .sent
        case "failed": return .failed
        default: return .pending
        }
    }

    /// Validate E.164 phone number format
    private func isValidE164(_ phone: String) -> Bool {
        let pattern = "^\\+[1-9]\\d{1,14}$"
        return phone.range(of: pattern, options: .regularExpression) != nil
    }
}

/// Rate limiter for SMS sending (1 message per second)
private actor SMSRateLimiter {
    private var lastSendTime: Date?

    func allowSend() -> Bool {
        let now = Date()
        if let last = lastSendTime, now.timeIntervalSince(last) < 1.0 {
            return false
        }
        lastSendTime = now
        return true
    }
}

// MARK: - SMS API Types

private struct SMSSendRequest: Codable {
    let to: String
    let body: String
}

private struct SMSSendResponse: Codable {
    let messageId: String
    let status: String
}

private struct SMSStatusResponse: Codable {
    let messageId: String
    let status: String
}

// MARK: - RCS Gateway

/// Protocol for RCS Business Messaging delivery
public protocol RCSGateway: Sendable {
    /// Send an RCS message to a phone number
    /// - Parameters:
    ///   - phone: E.164 formatted phone number
    ///   - body: Plain text message body
    ///   - richContent: Optional rich content (images, cards, etc.)
    func send(to phone: String, body: String, richContent: RCSRichContent?) async throws

    /// Check if a recipient supports RCS
    func checkRCSCapability(phone: String) async throws -> Bool
}

/// Rich content for RCS messages
public struct RCSRichContent: Sendable {
    public let imageURL: String?
    public let cardTitle: String?
    public let cardDescription: String?
    public let actionURL: String?

    public init(
        imageURL: String? = nil,
        cardTitle: String? = nil,
        cardDescription: String? = nil,
        actionURL: String? = nil
    ) {
        self.imageURL = imageURL
        self.cardTitle = cardTitle
        self.cardDescription = cardDescription
        self.actionURL = actionURL
    }
}

/// Errors specific to RCS delivery
public enum RCSGatewayError: LocalizedError {
    case recipientNotSupported
    case invalidPhoneNumber
    case rateLimited
    case deliveryFailed(String)
    case configurationMissing

    public var errorDescription: String? {
        switch self {
        case .recipientNotSupported:
            return "Recipient does not support RCS"
        case .invalidPhoneNumber:
            return "Invalid phone number format"
        case .rateLimited:
            return "RCS rate limit exceeded"
        case .deliveryFailed(let reason):
            return "RCS delivery failed: \(reason)"
        case .configurationMissing:
            return "RCS gateway configuration is missing"
        }
    }
}

/// RCS Business Messaging gateway implementation
public final class RCSBusinessMessagingGateway: RCSGateway {
    private let logger = Logger(subsystem: "com.buildit", category: "RCSGateway")

    // API endpoint configured via BuildIt worker
    private let apiBaseURL: String
    private let session: URLSession

    public init(apiBaseURL: String? = nil) {
        self.apiBaseURL = apiBaseURL ?? "https://api.buildit.network"
        self.session = URLSession.shared
    }

    public func send(to phone: String, body: String, richContent: RCSRichContent?) async throws {
        // Validate phone number format (E.164)
        guard isValidE164(phone) else {
            throw RCSGatewayError.invalidPhoneNumber
        }

        // Check RCS capability first
        let supportsRCS = try await checkRCSCapability(phone: phone)
        guard supportsRCS else {
            throw RCSGatewayError.recipientNotSupported
        }

        // Build RCS message payload
        let url = URL(string: "\(apiBaseURL)/api/rcs/send")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = RCSSendRequest(
            to: phone,
            body: body,
            imageURL: richContent?.imageURL,
            cardTitle: richContent?.cardTitle,
            cardDescription: richContent?.cardDescription,
            actionURL: richContent?.actionURL
        )
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw RCSGatewayError.deliveryFailed("Invalid response")
        }

        switch httpResponse.statusCode {
        case 200...299:
            let result = try JSONDecoder().decode(RCSSendResponse.self, from: data)
            logger.info("RCS sent successfully, messageId: \(result.messageId)")
        case 429:
            throw RCSGatewayError.rateLimited
        case 404:
            throw RCSGatewayError.recipientNotSupported
        default:
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw RCSGatewayError.deliveryFailed(errorText)
        }
    }

    public func checkRCSCapability(phone: String) async throws -> Bool {
        let url = URL(string: "\(apiBaseURL)/api/rcs/capability?phone=\(phone)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            // If capability check fails, assume not supported (safe fallback)
            return false
        }

        let result = try JSONDecoder().decode(RCSCapabilityResponse.self, from: data)
        return result.rcsEnabled
    }

    /// Validate E.164 phone number format
    private func isValidE164(_ phone: String) -> Bool {
        let pattern = "^\\+[1-9]\\d{1,14}$"
        return phone.range(of: pattern, options: .regularExpression) != nil
    }
}

// MARK: - RCS API Types

private struct RCSSendRequest: Codable {
    let to: String
    let body: String
    let imageURL: String?
    let cardTitle: String?
    let cardDescription: String?
    let actionURL: String?
}

private struct RCSSendResponse: Codable {
    let messageId: String
    let status: String
}

private struct RCSCapabilityResponse: Codable {
    let phone: String
    let rcsEnabled: Bool
}
