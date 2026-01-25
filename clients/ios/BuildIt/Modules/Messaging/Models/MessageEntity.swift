// MessageEntity.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData models for persisting messages with schema types.

import Foundation
import SwiftData

/// SwiftData model for direct messages
@Model
public final class DirectMessageEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var content: String
    public var senderPublicKey: String
    public var recipientPublicKey: String
    public var timestamp: Date
    public var isRead: Bool
    public var isDelivered: Bool
    public var deliveredAt: Date?

    // Reply tracking
    public var replyToId: String?

    // Mentions (stored as comma-separated)
    public var mentionsString: String?

    // Attachments (stored as JSON)
    public var attachmentsJSON: Data?

    // Nostr event ID
    public var eventId: String?

    public init(
        id: String,
        schemaVersion: String,
        content: String,
        senderPublicKey: String,
        recipientPublicKey: String,
        timestamp: Date,
        isRead: Bool = false,
        isDelivered: Bool = false,
        deliveredAt: Date? = nil,
        replyToId: String? = nil,
        mentionsString: String? = nil,
        attachmentsJSON: Data? = nil,
        eventId: String? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.content = content
        self.senderPublicKey = senderPublicKey
        self.recipientPublicKey = recipientPublicKey
        self.timestamp = timestamp
        self.isRead = isRead
        self.isDelivered = isDelivered
        self.deliveredAt = deliveredAt
        self.replyToId = replyToId
        self.mentionsString = mentionsString
        self.attachmentsJSON = attachmentsJSON
        self.eventId = eventId
    }

    /// Convert from generated DirectMessage type
    public static func from(
        _ message: DirectMessage,
        id: String,
        senderPublicKey: String,
        recipientPublicKey: String,
        timestamp: Date,
        eventId: String?
    ) -> DirectMessageEntity {
        let encoder = JSONEncoder()

        return DirectMessageEntity(
            id: id,
            schemaVersion: message.v,
            content: message.content,
            senderPublicKey: senderPublicKey,
            recipientPublicKey: recipientPublicKey,
            timestamp: timestamp,
            replyToId: message.replyTo,
            mentionsString: message.mentions?.joined(separator: ","),
            attachmentsJSON: message.attachments.flatMap { try? encoder.encode($0) },
            eventId: eventId
        )
    }

    /// Convert to generated DirectMessage type
    public func toDirectMessage() -> DirectMessage {
        let decoder = JSONDecoder()
        let attachments = attachmentsJSON.flatMap {
            try? decoder.decode([DirectMessageAttachment].self, from: $0)
        }

        return DirectMessage(
            v: schemaVersion,
            attachments: attachments,
            content: content,
            mentions: mentionsString?.split(separator: ",").map { String($0) },
            replyTo: replyToId
        )
    }
}

/// SwiftData model for group messages
@Model
public final class GroupMessageEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var content: String
    public var senderPublicKey: String
    public var groupID: String
    public var threadID: String?
    public var timestamp: Date
    public var isRead: Bool

    // Reply tracking
    public var replyToId: String?

    // Mentions (stored as comma-separated)
    public var mentionsString: String?

    // Attachments (stored as JSON)
    public var attachmentsJSON: Data?

    // Nostr event ID
    public var eventId: String?

    public init(
        id: String,
        schemaVersion: String,
        content: String,
        senderPublicKey: String,
        groupID: String,
        threadID: String?,
        timestamp: Date,
        isRead: Bool = false,
        replyToId: String? = nil,
        mentionsString: String? = nil,
        attachmentsJSON: Data? = nil,
        eventId: String? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.content = content
        self.senderPublicKey = senderPublicKey
        self.groupID = groupID
        self.threadID = threadID
        self.timestamp = timestamp
        self.isRead = isRead
        self.replyToId = replyToId
        self.mentionsString = mentionsString
        self.attachmentsJSON = attachmentsJSON
        self.eventId = eventId
    }

    /// Convert from generated GroupMessage type
    public static func from(
        _ message: GroupMessage,
        id: String,
        senderPublicKey: String,
        timestamp: Date,
        eventId: String?
    ) -> GroupMessageEntity {
        let encoder = JSONEncoder()

        return GroupMessageEntity(
            id: id,
            schemaVersion: message.v,
            content: message.content,
            senderPublicKey: senderPublicKey,
            groupID: message.groupID,
            threadID: message.threadID,
            timestamp: timestamp,
            replyToId: message.replyTo,
            mentionsString: message.mentions?.joined(separator: ","),
            attachmentsJSON: message.attachments.flatMap { try? encoder.encode($0) },
            eventId: eventId
        )
    }

    /// Convert to generated GroupMessage type
    public func toGroupMessage() -> GroupMessage {
        let decoder = JSONDecoder()
        let attachments = attachmentsJSON.flatMap {
            try? decoder.decode([GroupMessageAttachment].self, from: $0)
        }

        return GroupMessage(
            v: schemaVersion,
            attachments: attachments,
            content: content,
            groupID: groupID,
            mentions: mentionsString?.split(separator: ",").map { String($0) },
            replyTo: replyToId,
            threadID: threadID
        )
    }
}

/// SwiftData model for reactions
@Model
public final class ReactionEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var emoji: String
    public var targetID: String
    public var userPublicKey: String
    public var timestamp: Date

    public init(
        id: String,
        schemaVersion: String,
        emoji: String,
        targetID: String,
        userPublicKey: String,
        timestamp: Date
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.emoji = emoji
        self.targetID = targetID
        self.userPublicKey = userPublicKey
        self.timestamp = timestamp
    }

    /// Convert from generated Reaction type
    public static func from(
        _ reaction: Reaction,
        id: String,
        userPublicKey: String,
        timestamp: Date
    ) -> ReactionEntity {
        ReactionEntity(
            id: id,
            schemaVersion: reaction.v,
            emoji: reaction.emoji,
            targetID: reaction.targetID,
            userPublicKey: userPublicKey,
            timestamp: timestamp
        )
    }

    /// Convert to generated Reaction type
    public func toReaction() -> Reaction {
        Reaction(
            v: schemaVersion,
            emoji: emoji,
            targetID: targetID
        )
    }
}

/// SwiftData model for read receipts
@Model
public final class ReadReceiptEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var conversationID: String
    public var lastRead: String
    public var readAt: Date
    public var userPublicKey: String

    public init(
        id: String,
        schemaVersion: String,
        conversationID: String,
        lastRead: String,
        readAt: Date,
        userPublicKey: String
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.conversationID = conversationID
        self.lastRead = lastRead
        self.readAt = readAt
        self.userPublicKey = userPublicKey
    }

    /// Convert from generated ReadReceipt type
    public static func from(
        _ receipt: ReadReceipt,
        id: String,
        userPublicKey: String
    ) -> ReadReceiptEntity {
        ReadReceiptEntity(
            id: id,
            schemaVersion: receipt.v,
            conversationID: receipt.conversationID,
            lastRead: receipt.lastRead,
            readAt: Date(timeIntervalSince1970: TimeInterval(receipt.readAt ?? Int(Date().timeIntervalSince1970))),
            userPublicKey: userPublicKey
        )
    }

    /// Convert to generated ReadReceipt type
    public func toReadReceipt() -> ReadReceipt {
        ReadReceipt(
            v: schemaVersion,
            conversationID: conversationID,
            lastRead: lastRead,
            readAt: Int(readAt.timeIntervalSince1970)
        )
    }
}
