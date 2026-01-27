package network.buildit.modules.calling.domain

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.generated.schemas.*
import network.buildit.modules.calling.CallingModuleImpl
import network.buildit.modules.calling.data.CallingRepository
import network.buildit.modules.calling.data.local.ActiveCallState
import network.buildit.modules.calling.data.local.CallHistoryEntity
import network.buildit.modules.calling.data.local.CallSettingsEntity
import network.buildit.modules.calling.data.local.IceServer
import org.webrtc.*
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for calling operations.
 *
 * Handles WebRTC call management including:
 * - 1:1 voice and video calls
 * - Call signaling via Nostr/NIP-17
 * - Call state management
 * - Audio/video device management
 */
@Singleton
class CallingUseCase @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: CallingRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // WebRTC factory and configuration
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private val peerConnections = ConcurrentHashMap<String, PeerConnection>()

    // Active call state
    private val _activeCalls = MutableStateFlow<Map<String, ActiveCallState>>(emptyMap())
    val activeCalls: StateFlow<Map<String, ActiveCallState>> = _activeCalls.asStateFlow()

    // Current call (for UI)
    private val _currentCall = MutableStateFlow<ActiveCallState?>(null)
    val currentCall: StateFlow<ActiveCallState?> = _currentCall.asStateFlow()

    // Incoming call events
    private val _incomingCall = MutableSharedFlow<IncomingCallEvent>()
    val incomingCall: SharedFlow<IncomingCallEvent> = _incomingCall.asSharedFlow()

    // Local media streams
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var localVideoSource: VideoSource? = null
    private var videoCapturer: CameraVideoCapturer? = null

    // Remote media streams
    private val _remoteVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val remoteVideoTrack: StateFlow<VideoTrack?> = _remoteVideoTrack.asStateFlow()

    private val _remoteAudioTrack = MutableStateFlow<AudioTrack?>(null)
    val remoteAudioTrack: StateFlow<AudioTrack?> = _remoteAudioTrack.asStateFlow()

    init {
        initializeWebRTC()
    }

    /**
     * Initialize WebRTC peer connection factory.
     */
    private fun initializeWebRTC() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(
            EglBase.create().eglBaseContext,
            true,
            true
        )
        val decoderFactory = DefaultVideoDecoderFactory(
            EglBase.create().eglBaseContext
        )

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .setOptions(PeerConnectionFactory.Options())
            .createPeerConnectionFactory()
    }

    // ============== Outgoing Call Methods ==============

    /**
     * Initiates an outgoing call.
     */
    suspend fun initiateCall(
        recipientPubkey: String,
        recipientName: String?,
        callType: CallType
    ): ModuleResult<String> {
        return runCatching {
            val callId = UUID.randomUUID().toString()
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            // Check DND
            if (repository.isDoNotDisturb(pubkey)) {
                throw IllegalStateException("Do not disturb is enabled")
            }

            // Create call history entry
            repository.createOutgoingCall(
                callId = callId,
                remotePubkey = recipientPubkey,
                remoteName = recipientName,
                callType = callType.value
            )

            // Create call state
            val callState = ActiveCallState(
                callId = callId,
                callType = callType.value,
                direction = "outgoing",
                remotePubkey = recipientPubkey,
                remoteName = recipientName,
                state = "initiating",
                startedAt = System.currentTimeMillis() / 1000
            )
            updateCallState(callState)
            _currentCall.value = callState

            // Create peer connection
            val peerConnection = createPeerConnection(callId, recipientPubkey)
            peerConnections[callId] = peerConnection

            // Create and set local media
            setupLocalMedia(callType == CallType.Video)
            addLocalTracksToConnection(peerConnection, callType == CallType.Video)

            // Create and send offer
            val sdpOffer = createOffer(peerConnection)
            val offer = CallOffer(
                v = "1.0.0",
                callID = callId,
                callType = callType,
                sdp = sdpOffer,
                timestamp = System.currentTimeMillis() / 1000,
                capabilities = CapabilitiesClass(
                    video = callType == CallType.Video,
                    screenShare = false,
                    e2Ee = true,
                    insertableStreams = true
                )
            )

            // Send offer via NIP-17 gift wrap for privacy
            sendSignalingMessage(recipientPubkey, json.encodeToString(offer), CallingModuleImpl.KIND_CALL_OFFER)

            // Update state to ringing
            updateCallState(callState.copy(state = "ringing"))

            callId
        }.toModuleResult()
    }

    /**
     * Answer an incoming call.
     */
    suspend fun answerCall(callId: String, withVideo: Boolean): ModuleResult<Unit> {
        return runCatching {
            val callState = _activeCalls.value[callId]
                ?: throw IllegalStateException("Call not found: $callId")

            if (callState.direction != "incoming" || callState.state != "ringing") {
                throw IllegalStateException("Cannot answer call in state: ${callState.state}")
            }

            // Get peer connection
            val peerConnection = peerConnections[callId]
                ?: throw IllegalStateException("Peer connection not found")

            // Setup local media
            setupLocalMedia(withVideo)
            addLocalTracksToConnection(peerConnection, withVideo)

            // Create and send answer
            val sdpAnswer = createAnswer(peerConnection)
            val answer = CallAnswer(
                v = "1.0.0",
                callID = callId,
                sdp = sdpAnswer,
                timestamp = System.currentTimeMillis() / 1000
            )

            sendSignalingMessage(callState.remotePubkey, json.encodeToString(answer), CallingModuleImpl.KIND_CALL_ANSWER)

            // Update state
            updateCallState(callState.copy(state = "connecting"))
            repository.markCallConnected(callId)
        }.toModuleResult()
    }

    /**
     * Reject an incoming call.
     */
    suspend fun rejectCall(callId: String): ModuleResult<Unit> {
        return runCatching {
            val callState = _activeCalls.value[callId]
                ?: throw IllegalStateException("Call not found: $callId")

            sendHangup(callId, callState.remotePubkey, Reason.Rejected)

            cleanupCall(callId)
            repository.markCallEnded(callId, "rejected")
        }.toModuleResult()
    }

    /**
     * End an active call.
     */
    suspend fun endCall(callId: String): ModuleResult<Unit> {
        return runCatching {
            val callState = _activeCalls.value[callId]
                ?: throw IllegalStateException("Call not found: $callId")

            val reason = if (callState.isConnected) Reason.Completed else Reason.Cancelled
            sendHangup(callId, callState.remotePubkey, reason)

            cleanupCall(callId)
            repository.markCallEnded(callId, reason.value)
        }.toModuleResult()
    }

    /**
     * End all active calls.
     */
    suspend fun endAllCalls() {
        _activeCalls.value.keys.toList().forEach { callId ->
            try {
                endCall(callId)
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to end call $callId", e)
            }
        }
    }

    // ============== Call Controls ==============

    /**
     * Toggle mute state.
     */
    fun toggleMute(callId: String): Boolean {
        val callState = _activeCalls.value[callId] ?: return false
        val newMuteState = !callState.isMuted

        localAudioTrack?.setEnabled(!newMuteState)
        updateCallState(callState.copy(isMuted = newMuteState))

        return newMuteState
    }

    /**
     * Toggle video state.
     */
    fun toggleVideo(callId: String): Boolean {
        val callState = _activeCalls.value[callId] ?: return false
        val newVideoState = !callState.isVideoEnabled

        localVideoTrack?.setEnabled(newVideoState)
        updateCallState(callState.copy(isVideoEnabled = newVideoState))

        return newVideoState
    }

    /**
     * Switch camera (front/back).
     */
    fun switchCamera() {
        videoCapturer?.switchCamera(null)
    }

    /**
     * Set speaker mode.
     */
    fun setSpeakerMode(enabled: Boolean) {
        // Would interact with AudioManager
        // android.media.AudioManager
    }

    // ============== Incoming Event Handlers ==============

    /**
     * Handle incoming call offer.
     */
    suspend fun handleIncomingOffer(offer: CallOffer, senderPubkey: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        // Check if we should accept the call
        if (repository.isDoNotDisturb(pubkey)) {
            android.util.Log.d(TAG, "Rejecting call due to DND")
            sendHangup(offer.callID, senderPubkey, Reason.Busy)
            return
        }

        // Check for existing active call
        if (_currentCall.value != null) {
            android.util.Log.d(TAG, "Rejecting call - already in a call")
            sendHangup(offer.callID, senderPubkey, Reason.Busy)
            return
        }

        // Create call history entry
        repository.createIncomingCall(
            callId = offer.callID,
            remotePubkey = senderPubkey,
            remoteName = null, // Would lookup contact name
            callType = offer.callType.value,
            groupId = offer.groupID,
            roomId = offer.roomID
        )

        // Create peer connection
        val peerConnection = createPeerConnection(offer.callID, senderPubkey)
        peerConnections[offer.callID] = peerConnection

        // Set remote description
        val sessionDescription = SessionDescription(SessionDescription.Type.OFFER, offer.sdp)
        peerConnection.setRemoteDescription(SimpleSdpObserver(), sessionDescription)

        // Create call state
        val callState = ActiveCallState(
            callId = offer.callID,
            callType = offer.callType.value,
            direction = "incoming",
            remotePubkey = senderPubkey,
            remoteName = null,
            state = "ringing",
            startedAt = System.currentTimeMillis() / 1000
        )
        updateCallState(callState)
        _currentCall.value = callState

        // Emit incoming call event for UI
        _incomingCall.emit(IncomingCallEvent(
            callId = offer.callID,
            callerPubkey = senderPubkey,
            callerName = null,
            callType = offer.callType,
            timestamp = offer.timestamp
        ))
    }

    /**
     * Handle incoming call answer.
     */
    suspend fun handleIncomingAnswer(answer: CallAnswer, senderPubkey: String) {
        val peerConnection = peerConnections[answer.callID] ?: return
        val callState = _activeCalls.value[answer.callID] ?: return

        if (callState.remotePubkey != senderPubkey) {
            android.util.Log.w(TAG, "Answer from unexpected sender")
            return
        }

        val sessionDescription = SessionDescription(SessionDescription.Type.ANSWER, answer.sdp)
        peerConnection.setRemoteDescription(SimpleSdpObserver(), sessionDescription)

        updateCallState(callState.copy(state = "connecting"))
    }

    /**
     * Handle incoming ICE candidate.
     */
    suspend fun handleIncomingIceCandidate(iceCandidate: CallIceCandidate, senderPubkey: String) {
        val peerConnection = peerConnections[iceCandidate.callID] ?: return

        val candidate = IceCandidate(
            iceCandidate.candidate.sdpMid,
            iceCandidate.candidate.sdpMLineIndex?.toInt() ?: 0,
            iceCandidate.candidate.candidate
        )
        peerConnection.addIceCandidate(candidate)
    }

    /**
     * Handle remote hangup.
     */
    suspend fun handleRemoteHangup(hangup: CallHangup, senderPubkey: String) {
        val callState = _activeCalls.value[hangup.callID] ?: return

        if (callState.remotePubkey != senderPubkey) {
            android.util.Log.w(TAG, "Hangup from unexpected sender")
            return
        }

        cleanupCall(hangup.callID)
        repository.markCallEnded(hangup.callID, hangup.reason.value)
    }

    /**
     * Handle group call create.
     */
    suspend fun handleGroupCallCreate(create: GroupCallCreate, senderPubkey: String) {
        android.util.Log.d(TAG, "Group call created: ${create.roomID} by $senderPubkey")
        // Would handle group call room creation
    }

    /**
     * Handle group call join.
     */
    suspend fun handleGroupCallJoin(join: GroupCallJoin) {
        android.util.Log.d(TAG, "User ${join.pubkey} joined room ${join.roomID}")
        // Would handle participant joining
    }

    /**
     * Handle group call leave.
     */
    suspend fun handleGroupCallLeave(leave: GroupCallLeave) {
        android.util.Log.d(TAG, "User ${leave.pubkey} left room ${leave.roomID}")
        // Would handle participant leaving
    }

    /**
     * Handle sender key distribution for E2EE.
     */
    suspend fun handleSenderKeyDistribution(distribution: SenderKeyDistribution) {
        android.util.Log.d(TAG, "Received sender key for room ${distribution.roomID}")
        // Would handle E2EE key distribution
    }

    /**
     * Handle gift-wrapped signaling message.
     */
    suspend fun handleGiftWrappedSignaling(event: NostrEvent) {
        // Would decrypt and route to appropriate handler
    }

    // ============== WebRTC Helpers ==============

    private fun createPeerConnection(callId: String, remotePubkey: String): PeerConnection {
        val factory = peerConnectionFactory
            ?: throw IllegalStateException("PeerConnectionFactory not initialized")

        val iceServers = IceServer.DEFAULT_STUN_SERVERS.map { server ->
            PeerConnection.IceServer.builder(server.urls)
                .setUsername(server.username ?: "")
                .setPassword(server.credential ?: "")
                .createIceServer()
        }

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) {
                android.util.Log.d(TAG, "Signaling state: $state")
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                android.util.Log.d(TAG, "ICE connection state: $state")
                scope.launch {
                    handleIceConnectionStateChange(callId, state)
                }
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {}

            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
                android.util.Log.d(TAG, "ICE gathering state: $state")
            }

            override fun onIceCandidate(candidate: IceCandidate) {
                scope.launch {
                    sendIceCandidate(callId, remotePubkey, candidate)
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}

            override fun onAddStream(stream: MediaStream) {
                android.util.Log.d(TAG, "Remote stream added")
                stream.videoTracks.firstOrNull()?.let { _remoteVideoTrack.value = it }
                stream.audioTracks.firstOrNull()?.let { _remoteAudioTrack.value = it }
            }

            override fun onRemoveStream(stream: MediaStream) {
                android.util.Log.d(TAG, "Remote stream removed")
                _remoteVideoTrack.value = null
                _remoteAudioTrack.value = null
            }

            override fun onDataChannel(channel: DataChannel) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {}
        }

        return factory.createPeerConnection(rtcConfig, observer)
            ?: throw IllegalStateException("Failed to create peer connection")
    }

    private suspend fun createOffer(peerConnection: PeerConnection): String {
        return suspendCoroutine { continuation ->
            val constraints = MediaConstraints().apply {
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
            }

            peerConnection.createOffer(object : SdpObserver {
                override fun onCreateSuccess(sdp: SessionDescription) {
                    peerConnection.setLocalDescription(SimpleSdpObserver(), sdp)
                    continuation.resume(sdp.description)
                }
                override fun onSetSuccess() {}
                override fun onCreateFailure(error: String) {
                    continuation.resumeWithException(Exception(error))
                }
                override fun onSetFailure(error: String) {}
            }, constraints)
        }
    }

    private suspend fun createAnswer(peerConnection: PeerConnection): String {
        return suspendCoroutine { continuation ->
            val constraints = MediaConstraints()

            peerConnection.createAnswer(object : SdpObserver {
                override fun onCreateSuccess(sdp: SessionDescription) {
                    peerConnection.setLocalDescription(SimpleSdpObserver(), sdp)
                    continuation.resume(sdp.description)
                }
                override fun onSetSuccess() {}
                override fun onCreateFailure(error: String) {
                    continuation.resumeWithException(Exception(error))
                }
                override fun onSetFailure(error: String) {}
            }, constraints)
        }
    }

    private fun setupLocalMedia(withVideo: Boolean) {
        val factory = peerConnectionFactory ?: return

        // Audio
        val audioConstraints = MediaConstraints()
        val audioSource = factory.createAudioSource(audioConstraints)
        localAudioTrack = factory.createAudioTrack("audio0", audioSource)

        // Video (if requested)
        if (withVideo) {
            val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", EglBase.create().eglBaseContext)
            videoCapturer = createCameraCapturer()
            localVideoSource = factory.createVideoSource(videoCapturer!!.isScreencast)
            videoCapturer?.initialize(surfaceTextureHelper, context, localVideoSource?.capturerObserver)
            videoCapturer?.startCapture(1280, 720, 30)
            localVideoTrack = factory.createVideoTrack("video0", localVideoSource)
        }
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val cameraEnumerator = Camera2Enumerator(context)
        val deviceNames = cameraEnumerator.deviceNames

        // Try front camera first
        for (deviceName in deviceNames) {
            if (cameraEnumerator.isFrontFacing(deviceName)) {
                return cameraEnumerator.createCapturer(deviceName, null)
            }
        }
        // Fall back to any camera
        for (deviceName in deviceNames) {
            return cameraEnumerator.createCapturer(deviceName, null)
        }
        return null
    }

    private fun addLocalTracksToConnection(peerConnection: PeerConnection, withVideo: Boolean) {
        localAudioTrack?.let { audio ->
            peerConnection.addTrack(audio, listOf("stream0"))
        }
        if (withVideo) {
            localVideoTrack?.let { video ->
                peerConnection.addTrack(video, listOf("stream0"))
            }
        }
    }

    private suspend fun handleIceConnectionStateChange(callId: String, state: PeerConnection.IceConnectionState) {
        val callState = _activeCalls.value[callId] ?: return

        when (state) {
            PeerConnection.IceConnectionState.CONNECTED,
            PeerConnection.IceConnectionState.COMPLETED -> {
                updateCallState(callState.copy(
                    state = "connected",
                    connectedAt = callState.connectedAt ?: (System.currentTimeMillis() / 1000)
                ))
                if (callState.connectedAt == null) {
                    repository.markCallConnected(callId)
                }
            }
            PeerConnection.IceConnectionState.DISCONNECTED -> {
                updateCallState(callState.copy(state = "reconnecting"))
            }
            PeerConnection.IceConnectionState.FAILED -> {
                cleanupCall(callId)
                repository.markCallEnded(callId, "network_failure")
            }
            else -> {}
        }
    }

    // ============== Signaling ==============

    private suspend fun sendSignalingMessage(recipientPubkey: String, content: String, kind: Int) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        // For privacy, use NIP-17 gift wrap
        val giftWrap = cryptoManager.createGiftWrap(recipientPubkey, content)

        if (giftWrap != null) {
            nostrClient.publishEvent(
                NostrEvent(
                    id = giftWrap.id,
                    pubkey = giftWrap.pubkey,
                    createdAt = giftWrap.createdAt,
                    kind = giftWrap.kind,
                    tags = giftWrap.tags,
                    content = giftWrap.content,
                    sig = giftWrap.sig
                )
            )
        } else {
            // Fallback to plain signaling (less private)
            val unsigned = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = kind,
                tags = listOf(listOf("p", recipientPubkey)),
                content = content
            )

            val signed = cryptoManager.signEvent(unsigned) ?: return

            nostrClient.publishEvent(
                NostrEvent(
                    id = signed.id,
                    pubkey = signed.pubkey,
                    createdAt = signed.createdAt,
                    kind = signed.kind,
                    tags = signed.tags,
                    content = signed.content,
                    sig = signed.sig
                )
            )
        }
    }

    private suspend fun sendIceCandidate(callId: String, recipientPubkey: String, candidate: IceCandidate) {
        val iceCandidate = CallIceCandidate(
            v = "1.0.0",
            callID = callId,
            candidate = Candidate(
                candidate = candidate.sdp,
                sdpMid = candidate.sdpMid,
                sdpMLineIndex = candidate.sdpMLineIndex.toLong()
            )
        )

        sendSignalingMessage(recipientPubkey, json.encodeToString(iceCandidate), CallingModuleImpl.KIND_ICE_CANDIDATE)
    }

    private suspend fun sendHangup(callId: String, recipientPubkey: String, reason: Reason) {
        val hangup = CallHangup(
            v = "1.0.0",
            callID = callId,
            reason = reason,
            timestamp = System.currentTimeMillis() / 1000
        )

        sendSignalingMessage(recipientPubkey, json.encodeToString(hangup), CallingModuleImpl.KIND_CALL_HANGUP)
    }

    // ============== State Management ==============

    private fun updateCallState(callState: ActiveCallState) {
        _activeCalls.update { current ->
            current + (callState.callId to callState)
        }
        if (_currentCall.value?.callId == callState.callId) {
            _currentCall.value = callState
        }
    }

    private fun cleanupCall(callId: String) {
        // Remove from active calls
        _activeCalls.update { current ->
            current - callId
        }
        if (_currentCall.value?.callId == callId) {
            _currentCall.value = null
        }

        // Cleanup peer connection
        peerConnections.remove(callId)?.apply {
            close()
            dispose()
        }

        // Cleanup media if no more active calls
        if (_activeCalls.value.isEmpty()) {
            videoCapturer?.stopCapture()
            videoCapturer?.dispose()
            videoCapturer = null

            localAudioTrack?.dispose()
            localAudioTrack = null

            localVideoTrack?.dispose()
            localVideoTrack = null

            localVideoSource?.dispose()
            localVideoSource = null

            _remoteVideoTrack.value = null
            _remoteAudioTrack.value = null
        }
    }

    // ============== Call History ==============

    /**
     * Get all call history.
     */
    fun getCallHistory(): Flow<List<CallHistory>> {
        return repository.getAllCalls()
    }

    /**
     * Get recent calls.
     */
    fun getRecentCalls(limit: Int = 50): Flow<List<CallHistory>> {
        return repository.getRecentCalls(limit)
    }

    /**
     * Get missed calls.
     */
    fun getMissedCalls(): Flow<List<CallHistory>> {
        return repository.getMissedCalls()
    }

    /**
     * Get missed call count.
     */
    fun getMissedCallCount(): Flow<Int> {
        return repository.getMissedCallCount()
    }

    /**
     * Delete call from history.
     */
    suspend fun deleteCallFromHistory(callId: String) {
        repository.deleteCall(callId)
    }

    /**
     * Clear all call history.
     */
    suspend fun clearCallHistory() {
        repository.clearAllHistory()
    }

    // ============== Settings ==============

    /**
     * Get call settings.
     */
    suspend fun getSettings(): CallSettingsEntity? {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return null
        return repository.getOrCreateSettings(pubkey)
    }

    /**
     * Observe call settings.
     */
    fun observeSettings(): Flow<CallSettingsEntity?> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(null)
        return repository.observeSettingsEntity(pubkey)
    }

    /**
     * Update settings.
     */
    suspend fun updateSettings(settings: CallSettingsEntity) {
        repository.updateSettings(settings)
    }

    /**
     * Toggle do not disturb.
     */
    suspend fun toggleDoNotDisturb(): Boolean {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return false
        val current = repository.isDoNotDisturb(pubkey)
        repository.setDoNotDisturb(pubkey, !current)
        return !current
    }

    companion object {
        private const val TAG = "CallingUseCase"
    }
}

/**
 * Event data for incoming calls.
 */
data class IncomingCallEvent(
    val callId: String,
    val callerPubkey: String,
    val callerName: String?,
    val callType: CallType,
    val timestamp: Long
)

/**
 * Simple SDP observer for WebRTC callbacks.
 */
private class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(sdp: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String) {
        android.util.Log.e("SimpleSdpObserver", "Create failed: $error")
    }
    override fun onSetFailure(error: String) {
        android.util.Log.e("SimpleSdpObserver", "Set failed: $error")
    }
}

/**
 * Kotlin coroutine helper for suspendCoroutine.
 */
private suspend inline fun <T> suspendCoroutine(
    crossinline block: (kotlin.coroutines.Continuation<T>) -> Unit
): T {
    return kotlin.coroutines.suspendCoroutine { continuation ->
        block(continuation)
    }
}
