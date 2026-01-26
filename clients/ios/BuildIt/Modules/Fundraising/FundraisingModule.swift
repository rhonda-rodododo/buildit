// FundraisingModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Fundraising module for campaigns, donations, and financial tracking.

import Foundation
import SwiftUI
import os.log

/// Fundraising module implementation
@MainActor
public final class FundraisingModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "fundraising"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: FundraisingStore
    private let service: FundraisingService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "FundraisingModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try FundraisingStore()
        self.service = FundraisingService(store: store)
        logger.info("Fundraising module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Fundraising module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Fundraising module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route fundraising-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "fundraising",
                title: "Fundraising",
                icon: "dollarsign.circle",
                order: 30
            ) {
                CampaignsListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Fundraising module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Fundraising module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Fundraising module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Create a new campaign
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
        try await service.createCampaign(
            title: title,
            description: description,
            goal: goal,
            currency: currency,
            startsAt: startsAt,
            endsAt: endsAt,
            visibility: visibility,
            groupId: groupId,
            image: image,
            tiers: tiers,
            cryptoPayment: cryptoPayment
        )
    }

    /// Record a donation
    public func recordDonation(
        campaignId: String,
        amount: Double,
        currency: String = "USD",
        donorName: String? = nil,
        anonymous: Bool = false,
        message: String? = nil,
        paymentMethod: PaymentMethod = .crypto,
        cryptoType: CryptoType? = nil
    ) async throws -> Donation {
        try await service.recordDonation(
            campaignId: campaignId,
            amount: amount,
            currency: currency,
            donorName: donorName,
            anonymous: anonymous,
            message: message,
            paymentMethod: paymentMethod,
            cryptoType: cryptoType
        )
    }

    /// Get all campaigns
    public func getCampaigns(
        groupId: String? = nil,
        activeOnly: Bool = false
    ) async throws -> [Campaign] {
        try await service.getCampaigns(groupId: groupId, activeOnly: activeOnly)
    }

    /// Get donations for a campaign
    public func getDonations(campaignId: String) async throws -> [Donation] {
        try await service.getDonations(campaignId: campaignId)
    }

    /// Get campaign analytics
    public func getAnalytics(for campaignId: String) async throws -> CampaignAnalytics {
        try await service.calculateAnalytics(for: campaignId)
    }
}
