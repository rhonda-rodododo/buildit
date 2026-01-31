package network.buildit.core.transport

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.ble.BLEEvent
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.DecryptedMessage
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.GiftWrapEvent
import network.buildit.core.nostr.ConnectionState
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Routes messages across different transport layers.
 *
 * BuildIt supports multiple transport mechanisms:
 * 1. BLE Mesh - For offline/local messaging
 * 2. Nostr Relays - For internet-based messaging
 *
 * This router:
 * - Decides which transport to use based on availability and recipient
 * - Falls back to alternative transports when primary fails
 * - Handles message deduplication across transports
 * - Queues messages for later delivery when all transports are unavailable
 */
@Singleton
class TransportRouter @Inject constructor(
    private val bleManager: BLEManager,
    private val nostrClient: NostrClient,
    private val messageQueue: MessageQueue,
    private val cryptoManager: CryptoManager
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _incomingMessages = MutableSharedFlow<IncomingMessage>(extraBufferCapacity = 256)
    val incomingMessages: SharedFlow<IncomingMessage> = _incomingMessages.asSharedFlow()

    private val _transportStatus = MutableStateFlow(TransportStatus())
    val transportStatus: StateFlow<TransportStatus> = _transportStatus.asStateFlow()

    /** Tracks message IDs we've seen to prevent duplicates */
    private val seenMessageIds = mutableSetOf<String>()
    private val seenMessageLock = Any()

    init {
        // Listen to BLE mesh messages
        scope.launch {
            bleManager.events.collect { event ->
                when (event) {
                    is BLEEvent.MessageReceived -> {
                        handleIncomingBleMessage(event.message)
                    }
                    is BLEEvent.Started -> {
                        updateTransportStatus { it.copy(bleAvailable = true) }
                    }
                    is BLEEvent.Stopped -> {
                        updateTransportStatus { it.copy(bleAvailable = false) }
                    }
                    else -> {}
                }
            }
        }

        // Listen to Nostr events
        scope.launch {
            nostrClient.events.collect { event ->
                handleIncomingNostrEvent(event)
            }
        }

        // Track Nostr connection state
        scope.launch {
            nostrClient.connectionState.collect { state ->
                updateTransportStatus {
                    it.copy(nostrAvailable = state == ConnectionState.CONNECTED ||
                            state == ConnectionState.PARTIALLY_CONNECTED)
                }
            }
        }

        // Process queued messages when transports become available
        scope.launch {
            transportStatus.collect { status ->
                if (status.anyAvailable) {
                    processQueuedMessages()
                }
            }
        }
    }

    /**
     * Sends a message using the best available transport.
     *
     * @param recipientPubkey The recipient's public key
     * @param content The message content
     * @param preferBle Whether to prefer BLE over Nostr
     * @return Result indicating success or failure
     */
    suspend fun sendMessage(
        recipientPubkey: String,
        content: String,
        preferBle: Boolean = false
    ): Result<SendResult> {
        val messageId = generateMessageId()
        val payload = content.toByteArray(Charsets.UTF_8)

        // Determine transport priority
        val transports = if (preferBle) {
            listOf(Transport.BLE, Transport.NOSTR)
        } else {
            listOf(Transport.NOSTR, Transport.BLE)
        }

        // Try each transport in order
        for (transport in transports) {
            val result = when (transport) {
                Transport.BLE -> sendViaBle(recipientPubkey, payload)
                Transport.NOSTR -> sendViaNostr(recipientPubkey, content)
            }

            if (result.isSuccess) {
                return Result.success(SendResult(
                    messageId = messageId,
                    transport = transport,
                    status = DeliveryStatus.SENT
                ))
            }
        }

        // All transports failed - queue for later
        messageQueue.enqueue(
            QueuedMessage(
                id = messageId,
                recipientPubkey = recipientPubkey,
                content = content,
                timestamp = System.currentTimeMillis()
            )
        )

        return Result.success(SendResult(
            messageId = messageId,
            transport = null,
            status = DeliveryStatus.QUEUED
        ))
    }

    /**
     * Sends a message via BLE mesh.
     */
    private suspend fun sendViaBle(recipientPubkey: String, payload: ByteArray): Result<Unit> {
        if (!_transportStatus.value.bleAvailable) {
            return Result.failure(TransportException.Unavailable(Transport.BLE))
        }

        return bleManager.sendMessage(recipientPubkey, payload)
    }

    /**
     * Sends a message via Nostr relays.
     */
    private suspend fun sendViaNostr(recipientPubkey: String, content: String): Result<Unit> {
        if (!_transportStatus.value.nostrAvailable) {
            return Result.failure(TransportException.Unavailable(Transport.NOSTR))
        }

        val success = nostrClient.sendDirectMessage(recipientPubkey, content)
        return if (success) {
            Result.success(Unit)
        } else {
            Result.failure(TransportException.SendFailed(Transport.NOSTR))
        }
    }

    /**
     * Handles an incoming BLE mesh message.
     */
    private suspend fun handleIncomingBleMessage(message: DecryptedMessage) {
        // Check for duplicate
        if (!markAsSeen(message.correlationToken)) return

        val content = try {
            String(message.payload, Charsets.UTF_8)
        } catch (e: Exception) {
            return
        }

        _incomingMessages.emit(IncomingMessage(
            id = message.correlationToken,
            senderPubkey = message.senderPubkey,
            content = content,
            timestamp = System.currentTimeMillis() / 1000,
            transport = Transport.BLE
        ))
    }

    /**
     * Handles an incoming Nostr event.
     */
    private suspend fun handleIncomingNostrEvent(event: NostrEvent) {
        // Only handle DMs and gift-wrapped messages
        val isGiftWrap = event.kind == KIND_GIFT_WRAP
        val isEncryptedDm = event.kind == NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE
        val isPrivateDm = event.kind == NostrClient.KIND_PRIVATE_DIRECT_MESSAGE

        if (!isGiftWrap && !isEncryptedDm && !isPrivateDm) {
            return
        }

        // Check for duplicate
        if (!markAsSeen(event.id)) return

        // Decrypt the message content based on kind
        val decryptedContent: String?
        val senderPubkey: String

        when {
            isGiftWrap -> {
                // NIP-17 gift wrap - unwrap to get the rumor
                val giftWrap = GiftWrapEvent(
                    id = event.id,
                    pubkey = event.pubkey,
                    createdAt = event.createdAt,
                    kind = event.kind,
                    tags = event.tags,
                    content = event.content,
                    sig = event.sig
                )
                val unwrapped = cryptoManager.unwrapGiftWrap(giftWrap)
                if (unwrapped == null) {
                    Log.w(TAG, "Failed to unwrap gift wrap from ${event.pubkey}")
                    return
                }
                if (!unwrapped.sealVerified) {
                    Log.w(TAG, "Gift wrap seal verification failed from ${event.pubkey}")
                    return
                }
                decryptedContent = unwrapped.content
                senderPubkey = unwrapped.senderPubkey
            }
            isPrivateDm -> {
                // NIP-17 kind 14 (private DM inside gift wrap, but sometimes sent directly)
                decryptedContent = cryptoManager.decryptNip44(event.content, event.pubkey)
                senderPubkey = event.pubkey
            }
            else -> {
                // NIP-04 kind 4 (legacy encrypted DM)
                decryptedContent = cryptoManager.decryptNip44(event.content, event.pubkey)
                senderPubkey = event.pubkey
            }
        }

        if (decryptedContent == null) {
            Log.w(TAG, "Failed to decrypt message from $senderPubkey")
            return
        }

        _incomingMessages.emit(IncomingMessage(
            id = event.id,
            senderPubkey = senderPubkey,
            content = decryptedContent,
            timestamp = event.createdAt * 1000,
            transport = Transport.NOSTR
        ))
    }

    /**
     * Marks a message ID as seen, returning false if already seen.
     */
    private fun markAsSeen(messageId: String): Boolean {
        synchronized(seenMessageLock) {
            if (seenMessageIds.contains(messageId)) {
                return false
            }
            seenMessageIds.add(messageId)

            // Limit cache size
            if (seenMessageIds.size > MAX_SEEN_MESSAGE_CACHE) {
                val toRemove = seenMessageIds.take(seenMessageIds.size - MAX_SEEN_MESSAGE_CACHE)
                seenMessageIds.removeAll(toRemove.toSet())
            }
            return true
        }
    }

    /**
     * Processes queued messages when transports become available.
     */
    private suspend fun processQueuedMessages() {
        val messages = messageQueue.dequeueAll()

        for (message in messages) {
            val result = sendMessage(
                recipientPubkey = message.recipientPubkey,
                content = message.content
            )

            // If still couldn't send, re-queue
            if (result.getOrNull()?.status == DeliveryStatus.QUEUED) {
                // Already queued by sendMessage
            }
        }
    }

    /**
     * Updates transport status atomically.
     */
    private fun updateTransportStatus(update: (TransportStatus) -> TransportStatus) {
        _transportStatus.value = update(_transportStatus.value)
    }

    /**
     * Generates a unique message ID.
     */
    private fun generateMessageId(): String {
        return java.util.UUID.randomUUID().toString()
    }

    /**
     * Subscribes to messages from a specific sender.
     */
    fun subscribeToSender(senderPubkey: String) {
        nostrClient.subscribe(
            NostrFilter(
                authors = listOf(senderPubkey),
                kinds = listOf(
                    NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE,
                    NostrClient.KIND_PRIVATE_DIRECT_MESSAGE
                )
            )
        )
    }

    companion object {
        private const val TAG = "TransportRouter"
        private const val MAX_SEEN_MESSAGE_CACHE = 10000
        private const val KIND_GIFT_WRAP = 1059
    }
}

/**
 * Represents an incoming message.
 */
data class IncomingMessage(
    val id: String,
    val senderPubkey: String,
    val content: String,
    val timestamp: Long,
    val transport: Transport
)

/**
 * Result of sending a message.
 */
data class SendResult(
    val messageId: String,
    val transport: Transport?,
    val status: DeliveryStatus
)

/**
 * Message delivery status.
 */
enum class DeliveryStatus {
    SENT,
    DELIVERED,
    READ,
    QUEUED,
    FAILED
}

/**
 * Available transports.
 */
enum class Transport {
    BLE,
    NOSTR
}

/**
 * Current status of all transports.
 */
data class TransportStatus(
    val bleAvailable: Boolean = false,
    val nostrAvailable: Boolean = false
) {
    val anyAvailable: Boolean get() = bleAvailable || nostrAvailable
    val allAvailable: Boolean get() = bleAvailable && nostrAvailable
}

/**
 * Transport-related exceptions.
 */
sealed class TransportException : Exception() {
    data class Unavailable(val transport: Transport) : TransportException()
    data class SendFailed(val transport: Transport) : TransportException()
}
