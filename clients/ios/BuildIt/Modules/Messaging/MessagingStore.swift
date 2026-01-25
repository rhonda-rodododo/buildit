// MessagingStore.swift
// BuildIt - Decentralized Mesh Communication
//
// State management for the Messaging module using SwiftData.

import Foundation
import SwiftData
import Combine
import os.log

/// Store for managing messaging data
@MainActor
public class MessagingStore: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var directMessages: [DirectMessageEntity] = []
    @Published public private(set) var groupMessages: [GroupMessageEntity] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "MessagingStore")

    // MARK: - Initialization

    public init() throws {
        let schema = Schema([
            DirectMessageEntity.self,
            GroupMessageEntity.self,
            ReactionEntity.self,
            ReadReceiptEntity.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [configuration])
        self.modelContext = ModelContext(modelContainer)

        loadMessages()
    }

    // MARK: - Direct Message Operations

    public func loadMessages() {
        isLoading = true
        defer { isLoading = false }

        do {
            let dmDescriptor = FetchDescriptor<DirectMessageEntity>(
                sortBy: [SortDescriptor(\.timestamp, order: .reverse)]
            )
            directMessages = try modelContext.fetch(dmDescriptor)

            let gmDescriptor = FetchDescriptor<GroupMessageEntity>(
                sortBy: [SortDescriptor(\.timestamp, order: .reverse)]
            )
            groupMessages = try modelContext.fetch(gmDescriptor)

            logger.info("Loaded \(self.directMessages.count) DMs and \(self.groupMessages.count) group messages")
        } catch {
            logger.error("Failed to load messages: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    public func saveDirectMessage(_ message: DirectMessageEntity) throws {
        modelContext.insert(message)
        try modelContext.save()
        loadMessages()
        logger.info("Saved direct message: \(message.id)")
    }

    public func getDirectMessages(with publicKey: String) -> [DirectMessageEntity] {
        directMessages.filter {
            $0.senderPublicKey == publicKey || $0.recipientPublicKey == publicKey
        }.sorted { $0.timestamp < $1.timestamp }
    }

    public func markAsRead(_ messageId: String) throws {
        if let message = directMessages.first(where: { $0.id == messageId }) {
            message.isRead = true
            try modelContext.save()
        }
    }

    // MARK: - Group Message Operations

    public func saveGroupMessage(_ message: GroupMessageEntity) throws {
        modelContext.insert(message)
        try modelContext.save()
        loadMessages()
        logger.info("Saved group message: \(message.id)")
    }

    public func getGroupMessages(for groupId: String, threadId: String? = nil) -> [GroupMessageEntity] {
        groupMessages.filter {
            $0.groupID == groupId && (threadId == nil || $0.threadID == threadId)
        }.sorted { $0.timestamp < $1.timestamp }
    }

    // MARK: - Reaction Operations

    public func saveReaction(_ reaction: ReactionEntity) throws {
        // Check if user already reacted with same emoji
        let descriptor = FetchDescriptor<ReactionEntity>(
            predicate: #Predicate {
                $0.targetID == reaction.targetID &&
                $0.userPublicKey == reaction.userPublicKey &&
                $0.emoji == reaction.emoji
            }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            // Remove existing reaction (toggle)
            modelContext.delete(existing)
        } else {
            // Add new reaction
            modelContext.insert(reaction)
        }

        try modelContext.save()
        logger.info("Saved reaction for message: \(reaction.targetID)")
    }

    public func getReactions(for messageId: String) throws -> [ReactionEntity] {
        let descriptor = FetchDescriptor<ReactionEntity>(
            predicate: #Predicate { $0.targetID == messageId },
            sortBy: [SortDescriptor(\.timestamp, order: .forward)]
        )
        return try modelContext.fetch(descriptor)
    }

    public func getReactionCounts(for messageId: String) throws -> [String: Int] {
        let reactions = try getReactions(for: messageId)
        var counts: [String: Int] = [:]
        for reaction in reactions {
            counts[reaction.emoji, default: 0] += 1
        }
        return counts
    }

    // MARK: - Read Receipt Operations

    public func saveReadReceipt(_ receipt: ReadReceiptEntity) throws {
        // Update or insert read receipt
        let descriptor = FetchDescriptor<ReadReceiptEntity>(
            predicate: #Predicate {
                $0.conversationID == receipt.conversationID &&
                $0.userPublicKey == receipt.userPublicKey
            }
        )

        if let existing = try modelContext.fetch(descriptor).first {
            existing.lastRead = receipt.lastRead
            existing.readAt = receipt.readAt
        } else {
            modelContext.insert(receipt)
        }

        try modelContext.save()
        logger.info("Saved read receipt for conversation: \(receipt.conversationID)")
    }

    public func getReadReceipts(for conversationId: String) throws -> [ReadReceiptEntity] {
        let descriptor = FetchDescriptor<ReadReceiptEntity>(
            predicate: #Predicate { $0.conversationID == conversationId }
        )
        return try modelContext.fetch(descriptor)
    }
}

/// Errors related to messaging
public enum MessagingError: LocalizedError {
    case messageNotFound
    case invalidMessageData
    case sendFailed
    case attachmentTooLarge

    public var errorDescription: String? {
        switch self {
        case .messageNotFound:
            return "Message not found"
        case .invalidMessageData:
            return "Invalid message data"
        case .sendFailed:
            return "Failed to send message"
        case .attachmentTooLarge:
            return "Attachment is too large"
        }
    }
}
