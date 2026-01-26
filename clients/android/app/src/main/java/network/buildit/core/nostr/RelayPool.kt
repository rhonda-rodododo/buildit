package network.buildit.core.nostr

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages connections to multiple Nostr relays with certificate pinning.
 *
 * Features:
 * - Concurrent connections to multiple relays
 * - Automatic reconnection with exponential backoff
 * - Health monitoring and relay scoring
 * - Message deduplication
 * - Read/Write relay policies
 * - Certificate pinning for MITM protection (mandatory)
 */
@Singleton
class RelayPool @Inject constructor(
    private val pinStore: CertificatePinStore
) {
    companion object {
        private const val TAG = "RelayPool"
        private const val INITIAL_BACKOFF_MS = 1000L
        private const val MAX_BACKOFF_MS = 60000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** OkHttpClient with certificate pinning enabled */
    private val httpClient: OkHttpClient by lazy {
        pinStore.buildPinnedOkHttpClient(
            OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .pingInterval(30, TimeUnit.SECONDS)
        )
    }

    /** Callback for certificate pinning events */
    var certificatePinningCallback: CertificatePinningCallback? = null

    private val _messages = MutableSharedFlow<RelayMessage>(extraBufferCapacity = 256)
    val messages: SharedFlow<RelayMessage> = _messages.asSharedFlow()

    private val _connectedRelays = MutableStateFlow(0)
    val connectedRelays: StateFlow<Int> = _connectedRelays.asStateFlow()

    /** Configured relays */
    private val _configuredRelays = mutableListOf<RelayConfig>()
    val configuredRelays: List<RelayConfig> get() = _configuredRelays.toList()

    /** Active WebSocket connections */
    private val connections = ConcurrentHashMap<String, RelayConnection>()

    /** Seen event IDs for deduplication */
    private val seenEventIds = ConcurrentHashMap.newKeySet<String>()

    init {
        // Add default relays
        addRelay(RelayConfig("wss://relay.damus.io", read = true, write = true))
        addRelay(RelayConfig("wss://nos.lol", read = true, write = true))
        addRelay(RelayConfig("wss://relay.nostr.band", read = true, write = false))
    }

    /**
     * Adds a relay to the pool.
     */
    fun addRelay(config: RelayConfig) {
        if (_configuredRelays.none { it.url == config.url }) {
            _configuredRelays.add(config)
        }
    }

    /**
     * Removes a relay from the pool.
     */
    fun removeRelay(url: String) {
        _configuredRelays.removeIf { it.url == url }
        connections[url]?.disconnect()
        connections.remove(url)
        updateConnectedCount()
    }

    /**
     * Connects to all configured relays.
     */
    fun connectAll() {
        _configuredRelays.forEach { config ->
            if (!connections.containsKey(config.url)) {
                connect(config)
            }
        }
    }

    /**
     * Disconnects from all relays.
     */
    fun disconnectAll() {
        connections.values.forEach { it.disconnect() }
        connections.clear()
        updateConnectedCount()
    }

    /**
     * Connects to a specific relay.
     */
    private fun connect(config: RelayConfig) {
        val connection = RelayConnection(
            config = config,
            httpClient = httpClient,
            onMessage = { message -> handleMessage(config.url, message) },
            onConnected = { updateConnectedCount() },
            onDisconnected = {
                updateConnectedCount()
                // Schedule reconnect
                scheduleReconnect(config)
            }
        )

        connections[config.url] = connection
        connection.connect()
    }

    /**
     * Schedules a reconnection attempt with exponential backoff.
     */
    private fun scheduleReconnect(config: RelayConfig) {
        val connection = connections[config.url] ?: return

        scope.launch {
            val backoff = minOf(
                INITIAL_BACKOFF_MS * (1 shl connection.reconnectAttempts),
                MAX_BACKOFF_MS
            )
            delay(backoff)

            if (isActive && _configuredRelays.any { it.url == config.url }) {
                connection.reconnectAttempts++
                connection.connect()
            }
        }
    }

    /**
     * Broadcasts a message to all connected write relays.
     */
    fun broadcast(message: String) {
        connections.forEach { (url, connection) ->
            val config = _configuredRelays.find { it.url == url }
            if (config?.write == true && connection.isConnected) {
                connection.send(message)
            }
        }
    }

    /**
     * Sends a message to a specific relay.
     */
    fun sendTo(url: String, message: String) {
        connections[url]?.send(message)
    }

    /**
     * Handles an incoming message from a relay.
     */
    private fun handleMessage(relayUrl: String, message: String) {
        scope.launch {
            try {
                val json = JSONArray(message)
                val type = json.getString(0)

                val relayMessage = when (type) {
                    "EVENT" -> {
                        val subscriptionId = json.getString(1)
                        val eventJson = json.getJSONObject(2)
                        val event = NostrEvent.fromJson(eventJson)

                        // Deduplicate events
                        if (seenEventIds.add(event.id)) {
                            RelayMessage.Event(relayUrl, subscriptionId, event)
                        } else {
                            null // Already seen
                        }
                    }
                    "OK" -> {
                        RelayMessage.Ok(
                            relayUrl = relayUrl,
                            eventId = json.getString(1),
                            accepted = json.getBoolean(2),
                            message = json.optString(3, "")
                        )
                    }
                    "EOSE" -> {
                        RelayMessage.Eose(
                            relayUrl = relayUrl,
                            subscriptionId = json.getString(1)
                        )
                    }
                    "NOTICE" -> {
                        RelayMessage.Notice(
                            relayUrl = relayUrl,
                            message = json.getString(1)
                        )
                    }
                    "CLOSED" -> {
                        RelayMessage.Closed(
                            relayUrl = relayUrl,
                            subscriptionId = json.getString(1),
                            message = json.optString(2, "")
                        )
                    }
                    else -> null
                }

                relayMessage?.let { _messages.emit(it) }
            } catch (e: Exception) {
                // Invalid message format
            }
        }
    }

    /**
     * Updates the connected relay count.
     */
    private fun updateConnectedCount() {
        _connectedRelays.value = connections.values.count { it.isConnected }
    }

    /**
     * Clears the seen events cache.
     */
    fun clearSeenEvents() {
        seenEventIds.clear()
    }

    /**
     * Check if a relay has a pinned certificate.
     */
    fun isRelayPinned(url: String): Boolean {
        return pinStore.isPinned(url)
    }

    /**
     * Clear TOFU pin for a relay (use when certificate rotates legitimately).
     */
    fun clearTofuPin(url: String) {
        pinStore.clearTofuPin(url)
        Log.i(TAG, "Cleared TOFU pin for $url")
    }

    /**
     * Get the certificate pin store.
     */
    val certificatePinStore: CertificatePinStore
        get() = pinStore
}

/**
 * Configuration for a relay.
 */
data class RelayConfig(
    val url: String,
    val read: Boolean = true,
    val write: Boolean = true
)

/**
 * Manages a single relay WebSocket connection.
 */
class RelayConnection(
    private val config: RelayConfig,
    private val httpClient: OkHttpClient,
    private val onMessage: (String) -> Unit,
    private val onConnected: () -> Unit,
    private val onDisconnected: () -> Unit
) {
    private var webSocket: WebSocket? = null
    var isConnected: Boolean = false
        private set
    var reconnectAttempts: Int = 0

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            isConnected = true
            reconnectAttempts = 0
            onConnected()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            onMessage(text)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            isConnected = false
            onDisconnected()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            isConnected = false
            onDisconnected()
        }
    }

    fun connect() {
        if (isConnected) return

        val request = Request.Builder()
            .url(config.url)
            .build()

        webSocket = httpClient.newWebSocket(request, listener)
    }

    fun disconnect() {
        webSocket?.close(1000, "Client closing")
        webSocket = null
        isConnected = false
    }

    fun send(message: String): Boolean {
        return webSocket?.send(message) ?: false
    }
}

/**
 * Messages received from relays.
 */
sealed class RelayMessage {
    abstract val relayUrl: String

    data class Event(
        override val relayUrl: String,
        val subscriptionId: String,
        val event: NostrEvent
    ) : RelayMessage()

    data class Ok(
        override val relayUrl: String,
        val eventId: String,
        val accepted: Boolean,
        val message: String
    ) : RelayMessage()

    data class Eose(
        override val relayUrl: String,
        val subscriptionId: String
    ) : RelayMessage()

    data class Notice(
        override val relayUrl: String,
        val message: String
    ) : RelayMessage()

    data class Closed(
        override val relayUrl: String,
        val subscriptionId: String,
        val message: String
    ) : RelayMessage()
}
