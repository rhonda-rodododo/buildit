package network.buildit.modules.calling

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.serialization.json.Json
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.storage.BuildItDatabase
import network.buildit.generated.schemas.calling.*
import network.buildit.modules.calling.data.CallingRepository
import network.buildit.modules.calling.data.local.CallHistoryDao
import network.buildit.modules.calling.data.local.CallSettingsDao
import network.buildit.modules.calling.domain.CallingUseCase
import network.buildit.modules.calling.ui.CallScreen
import network.buildit.modules.calling.ui.IncomingCallScreen
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Calling module for BuildIt.
 *
 * Provides WebRTC-based voice and video calling functionality:
 * - 1:1 voice and video calls
 * - Group calls (mesh/SFU)
 * - Call signaling via NIP-17 gift wrap
 * - Call history tracking
 * - End-to-end encryption
 */
class CallingModuleImpl @Inject constructor(
    private val useCase: CallingUseCase,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "calling"
    override val version: String = "1.0.0"
    override val displayName: String = "Calling"
    override val description: String = "Voice and video calls with end-to-end encryption"
    override val dependencies: List<String> = listOf("messaging") // Depends on messaging for NIP-17

    private var subscriptionId: String? = null
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun initialize() {
        // Subscribe to calling-related events (kinds 24300-24399 reserved for calling)
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 3600 // Last hour (calls are time-sensitive)
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
        useCase.endAllCalls()
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            KIND_CALL_OFFER -> {
                handleCallOffer(event)
                true
            }
            KIND_CALL_ANSWER -> {
                handleCallAnswer(event)
                true
            }
            KIND_ICE_CANDIDATE -> {
                handleIceCandidate(event)
                true
            }
            KIND_CALL_HANGUP -> {
                handleCallHangup(event)
                true
            }
            KIND_GROUP_CALL_CREATE -> {
                handleGroupCallCreate(event)
                true
            }
            KIND_GROUP_CALL_JOIN -> {
                handleGroupCallJoin(event)
                true
            }
            KIND_GROUP_CALL_LEAVE -> {
                handleGroupCallLeave(event)
                true
            }
            KIND_SENDER_KEY_DISTRIBUTION -> {
                handleSenderKeyDistribution(event)
                true
            }
            1059 -> { // NIP-17 gift wrap - may contain call signaling
                handleGiftWrap(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "calls",
                title = "Calls",
                icon = Icons.Default.Call,
                showInNavigation = true,
                content = { _ ->
                    // CallHistoryScreen()
                }
            ),
            ModuleRoute(
                route = "call/{callId}",
                title = "Active Call",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val callId = args["callId"] ?: return@ModuleRoute
                    CallScreen(callId = callId)
                }
            ),
            ModuleRoute(
                route = "incoming-call/{callId}",
                title = "Incoming Call",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val callId = args["callId"] ?: return@ModuleRoute
                    IncomingCallScreen(
                        callId = callId,
                        onAccept = { /* Navigate to call screen */ },
                        onDecline = { /* Go back */ }
                    )
                }
            ),
            ModuleRoute(
                route = "group-call/{roomId}",
                title = "Group Call",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val roomId = args["roomId"] ?: return@ModuleRoute
                    // GroupCallScreen(roomId = roomId)
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            KIND_CALL_OFFER,
            KIND_CALL_ANSWER,
            KIND_ICE_CANDIDATE,
            KIND_CALL_HANGUP,
            KIND_GROUP_CALL_CREATE,
            KIND_GROUP_CALL_JOIN,
            KIND_GROUP_CALL_LEAVE,
            KIND_SENDER_KEY_DISTRIBUTION,
            1059 // NIP-17 gift wrap
        )
    }

    private suspend fun handleCallOffer(event: NostrEvent) {
        try {
            val offer = json.decodeFromString<CallOffer>(event.content)
            android.util.Log.d(TAG, "Received call offer: ${offer.callID} from ${event.pubkey}")
            useCase.handleIncomingOffer(offer, event.pubkey)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle call offer", e)
        }
    }

    private suspend fun handleCallAnswer(event: NostrEvent) {
        try {
            val answer = json.decodeFromString<CallAnswer>(event.content)
            android.util.Log.d(TAG, "Received call answer: ${answer.callID}")
            useCase.handleIncomingAnswer(answer, event.pubkey)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle call answer", e)
        }
    }

    private suspend fun handleIceCandidate(event: NostrEvent) {
        try {
            val iceCandidate = json.decodeFromString<CallIceCandidate>(event.content)
            android.util.Log.d(TAG, "Received ICE candidate for call: ${iceCandidate.callID}")
            useCase.handleIncomingIceCandidate(iceCandidate, event.pubkey)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle ICE candidate", e)
        }
    }

    private suspend fun handleCallHangup(event: NostrEvent) {
        try {
            val hangup = json.decodeFromString<CallHangup>(event.content)
            android.util.Log.d(TAG, "Received call hangup: ${hangup.callID}, reason: ${hangup.reason}")
            useCase.handleRemoteHangup(hangup, event.pubkey)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle call hangup", e)
        }
    }

    private suspend fun handleGroupCallCreate(event: NostrEvent) {
        try {
            val create = json.decodeFromString<GroupCallCreate>(event.content)
            android.util.Log.d(TAG, "Received group call create: ${create.roomID}")
            useCase.handleGroupCallCreate(create, event.pubkey)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle group call create", e)
        }
    }

    private suspend fun handleGroupCallJoin(event: NostrEvent) {
        try {
            val join = json.decodeFromString<GroupCallJoin>(event.content)
            android.util.Log.d(TAG, "Received group call join: ${join.roomID} by ${join.pubkey}")
            useCase.handleGroupCallJoin(join)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle group call join", e)
        }
    }

    private suspend fun handleGroupCallLeave(event: NostrEvent) {
        try {
            val leave = json.decodeFromString<GroupCallLeave>(event.content)
            android.util.Log.d(TAG, "Received group call leave: ${leave.roomID} by ${leave.pubkey}")
            useCase.handleGroupCallLeave(leave)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle group call leave", e)
        }
    }

    private suspend fun handleSenderKeyDistribution(event: NostrEvent) {
        try {
            val distribution = json.decodeFromString<SenderKeyDistribution>(event.content)
            android.util.Log.d(TAG, "Received sender key distribution for room: ${distribution.roomID}")
            useCase.handleSenderKeyDistribution(distribution)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle sender key distribution", e)
        }
    }

    private suspend fun handleGiftWrap(event: NostrEvent) {
        // NIP-17 gift-wrapped messages may contain call signaling
        // The actual unwrapping is handled by the crypto layer
        try {
            android.util.Log.d(TAG, "Received gift-wrapped message, may contain call signaling")
            // Delegate to useCase which will decrypt and route appropriately
            useCase.handleGiftWrappedSignaling(event)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle gift wrap", e)
        }
    }

    companion object {
        private const val TAG = "CallingModule"

        // Nostr event kinds for calling (24300-24399 reserved range)
        const val KIND_CALL_OFFER = 24300
        const val KIND_CALL_ANSWER = 24301
        const val KIND_ICE_CANDIDATE = 24302
        const val KIND_CALL_HANGUP = 24303
        const val KIND_GROUP_CALL_CREATE = 24310
        const val KIND_GROUP_CALL_JOIN = 24311
        const val KIND_GROUP_CALL_LEAVE = 24312
        const val KIND_SENDER_KEY_DISTRIBUTION = 24320
    }
}

/**
 * Hilt module for Calling dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class CallingHiltModule {
    @Binds
    @IntoSet
    abstract fun bindCallingModule(impl: CallingModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Calling module.
 */
@Module
@InstallIn(SingletonComponent::class)
object CallingDaoModule {
    @Provides
    @Singleton
    fun provideCallHistoryDao(database: BuildItDatabase): CallHistoryDao {
        return database.callHistoryDao()
    }

    @Provides
    @Singleton
    fun provideCallSettingsDao(database: BuildItDatabase): CallSettingsDao {
        return database.callSettingsDao()
    }
}
