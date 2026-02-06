package network.buildit.modules.calling.service

import network.buildit.core.redacted
import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.webrtc.*
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Maximum participants for mesh topology
 */
private const val MAX_MESH_PARTICIPANTS = 8

/**
 * Connection timeout in milliseconds
 */
private const val CONNECTION_TIMEOUT_MS = 30_000L

/**
 * Mesh Call Manager
 * Manages peer-to-peer mesh topology for small group calls (2-8 participants).
 * Each participant connects directly to every other participant with full E2EE.
 */
@Singleton
class MeshCallManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "MeshCallManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // WebRTC
    private val eglBase: EglBase = EglBase.create()
    private val peerConnectionFactory: PeerConnectionFactory by lazy {
        initializePeerConnectionFactory()
    }

    // Room state
    private val _roomId = MutableStateFlow<String?>(null)
    val roomId: StateFlow<String?> = _roomId.asStateFlow()

    private val _groupId = MutableStateFlow<String?>(null)
    val groupId: StateFlow<String?> = _groupId.asStateFlow()

    private val _callType = MutableStateFlow(CallType.VOICE)
    val callType: StateFlow<CallType> = _callType.asStateFlow()

    private val _isHost = MutableStateFlow(false)
    val isHost: StateFlow<Boolean> = _isHost.asStateFlow()

    private val _isRoomLocked = MutableStateFlow(false)
    val isRoomLocked: StateFlow<Boolean> = _isRoomLocked.asStateFlow()

    // Local state
    private var localPubkey: String = ""
    private var localDisplayName: String? = null

    private val _localStream = MutableStateFlow<MediaStream?>(null)
    val localStream: StateFlow<MediaStream?> = _localStream.asStateFlow()

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()

    private val _isVideoEnabled = MutableStateFlow(true)
    val isVideoEnabled: StateFlow<Boolean> = _isVideoEnabled.asStateFlow()

    private val _isScreenSharing = MutableStateFlow(false)
    val isScreenSharing: StateFlow<Boolean> = _isScreenSharing.asStateFlow()

    // Participants
    private val _participants = MutableStateFlow<Map<String, ParticipantInfo>>(emptyMap())
    val participants: StateFlow<Map<String, ParticipantInfo>> = _participants.asStateFlow()

    // Connection state
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    // Events
    private val _events = MutableSharedFlow<MeshCallEvent>()
    val events: SharedFlow<MeshCallEvent> = _events.asSharedFlow()

    // Peer connections
    private val peerConnections = mutableMapOf<String, PeerConnection>()
    private val pendingIceCandidates = mutableMapOf<String, MutableList<IceCandidate>>()

    // Local tracks
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null

    // E2EE
    private var keyManager: GroupKeyManager? = null

    // Audio
    private val audioMixer = AudioMixer()
    private val speakerDetector = ActiveSpeakerDetector()

    // Call duration
    private var callStartTime: Long = 0
    private val _callDuration = MutableStateFlow(0L)
    val callDuration: StateFlow<Long> = _callDuration.asStateFlow()
    private var durationJob: Job? = null
    private var audioLevelJob: Job? = null

    // ============================================
    // Types
    // ============================================

    enum class CallType {
        VOICE,
        VIDEO
    }

    enum class ConnectionState {
        CONNECTING,
        CONNECTED,
        DISCONNECTED
    }

    data class ParticipantInfo(
        val pubkey: String,
        var displayName: String? = null,
        var audioEnabled: Boolean = true,
        var videoEnabled: Boolean = true,
        var isSpeaking: Boolean = false,
        var videoTrack: VideoTrack? = null
    )

    sealed class MeshCallEvent {
        data class ParticipantJoined(val pubkey: String, val displayName: String?) : MeshCallEvent()
        data class ParticipantLeft(val pubkey: String) : MeshCallEvent()
        data class ParticipantStateChanged(val pubkey: String, val state: ParticipantState) : MeshCallEvent()
        data class RemoteTrack(val pubkey: String, val track: MediaStreamTrack) : MeshCallEvent()
        data class ActiveSpeakersChanged(val speakers: List<String>) : MeshCallEvent()
        data class DominantSpeakerChanged(val speaker: String?) : MeshCallEvent()
        data class ConnectionStateChanged(val state: ConnectionState) : MeshCallEvent()
        data class RoomClosed(val reason: String) : MeshCallEvent()
        data class Error(val error: Exception) : MeshCallEvent()
    }

    data class ParticipantState(
        val audioEnabled: Boolean,
        val videoEnabled: Boolean,
        val screenSharing: Boolean,
        val isSpeaking: Boolean
    )

    private data class PeerConnectionHolder(
        val connection: org.webrtc.PeerConnection,
        val pubkey: String,
        var displayName: String? = null,
        var state: PeerState = PeerState.CONNECTING,
        var audioEnabled: Boolean = true,
        var videoEnabled: Boolean = true,
        var remoteStream: MediaStream? = null
    )

    private enum class PeerState {
        CONNECTING,
        CONNECTED,
        DISCONNECTED,
        FAILED
    }

    // ============================================
    // Initialization
    // ============================================

    private fun initializePeerConnectionFactory(): PeerConnectionFactory {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(
            eglBase.eglBaseContext, true, true
        )
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        return PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .setOptions(PeerConnectionFactory.Options())
            .createPeerConnectionFactory()
    }

    fun setLocalIdentity(pubkey: String, displayName: String? = null) {
        this.localPubkey = pubkey
        this.localDisplayName = displayName
    }

    // ============================================
    // Room Management
    // ============================================

    /**
     * Create a new group call room
     */
    suspend fun createRoom(
        groupId: String? = null,
        callType: CallType = CallType.VOICE,
        maxParticipants: Int = MAX_MESH_PARTICIPANTS,
        invitedPubkeys: List<String>? = null
    ): String {
        if (_roomId.value != null) {
            throw MeshCallException.AlreadyInRoom()
        }

        val newRoomId = UUID.randomUUID().toString().lowercase()
        _roomId.value = newRoomId
        _groupId.value = groupId
        _callType.value = callType
        _isHost.value = true

        // Initialize key manager
        keyManager = GroupKeyManager(newRoomId)

        // Acquire local media
        acquireLocalMedia(callType == CallType.VIDEO)

        // Start room subscription
        startRoomSubscription()

        // Broadcast room creation
        broadcastRoomCreate(newRoomId, groupId, callType, maxParticipants, invitedPubkeys)

        // Generate sender key
        keyManager?.generateAndDistributeSenderKey(listOf(localPubkey))

        // Start timers
        startTimers()

        Log.i(TAG, "Created group call room: $newRoomId")
        return newRoomId
    }

    /**
     * Join an existing group call room
     */
    suspend fun joinRoom(roomId: String, displayName: String? = null) {
        if (_roomId.value != null) {
            throw MeshCallException.AlreadyInRoom()
        }

        _roomId.value = roomId
        localDisplayName = displayName
        _isHost.value = false

        // Initialize key manager
        keyManager = GroupKeyManager(roomId)

        // Acquire local media
        acquireLocalMedia(_callType.value == CallType.VIDEO)

        // Start room subscription
        startRoomSubscription()

        // Broadcast join
        broadcastJoin()

        // Start timers
        startTimers()

        Log.i(TAG, "Joined group call room: $roomId")
    }

    /**
     * Leave the current room
     */
    suspend fun leaveRoom() {
        if (_roomId.value == null) return

        // Broadcast leave
        broadcastLeave()

        // Clean up
        cleanup()

        Log.i(TAG, "Left group call room")
    }

    // ============================================
    // Peer Management
    // ============================================

    /**
     * Handle new participant joining
     */
    private suspend fun handleParticipantJoined(pubkey: String, displayName: String?) {
        if (pubkey == localPubkey) return
        if (peerConnections.containsKey(pubkey)) return

        Log.i(TAG, "Participant joined: ${pubkey.redacted()}")

        // Add to participants list
        val currentParticipants = _participants.value.toMutableMap()
        currentParticipants[pubkey] = ParticipantInfo(
            pubkey = pubkey,
            displayName = displayName,
            videoEnabled = _callType.value == CallType.VIDEO
        )
        _participants.value = currentParticipants

        // Determine who initiates (lower pubkey initiates)
        if (localPubkey < pubkey) {
            connectToPeer(pubkey, displayName)
        }

        _events.emit(MeshCallEvent.ParticipantJoined(pubkey, displayName))

        // Redistribute sender key
        keyManager?.let { km ->
            val allParticipants = listOf(localPubkey) + peerConnections.keys + pubkey
            km.generateAndDistributeSenderKey(allParticipants)
        }
    }

    /**
     * Handle participant leaving
     */
    private suspend fun handleParticipantLeft(pubkey: String) {
        if (pubkey == localPubkey) return

        Log.i(TAG, "Participant left: ${pubkey.redacted()}")

        // Clean up peer connection
        cleanupPeer(pubkey)

        // Remove from participants
        val currentParticipants = _participants.value.toMutableMap()
        currentParticipants.remove(pubkey)
        _participants.value = currentParticipants

        _events.emit(MeshCallEvent.ParticipantLeft(pubkey))

        // Rotate sender key for forward secrecy
        keyManager?.let { km ->
            val remaining = listOf(localPubkey) + peerConnections.keys
            km.handleParticipantLeft(pubkey, remaining)
        }
    }

    /**
     * Connect to a peer
     */
    private suspend fun connectToPeer(pubkey: String, displayName: String? = null) {
        if (peerConnections.containsKey(pubkey)) {
            Log.w(TAG, "Already connected to peer: ${pubkey.redacted()}")
            return
        }

        Log.i(TAG, "Connecting to peer: ${pubkey.redacted()}")

        // Create peer connection
        val pc = createPeerConnection(pubkey) ?: run {
            Log.e(TAG, "Failed to create peer connection for: ${pubkey.redacted()}")
            return
        }

        peerConnections[pubkey] = pc

        // Add local tracks
        localAudioTrack?.let { pc.addTrack(it, listOf("local")) }
        localVideoTrack?.let { pc.addTrack(it, listOf("local")) }

        // Create and send offer
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        scope.launch {
                            sendSignalingMessage(pubkey, SignalingType.OFFER, mapOf(
                                "roomId" to (_roomId.value ?: ""),
                                "sdp" to sdp.description,
                                "callType" to _callType.value.name.lowercase()
                            ))
                        }
                    }
                    override fun onSetFailure(error: String) {
                        Log.e(TAG, "Failed to set local description: $error")
                    }
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String) {
                Log.e(TAG, "Failed to create offer: $error")
                cleanupPeer(pubkey)
            }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)

        // Set connection timeout
        scope.launch {
            delay(CONNECTION_TIMEOUT_MS)
            val currentPc = peerConnections[pubkey]
            if (currentPc?.connectionState() == org.webrtc.PeerConnection.PeerConnectionState.CONNECTING) {
                Log.w(TAG, "Connection timeout: $pubkey")
                cleanupPeer(pubkey)
                _events.emit(MeshCallEvent.Error(MeshCallException.ConnectionTimeout()))
            }
        }
    }

    /**
     * Handle incoming offer
     */
    suspend fun handleOffer(senderPubkey: String, sdp: String, callType: CallType) {
        // Lower pubkey should initiate
        if (senderPubkey > localPubkey) {
            Log.w(TAG, "Received offer from higher pubkey (they shouldn't initiate): $senderPubkey")
            return
        }

        if (peerConnections.containsKey(senderPubkey)) {
            Log.w(TAG, "Already have connection to peer: $senderPubkey")
            return
        }

        Log.i(TAG, "Received offer from peer: $senderPubkey")

        // Create peer connection
        val pc = createPeerConnection(senderPubkey) ?: run {
            Log.e(TAG, "Failed to create peer connection for: $senderPubkey")
            return
        }

        peerConnections[senderPubkey] = pc

        // Add local tracks
        localAudioTrack?.let { pc.addTrack(it, listOf("local")) }
        localVideoTrack?.let { pc.addTrack(it, listOf("local")) }

        // Set remote description
        val remoteDesc = SessionDescription(SessionDescription.Type.OFFER, sdp)
        pc.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                // Process pending ICE candidates
                pendingIceCandidates[senderPubkey]?.forEach { candidate ->
                    pc.addIceCandidate(candidate)
                }
                pendingIceCandidates.remove(senderPubkey)

                // Create answer
                val constraints = MediaConstraints()
                pc.createAnswer(object : SdpObserver {
                    override fun onCreateSuccess(sdp: SessionDescription) {
                        pc.setLocalDescription(object : SdpObserver {
                            override fun onSetSuccess() {
                                scope.launch {
                                    sendSignalingMessage(senderPubkey, SignalingType.ANSWER, mapOf(
                                        "roomId" to (_roomId.value ?: ""),
                                        "sdp" to sdp.description
                                    ))
                                }
                            }
                            override fun onSetFailure(error: String) {
                                Log.e(TAG, "Failed to set local description: $error")
                            }
                            override fun onCreateSuccess(sdp: SessionDescription?) {}
                            override fun onCreateFailure(error: String?) {}
                        }, sdp)
                    }
                    override fun onCreateFailure(error: String) {
                        Log.e(TAG, "Failed to create answer: $error")
                        cleanupPeer(senderPubkey)
                    }
                    override fun onSetSuccess() {}
                    override fun onSetFailure(error: String?) {}
                }, constraints)
            }
            override fun onSetFailure(error: String) {
                Log.e(TAG, "Failed to set remote description: $error")
                cleanupPeer(senderPubkey)
            }
            override fun onCreateSuccess(sdp: SessionDescription?) {}
            override fun onCreateFailure(error: String?) {}
        }, remoteDesc)
    }

    /**
     * Handle incoming answer
     */
    suspend fun handleAnswer(senderPubkey: String, sdp: String) {
        val pc = peerConnections[senderPubkey] ?: run {
            Log.w(TAG, "Received answer for unknown peer: $senderPubkey")
            return
        }

        Log.i(TAG, "Received answer from peer: $senderPubkey")

        val remoteDesc = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        pc.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                // Process pending ICE candidates
                pendingIceCandidates[senderPubkey]?.forEach { candidate ->
                    pc.addIceCandidate(candidate)
                }
                pendingIceCandidates.remove(senderPubkey)
            }
            override fun onSetFailure(error: String) {
                Log.e(TAG, "Failed to set remote description: $error")
            }
            override fun onCreateSuccess(sdp: SessionDescription?) {}
            override fun onCreateFailure(error: String?) {}
        }, remoteDesc)
    }

    /**
     * Handle incoming ICE candidate
     */
    fun handleIceCandidate(senderPubkey: String, candidate: IceCandidate) {
        val pc = peerConnections[senderPubkey]
        if (pc != null && pc.remoteDescription != null) {
            pc.addIceCandidate(candidate)
        } else {
            // Store for later
            val pending = pendingIceCandidates.getOrPut(senderPubkey) { mutableListOf() }
            pending.add(candidate)
        }
    }

    // ============================================
    // Local Media
    // ============================================

    private fun acquireLocalMedia(withVideo: Boolean) {
        // Create audio track
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
        }
        val audioSource = peerConnectionFactory.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory.createAudioTrack("audio0", audioSource)
        localAudioTrack?.setEnabled(!_isMuted.value)

        // Create video track if needed
        if (withVideo) {
            surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)

            val videoSource = peerConnectionFactory.createVideoSource(false)

            // Use camera 2 enumerator
            val enumerator = Camera2Enumerator(context)
            val deviceNames = enumerator.deviceNames

            // Find front camera
            val frontCamera = deviceNames.find { enumerator.isFrontFacing(it) }
                ?: deviceNames.firstOrNull()

            frontCamera?.let { cameraName ->
                videoCapturer = enumerator.createCapturer(cameraName, null)
                videoCapturer?.initialize(
                    surfaceTextureHelper,
                    context,
                    videoSource.capturerObserver
                )
                videoCapturer?.startCapture(1280, 720, 30)
            }

            localVideoTrack = peerConnectionFactory.createVideoTrack("video0", videoSource)
            localVideoTrack?.setEnabled(_isVideoEnabled.value)
        }

        // Create local stream
        _localStream.value = peerConnectionFactory.createLocalMediaStream("local").apply {
            localAudioTrack?.let { addTrack(it) }
            localVideoTrack?.let { addTrack(it) }
        }

        Log.i(TAG, "Acquired local media: audio=${localAudioTrack != null}, video=${localVideoTrack != null}")
    }

    // ============================================
    // Controls
    // ============================================

    /**
     * Toggle mute
     */
    fun toggleMute(): Boolean {
        _isMuted.value = !_isMuted.value
        localAudioTrack?.setEnabled(!_isMuted.value)

        broadcastStateChange(audioEnabled = !_isMuted.value)

        return _isMuted.value
    }

    /**
     * Toggle video
     */
    fun toggleVideo(): Boolean {
        _isVideoEnabled.value = !_isVideoEnabled.value
        localVideoTrack?.setEnabled(_isVideoEnabled.value)

        broadcastStateChange(videoEnabled = _isVideoEnabled.value)

        return _isVideoEnabled.value
    }

    /**
     * Start screen sharing
     */
    suspend fun startScreenShare() {
        // Android screen share requires user permission and MediaProjection
        // This is a placeholder - full implementation requires more setup
        _isScreenSharing.value = true
        broadcastStateChange(screenSharing = true)
    }

    /**
     * Stop screen sharing
     */
    suspend fun stopScreenShare() {
        _isScreenSharing.value = false
        broadcastStateChange(screenSharing = false)
    }

    /**
     * Request mute from participant (host only)
     */
    suspend fun requestMute(pubkey: String) {
        if (!_isHost.value) {
            throw MeshCallException.HostOnly()
        }
        sendSignalingMessage(pubkey, SignalingType.MUTE_REQUEST, mapOf("roomId" to (_roomId.value ?: "")))
    }

    /**
     * Remove participant (host only)
     */
    suspend fun removeParticipant(pubkey: String) {
        if (!_isHost.value) {
            throw MeshCallException.HostOnly()
        }
        sendSignalingMessage(pubkey, SignalingType.REMOVE, mapOf("roomId" to (_roomId.value ?: "")))
        cleanupPeer(pubkey)
        val currentParticipants = _participants.value.toMutableMap()
        currentParticipants.remove(pubkey)
        _participants.value = currentParticipants
        _events.emit(MeshCallEvent.ParticipantLeft(pubkey))
    }

    /**
     * Lock the room (host only)
     */
    fun lockRoom() {
        if (!_isHost.value) {
            throw MeshCallException.HostOnly()
        }
        _isRoomLocked.value = true
        broadcastRoomState(locked = true)
    }

    /**
     * Unlock the room (host only)
     */
    fun unlockRoom() {
        if (!_isHost.value) {
            throw MeshCallException.HostOnly()
        }
        _isRoomLocked.value = false
        broadcastRoomState(locked = false)
    }

    /**
     * End the call for everyone (host only)
     */
    suspend fun endCall() {
        if (!_isHost.value) {
            throw MeshCallException.HostOnly()
        }

        for (pubkey in peerConnections.keys) {
            sendSignalingMessage(pubkey, SignalingType.END, mapOf("roomId" to (_roomId.value ?: "")))
        }

        cleanup()
        _events.emit(MeshCallEvent.RoomClosed("host_ended"))
    }

    // ============================================
    // WebRTC Helpers
    // ============================================

    private fun createPeerConnection(pubkey: String): org.webrtc.PeerConnection? {
        val iceServers = listOf(
            org.webrtc.PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            org.webrtc.PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )

        val config = org.webrtc.PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = org.webrtc.PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = org.webrtc.PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val observer = object : org.webrtc.PeerConnection.Observer {
            override fun onSignalingChange(state: org.webrtc.PeerConnection.SignalingState) {}

            override fun onIceConnectionChange(state: org.webrtc.PeerConnection.IceConnectionState) {
                Log.d(TAG, "ICE connection state for $pubkey: $state")
                scope.launch {
                    when (state) {
                        org.webrtc.PeerConnection.IceConnectionState.CONNECTED -> {
                            updateConnectionState()
                        }
                        org.webrtc.PeerConnection.IceConnectionState.DISCONNECTED,
                        org.webrtc.PeerConnection.IceConnectionState.FAILED -> {
                            cleanupPeer(pubkey)
                            _events.emit(MeshCallEvent.ParticipantLeft(pubkey))
                        }
                        else -> {}
                    }
                }
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {}

            override fun onIceGatheringChange(state: org.webrtc.PeerConnection.IceGatheringState) {}

            override fun onIceCandidate(candidate: IceCandidate) {
                scope.launch {
                    sendSignalingMessage(pubkey, SignalingType.ICE, mapOf(
                        "roomId" to (_roomId.value ?: ""),
                        "candidate" to mapOf(
                            "candidate" to candidate.sdp,
                            "sdpMid" to candidate.sdpMid,
                            "sdpMLineIndex" to candidate.sdpMLineIndex
                        )
                    ))
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}

            override fun onAddStream(stream: MediaStream) {
                Log.d(TAG, "Stream added from $pubkey")
                scope.launch {
                    stream.videoTracks.firstOrNull()?.let { track ->
                        val currentParticipants = _participants.value.toMutableMap()
                        currentParticipants[pubkey]?.let { info ->
                            currentParticipants[pubkey] = info.copy(videoTrack = track)
                            _participants.value = currentParticipants
                        }
                        _events.emit(MeshCallEvent.RemoteTrack(pubkey, track))
                    }
                }
            }

            override fun onRemoveStream(stream: MediaStream) {}

            override fun onDataChannel(channel: DataChannel) {}

            override fun onRenegotiationNeeded() {}

            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {}

            override fun onTrack(transceiver: RtpTransceiver) {}
        }

        return peerConnectionFactory.createPeerConnection(config, observer)
    }

    // ============================================
    // Signaling
    // ============================================

    private enum class SignalingType {
        OFFER,
        ANSWER,
        ICE,
        STATE,
        MUTE_REQUEST,
        REMOVE,
        END
    }

    private suspend fun sendSignalingMessage(pubkey: String, type: SignalingType, data: Map<String, Any>) {
        // In real implementation, send via Nostr NIP-17 gift wrap
        Log.d(TAG, "Send signaling to $pubkey: ${type.name}")
    }

    private fun startRoomSubscription() {
        // In real implementation, subscribe to Nostr events for room
        Log.i(TAG, "Started room subscription")
    }

    private fun broadcastRoomCreate(
        roomId: String,
        groupId: String?,
        callType: CallType,
        maxParticipants: Int,
        invitedPubkeys: List<String>?
    ) {
        // In real implementation, broadcast via Nostr
        Log.i(TAG, "Broadcast room create: $roomId")
    }

    private fun broadcastJoin() {
        // In real implementation, broadcast via Nostr
        Log.i(TAG, "Broadcast join")
    }

    private fun broadcastLeave() {
        // In real implementation, broadcast via Nostr
        Log.i(TAG, "Broadcast leave")
    }

    private fun broadcastStateChange(
        audioEnabled: Boolean? = null,
        videoEnabled: Boolean? = null,
        screenSharing: Boolean? = null
    ) {
        // In real implementation, broadcast state change to all peers
        Log.d(TAG, "Broadcast state change")
    }

    private fun broadcastRoomState(locked: Boolean) {
        // In real implementation, broadcast room state change
        Log.d(TAG, "Broadcast room state: locked=$locked")
    }

    // ============================================
    // Connection State
    // ============================================

    private fun updateConnectionState() {
        val states = peerConnections.values.map { it.connectionState() }

        _connectionState.value = when {
            states.isEmpty() -> ConnectionState.DISCONNECTED
            states.all { it == org.webrtc.PeerConnection.PeerConnectionState.CONNECTED } -> ConnectionState.CONNECTED
            states.any { it == org.webrtc.PeerConnection.PeerConnectionState.CONNECTING } -> ConnectionState.CONNECTING
            else -> ConnectionState.DISCONNECTED
        }

        scope.launch {
            _events.emit(MeshCallEvent.ConnectionStateChanged(_connectionState.value))
        }
    }

    // ============================================
    // Timers
    // ============================================

    private fun startTimers() {
        callStartTime = System.currentTimeMillis()

        // Duration timer
        durationJob = scope.launch {
            while (true) {
                delay(1000)
                _callDuration.value = (System.currentTimeMillis() - callStartTime) / 1000
            }
        }

        // Audio level timer
        audioLevelJob = scope.launch {
            while (true) {
                delay(100)
                updateAudioLevels()
            }
        }
    }

    private fun updateAudioLevels() {
        // In real implementation, get audio levels and update speaker detector
    }

    // ============================================
    // Cleanup
    // ============================================

    private fun cleanupPeer(pubkey: String) {
        peerConnections[pubkey]?.dispose()
        peerConnections.remove(pubkey)
        pendingIceCandidates.remove(pubkey)
        audioMixer.removeParticipant(pubkey)
        speakerDetector.removeParticipant(pubkey)
    }

    private fun cleanup() {
        // Stop timers
        durationJob?.cancel()
        durationJob = null
        audioLevelJob?.cancel()
        audioLevelJob = null

        // Close all peer connections
        peerConnections.keys.toList().forEach { cleanupPeer(it) }

        // Stop local tracks
        localAudioTrack?.dispose()
        localAudioTrack = null
        localVideoTrack?.dispose()
        localVideoTrack = null
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        _localStream.value = null

        // Close key manager
        keyManager = null

        // Clear audio
        audioMixer.close()
        speakerDetector.clear()

        // Reset state
        _roomId.value = null
        _groupId.value = null
        _isHost.value = false
        _isRoomLocked.value = false
        _isMuted.value = false
        _isVideoEnabled.value = true
        _isScreenSharing.value = false
        _participants.value = emptyMap()
        _connectionState.value = ConnectionState.DISCONNECTED
        callStartTime = 0
        _callDuration.value = 0
    }

    /**
     * Close the manager
     */
    fun close() {
        cleanup()
        scope.cancel()
        eglBase.release()
        Log.i(TAG, "MeshCallManager closed")
    }

    // ============================================
    // Getters
    // ============================================

    val participantCount: Int
        get() = _participants.value.size + 1 // +1 for self

    val isAtCapacity: Boolean
        get() = participantCount >= MAX_MESH_PARTICIPANTS

    /**
     * Get EGL context for rendering
     */
    fun getEglContext(): EglBase.Context = eglBase.eglBaseContext
}

// ============================================
// Exceptions
// ============================================

sealed class MeshCallException(message: String) : Exception(message) {
    class AlreadyInRoom : MeshCallException("Already in a room")
    class NotInRoom : MeshCallException("Not in a room")
    class ConnectionTimeout : MeshCallException("Connection timed out")
    class HostOnly : MeshCallException("Only the host can perform this action")
}

// ============================================
// Supporting Classes (placeholders)
// ============================================

private class GroupKeyManager(private val roomId: String) {
    fun generateAndDistributeSenderKey(participants: List<String>) {
        // Implementation in separate file
    }

    fun handleParticipantLeft(pubkey: String, remainingParticipants: List<String>) {
        // Implementation in separate file
    }
}

private class AudioMixer {
    fun removeParticipant(pubkey: String) {}
    fun close() {}
}

private class ActiveSpeakerDetector {
    fun removeParticipant(pubkey: String) {}
    fun clear() {}
}
