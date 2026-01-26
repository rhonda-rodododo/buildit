// FundraisingService.swift
// BuildIt - Decentralized Mesh Communication
//
// Service layer for fundraising operations with Nostr integration.

import Foundation
import os.log

/// Service for managing fundraising campaigns and donations
@MainActor
public final class FundraisingService {
    // MARK: - Nostr Event Kinds (from schema)
    static let KIND_CAMPAIGN = 40061
    static let KIND_DONATION = 40062
    static let KIND_EXPENSE = 40063

    // MARK: - Properties
    private let store: FundraisingStore
    private let logger = Logger(subsystem: "com.buildit", category: "FundraisingService")

    // Would be injected in production
    private var currentUserId: String {
        UserDefaults.standard.string(forKey: "currentPubkey") ?? ""
    }

    public init(store: FundraisingStore) {
        self.store = store
    }

    // MARK: - Campaign Operations

    /// Create a new fundraising campaign
    public func createCampaign(
        title: String,
        description: String?,
        goal: Double,
        currency: String = "USD",
        startsAt: Date? = nil,
        endsAt: Date? = nil,
        visibility: CampaignVisibility = .group,
        groupId: String? = nil,
        image: String? = nil,
        tiers: [DonationTier] = [],
        cryptoPayment: CryptoPaymentInfo? = nil
    ) async throws -> Campaign {
        guard goal > 0 else {
            throw FundraisingError.goalNotSet
        }

        let campaign = Campaign(
            title: title,
            description: description,
            goal: goal,
            currency: currency,
            startsAt: startsAt,
            endsAt: endsAt,
            status: .draft,
            visibility: visibility,
            groupId: groupId,
            image: image,
            tiers: tiers,
            cryptoPayment: cryptoPayment,
            createdBy: currentUserId
        )

        // Save locally
        try store.saveCampaign(campaign)

        // Publish to Nostr
        await publishCampaign(campaign)

        logger.info("Created campaign: \(campaign.id)")
        return campaign
    }

    /// Update an existing campaign
    public func updateCampaign(_ campaignId: String, updates: CampaignUpdates) async throws -> Campaign {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        // Verify ownership
        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        // Apply updates
        if let title = updates.title { campaign.title = title }
        if let description = updates.description { campaign.description = description }
        if let goal = updates.goal { campaign.goal = goal }
        if let startsAt = updates.startsAt { campaign.startsAt = startsAt }
        if let endsAt = updates.endsAt { campaign.endsAt = endsAt }
        if let status = updates.status { campaign.status = status }
        if let visibility = updates.visibility { campaign.visibility = visibility }
        if let image = updates.image { campaign.image = image }
        if let tiers = updates.tiers { campaign.tiers = tiers }
        if let cryptoPayment = updates.cryptoPayment { campaign.cryptoPayment = cryptoPayment }

        campaign.updatedAt = Date()

        // Update in store
        try store.updateCampaign(campaign)

        // Publish update to Nostr
        await publishCampaign(campaign)

        logger.info("Updated campaign: \(campaignId)")
        return campaign
    }

    /// Launch a campaign (change status to active)
    public func launchCampaign(_ campaignId: String) async throws -> Campaign {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        campaign.status = .active
        campaign.updatedAt = Date()

        if campaign.startsAt == nil {
            campaign.startsAt = Date()
        }

        try store.updateCampaign(campaign)
        await publishCampaign(campaign)

        logger.info("Launched campaign: \(campaignId)")
        return campaign
    }

    /// Complete a campaign
    public func completeCampaign(_ campaignId: String) async throws -> Campaign {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        campaign.status = .completed
        campaign.updatedAt = Date()

        try store.updateCampaign(campaign)
        await publishCampaign(campaign)

        logger.info("Completed campaign: \(campaignId)")
        return campaign
    }

    /// Cancel a campaign
    public func cancelCampaign(_ campaignId: String) async throws {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        campaign.status = .cancelled
        campaign.updatedAt = Date()

        try store.updateCampaign(campaign)
        await publishCampaignDelete(campaign.id)

        logger.info("Cancelled campaign: \(campaignId)")
    }

    /// Post an update to a campaign
    public func postUpdate(_ campaignId: String, content: String) async throws -> Campaign {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        let update = CampaignUpdate(content: content)
        campaign.updates.append(update)
        campaign.updatedAt = Date()

        try store.updateCampaign(campaign)
        await publishCampaign(campaign)

        logger.info("Posted update to campaign: \(campaignId)")
        return campaign
    }

    /// Get all campaigns
    public func getCampaigns(
        groupId: String? = nil,
        status: CampaignStatus? = nil,
        activeOnly: Bool = false
    ) async throws -> [Campaign] {
        try store.getCampaigns(groupId: groupId, status: status, activeOnly: activeOnly)
    }

    /// Get a specific campaign
    public func getCampaign(id: String) async throws -> Campaign? {
        try store.getCampaign(id: id)
    }

    // MARK: - Donation Operations

    /// Record a donation
    public func recordDonation(
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        donorName: String? = nil,
        anonymous: Bool = false,
        message: String? = nil,
        tierId: String? = nil,
        paymentMethod: PaymentMethod = .crypto,
        cryptoType: CryptoType? = nil,
        transactionId: String? = nil
    ) async throws -> Donation {
        guard var campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.isAcceptingDonations else {
            throw FundraisingError.campaignNotActive
        }

        let donation = Donation(
            campaignId: campaignId,
            amount: amount,
            currency: currency,
            donorPubkey: anonymous ? nil : currentUserId,
            donorName: donorName,
            anonymous: anonymous,
            message: message,
            tierId: tierId,
            paymentMethod: paymentMethod,
            cryptoType: cryptoType,
            transactionId: transactionId,
            status: .completed
        )

        // Save donation
        try store.saveDonation(donation)

        // Update campaign totals
        campaign.raised += amount
        campaign.donorCount += 1
        campaign.updatedAt = Date()
        try store.updateCampaign(campaign)

        // Publish to Nostr
        await publishDonation(donation)

        logger.info("Recorded donation: \(donation.id) for campaign: \(campaignId)")
        return donation
    }

    /// Get donations for a campaign
    public func getDonations(
        campaignId: String? = nil,
        limit: Int? = nil
    ) async throws -> [Donation] {
        try store.getDonations(campaignId: campaignId, limit: limit)
    }

    /// Get a specific donation
    public func getDonation(id: String) async throws -> Donation? {
        try store.getDonation(id: id)
    }

    // MARK: - Expense Operations

    /// Record an expense
    public func recordExpense(
        campaignId: String,
        amount: Double,
        description: String,
        category: String? = nil,
        vendor: String? = nil,
        date: Date = Date(),
        receipt: String? = nil
    ) async throws -> Expense {
        guard let campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        guard campaign.createdBy == currentUserId else {
            throw FundraisingError.unauthorized
        }

        let expense = Expense(
            campaignId: campaignId,
            amount: amount,
            currency: campaign.currency,
            description: description,
            category: category,
            receipt: receipt,
            vendor: vendor,
            date: date,
            recordedBy: currentUserId
        )

        try store.saveExpense(expense)
        await publishExpense(expense)

        logger.info("Recorded expense: \(expense.id) for campaign: \(campaignId)")
        return expense
    }

    /// Get expenses for a campaign
    public func getExpenses(campaignId: String) async throws -> [Expense] {
        try store.getExpenses(campaignId: campaignId)
    }

    // MARK: - Crypto Payment Support

    /// Generate a Bitcoin address for the campaign (placeholder - would integrate with wallet)
    public func generateBitcoinAddress(for campaignId: String) async throws -> String {
        // In production, this would integrate with a Bitcoin wallet/library
        // For now, return a placeholder
        let placeholder = "bc1q" + UUID().uuidString.lowercased().prefix(38)
        logger.debug("Generated Bitcoin address for campaign: \(campaignId)")
        return String(placeholder)
    }

    /// Generate an Ethereum address for the campaign (placeholder - would integrate with wallet)
    public func generateEthereumAddress(for campaignId: String) async throws -> String {
        // In production, this would integrate with an Ethereum wallet/library
        let placeholder = "0x" + UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(40)
        logger.debug("Generated Ethereum address for campaign: \(campaignId)")
        return String(placeholder)
    }

    /// Generate a Lightning invoice for a specific amount
    public func generateLightningInvoice(
        for campaignId: String,
        amountSats: Int,
        memo: String?
    ) async throws -> String {
        // In production, this would integrate with an LND/CLN node or Lightning service
        // For now, return a placeholder invoice
        let placeholder = "lnbc" + String(amountSats) + "n1" + UUID().uuidString.lowercased().prefix(50)
        logger.debug("Generated Lightning invoice for campaign: \(campaignId), amount: \(amountSats) sats")
        return String(placeholder)
    }

    // MARK: - Analytics

    /// Calculate analytics for a campaign
    public func calculateAnalytics(for campaignId: String) async throws -> CampaignAnalytics {
        guard let campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        let donations = try store.getDonations(campaignId: campaignId)

        let completedDonations = donations.filter { $0.status == .completed }
        let totalRaised = completedDonations.reduce(0) { $0 + $1.amount }
        let uniqueDonors = Set(completedDonations.compactMap { $0.donorPubkey }).count
        let averageDonation = completedDonations.isEmpty ? 0 : totalRaised / Double(completedDonations.count)
        let largestDonation = completedDonations.map { $0.amount }.max() ?? 0

        // Group donations by day
        let calendar = Calendar.current
        var donationsPerDay: [Date: Double] = [:]
        for donation in completedDonations {
            let day = calendar.startOfDay(for: donation.donatedAt)
            donationsPerDay[day, default: 0] += donation.amount
        }

        // Top donors (non-anonymous)
        var donorTotals: [String: Double] = [:]
        for donation in completedDonations where !donation.anonymous {
            let name = donation.donorName ?? donation.donorPubkey ?? "Unknown"
            donorTotals[name, default: 0] += donation.amount
        }
        let topDonors = donorTotals.sorted { $0.value > $1.value }
            .prefix(10)
            .map { (name: $0.key, amount: $0.value) }

        // Payment method breakdown
        var methodBreakdown: [PaymentMethod: Double] = [:]
        for donation in completedDonations {
            methodBreakdown[donation.paymentMethod, default: 0] += donation.amount
        }

        return CampaignAnalytics(
            campaignId: campaignId,
            totalRaised: totalRaised,
            totalDonors: uniqueDonors,
            averageDonation: averageDonation,
            largestDonation: largestDonation,
            donationsPerDay: donationsPerDay,
            topDonors: topDonors,
            paymentMethodBreakdown: methodBreakdown
        )
    }

    /// Calculate campaign progress summary
    public func getProgressSummary(for campaignId: String) async throws -> (
        raised: Double,
        goal: Double,
        percentage: Double,
        donorCount: Int,
        daysRemaining: Int?
    ) {
        guard let campaign = try store.getCampaign(id: campaignId) else {
            throw FundraisingError.notFound
        }

        return (
            raised: campaign.raised,
            goal: campaign.goal,
            percentage: campaign.progressPercentage,
            donorCount: campaign.donorCount,
            daysRemaining: campaign.daysRemaining
        )
    }

    // MARK: - Nostr Event Handling

    /// Process incoming Nostr events
    public func processNostrEvent(_ event: NostrEvent) async {
        switch event.kind {
        case Self.KIND_CAMPAIGN:
            await handleIncomingCampaign(event)
        case Self.KIND_DONATION:
            await handleIncomingDonation(event)
        case Self.KIND_EXPENSE:
            await handleIncomingExpense(event)
        default:
            break
        }
    }

    private func handleIncomingCampaign(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let campaign = try? decoder.decode(Campaign.self, from: data) else {
                logger.warning("Failed to decode incoming campaign")
                return
            }

            // Don't save our own campaigns again
            if campaign.createdBy == currentUserId {
                return
            }

            try store.saveCampaign(campaign)
            logger.debug("Saved incoming campaign: \(campaign.id)")
        } catch {
            logger.error("Failed to handle incoming campaign: \(error.localizedDescription)")
        }
    }

    private func handleIncomingDonation(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let donation = try? decoder.decode(Donation.self, from: data) else {
                logger.warning("Failed to decode incoming donation")
                return
            }

            // Don't save our own donations again
            if donation.donorPubkey == currentUserId {
                return
            }

            try store.saveDonation(donation)

            // Update campaign totals
            if var campaign = try store.getCampaign(id: donation.campaignId) {
                campaign.raised += donation.amount
                campaign.donorCount += 1
                try store.updateCampaign(campaign)
            }

            logger.debug("Saved incoming donation: \(donation.id)")
        } catch {
            logger.error("Failed to handle incoming donation: \(error.localizedDescription)")
        }
    }

    private func handleIncomingExpense(_ event: NostrEvent) async {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            guard let data = event.content.data(using: .utf8),
                  let expense = try? decoder.decode(Expense.self, from: data) else {
                logger.warning("Failed to decode incoming expense")
                return
            }

            if expense.recordedBy == currentUserId {
                return
            }

            try store.saveExpense(expense)
            logger.debug("Saved incoming expense: \(expense.id)")
        } catch {
            logger.error("Failed to handle incoming expense: \(error.localizedDescription)")
        }
    }

    // MARK: - Publishing

    private func publishCampaign(_ campaign: Campaign) async {
        // In production, this would use NostrClient to publish
        logger.debug("Would publish campaign to Nostr: \(campaign.id)")
    }

    private func publishCampaignDelete(_ campaignId: String) async {
        logger.debug("Would publish campaign delete to Nostr: \(campaignId)")
    }

    private func publishDonation(_ donation: Donation) async {
        logger.debug("Would publish donation to Nostr: \(donation.id)")
    }

    private func publishExpense(_ expense: Expense) async {
        logger.debug("Would publish expense to Nostr: \(expense.id)")
    }
}

// MARK: - Campaign Updates

/// Updates that can be applied to a campaign
public struct CampaignUpdates {
    public var title: String?
    public var description: String?
    public var goal: Double?
    public var startsAt: Date?
    public var endsAt: Date?
    public var status: CampaignStatus?
    public var visibility: CampaignVisibility?
    public var image: String?
    public var tiers: [DonationTier]?
    public var cryptoPayment: CryptoPaymentInfo?

    public init(
        title: String? = nil,
        description: String? = nil,
        goal: Double? = nil,
        startsAt: Date? = nil,
        endsAt: Date? = nil,
        status: CampaignStatus? = nil,
        visibility: CampaignVisibility? = nil,
        image: String? = nil,
        tiers: [DonationTier]? = nil,
        cryptoPayment: CryptoPaymentInfo? = nil
    ) {
        self.title = title
        self.description = description
        self.goal = goal
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
        self.visibility = visibility
        self.image = image
        self.tiers = tiers
        self.cryptoPayment = cryptoPayment
    }
}
