// MessagingService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for the Messaging module.
// Handles message sending with NIP-17 encryption.

import Foundation
import os.log

/// Service for managing messaging
@MainActor
public class MessagingService {
    // MARK: - Properties

    private let store: MessagingStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let transportRouter: TransportRouter
    private let logger = Logger(subsystem: "com.buildit", category: "MessagingService")

    // MARK: - Initialization

    public init(store: MessagingStore) {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
        self.transportRouter = TransportRouter.shared
    }

    // MARK: - Direct Messages

    /// Send a direct message using NIP-17
    public func sendDirectMessage(
        content: String,
        to recipient: String,
        replyTo: String? = nil,
        mentions: [String]? = nil,
        attachments: [DirectMessageAttachment]? = nil
    ) async throws {
        guard let senderPubkey = await cryptoManager.getPublicKeyHex() else {
            throw MessagingError.invalidMessageData
        }

        let message = DirectMessage(
            v: MessagingSchema.version,
            attachments: attachments,
            content: content,
            mentions: mentions,
            replyTo: replyTo
        )

        // Encode message
        let encoder = JSONEncoder()
        let messageData = try encoder.encode(message)
        guard let messageContent = String(data: messageData, encoding: .utf8) else {
            throw MessagingError.invalidMessageData
        }

        // Send via NIP-17 (gift wrap)
        let nostrEvent = try await nostrClient.sendDirectMessage(messageContent, to: recipient)

        // Save to local store
        let entity = DirectMessageEntity.from(
            message,
            id: UUID().uuidString,
            senderPublicKey: senderPubkey,
            recipientPublicKey: recipient,
            timestamp: Date(),
            eventId: nostrEvent.id
        )
        entity.isDelivered = true
        entity.deliveredAt = Date()

        try store.saveDirectMessage(entity)

        logger.info("Sent direct message to \(recipient.prefix(8))")
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
        guard let senderPubkey = await cryptoManager.getPublicKeyHex() else {
            throw MessagingError.invalidMessageData
        }

        let message = GroupMessage(
            v: MessagingSchema.version,
            attachments: attachments,
            content: content,
            groupID: groupId,
            mentions: mentions,
            replyTo: replyTo,
            threadID: threadId
        )

        // Encode message
        let encoder = JSONEncoder()
        let messageData = try encoder.encode(message)
        guard let messageContent = String(data: messageData, encoding: .utf8) else {
            throw MessagingError.invalidMessageData
        }

        // Publish to Nostr
        let tags: [[String]] = [
            ["group", groupId]
        ]

        let nostrEvent = try await nostrClient.publishEvent(
            kind: .groupMessage,
            content: messageContent,
            tags: tags
        )

        // Save to local store
        let entity = GroupMessageEntity.from(
            message,
            id: UUID().uuidString,
            senderPublicKey: senderPubkey,
            timestamp: Date(),
            eventId: nostrEvent.id
        )

        try store.saveGroupMessage(entity)

        logger.info("Sent group message to \(groupId)")
    }

    // MARK: - Reactions

    /// Add a reaction to a message
    public func addReaction(emoji: String, to messageId: String) async throws {
        guard let userPubkey = await cryptoManager.getPublicKeyHex() else {
            throw MessagingError.invalidMessageData
        }

        let reaction = Reaction(
            v: MessagingSchema.version,
            emoji: emoji,
            targetID: messageId
        )

        // Encode reaction
        let encoder = JSONEncoder()
        let reactionData = try encoder.encode(reaction)
        guard let reactionContent = String(data: reactionData, encoding: .utf8) else {
            throw MessagingError.invalidMessageData
        }

        // Publish to Nostr
        let tags: [[String]] = [
            ["e", messageId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: .reaction,
            content: reactionContent,
            tags: tags
        )

        // Save to local store
        let entity = ReactionEntity.from(
            reaction,
            id: UUID().uuidString,
            userPublicKey: userPubkey,
            timestamp: Date()
        )

        try store.saveReaction(entity)

        logger.info("Added reaction to message: \(messageId)")
    }

    /// Get reactions for a message
    public func getReactions(messageId: String) async throws -> [Reaction] {
        try store.getReactions(for: messageId).map { $0.toReaction() }
    }

    /// Get reaction counts for a message
    public func getReactionCounts(messageId: String) async throws -> [String: Int] {
        try store.getReactionCounts(for: messageId)
    }

    // MARK: - Read Receipts

    /// Mark messages as read
    public func markAsRead(conversationId: String, lastMessageId: String) async throws {
        guard let userPubkey = await cryptoManager.getPublicKeyHex() else {
            throw MessagingError.invalidMessageData
        }

        let receipt = ReadReceipt(
            v: MessagingSchema.version,
            conversationID: conversationId,
            lastRead: lastMessageId,
            readAt: Int(Date().timeIntervalSince1970)
        )

        // Encode receipt
        let encoder = JSONEncoder()
        let receiptData = try encoder.encode(receipt)
        guard let receiptContent = String(data: receiptData, encoding: .utf8) else {
            throw MessagingError.invalidMessageData
        }

        // Publish to Nostr (ephemeral event)
        let tags: [[String]] = [
            ["conversation", conversationId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: 15) ?? .textNote,  // Ephemeral event
            content: receiptContent,
            tags: tags
        )

        // Save to local store
        let entity = ReadReceiptEntity.from(
            receipt,
            id: UUID().uuidString,
            userPublicKey: userPubkey
        )

        try store.saveReadReceipt(entity)

        logger.info("Marked conversation as read: \(conversationId)")
    }

    /// Get read receipts for a conversation
    public func getReadReceipts(conversationId: String) async throws -> [ReadReceipt] {
        try store.getReadReceipts(for: conversationId).map { $0.toReadReceipt() }
    }

    // MARK: - Typing Indicators

    /// Send typing indicator (ephemeral)
    public func sendTypingIndicator(conversationId: String, isTyping: Bool) async throws {
        let indicator = TypingIndicator(
            v: MessagingSchema.version,
            conversationID: conversationId,
            typing: isTyping
        )

        // Encode indicator
        let encoder = JSONEncoder()
        let indicatorData = try encoder.encode(indicator)
        guard let indicatorContent = String(data: indicatorData, encoding: .utf8) else {
            throw MessagingError.invalidMessageData
        }

        // Publish to Nostr (ephemeral event, not saved locally)
        let tags: [[String]] = [
            ["conversation", conversationId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: 16) ?? .textNote,  // Ephemeral typing event
            content: indicatorContent,
            tags: tags
        )

        logger.debug("Sent typing indicator for conversation: \(conversationId)")
    }

    // MARK: - Message Processing

    /// Process incoming Nostr event
    public func processNostrEvent(_ nostrEvent: NostrEvent) async {
        let decoder = JSONDecoder()

        do {
            switch nostrEvent.kind {
            case NostrEventKind.encryptedDirectMessage.rawValue:
                // Handle direct message (NIP-17)
                // The NostrClient already decrypts these
                break

            case NostrEventKind.groupMessage.rawValue:
                // Parse group message
                guard let data = nostrEvent.content.data(using: .utf8),
                      let message = try? decoder.decode(GroupMessage.self, from: data) else {
                    logger.warning("Failed to decode group message")
                    return
                }

                // Save to store
                let entity = GroupMessageEntity.from(
                    message,
                    id: UUID().uuidString,
                    senderPublicKey: nostrEvent.pubkey,
                    timestamp: Date(timeIntervalSince1970: TimeInterval(nostrEvent.created_at)),
                    eventId: nostrEvent.id
                )

                try store.saveGroupMessage(entity)

                logger.info("Processed incoming group message")

            case NostrEventKind.reaction.rawValue:
                // Parse reaction
                guard let data = nostrEvent.content.data(using: .utf8),
                      let reaction = try? decoder.decode(Reaction.self, from: data) else {
                    logger.warning("Failed to decode reaction")
                    return
                }

                // Save to store
                let entity = ReactionEntity.from(
                    reaction,
                    id: UUID().uuidString,
                    userPublicKey: nostrEvent.pubkey,
                    timestamp: Date(timeIntervalSince1970: TimeInterval(nostrEvent.created_at))
                )

                try store.saveReaction(entity)

                logger.info("Processed incoming reaction")

            default:
                break
            }
        } catch {
            logger.error("Failed to process Nostr event: \(error.localizedDescription)")
        }
    }
}
