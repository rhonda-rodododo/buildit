package network.buildit.testutil

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.core.transport.DeliveryStatus
import network.buildit.core.transport.IncomingMessage
import network.buildit.core.transport.SendResult
import network.buildit.core.transport.Transport
import network.buildit.core.transport.TransportStatus
import java.util.UUID

/**
 * Fake implementation of TransportRouter for testing.
 *
 * Allows manual control of:
 * - Transport availability
 * - Incoming messages
 * - Send results
 */
class FakeTransportRouter {

    private val _incomingMessages = MutableSharedFlow<IncomingMessage>(extraBufferCapacity = 64)
    val incomingMessages: SharedFlow<IncomingMessage> = _incomingMessages.asSharedFlow()

    private val _transportStatus = MutableStateFlow(TransportStatus())
    val transportStatus: StateFlow<TransportStatus> = _transportStatus.asStateFlow()

    // Configuration for test behavior
    var sendMessageResult: Result<SendResult> = Result.success(
        SendResult(
            messageId = UUID.randomUUID().toString(),
            transport = Transport.NOSTR,
            status = DeliveryStatus.SENT
        )
    )

    // Track method calls for verification
    val sentMessages = mutableListOf<SentMessage>()
    val subscribedSenders = mutableListOf<String>()

    // ============== State Control ==============

    fun setTransportStatus(status: TransportStatus) {
        _transportStatus.value = status
    }

    fun setBleAvailable(available: Boolean) {
        _transportStatus.value = _transportStatus.value.copy(bleAvailable = available)
    }

    fun setNostrAvailable(available: Boolean) {
        _transportStatus.value = _transportStatus.value.copy(nostrAvailable = available)
    }

    suspend fun emitIncomingMessage(message: IncomingMessage) {
        _incomingMessages.emit(message)
    }

    // ============== TransportRouter-like Methods ==============

    suspend fun sendMessage(
        recipientPubkey: String,
        content: String,
        preferBle: Boolean = false
    ): Result<SendResult> {
        sentMessages.add(
            SentMessage(
                recipientPubkey = recipientPubkey,
                content = content,
                preferBle = preferBle
            )
        )
        return sendMessageResult
    }

    fun subscribeToSender(senderPubkey: String) {
        subscribedSenders.add(senderPubkey)
    }

    // ============== Test Helpers ==============

    fun clearSentMessages() {
        sentMessages.clear()
    }

    fun clearSubscribedSenders() {
        subscribedSenders.clear()
    }

    fun reset() {
        _transportStatus.value = TransportStatus()
        sendMessageResult = Result.success(
            SendResult(
                messageId = UUID.randomUUID().toString(),
                transport = Transport.NOSTR,
                status = DeliveryStatus.SENT
            )
        )
        sentMessages.clear()
        subscribedSenders.clear()
    }

    /**
     * Simulate a failed send that results in queuing.
     */
    fun simulateQueuedResult() {
        sendMessageResult = Result.success(
            SendResult(
                messageId = UUID.randomUUID().toString(),
                transport = null,
                status = DeliveryStatus.QUEUED
            )
        )
    }

    /**
     * Simulate a send failure.
     */
    fun simulateFailure(exception: Exception = Exception("Send failed")) {
        sendMessageResult = Result.failure(exception)
    }

    /**
     * Simulate a successful send via BLE.
     */
    fun simulateBleSend() {
        sendMessageResult = Result.success(
            SendResult(
                messageId = UUID.randomUUID().toString(),
                transport = Transport.BLE,
                status = DeliveryStatus.SENT
            )
        )
    }

    /**
     * Simulate a successful send via Nostr.
     */
    fun simulateNostrSend() {
        sendMessageResult = Result.success(
            SendResult(
                messageId = UUID.randomUUID().toString(),
                transport = Transport.NOSTR,
                status = DeliveryStatus.SENT
            )
        )
    }
}

/**
 * Data class representing a sent message for verification.
 */
data class SentMessage(
    val recipientPubkey: String,
    val content: String,
    val preferBle: Boolean
)
