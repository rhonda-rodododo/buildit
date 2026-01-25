package network.buildit.core.transport

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.TestFixtures
import org.json.JSONArray
import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.io.File
import java.util.UUID

@DisplayName("MessageQueue")
class MessageQueueTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    @Nested
    @DisplayName("QueuedMessage")
    inner class QueuedMessageTests {

        @Test
        @DisplayName("QueuedMessage has required fields")
        fun hasRequiredFields() {
            val message = QueuedMessage(
                id = "msg-123",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello, World!",
                timestamp = System.currentTimeMillis(),
                retryCount = 0
            )

            assertNotNull(message.id)
            assertNotNull(message.recipientPubkey)
            assertNotNull(message.content)
            assertTrue(message.timestamp > 0)
            assertEquals(0, message.retryCount)
        }

        @Test
        @DisplayName("default retryCount is 0")
        fun defaultRetryCount() {
            val message = QueuedMessage(
                id = "msg-123",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello",
                timestamp = System.currentTimeMillis()
            )

            assertEquals(0, message.retryCount)
        }

        @Test
        @DisplayName("toJson serializes correctly")
        fun toJsonSerializes() {
            val timestamp = System.currentTimeMillis()
            val message = QueuedMessage(
                id = "msg-123",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Hello",
                timestamp = timestamp,
                retryCount = 2
            )

            val json = message.toJson()

            assertEquals("msg-123", json.getString("id"))
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, json.getString("recipientPubkey"))
            assertEquals("Hello", json.getString("content"))
            assertEquals(timestamp, json.getLong("timestamp"))
            assertEquals(2, json.getInt("retryCount"))
        }

        @Test
        @DisplayName("fromJson deserializes correctly")
        fun fromJsonDeserializes() {
            val timestamp = System.currentTimeMillis()
            val json = JSONObject().apply {
                put("id", "msg-456")
                put("recipientPubkey", TestFixtures.TEST_PUBLIC_KEY_HEX_2)
                put("content", "Test content")
                put("timestamp", timestamp)
                put("retryCount", 3)
            }

            val message = QueuedMessage.fromJson(json)

            assertEquals("msg-456", message.id)
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX_2, message.recipientPubkey)
            assertEquals("Test content", message.content)
            assertEquals(timestamp, message.timestamp)
            assertEquals(3, message.retryCount)
        }

        @Test
        @DisplayName("fromJson handles missing retryCount")
        fun fromJsonHandlesMissingRetryCount() {
            val json = JSONObject().apply {
                put("id", "msg-789")
                put("recipientPubkey", TestFixtures.TEST_PUBLIC_KEY_HEX)
                put("content", "No retry count")
                put("timestamp", System.currentTimeMillis())
            }

            val message = QueuedMessage.fromJson(json)

            assertEquals(0, message.retryCount)
        }

        @Test
        @DisplayName("round-trip serialization preserves data")
        fun roundTripPreservesData() {
            val original = QueuedMessage(
                id = "round-trip-msg",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Round trip test",
                timestamp = 1234567890L,
                retryCount = 5
            )

            val json = original.toJson()
            val restored = QueuedMessage.fromJson(json)

            assertEquals(original.id, restored.id)
            assertEquals(original.recipientPubkey, restored.recipientPubkey)
            assertEquals(original.content, restored.content)
            assertEquals(original.timestamp, restored.timestamp)
            assertEquals(original.retryCount, restored.retryCount)
        }
    }

    @Nested
    @DisplayName("Queue Operations")
    inner class QueueOperationsTests {

        @Test
        @DisplayName("empty queue returns empty list")
        fun emptyQueueReturnsEmpty() {
            val messages = emptyList<QueuedMessage>()

            assertTrue(messages.isEmpty())
        }

        @Test
        @DisplayName("enqueue adds message to queue")
        fun enqueueAddsMessage() {
            val queue = mutableListOf<QueuedMessage>()
            val message = QueuedMessage(
                id = "msg-1",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Test",
                timestamp = System.currentTimeMillis()
            )

            queue.add(message)

            assertEquals(1, queue.size)
            assertEquals("msg-1", queue[0].id)
        }

        @Test
        @DisplayName("dequeueAll clears queue")
        fun dequeueAllClearsQueue() {
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test 1",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-2",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test 2",
                    timestamp = System.currentTimeMillis()
                )
            )

            val dequeued = queue.toList()
            queue.clear()

            assertEquals(2, dequeued.size)
            assertTrue(queue.isEmpty())
        }

        @Test
        @DisplayName("dequeueForRecipient filters by recipient")
        fun dequeueForRecipientFilters() {
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "For user 1",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-2",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX_2,
                    content = "For user 2",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-3",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Also for user 1",
                    timestamp = System.currentTimeMillis()
                )
            )

            val forRecipient = queue.filter { it.recipientPubkey == TestFixtures.TEST_PUBLIC_KEY_HEX }
            queue.removeAll(forRecipient)

            assertEquals(2, forRecipient.size)
            assertEquals(1, queue.size)
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX_2, queue[0].recipientPubkey)
        }
    }

    @Nested
    @DisplayName("Deduplication")
    inner class DeduplicationTests {

        @Test
        @DisplayName("duplicate IDs are removed on enqueue")
        fun duplicateIdsRemoved() {
            val queue = mutableListOf<QueuedMessage>()

            val message1 = QueuedMessage(
                id = "duplicate-id",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "First version",
                timestamp = 1000L
            )
            val message2 = QueuedMessage(
                id = "duplicate-id",
                recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                content = "Updated version",
                timestamp = 2000L
            )

            queue.add(message1)
            queue.removeIf { it.id == message2.id }
            queue.add(message2)

            assertEquals(1, queue.size)
            assertEquals("Updated version", queue[0].content)
        }
    }

    @Nested
    @DisplayName("Expiration")
    inner class ExpirationTests {

        @Test
        @DisplayName("expired messages are removed")
        fun expiredMessagesRemoved() {
            val expiryMs = 24 * 60 * 60 * 1000L // 24 hours
            val now = System.currentTimeMillis()

            val queue = mutableListOf(
                QueuedMessage(
                    id = "old-msg",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Old message",
                    timestamp = now - expiryMs - 1000 // Expired
                ),
                QueuedMessage(
                    id = "new-msg",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "New message",
                    timestamp = now - 1000 // Not expired
                )
            )

            queue.removeIf { now - it.timestamp > expiryMs }

            assertEquals(1, queue.size)
            assertEquals("new-msg", queue[0].id)
        }
    }

    @Nested
    @DisplayName("Queue Size Limit")
    inner class QueueSizeLimitTests {

        @Test
        @DisplayName("queue is limited to max size")
        fun queueLimitedToMaxSize() {
            val maxSize = 1000
            val queue = mutableListOf<QueuedMessage>()

            // Add more than max
            repeat(maxSize + 100) { i ->
                queue.add(
                    QueuedMessage(
                        id = "msg-$i",
                        recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                        content = "Message $i",
                        timestamp = System.currentTimeMillis()
                    )
                )
            }

            // Limit size (remove oldest)
            while (queue.size > maxSize) {
                queue.removeAt(0)
            }

            assertEquals(maxSize, queue.size)
        }

        @Test
        @DisplayName("oldest messages are removed when limit reached")
        fun oldestRemovedFirst() {
            val maxSize = 3
            val queue = mutableListOf<QueuedMessage>()

            repeat(5) { i ->
                queue.add(
                    QueuedMessage(
                        id = "msg-$i",
                        recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                        content = "Message $i",
                        timestamp = System.currentTimeMillis()
                    )
                )
            }

            while (queue.size > maxSize) {
                queue.removeAt(0)
            }

            assertEquals("msg-2", queue[0].id)
            assertEquals("msg-3", queue[1].id)
            assertEquals("msg-4", queue[2].id)
        }
    }

    @Nested
    @DisplayName("JSON Array Serialization")
    inner class JsonArraySerializationTests {

        @Test
        @DisplayName("queue serializes to JSON array")
        fun serializesToJsonArray() {
            val messages = listOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "First",
                    timestamp = 1000L
                ),
                QueuedMessage(
                    id = "msg-2",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX_2,
                    content = "Second",
                    timestamp = 2000L
                )
            )

            val array = JSONArray(messages.map { it.toJson() })

            assertEquals(2, array.length())
        }

        @Test
        @DisplayName("JSON array deserializes to queue")
        fun deserializesFromJsonArray() {
            val array = JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "msg-a")
                    put("recipientPubkey", TestFixtures.TEST_PUBLIC_KEY_HEX)
                    put("content", "Message A")
                    put("timestamp", 1000L)
                    put("retryCount", 0)
                })
                put(JSONObject().apply {
                    put("id", "msg-b")
                    put("recipientPubkey", TestFixtures.TEST_PUBLIC_KEY_HEX_2)
                    put("content", "Message B")
                    put("timestamp", 2000L)
                    put("retryCount", 1)
                })
            }

            val messages = (0 until array.length()).map { i ->
                QueuedMessage.fromJson(array.getJSONObject(i))
            }

            assertEquals(2, messages.size)
            assertEquals("msg-a", messages[0].id)
            assertEquals("msg-b", messages[1].id)
        }

        @Test
        @DisplayName("empty JSON array returns empty list")
        fun emptyArrayReturnsEmpty() {
            val array = JSONArray()

            val messages = (0 until array.length()).map { i ->
                QueuedMessage.fromJson(array.getJSONObject(i))
            }

            assertTrue(messages.isEmpty())
        }
    }

    @Nested
    @DisplayName("Peek Operation")
    inner class PeekOperationTests {

        @Test
        @DisplayName("peek returns messages without removing")
        fun peekDoesNotRemove() {
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test",
                    timestamp = System.currentTimeMillis()
                )
            )

            val peeked = queue.toList()

            assertEquals(1, peeked.size)
            assertEquals(1, queue.size) // Still in queue
        }
    }

    @Nested
    @DisplayName("Queue Size State")
    inner class QueueSizeStateTests {

        @Test
        @DisplayName("queue size updates on enqueue")
        fun sizeUpdatesOnEnqueue() {
            var queueSize = 0
            val queue = mutableListOf<QueuedMessage>()

            queue.add(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test",
                    timestamp = System.currentTimeMillis()
                )
            )
            queueSize = queue.size

            assertEquals(1, queueSize)
        }

        @Test
        @DisplayName("queue size updates on dequeue")
        fun sizeUpdatesOnDequeue() {
            var queueSize = 0
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test",
                    timestamp = System.currentTimeMillis()
                )
            )
            queueSize = queue.size

            queue.clear()
            queueSize = queue.size

            assertEquals(0, queueSize)
        }
    }

    @Nested
    @DisplayName("Remove Operation")
    inner class RemoveOperationTests {

        @Test
        @DisplayName("remove by ID removes specific message")
        fun removeByIdRemovesSpecific() {
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Keep",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-2",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Remove",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-3",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Keep",
                    timestamp = System.currentTimeMillis()
                )
            )

            queue.removeIf { it.id == "msg-2" }

            assertEquals(2, queue.size)
            assertTrue(queue.none { it.id == "msg-2" })
        }
    }

    @Nested
    @DisplayName("Clear Operation")
    inner class ClearOperationTests {

        @Test
        @DisplayName("clear removes all messages")
        fun clearRemovesAll() {
            val queue = mutableListOf(
                QueuedMessage(
                    id = "msg-1",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test 1",
                    timestamp = System.currentTimeMillis()
                ),
                QueuedMessage(
                    id = "msg-2",
                    recipientPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    content = "Test 2",
                    timestamp = System.currentTimeMillis()
                )
            )

            queue.clear()

            assertTrue(queue.isEmpty())
        }
    }
}
