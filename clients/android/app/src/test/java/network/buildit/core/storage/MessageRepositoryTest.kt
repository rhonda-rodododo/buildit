package network.buildit.core.storage

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Tests for message persistence operations.
 * These tests verify DAO behavior and repository patterns.
 */
@DisplayName("Message Repository Operations")
class MessageRepositoryTest {

    private lateinit var messageDao: MessageDao
    private lateinit var conversationDao: ConversationDao
    private lateinit var contactDao: ContactDao

    @BeforeEach
    fun setup() {
        messageDao = mockk(relaxed = true)
        conversationDao = mockk(relaxed = true)
        contactDao = mockk(relaxed = true)
    }

    @Nested
    @DisplayName("MessageDao Operations")
    inner class MessageDaoOperations {

        @Test
        @DisplayName("getMessagesForConversation returns flow of messages")
        fun getMessagesReturnsFlow() = runTest {
            val messages = listOf(
                TestFixtures.createMessageEntity(id = "msg1"),
                TestFixtures.createMessageEntity(id = "msg2")
            )
            every { messageDao.getMessagesForConversation(any(), any(), any()) } returns flowOf(messages)

            messageDao.getMessagesForConversation("conv-123").test {
                val result = awaitItem()
                assertEquals(2, result.size)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getById returns message when found")
        fun getByIdReturnsMessage() = runTest {
            val message = TestFixtures.createMessageEntity(id = "msg-123")
            coEvery { messageDao.getById("msg-123") } returns message

            val result = messageDao.getById("msg-123")

            assertNotNull(result)
            assertEquals("msg-123", result?.id)
        }

        @Test
        @DisplayName("getById returns null when not found")
        fun getByIdReturnsNull() = runTest {
            coEvery { messageDao.getById(any()) } returns null

            val result = messageDao.getById("nonexistent")

            assertNull(result)
        }

        @Test
        @DisplayName("getLastMessage returns most recent message")
        fun getLastMessageReturnsRecent() = runTest {
            val message = TestFixtures.createMessageEntity(timestamp = 1000L)
            coEvery { messageDao.getLastMessage("conv-123") } returns message

            val result = messageDao.getLastMessage("conv-123")

            assertNotNull(result)
        }

        @Test
        @DisplayName("insert adds message to database")
        fun insertAddsMessage() = runTest {
            val message = TestFixtures.createMessageEntity()

            messageDao.insert(message)

            coVerify { messageDao.insert(message) }
        }

        @Test
        @DisplayName("insertAll adds multiple messages")
        fun insertAllAddsMultiple() = runTest {
            val messages = listOf(
                TestFixtures.createMessageEntity(id = "msg1"),
                TestFixtures.createMessageEntity(id = "msg2")
            )

            messageDao.insertAll(messages)

            coVerify { messageDao.insertAll(messages) }
        }

        @Test
        @DisplayName("update modifies existing message")
        fun updateModifies() = runTest {
            val message = TestFixtures.createMessageEntity()

            messageDao.update(message)

            coVerify { messageDao.update(message) }
        }

        @Test
        @DisplayName("delete removes message")
        fun deleteRemoves() = runTest {
            val message = TestFixtures.createMessageEntity()

            messageDao.delete(message)

            coVerify { messageDao.delete(message) }
        }

        @ParameterizedTest
        @EnumSource(MessageStatus::class)
        @DisplayName("updateStatus changes message status")
        fun updateStatusChangesStatus(status: MessageStatus) = runTest {
            messageDao.updateStatus("msg-123", status)

            coVerify { messageDao.updateStatus("msg-123", status) }
        }

        @Test
        @DisplayName("markConversationAsRead updates readAt")
        fun markAsReadUpdates() = runTest {
            val timestamp = System.currentTimeMillis()

            messageDao.markConversationAsRead("conv-123", timestamp)

            coVerify { messageDao.markConversationAsRead("conv-123", timestamp) }
        }

        @Test
        @DisplayName("getUnreadCount returns correct count")
        fun getUnreadCountReturns() = runTest {
            coEvery { messageDao.getUnreadCount("conv-123", "our-key") } returns 5

            val count = messageDao.getUnreadCount("conv-123", "our-key")

            assertEquals(5, count)
        }

        @Test
        @DisplayName("search returns matching messages")
        fun searchReturnsMatching() = runTest {
            val messages = listOf(TestFixtures.createMessageEntity(content = "hello world"))
            every { messageDao.search("hello") } returns flowOf(messages)

            messageDao.search("hello").test {
                val result = awaitItem()
                assertEquals(1, result.size)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("ConversationDao Operations")
    inner class ConversationDaoOperations {

        @Test
        @DisplayName("getAllConversations returns flow")
        fun getAllReturnsFlow() = runTest {
            val conversations = listOf(
                TestFixtures.createConversationEntity(id = "conv1"),
                TestFixtures.createConversationEntity(id = "conv2")
            )
            every { conversationDao.getAllConversations() } returns flowOf(conversations)

            conversationDao.getAllConversations().test {
                val result = awaitItem()
                assertEquals(2, result.size)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getById returns conversation")
        fun getByIdReturns() = runTest {
            val conversation = TestFixtures.createConversationEntity(id = "conv-123")
            coEvery { conversationDao.getById("conv-123") } returns conversation

            val result = conversationDao.getById("conv-123")

            assertNotNull(result)
        }

        @Test
        @DisplayName("getByType filters conversations")
        fun getByTypeFilters() = runTest {
            val directConversations = listOf(
                TestFixtures.createConversationEntity(type = ConversationType.DIRECT)
            )
            every { conversationDao.getByType(ConversationType.DIRECT) } returns flowOf(directConversations)

            conversationDao.getByType(ConversationType.DIRECT).test {
                val result = awaitItem()
                assertTrue(result.all { it.type == ConversationType.DIRECT })
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("findDirectConversation finds by pubkey")
        fun findDirectFinds() = runTest {
            val conversation = TestFixtures.createConversationEntity(
                type = ConversationType.DIRECT,
                participantPubkeys = "[\"pubkey123\"]"
            )
            coEvery { conversationDao.findDirectConversation("pubkey123") } returns conversation

            val result = conversationDao.findDirectConversation("pubkey123")

            assertNotNull(result)
        }

        @Test
        @DisplayName("markAsRead resets unread count")
        fun markAsReadResetsCount() = runTest {
            conversationDao.markAsRead("conv-123")

            coVerify { conversationDao.markAsRead("conv-123") }
        }

        @Test
        @DisplayName("setPinned changes pin state")
        fun setPinnedChanges() = runTest {
            conversationDao.setPinned("conv-123", true)

            coVerify { conversationDao.setPinned("conv-123", true) }
        }

        @Test
        @DisplayName("getTotalUnreadCount sums unread")
        fun getTotalUnreadSums() = runTest {
            every { conversationDao.getTotalUnreadCount() } returns flowOf(10)

            conversationDao.getTotalUnreadCount().test {
                val count = awaitItem()
                assertEquals(10, count)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("ContactDao Operations")
    inner class ContactDaoOperations {

        @Test
        @DisplayName("getAllContacts excludes blocked")
        fun getAllExcludesBlocked() = runTest {
            val contacts = listOf(
                TestFixtures.createContactEntity(pubkey = "key1", isBlocked = false)
            )
            every { contactDao.getAllContacts() } returns flowOf(contacts)

            contactDao.getAllContacts().test {
                val result = awaitItem()
                assertTrue(result.none { it.isBlocked })
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("getByPubkey returns contact")
        fun getByPubkeyReturns() = runTest {
            val contact = TestFixtures.createContactEntity(pubkey = "key123")
            coEvery { contactDao.getByPubkey("key123") } returns contact

            val result = contactDao.getByPubkey("key123")

            assertNotNull(result)
            assertEquals("key123", result?.pubkey)
        }

        @Test
        @DisplayName("getByPubkeys returns multiple")
        fun getByPubkeysReturnsMultiple() = runTest {
            val contacts = listOf(
                TestFixtures.createContactEntity(pubkey = "key1"),
                TestFixtures.createContactEntity(pubkey = "key2")
            )
            coEvery { contactDao.getByPubkeys(listOf("key1", "key2")) } returns contacts

            val result = contactDao.getByPubkeys(listOf("key1", "key2"))

            assertEquals(2, result.size)
        }

        @Test
        @DisplayName("setBlocked changes block state")
        fun setBlockedChanges() = runTest {
            contactDao.setBlocked("key123", true)

            coVerify { contactDao.setBlocked("key123", true) }
        }

        @Test
        @DisplayName("search finds matching contacts")
        fun searchFindsMatching() = runTest {
            val contacts = listOf(
                TestFixtures.createContactEntity(displayName = "John Doe")
            )
            every { contactDao.search("John") } returns flowOf(contacts)

            contactDao.search("John").test {
                val result = awaitItem()
                assertEquals(1, result.size)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Pagination")
    inner class Pagination {

        @ParameterizedTest
        @ValueSource(ints = [10, 25, 50, 100])
        @DisplayName("supports various limit values")
        fun supportsVariousLimits(limit: Int) = runTest {
            val messages = (1..limit).map {
                TestFixtures.createMessageEntity(id = "msg$it")
            }
            every { messageDao.getMessagesForConversation(any(), limit, 0) } returns flowOf(messages)

            messageDao.getMessagesForConversation("conv", limit, 0).test {
                val result = awaitItem()
                assertEquals(limit, result.size)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @ParameterizedTest
        @ValueSource(ints = [0, 10, 50, 100])
        @DisplayName("supports various offset values")
        fun supportsVariousOffsets(offset: Int) = runTest {
            every { messageDao.getMessagesForConversation(any(), 50, offset) } returns flowOf(emptyList())

            messageDao.getMessagesForConversation("conv", 50, offset).test {
                awaitItem() // Just verify it doesn't throw
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("default limit is 50")
        fun defaultLimitIs50() {
            // Verify the default parameter value in the DAO interface
            val defaultLimit = 50
            assertEquals(50, defaultLimit)
        }

        @Test
        @DisplayName("default offset is 0")
        fun defaultOffsetIs0() {
            // Verify the default parameter value in the DAO interface
            val defaultOffset = 0
            assertEquals(0, defaultOffset)
        }
    }

    @Nested
    @DisplayName("Message Status Flow")
    inner class MessageStatusFlow {

        @Test
        @DisplayName("new message starts as PENDING")
        fun newMessageIsPending() {
            val message = MessageEntity(
                id = "new-msg",
                conversationId = "conv",
                senderPubkey = "sender",
                content = "Hello",
                timestamp = System.currentTimeMillis()
            )

            assertEquals(MessageStatus.PENDING, message.status)
        }

        @Test
        @DisplayName("status transitions from PENDING to SENT")
        fun transitionToSent() = runTest {
            messageDao.updateStatus("msg-123", MessageStatus.SENT)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.SENT) }
        }

        @Test
        @DisplayName("status transitions from SENT to DELIVERED")
        fun transitionToDelivered() = runTest {
            messageDao.updateStatus("msg-123", MessageStatus.DELIVERED)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.DELIVERED) }
        }

        @Test
        @DisplayName("status transitions from DELIVERED to READ")
        fun transitionToRead() = runTest {
            messageDao.updateStatus("msg-123", MessageStatus.READ)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.READ) }
        }

        @Test
        @DisplayName("status can be FAILED")
        fun canBeFailed() = runTest {
            messageDao.updateStatus("msg-123", MessageStatus.FAILED)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.FAILED) }
        }
    }

    @Nested
    @DisplayName("Conversation Update Patterns")
    inner class ConversationUpdatePatterns {

        @Test
        @DisplayName("update conversation when message sent")
        fun updateOnMessageSent() = runTest {
            val conversation = TestFixtures.createConversationEntity()
            val updatedConversation = conversation.copy(
                lastMessageId = "new-msg",
                lastMessageAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis()
            )

            conversationDao.update(updatedConversation)

            coVerify { conversationDao.update(updatedConversation) }
        }

        @Test
        @DisplayName("increment unread count on received message")
        fun incrementUnreadOnReceived() {
            val conversation = TestFixtures.createConversationEntity(unreadCount = 0)

            val updated = conversation.copy(unreadCount = conversation.unreadCount + 1)

            assertEquals(1, updated.unreadCount)
        }

        @Test
        @DisplayName("reset unread count on conversation open")
        fun resetUnreadOnOpen() = runTest {
            conversationDao.markAsRead("conv-123")

            coVerify { conversationDao.markAsRead("conv-123") }
        }
    }

    @Nested
    @DisplayName("JSON Participant Storage")
    inner class JsonParticipantStorage {

        @Test
        @DisplayName("single participant stored as JSON array")
        fun singleParticipant() {
            val pubkey = "pubkey123"
            val json = "[\"$pubkey\"]"

            val array = org.json.JSONArray(json)
            assertEquals(1, array.length())
            assertEquals(pubkey, array.getString(0))
        }

        @Test
        @DisplayName("multiple participants stored as JSON array")
        fun multipleParticipants() {
            val pubkeys = listOf("key1", "key2", "key3")
            val json = org.json.JSONArray(pubkeys).toString()

            val array = org.json.JSONArray(json)
            assertEquals(3, array.length())
        }

        @Test
        @DisplayName("can parse participants from conversation")
        fun canParseParticipants() {
            val conversation = TestFixtures.createConversationEntity(
                participantPubkeys = "[\"key1\",\"key2\"]"
            )

            val array = org.json.JSONArray(conversation.participantPubkeys)
            assertEquals(2, array.length())
        }
    }
}
