package network.buildit.core.ble

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Routes messages through the BLE mesh network.
 *
 * Features:
 * - Flood-based mesh routing with TTL
 * - Message deduplication to prevent loops
 * - Store-and-forward for offline recipients
 * - Intelligent routing based on device proximity
 */
@Singleton
class MeshRouter @Inject constructor(
    private val gattServer: GattServer,
    private val cryptoManager: CryptoManager
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _incomingMessages = MutableSharedFlow<MeshMessage>(extraBufferCapacity = 64)
    val incomingMessages: SharedFlow<MeshMessage> = _incomingMessages.asSharedFlow()

    /** Cache of seen message IDs for deduplication */
    private val seenMessages = ConcurrentHashMap<String, Long>()

    /** Store-and-forward queue for messages to offline recipients */
    private val pendingMessages = ConcurrentHashMap<String, MutableList<MeshMessage>>()

    /** Routing table mapping public keys to device addresses */
    private val routingTable = ConcurrentHashMap<String, RoutingEntry>()

    init {
        // Process incoming messages from GATT server
        scope.launch {
            gattServer.receivedMessages.collect { message ->
                handleReceivedMessage(message)
            }
        }

        // Cleanup old entries periodically
        scope.launch {
            while (isActive) {
                delay(CLEANUP_INTERVAL_MS)
                cleanupExpiredEntries()
            }
        }

        // Update routing table when devices connect/disconnect
        scope.launch {
            gattServer.connectedDevices.collect { devices ->
                // Remove disconnected devices from routing table
                val connectedAddresses = devices.map { it.address }.toSet()
                routingTable.entries.removeIf { !connectedAddresses.contains(it.value.deviceAddress) }
            }
        }
    }

    /**
     * Sends a message to a recipient through the mesh network.
     *
     * @param recipientPublicKey The recipient's public key (hex)
     * @param payload The message payload
     * @return Result indicating success or failure
     */
    suspend fun sendMessage(recipientPublicKey: String, payload: ByteArray): Result<Unit> {
        val messageId = UUID.randomUUID().toString()
        val senderPublicKey = cryptoManager.getPublicKeyHex()
            ?: return Result.failure(BLEException.SendFailed("No identity key"))

        val message = MeshMessage(
            id = messageId,
            senderPublicKey = senderPublicKey,
            recipientPublicKey = recipientPublicKey,
            payload = payload,
            hopCount = 0,
            timestamp = System.currentTimeMillis()
        )

        // Mark as seen to prevent routing back to us
        seenMessages[messageId] = System.currentTimeMillis()

        return routeMessage(message)
    }

    /**
     * Routes a message to its destination.
     */
    private suspend fun routeMessage(message: MeshMessage): Result<Unit> {
        // Check if we have a direct route to the recipient
        val directRoute = routingTable[message.recipientPublicKey]
        val connectedDevices = gattServer.connectedDevices.value

        if (directRoute != null) {
            // Found direct route - send directly
            val device = connectedDevices.find { it.address == directRoute.deviceAddress }
            if (device != null) {
                val encodedMessage = encodeMessage(message)
                return gattServer.sendMessage(device, encodedMessage)
            }
        }

        // No direct route - flood to all connected devices (except sender)
        if (message.hopCount < MAX_HOP_COUNT) {
            val forwardedMessage = message.copy(hopCount = message.hopCount + 1)
            val encodedMessage = encodeMessage(forwardedMessage)

            var sentToAny = false
            for (device in connectedDevices) {
                // Don't send back to the device that sent us this message
                if (routingTable.values.any {
                        it.deviceAddress == device.address && it.publicKey == message.senderPublicKey
                    }) {
                    continue
                }

                gattServer.sendMessage(device, encodedMessage)
                    .onSuccess { sentToAny = true }
            }

            if (!sentToAny) {
                // No connected devices - store for later delivery
                storeMessageForLater(message)
            }
        }

        return Result.success(Unit)
    }

    /**
     * Handles a message received from the GATT server.
     */
    private suspend fun handleReceivedMessage(receivedMessage: ReceivedMessage) {
        val message = decodeMessage(receivedMessage.data) ?: return

        // Check for duplicates
        if (seenMessages.containsKey(message.id)) {
            return
        }
        seenMessages[message.id] = System.currentTimeMillis()

        // Update routing table - we can reach the sender through this device
        routingTable[message.senderPublicKey] = RoutingEntry(
            publicKey = message.senderPublicKey,
            deviceAddress = receivedMessage.senderAddress,
            hopCount = message.hopCount,
            lastSeen = System.currentTimeMillis()
        )

        // Check if message is for us
        val ourPublicKey = cryptoManager.getPublicKeyHex()
        if (message.recipientPublicKey == ourPublicKey) {
            // Message is for us - emit it
            _incomingMessages.emit(message)

            // Check if we have any pending messages for this sender
            deliverPendingMessages(message.senderPublicKey)
        } else {
            // Message is not for us - forward it
            if (message.hopCount < MAX_HOP_COUNT) {
                routeMessage(message)
            }
        }
    }

    /**
     * Stores a message for later delivery when recipient comes online.
     */
    private fun storeMessageForLater(message: MeshMessage) {
        val queue = pendingMessages.getOrPut(message.recipientPublicKey) { mutableListOf() }

        // Limit queue size per recipient
        if (queue.size < MAX_PENDING_MESSAGES_PER_RECIPIENT) {
            queue.add(message)
        }
    }

    /**
     * Delivers pending messages to a recipient that has come online.
     */
    private suspend fun deliverPendingMessages(recipientPublicKey: String) {
        val messages = pendingMessages.remove(recipientPublicKey) ?: return

        for (message in messages) {
            routeMessage(message)
        }
    }

    /**
     * Encodes a MeshMessage to bytes for transmission.
     */
    private fun encodeMessage(message: MeshMessage): ByteArray {
        // Simple encoding format:
        // - 36 bytes: message ID (UUID string)
        // - 64 bytes: sender public key (hex)
        // - 64 bytes: recipient public key (hex)
        // - 1 byte: hop count
        // - 8 bytes: timestamp (long)
        // - rest: payload

        val idBytes = message.id.toByteArray(Charsets.UTF_8).copyOf(36)
        val senderBytes = message.senderPublicKey.toByteArray(Charsets.UTF_8).copyOf(64)
        val recipientBytes = message.recipientPublicKey.toByteArray(Charsets.UTF_8).copyOf(64)
        val hopByte = byteArrayOf(message.hopCount.toByte())
        val timestampBytes = message.timestamp.toByteArray()

        return idBytes + senderBytes + recipientBytes + hopByte + timestampBytes + message.payload
    }

    /**
     * Decodes bytes to a MeshMessage.
     */
    private fun decodeMessage(data: ByteArray): MeshMessage? {
        if (data.size < HEADER_SIZE) return null

        return try {
            val id = String(data.sliceArray(0 until 36), Charsets.UTF_8).trim('\u0000')
            val senderPublicKey = String(data.sliceArray(36 until 100), Charsets.UTF_8).trim('\u0000')
            val recipientPublicKey = String(data.sliceArray(100 until 164), Charsets.UTF_8).trim('\u0000')
            val hopCount = data[164].toInt() and 0xFF
            val timestamp = data.sliceArray(165 until 173).toLong()
            val payload = data.sliceArray(HEADER_SIZE until data.size)

            MeshMessage(
                id = id,
                senderPublicKey = senderPublicKey,
                recipientPublicKey = recipientPublicKey,
                payload = payload,
                hopCount = hopCount,
                timestamp = timestamp
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Cleans up expired entries from caches.
     */
    private fun cleanupExpiredEntries() {
        val now = System.currentTimeMillis()

        // Clean seen messages cache
        seenMessages.entries.removeIf { now - it.value > SEEN_MESSAGE_TTL_MS }

        // Clean routing table
        routingTable.entries.removeIf { now - it.value.lastSeen > ROUTING_ENTRY_TTL_MS }

        // Clean expired pending messages
        pendingMessages.forEach { (_, messages) ->
            messages.removeIf { now - it.timestamp > PENDING_MESSAGE_TTL_MS }
        }
        pendingMessages.entries.removeIf { it.value.isEmpty() }
    }

    companion object {
        /** Maximum hops a message can take through the mesh */
        private const val MAX_HOP_COUNT = 7

        /** Maximum pending messages per recipient */
        private const val MAX_PENDING_MESSAGES_PER_RECIPIENT = 100

        /** How long to remember seen message IDs (10 minutes) */
        private const val SEEN_MESSAGE_TTL_MS = 10 * 60 * 1000L

        /** How long routing entries remain valid (5 minutes) */
        private const val ROUTING_ENTRY_TTL_MS = 5 * 60 * 1000L

        /** How long to keep pending messages (1 hour) */
        private const val PENDING_MESSAGE_TTL_MS = 60 * 60 * 1000L

        /** Cleanup interval (1 minute) */
        private const val CLEANUP_INTERVAL_MS = 60 * 1000L

        /** Header size in encoded message */
        private const val HEADER_SIZE = 36 + 64 + 64 + 1 + 8 // 173 bytes
    }
}

/**
 * Entry in the routing table.
 */
data class RoutingEntry(
    val publicKey: String,
    val deviceAddress: String,
    val hopCount: Int,
    val lastSeen: Long
)

/**
 * Extension function to convert Long to ByteArray.
 */
private fun Long.toByteArray(): ByteArray {
    return ByteArray(8) { i -> (this shr (56 - 8 * i)).toByte() }
}

/**
 * Extension function to convert ByteArray to Long.
 */
private fun ByteArray.toLong(): Long {
    require(size >= 8) { "ByteArray must have at least 8 bytes" }
    var result = 0L
    for (i in 0 until 8) {
        result = result shl 8
        result = result or (this[i].toLong() and 0xFF)
    }
    return result
}
