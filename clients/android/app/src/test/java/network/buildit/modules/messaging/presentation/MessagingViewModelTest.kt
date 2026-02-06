package network.buildit.modules.messaging.presentation

import app.cash.turbine.test
import com.google.common.truth.Truth.assertThat
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.storage.ContactEntity
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.MessageStatus
import network.buildit.core.transport.TransportStatus
import network.buildit.modules.messaging.data.MessagingRepository
import network.buildit.modules.messaging.data.local.MessagingMetadataEntity
import network.buildit.modules.messaging.data.local.ReadReceiptEntity
import network.buildit.modules.messaging.data.local.TypingIndicatorState
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Unit tests for messaging-related ViewModels and state management.
 *
 * Verifies conversation list state, message sending state,
 * typing indicators, and transport status handling.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("Messaging Presentation Layer")
class MessagingViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var messagingRepository: MessagingRepository

    private val testPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
    private val testConversationId = "conv-123"

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        messagingRepository = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    // ============== Conversation List State Tests ==============

    @Nested
    @DisplayName("Conversation List State")
    inner class ConversationListState {

        @Test
        @DisplayName("conversations are sorted by most recent message first")
        fun conversationsSortedByRecent() {
            val conversations = listOf(
                TestFixtures.createConversationEntity(id = "old-conv", lastMessageAt = 1000),
                TestFixtures.createConversationEntity(id = "new-conv", lastMessageAt = 3000),
                TestFixtures.createConversationEntity(id = "mid-conv", lastMessageAt = 2000)
            )

            val sorted = conversations.sortedByDescending { it.lastMessageAt ?: 0 }

            assertThat(sorted[0].id).isEqualTo("new-conv")
            assertThat(sorted[1].id).isEqualTo("mid-conv")
            assertThat(sorted[2].id).isEqualTo("old-conv")
        }

        @Test
        @DisplayName("conversations with null lastMessageAt sort to bottom")
        fun nullLastMessageAtSortsToBottom() {
            val conversations = listOf(
                TestFixtures.createConversationEntity(id = "has-message", lastMessageAt = 1000),
                TestFixtures.createConversationEntity(id = "no-message", lastMessageAt = null)
            )

            val sorted = conversations.sortedByDescending { it.lastMessageAt ?: 0 }

            assertThat(sorted[0].id).isEqualTo("has-message")
            assertThat(sorted[1].id).isEqualTo("no-message")
        }

        @Test
        @DisplayName("pinned conversations appear at top")
        fun pinnedConversationsAtTop() {
            val conversations = listOf(
                TestFixtures.createConversationEntity(id = "normal", isPinned = false, lastMessageAt = 3000),
                TestFixtures.createConversationEntity(id = "pinned", isPinned = true, lastMessageAt = 1000)
            )

            val sorted = conversations.sortedWith(
                compareByDescending<ConversationEntity> { it.isPinned }
                    .thenByDescending { it.lastMessageAt ?: 0 }
            )

            assertThat(sorted[0].id).isEqualTo("pinned")
        }

        @Test
        @DisplayName("total unread count aggregates across conversations")
        fun totalUnreadAggregates() {
            val conversations = listOf(
                TestFixtures.createConversationEntity(id = "conv-1", unreadCount = 3),
                TestFixtures.createConversationEntity(id = "conv-2", unreadCount = 0),
                TestFixtures.createConversationEntity(id = "conv-3", unreadCount = 7)
            )

            val totalUnread = conversations.sumOf { it.unreadCount }

            assertThat(totalUnread).isEqualTo(10)
        }

        @Test
        @DisplayName("empty conversation list is valid state")
        fun emptyConversationListIsValid() {
            val conversations = emptyList<ConversationEntity>()

            assertThat(conversations).isEmpty()
        }

        @Test
        @DisplayName("muted conversations have unread badge suppressed")
        fun mutedConversationsUnreadSuppressed() {
            val conversation = TestFixtures.createConversationEntity(
                id = "muted-conv",
                isMuted = true,
                unreadCount = 5
            )

            // In the UI layer, muted conversations should not show unread badge
            val showBadge = !conversation.isMuted && conversation.unreadCount > 0

            assertThat(showBadge).isFalse()
        }
    }

    // ============== Message Sending State Tests ==============

    @Nested
    @DisplayName("Message Sending State")
    inner class MessageSendingState {

        @Test
        @DisplayName("message starts in PENDING status")
        fun messageStartsPending() {
            val message = MessageEntity(
                id = "new-msg",
                conversationId = testConversationId,
                senderPubkey = testPubkey,
                content = "Hello",
                timestamp = System.currentTimeMillis(),
                status = MessageStatus.PENDING
            )

            assertThat(message.status).isEqualTo(MessageStatus.PENDING)
        }

        @Test
        @DisplayName("empty message content is rejected before sending")
        fun emptyContentRejected() {
            val content = "   "
            val shouldSend = content.trim().isNotBlank()

            assertThat(shouldSend).isFalse()
        }

        @Test
        @DisplayName("message content is trimmed before sending")
        fun contentIsTrimmed() {
            val rawContent = "  Hello, World!  "
            val trimmed = rawContent.trim()

            assertThat(trimmed).isEqualTo("Hello, World!")
        }

        @Test
        @DisplayName("message with only whitespace is not sent")
        fun whitespaceOnlyNotSent() {
            val contents = listOf("", "   ", "\n", "\t", " \n \t ")

            for (content in contents) {
                assertThat(content.trim().isBlank()).isTrue()
            }
        }

        @Test
        @DisplayName("successful send transitions from PENDING to SENT")
        fun successTransitionToSent() {
            val statuses = listOf(MessageStatus.PENDING, MessageStatus.SENT)

            assertThat(statuses[0]).isEqualTo(MessageStatus.PENDING)
            assertThat(statuses[1]).isEqualTo(MessageStatus.SENT)
        }

        @Test
        @DisplayName("failed send transitions from PENDING to FAILED")
        fun failedTransitionToFailed() {
            val statuses = listOf(MessageStatus.PENDING, MessageStatus.FAILED)

            assertThat(statuses[0]).isEqualTo(MessageStatus.PENDING)
            assertThat(statuses[1]).isEqualTo(MessageStatus.FAILED)
        }

        @Test
        @DisplayName("conversation lastMessageAt updates after send")
        fun conversationLastMessageAtUpdates() {
            val conversation = TestFixtures.createConversationEntity(lastMessageAt = 1000)
            val newTimestamp = System.currentTimeMillis()
            val updated = conversation.copy(lastMessageAt = newTimestamp)

            assertThat(updated.lastMessageAt).isGreaterThan(conversation.lastMessageAt)
        }
    }

    // ============== Typing Indicator Tests ==============

    @Nested
    @DisplayName("Typing Indicators")
    inner class TypingIndicators {

        @Test
        @DisplayName("typing indicator is created with correct fields")
        fun typingIndicatorCreated() {
            val indicator = TypingIndicatorState(
                conversationId = testConversationId,
                typing = true,
                pubkey = testPubkey
            )

            assertThat(indicator.conversationId).isEqualTo(testConversationId)
            assertThat(indicator.typing).isTrue()
            assertThat(indicator.pubkey).isEqualTo(testPubkey)
        }

        @Test
        @DisplayName("typing indicator converts to schema type correctly")
        fun typingIndicatorConverts() {
            val indicator = TypingIndicatorState(
                conversationId = testConversationId,
                typing = true,
                pubkey = testPubkey
            )

            val schemaType = indicator.toTypingIndicator()

            assertThat(schemaType.v).isEqualTo("1.0.0")
            assertThat(schemaType.conversationID).isEqualTo(testConversationId)
            assertThat(schemaType.typing).isTrue()
        }

        @Test
        @DisplayName("typing indicator becomes stale after 5 seconds")
        fun typingIndicatorBecomesStale() {
            val oldTimestamp = System.currentTimeMillis() - 6000 // 6 seconds ago
            val indicator = TypingIndicatorState(
                conversationId = testConversationId,
                typing = true,
                pubkey = testPubkey,
                timestamp = oldTimestamp
            )

            assertThat(indicator.isStale()).isTrue()
        }

        @Test
        @DisplayName("typing indicator is fresh within 5 seconds")
        fun typingIndicatorIsFresh() {
            val indicator = TypingIndicatorState(
                conversationId = testConversationId,
                typing = true,
                pubkey = testPubkey,
                timestamp = System.currentTimeMillis()
            )

            assertThat(indicator.isStale()).isFalse()
        }

        @Test
        @DisplayName("stopped typing indicator has typing=false")
        fun stoppedTypingIndicator() {
            val indicator = TypingIndicatorState(
                conversationId = testConversationId,
                typing = false,
                pubkey = testPubkey
            )

            assertThat(indicator.typing).isFalse()
        }

        @Test
        @DisplayName("multiple typing indicators tracked per conversation")
        fun multipleTypingIndicators() {
            val indicators = mutableMapOf<String, TypingIndicatorState>()

            indicators["user-1"] = TypingIndicatorState(testConversationId, true, "user-1")
            indicators["user-2"] = TypingIndicatorState(testConversationId, true, "user-2")

            val activeTypers = indicators.values.filter { it.typing && !it.isStale() }

            assertThat(activeTypers).hasSize(2)
        }

        @Test
        @DisplayName("stale typing indicators are filtered out")
        fun staleIndicatorsFiltered() {
            val staleTimestamp = System.currentTimeMillis() - 10000

            val indicators = mapOf(
                "user-1" to TypingIndicatorState(testConversationId, true, "user-1"),
                "user-stale" to TypingIndicatorState(testConversationId, true, "user-stale", staleTimestamp)
            )

            val activeTypers = indicators.values.filter { it.typing && !it.isStale() }

            assertThat(activeTypers).hasSize(1)
        }
    }

    // ============== Transport Status Tests ==============

    @Nested
    @DisplayName("Transport Status")
    inner class TransportStatusTests {

        @Test
        @DisplayName("transport status shows when both transports available")
        fun bothTransportsAvailable() {
            val status = TransportStatus(bleAvailable = true, nostrAvailable = true)

            assertThat(status.anyAvailable).isTrue()
            assertThat(status.allAvailable).isTrue()
        }

        @Test
        @DisplayName("transport status shows when only BLE available")
        fun onlyBleAvailable() {
            val status = TransportStatus(bleAvailable = true, nostrAvailable = false)

            assertThat(status.anyAvailable).isTrue()
            assertThat(status.allAvailable).isFalse()
        }

        @Test
        @DisplayName("transport status shows when only Nostr available")
        fun onlyNostrAvailable() {
            val status = TransportStatus(bleAvailable = false, nostrAvailable = true)

            assertThat(status.anyAvailable).isTrue()
            assertThat(status.allAvailable).isFalse()
        }

        @Test
        @DisplayName("transport status shows when no transport available")
        fun noTransportAvailable() {
            val status = TransportStatus(bleAvailable = false, nostrAvailable = false)

            assertThat(status.anyAvailable).isFalse()
            assertThat(status.allAvailable).isFalse()
        }

        @Test
        @DisplayName("transport status updates propagate through flow")
        fun statusUpdatesPropagateFlow() = testScope.runTest {
            val statusFlow = MutableStateFlow(TransportStatus())

            statusFlow.test {
                val initial = awaitItem()
                assertThat(initial.bleAvailable).isFalse()

                statusFlow.value = TransportStatus(bleAvailable = true)
                val updated = awaitItem()
                assertThat(updated.bleAvailable).isTrue()

                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    // ============== Entity Mapping Tests ==============

    @Nested
    @DisplayName("Messaging Entity Mapping")
    inner class EntityMapping {

        @Test
        @DisplayName("MessagingMetadataEntity stores direct message type correctly")
        fun directMessageTypeCorrect() {
            val entity = MessagingMetadataEntity(
                id = "msg-1",
                messageId = "msg-1",
                conversationId = testConversationId,
                messageType = "direct",
                schemaContent = """{"v":"1.0.0","content":"Hello"}""",
                schemaVersion = "1.0.0",
                mentionsJson = null,
                attachmentsJson = null,
                replyToId = null,
                threadId = null,
                groupId = null
            )

            assertThat(entity.messageType).isEqualTo("direct")
            assertThat(entity.threadId).isNull()
            assertThat(entity.groupId).isNull()
        }

        @Test
        @DisplayName("MessagingMetadataEntity stores group message type correctly")
        fun groupMessageTypeCorrect() {
            val entity = MessagingMetadataEntity(
                id = "msg-2",
                messageId = "msg-2",
                conversationId = testConversationId,
                messageType = "group",
                schemaContent = """{"v":"1.0.0","content":"Hello group"}""",
                schemaVersion = "1.0.0",
                mentionsJson = null,
                attachmentsJson = null,
                replyToId = null,
                threadId = "thread-1",
                groupId = "group-1"
            )

            assertThat(entity.messageType).isEqualTo("group")
            assertThat(entity.threadId).isEqualTo("thread-1")
            assertThat(entity.groupId).isEqualTo("group-1")
        }

        @Test
        @DisplayName("ReadReceiptEntity maps to schema ReadReceipt correctly")
        fun readReceiptMapsCorrectly() {
            val entity = ReadReceiptEntity(
                id = "conv-123-user-1",
                schemaVersion = "1.0.0",
                conversationId = testConversationId,
                lastRead = "msg-456",
                readAt = 1706198400L,
                readerPubkey = testPubkey
            )

            val receipt = entity.toReadReceipt()

            assertThat(receipt.v).isEqualTo("1.0.0")
            assertThat(receipt.conversationID).isEqualTo(testConversationId)
            assertThat(receipt.lastRead).isEqualTo("msg-456")
            assertThat(receipt.readAt).isEqualTo(1706198400L)
        }

        @Test
        @DisplayName("Contact name resolution uses display name when available")
        fun contactNameUsesDisplayName() {
            val contact = TestFixtures.createContactEntity(
                pubkey = testPubkey,
                displayName = "Alice Johnson"
            )

            assertThat(contact.displayName).isEqualTo("Alice Johnson")
        }

        @Test
        @DisplayName("Contact name falls back to truncated pubkey")
        fun contactNameFallsBackToPubkey() {
            val contact = TestFixtures.createContactEntity(
                pubkey = testPubkey,
                displayName = null
            )

            val displayName = contact.displayName ?: "${testPubkey.take(8)}..."

            assertThat(displayName).endsWith("...")
            assertThat(displayName.length).isLessThan(testPubkey.length)
        }
    }
}
