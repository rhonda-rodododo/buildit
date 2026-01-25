package network.buildit.modules.messaging.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.generated.schemas.DirectMessage
import network.buildit.generated.schemas.GroupMessage
import network.buildit.generated.schemas.Reaction
import network.buildit.generated.schemas.ReadReceipt
import network.buildit.modules.messaging.data.local.MessageReactionEntity
import network.buildit.modules.messaging.data.local.MessagingMetadataDao
import network.buildit.modules.messaging.data.local.MessagingMetadataEntity
import network.buildit.modules.messaging.data.local.MessagingReactionDao
import network.buildit.modules.messaging.data.local.MessagingReadReceiptDao
import network.buildit.modules.messaging.data.local.ReadReceiptEntity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for messaging data.
 *
 * Provides access to message metadata, read receipts, and reactions
 * using the generated schema types.
 */
@Singleton
class MessagingRepository @Inject constructor(
    private val metadataDao: MessagingMetadataDao,
    private val readReceiptDao: MessagingReadReceiptDao,
    private val reactionDao: MessagingReactionDao
) {
    // ============== Metadata Methods ==============

    suspend fun getMetadata(messageId: String): MessagingMetadataEntity? {
        return metadataDao.getMetadata(messageId)
    }

    fun getMetadataForConversation(conversationId: String): Flow<List<MessagingMetadataEntity>> {
        return metadataDao.getMetadataForConversation(conversationId)
    }

    fun getMetadataForThread(threadId: String): Flow<List<MessagingMetadataEntity>> {
        return metadataDao.getMetadataForThread(threadId)
    }

    fun getGroupMessages(groupId: String, limit: Int = 50, offset: Int = 0): Flow<List<GroupMessage>> {
        return metadataDao.getGroupMessages(groupId, limit, offset).map { metadata ->
            metadata.mapNotNull { it.toGroupMessage() }
        }
    }

    suspend fun saveDirectMessage(messageId: String, conversationId: String, message: DirectMessage) {
        val metadata = MessagingMetadataEntity.fromDirectMessage(messageId, conversationId, message)
        metadataDao.insert(metadata)
    }

    suspend fun saveGroupMessage(messageId: String, conversationId: String, message: GroupMessage) {
        val metadata = MessagingMetadataEntity.fromGroupMessage(messageId, conversationId, message)
        metadataDao.insert(metadata)
    }

    suspend fun deleteMessageMetadata(messageId: String) {
        metadataDao.deleteByMessageId(messageId)
    }

    // ============== Read Receipt Methods ==============

    suspend fun getReadReceipt(conversationId: String, pubkey: String): ReadReceipt? {
        return readReceiptDao.getReadReceipt(conversationId, pubkey)?.toReadReceipt()
    }

    fun getReadReceiptsForConversation(conversationId: String): Flow<List<ReadReceipt>> {
        return readReceiptDao.getReadReceiptsForConversation(conversationId).map { entities ->
            entities.map { it.toReadReceipt() }
        }
    }

    fun getReadReceiptsForMessage(messageId: String): Flow<List<ReadReceipt>> {
        return readReceiptDao.getReadReceiptsForMessage(messageId).map { entities ->
            entities.map { it.toReadReceipt() }
        }
    }

    suspend fun saveReadReceipt(receipt: ReadReceipt, readerPubkey: String) {
        readReceiptDao.insert(ReadReceiptEntity.from(receipt, readerPubkey))
    }

    suspend fun deleteReadReceipt(conversationId: String, pubkey: String) {
        readReceiptDao.deleteByConversationAndPubkey(conversationId, pubkey)
    }

    // ============== Reaction Methods ==============

    fun getReactionsForMessage(messageId: String): Flow<List<Reaction>> {
        return reactionDao.getReactionsForMessage(messageId).map { entities ->
            entities.map { it.toReaction() }
        }
    }

    suspend fun getReaction(messageId: String, pubkey: String): Reaction? {
        return reactionDao.getReaction(messageId, pubkey)?.toReaction()
    }

    fun getReactionsByEmoji(messageId: String, emoji: String): Flow<List<Reaction>> {
        return reactionDao.getReactionsByEmoji(messageId, emoji).map { entities ->
            entities.map { it.toReaction() }
        }
    }

    suspend fun getReactionCount(messageId: String, emoji: String): Int {
        return reactionDao.getReactionCount(messageId, emoji)
    }

    suspend fun getUniqueEmojis(messageId: String): List<String> {
        return reactionDao.getUniqueEmojis(messageId)
    }

    suspend fun saveReaction(reaction: Reaction, reactorPubkey: String) {
        reactionDao.insert(MessageReactionEntity.from(reaction, reactorPubkey))
    }

    suspend fun deleteReaction(messageId: String, pubkey: String, emoji: String) {
        reactionDao.deleteReaction(messageId, pubkey, emoji)
    }

    suspend fun deleteAllReactionsForMessage(messageId: String) {
        reactionDao.deleteAllForMessage(messageId)
    }
}
