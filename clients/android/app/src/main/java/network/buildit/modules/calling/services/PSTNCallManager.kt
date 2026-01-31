package network.buildit.modules.calling.services

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.generated.schemas.calling.PSTNCall
import network.buildit.generated.schemas.calling.PSTNCallDirection
import network.buildit.generated.schemas.calling.PSTNCallStatus
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * PSTN Call State enum matching web implementation
 */
enum class PSTNCallState {
    QUEUED,
    RINGING,
    CONNECTED,
    ON_HOLD,
    TRANSFERRING,
    COMPLETED
}

/**
 * Local PSTN call state for UI
 */
data class LocalPSTNCall(
    val callSid: String,
    val hotlineId: String,
    val direction: PSTNCallDirection,
    val callerPhone: String? = null,
    val targetPhone: String? = null,
    val operatorPubkey: String? = null,
    val status: PSTNCallStatus,
    val startedAt: Long,
    val connectedAt: Long? = null,
    val duration: Long = 0,
    val isWebRTCBridged: Boolean = false
)

/**
 * PSTN Call events
 */
sealed class PSTNCallEvent {
    data class Connected(val call: LocalPSTNCall) : PSTNCallEvent()
    data class Disconnected(val callSid: String, val reason: String) : PSTNCallEvent()
    data class Error(val callSid: String, val error: Throwable) : PSTNCallEvent()
    data class QualityWarning(val callSid: String, val metric: String, val value: Double) : PSTNCallEvent()
    data class Hold(val callSid: String) : PSTNCallEvent()
    data class Resume(val callSid: String) : PSTNCallEvent()
    data class CallerRevealed(val callSid: String, val phone: String) : PSTNCallEvent()
}

/**
 * Outbound call options
 */
data class OutboundCallOptions(
    val targetPhone: String,
    val hotlineId: String,
    val callerId: String? = null
)

/**
 * PSTN Bridge configuration
 */
data class PSTNBridgeConfig(
    val workerUrl: String,
    val sipDomain: String? = null
)

/**
 * PSTN Call Manager
 *
 * Handles WebRTC-PSTN bridging for inbound and outbound phone calls.
 * Integrates with Android's ConnectionService for native telecom framework support.
 */
@Singleton
class PSTNCallManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager,
    private val httpClient: OkHttpClient
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    // Active calls map
    private val activeCalls = ConcurrentHashMap<String, LocalPSTNCall>()

    // Duration timers
    private val callDurations = ConcurrentHashMap<String, Job>()

    // Configuration
    private var config: PSTNBridgeConfig? = null

    // API base URL
    private val apiBase: String
        get() = config?.workerUrl ?: ""

    // State flows
    private val _activeCallsFlow = MutableStateFlow<Map<String, LocalPSTNCall>>(emptyMap())
    val activeCallsFlow: StateFlow<Map<String, LocalPSTNCall>> = _activeCallsFlow.asStateFlow()

    // Events
    private val _events = MutableSharedFlow<PSTNCallEvent>()
    val events: SharedFlow<PSTNCallEvent> = _events.asSharedFlow()

    companion object {
        private const val TAG = "PSTNCallManager"

        // Nostr event kinds for PSTN (from protocol)
        const val KIND_PSTN_INBOUND = 24380
        const val KIND_PSTN_OUTBOUND = 24381
        const val KIND_PSTN_BRIDGE = 24382
    }

    /**
     * Initialize with configuration
     */
    fun initialize(config: PSTNBridgeConfig) {
        this.config = config
        Log.d(TAG, "PSTNCallManager initialized with worker URL: ${config.workerUrl}")
    }

    /**
     * Handle signaling event from Nostr
     */
    fun handleSignalingEvent(kind: Int, content: String) {
        scope.launch {
            try {
                when (kind) {
                    KIND_PSTN_INBOUND -> handleIncomingPSTNNotification(content)
                    KIND_PSTN_BRIDGE -> handleBridgeEvent(content)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle signaling event", e)
            }
        }
    }

    /**
     * Handle incoming PSTN call notification
     */
    private suspend fun handleIncomingPSTNNotification(content: String) {
        val data = json.decodeFromString<IncomingPSTNData>(content)

        val call = LocalPSTNCall(
            callSid = data.callSid,
            hotlineId = data.hotlineId,
            direction = PSTNCallDirection.Inbound,
            callerPhone = data.maskedCallerId,
            status = PSTNCallStatus.Queued,
            startedAt = System.currentTimeMillis(),
            isWebRTCBridged = false
        )

        activeCalls[data.callSid] = call
        updateCallsFlow()

        Log.d(TAG, "Incoming PSTN call: ${data.callSid} from ${data.maskedCallerId}")
    }

    /**
     * Handle bridge events from the PSTN bridge
     */
    private suspend fun handleBridgeEvent(content: String) {
        val data = json.decodeFromString<BridgeEventData>(content)

        val call = activeCalls[data.callSid] ?: return

        when (data.type) {
            "connected" -> {
                val updatedCall = call.copy(
                    status = PSTNCallStatus.Connected,
                    connectedAt = System.currentTimeMillis(),
                    isWebRTCBridged = true
                )
                activeCalls[data.callSid] = updatedCall
                startDurationTimer(data.callSid)
                _events.emit(PSTNCallEvent.Connected(updatedCall))
            }
            "disconnected" -> {
                val updatedCall = call.copy(status = PSTNCallStatus.Completed)
                activeCalls[data.callSid] = updatedCall
                stopDurationTimer(data.callSid)
                _events.emit(PSTNCallEvent.Disconnected(data.callSid, data.reason ?: "normal"))
                cleanup(data.callSid)
            }
            "error" -> {
                val updatedCall = call.copy(status = PSTNCallStatus.Failed)
                activeCalls[data.callSid] = updatedCall
                _events.emit(PSTNCallEvent.Error(data.callSid, Exception(data.message ?: "Unknown error")))
                cleanup(data.callSid)
            }
            "quality" -> {
                if (data.metric != null && data.value != null) {
                    _events.emit(PSTNCallEvent.QualityWarning(data.callSid, data.metric, data.value))
                }
            }
        }

        updateCallsFlow()
    }

    /**
     * Answer an incoming PSTN call (operator answering from queue)
     */
    suspend fun answerPSTNCall(callSid: String, operatorPubkey: String) {
        val call = activeCalls[callSid] ?: throw IllegalStateException("Call not found")

        if (call.status != PSTNCallStatus.Queued && call.status != PSTNCallStatus.Ringing) {
            throw IllegalStateException("Cannot answer call in ${call.status} state")
        }

        // Request bridge from backend
        val requestBody = json.encodeToString(AnswerRequest(callSid, operatorPubkey))
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/voice/answer")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            val error = response.body?.string() ?: "Unknown error"
            throw Exception("Failed to answer call: $error")
        }

        val responseData = json.decodeFromString<AnswerResponse>(response.body?.string() ?: "{}")

        // Update call state
        val updatedCall = call.copy(
            status = PSTNCallStatus.Ringing,
            operatorPubkey = operatorPubkey
        )
        activeCalls[callSid] = updatedCall
        updateCallsFlow()

        // Setup WebRTC connection to SIP bridge
        setupWebRTCBridge(callSid, responseData.sipUri, responseData.webrtcConfig)

        // Notify via signaling
        publishBridgeEvent(callSid, "answer", operatorPubkey)

        Log.d(TAG, "Answered PSTN call: $callSid")
    }

    /**
     * Initiate an outbound PSTN call
     */
    suspend fun dialOutbound(options: OutboundCallOptions): String {
        val requestBody = json.encodeToString(OutboundRequest(
            targetPhone = options.targetPhone,
            hotlineId = options.hotlineId,
            callerId = options.callerId
        )).toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/voice/outbound")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            val error = response.body?.string() ?: "Unknown error"
            throw Exception("Failed to initiate call: $error")
        }

        val responseData = json.decodeFromString<OutboundResponse>(response.body?.string() ?: "{}")

        // Create local call state
        val call = LocalPSTNCall(
            callSid = responseData.callSid,
            hotlineId = options.hotlineId,
            direction = PSTNCallDirection.Outbound,
            targetPhone = options.targetPhone,
            status = PSTNCallStatus.Ringing,
            startedAt = System.currentTimeMillis(),
            isWebRTCBridged = false
        )

        activeCalls[responseData.callSid] = call
        updateCallsFlow()

        // Setup WebRTC connection to SIP bridge
        setupWebRTCBridge(responseData.callSid, responseData.sipUri, responseData.webrtcConfig)

        // Notify via signaling
        publishOutboundEvent(responseData.callSid, options.hotlineId, maskPhoneNumber(options.targetPhone))

        Log.d(TAG, "Initiated outbound PSTN call: ${responseData.callSid}")
        return responseData.callSid
    }

    /**
     * Setup WebRTC connection to SIP bridge
     */
    private suspend fun setupWebRTCBridge(callSid: String, sipUri: String, webrtcConfig: WebRTCConfig?) {
        // TODO: Implement WebRTC bridge setup using existing WebRTC infrastructure
        // This would:
        // 1. Get local media stream (audio only for PSTN)
        // 2. Create RTCPeerConnection with provided config
        // 3. Add local audio track
        // 4. Create SDP offer
        // 5. Send offer to SIP bridge and get answer
        // 6. Set remote description
        // 7. Monitor connection state

        Log.d(TAG, "Setting up WebRTC bridge for call: $callSid to $sipUri")

        // Add call to Android telecom system for system integration
        addToTelecomSystem(callSid)
    }

    /**
     * Add PSTN call to Android telecom system
     */
    private fun addToTelecomSystem(callSid: String) {
        val call = activeCalls[callSid] ?: return

        try {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = PSTNConnectionService.getPhoneAccountHandle(context)

            val extras = Bundle().apply {
                putString(PSTNConnectionService.EXTRA_CALL_SID, callSid)
                putString(PSTNConnectionService.EXTRA_HOTLINE_ID, call.hotlineId)
                putBoolean(PSTNConnectionService.EXTRA_IS_PSTN, true)
            }

            if (call.direction == PSTNCallDirection.Inbound) {
                telecomManager.addNewIncomingCall(handle, extras)
            } else {
                extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
                telecomManager.placeCall(
                    Uri.fromParts("tel", call.targetPhone ?: "", null),
                    extras
                )
            }

            Log.d(TAG, "Added PSTN call to telecom system: $callSid")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add PSTN call to telecom system", e)
        }
    }

    /**
     * Put a PSTN call on hold
     */
    suspend fun holdPSTNCall(callSid: String) {
        val call = activeCalls[callSid] ?: throw IllegalStateException("Call not found")

        if (call.status != PSTNCallStatus.Connected) {
            throw IllegalStateException("Call not connected")
        }

        val requestBody = json.encodeToString(HoldRequest(callSid, "hold"))
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/voice/hold")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            throw Exception("Failed to put call on hold")
        }

        val updatedCall = call.copy(status = PSTNCallStatus.OnHold)
        activeCalls[callSid] = updatedCall
        updateCallsFlow()

        _events.emit(PSTNCallEvent.Hold(callSid))

        Log.d(TAG, "Put PSTN call on hold: $callSid")
    }

    /**
     * Resume a PSTN call from hold
     */
    suspend fun resumePSTNCall(callSid: String) {
        val call = activeCalls[callSid] ?: throw IllegalStateException("Call not found")

        if (call.status != PSTNCallStatus.OnHold) {
            throw IllegalStateException("Call not on hold")
        }

        val requestBody = json.encodeToString(HoldRequest(callSid, "resume"))
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/voice/hold")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            throw Exception("Failed to resume call")
        }

        val updatedCall = call.copy(status = PSTNCallStatus.Connected)
        activeCalls[callSid] = updatedCall
        updateCallsFlow()

        _events.emit(PSTNCallEvent.Resume(callSid))

        Log.d(TAG, "Resumed PSTN call: $callSid")
    }

    /**
     * Transfer a PSTN call to another phone number
     */
    suspend fun transferPSTNCall(callSid: String, targetPhone: String) {
        val call = activeCalls[callSid] ?: throw IllegalStateException("Call not found")

        val requestBody = json.encodeToString(TransferRequest(callSid, targetPhone))
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/voice/transfer")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            throw Exception("Failed to transfer call")
        }

        // Call will be disconnected from our end after transfer
        val updatedCall = call.copy(status = PSTNCallStatus.Completed)
        activeCalls[callSid] = updatedCall
        updateCallsFlow()
        cleanup(callSid)

        Log.d(TAG, "Transferred PSTN call: $callSid to $targetPhone")
    }

    /**
     * End a PSTN call
     */
    suspend fun endPSTNCall(callSid: String) {
        val call = activeCalls[callSid] ?: return

        // Notify backend to end call
        try {
            val requestBody = json.encodeToString(HangupRequest(callSid))
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiBase/api/pstn/voice/hangup")
                .post(requestBody)
                .build()

            httpClient.newCall(request).execute()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to notify backend of hangup", e)
        }

        val updatedCall = call.copy(status = PSTNCallStatus.Completed)
        activeCalls[callSid] = updatedCall
        updateCallsFlow()

        _events.emit(PSTNCallEvent.Disconnected(callSid, "user_hangup"))
        cleanup(callSid)

        Log.d(TAG, "Ended PSTN call: $callSid")
    }

    /**
     * Reveal the real phone number (requires authorization, will be audited)
     */
    suspend fun revealCallerPhone(callSid: String, operatorPubkey: String): String {
        val call = activeCalls[callSid] ?: throw IllegalStateException("Call not found")

        if (call.direction != PSTNCallDirection.Inbound) {
            throw IllegalStateException("Can only reveal inbound caller phone")
        }

        val requestBody = json.encodeToString(RevealRequest(
            callSid = callSid,
            operatorPubkey = operatorPubkey,
            maskedId = call.callerPhone ?: ""
        )).toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiBase/api/pstn/caller/reveal")
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            when (response.code) {
                403 -> throw SecurityException("Not authorized to reveal caller phone")
                else -> throw Exception("Failed to reveal caller phone")
            }
        }

        val responseData = json.decodeFromString<RevealResponse>(response.body?.string() ?: "{}")

        _events.emit(PSTNCallEvent.CallerRevealed(callSid, responseData.phone))

        Log.d(TAG, "Revealed caller phone for call: $callSid")
        return responseData.phone
    }

    /**
     * Get a specific call
     */
    fun getCall(callSid: String): LocalPSTNCall? = activeCalls[callSid]

    /**
     * Get all active calls
     */
    fun getAllCalls(): List<LocalPSTNCall> = activeCalls.values.toList()

    // Helper methods

    private fun maskPhoneNumber(phone: String): String {
        if (phone.length <= 4) return "****"
        return "*".repeat(phone.length - 4) + phone.takeLast(4)
    }

    private fun startDurationTimer(callSid: String) {
        stopDurationTimer(callSid)

        callDurations[callSid] = scope.launch {
            while (true) {
                val call = activeCalls[callSid] ?: break
                val connectedAt = call.connectedAt ?: continue

                val updatedCall = call.copy(
                    duration = (System.currentTimeMillis() - connectedAt) / 1000
                )
                activeCalls[callSid] = updatedCall
                updateCallsFlow()

                delay(1000)
            }
        }
    }

    private fun stopDurationTimer(callSid: String) {
        callDurations[callSid]?.cancel()
        callDurations.remove(callSid)
    }

    private fun cleanup(callSid: String) {
        stopDurationTimer(callSid)
        activeCalls.remove(callSid)
        updateCallsFlow()
    }

    private fun updateCallsFlow() {
        _activeCallsFlow.value = activeCalls.toMap()
    }

    private suspend fun publishBridgeEvent(callSid: String, type: String, operatorPubkey: String) {
        val content = json.encodeToString(BridgeNotification(
            v = "1",
            callSid = callSid,
            type = type,
            operatorPubkey = operatorPubkey,
            timestamp = System.currentTimeMillis()
        ))

        val pubkey = cryptoManager.getPublicKeyHex() ?: return
        val unsigned = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_PSTN_BRIDGE,
            tags = emptyList(),
            content = content
        )
        val signed = cryptoManager.signEvent(unsigned) ?: return
        nostrClient.publishEvent(NostrEvent(
            id = signed.id, pubkey = signed.pubkey, createdAt = signed.createdAt,
            kind = signed.kind, tags = signed.tags, content = signed.content, sig = signed.sig
        ))
    }

    private suspend fun publishOutboundEvent(callSid: String, hotlineId: String, maskedPhone: String) {
        val content = json.encodeToString(OutboundNotification(
            v = "1",
            callSid = callSid,
            hotlineId = hotlineId,
            targetPhone = maskedPhone,
            timestamp = System.currentTimeMillis()
        ))

        val pubkey = cryptoManager.getPublicKeyHex() ?: return
        val unsigned = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_PSTN_OUTBOUND,
            tags = emptyList(),
            content = content
        )
        val signed = cryptoManager.signEvent(unsigned) ?: return
        nostrClient.publishEvent(NostrEvent(
            id = signed.id, pubkey = signed.pubkey, createdAt = signed.createdAt,
            kind = signed.kind, tags = signed.tags, content = signed.content, sig = signed.sig
        ))
    }

    /**
     * Cleanup all resources
     */
    fun destroy() {
        callDurations.values.forEach { it.cancel() }
        callDurations.clear()
        activeCalls.clear()
        updateCallsFlow()
    }
}

// Request/Response data classes

@Serializable
private data class IncomingPSTNData(
    val callSid: String,
    val hotlineId: String,
    val maskedCallerId: String,
    val queuePosition: Int? = null
)

@Serializable
private data class BridgeEventData(
    val type: String,
    val callSid: String,
    val reason: String? = null,
    val message: String? = null,
    val metric: String? = null,
    val value: Double? = null
)

@Serializable
private data class AnswerRequest(
    val callSid: String,
    val operatorPubkey: String
)

@Serializable
private data class AnswerResponse(
    val sipUri: String,
    val webrtcConfig: WebRTCConfig? = null
)

@Serializable
private data class WebRTCConfig(
    val iceServers: List<IceServer>? = null
)

@Serializable
private data class IceServer(
    val urls: List<String>,
    val username: String? = null,
    val credential: String? = null
)

@Serializable
private data class OutboundRequest(
    val targetPhone: String,
    val hotlineId: String,
    val callerId: String? = null
)

@Serializable
private data class OutboundResponse(
    val callSid: String,
    val sipUri: String,
    val webrtcConfig: WebRTCConfig? = null
)

@Serializable
private data class HoldRequest(
    val callSid: String,
    val action: String
)

@Serializable
private data class TransferRequest(
    val callSid: String,
    val targetPhone: String
)

@Serializable
private data class HangupRequest(
    val callSid: String
)

@Serializable
private data class RevealRequest(
    val callSid: String,
    val operatorPubkey: String,
    val maskedId: String
)

@Serializable
private data class RevealResponse(
    val phone: String
)

@Serializable
private data class BridgeNotification(
    @kotlinx.serialization.SerialName("_v")
    val v: String,
    val callSid: String,
    val type: String,
    val operatorPubkey: String,
    val timestamp: Long
)

@Serializable
private data class OutboundNotification(
    @kotlinx.serialization.SerialName("_v")
    val v: String,
    val callSid: String,
    val hotlineId: String,
    val targetPhone: String,
    val timestamp: Long
)

/**
 * Android ConnectionService for PSTN calls
 */
class PSTNConnectionService : ConnectionService() {

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "PSTNConnectionService created")
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val extras = request.extras
        val callSid = extras.getString(EXTRA_CALL_SID) ?: ""
        val hotlineId = extras.getString(EXTRA_HOTLINE_ID) ?: ""

        Log.d(TAG, "Creating incoming PSTN connection: $callSid")

        return PSTNConnection(callSid, hotlineId, isOutgoing = false).apply {
            setRinging()
            connectionCapabilities = Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_MUTE
        }
    }

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val extras = request.extras
        val callSid = extras.getString(EXTRA_CALL_SID) ?: ""
        val hotlineId = extras.getString(EXTRA_HOTLINE_ID) ?: ""

        Log.d(TAG, "Creating outgoing PSTN connection: $callSid")

        return PSTNConnection(callSid, hotlineId, isOutgoing = true).apply {
            setDialing()
            connectionCapabilities = Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_MUTE
        }
    }

    /**
     * PSTN Connection implementation
     */
    inner class PSTNConnection(
        val callSid: String,
        val hotlineId: String,
        val isOutgoing: Boolean
    ) : Connection() {

        init {
            connectionProperties = PROPERTY_SELF_MANAGED
            audioModeIsVoip = true
        }

        override fun onAnswer() {
            Log.d(TAG, "PSTN connection answered: $callSid")
            setActive()
            PSTNConnectionCallbackManager.onCallAnswered(callSid)
        }

        override fun onReject() {
            Log.d(TAG, "PSTN connection rejected: $callSid")
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
            PSTNConnectionCallbackManager.onCallRejected(callSid)
        }

        override fun onDisconnect() {
            Log.d(TAG, "PSTN connection disconnected: $callSid")
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
            PSTNConnectionCallbackManager.onCallEnded(callSid)
        }

        override fun onHold() {
            Log.d(TAG, "PSTN connection hold: $callSid")
            setOnHold()
            PSTNConnectionCallbackManager.onCallHeld(callSid, true)
        }

        override fun onUnhold() {
            Log.d(TAG, "PSTN connection unhold: $callSid")
            setActive()
            PSTNConnectionCallbackManager.onCallHeld(callSid, false)
        }

        fun setCallConnected() {
            setActive()
        }

        fun endCall(cause: Int) {
            setDisconnected(DisconnectCause(cause))
            destroy()
        }
    }

    companion object {
        private const val TAG = "PSTNConnectionService"

        const val EXTRA_CALL_SID = "pstn_call_sid"
        const val EXTRA_HOTLINE_ID = "pstn_hotline_id"
        const val EXTRA_IS_PSTN = "is_pstn"

        fun getPhoneAccountHandle(context: Context): PhoneAccountHandle {
            return PhoneAccountHandle(
                ComponentName(context, PSTNConnectionService::class.java),
                "BuildIt_PSTN"
            )
        }

        fun registerPhoneAccount(context: Context) {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = getPhoneAccountHandle(context)

            val account = PhoneAccount.builder(handle, "BuildIt PSTN")
                .setCapabilities(
                    PhoneAccount.CAPABILITY_CALL_PROVIDER or
                            PhoneAccount.CAPABILITY_SELF_MANAGED
                )
                .addSupportedUriScheme("tel")
                .setShortDescription("PSTN calls via BuildIt hotlines")
                .build()

            telecomManager.registerPhoneAccount(account)
            Log.d(TAG, "PSTN PhoneAccount registered")
        }
    }
}

/**
 * Callback manager for PSTN connection events
 */
object PSTNConnectionCallbackManager {
    private var onAnswered: ((String) -> Unit)? = null
    private var onRejected: ((String) -> Unit)? = null
    private var onEnded: ((String) -> Unit)? = null
    private var onHeld: ((String, Boolean) -> Unit)? = null

    fun setCallbacks(
        onAnswered: (String) -> Unit,
        onRejected: (String) -> Unit,
        onEnded: (String) -> Unit,
        onHeld: (String, Boolean) -> Unit
    ) {
        this.onAnswered = onAnswered
        this.onRejected = onRejected
        this.onEnded = onEnded
        this.onHeld = onHeld
    }

    fun clearCallbacks() {
        onAnswered = null
        onRejected = null
        onEnded = null
        onHeld = null
    }

    internal fun onCallAnswered(callSid: String) {
        onAnswered?.invoke(callSid)
    }

    internal fun onCallRejected(callSid: String) {
        onRejected?.invoke(callSid)
    }

    internal fun onCallEnded(callSid: String) {
        onEnded?.invoke(callSid)
    }

    internal fun onCallHeld(callSid: String, held: Boolean) {
        onHeld?.invoke(callSid, held)
    }
}
