package network.buildit.modules.messaging.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.messaging.DirectMessage
import network.buildit.generated.schemas.messaging.GroupMessage
import network.buildit.generated.schemas.messaging.ReadReceipt
import network.buildit.generated.schemas.messaging.Reaction
import network.buildit.generated.schemas.messaging.TypingIndicator

/**
 * Extended messaging entity that wraps DirectMessage or GroupMessage schema types.
 * This extends the existing MessageEntity to support the new schema types.
 */
@Entity(
    tableName = "messaging_metadata",
    indices = [
        Index("messageId"),
        Index("conversationId")
    ]
)
data class MessagingMetadataEntity(
    @PrimaryKey
    val id: String,
    val messageId: String,
    val conversationId: String,

    /**
     * Type of message: "direct" or "group"
     */
    val messageType: String,

    /**
     * Serialized DirectMessage or GroupMessage content
     */
    val schemaContent: String,

    /**
     * Schema version
     */
    val schemaVersion: String,

    /**
     * Serialized mentions array
     */
    val mentionsJson: String?,

    /**
     * Serialized attachments array
     */
    val attachmentsJson: String?,

    /**
     * Reply-to message ID
     */
    val replyToId: String?,

    /**
     * Thread ID (for group messages)
     */
    val threadId: String?,

    /**
     * Group ID (for group messages)
     */
    val groupId: String?,

    val createdAt: Long = System.currentTimeMillis()
) {
    /**
     * Converts to DirectMessage if this is a direct message.
     */
    fun toDirectMessage(): DirectMessage? {
        if (messageType != "direct") return null
        return try {
            Json.decodeFromString<DirectMessage>(schemaContent)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Converts to GroupMessage if this is a group message.
     */
    fun toGroupMessage(): GroupMessage? {
        if (messageType != "group") return null
        return try {
            Json.decodeFromString<GroupMessage>(schemaContent)
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        fun fromDirectMessage(
            messageId: String,
            conversationId: String,
            directMessage: DirectMessage
        ): MessagingMetadataEntity {
            return MessagingMetadataEntity(
                id = messageId,
                messageId = messageId,
                conversationId = conversationId,
                messageType = "direct",
                schemaContent = Json.encodeToString(directMessage),
                schemaVersion = directMessage.v,
                mentionsJson = directMessage.mentions?.let { Json.encodeToString(it) },
                attachmentsJson = directMessage.attachments?.let { Json.encodeToString(it) },
                replyToId = directMessage.replyTo,
                threadId = null,
                groupId = null
            )
        }

        fun fromGroupMessage(
            messageId: String,
            conversationId: String,
            groupMessage: GroupMessage
        ): MessagingMetadataEntity {
            return MessagingMetadataEntity(
                id = messageId,
                messageId = messageId,
                conversationId = conversationId,
                messageType = "group",
                schemaContent = Json.encodeToString(groupMessage),
                schemaVersion = groupMessage.v,
                mentionsJson = groupMessage.mentions?.let { Json.encodeToString(it) },
                attachmentsJson = groupMessage.attachments?.let { Json.encodeToString(it) },
                replyToId = groupMessage.replyTo,
                threadId = groupMessage.threadID,
                groupId = groupMessage.groupID
            )
        }
    }
}

/**
 * Entity for read receipts using the schema type.
 */
@Entity(
    tableName = "messaging_read_receipts",
    indices = [
        Index("conversationId"),
        Index("lastRead")
    ]
)
data class ReadReceiptEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val conversationId: String,
    val lastRead: String,
    val readAt: Long?,
    val readerPubkey: String,
    val updatedAt: Long = System.currentTimeMillis()
) {
    fun toReadReceipt(): ReadReceipt {
        return ReadReceipt(
            v = schemaVersion,
            conversationID = conversationId,
            lastRead = lastRead,
            readAt = readAt
        )
    }

    companion object {
        fun from(receipt: ReadReceipt, readerPubkey: String): ReadReceiptEntity {
            return ReadReceiptEntity(
                id = "${receipt.conversationID}-$readerPubkey",
                schemaVersion = receipt.v,
                conversationId = receipt.conversationID,
                lastRead = receipt.lastRead,
                readAt = receipt.readAt,
                readerPubkey = readerPubkey
            )
        }
    }
}

/**
 * Entity for message reactions using the schema type.
 */
@Entity(
    tableName = "messaging_reactions",
    indices = [
        Index("targetId"),
        Index("reactorPubkey")
    ]
)
data class MessageReactionEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val targetId: String,
    val emoji: String,
    val reactorPubkey: String,
    val createdAt: Long = System.currentTimeMillis()
) {
    fun toReaction(): Reaction {
        return Reaction(
            v = schemaVersion,
            targetID = targetId,
            emoji = emoji
        )
    }

    companion object {
        fun from(reaction: Reaction, reactorPubkey: String): MessageReactionEntity {
            return MessageReactionEntity(
                id = "${reaction.targetID}-$reactorPubkey-${reaction.emoji}",
                schemaVersion = reaction.v,
                targetId = reaction.targetID,
                emoji = reaction.emoji,
                reactorPubkey = reactorPubkey
            )
        }
    }
}

/**
 * Ephemeral typing indicator entity.
 * Not persisted long-term, used for in-memory tracking.
 */
data class TypingIndicatorState(
    val conversationId: String,
    val typing: Boolean,
    val pubkey: String,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toTypingIndicator(): TypingIndicator {
        return TypingIndicator(
            v = "1.0.0",
            conversationID = conversationId,
            typing = typing
        )
    }

    fun isStale(): Boolean {
        return System.currentTimeMillis() - timestamp > 5000 // 5 seconds
    }
}
