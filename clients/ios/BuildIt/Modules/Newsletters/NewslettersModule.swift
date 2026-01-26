// NewslettersModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Newsletter module for email campaigns, subscriber management,
// and NIP-17 DM delivery to subscribers.

import Foundation
import SwiftUI
import os.log

/// Newsletters module implementation
@MainActor
public final class NewslettersModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "newsletters"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: NewslettersStore
    private let service: NewslettersService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "NewslettersModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try NewslettersStore()
        self.service = NewslettersService(store: store)
        logger.info("Newsletters module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Newsletters module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Newsletters module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route newsletter-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "newsletters",
                title: "Newsletters",
                icon: "envelope.badge",
                order: 30
            ) {
                NewslettersListView(service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Newsletters module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Newsletters module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Newsletters module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Create a new newsletter
    public func createNewsletter(
        name: String,
        description: String? = nil,
        groupId: String? = nil,
        fromName: String? = nil,
        visibility: NewsletterVisibility = .group,
        doubleOptIn: Bool = true
    ) async throws -> Newsletter {
        try await service.createNewsletter(
            name: name,
            description: description,
            groupId: groupId,
            fromName: fromName,
            visibility: visibility,
            doubleOptIn: doubleOptIn
        )
    }

    /// Create a new issue/campaign
    public func createIssue(
        newsletterId: String,
        subject: String,
        content: String = "",
        contentType: ContentType = .markdown,
        preheader: String? = nil
    ) async throws -> NewsletterIssue {
        try await service.createIssue(
            newsletterId: newsletterId,
            subject: subject,
            content: content,
            contentType: contentType,
            preheader: preheader
        )
    }

    /// Add a subscriber to a newsletter
    public func addSubscriber(
        newsletterId: String,
        pubkey: String? = nil,
        email: String? = nil,
        name: String? = nil,
        source: String? = nil
    ) async throws -> NewsletterSubscriber {
        try await service.addSubscriber(
            newsletterId: newsletterId,
            pubkey: pubkey,
            email: email,
            name: name,
            source: source
        )
    }

    /// Import subscribers from CSV
    public func importSubscribersFromCSV(
        newsletterId: String,
        csvData: String,
        source: String = "csv-import"
    ) async throws -> CSVImportResult {
        try await service.importSubscribersFromCSV(
            newsletterId: newsletterId,
            csvData: csvData,
            source: source
        )
    }

    /// Export subscribers to CSV
    public func exportSubscribersToCSV(
        newsletterId: String,
        activeOnly: Bool = true
    ) async throws -> String {
        try await service.exportSubscribersToCSV(
            newsletterId: newsletterId,
            activeOnly: activeOnly
        )
    }

    /// Send an issue to all subscribers
    public func sendIssue(_ issueId: String) async throws {
        try await service.sendIssue(issueId)
    }

    /// Get all newsletters
    public func getNewsletters(groupId: String? = nil) async throws -> [Newsletter] {
        try await service.getNewsletters(groupId: groupId)
    }

    /// Get issues for a newsletter
    public func getIssues(newsletterId: String, status: CampaignStatus? = nil) async throws -> [NewsletterIssue] {
        try await service.getIssues(newsletterId: newsletterId, status: status)
    }

    /// Get subscribers for a newsletter
    public func getSubscribers(
        newsletterId: String,
        status: SubscriberStatus? = nil,
        activeOnly: Bool = false
    ) async throws -> [NewsletterSubscriber] {
        try await service.getSubscribers(
            newsletterId: newsletterId,
            status: status,
            activeOnly: activeOnly
        )
    }

    /// Get delivery records for an issue
    public func getDeliveryRecords(issueId: String, status: DeliveryStatus? = nil) async throws -> [DeliveryRecord] {
        try await service.getDeliveryRecords(issueId: issueId, status: status)
    }
}
