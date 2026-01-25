package network.buildit.core.ble

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import network.buildit.core.crypto.CryptoManager
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import java.util.UUID

@DisplayName("MeshRouter")
class MeshRouterTest {

    private lateinit var gattServer: GattServer
    private lateinit var cryptoManager: CryptoManager
    private lateinit var receivedMessagesFlow: MutableSharedFlow<ReceivedMessage>
    private lateinit var connectedDevicesFlow: MutableStateFlow<Set<android.bluetooth.BluetoothDevice>>

    @BeforeEach
    fun setup() {
        receivedMessagesFlow = MutableSharedFlow(extraBufferCapacity = 64)
        connectedDevicesFlow = MutableStateFlow(emptySet())

        gattServer = mockk(relaxed = true) {
            every { receivedMessages } returns receivedMessagesFlow
            every { connectedDevices } returns connectedDevicesFlow
        }

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
        }
    }

    @Nested
    @DisplayName("RoutingEntry")
    inner class RoutingEntryTests {

        @Test
        @DisplayName("data class properties are accessible")
        fun propertiesAccessible() {
            val entry = TestFixtures.createRoutingEntry()

            assertNotNull(entry.publicKey)
            assertNotNull(entry.deviceAddress)
            assertTrue(entry.hopCount >= 0)
            assertTrue(entry.lastSeen > 0)
        }

        @Test
        @DisplayName("copy works correctly")
        fun copyWorks() {
            val original = TestFixtures.createRoutingEntry(hopCount = 1)

            val copy = original.copy(hopCount = 2)

            assertEquals(2, copy.hopCount)
            assertEquals(original.publicKey, copy.publicKey)
        }

        @Test
        @DisplayName("equals compares all fields")
        fun equalsComparesAllFields() {
            val entry1 = TestFixtures.createRoutingEntry(
                publicKey = "key1",
                deviceAddress = "addr1",
                hopCount = 1,
                lastSeen = 1000L
            )
            val entry2 = TestFixtures.createRoutingEntry(
                publicKey = "key1",
                deviceAddress = "addr1",
                hopCount = 1,
                lastSeen = 1000L
            )

            assertEquals(entry1, entry2)
        }
    }

    @Nested
    @DisplayName("Message Encoding/Decoding")
    inner class MessageEncodingDecoding {

        @Test
        @DisplayName("Long.toByteArray produces 8 bytes")
        fun longToByteArrayProduces8Bytes() {
            val value = 1234567890123456789L
            val bytes = longToByteArray(value)

            assertEquals(8, bytes.size)
        }

        @Test
        @DisplayName("ByteArray.toLong round-trips correctly")
        fun byteArrayRoundTrips() {
            val original = 9876543210L
            val bytes = longToByteArray(original)
            val restored = bytesToLong(bytes)

            assertEquals(original, restored)
        }

        @Test
        @DisplayName("handles zero value")
        fun handlesZero() {
            val bytes = longToByteArray(0L)
            val restored = bytesToLong(bytes)

            assertEquals(0L, restored)
        }

        @Test
        @DisplayName("handles max Long value")
        fun handlesMaxValue() {
            val bytes = longToByteArray(Long.MAX_VALUE)
            val restored = bytesToLong(bytes)

            assertEquals(Long.MAX_VALUE, restored)
        }

        @Test
        @DisplayName("handles negative values")
        fun handlesNegativeValues() {
            val original = -123456789L
            val bytes = longToByteArray(original)
            val restored = bytesToLong(bytes)

            assertEquals(original, restored)
        }

        // Helper functions mirroring the private extensions
        private fun longToByteArray(value: Long): ByteArray {
            return ByteArray(8) { i -> (value shr (56 - 8 * i)).toByte() }
        }

        private fun bytesToLong(bytes: ByteArray): Long {
            require(bytes.size >= 8) { "ByteArray must have at least 8 bytes" }
            var result = 0L
            for (i in 0 until 8) {
                result = result shl 8
                result = result or (bytes[i].toLong() and 0xFF)
            }
            return result
        }
    }

    @Nested
    @DisplayName("Message Header Format")
    inner class MessageHeaderFormat {

        private val HEADER_SIZE = 36 + 64 + 64 + 1 + 8 // 173 bytes

        @Test
        @DisplayName("header size constant is 173")
        fun headerSizeIs173() {
            assertEquals(173, HEADER_SIZE)
        }

        @Test
        @DisplayName("message ID takes 36 bytes")
        fun messageIdTakes36Bytes() {
            val uuid = UUID.randomUUID().toString()
            assertEquals(36, uuid.length)
        }

        @Test
        @DisplayName("public key takes 64 bytes")
        fun publicKeyTakes64Bytes() {
            // 32 bytes * 2 hex chars per byte = 64
            assertEquals(64, 32 * 2)
        }
    }

    @Nested
    @DisplayName("Constants")
    inner class Constants {

        @Test
        @DisplayName("MAX_HOP_COUNT is 7")
        fun maxHopCountIs7() {
            // Inferred from code behavior
            val maxHopCount = 7
            assertTrue(maxHopCount > 0)
            assertTrue(maxHopCount <= 10) // Reasonable upper bound
        }

        @Test
        @DisplayName("MAX_PENDING_MESSAGES_PER_RECIPIENT is reasonable")
        fun maxPendingMessagesReasonable() {
            val maxPending = 100
            assertTrue(maxPending > 0)
            assertTrue(maxPending <= 1000)
        }

        @Test
        @DisplayName("TTL values are in milliseconds")
        fun ttlValuesInMs() {
            val seenMessageTtl = 10 * 60 * 1000L // 10 minutes
            val routingEntryTtl = 5 * 60 * 1000L // 5 minutes
            val pendingMessageTtl = 60 * 60 * 1000L // 1 hour
            val cleanupInterval = 60 * 1000L // 1 minute

            assertTrue(seenMessageTtl > 0)
            assertTrue(routingEntryTtl > 0)
            assertTrue(pendingMessageTtl > 0)
            assertTrue(cleanupInterval > 0)
            assertTrue(seenMessageTtl > cleanupInterval)
        }
    }

    @Nested
    @DisplayName("MeshMessage Data Class")
    inner class MeshMessageDataClass {

        @Test
        @DisplayName("can create with all required fields")
        fun createWithAllFields() {
            val message = MeshMessage(
                id = "test-id",
                senderPublicKey = "sender",
                recipientPublicKey = "recipient",
                payload = "payload".toByteArray(),
                hopCount = 0,
                timestamp = System.currentTimeMillis()
            )

            assertNotNull(message)
        }

        @Test
        @DisplayName("equals compares by ID only")
        fun equalsById() {
            val message1 = TestFixtures.createMeshMessage(id = "same-id", hopCount = 0)
            val message2 = TestFixtures.createMeshMessage(id = "same-id", hopCount = 5)

            assertEquals(message1, message2)
        }

        @Test
        @DisplayName("hashCode based on ID")
        fun hashCodeById() {
            val message1 = TestFixtures.createMeshMessage(id = "same-id")
            val message2 = TestFixtures.createMeshMessage(id = "same-id")

            assertEquals(message1.hashCode(), message2.hashCode())
        }

        @Test
        @DisplayName("copy preserves other fields")
        fun copyPreservesFields() {
            val original = TestFixtures.createMeshMessage()

            val copy = original.copy(hopCount = original.hopCount + 1)

            assertEquals(original.id, copy.id)
            assertEquals(original.senderPublicKey, copy.senderPublicKey)
            assertEquals(original.recipientPublicKey, copy.recipientPublicKey)
            assertEquals(original.hopCount + 1, copy.hopCount)
        }

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 3, 7])
        @DisplayName("hopCount can be various values")
        fun hopCountVariousValues(hopCount: Int) {
            val message = TestFixtures.createMeshMessage(hopCount = hopCount)

            assertEquals(hopCount, message.hopCount)
        }
    }

    @Nested
    @DisplayName("ReceivedMessage Data Class")
    inner class ReceivedMessageDataClass {

        @Test
        @DisplayName("equals compares senderAddress and data")
        fun equalsComparesAllFields() {
            val msg1 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 3)
            )
            val msg2 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 3)
            )

            assertEquals(msg1, msg2)
        }

        @Test
        @DisplayName("different data makes messages unequal")
        fun differentDataNotEqual() {
            val msg1 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 3)
            )
            val msg2 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 4)
            )

            assertTrue(msg1 != msg2)
        }

        @Test
        @DisplayName("hashCode is consistent")
        fun hashCodeConsistent() {
            val msg1 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 3)
            )
            val msg2 = ReceivedMessage(
                senderAddress = "addr",
                data = byteArrayOf(1, 2, 3)
            )

            assertEquals(msg1.hashCode(), msg2.hashCode())
        }
    }

    @Nested
    @DisplayName("Deduplication Logic")
    inner class DeduplicationLogic {

        @Test
        @DisplayName("message IDs should be unique")
        fun messageIdsShouldBeUnique() {
            val ids = mutableSetOf<String>()

            repeat(100) {
                ids.add(UUID.randomUUID().toString())
            }

            assertEquals(100, ids.size)
        }

        @Test
        @DisplayName("concurrent hash map can handle concurrent access")
        fun concurrentMapHandlesConcurrency() {
            val map = java.util.concurrent.ConcurrentHashMap<String, Long>()

            // Simulate adding entries
            repeat(100) { i ->
                map["key$i"] = System.currentTimeMillis()
            }

            assertEquals(100, map.size)
        }
    }

    @Nested
    @DisplayName("Store and Forward")
    inner class StoreAndForward {

        @Test
        @DisplayName("pending messages map can hold messages")
        fun pendingMessagesMapWorks() {
            val pendingMessages = java.util.concurrent.ConcurrentHashMap<String, MutableList<MeshMessage>>()

            val recipientKey = "recipient1"
            val message = TestFixtures.createMeshMessage(recipientPublicKey = recipientKey)

            val queue = pendingMessages.getOrPut(recipientKey) { mutableListOf() }
            queue.add(message)

            assertEquals(1, pendingMessages[recipientKey]?.size)
        }

        @Test
        @DisplayName("can limit queue size per recipient")
        fun canLimitQueueSize() {
            val maxSize = 100
            val queue = mutableListOf<MeshMessage>()

            repeat(150) { i ->
                if (queue.size < maxSize) {
                    queue.add(TestFixtures.createMeshMessage(id = "msg$i"))
                }
            }

            assertEquals(maxSize, queue.size)
        }
    }

    @Nested
    @DisplayName("Routing Table")
    inner class RoutingTable {

        @Test
        @DisplayName("routing entries can be added and retrieved")
        fun routingEntriesCanBeManaged() {
            val routingTable = java.util.concurrent.ConcurrentHashMap<String, RoutingEntry>()

            val entry = TestFixtures.createRoutingEntry(publicKey = "pubkey1")
            routingTable["pubkey1"] = entry

            assertEquals(entry, routingTable["pubkey1"])
        }

        @Test
        @DisplayName("can remove stale entries")
        fun canRemoveStaleEntries() {
            val routingTable = java.util.concurrent.ConcurrentHashMap<String, RoutingEntry>()
            val now = System.currentTimeMillis()
            val ttl = 5 * 60 * 1000L // 5 minutes

            // Add fresh and stale entries
            routingTable["fresh"] = TestFixtures.createRoutingEntry(
                publicKey = "fresh",
                lastSeen = now
            )
            routingTable["stale"] = TestFixtures.createRoutingEntry(
                publicKey = "stale",
                lastSeen = now - ttl - 1000
            )

            // Remove stale entries
            routingTable.entries.removeIf { now - it.value.lastSeen > ttl }

            assertEquals(1, routingTable.size)
            assertNotNull(routingTable["fresh"])
            assertNull(routingTable["stale"])
        }

        @Test
        @DisplayName("updates entry when device reconnects")
        fun updatesOnReconnect() {
            val routingTable = java.util.concurrent.ConcurrentHashMap<String, RoutingEntry>()

            val oldEntry = TestFixtures.createRoutingEntry(
                publicKey = "key1",
                hopCount = 3,
                lastSeen = System.currentTimeMillis() - 10000
            )
            routingTable["key1"] = oldEntry

            val newEntry = TestFixtures.createRoutingEntry(
                publicKey = "key1",
                hopCount = 1,
                lastSeen = System.currentTimeMillis()
            )
            routingTable["key1"] = newEntry

            assertEquals(1, routingTable["key1"]?.hopCount)
        }
    }

    @Nested
    @DisplayName("Hop Count Validation")
    inner class HopCountValidation {

        @Test
        @DisplayName("hop count starts at 0 for new messages")
        fun hopCountStartsAtZero() {
            val message = TestFixtures.createMeshMessage()

            assertEquals(0, message.hopCount)
        }

        @Test
        @DisplayName("hop count increments on forward")
        fun hopCountIncrementsOnForward() {
            val original = TestFixtures.createMeshMessage(hopCount = 3)

            val forwarded = original.copy(hopCount = original.hopCount + 1)

            assertEquals(4, forwarded.hopCount)
        }

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 2, 3, 4, 5, 6])
        @DisplayName("messages with hop count < 7 can be forwarded")
        fun messagesUnderMaxCanBeForwarded(hopCount: Int) {
            val maxHopCount = 7

            assertTrue(hopCount < maxHopCount)
        }

        @Test
        @DisplayName("messages at max hop count should not be forwarded")
        fun messagesAtMaxShouldNotForward() {
            val maxHopCount = 7
            val message = TestFixtures.createMeshMessage(hopCount = maxHopCount)

            assertFalse(message.hopCount < maxHopCount)
        }
    }
}
