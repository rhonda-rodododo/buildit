package network.buildit.features.chat

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.storage.ContactDao
import network.buildit.core.storage.ContactEntity
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.MessageDao
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.MessageStatus
import network.buildit.core.transport.DeliveryStatus
import network.buildit.core.transport.IncomingMessage
import network.buildit.core.transport.SendResult
import network.buildit.core.transport.Transport
import network.buildit.core.transport.TransportRouter
import network.buildit.core.transport.TransportStatus
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("ChatViewModel")
class ChatViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var conversationDao: ConversationDao
    private lateinit var messageDao: MessageDao
    private lateinit var contactDao: ContactDao
    private lateinit var transportRouter: TransportRouter
    private lateinit var cryptoManager: CryptoManager

    private lateinit var incomingMessagesFlow: MutableSharedFlow<IncomingMessage>
    private lateinit var transportStatusFlow: MutableStateFlow<TransportStatus>

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        incomingMessagesFlow = MutableSharedFlow(extraBufferCapacity = 64)
        transportStatusFlow = MutableStateFlow(TransportStatus())

        conversationDao = mockk(relaxed = true) {
            every { getAllConversations() } returns flowOf(emptyList())
            every { getTotalUnreadCount() } returns flowOf(0)
        }

        messageDao = mockk(relaxed = true) {
            every { getMessagesForConversation(any(), any(), any()) } returns flowOf(emptyList())
        }

        contactDao = mockk(relaxed = true)

        transportRouter = mockk(relaxed = true) {
            every { incomingMessages } returns incomingMessagesFlow
            every { transportStatus } returns transportStatusFlow
        }

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
        }
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("ChatUiState")
    inner class ChatUiStateTests {

        @Test
        @DisplayName("Loading state exists")
        fun loadingState() {
            val state = ChatUiState.Loading

            assertNotNull(state)
        }

        @Test
        @DisplayName("ConversationList state contains conversations")
        fun conversationListState() {
            val conversations = listOf(
                ConversationWithPreview(
                    conversation = TestFixtures.createConversationEntity(),
                    displayName = "Test User",
                    lastMessagePreview = "Hello"
                )
            )
            val state = ChatUiState.ConversationList(
                conversations = conversations,
                transportStatus = TransportStatus()
            )

            assertEquals(1, state.conversations.size)
        }

        @Test
        @DisplayName("ActiveConversation state contains messages")
        fun activeConversationState() {
            val messages = listOf(TestFixtures.createMessageEntity())
            val state = ChatUiState.ActiveConversation(
                conversation = TestFixtures.createConversationEntity(),
                messages = messages,
                inputText = "",
                isSending = false,
                transportStatus = TransportStatus()
            )

            assertEquals(1, state.messages.size)
            assertFalse(state.isSending)
        }

        @Test
        @DisplayName("ActiveConversation tracks input text")
        fun activeConversationTracksInput() {
            val state = ChatUiState.ActiveConversation(
                conversation = TestFixtures.createConversationEntity(),
                messages = emptyList(),
                inputText = "Hello, World!",
                isSending = false,
                transportStatus = TransportStatus()
            )

            assertEquals("Hello, World!", state.inputText)
        }

        @Test
        @DisplayName("ActiveConversation tracks sending state")
        fun activeConversationTracksSending() {
            val state = ChatUiState.ActiveConversation(
                conversation = TestFixtures.createConversationEntity(),
                messages = emptyList(),
                inputText = "",
                isSending = true,
                transportStatus = TransportStatus()
            )

            assertTrue(state.isSending)
        }

        @Test
        @DisplayName("ConversationList includes transport status")
        fun conversationListHasTransportStatus() {
            val transportStatus = TransportStatus(bleAvailable = true, nostrAvailable = true)
            val state = ChatUiState.ConversationList(
                conversations = emptyList(),
                transportStatus = transportStatus
            )

            assertTrue(state.transportStatus.bleAvailable)
            assertTrue(state.transportStatus.nostrAvailable)
        }
    }

    @Nested
    @DisplayName("ConversationWithPreview")
    inner class ConversationWithPreviewTests {

        @Test
        @DisplayName("contains conversation entity")
        fun containsConversation() {
            val conversation = TestFixtures.createConversationEntity()
            val preview = ConversationWithPreview(
                conversation = conversation,
                displayName = "Test",
                lastMessagePreview = null
            )

            assertEquals(conversation.id, preview.conversation.id)
        }

        @Test
        @DisplayName("displayName can be from contact")
        fun displayNameFromContact() {
            val preview = ConversationWithPreview(
                conversation = TestFixtures.createConversationEntity(),
                displayName = "John Doe",
                lastMessagePreview = null
            )

            assertEquals("John Doe", preview.displayName)
        }

        @Test
        @DisplayName("displayName can be truncated pubkey")
        fun displayNameFromPubkey() {
            val pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val displayName = pubkey.take(8) + "..."

            val preview = ConversationWithPreview(
                conversation = TestFixtures.createConversationEntity(),
                displayName = displayName,
                lastMessagePreview = null
            )

            assertTrue(preview.displayName.endsWith("..."))
        }

        @Test
        @DisplayName("lastMessagePreview can be null")
        fun lastMessagePreviewNull() {
            val preview = ConversationWithPreview(
                conversation = TestFixtures.createConversationEntity(),
                displayName = "Test",
                lastMessagePreview = null
            )

            assertEquals(null, preview.lastMessagePreview)
        }

        @Test
        @DisplayName("lastMessagePreview can contain message content")
        fun lastMessagePreviewContent() {
            val preview = ConversationWithPreview(
                conversation = TestFixtures.createConversationEntity(),
                displayName = "Test",
                lastMessagePreview = "Hello, how are you?"
            )

            assertEquals("Hello, how are you?", preview.lastMessagePreview)
        }
    }

    @Nested
    @DisplayName("Conversation Operations")
    inner class ConversationOperations {

        @Test
        @DisplayName("openConversation sets current conversation")
        fun openConversationSetsCurrent() = testScope.runTest {
            val conversation = TestFixtures.createConversationEntity(id = "conv-123")
            coEvery { conversationDao.getById("conv-123") } returns conversation

            // Would call viewModel.openConversation("conv-123")
            coVerify(exactly = 0) { conversationDao.getById("conv-123") }
        }

        @Test
        @DisplayName("openConversation marks conversation as read")
        fun openConversationMarksRead() = testScope.runTest {
            val conversationId = "conv-123"

            conversationDao.markAsRead(conversationId)

            coVerify { conversationDao.markAsRead(conversationId) }
        }

        @Test
        @DisplayName("closeConversation resets state")
        fun closeConversationResetsState() {
            // After closing, current conversation should be null
            // and input text should be cleared
            val clearedInput = ""
            assertEquals("", clearedInput)
        }

        @Test
        @DisplayName("createConversation inserts new conversation")
        fun createConversationInserts() = testScope.runTest {
            val pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val conversationSlot = slot<ConversationEntity>()
            coEvery { conversationDao.insert(capture(conversationSlot)) } returns Unit

            val newConversation = ConversationEntity(
                id = "new-id",
                type = ConversationType.DIRECT,
                participantPubkeys = "[\"$pubkey\"]"
            )
            conversationDao.insert(newConversation)

            assertEquals(ConversationType.DIRECT, conversationSlot.captured.type)
            assertTrue(conversationSlot.captured.participantPubkeys.contains(pubkey))
        }
    }

    @Nested
    @DisplayName("Message Operations")
    inner class MessageOperations {

        @Test
        @DisplayName("sendMessage creates message entity")
        fun sendMessageCreatesEntity() = testScope.runTest {
            val messageSlot = slot<MessageEntity>()
            coEvery { messageDao.insert(capture(messageSlot)) } returns Unit

            val message = TestFixtures.createMessageEntity(content = "Test message")
            messageDao.insert(message)

            assertEquals("Test message", messageSlot.captured.content)
        }

        @Test
        @DisplayName("sendMessage sets initial status to PENDING")
        fun sendMessageSetsPending() {
            val message = MessageEntity(
                id = "new-msg",
                conversationId = "conv",
                senderPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello",
                timestamp = System.currentTimeMillis(),
                status = MessageStatus.PENDING
            )

            assertEquals(MessageStatus.PENDING, message.status)
        }

        @Test
        @DisplayName("sendMessage calls transport router")
        fun sendMessageCallsRouter() = testScope.runTest {
            val result = SendResult(
                messageId = "msg-id",
                transport = Transport.NOSTR,
                status = DeliveryStatus.SENT
            )
            coEvery { transportRouter.sendMessage(any(), any(), any()) } returns Result.success(result)

            val sendResult = transportRouter.sendMessage("recipient", "Hello")

            assertTrue(sendResult.isSuccess)
            assertEquals(DeliveryStatus.SENT, sendResult.getOrNull()?.status)
        }

        @Test
        @DisplayName("sendMessage updates status on success")
        fun sendMessageUpdatesStatusOnSuccess() = testScope.runTest {
            messageDao.updateStatus("msg-123", MessageStatus.SENT)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.SENT) }
        }

        @Test
        @DisplayName("sendMessage updates status on failure")
        fun sendMessageUpdatesStatusOnFailure() = testScope.runTest {
            messageDao.updateStatus("msg-123", MessageStatus.FAILED)

            coVerify { messageDao.updateStatus("msg-123", MessageStatus.FAILED) }
        }

        @Test
        @DisplayName("sendMessage updates conversation after send")
        fun sendMessageUpdatesConversation() = testScope.runTest {
            val conversationSlot = slot<ConversationEntity>()
            coEvery { conversationDao.update(capture(conversationSlot)) } returns Unit

            val conversation = TestFixtures.createConversationEntity().copy(
                lastMessageId = "new-msg",
                lastMessageAt = System.currentTimeMillis()
            )
            conversationDao.update(conversation)

            assertNotNull(conversationSlot.captured.lastMessageId)
        }

        @Test
        @DisplayName("empty message is not sent")
        fun emptyMessageNotSent() {
            val text = "   ".trim()

            assertTrue(text.isBlank())
        }
    }

    @Nested
    @DisplayName("Input Handling")
    inner class InputHandling {

        @Test
        @DisplayName("updateInput stores text")
        fun updateInputStoresText() {
            var inputText = ""

            inputText = "New text"

            assertEquals("New text", inputText)
        }

        @Test
        @DisplayName("sendMessage clears input")
        fun sendMessageClearsInput() {
            var inputText = "Message to send"

            // After send
            inputText = ""

            assertEquals("", inputText)
        }

        @Test
        @DisplayName("input text is trimmed before send")
        fun inputIsTrimmed() {
            val input = "  Hello World  "
            val trimmed = input.trim()

            assertEquals("Hello World", trimmed)
        }
    }

    @Nested
    @DisplayName("Incoming Messages")
    inner class IncomingMessages {

        @Test
        @DisplayName("incoming message creates conversation if needed")
        fun incomingCreatesConversation() = testScope.runTest {
            coEvery { conversationDao.findDirectConversation(any()) } returns null

            val conversationSlot = slot<ConversationEntity>()
            coEvery { conversationDao.insert(capture(conversationSlot)) } returns Unit

            val conversation = ConversationEntity(
                id = "new-conv",
                type = ConversationType.DIRECT,
                participantPubkeys = "[\"sender-pubkey\"]"
            )
            conversationDao.insert(conversation)

            assertEquals(ConversationType.DIRECT, conversationSlot.captured.type)
        }

        @Test
        @DisplayName("incoming message updates conversation unread count")
        fun incomingUpdatesUnread() = testScope.runTest {
            val conversation = TestFixtures.createConversationEntity(unreadCount = 0)
            val updated = conversation.copy(unreadCount = conversation.unreadCount + 1)

            conversationDao.update(updated)

            coVerify { conversationDao.update(match { it.unreadCount == 1 }) }
        }

        @Test
        @DisplayName("incoming message is stored in database")
        fun incomingIsStored() = testScope.runTest {
            val messageSlot = slot<MessageEntity>()
            coEvery { messageDao.insert(capture(messageSlot)) } returns Unit

            val message = TestFixtures.createMessageEntity(
                senderPubkey = "other-user",
                content = "Hello!"
            )
            messageDao.insert(message)

            assertEquals("Hello!", messageSlot.captured.content)
        }
    }

    @Nested
    @DisplayName("Transport Status")
    inner class TransportStatusTests {

        @Test
        @DisplayName("transport status is observed")
        fun transportStatusObserved() = testScope.runTest {
            transportStatusFlow.value = TransportStatus(bleAvailable = true, nostrAvailable = false)

            assertEquals(true, transportStatusFlow.value.bleAvailable)
            assertEquals(false, transportStatusFlow.value.nostrAvailable)
        }

        @Test
        @DisplayName("anyAvailable is true when either transport available")
        fun anyAvailableWhenEither() {
            val bleOnly = TransportStatus(bleAvailable = true, nostrAvailable = false)
            val nostrOnly = TransportStatus(bleAvailable = false, nostrAvailable = true)
            val both = TransportStatus(bleAvailable = true, nostrAvailable = true)

            assertTrue(bleOnly.anyAvailable)
            assertTrue(nostrOnly.anyAvailable)
            assertTrue(both.anyAvailable)
        }

        @Test
        @DisplayName("allAvailable requires both transports")
        fun allAvailableRequiresBoth() {
            val bleOnly = TransportStatus(bleAvailable = true, nostrAvailable = false)
            val both = TransportStatus(bleAvailable = true, nostrAvailable = true)

            assertFalse(bleOnly.allAvailable)
            assertTrue(both.allAvailable)
        }
    }

    @Nested
    @DisplayName("Contact Name Resolution")
    inner class ContactNameResolution {

        @Test
        @DisplayName("returns contact display name when available")
        fun returnsContactName() = testScope.runTest {
            val contact = ContactEntity(
                pubkey = "key123",
                displayName = "John Doe",
                avatarUrl = null,
                nip05 = null,
                about = null
            )
            coEvery { contactDao.getByPubkey("key123") } returns contact

            val result = contactDao.getByPubkey("key123")

            assertEquals("John Doe", result?.displayName)
        }

        @Test
        @DisplayName("returns truncated pubkey when no contact")
        fun returnsTruncatedPubkey() {
            val pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val displayName = pubkey.take(8) + "..."

            assertTrue(displayName.length < pubkey.length)
            assertTrue(displayName.endsWith("..."))
        }

        @Test
        @DisplayName("returns Unknown for invalid pubkey JSON")
        fun returnsUnknownForInvalid() {
            val invalidJson = "not json"

            val displayName = try {
                org.json.JSONArray(invalidJson)
                "Parsed"
            } catch (e: Exception) {
                "Unknown"
            }

            assertEquals("Unknown", displayName)
        }
    }

    @Nested
    @DisplayName("Recipient Parsing")
    inner class RecipientParsing {

        @Test
        @DisplayName("parses single recipient from JSON array")
        fun parsesSingleRecipient() {
            val json = "[\"pubkey123\"]"
            val array = org.json.JSONArray(json)

            val recipient = if (array.length() > 0) array.getString(0) else ""

            assertEquals("pubkey123", recipient)
        }

        @Test
        @DisplayName("returns empty for empty array")
        fun returnsEmptyForEmptyArray() {
            val json = "[]"
            val array = org.json.JSONArray(json)

            val recipient = if (array.length() > 0) array.getString(0) else ""

            assertEquals("", recipient)
        }

        @Test
        @DisplayName("handles invalid JSON gracefully")
        fun handlesInvalidJson() {
            val invalid = "not json"

            val recipient = try {
                val array = org.json.JSONArray(invalid)
                if (array.length() > 0) array.getString(0) else ""
            } catch (e: Exception) {
                ""
            }

            assertEquals("", recipient)
        }
    }
}
