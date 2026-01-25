package network.buildit.core.transport

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Persistent queue for messages that couldn't be delivered.
 *
 * Messages are stored locally and retried when transport becomes available.
 * Uses DataStore for persistence to survive app restarts.
 *
 * Features:
 * - Persistent storage using DataStore
 * - Automatic expiration of old messages
 * - Priority queuing (newer messages first)
 * - Deduplication by message ID
 */
@Singleton
class MessageQueue @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
        name = "message_queue"
    )

    private val mutex = Mutex()

    private val _queueSize = MutableStateFlow(0)
    val queueSize: StateFlow<Int> = _queueSize.asStateFlow()

    private val queueKey = stringPreferencesKey("queued_messages")

    /**
     * Enqueues a message for later delivery.
     */
    suspend fun enqueue(message: QueuedMessage) {
        mutex.withLock {
            val current = loadQueue().toMutableList()

            // Deduplicate by ID
            current.removeIf { it.id == message.id }

            // Add new message
            current.add(message)

            // Remove expired messages
            val now = System.currentTimeMillis()
            current.removeIf { now - it.timestamp > MESSAGE_EXPIRY_MS }

            // Limit queue size
            while (current.size > MAX_QUEUE_SIZE) {
                current.removeAt(0) // Remove oldest
            }

            saveQueue(current)
            _queueSize.value = current.size
        }
    }

    /**
     * Dequeues all messages for retry.
     */
    suspend fun dequeueAll(): List<QueuedMessage> {
        return mutex.withLock {
            val messages = loadQueue()
            saveQueue(emptyList())
            _queueSize.value = 0
            messages
        }
    }

    /**
     * Dequeues messages for a specific recipient.
     */
    suspend fun dequeueForRecipient(recipientPubkey: String): List<QueuedMessage> {
        return mutex.withLock {
            val current = loadQueue().toMutableList()
            val forRecipient = current.filter { it.recipientPubkey == recipientPubkey }
            current.removeAll(forRecipient)
            saveQueue(current)
            _queueSize.value = current.size
            forRecipient
        }
    }

    /**
     * Removes a specific message from the queue.
     */
    suspend fun remove(messageId: String) {
        mutex.withLock {
            val current = loadQueue().toMutableList()
            current.removeIf { it.id == messageId }
            saveQueue(current)
            _queueSize.value = current.size
        }
    }

    /**
     * Clears all queued messages.
     */
    suspend fun clear() {
        mutex.withLock {
            saveQueue(emptyList())
            _queueSize.value = 0
        }
    }

    /**
     * Gets the current queue without removing messages.
     */
    suspend fun peek(): List<QueuedMessage> {
        return mutex.withLock {
            loadQueue()
        }
    }

    /**
     * Loads the queue from DataStore.
     */
    private suspend fun loadQueue(): List<QueuedMessage> {
        val prefs = context.dataStore.data.first()
        val json = prefs[queueKey] ?: return emptyList()

        return try {
            val array = JSONArray(json)
            (0 until array.length()).map { i ->
                QueuedMessage.fromJson(array.getJSONObject(i))
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Saves the queue to DataStore.
     */
    private suspend fun saveQueue(messages: List<QueuedMessage>) {
        val array = JSONArray(messages.map { it.toJson() })

        context.dataStore.edit { prefs ->
            prefs[queueKey] = array.toString()
        }
    }

    companion object {
        /** Maximum number of messages to queue */
        private const val MAX_QUEUE_SIZE = 1000

        /** Messages older than this are automatically removed (24 hours) */
        private const val MESSAGE_EXPIRY_MS = 24 * 60 * 60 * 1000L
    }
}

/**
 * Represents a queued message.
 */
data class QueuedMessage(
    val id: String,
    val recipientPubkey: String,
    val content: String,
    val timestamp: Long,
    val retryCount: Int = 0
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("recipientPubkey", recipientPubkey)
        put("content", content)
        put("timestamp", timestamp)
        put("retryCount", retryCount)
    }

    companion object {
        fun fromJson(json: JSONObject): QueuedMessage = QueuedMessage(
            id = json.getString("id"),
            recipientPubkey = json.getString("recipientPubkey"),
            content = json.getString("content"),
            timestamp = json.getLong("timestamp"),
            retryCount = json.optInt("retryCount", 0)
        )
    }
}
