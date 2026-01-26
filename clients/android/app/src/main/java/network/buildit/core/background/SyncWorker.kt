package network.buildit.core.background

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.notifications.GovernanceNotificationType
import network.buildit.core.notifications.MutualAidNotificationType
import network.buildit.core.notifications.NotificationService
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.modules.events.data.EventsRepository
import network.buildit.modules.governance.data.GovernanceRepository
import network.buildit.modules.messaging.data.MessagingRepository
import network.buildit.modules.mutualaid.data.MutualAidRepository
import java.util.concurrent.TimeUnit

/**
 * Background worker for syncing data from Nostr relays.
 *
 * Runs periodically to:
 * - Fetch new messages from relays
 * - Check for event updates
 * - Fetch governance proposals
 * - Check mutual aid requests
 * - Create notifications for new content
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager,
    private val notificationService: NotificationService,
    private val messagingRepository: MessagingRepository,
    private val eventsRepository: EventsRepository,
    private val governanceRepository: GovernanceRepository,
    private val mutualAidRepository: MutualAidRepository
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "sync_worker"
        private const val SYNC_INTERVAL_MINUTES = 15L
        private const val SYNC_TIMEOUT_MS = 30_000L

        /**
         * Schedules the periodic sync worker.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                SYNC_INTERVAL_MINUTES,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    1,
                    TimeUnit.MINUTES
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
        }

        /**
         * Cancels the periodic sync worker.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // Connect to relays if not connected
            nostrClient.connect()

            // Wait for connection
            withTimeoutOrNull(5000) {
                while (nostrClient.connectionState.first().name == "DISCONNECTED") {
                    kotlinx.coroutines.delay(100)
                }
            }

            // Get our public key
            val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@withContext Result.failure()

            // Sync all content types
            val syncResults = listOf(
                syncMessages(ourPubkey),
                syncEvents(ourPubkey),
                syncGovernance(ourPubkey),
                syncMutualAid(ourPubkey)
            )

            // Disconnect after sync
            nostrClient.disconnect()

            // Return success if at least one sync succeeded
            if (syncResults.any { it }) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            // Retry on failure
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }

    /**
     * Syncs direct messages and group messages.
     */
    private suspend fun syncMessages(ourPubkey: String): Boolean {
        return try {
            // Get timestamp of last sync (use last 24 hours if not available)
            val lastSyncTime = getLastSyncTime("messages")
            val since = lastSyncTime ?: (System.currentTimeMillis() / 1000 - 86400)

            // Subscribe to DMs addressed to us
            val dmFilter = NostrFilter(
                kinds = listOf(
                    NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE,
                    NostrClient.KIND_PRIVATE_DIRECT_MESSAGE
                ),
                tags = mapOf("p" to listOf(ourPubkey)),
                since = since
            )

            val subscriptionId = nostrClient.subscribe(dmFilter)

            // Collect events with timeout
            val newMessages = mutableListOf<NostrEvent>()
            withTimeoutOrNull(SYNC_TIMEOUT_MS) {
                nostrClient.events.collect { event ->
                    if (event.kind == NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE ||
                        event.kind == NostrClient.KIND_PRIVATE_DIRECT_MESSAGE
                    ) {
                        // Check if we already have this message
                        val existing = messagingRepository.getMetadata(event.id)
                        if (existing == null) {
                            newMessages.add(event)
                        }
                    }
                }
            }

            nostrClient.unsubscribe(subscriptionId)

            // Create notifications for new messages
            for (event in newMessages) {
                createMessageNotification(event)
            }

            // Update last sync time
            saveLastSyncTime("messages")

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Syncs events (calendar events, meetups, etc.).
     */
    private suspend fun syncEvents(ourPubkey: String): Boolean {
        return try {
            val lastSyncTime = getLastSyncTime("events")
            val since = lastSyncTime ?: (System.currentTimeMillis() / 1000 - 604800) // 7 days

            // Subscribe to events we're tagged in or from authors we follow
            val eventFilter = NostrFilter(
                kinds = listOf(31922, 31923), // Calendar event kinds
                tags = mapOf("p" to listOf(ourPubkey)),
                since = since
            )

            val subscriptionId = nostrClient.subscribe(eventFilter)

            val newEvents = mutableListOf<NostrEvent>()
            withTimeoutOrNull(SYNC_TIMEOUT_MS) {
                nostrClient.events.collect { event ->
                    if (event.kind == 31922 || event.kind == 31923) {
                        newEvents.add(event)
                    }
                }
            }

            nostrClient.unsubscribe(subscriptionId)

            // Create notifications for new events
            for (event in newEvents) {
                createEventNotification(event)
            }

            saveLastSyncTime("events")

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Syncs governance proposals and votes.
     */
    private suspend fun syncGovernance(ourPubkey: String): Boolean {
        return try {
            val lastSyncTime = getLastSyncTime("governance")
            val since = lastSyncTime ?: (System.currentTimeMillis() / 1000 - 604800)

            // Subscribe to governance proposals
            val govFilter = NostrFilter(
                kinds = listOf(32001, 32002), // Custom kinds for proposals/votes
                tags = mapOf("p" to listOf(ourPubkey)),
                since = since
            )

            val subscriptionId = nostrClient.subscribe(govFilter)

            val newProposals = mutableListOf<NostrEvent>()
            withTimeoutOrNull(SYNC_TIMEOUT_MS) {
                nostrClient.events.collect { event ->
                    if (event.kind == 32001 || event.kind == 32002) {
                        newProposals.add(event)
                    }
                }
            }

            nostrClient.unsubscribe(subscriptionId)

            // Create notifications for new proposals
            for (event in newProposals) {
                createGovernanceNotification(event)
            }

            saveLastSyncTime("governance")

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Syncs mutual aid requests and offers.
     */
    private suspend fun syncMutualAid(ourPubkey: String): Boolean {
        return try {
            val lastSyncTime = getLastSyncTime("mutual_aid")
            val since = lastSyncTime ?: (System.currentTimeMillis() / 1000 - 604800)

            // Subscribe to mutual aid events
            val aidFilter = NostrFilter(
                kinds = listOf(33001, 33002), // Custom kinds for requests/offers
                tags = mapOf("p" to listOf(ourPubkey)),
                since = since
            )

            val subscriptionId = nostrClient.subscribe(aidFilter)

            val newRequests = mutableListOf<NostrEvent>()
            withTimeoutOrNull(SYNC_TIMEOUT_MS) {
                nostrClient.events.collect { event ->
                    if (event.kind == 33001 || event.kind == 33002) {
                        newRequests.add(event)
                    }
                }
            }

            nostrClient.unsubscribe(subscriptionId)

            // Create notifications for new requests
            for (event in newRequests) {
                createMutualAidNotification(event)
            }

            saveLastSyncTime("mutual_aid")

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Creates a notification for a new message.
     */
    private suspend fun createMessageNotification(event: NostrEvent) {
        // Get sender profile
        val senderProfile = nostrClient.fetchProfile(event.pubkey)
        val senderName = senderProfile?.displayName
            ?: senderProfile?.name
            ?: event.pubkey.take(8) + "..."

        // Decrypt content if encrypted
        val content = try {
            val decrypted = cryptoManager.decrypt(
                android.util.Base64.decode(event.content, android.util.Base64.NO_WRAP),
                event.pubkey
            )
            decrypted?.toString(Charsets.UTF_8) ?: event.content
        } catch (e: Exception) {
            "Encrypted message"
        }

        // Determine conversation ID
        val conversationId = "dm_${event.pubkey}"

        notificationService.showMessageNotification(
            conversationId = conversationId,
            messageId = event.id,
            senderName = senderName,
            senderPubkey = event.pubkey,
            content = content,
            timestamp = event.createdAt * 1000
        )
    }

    /**
     * Creates a notification for a new event.
     */
    private suspend fun createEventNotification(event: NostrEvent) {
        try {
            val json = org.json.JSONObject(event.content)
            val title = json.optString("title", "New Event")
            val description = json.optString("description", "")
            val start = json.optLong("start", 0)

            val eventTime = if (start > 0) {
                java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.getDefault())
                    .format(java.util.Date(start * 1000))
            } else {
                ""
            }

            notificationService.showEventNotification(
                eventId = event.id,
                title = title,
                description = description,
                eventTime = eventTime,
                location = json.optString("location", null)
            )
        } catch (e: Exception) {
            // Skip malformed events
        }
    }

    /**
     * Creates a notification for a governance proposal.
     */
    private suspend fun createGovernanceNotification(event: NostrEvent) {
        try {
            val json = org.json.JSONObject(event.content)
            val title = json.optString("title", "New Proposal")
            val description = json.optString("description", "")
            val deadline = json.optString("deadline", null)

            val type = when (event.kind) {
                32001 -> GovernanceNotificationType.NEW_PROPOSAL
                32002 -> GovernanceNotificationType.RESULT
                else -> GovernanceNotificationType.NEW_PROPOSAL
            }

            notificationService.showGovernanceNotification(
                proposalId = event.id,
                title = title,
                description = description,
                deadline = deadline,
                proposalType = type
            )
        } catch (e: Exception) {
            // Skip malformed events
        }
    }

    /**
     * Creates a notification for a mutual aid request/offer.
     */
    private suspend fun createMutualAidNotification(event: NostrEvent) {
        try {
            val json = org.json.JSONObject(event.content)
            val title = json.optString("title", "Mutual Aid")
            val description = json.optString("description", "")
            val urgent = json.optBoolean("urgent", false)

            val type = when (event.kind) {
                33001 -> MutualAidNotificationType.REQUEST
                33002 -> MutualAidNotificationType.OFFER
                else -> MutualAidNotificationType.REQUEST
            }

            notificationService.showMutualAidNotification(
                requestId = event.id,
                title = title,
                description = description,
                requestType = type,
                isUrgent = urgent
            )
        } catch (e: Exception) {
            // Skip malformed events
        }
    }

    /**
     * Gets the last sync time for a content type.
     */
    private fun getLastSyncTime(contentType: String): Long? {
        val prefs = applicationContext.getSharedPreferences("sync_prefs", Context.MODE_PRIVATE)
        val time = prefs.getLong("last_sync_$contentType", -1)
        return if (time > 0) time else null
    }

    /**
     * Saves the current time as the last sync time.
     */
    private fun saveLastSyncTime(contentType: String) {
        val prefs = applicationContext.getSharedPreferences("sync_prefs", Context.MODE_PRIVATE)
        prefs.edit().putLong("last_sync_$contentType", System.currentTimeMillis() / 1000).apply()
    }
}
