package network.buildit.testutil

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.core.nostr.ConnectionState
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.nostr.NostrNotice

/**
 * Fake implementation of NostrClient for testing.
 *
 * This is a standalone fake that mimics NostrClient behavior
 * without requiring inheritance from the final class.
 *
 * Allows manual control of:
 * - Connection state
 * - Incoming events
 * - Notices
 * - Subscription management
 * - Message sending results
 */
class FakeNostrClient {

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _events = MutableSharedFlow<NostrEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<NostrEvent> = _events.asSharedFlow()

    private val _notices = MutableSharedFlow<NostrNotice>(extraBufferCapacity = 16)
    val notices: SharedFlow<NostrNotice> = _notices.asSharedFlow()

    private val subscriptions = mutableMapOf<String, List<NostrFilter>>()
    private var subscriptionIdCounter = 0

    // Configuration for test behavior
    var sendDirectMessageResult: Boolean = true
    var publishEventResult: Boolean = true

    // Track method calls for verification
    val sentDirectMessages = mutableListOf<Pair<String, String>>() // (recipientPubkey, content)
    val publishedEvents = mutableListOf<NostrEvent>()
    val closedSubscriptions = mutableListOf<String>()

    // ============== State Control ==============

    fun setConnectionState(state: ConnectionState) {
        _connectionState.value = state
    }

    suspend fun emitEvent(event: NostrEvent) {
        _events.emit(event)
    }

    suspend fun emitNotice(notice: NostrNotice) {
        _notices.emit(notice)
    }

    // ============== NostrClient-like Implementation ==============

    suspend fun connect() {
        _connectionState.value = ConnectionState.CONNECTING
        // Simulate connection
        _connectionState.value = ConnectionState.CONNECTED
    }

    suspend fun disconnect() {
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    fun subscribe(filter: NostrFilter): String {
        return subscribe(listOf(filter))
    }

    fun subscribe(filters: List<NostrFilter>): String {
        val subscriptionId = "sub-${++subscriptionIdCounter}"
        subscriptions[subscriptionId] = filters
        return subscriptionId
    }

    fun unsubscribe(subscriptionId: String) {
        subscriptions.remove(subscriptionId)
        closedSubscriptions.add(subscriptionId)
    }

    suspend fun publishEvent(event: NostrEvent): Boolean {
        publishedEvents.add(event)
        return publishEventResult
    }

    suspend fun sendDirectMessage(recipientPubkey: String, content: String): Boolean {
        sentDirectMessages.add(recipientPubkey to content)
        return sendDirectMessageResult
    }

    // ============== Test Helpers ==============

    fun getActiveSubscriptions(): Map<String, List<NostrFilter>> {
        return subscriptions.toMap()
    }

    fun clearSentMessages() {
        sentDirectMessages.clear()
    }

    fun clearPublishedEvents() {
        publishedEvents.clear()
    }

    fun clearClosedSubscriptions() {
        closedSubscriptions.clear()
    }

    fun reset() {
        _connectionState.value = ConnectionState.DISCONNECTED
        subscriptions.clear()
        subscriptionIdCounter = 0
        sendDirectMessageResult = true
        publishEventResult = true
        sentDirectMessages.clear()
        publishedEvents.clear()
        closedSubscriptions.clear()
    }

    companion object {
        // Kind constants for tests
        const val KIND_SET_METADATA = 0
        const val KIND_TEXT_NOTE = 1
        const val KIND_ENCRYPTED_DIRECT_MESSAGE = 4
        const val KIND_PRIVATE_DIRECT_MESSAGE = 14
    }
}
