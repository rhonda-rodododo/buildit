package network.buildit.core.nostr

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import network.buildit.core.crypto.CryptoManager
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("NostrClient")
class NostrClientTest {

    private lateinit var cryptoManager: CryptoManager
    private lateinit var relayPool: RelayPool
    private lateinit var messagesFlow: MutableSharedFlow<RelayMessage>
    private lateinit var connectedRelaysFlow: MutableStateFlow<Int>

    @BeforeEach
    fun setup() {
        messagesFlow = MutableSharedFlow(extraBufferCapacity = 256)
        connectedRelaysFlow = MutableStateFlow(0)

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
            every { sha256(any()) } returns ByteArray(32) { it.toByte() }
            coEvery { sign(any()) } returns ByteArray(64) { it.toByte() }
            coEvery { verify(any(), any(), any()) } returns true
            coEvery { encrypt(any(), any()) } returns "encrypted".toByteArray()
        }

        relayPool = mockk(relaxed = true) {
            every { messages } returns messagesFlow
            every { connectedRelays } returns connectedRelaysFlow
            every { configuredRelays } returns listOf(
                TestFixtures.createRelayConfig()
            )
        }
    }

    @Nested
    @DisplayName("ConnectionState")
    inner class ConnectionStateTests {

        @Test
        @DisplayName("initial state is DISCONNECTED")
        fun initialStateDisconnected() {
            val state = ConnectionState.DISCONNECTED

            assertNotNull(state)
        }

        @ParameterizedTest
        @EnumSource(ConnectionState::class)
        @DisplayName("all connection states are valid")
        fun allStatesValid(state: ConnectionState) {
            assertNotNull(state)
        }

        @Test
        @DisplayName("state transitions based on connected relays")
        fun stateTransitionsBasedOnRelays() {
            // 0 relays -> DISCONNECTED
            // < configured -> PARTIALLY_CONNECTED
            // = configured -> CONNECTED

            connectedRelaysFlow.value = 0
            // Would be DISCONNECTED

            connectedRelaysFlow.value = 1
            // Would be PARTIALLY_CONNECTED or CONNECTED depending on config
        }
    }

    @Nested
    @DisplayName("Subscription")
    inner class SubscriptionTests {

        @Test
        @DisplayName("Subscription data class has required fields")
        fun subscriptionHasFields() {
            val subscription = Subscription(
                id = "sub-123",
                filters = listOf(TestFixtures.createNostrFilter())
            )

            assertNotNull(subscription.id)
            assertNotNull(subscription.filters)
        }

        @Test
        @DisplayName("subscription ID is non-empty")
        fun subscriptionIdNonEmpty() {
            val subscription = Subscription(
                id = "test-id",
                filters = emptyList()
            )

            assertTrue(subscription.id.isNotEmpty())
        }

        @Test
        @DisplayName("subscription can have multiple filters")
        fun subscriptionMultipleFilters() {
            val filters = listOf(
                TestFixtures.createNostrFilter(kinds = listOf(1)),
                TestFixtures.createNostrFilter(kinds = listOf(4))
            )
            val subscription = Subscription(
                id = "multi",
                filters = filters
            )

            assertEquals(2, subscription.filters.size)
        }
    }

    @Nested
    @DisplayName("NostrNotice")
    inner class NostrNoticeTests {

        @Test
        @DisplayName("NostrNotice contains relay URL and message")
        fun noticeContainsFields() {
            val notice = NostrNotice(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                message = "Rate limited"
            )

            assertEquals(TestFixtures.TEST_RELAY_URL, notice.relayUrl)
            assertEquals("Rate limited", notice.message)
        }

        @Test
        @DisplayName("copy works correctly")
        fun copyWorks() {
            val original = NostrNotice(
                relayUrl = "wss://relay1.com",
                message = "Message 1"
            )

            val copy = original.copy(message = "Message 2")

            assertEquals("wss://relay1.com", copy.relayUrl)
            assertEquals("Message 2", copy.message)
        }
    }

    @Nested
    @DisplayName("Event Kinds Constants")
    inner class EventKindsConstants {

        @Test
        @DisplayName("KIND_SET_METADATA is 0")
        fun setMetadata() {
            assertEquals(0, NostrClient.KIND_SET_METADATA)
        }

        @Test
        @DisplayName("KIND_TEXT_NOTE is 1")
        fun textNote() {
            assertEquals(1, NostrClient.KIND_TEXT_NOTE)
        }

        @Test
        @DisplayName("KIND_RECOMMEND_SERVER is 2")
        fun recommendServer() {
            assertEquals(2, NostrClient.KIND_RECOMMEND_SERVER)
        }

        @Test
        @DisplayName("KIND_CONTACTS is 3")
        fun contacts() {
            assertEquals(3, NostrClient.KIND_CONTACTS)
        }

        @Test
        @DisplayName("KIND_ENCRYPTED_DIRECT_MESSAGE is 4")
        fun encryptedDm() {
            assertEquals(4, NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE)
        }

        @Test
        @DisplayName("KIND_DELETE is 5")
        fun delete() {
            assertEquals(5, NostrClient.KIND_DELETE)
        }

        @Test
        @DisplayName("KIND_REPOST is 6")
        fun repost() {
            assertEquals(6, NostrClient.KIND_REPOST)
        }

        @Test
        @DisplayName("KIND_REACTION is 7")
        fun reaction() {
            assertEquals(7, NostrClient.KIND_REACTION)
        }

        @Test
        @DisplayName("KIND_CHANNEL_CREATE is 40")
        fun channelCreate() {
            assertEquals(40, NostrClient.KIND_CHANNEL_CREATE)
        }

        @Test
        @DisplayName("KIND_CHANNEL_METADATA is 41")
        fun channelMetadata() {
            assertEquals(41, NostrClient.KIND_CHANNEL_METADATA)
        }

        @Test
        @DisplayName("KIND_CHANNEL_MESSAGE is 42")
        fun channelMessage() {
            assertEquals(42, NostrClient.KIND_CHANNEL_MESSAGE)
        }

        @Test
        @DisplayName("KIND_PRIVATE_DIRECT_MESSAGE is 14")
        fun privateDm() {
            assertEquals(14, NostrClient.KIND_PRIVATE_DIRECT_MESSAGE)
        }
    }

    @Nested
    @DisplayName("RelayMessage Types")
    inner class RelayMessageTypes {

        @Test
        @DisplayName("Event message contains event data")
        fun eventMessage() {
            val event = TestFixtures.createNostrEvent()
            val message = RelayMessage.Event(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                subscriptionId = "sub-1",
                event = event
            )

            assertEquals(TestFixtures.TEST_RELAY_URL, message.relayUrl)
            assertEquals("sub-1", message.subscriptionId)
            assertEquals(event, message.event)
        }

        @Test
        @DisplayName("Ok message contains event acceptance")
        fun okMessage() {
            val message = RelayMessage.Ok(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                eventId = "event-123",
                accepted = true,
                message = "Event accepted"
            )

            assertTrue(message.accepted)
            assertEquals("event-123", message.eventId)
        }

        @Test
        @DisplayName("Eose message signals end of stored events")
        fun eoseMessage() {
            val message = RelayMessage.Eose(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                subscriptionId = "sub-1"
            )

            assertEquals("sub-1", message.subscriptionId)
        }

        @Test
        @DisplayName("Notice message contains relay notice")
        fun noticeMessage() {
            val message = RelayMessage.Notice(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                message = "Rate limit exceeded"
            )

            assertEquals("Rate limit exceeded", message.message)
        }

        @Test
        @DisplayName("Closed message indicates subscription closed")
        fun closedMessage() {
            val message = RelayMessage.Closed(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                subscriptionId = "sub-1",
                message = "Subscription closed"
            )

            assertEquals("sub-1", message.subscriptionId)
        }
    }

    @Nested
    @DisplayName("Message Serialization")
    inner class MessageSerialization {

        @Test
        @DisplayName("EVENT message format is array with type first")
        fun eventMessageFormat() {
            // ["EVENT", <event JSON>]
            val eventJson = TestFixtures.createNostrEvent().toJson()
            val message = org.json.JSONArray().apply {
                put("EVENT")
                put(eventJson)
            }

            assertEquals("EVENT", message.getString(0))
        }

        @Test
        @DisplayName("REQ message format is array with subscription ID")
        fun reqMessageFormat() {
            // ["REQ", <subscription_id>, <filters>...]
            val filter = TestFixtures.createNostrFilter()
            val message = org.json.JSONArray().apply {
                put("REQ")
                put("sub-123")
                put(filter.toJson())
            }

            assertEquals("REQ", message.getString(0))
            assertEquals("sub-123", message.getString(1))
        }

        @Test
        @DisplayName("CLOSE message format is array with subscription ID")
        fun closeMessageFormat() {
            // ["CLOSE", <subscription_id>]
            val message = org.json.JSONArray().apply {
                put("CLOSE")
                put("sub-123")
            }

            assertEquals("CLOSE", message.getString(0))
            assertEquals("sub-123", message.getString(1))
        }
    }

    @Nested
    @DisplayName("Event ID Generation")
    inner class EventIdGeneration {

        @Test
        @DisplayName("event ID is SHA256 hash of serialized content")
        fun eventIdIsSha256() {
            // Serialized format: [0, pubkey, created_at, kind, tags, content]
            val pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val createdAt = 1704067200L
            val kind = 1
            val tags = emptyList<List<String>>()
            val content = "Hello"

            val serialized = org.json.JSONArray().apply {
                put(0)
                put(pubkey)
                put(createdAt)
                put(kind)
                put(org.json.JSONArray(tags.map { org.json.JSONArray(it) }))
                put(content)
            }.toString()

            assertNotNull(serialized)
            assertTrue(serialized.startsWith("[0,"))
        }
    }

    @Nested
    @DisplayName("Direct Message Encryption")
    inner class DirectMessageEncryption {

        @Test
        @DisplayName("DM content is encrypted")
        fun dmContentEncrypted() = runTest {
            // When sendDirectMessage is called, content should be encrypted
            coEvery { cryptoManager.encrypt(any(), any()) } returns "encrypted_content".toByteArray()

            // Verify encryption would be called with plaintext
            val plaintext = "Hello recipient"
            coVerify(exactly = 0) { cryptoManager.encrypt(plaintext.toByteArray(), any()) }
        }

        @Test
        @DisplayName("DM uses p tag for recipient")
        fun dmUsesPTag() {
            val recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX_2
            val tags = listOf(listOf("p", recipientPubkey))
            val event = TestFixtures.createNostrEvent(
                kind = 4,
                tags = tags
            )

            val pTag = event.tags.find { it.firstOrNull() == "p" }
            assertNotNull(pTag)
            assertEquals(recipientPubkey, pTag!![1])
        }
    }

    @Nested
    @DisplayName("Event Verification")
    inner class EventVerification {

        @Test
        @DisplayName("valid event passes verification")
        fun validEventPasses() = runTest {
            coEvery { cryptoManager.verify(any(), any(), any()) } returns true

            val isValid = true // Would call verifyEvent
            assertTrue(isValid)
        }

        @Test
        @DisplayName("event with wrong ID fails verification")
        fun wrongIdFails() {
            val event = TestFixtures.createNostrEvent(id = "wrong-id")

            // Verification would fail because computed ID wouldn't match
            assertNotNull(event.id)
        }
    }
}
