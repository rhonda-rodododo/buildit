// MessagingModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Messaging module for DMs and group messages with reactions and read receipts.

import Foundation
import SwiftUI
import os.log

/// Messaging module implementation
@MainActor
public final class MessagingModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "messaging"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: MessagingStore
    private let service: MessagingService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "MessagingModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try MessagingStore()
        self.service = MessagingService(store: store)
        logger.info("Messaging module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Messaging module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Messaging module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route messaging-related Nostr events to service
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        // The messaging module integrates with the existing ChatView
        // No separate views needed as it enhances existing functionality
        []
    }

    public func cleanup() async {
        logger.info("Cleaning up Messaging module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Messaging module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Messaging module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Send a direct message
    public func sendDirectMessage(
        content: String,
        to recipient: String,
        replyTo: String? = nil,
        mentions: [String]? = nil,
        attachments: [DirectMessageAttachment]? = nil
    ) async throws {
        try await service.sendDirectMessage(
            content: content,
            to: recipient,
            replyTo: replyTo,
            mentions: mentions,
            attachments: attachments
        )
    }

    /// Send a group message
    public func sendGroupMessage(
        content: String,
        to groupId: String,
        threadId: String? = nil,
        replyTo: String? = nil,
        mentions: [String]? = nil,
        attachments: [GroupMessageAttachment]? = nil
    ) async throws {
        try await service.sendGroupMessage(
            content: content,
            to: groupId,
            threadId: threadId,
            replyTo: replyTo,
            mentions: mentions,
            attachments: attachments
        )
    }

    /// Add a reaction to a message
    public func addReaction(emoji: String, to messageId: String) async throws {
        try await service.addReaction(emoji: emoji, to: messageId)
    }

    /// Get reactions for a message
    public func getReactions(messageId: String) async throws -> [Reaction] {
        try await service.getReactions(messageId: messageId)
    }

    /// Get reaction counts
    public func getReactionCounts(messageId: String) async throws -> [String: Int] {
        try await service.getReactionCounts(messageId: messageId)
    }

    /// Mark messages as read
    public func markAsRead(conversationId: String, lastMessageId: String) async throws {
        try await service.markAsRead(conversationId: conversationId, lastMessageId: lastMessageId)
    }

    /// Get read receipts
    public func getReadReceipts(conversationId: String) async throws -> [ReadReceipt] {
        try await service.getReadReceipts(conversationId: conversationId)
    }

    /// Send typing indicator
    public func sendTypingIndicator(conversationId: String, isTyping: Bool) async throws {
        try await service.sendTypingIndicator(conversationId: conversationId, isTyping: isTyping)
    }
}
