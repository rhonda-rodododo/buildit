// NewslettersService.swift
// BuildIt - Decentralized Mesh Communication
//
// Service layer for newsletter operations with NIP-17 DM delivery,
// rate limiting, and batch sending capabilities.

import Foundation
import os.log

/// Rate limiter for relay protection
actor RateLimiter {
    private var tokens: Double
    private let maxTokens: Double
    private let refillRate: Double // tokens per second
    private var lastRefill: Date

    init(maxTokens: Double = 10, refillRate: Double = 2) {
        self.tokens = maxTokens
        self.maxTokens = maxTokens
        self.refillRate = refillRate
        self.lastRefill = Date()
    }

    func acquire() async -> Bool {
        refill()
        if tokens >= 1 {
            tokens -= 1
            return true
        }
        return false
    }

    func waitForToken() async {
        while !(await acquire()) {
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }
    }

    private func refill() {
        let now = Date()
        let elapsed = now.timeIntervalSince(lastRefill)
        let newTokens = elapsed * refillRate
        tokens = min(maxTokens, tokens + newTokens)
        lastRefill = now
    }
}

/// Service for managing newsletters, issues, subscribers, and delivery
@MainActor
public final class NewslettersService: ObservableObject {
    // MARK: - Properties

    private let store: NewslettersStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "NewslettersService")

    // Rate limiting for relay protection
    private let rateLimiter = RateLimiter(maxTokens: 10, refillRate: 2)

    // Batch sending state
    @Published public private(set) var isSending = false
    @Published public private(set) var sendProgress: BatchSendProgress?

    // Current user
    private var currentUserId: String {
        UserDefaults.standard.string(forKey: "currentPubkey") ?? ""
    }

    public init(store: NewslettersStore) {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
    }

    // MARK: - Newsletter Operations

    /// Create a new newsletter
    public func createNewsletter(
        name: String,
        description: String? = nil,
        groupId: String? = nil,
        fromName: String? = nil,
        visibility: NewsletterVisibility = .group,
        doubleOptIn: Bool = true
    ) async throws -> Newsletter {
        let newsletter = Newsletter(
            name: name,
            description: description,
            groupId: groupId,
            fromName: fromName,
            visibility: visibility,
            doubleOptIn: doubleOptIn,
            ownerPubkey: currentUserId
        )

        try store.saveNewsletter(newsletter)

        // Publish to Nostr
        await publishNewsletter(newsletter)

        logger.info("Created newsletter: \(newsletter.id)")
        return newsletter
    }

    /// Update a newsletter
    public func updateNewsletter(_ newsletter: Newsletter) async throws -> Newsletter {
        guard let existing = try store.getNewsletter(id: newsletter.id) else {
            throw NewslettersError.notFound
        }

        guard existing.ownerPubkey == currentUserId || existing.editors.contains(currentUserId) else {
            throw NewslettersError.unauthorized
        }

        var updated = newsletter
        updated.updatedAt = Date()

        try store.saveNewsletter(updated)
        await publishNewsletter(updated)

        logger.info("Updated newsletter: \(newsletter.id)")
        return updated
    }

    /// Get all newsletters
    public func getNewsletters(groupId: String? = nil) async throws -> [Newsletter] {
        try store.getNewsletters(groupId: groupId)
    }

    /// Get a specific newsletter
    public func getNewsletter(id: String) async throws -> Newsletter? {
        try store.getNewsletter(id: id)
    }

    /// Delete a newsletter
    public func deleteNewsletter(_ newsletterId: String) async throws {
        guard let newsletter = try store.getNewsletter(id: newsletterId) else {
            throw NewslettersError.notFound
        }

        guard newsletter.ownerPubkey == currentUserId else {
            throw NewslettersError.unauthorized
        }

        try store.deleteNewsletter(newsletterId)
        logger.info("Deleted newsletter: \(newsletterId)")
    }

    // MARK: - Issue Operations

    /// Create a new issue/campaign
    public func createIssue(
        newsletterId: String,
        subject: String,
        content: String = "",
        contentType: ContentType = .markdown,
        preheader: String? = nil
    ) async throws -> NewsletterIssue {
        guard try store.getNewsletter(id: newsletterId) != nil else {
            throw NewslettersError.notFound
        }

        let issue = NewsletterIssue(
            newsletterId: newsletterId,
            subject: subject,
            preheader: preheader,
            content: content,
            contentType: contentType,
            createdBy: currentUserId
        )

        try store.saveIssue(issue)

        logger.info("Created issue: \(issue.id)")
        return issue
    }

    /// Update an issue
    public func updateIssue(_ issue: NewsletterIssue) async throws -> NewsletterIssue {
        guard let existing = try store.getIssue(id: issue.id) else {
            throw NewslettersError.notFound
        }

        guard existing.canEdit else {
            throw NewslettersError.unauthorized
        }

        var updated = issue
        updated.updatedAt = Date()

        try store.saveIssue(updated)

        logger.info("Updated issue: \(issue.id)")
        return updated
    }

    /// Get issues for a newsletter
    public func getIssues(newsletterId: String, status: CampaignStatus? = nil) async throws -> [NewsletterIssue] {
        try store.getIssues(newsletterId: newsletterId, status: status)
    }

    /// Get a specific issue
    public func getIssue(id: String) async throws -> NewsletterIssue? {
        try store.getIssue(id: id)
    }

    /// Delete an issue
    public func deleteIssue(_ issueId: String) async throws {
        guard let issue = try store.getIssue(id: issueId) else {
            throw NewslettersError.notFound
        }

        guard issue.isDraft else {
            throw NewslettersError.unauthorized
        }

        try store.deleteIssue(issueId)
        logger.info("Deleted issue: \(issueId)")
    }

    // MARK: - Subscriber Operations

    /// Add a subscriber
    public func addSubscriber(
        newsletterId: String,
        pubkey: String? = nil,
        email: String? = nil,
        name: String? = nil,
        source: String? = nil
    ) async throws -> NewsletterSubscriber {
        guard let newsletter = try store.getNewsletter(id: newsletterId) else {
            throw NewslettersError.notFound
        }

        // Check for duplicates
        if let pubkey = pubkey {
            if try store.getSubscriberByPubkey(newsletterId: newsletterId, pubkey: pubkey) != nil {
                throw NewslettersError.duplicateSubscriber
            }
        }
        if let email = email {
            if try store.getSubscriberByEmail(newsletterId: newsletterId, email: email) != nil {
                throw NewslettersError.duplicateSubscriber
            }
        }

        let status: SubscriberStatus = newsletter.doubleOptIn ? .pending : .active
        let subscriber = NewsletterSubscriber(
            newsletterId: newsletterId,
            pubkey: pubkey,
            email: email,
            name: name,
            status: status,
            source: source,
            confirmedAt: newsletter.doubleOptIn ? nil : Date()
        )

        try store.saveSubscriber(subscriber)

        // Update subscriber count
        await updateSubscriberCount(newsletterId: newsletterId)

        logger.info("Added subscriber: \(subscriber.id)")
        return subscriber
    }

    /// Remove a subscriber
    public func removeSubscriber(_ subscriberId: String) async throws {
        guard let subscriber = try store.getSubscriber(id: subscriberId) else {
            throw NewslettersError.notFound
        }

        try store.deleteSubscriber(subscriberId)
        await updateSubscriberCount(newsletterId: subscriber.newsletterId)

        logger.info("Removed subscriber: \(subscriberId)")
    }

    /// Unsubscribe (mark as unsubscribed rather than delete)
    public func unsubscribe(_ subscriberId: String) async throws {
        guard var subscriber = try store.getSubscriber(id: subscriberId) else {
            throw NewslettersError.notFound
        }

        subscriber.status = .unsubscribed
        subscriber.unsubscribedAt = Date()

        try store.saveSubscriber(subscriber)
        await updateSubscriberCount(newsletterId: subscriber.newsletterId)

        logger.info("Unsubscribed: \(subscriberId)")
    }

    /// Confirm a pending subscriber
    public func confirmSubscriber(_ subscriberId: String) async throws {
        guard var subscriber = try store.getSubscriber(id: subscriberId) else {
            throw NewslettersError.notFound
        }

        guard subscriber.status == .pending else {
            return // Already confirmed or in other state
        }

        subscriber.status = .active
        subscriber.confirmedAt = Date()

        try store.saveSubscriber(subscriber)
        await updateSubscriberCount(newsletterId: subscriber.newsletterId)

        logger.info("Confirmed subscriber: \(subscriberId)")
    }

    /// Get subscribers for a newsletter
    public func getSubscribers(newsletterId: String, status: SubscriberStatus? = nil, activeOnly: Bool = false) async throws -> [NewsletterSubscriber] {
        try store.getSubscribers(newsletterId: newsletterId, status: status, activeOnly: activeOnly)
    }

    /// Get subscriber count
    public func getSubscriberCount(newsletterId: String, activeOnly: Bool = true) async throws -> Int {
        try store.getSubscriberCount(newsletterId: newsletterId, activeOnly: activeOnly)
    }

    private func updateSubscriberCount(newsletterId: String) async {
        do {
            guard var newsletter = try store.getNewsletter(id: newsletterId) else { return }
            newsletter.subscriberCount = try store.getSubscriberCount(newsletterId: newsletterId, activeOnly: true)
            try store.saveNewsletter(newsletter)
        } catch {
            logger.error("Failed to update subscriber count: \(error.localizedDescription)")
        }
    }

    // MARK: - CSV Import/Export

    /// Import subscribers from CSV data
    public func importSubscribersFromCSV(
        newsletterId: String,
        csvData: String,
        source: String = "csv-import"
    ) async throws -> CSVImportResult {
        guard try store.getNewsletter(id: newsletterId) != nil else {
            throw NewslettersError.notFound
        }

        var result = CSVImportResult()
        let lines = csvData.components(separatedBy: .newlines)

        guard !lines.isEmpty else {
            return result
        }

        // Parse header row
        let headers = lines[0].components(separatedBy: ",").map {
            $0.trimmingCharacters(in: .whitespaces).lowercased()
        }

        let emailIndex = headers.firstIndex(of: "email")
        let nameIndex = headers.firstIndex(of: "name")
        let pubkeyIndex = headers.firstIndex(of: "pubkey") ?? headers.firstIndex(of: "npub")

        // Parse data rows
        for (index, line) in lines.dropFirst().enumerated() {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty else {
                continue
            }

            let values = parseCSVLine(line)

            var row = CSVSubscriberRow()

            if let emailIndex = emailIndex, emailIndex < values.count {
                row.email = values[emailIndex].trimmingCharacters(in: .whitespaces)
            }
            if let nameIndex = nameIndex, nameIndex < values.count {
                row.name = values[nameIndex].trimmingCharacters(in: .whitespaces)
            }
            if let pubkeyIndex = pubkeyIndex, pubkeyIndex < values.count {
                row.pubkey = values[pubkeyIndex].trimmingCharacters(in: .whitespaces)
            }

            // Parse custom fields
            for (colIndex, header) in headers.enumerated() {
                if colIndex != emailIndex && colIndex != nameIndex && colIndex != pubkeyIndex {
                    if colIndex < values.count {
                        row.customFields[header] = values[colIndex].trimmingCharacters(in: .whitespaces)
                    }
                }
            }

            guard row.isValid else {
                result.skipped += 1
                result.errors.append("Row \(index + 2): Missing email or pubkey")
                continue
            }

            do {
                _ = try await addSubscriber(
                    newsletterId: newsletterId,
                    pubkey: row.pubkey,
                    email: row.email,
                    name: row.name,
                    source: source
                )
                result.imported += 1
            } catch NewslettersError.duplicateSubscriber {
                result.duplicates += 1
            } catch {
                result.skipped += 1
                result.errors.append("Row \(index + 2): \(error.localizedDescription)")
            }
        }

        logger.info("CSV import complete: \(result.imported) imported, \(result.duplicates) duplicates, \(result.skipped) skipped")
        return result
    }

    /// Export subscribers to CSV format
    public func exportSubscribersToCSV(newsletterId: String, activeOnly: Bool = true) async throws -> String {
        let subscribers = try await getSubscribers(newsletterId: newsletterId, activeOnly: activeOnly)

        var csv = "email,name,pubkey,status,subscribed_at\n"

        for subscriber in subscribers {
            let email = escapeCSV(subscriber.email ?? "")
            let name = escapeCSV(subscriber.name ?? "")
            let pubkey = subscriber.pubkey ?? ""
            let status = subscriber.status.rawValue
            let subscribedAt = ISO8601DateFormatter().string(from: subscriber.subscribedAt)

            csv += "\(email),\(name),\(pubkey),\(status),\(subscribedAt)\n"
        }

        return csv
    }

    private func parseCSVLine(_ line: String) -> [String] {
        var values: [String] = []
        var current = ""
        var inQuotes = false

        for char in line {
            if char == "\"" {
                inQuotes.toggle()
            } else if char == "," && !inQuotes {
                values.append(current)
                current = ""
            } else {
                current.append(char)
            }
        }
        values.append(current)

        return values
    }

    private func escapeCSV(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    // MARK: - NIP-17 DM Delivery

    /// Send an issue to all active subscribers using NIP-17 DMs
    public func sendIssue(_ issueId: String) async throws {
        guard !isSending else {
            throw NewslettersError.sendingInProgress
        }

        guard var issue = try store.getIssue(id: issueId) else {
            throw NewslettersError.notFound
        }

        guard issue.canSend else {
            throw NewslettersError.invalidData
        }

        // Get active subscribers with pubkeys (for NIP-17)
        let subscribers = try await getSubscribers(newsletterId: issue.newsletterId, activeOnly: true)
            .filter { $0.pubkey != nil }

        guard !subscribers.isEmpty else {
            logger.warning("No subscribers with pubkeys to send to")
            return
        }

        // Update issue status
        issue.status = .sending
        issue.sentAt = Date()
        try store.saveIssue(issue)

        // Initialize progress
        isSending = true
        sendProgress = BatchSendProgress(total: subscribers.count)

        // Create delivery records
        for subscriber in subscribers {
            let record = DeliveryRecord(
                issueId: issueId,
                subscriberId: subscriber.id,
                subscriberPubkey: subscriber.pubkey,
                subscriberEmail: subscriber.email
            )
            try store.saveDeliveryRecord(record)
        }

        // Start batch sending in background
        Task {
            await performBatchSend(issue: issue, subscribers: subscribers)
        }

        logger.info("Started sending issue \(issueId) to \(subscribers.count) subscribers")
    }

    /// Perform batch NIP-17 DM sending with rate limiting
    private func performBatchSend(issue: NewsletterIssue, subscribers: [NewsletterSubscriber]) async {
        var sentCount = 0
        var failedCount = 0
        let startTime = Date()

        // Format the message content
        let messageContent = formatIssueForDM(issue)

        for subscriber in subscribers {
            guard let pubkey = subscriber.pubkey else { continue }

            // Wait for rate limit token
            await rateLimiter.waitForToken()

            do {
                // Send via NIP-17 DM
                let event = try await sendNIP17DM(content: messageContent, to: pubkey)

                // Update delivery record
                var record = DeliveryRecord(
                    issueId: issue.id,
                    subscriberId: subscriber.id,
                    subscriberPubkey: pubkey,
                    status: .delivered,
                    nostrEventId: event.id,
                    sentAt: Date(),
                    deliveredAt: Date()
                )
                try store.saveDeliveryRecord(record)

                sentCount += 1
            } catch {
                // Record failure
                var record = DeliveryRecord(
                    issueId: issue.id,
                    subscriberId: subscriber.id,
                    subscriberPubkey: pubkey,
                    status: .failed,
                    errorMessage: error.localizedDescription,
                    sentAt: Date()
                )
                try? store.saveDeliveryRecord(record)

                failedCount += 1
                logger.error("Failed to send to \(pubkey.prefix(16)): \(error.localizedDescription)")
            }

            // Update progress
            let elapsed = Date().timeIntervalSince(startTime)
            let rate = elapsed > 0 ? Double(sentCount + failedCount) / elapsed : 0

            sendProgress?.updateProgress(sent: sentCount, failed: failedCount, rate: rate)
        }

        // Update issue status and stats
        do {
            var updatedIssue = issue
            updatedIssue.status = failedCount == subscribers.count ? .failed : .sent
            updatedIssue.stats = try store.getDeliveryStats(issueId: issue.id)
            try store.saveIssue(updatedIssue)
        } catch {
            logger.error("Failed to update issue stats: \(error.localizedDescription)")
        }

        isSending = false
        logger.info("Batch send complete: \(sentCount) sent, \(failedCount) failed")
    }

    /// Send a NIP-17 gift-wrapped DM
    private func sendNIP17DM(content: String, to recipientPubkey: String) async throws -> NostrEvent {
        // Use the NostrClient's existing DM functionality which uses NIP-17/NIP-04
        return try await nostrClient.sendDirectMessage(content, to: recipientPubkey)
    }

    /// Format issue content for DM delivery
    private func formatIssueForDM(_ issue: NewsletterIssue) -> String {
        var message = ""

        // Add subject as header
        message += "# \(issue.subject)\n\n"

        // Add preheader if present
        if let preheader = issue.preheader, !preheader.isEmpty {
            message += "*\(preheader)*\n\n"
        }

        // Add content
        message += issue.content

        return message
    }

    // MARK: - Delivery Tracking

    /// Get delivery records for an issue
    public func getDeliveryRecords(issueId: String, status: DeliveryStatus? = nil) async throws -> [DeliveryRecord] {
        try store.getDeliveryRecords(issueId: issueId, status: status)
    }

    /// Get delivery stats for an issue
    public func getDeliveryStats(issueId: String) async throws -> CampaignStats {
        try store.getDeliveryStats(issueId: issueId)
    }

    /// Retry failed deliveries
    public func retryFailedDeliveries(issueId: String) async throws {
        guard !isSending else {
            throw NewslettersError.sendingInProgress
        }

        guard let issue = try store.getIssue(id: issueId) else {
            throw NewslettersError.notFound
        }

        let failedRecords = try await getDeliveryRecords(issueId: issueId, status: .failed)

        guard !failedRecords.isEmpty else {
            return
        }

        isSending = true
        sendProgress = BatchSendProgress(total: failedRecords.count)

        let messageContent = formatIssueForDM(issue)
        var sentCount = 0
        var failedCount = 0

        for record in failedRecords {
            guard let pubkey = record.subscriberPubkey else { continue }

            await rateLimiter.waitForToken()

            do {
                let event = try await sendNIP17DM(content: messageContent, to: pubkey)

                var updatedRecord = record
                updatedRecord.status = .delivered
                updatedRecord.nostrEventId = event.id
                updatedRecord.deliveredAt = Date()
                updatedRecord.retryCount += 1
                try store.saveDeliveryRecord(updatedRecord)

                sentCount += 1
            } catch {
                var updatedRecord = record
                updatedRecord.errorMessage = error.localizedDescription
                updatedRecord.retryCount += 1
                try? store.saveDeliveryRecord(updatedRecord)

                failedCount += 1
            }

            sendProgress?.updateProgress(sent: sentCount, failed: failedCount, rate: 0)
        }

        // Update issue stats
        do {
            var updatedIssue = issue
            updatedIssue.stats = try store.getDeliveryStats(issueId: issueId)
            try store.saveIssue(updatedIssue)
        } catch {
            logger.error("Failed to update issue stats: \(error.localizedDescription)")
        }

        isSending = false
        logger.info("Retry complete: \(sentCount) sent, \(failedCount) failed")
    }

    // MARK: - Nostr Publishing

    private func publishNewsletter(_ newsletter: Newsletter) async {
        // In production, this would publish the newsletter config to Nostr
        logger.debug("Would publish newsletter to Nostr: \(newsletter.id)")
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case NewsletterEventKind.newsletter.rawValue:
            await handleIncomingNewsletter(event)
        case NewsletterEventKind.campaign.rawValue:
            await handleIncomingCampaign(event)
        case NewsletterEventKind.subscriber.rawValue:
            await handleIncomingSubscriber(event)
        default:
            break
        }
    }

    private func handleIncomingNewsletter(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let newsletter = try? decoder.decode(Newsletter.self, from: data) else {
                logger.warning("Failed to decode incoming newsletter")
                return
            }

            // Don't save our own newsletters again
            if newsletter.ownerPubkey == currentUserId {
                return
            }

            try store.saveNewsletter(newsletter)
            logger.debug("Saved incoming newsletter: \(newsletter.id)")
        } catch {
            logger.error("Failed to handle incoming newsletter: \(error.localizedDescription)")
        }
    }

    private func handleIncomingCampaign(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let issue = try? decoder.decode(NewsletterIssue.self, from: data) else {
                logger.warning("Failed to decode incoming campaign")
                return
            }

            if issue.createdBy == currentUserId {
                return
            }

            try store.saveIssue(issue)
            logger.debug("Saved incoming campaign: \(issue.id)")
        } catch {
            logger.error("Failed to handle incoming campaign: \(error.localizedDescription)")
        }
    }

    private func handleIncomingSubscriber(_ event: NostrEvent) async {
        // Subscriber events are encrypted - handle appropriately
        logger.debug("Received subscriber event - handling encrypted content")
    }
}
