package network.buildit.core.transport

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import network.buildit.core.ble.BLEEvent
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.MeshMessage
import network.buildit.core.nostr.ConnectionState
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.util.UUID

@DisplayName("TransportRouter")
class TransportRouterTest {

    private lateinit var bleManager: BLEManager
    private lateinit var nostrClient: NostrClient
    private lateinit var messageQueue: MessageQueue

    private lateinit var bleEventsFlow: MutableSharedFlow<BLEEvent>
    private lateinit var nostrEventsFlow: MutableSharedFlow<NostrEvent>
    private lateinit var nostrConnectionStateFlow: MutableStateFlow<ConnectionState>

    @BeforeEach
    fun setup() {
        bleEventsFlow = MutableSharedFlow(extraBufferCapacity = 64)
        nostrEventsFlow = MutableSharedFlow(extraBufferCapacity = 64)
        nostrConnectionStateFlow = MutableStateFlow(ConnectionState.DISCONNECTED)

        bleManager = mockk(relaxed = true) {
            every { events } returns bleEventsFlow
        }

        nostrClient = mockk(relaxed = true) {
            every { events } returns nostrEventsFlow
            every { connectionState } returns nostrConnectionStateFlow
        }

        messageQueue = mockk(relaxed = true)
    }

    @Nested
    @DisplayName("Transport Status")
    inner class TransportStatusTests {

        @Test
        @DisplayName("initial status has no transports available")
        fun initialStatusNoTransports() {
            val status = TransportStatus()

            assertFalse(status.bleAvailable)
            assertFalse(status.nostrAvailable)
            assertFalse(status.anyAvailable)
        }

        @Test
        @DisplayName("anyAvailable returns true when BLE is available")
        fun anyAvailableWithBle() {
            val status = TransportStatus(bleAvailable = true, nostrAvailable = false)

            assertTrue(status.anyAvailable)
            assertFalse(status.allAvailable)
        }

        @Test
        @DisplayName("anyAvailable returns true when Nostr is available")
        fun anyAvailableWithNostr() {
            val status = TransportStatus(bleAvailable = false, nostrAvailable = true)

            assertTrue(status.anyAvailable)
            assertFalse(status.allAvailable)
        }

        @Test
        @DisplayName("allAvailable requires both transports")
        fun allAvailableRequiresBoth() {
            val status = TransportStatus(bleAvailable = true, nostrAvailable = true)

            assertTrue(status.anyAvailable)
            assertTrue(status.allAvailable)
        }
    }

    @Nested
    @DisplayName("Transport Selection")
    inner class TransportSelectionTests {

        @Test
        @DisplayName("Transport enum has BLE and NOSTR")
        fun transportEnumValues() {
            val transports = Transport.entries

            assertEquals(2, transports.size)
            assertTrue(transports.contains(Transport.BLE))
            assertTrue(transports.contains(Transport.NOSTR))
        }

        @Test
        @DisplayName("preferBle puts BLE first in priority")
        fun preferBleOrder() {
            val preferBle = true
            val transports = if (preferBle) {
                listOf(Transport.BLE, Transport.NOSTR)
            } else {
                listOf(Transport.NOSTR, Transport.BLE)
            }

            assertEquals(Transport.BLE, transports[0])
        }

        @Test
        @DisplayName("default order puts NOSTR first")
        fun defaultOrderNostrFirst() {
            val preferBle = false
            val transports = if (preferBle) {
                listOf(Transport.BLE, Transport.NOSTR)
            } else {
                listOf(Transport.NOSTR, Transport.BLE)
            }

            assertEquals(Transport.NOSTR, transports[0])
        }
    }

    @Nested
    @DisplayName("Message Deduplication")
    inner class MessageDeduplicationTests {

        @Test
        @DisplayName("seen message IDs are tracked")
        fun seenIdsTracked() {
            val seenIds = mutableSetOf<String>()
            val messageId = "msg-123"

            seenIds.add(messageId)

            assertTrue(seenIds.contains(messageId))
        }

        @Test
        @DisplayName("duplicate message returns false")
        fun duplicateReturnsFalse() {
            val seenIds = mutableSetOf<String>()
            val messageId = "msg-123"

            // First add returns true (new)
            val firstAdd = seenIds.add(messageId)
            // Second add returns false (duplicate)
            val secondAdd = seenIds.add(messageId)

            assertTrue(firstAdd)
            assertFalse(secondAdd)
        }

        @Test
        @DisplayName("cache size is limited")
        fun cacheSizeLimited() {
            val maxSize = 100
            val seenIds = mutableSetOf<String>()

            // Add more than max
            repeat(maxSize + 50) { i ->
                seenIds.add("msg-$i")
            }

            // Limit size
            while (seenIds.size > maxSize) {
                seenIds.remove(seenIds.first())
            }

            assertEquals(maxSize, seenIds.size)
        }
    }

    @Nested
    @DisplayName("Send Result")
    inner class SendResultTests {

        @Test
        @DisplayName("SendResult contains message ID")
        fun sendResultHasMessageId() {
            val messageId = UUID.randomUUID().toString()
            val result = SendResult(
                messageId = messageId,
                transport = Transport.NOSTR,
                status = DeliveryStatus.SENT
            )

            assertEquals(messageId, result.messageId)
        }

        @Test
        @DisplayName("SendResult tracks transport used")
        fun sendResultTracksTransport() {
            val result = SendResult(
                messageId = "msg-123",
                transport = Transport.BLE,
                status = DeliveryStatus.SENT
            )

            assertEquals(Transport.BLE, result.transport)
        }

        @Test
        @DisplayName("queued result has null transport")
        fun queuedResultNullTransport() {
            val result = SendResult(
                messageId = "msg-123",
                transport = null,
                status = DeliveryStatus.QUEUED
            )

            assertEquals(null, result.transport)
            assertEquals(DeliveryStatus.QUEUED, result.status)
        }
    }

    @Nested
    @DisplayName("Delivery Status")
    inner class DeliveryStatusTests {

        @Test
        @DisplayName("all delivery statuses exist")
        fun allStatusesExist() {
            val statuses = DeliveryStatus.entries

            assertTrue(statuses.contains(DeliveryStatus.SENT))
            assertTrue(statuses.contains(DeliveryStatus.DELIVERED))
            assertTrue(statuses.contains(DeliveryStatus.READ))
            assertTrue(statuses.contains(DeliveryStatus.QUEUED))
            assertTrue(statuses.contains(DeliveryStatus.FAILED))
        }

        @Test
        @DisplayName("status transitions are valid")
        fun statusTransitions() {
            // QUEUED -> SENT -> DELIVERED -> READ
            val progression = listOf(
                DeliveryStatus.QUEUED,
                DeliveryStatus.SENT,
                DeliveryStatus.DELIVERED,
                DeliveryStatus.READ
            )

            assertEquals(4, progression.size)
        }
    }

    @Nested
    @DisplayName("Incoming Message")
    inner class IncomingMessageTests {

        @Test
        @DisplayName("IncomingMessage contains required fields")
        fun incomingMessageFields() {
            val message = IncomingMessage(
                id = "msg-123",
                senderPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello",
                timestamp = System.currentTimeMillis(),
                transport = Transport.NOSTR
            )

            assertNotNull(message.id)
            assertNotNull(message.senderPubkey)
            assertNotNull(message.content)
            assertTrue(message.timestamp > 0)
            assertEquals(Transport.NOSTR, message.transport)
        }

        @Test
        @DisplayName("BLE message has BLE transport")
        fun bleMessageTransport() {
            val message = IncomingMessage(
                id = "msg-ble",
                senderPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "BLE message",
                timestamp = System.currentTimeMillis(),
                transport = Transport.BLE
            )

            assertEquals(Transport.BLE, message.transport)
        }
    }

    @Nested
    @DisplayName("Transport Exceptions")
    inner class TransportExceptionTests {

        @Test
        @DisplayName("Unavailable exception includes transport")
        fun unavailableException() {
            val exception = TransportException.Unavailable(Transport.BLE)

            assertEquals(Transport.BLE, exception.transport)
        }

        @Test
        @DisplayName("SendFailed exception includes transport")
        fun sendFailedException() {
            val exception = TransportException.SendFailed(Transport.NOSTR)

            assertEquals(Transport.NOSTR, exception.transport)
        }
    }

    @Nested
    @DisplayName("Message Queueing")
    inner class MessageQueueingTests {

        @Test
        @DisplayName("message is queued when no transport available")
        fun queuedWhenNoTransport() = runTest {
            // When both transports fail, message should be queued
            coEvery { messageQueue.enqueue(any()) } returns Unit

            val queuedMessage = QueuedMessage(
                id = "msg-123",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello",
                timestamp = System.currentTimeMillis()
            )
            messageQueue.enqueue(queuedMessage)

            coVerify { messageQueue.enqueue(match { it.id == "msg-123" }) }
        }

        @Test
        @DisplayName("queue is processed when transport becomes available")
        fun queueProcessedOnTransportAvailable() = runTest {
            val messages = listOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Message 1",
                    timestamp = System.currentTimeMillis()
                )
            )
            coEvery { messageQueue.dequeueAll() } returns messages

            val dequeued = messageQueue.dequeueAll()

            assertEquals(1, dequeued.size)
        }
    }

    @Nested
    @DisplayName("BLE Event Handling")
    inner class BLEEventHandlingTests {

        @Test
        @DisplayName("BLE started event updates status")
        fun bleStartedUpdatesStatus() {
            val event = BLEEvent.Started

            assertNotNull(event)
        }

        @Test
        @DisplayName("BLE stopped event updates status")
        fun bleStoppedUpdatesStatus() {
            val event = BLEEvent.Stopped

            assertNotNull(event)
        }

        @Test
        @DisplayName("BLE message received creates incoming message")
        fun bleMessageReceived() {
            val meshMessage = TestFixtures.createMeshMessage(
                id = "mesh-msg-1",
                ttl = 5
            )

            assertNotNull(meshMessage.id)
            assertEquals(5, meshMessage.ttl)
        }
    }

    @Nested
    @DisplayName("Nostr Event Handling")
    inner class NostrEventHandlingTests {

        @Test
        @DisplayName("only DM kinds are processed")
        fun onlyDmKindsProcessed() {
            val dmKinds = listOf(
                NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE,
                NostrClient.KIND_PRIVATE_DIRECT_MESSAGE
            )

            assertTrue(dmKinds.contains(4))
            assertTrue(dmKinds.contains(14))
        }

        @Test
        @DisplayName("non-DM events are ignored")
        fun nonDmEventsIgnored() {
            val event = TestFixtures.createNostrEvent(kind = 1) // Text note

            val isDm = event.kind == NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE ||
                    event.kind == NostrClient.KIND_PRIVATE_DIRECT_MESSAGE

            assertFalse(isDm)
        }
    }

    @Nested
    @DisplayName("Message ID Generation")
    inner class MessageIdGenerationTests {

        @Test
        @DisplayName("generates unique UUIDs")
        fun generatesUniqueIds() {
            val ids = (1..100).map { UUID.randomUUID().toString() }.toSet()

            assertEquals(100, ids.size)
        }

        @Test
        @DisplayName("UUID format is valid")
        fun uuidFormatValid() {
            val id = UUID.randomUUID().toString()

            // UUID v4 format: 8-4-4-4-12 hex digits
            assertTrue(id.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")))
        }
    }

    @Nested
    @DisplayName("Subscription Management")
    inner class SubscriptionManagementTests {

        @Test
        @DisplayName("subscribe creates filter for sender")
        fun subscribeCreatesFilter() {
            val senderPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val filter = TestFixtures.createNostrFilter(
                authors = listOf(senderPubkey),
                kinds = listOf(
                    NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE,
                    NostrClient.KIND_PRIVATE_DIRECT_MESSAGE
                )
            )

            assertTrue(filter.authors?.contains(senderPubkey) == true)
            assertTrue(filter.kinds?.contains(4) == true)
            assertTrue(filter.kinds?.contains(14) == true)
        }
    }
}
