package network.buildit.core.nostr

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Nostr protocol client for BuildIt.
 *
 * Implements:
 * - NIP-01: Basic protocol flow (events, subscriptions, publishing)
 * - NIP-04/NIP-44: Encrypted direct messages
 * - NIP-17: Private Direct Messages
 * - WebSocket connection management
 * - Event signing and verification
 *
 * Works with RelayPool to manage multiple relay connections.
 */
@Singleton
class NostrClient @Inject constructor(
    private val cryptoManager: CryptoManager,
    private val relayPool: RelayPool
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _events = MutableSharedFlow<NostrEvent>(
        extraBufferCapacity = 256,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<NostrEvent> = _events.asSharedFlow()

    private val _notices = MutableSharedFlow<NostrNotice>(extraBufferCapacity = 64)
    val notices: SharedFlow<NostrNotice> = _notices.asSharedFlow()

    /** Typing indicator events */
    private val _typingIndicators = MutableSharedFlow<TypingIndicator>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val typingIndicators: SharedFlow<TypingIndicator> = _typingIndicators.asSharedFlow()

    /** Read receipt events */
    private val _readReceipts = MutableSharedFlow<ReadReceipt>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val readReceipts: SharedFlow<ReadReceipt> = _readReceipts.asSharedFlow()

    /** Reaction events */
    private val _reactions = MutableSharedFlow<Reaction>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val reactions: SharedFlow<Reaction> = _reactions.asSharedFlow()

    /** Active subscriptions by ID */
    private val subscriptions = ConcurrentHashMap<String, Subscription>()

    /** Obfuscated subscriptions for privacy */
    private val obfuscatedSubscriptions = ConcurrentHashMap<String, ObfuscatedSubscription>()

    /** Subscription obfuscation configuration */
    @Volatile
    private var obfuscationConfig = SubscriptionObfuscationConfig()

    /** Pending event callbacks */
    private val pendingEvents = ConcurrentHashMap<String, (Boolean) -> Unit>()

    init {
        // Listen to relay pool events
        scope.launch {
            relayPool.messages.collect { message ->
                handleRelayMessage(message)
            }
        }

        // Track connection state
        scope.launch {
            relayPool.connectedRelays.collect { connectedCount ->
                _connectionState.value = when {
                    connectedCount == 0 -> ConnectionState.DISCONNECTED
                    connectedCount < relayPool.configuredRelays.size -> ConnectionState.PARTIALLY_CONNECTED
                    else -> ConnectionState.CONNECTED
                }
            }
        }
    }

    /**
     * Connects to the configured relays.
     */
    suspend fun connect() {
        _connectionState.value = ConnectionState.CONNECTING
        relayPool.connectAll()
    }

    /**
     * Disconnects from all relays.
     */
    suspend fun disconnect() {
        subscriptions.clear()
        relayPool.disconnectAll()
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    /**
     * Publishes an event to connected relays.
     *
     * @param event The event to publish
     * @return True if the event was accepted by at least one relay
     */
    suspend fun publishEvent(event: NostrEvent): Boolean {
        // Sign the event
        val signedEvent = signEvent(event) ?: return false

        // Track pending response
        var accepted = false
        pendingEvents[signedEvent.id] = { success ->
            accepted = success
        }

        // Send to relays
        val message = JSONArray().apply {
            put("EVENT")
            put(signedEvent.toJson())
        }.toString()

        relayPool.broadcast(message)

        // Wait briefly for OK responses
        kotlinx.coroutines.delay(2000)
        pendingEvents.remove(signedEvent.id)

        return accepted
    }

    /**
     * Subscribes to events matching the given filters with privacy obfuscation.
     *
     * When obfuscation is enabled, this method:
     * 1. Adds dummy pubkeys/event IDs to obscure real interests
     * 2. Distributes filter elements across relays (diffusion)
     * 3. Filters results locally to match original intent
     *
     * This prevents relays from learning the user's full social graph
     * through subscription pattern analysis.
     *
     * @param filters The filters to match events against
     * @return Subscription ID
     */
    fun subscribe(vararg filters: NostrFilter): String {
        val subscriptionId = UUID.randomUUID().toString().take(16)

        // If obfuscation is disabled, use simple subscription
        if (!obfuscationConfig.enabled) {
            return subscribeSimple(*filters)
        }

        val relayUrls = relayPool.configuredRelays.map { it.url }

        // Create obfuscated subscription
        val obfuscatedSub = ObfuscatedSubscription(
            publicId = subscriptionId,
            originalFilters = filters.toList(),
            callback = { event -> _events.emit(event) },
            relayCount = relayUrls.size
        )

        // Generate dummy data for obfuscation
        if (obfuscationConfig.dummySubscriptionsEnabled) {
            repeat(obfuscationConfig.dummyPubkeyCount) {
                obfuscatedSub.dummyPubkeys.add(generateRandomHex(64))
            }
            repeat(obfuscationConfig.dummyEventIdCount) {
                obfuscatedSub.dummyEventIds.add(generateRandomHex(64))
            }
        }

        // Create obfuscated filters for each relay
        val obfuscatedFiltersPerRelay = createObfuscatedFilters(
            originalFilters = filters.toList(),
            relayUrls = relayUrls,
            obfuscatedSub = obfuscatedSub
        )

        // Subscribe to each relay with its specific filter set
        relayUrls.forEachIndexed { index, relayUrl ->
            val relayFilters = obfuscatedFiltersPerRelay[index]
            if (relayFilters.isEmpty()) return@forEachIndexed

            val relaySubId = "${subscriptionId}_$index"
            obfuscatedSub.relaySubscriptions[relayUrl] = relaySubId

            val message = JSONArray().apply {
                put("REQ")
                put(relaySubId)
                relayFilters.forEach { put(it.toJson()) }
            }.toString()

            relayPool.sendTo(relayUrl, message)
        }

        obfuscatedSubscriptions[subscriptionId] = obfuscatedSub

        // Also store in regular subscriptions for compatibility
        val subscription = Subscription(
            id = subscriptionId,
            filters = filters.toList()
        )
        subscriptions[subscriptionId] = subscription

        return subscriptionId
    }

    /**
     * Simple subscription without obfuscation (internal use).
     */
    private fun subscribeSimple(vararg filters: NostrFilter): String {
        val subscriptionId = UUID.randomUUID().toString().take(16)

        val subscription = Subscription(
            id = subscriptionId,
            filters = filters.toList()
        )
        subscriptions[subscriptionId] = subscription

        val message = JSONArray().apply {
            put("REQ")
            put(subscriptionId)
            filters.forEach { put(it.toJson()) }
        }.toString()

        relayPool.broadcast(message)

        return subscriptionId
    }

    /**
     * Create obfuscated filters for each relay.
     */
    private fun createObfuscatedFilters(
        originalFilters: List<NostrFilter>,
        relayUrls: List<String>,
        obfuscatedSub: ObfuscatedSubscription
    ): List<List<NostrFilter>> {
        val result: MutableList<MutableList<NostrFilter>> =
            relayUrls.map { mutableListOf<NostrFilter>() }.toMutableList()

        for (filter in originalFilters) {
            when {
                !filter.authors.isNullOrEmpty() -> diffuseFilterField(
                    filter, result, relayUrls,
                    elements = filter.authors,
                    dummies = obfuscatedSub.dummyPubkeys,
                    copyWith = { filter.copy(authors = it) }
                )
                !filter.ids.isNullOrEmpty() -> diffuseFilterField(
                    filter, result, relayUrls,
                    elements = filter.ids,
                    dummies = obfuscatedSub.dummyEventIds,
                    copyWith = { filter.copy(ids = it) }
                )
                !filter.tags?.get("p").isNullOrEmpty() -> diffuseFilterField(
                    filter, result, relayUrls,
                    elements = filter.tags!!["p"]!!,
                    dummies = obfuscatedSub.dummyPubkeys,
                    copyWith = { diffused ->
                        val newTags = filter.tags.toMutableMap().apply { put("p", diffused) }
                        filter.copy(tags = newTags)
                    }
                )
                else -> relayUrls.indices.forEach { result[it].add(filter) }
            }
        }

        return result
    }

    /**
     * Add dummy elements and diffuse across relays, or broadcast to all.
     */
    private fun diffuseFilterField(
        filter: NostrFilter,
        result: MutableList<MutableList<NostrFilter>>,
        relayUrls: List<String>,
        elements: List<String>,
        dummies: Collection<String>,
        copyWith: (List<String>) -> NostrFilter
    ) {
        val withDummies = elements.toMutableList().apply {
            if (obfuscationConfig.dummySubscriptionsEnabled) addAll(dummies)
        }

        if (obfuscationConfig.filterDiffusionEnabled && relayUrls.size > 1) {
            distributeWithOverlap(
                elements = withDummies,
                bucketCount = relayUrls.size,
                ratio = obfuscationConfig.filterDiffusionRatio,
                minBucketsPerElement = obfuscationConfig.minRelaysPerElement
            ).forEachIndexed { i, bucket ->
                if (bucket.isNotEmpty()) result[i].add(copyWith(bucket))
            }
        } else {
            relayUrls.indices.forEach { result[it].add(copyWith(withDummies)) }
        }
    }

    /**
     * Distribute elements across buckets with overlap.
     */
    private fun <T> distributeWithOverlap(
        elements: List<T>,
        bucketCount: Int,
        ratio: Double,
        minBucketsPerElement: Int
    ): List<List<T>> {
        if (elements.isEmpty() || bucketCount == 0) {
            return List(bucketCount) { emptyList() }
        }

        val buckets: MutableList<MutableList<T>> = MutableList(bucketCount) { mutableListOf() }
        val elementBuckets: MutableMap<Int, MutableSet<Int>> = mutableMapOf()
        elements.indices.forEach { elementBuckets[it] = mutableSetOf() }

        val elementsPerBucket = kotlin.math.ceil(elements.size * ratio).toInt()

        // First pass: randomly assign elements to buckets
        for (bucketIdx in 0 until bucketCount) {
            val shuffled = elements.indices.toList().shuffled()
            val selected = shuffled.take(minOf(elementsPerBucket, elements.size))

            for (elementIdx in selected) {
                buckets[bucketIdx].add(elements[elementIdx])
                elementBuckets[elementIdx]?.add(bucketIdx)
            }
        }

        // Second pass: ensure minimum coverage
        elements.forEachIndexed { elementIdx, element ->
            val assignedBuckets = elementBuckets[elementIdx] ?: mutableSetOf()
            while (assignedBuckets.size < minOf(minBucketsPerElement, bucketCount)) {
                val availableBuckets = (0 until bucketCount).filter { !assignedBuckets.contains(it) }
                if (availableBuckets.isEmpty()) break

                val randomBucket = availableBuckets.random()
                buckets[randomBucket].add(element)
                assignedBuckets.add(randomBucket)
            }
        }

        return buckets
    }

    /**
     * Generate random hex string.
     */
    private fun generateRandomHex(length: Int): String {
        val bytes = ByteArray(length / 2)
        java.security.SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Check if event matches original filters (filtering out dummy data).
     */
    private fun eventMatchesOriginalFilters(
        event: NostrEvent,
        obfuscatedSub: ObfuscatedSubscription
    ): Boolean {
        // Check if from dummy pubkey
        if (obfuscatedSub.dummyPubkeys.contains(event.pubkey)) {
            return false
        }

        // Check if dummy event ID
        if (obfuscatedSub.dummyEventIds.contains(event.id)) {
            return false
        }

        // Check if matches any original filter
        for (filter in obfuscatedSub.originalFilters) {
            if (eventMatchesFilter(event, filter)) {
                return true
            }
        }

        return false
    }

    /**
     * Check if event matches a filter.
     */
    private fun eventMatchesFilter(event: NostrEvent, filter: NostrFilter): Boolean {
        if (!filter.ids.isNullOrEmpty() && !filter.ids.contains(event.id)) return false
        if (!filter.authors.isNullOrEmpty() && !filter.authors.contains(event.pubkey)) return false
        if (!filter.kinds.isNullOrEmpty() && !filter.kinds.contains(event.kind)) return false
        filter.since?.let { if (event.createdAt < it) return false }
        filter.until?.let { if (event.createdAt > it) return false }
        if (!eventMatchesTagFilter(event, filter, "p")) return false
        if (!eventMatchesTagFilter(event, filter, "e")) return false
        return true
    }

    private fun eventMatchesTagFilter(
        event: NostrEvent,
        filter: NostrFilter,
        tagKey: String
    ): Boolean {
        val filterTags = filter.tags?.get(tagKey)
        if (filterTags.isNullOrEmpty()) return true
        val eventTags = event.tags
            .filter { it.firstOrNull() == tagKey }
            .mapNotNull { it.getOrNull(1) }
        return filterTags.any { eventTags.contains(it) }
    }

    /**
     * Closes a subscription.
     */
    fun unsubscribe(subscriptionId: String) {
        // Clean up obfuscated subscription if it exists
        obfuscatedSubscriptions[subscriptionId]?.let { obfuscatedSub ->
            for ((relayUrl, relaySubId) in obfuscatedSub.relaySubscriptions) {
                val message = JSONArray().apply {
                    put("CLOSE")
                    put(relaySubId)
                }.toString()
                relayPool.sendTo(relayUrl, message)
            }
            obfuscatedSubscriptions.remove(subscriptionId)
        }

        subscriptions.remove(subscriptionId)

        val message = JSONArray().apply {
            put("CLOSE")
            put(subscriptionId)
        }.toString()

        relayPool.broadcast(message)
    }

    // MARK: - Obfuscation Configuration

    /**
     * Enable or disable subscription obfuscation.
     */
    fun setSubscriptionObfuscationEnabled(enabled: Boolean) {
        obfuscationConfig = obfuscationConfig.copy(enabled = enabled)
    }

    /**
     * Update subscription obfuscation configuration.
     */
    fun updateObfuscationConfig(config: SubscriptionObfuscationConfig) {
        obfuscationConfig = config
    }

    /**
     * Get current obfuscation configuration.
     */
    fun getObfuscationConfig(): SubscriptionObfuscationConfig = obfuscationConfig

    /**
     * Publishes a profile (Kind 0 - NIP-01).
     *
     * @param profile The profile data to publish
     * @return True if published successfully
     */
    suspend fun publishProfile(profile: NostrProfile): Boolean {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return false

        // Build profile content JSON
        val content = JSONObject().apply {
            profile.name?.let { put("name", it) }
            profile.displayName?.let { put("display_name", it) }
            profile.about?.let { put("about", it) }
            profile.picture?.let { put("picture", it) }
            profile.banner?.let { put("banner", it) }
            profile.nip05?.let { put("nip05", it) }
            profile.lud16?.let { put("lud16", it) }
            profile.website?.let { put("website", it) }
        }.toString()

        val event = NostrEvent(
            id = "",
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_SET_METADATA,
            tags = emptyList(),
            content = content,
            sig = ""
        )

        return publishEvent(event)
    }

    /**
     * Fetches a profile from relays.
     *
     * @param pubkey The public key to fetch profile for
     * @return The profile if found, null otherwise
     */
    suspend fun fetchProfile(pubkey: String): NostrProfile? {
        val filter = NostrFilter(
            authors = listOf(pubkey),
            kinds = listOf(KIND_SET_METADATA),
            limit = 1
        )

        val subscriptionId = subscribe(filter)

        // Wait for events
        var profile: NostrProfile? = null
        kotlinx.coroutines.withTimeoutOrNull(5000) {
            events.collect { event ->
                if (event.kind == KIND_SET_METADATA && event.pubkey == pubkey) {
                    profile = NostrProfile.fromJson(JSONObject(event.content))
                    return@collect
                }
            }
        }

        unsubscribe(subscriptionId)
        return profile
    }

    /**
     * Sends an encrypted direct message.
     *
     * @param recipientPubkey The recipient's public key (hex)
     * @param content The message content
     * @return True if sent successfully
     */
    suspend fun sendDirectMessage(recipientPubkey: String, content: String): Boolean {
        val senderPubkey = cryptoManager.getPublicKeyHex() ?: return false

        // Encrypt content using NIP-44 style encryption
        val encryptedContent = cryptoManager.encrypt(
            content.toByteArray(Charsets.UTF_8),
            recipientPubkey
        )?.let { bytes ->
            android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        } ?: return false

        val event = NostrEvent(
            id = "", // Will be computed when signing
            pubkey = senderPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_ENCRYPTED_DIRECT_MESSAGE,
            tags = listOf(listOf("p", recipientPubkey)),
            content = encryptedContent,
            sig = ""
        )

        return publishEvent(event)
    }

    /**
     * Sends a typing indicator to a recipient.
     *
     * @param recipientPubkey The recipient's public key (hex)
     * @param conversationId The conversation ID (optional, for group context)
     * @return True if sent successfully
     */
    suspend fun sendTypingIndicator(recipientPubkey: String, conversationId: String? = null): Boolean {
        val senderPubkey = cryptoManager.getPublicKeyHex() ?: return false

        val tags = mutableListOf(listOf("p", recipientPubkey))
        conversationId?.let { tags.add(listOf("e", it)) }

        val event = NostrEvent(
            id = "",
            pubkey = senderPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_TYPING_INDICATOR,
            tags = tags,
            content = "",
            sig = ""
        )

        return publishEvent(event)
    }

    /**
     * Subscribes to typing indicators from a specific user.
     *
     * @param pubkey The public key to watch for typing indicators
     * @return Subscription ID
     */
    fun subscribeToTypingIndicators(pubkey: String): String {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return ""

        val filter = NostrFilter(
            authors = listOf(pubkey),
            kinds = listOf(KIND_TYPING_INDICATOR),
            tags = mapOf("p" to listOf(ourPubkey)),
            since = System.currentTimeMillis() / 1000 - 60 // Last minute only
        )

        return subscribe(filter)
    }

    /**
     * Sends a read receipt for a message.
     *
     * @param messageId The ID of the message that was read
     * @param senderPubkey The public key of the message sender
     * @return True if sent successfully
     */
    suspend fun sendReadReceipt(messageId: String, senderPubkey: String): Boolean {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return false

        val event = NostrEvent(
            id = "",
            pubkey = ourPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_READ_RECEIPT,
            tags = listOf(
                listOf("p", senderPubkey),
                listOf("e", messageId)
            ),
            content = "",
            sig = ""
        )

        return publishEvent(event)
    }

    /**
     * Subscribes to read receipts for messages we've sent.
     *
     * @return Subscription ID
     */
    fun subscribeToReadReceipts(): String {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return ""

        val filter = NostrFilter(
            kinds = listOf(KIND_READ_RECEIPT),
            tags = mapOf("p" to listOf(ourPubkey)),
            since = System.currentTimeMillis() / 1000 - 86400 // Last 24 hours
        )

        return subscribe(filter)
    }

    /**
     * Sends a reaction to a message (NIP-25).
     *
     * @param messageId The ID of the message to react to
     * @param messagePubkey The public key of the message author
     * @param emoji The reaction emoji (e.g., "+", "-", "👍", "❤️")
     * @return True if sent successfully
     */
    suspend fun sendReaction(messageId: String, messagePubkey: String, emoji: String): Boolean {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return false

        val event = NostrEvent(
            id = "",
            pubkey = ourPubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_REACTION,
            tags = listOf(
                listOf("e", messageId),
                listOf("p", messagePubkey)
            ),
            content = emoji,
            sig = ""
        )

        return publishEvent(event)
    }

    /**
     * Subscribes to reactions for messages in a conversation.
     *
     * @param messageIds The IDs of messages to watch for reactions
     * @return Subscription ID
     */
    fun subscribeToReactions(messageIds: List<String>): String {
        if (messageIds.isEmpty()) return ""

        val filter = NostrFilter(
            kinds = listOf(KIND_REACTION),
            tags = mapOf("e" to messageIds),
            since = System.currentTimeMillis() / 1000 - 604800 // Last 7 days
        )

        return subscribe(filter)
    }

    /**
     * Handles incoming relay messages.
     */
    private suspend fun handleRelayMessage(message: RelayMessage) {
        when (message) {
            is RelayMessage.Event -> handleIncomingEvent(message)
            is RelayMessage.Ok -> pendingEvents[message.eventId]?.invoke(message.accepted)
            is RelayMessage.Notice -> _notices.emit(NostrNotice(message.relayUrl, message.message))
            is RelayMessage.Eose -> { /* End of stored events */ }
            is RelayMessage.Closed -> subscriptions.remove(message.subscriptionId)
        }
    }

    private suspend fun handleIncomingEvent(message: RelayMessage.Event) {
        val event = message.event
        if (!verifyEvent(event)) return

        val publicSubId = message.subscriptionId.substringBefore("_")
        val obfuscatedSub = obfuscatedSubscriptions[publicSubId]
        if (obfuscatedSub != null && !eventMatchesOriginalFilters(event, obfuscatedSub)) return

        _events.emit(event)
        emitEventKindSignals(event)
    }

    private suspend fun emitEventKindSignals(event: NostrEvent) {
        val referencedEventId = event.tags
            .find { it.firstOrNull() == "e" }?.getOrNull(1)

        when (event.kind) {
            KIND_TYPING_INDICATOR -> _typingIndicators.emit(
                TypingIndicator(
                    pubkey = event.pubkey,
                    conversationId = referencedEventId,
                    timestamp = event.createdAt
                )
            )
            KIND_READ_RECEIPT -> referencedEventId?.let {
                _readReceipts.emit(
                    ReadReceipt(messageId = it, readerPubkey = event.pubkey, timestamp = event.createdAt)
                )
            }
            KIND_REACTION -> referencedEventId?.let {
                _reactions.emit(
                    Reaction(
                        id = event.id, messageId = it,
                        emoji = event.content.ifEmpty { "+" },
                        reactorPubkey = event.pubkey, timestamp = event.createdAt
                    )
                )
            }
        }
    }

    /**
     * Signs an event using the identity key.
     */
    private suspend fun signEvent(event: NostrEvent): NostrEvent? {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return null

        // Compute event ID (sha256 of serialized event)
        val serialized = JSONArray().apply {
            put(0) // Reserved
            put(pubkey)
            put(event.createdAt)
            put(event.kind)
            put(JSONArray(event.tags.map { JSONArray(it) }))
            put(event.content)
        }.toString()

        val id = cryptoManager.sha256(serialized.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

        // Sign the ID
        val signature = cryptoManager.sign(id.toByteArray(Charsets.UTF_8))
            ?.joinToString("") { "%02x".format(it) }
            ?: return null

        return event.copy(
            id = id,
            pubkey = pubkey,
            sig = signature
        )
    }

    /**
     * Verifies an event's signature.
     */
    private suspend fun verifyEvent(event: NostrEvent): Boolean {
        // Compute expected ID
        val serialized = JSONArray().apply {
            put(0)
            put(event.pubkey)
            put(event.createdAt)
            put(event.kind)
            put(JSONArray(event.tags.map { JSONArray(it) }))
            put(event.content)
        }.toString()

        val expectedId = cryptoManager.sha256(serialized.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

        if (expectedId != event.id) return false

        // Verify signature
        return cryptoManager.verify(
            event.id.toByteArray(Charsets.UTF_8),
            event.sig.chunked(2).map { it.toInt(16).toByte() }.toByteArray(),
            event.pubkey
        )
    }

    companion object {
        const val KIND_SET_METADATA = 0
        const val KIND_TEXT_NOTE = 1
        const val KIND_RECOMMEND_SERVER = 2
        const val KIND_CONTACTS = 3
        const val KIND_ENCRYPTED_DIRECT_MESSAGE = 4
        const val KIND_DELETE = 5
        const val KIND_REPOST = 6
        const val KIND_REACTION = 7
        const val KIND_CHANNEL_CREATE = 40
        const val KIND_CHANNEL_METADATA = 41
        const val KIND_CHANNEL_MESSAGE = 42
        const val KIND_PRIVATE_DIRECT_MESSAGE = 14 // NIP-17
        const val KIND_GROUP_METADATA = 41 // Same as channel metadata (NIP-28)
        const val KIND_TYPING_INDICATOR = 25 // Typing indicators (ephemeral)
        const val KIND_READ_RECEIPT = 15 // Read receipts
    }
}

/**
 * Represents a Nostr event.
 */
data class NostrEvent(
    val id: String,
    val pubkey: String,
    val createdAt: Long,
    val kind: Int,
    val tags: List<List<String>>,
    val content: String,
    val sig: String
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("pubkey", pubkey)
        put("created_at", createdAt)
        put("kind", kind)
        put("tags", JSONArray(tags.map { JSONArray(it) }))
        put("content", content)
        put("sig", sig)
    }

    companion object {
        fun fromJson(json: JSONObject): NostrEvent {
            val tagsArray = json.getJSONArray("tags")
            val tags = mutableListOf<List<String>>()
            for (i in 0 until tagsArray.length()) {
                val tagArray = tagsArray.getJSONArray(i)
                val tag = mutableListOf<String>()
                for (j in 0 until tagArray.length()) {
                    tag.add(tagArray.getString(j))
                }
                tags.add(tag)
            }

            return NostrEvent(
                id = json.getString("id"),
                pubkey = json.getString("pubkey"),
                createdAt = json.getLong("created_at"),
                kind = json.getInt("kind"),
                tags = tags,
                content = json.getString("content"),
                sig = json.getString("sig")
            )
        }
    }
}

/**
 * Represents a Nostr event filter.
 */
data class NostrFilter(
    val ids: List<String>? = null,
    val authors: List<String>? = null,
    val kinds: List<Int>? = null,
    val tags: Map<String, List<String>>? = null,
    val since: Long? = null,
    val until: Long? = null,
    val limit: Int? = null
) {
    fun toJson(): JSONObject = JSONObject().apply {
        ids?.let { put("ids", JSONArray(it)) }
        authors?.let { put("authors", JSONArray(it)) }
        kinds?.let { put("kinds", JSONArray(it)) }
        tags?.forEach { (key, values) ->
            put("#$key", JSONArray(values))
        }
        since?.let { put("since", it) }
        until?.let { put("until", it) }
        limit?.let { put("limit", it) }
    }
}

/**
 * Represents a subscription.
 */
data class Subscription(
    val id: String,
    val filters: List<NostrFilter>
)

/**
 * Configuration for subscription filter obfuscation.
 * Protects against social graph analysis via subscription patterns.
 */
data class SubscriptionObfuscationConfig(
    /** Enable subscription obfuscation */
    val enabled: Boolean = true,
    /** Use broad filters and filter locally */
    val broadFilteringEnabled: Boolean = true,
    /** Send different filter subsets to different relays */
    val filterDiffusionEnabled: Boolean = true,
    /** Add dummy subscriptions to obscure real interests */
    val dummySubscriptionsEnabled: Boolean = true,
    /** Number of dummy pubkeys to add to author filters */
    val dummyPubkeyCount: Int = 5,
    /** Number of dummy event IDs to add to ID filters */
    val dummyEventIdCount: Int = 3,
    /** Percentage of real filter elements to send per relay */
    val filterDiffusionRatio: Double = 0.6,
    /** Minimum relays to receive each real filter element */
    val minRelaysPerElement: Int = 2
)

/**
 * Obfuscated subscription tracking for privacy.
 */
data class ObfuscatedSubscription(
    val publicId: String,
    val originalFilters: List<NostrFilter>,
    val relaySubscriptions: MutableMap<String, String> = mutableMapOf(),
    val dummyPubkeys: MutableSet<String> = mutableSetOf(),
    val dummyEventIds: MutableSet<String> = mutableSetOf(),
    val callback: suspend (NostrEvent) -> Unit,
    var eoseCount: Int = 0,
    var relayCount: Int = 0
)

/**
 * Connection state for the Nostr client.
 */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    PARTIALLY_CONNECTED
}

/**
 * Represents a notice from a relay.
 */
data class NostrNotice(
    val relayUrl: String,
    val message: String
)

/**
 * Represents a Nostr profile (NIP-01 Kind 0 metadata).
 */
data class NostrProfile(
    val name: String? = null,
    val displayName: String? = null,
    val about: String? = null,
    val picture: String? = null,
    val banner: String? = null,
    val nip05: String? = null,
    val lud16: String? = null,
    val website: String? = null
) {
    companion object {
        fun fromJson(json: JSONObject): NostrProfile {
            return NostrProfile(
                name = json.optString("name").takeIf { it.isNotEmpty() },
                displayName = json.optString("display_name").takeIf { it.isNotEmpty() },
                about = json.optString("about").takeIf { it.isNotEmpty() },
                picture = json.optString("picture").takeIf { it.isNotEmpty() },
                banner = json.optString("banner").takeIf { it.isNotEmpty() },
                nip05 = json.optString("nip05").takeIf { it.isNotEmpty() },
                lud16 = json.optString("lud16").takeIf { it.isNotEmpty() },
                website = json.optString("website").takeIf { it.isNotEmpty() }
            )
        }
    }
}

/**
 * Represents a typing indicator event.
 */
data class TypingIndicator(
    val pubkey: String,
    val conversationId: String?,
    val timestamp: Long
) {
    /**
     * Returns true if this typing indicator is still active (within last 5 seconds).
     */
    fun isActive(): Boolean {
        val now = System.currentTimeMillis() / 1000
        return now - timestamp < 5
    }
}

/**
 * Represents a read receipt event.
 */
data class ReadReceipt(
    val messageId: String,
    val readerPubkey: String,
    val timestamp: Long
)

/**
 * Represents a reaction to a message (NIP-25).
 */
data class Reaction(
    val id: String,
    val messageId: String,
    val emoji: String,
    val reactorPubkey: String,
    val timestamp: Long
)
