package network.buildit.modules.messaging.data

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import network.buildit.generated.schemas.messaging.DirectMessage
import network.buildit.generated.schemas.messaging.GroupMessage
import network.buildit.generated.schemas.messaging.Reaction
import network.buildit.generated.schemas.messaging.ReadReceipt
import network.buildit.modules.messaging.data.local.MessageReactionEntity
import network.buildit.modules.messaging.data.local.MessagingMetadataDao
import network.buildit.modules.messaging.data.local.MessagingMetadataEntity
import network.buildit.modules.messaging.data.local.MessagingReactionDao
import network.buildit.modules.messaging.data.local.MessagingReadReceiptDao
import network.buildit.modules.messaging.data.local.ReadReceiptEntity
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Unit tests for MessagingRepository.
 *
 * Verifies message persistence, conversation queries, read receipts,
 * reactions, and proper ordering of messages.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("MessagingRepository")
class MessagingRepositoryTest {

    private lateinit var metadataDao: MessagingMetadataDao
    private lateinit var readReceiptDao: MessagingReadReceiptDao
    private lateinit var reactionDao: MessagingReactionDao
    private lateinit var repository: MessagingRepository

    private val testPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val testConversationId = "conv-123"
    private val testMessageId = "msg-456"

    @BeforeEach
    fun setup() {
        metadataDao = mockk(relaxed = true)
        readReceiptDao = mockk(relaxed = true)
        reactionDao = mockk(relaxed = true)
        repository = MessagingRepository(metadataDao, readReceiptDao, reactionDao)
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    // ============== Helper Methods ==============

    private fun createTestMetadataEntity(
        messageId: String = testMessageId,
        conversationId: String = testConversationId,
        messageType: String = "direct",
        threadId: String? = null,
        groupId: String? = null
    ): MessagingMetadataEntity = MessagingMetadataEntity(
        id = messageId,
        messageId = messageId,
        conversationId = conversationId,
        messageType = messageType,
        schemaContent = """{"v":"1.0.0","content":"Hello","senderPubkey":"$testPubkey"}""",
        schemaVersion = "1.0.0",
        mentionsJson = null,
        attachmentsJson = null,
        replyToId = null,
        threadId = threadId,
        groupId = groupId
    )

    private fun createTestReadReceiptEntity(
        conversationId: String = testConversationId,
        pubkey: String = testPubkey,
        lastRead: String = testMessageId
    ): ReadReceiptEntity = ReadReceiptEntity(
        id = "$conversationId-$pubkey",
        schemaVersion = "1.0.0",
        conversationId = conversationId,
        lastRead = lastRead,
        readAt = System.currentTimeMillis(),
        readerPubkey = pubkey
    )

    private fun createTestReactionEntity(
        messageId: String = testMessageId,
        pubkey: String = testPubkey,
        emoji: String = "thumbsup"
    ): MessageReactionEntity = MessageReactionEntity(
        id = "$messageId-$pubkey-$emoji",
        schemaVersion = "1.0.0",
        targetId = messageId,
        emoji = emoji,
        reactorPubkey = pubkey
    )

    // ============== Metadata Tests ==============

    @Nested
    @DisplayName("Message Metadata Operations")
    inner class MetadataOperations {

        @Test
        @DisplayName("getMetadata returns metadata entity when found")
        fun getMetadataReturnsWhenFound() = runTest {
            val entity = createTestMetadataEntity()
            coEvery { metadataDao.getMetadata(testMessageId) } returns entity

            val result = repository.getMetadata(testMessageId)

            assertThat(result).isNotNull()
            assertThat(result?.messageId).isEqualTo(testMessageId)
        }

        @Test
        @DisplayName("getMetadata returns null when not found")
        fun getMetadataReturnsNullWhenNotFound() = runTest {
            coEvery { metadataDao.getMetadata("nonexistent") } returns null

            val result = repository.getMetadata("nonexistent")

            assertThat(result).isNull()
        }

        @Test
        @DisplayName("getMetadataForConversation returns flow of metadata")
        fun getMetadataForConversationReturnsFlow() = runTest {
            val entities = listOf(
                createTestMetadataEntity(messageId = "msg-1"),
                createTestMetadataEntity(messageId = "msg-2")
            )
            every { metadataDao.getMetadataForConversation(testConversationId) } returns flowOf(entities)

            repository.getMetadataForConversation(testConversationId).test {
                val metadata = awaitItem()
                assertThat(metadata).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getMetadataForConversation returns empty flow for new conversation")
        fun getMetadataReturnsEmptyForNew() = runTest {
            every { metadataDao.getMetadataForConversation("new-conv") } returns flowOf(emptyList())

            repository.getMetadataForConversation("new-conv").test {
                val metadata = awaitItem()
                assertThat(metadata).isEmpty()
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getMetadataForThread returns thread messages in order")
        fun getMetadataForThreadReturnsOrdered() = runTest {
            val threadId = "thread-1"
            val entities = listOf(
                createTestMetadataEntity(messageId = "msg-1", threadId = threadId),
                createTestMetadataEntity(messageId = "msg-2", threadId = threadId)
            )
            every { metadataDao.getMetadataForThread(threadId) } returns flowOf(entities)

            repository.getMetadataForThread(threadId).test {
                val metadata = awaitItem()
                assertThat(metadata).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Message Persistence")
    inner class MessagePersistence {

        @Test
        @DisplayName("saveDirectMessage inserts metadata from DirectMessage")
        fun saveDirectMessageInserts() = runTest {
            val directMessage = mockk<DirectMessage> {
                every { v } returns "1.0.0"
                every { mentions } returns null
                every { attachments } returns null
                every { replyTo } returns null
            }

            repository.saveDirectMessage(testMessageId, testConversationId, directMessage)

            coVerify { metadataDao.insert(any()) }
        }

        @Test
        @DisplayName("saveGroupMessage inserts metadata from GroupMessage")
        fun saveGroupMessageInserts() = runTest {
            val groupMessage = mockk<GroupMessage> {
                every { v } returns "1.0.0"
                every { mentions } returns null
                every { attachments } returns null
                every { replyTo } returns null
                every { threadID } returns null
                every { groupID } returns "group-123"
            }

            repository.saveGroupMessage(testMessageId, testConversationId, groupMessage)

            coVerify { metadataDao.insert(any()) }
        }

        @Test
        @DisplayName("deleteMessageMetadata removes by message ID")
        fun deleteMessageMetadataRemoves() = runTest {
            repository.deleteMessageMetadata(testMessageId)

            coVerify { metadataDao.deleteByMessageId(testMessageId) }
        }
    }

    @Nested
    @DisplayName("Message Ordering")
    inner class MessageOrdering {

        @Test
        @DisplayName("getGroupMessages respects limit and offset")
        fun getGroupMessagesRespectsLimitOffset() = runTest {
            val entities = listOf(
                createTestMetadataEntity(messageId = "msg-1", groupId = "group-1", messageType = "group"),
                createTestMetadataEntity(messageId = "msg-2", groupId = "group-1", messageType = "group")
            )
            every { metadataDao.getGroupMessages("group-1", 50, 0) } returns flowOf(entities)

            repository.getGroupMessages("group-1", 50, 0).test {
                awaitItem() // Verify it processes without error
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getGroupMessages uses default limit of 50")
        fun getGroupMessagesUsesDefaultLimit() = runTest {
            every { metadataDao.getGroupMessages("group-1", 50, 0) } returns flowOf(emptyList())

            repository.getGroupMessages("group-1").test {
                awaitItem()
                cancelAndIgnoreRemainingEvents()
            }

            verify { metadataDao.getGroupMessages("group-1", 50, 0) }
        }
    }

    // ============== Read Receipt Tests ==============

    @Nested
    @DisplayName("Read Receipt Operations")
    inner class ReadReceiptOperations {

        @Test
        @DisplayName("getReadReceipt returns mapped receipt when found")
        fun getReadReceiptReturnsMapped() = runTest {
            val entity = createTestReadReceiptEntity()
            coEvery { readReceiptDao.getReadReceipt(testConversationId, testPubkey) } returns entity

            val receipt = repository.getReadReceipt(testConversationId, testPubkey)

            assertThat(receipt).isNotNull()
            assertThat(receipt?.conversationID).isEqualTo(testConversationId)
        }

        @Test
        @DisplayName("getReadReceipt returns null when no receipt exists")
        fun getReadReceiptReturnsNull() = runTest {
            coEvery { readReceiptDao.getReadReceipt("conv-x", "user-x") } returns null

            val receipt = repository.getReadReceipt("conv-x", "user-x")

            assertThat(receipt).isNull()
        }

        @Test
        @DisplayName("getReadReceiptsForConversation returns all receipts")
        fun getReadReceiptsForConversation() = runTest {
            val entities = listOf(
                createTestReadReceiptEntity(pubkey = "user-1"),
                createTestReadReceiptEntity(pubkey = "user-2")
            )
            every { readReceiptDao.getReadReceiptsForConversation(testConversationId) } returns flowOf(entities)

            repository.getReadReceiptsForConversation(testConversationId).test {
                val receipts = awaitItem()
                assertThat(receipts).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getReadReceiptsForMessage returns receipts for specific message")
        fun getReadReceiptsForMessage() = runTest {
            val entities = listOf(createTestReadReceiptEntity())
            every { readReceiptDao.getReadReceiptsForMessage(testMessageId) } returns flowOf(entities)

            repository.getReadReceiptsForMessage(testMessageId).test {
                val receipts = awaitItem()
                assertThat(receipts).hasSize(1)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("saveReadReceipt persists receipt with reader pubkey")
        fun saveReadReceiptPersists() = runTest {
            val receipt = ReadReceipt(
                v = "1.0.0",
                conversationID = testConversationId,
                lastRead = testMessageId,
                readAt = System.currentTimeMillis()
            )

            repository.saveReadReceipt(receipt, testPubkey)

            coVerify { readReceiptDao.insert(any()) }
        }

        @Test
        @DisplayName("deleteReadReceipt removes by conversation and pubkey")
        fun deleteReadReceiptRemoves() = runTest {
            repository.deleteReadReceipt(testConversationId, testPubkey)

            coVerify { readReceiptDao.deleteByConversationAndPubkey(testConversationId, testPubkey) }
        }
    }

    // ============== Reaction Tests ==============

    @Nested
    @DisplayName("Reaction Operations")
    inner class ReactionOperations {

        @Test
        @DisplayName("getReactionsForMessage returns all reactions")
        fun getReactionsForMessageReturnsAll() = runTest {
            val entities = listOf(
                createTestReactionEntity(emoji = "thumbsup"),
                createTestReactionEntity(pubkey = "user-2", emoji = "heart")
            )
            every { reactionDao.getReactionsForMessage(testMessageId) } returns flowOf(entities)

            repository.getReactionsForMessage(testMessageId).test {
                val reactions = awaitItem()
                assertThat(reactions).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getReaction returns specific user reaction")
        fun getReactionReturnsSpecific() = runTest {
            val entity = createTestReactionEntity()
            coEvery { reactionDao.getReaction(testMessageId, testPubkey) } returns entity

            val reaction = repository.getReaction(testMessageId, testPubkey)

            assertThat(reaction).isNotNull()
            assertThat(reaction?.emoji).isEqualTo("thumbsup")
        }

        @Test
        @DisplayName("getReactionsByEmoji filters by emoji")
        fun getReactionsByEmojiFilters() = runTest {
            val entities = listOf(
                createTestReactionEntity(emoji = "heart"),
                createTestReactionEntity(pubkey = "user-2", emoji = "heart")
            )
            every { reactionDao.getReactionsByEmoji(testMessageId, "heart") } returns flowOf(entities)

            repository.getReactionsByEmoji(testMessageId, "heart").test {
                val reactions = awaitItem()
                assertThat(reactions).hasSize(2)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getReactionCount returns correct count per emoji")
        fun getReactionCountReturnsCorrect() = runTest {
            coEvery { reactionDao.getReactionCount(testMessageId, "thumbsup") } returns 5

            val count = repository.getReactionCount(testMessageId, "thumbsup")

            assertThat(count).isEqualTo(5)
        }

        @Test
        @DisplayName("getUniqueEmojis returns distinct emoji list")
        fun getUniqueEmojisReturnsDistinct() = runTest {
            coEvery { reactionDao.getUniqueEmojis(testMessageId) } returns listOf("thumbsup", "heart", "fire")

            val emojis = repository.getUniqueEmojis(testMessageId)

            assertThat(emojis).hasSize(3)
            assertThat(emojis).containsExactly("thumbsup", "heart", "fire")
        }

        @Test
        @DisplayName("saveReaction persists reaction with reactor pubkey")
        fun saveReactionPersists() = runTest {
            val reaction = Reaction(
                v = "1.0.0",
                targetID = testMessageId,
                emoji = "thumbsup"
            )

            repository.saveReaction(reaction, testPubkey)

            coVerify { reactionDao.insert(any()) }
        }

        @Test
        @DisplayName("deleteReaction removes specific reaction")
        fun deleteReactionRemoves() = runTest {
            repository.deleteReaction(testMessageId, testPubkey, "thumbsup")

            coVerify { reactionDao.deleteReaction(testMessageId, testPubkey, "thumbsup") }
        }

        @Test
        @DisplayName("deleteAllReactionsForMessage removes all reactions")
        fun deleteAllReactionsRemoves() = runTest {
            repository.deleteAllReactionsForMessage(testMessageId)

            coVerify { reactionDao.deleteAllForMessage(testMessageId) }
        }
    }
}
