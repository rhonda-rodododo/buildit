package network.buildit.modules.messaging.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * DAO for messaging metadata.
 */
@Dao
interface MessagingMetadataDao {
    @Query("SELECT * FROM messaging_metadata WHERE messageId = :messageId")
    suspend fun getMetadata(messageId: String): MessagingMetadataEntity?

    @Query("SELECT * FROM messaging_metadata WHERE conversationId = :conversationId ORDER BY createdAt DESC")
    fun getMetadataForConversation(conversationId: String): Flow<List<MessagingMetadataEntity>>

    @Query("SELECT * FROM messaging_metadata WHERE threadId = :threadId ORDER BY createdAt ASC")
    fun getMetadataForThread(threadId: String): Flow<List<MessagingMetadataEntity>>

    @Query("SELECT * FROM messaging_metadata WHERE groupId = :groupId ORDER BY createdAt DESC LIMIT :limit OFFSET :offset")
    fun getGroupMessages(groupId: String, limit: Int = 50, offset: Int = 0): Flow<List<MessagingMetadataEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(metadata: MessagingMetadataEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(metadata: List<MessagingMetadataEntity>)

    @Update
    suspend fun update(metadata: MessagingMetadataEntity)

    @Delete
    suspend fun delete(metadata: MessagingMetadataEntity)

    @Query("DELETE FROM messaging_metadata WHERE messageId = :messageId")
    suspend fun deleteByMessageId(messageId: String)
}

/**
 * DAO for read receipts.
 */
@Dao
interface MessagingReadReceiptDao {
    @Query("SELECT * FROM messaging_read_receipts WHERE conversationId = :conversationId AND readerPubkey = :pubkey")
    suspend fun getReadReceipt(conversationId: String, pubkey: String): ReadReceiptEntity?

    @Query("SELECT * FROM messaging_read_receipts WHERE conversationId = :conversationId")
    fun getReadReceiptsForConversation(conversationId: String): Flow<List<ReadReceiptEntity>>

    @Query("SELECT * FROM messaging_read_receipts WHERE lastRead = :messageId")
    fun getReadReceiptsForMessage(messageId: String): Flow<List<ReadReceiptEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(receipt: ReadReceiptEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(receipts: List<ReadReceiptEntity>)

    @Delete
    suspend fun delete(receipt: ReadReceiptEntity)

    @Query("DELETE FROM messaging_read_receipts WHERE conversationId = :conversationId AND readerPubkey = :pubkey")
    suspend fun deleteByConversationAndPubkey(conversationId: String, pubkey: String)
}

/**
 * DAO for message reactions.
 */
@Dao
interface MessagingReactionDao {
    @Query("SELECT * FROM messaging_reactions WHERE targetId = :messageId")
    fun getReactionsForMessage(messageId: String): Flow<List<MessageReactionEntity>>

    @Query("SELECT * FROM messaging_reactions WHERE targetId = :messageId AND reactorPubkey = :pubkey")
    suspend fun getReaction(messageId: String, pubkey: String): MessageReactionEntity?

    @Query("SELECT * FROM messaging_reactions WHERE targetId = :messageId AND emoji = :emoji")
    fun getReactionsByEmoji(messageId: String, emoji: String): Flow<List<MessageReactionEntity>>

    @Query("SELECT COUNT(*) FROM messaging_reactions WHERE targetId = :messageId AND emoji = :emoji")
    suspend fun getReactionCount(messageId: String, emoji: String): Int

    @Query("SELECT DISTINCT emoji FROM messaging_reactions WHERE targetId = :messageId")
    suspend fun getUniqueEmojis(messageId: String): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(reaction: MessageReactionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(reactions: List<MessageReactionEntity>)

    @Delete
    suspend fun delete(reaction: MessageReactionEntity)

    @Query("DELETE FROM messaging_reactions WHERE targetId = :messageId AND reactorPubkey = :pubkey AND emoji = :emoji")
    suspend fun deleteReaction(messageId: String, pubkey: String, emoji: String)

    @Query("DELETE FROM messaging_reactions WHERE targetId = :messageId")
    suspend fun deleteAllForMessage(messageId: String)
}
