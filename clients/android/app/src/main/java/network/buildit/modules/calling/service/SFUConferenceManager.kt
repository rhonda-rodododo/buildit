package network.buildit.modules.calling.service

import android.content.Context
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
import org.webrtc.*
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Maximum participants for SFU conference
 */
private const val MAX_CONFERENCE_PARTICIPANTS = 100

/**
 * Reconnection timeout in milliseconds
 */
private const val RECONNECTION_TIMEOUT_MS = 30_000L

/**
 * Maximum reconnection attempts
 */
private const val MAX_RECONNECTION_ATTEMPTS = 5

/**
 * SFU Conference Manager
 * Manages SFU topology conferences for 50+ participants with MLS E2EE,
 * simulcast encoding, and multi-region support.
 */
@Singleton
class SFUConferenceManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "SFUConferenceManager"
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

    private val _isHost = MutableStateFlow(false)
    val isHost: StateFlow<Boolean> = _isHost.asStateFlow()

    private val _localRole = MutableStateFlow(ParticipantRole.PARTICIPANT)
    val localRole: StateFlow<ParticipantRole> = _localRole.asStateFlow()

    private val _connectionState = MutableStateFlow(SFUConnectionState.DISCONNECTED)
    val connectionState: StateFlow<SFUConnectionState> = _connectionState.asStateFlow()

    // Local state
    private var localPubkey: String = ""
    private var localDisplayName: String? = null

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()

    private val _isVideoEnabled = MutableStateFlow(true)
    val isVideoEnabled: StateFlow<Boolean> = _isVideoEnabled.asStateFlow()

    private val _isScreenSharing = MutableStateFlow(false)
    val isScreenSharing: StateFlow<Boolean> = _isScreenSharing.asStateFlow()

    // Participants
    private val _participants = MutableStateFlow<Map<String, ConferenceParticipant>>(emptyMap())
    val participants: StateFlow<Map<String, ConferenceParticipant>> = _participants.asStateFlow()

    // Conference settings
    private val _waitingRoomEnabled = MutableStateFlow(true)
    val waitingRoomEnabled: StateFlow<Boolean> = _waitingRoomEnabled.asStateFlow()

    private val _muteOnJoin = MutableStateFlow(true)
    val muteOnJoin: StateFlow<Boolean> = _muteOnJoin.asStateFlow()

    // Events
    private val _events = MutableSharedFlow<ConferenceEvent>()
    val events: SharedFlow<ConferenceEvent> = _events.asSharedFlow()

    // SFU connection
    private var sfuConnection: PeerConnection? = null
    private var audioSender: RtpSender? = null
    private var videoSender: RtpSender? = null

    // Local tracks
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null

    // E2EE (MLS)
    private var mlsKeyManager: MLSKeyManager? = null

    // Simulcast
    private var simulcastManager: SimulcastManager? = null

    // Call duration
    private var callStartTime: Long = 0
    private val _callDuration = MutableStateFlow(0L)
    val callDuration: StateFlow<Long> = _callDuration.asStateFlow()
    private var durationJob: Job? = null

    // Reconnection
    private var reconnectionAttempts = 0

    // ============================================
    // Types
    // ============================================

    enum class SFUConnectionState {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        RECONNECTING,
        FAILED
    }

    enum class ParticipantRole {
        HOST,
        CO_HOST,
        MODERATOR,
        PARTICIPANT,
        VIEWER
    }

    enum class QualityLayer {
        LOW,
        MEDIUM,
        HIGH
    }

    enum class TrackKind {
        AUDIO,
        VIDEO,
        SCREEN_SHARE
    }

    data class ConferenceParticipant(
        val pubkey: String,
        var displayName: String? = null,
        var role: ParticipantRole = ParticipantRole.PARTICIPANT,
        var audioEnabled: Boolean = true,
        var videoEnabled: Boolean = true,
        var screenSharing: Boolean = false,
        var handRaised: Boolean = false,
        var isSpeaking: Boolean = false,
        var subscribedQuality: QualityLayer = QualityLayer.MEDIUM,
        var videoTrack: VideoTrack? = null,
        var screenShareTrack: VideoTrack? = null
    )

    data class ConferenceSettings(
        val waitingRoom: Boolean = true,
        val muteOnJoin: Boolean = true,
        val hostOnlyScreenShare: Boolean = false,
        val e2ee: Boolean = true,
        val maxParticipants: Int = 100
    )

    sealed class ConferenceEvent {
        data class ParticipantJoined(
            val pubkey: String,
            val displayName: String?,
            val role: ParticipantRole
        ) : ConferenceEvent()
        data class ParticipantLeft(val pubkey: String) : ConferenceEvent()
        data class ParticipantStateChanged(
            val pubkey: String,
            val state: ConferenceParticipantState
        ) : ConferenceEvent()
        data class TrackSubscribed(
            val pubkey: String,
            val track: MediaStreamTrack,
            val kind: TrackKind
        ) : ConferenceEvent()
        data class TrackUnsubscribed(val pubkey: String, val kind: TrackKind) : ConferenceEvent()
        data class ActiveSpeakerChanged(val pubkey: String?) : ConferenceEvent()
        data class QualityChanged(val pubkey: String, val quality: QualityLayer) : ConferenceEvent()
        data class ConnectionStateChanged(val state: SFUConnectionState) : ConferenceEvent()
        data class MLSEpochChanged(val epoch: Int) : ConferenceEvent()
        data class RoomClosed(val reason: String) : ConferenceEvent()
        data class Error(val error: Exception) : ConferenceEvent()
    }

    data class ConferenceParticipantState(
        val audioEnabled: Boolean,
        val videoEnabled: Boolean,
        val screenSharing: Boolean,
        val handRaised: Boolean,
        val isSpeaking: Boolean
    )

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
            .createPeerConnectionFactory()
    }

    // ============================================
    // Room Management
    // ============================================

    /**
     * Create a new conference room
     */
    suspend fun createConference(
        localPubkey: String,
        displayName: String? = null,
        settings: ConferenceSettings = ConferenceSettings()
    ): String {
        if (_roomId.value != null) {
            throw ConferenceException.AlreadyInRoom()
        }

        this.localPubkey = localPubkey
        this.localDisplayName = displayName

        val newRoomId = UUID.randomUUID().toString().lowercase()
        _roomId.value = newRoomId
        _isHost.value = true
        _localRole.value = ParticipantRole.HOST
        _waitingRoomEnabled.value = settings.waitingRoom
        _muteOnJoin.value = settings.muteOnJoin

        // Initialize MLS key manager
        mlsKeyManager = MLSKeyManager(newRoomId, localPubkey)

        // Initialize simulcast manager
        simulcastManager = SimulcastManager()

        // Connect to SFU
        connectToSFU(newRoomId)

        // Initialize MLS group
        mlsKeyManager?.initializeGroup(listOf(localPubkey))

        // Start timers
        startTimers()

        _connectionState.value = SFUConnectionState.CONNECTED
        _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.CONNECTED))

        Log.i(TAG, "Created conference room: $newRoomId")
        return newRoomId
    }

    /**
     * Join an existing conference
     */
    suspend fun joinConference(
        roomId: String,
        localPubkey: String,
        displayName: String? = null
    ) {
        if (_roomId.value != null) {
            throw ConferenceException.AlreadyInRoom()
        }

        this.localPubkey = localPubkey
        this.localDisplayName = displayName

        _roomId.value = roomId
        _isHost.value = false
        _localRole.value = ParticipantRole.PARTICIPANT

        _connectionState.value = SFUConnectionState.CONNECTING
        _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.CONNECTING))

        // Initialize MLS key manager
        mlsKeyManager = MLSKeyManager(roomId, localPubkey)

        // Initialize simulcast manager
        simulcastManager = SimulcastManager()

        // Connect to SFU
        connectToSFU(roomId)

        // Start timers
        startTimers()

        _connectionState.value = SFUConnectionState.CONNECTED
        _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.CONNECTED))

        Log.i(TAG, "Joined conference room: $roomId")
    }

    /**
     * Leave the conference
     */
    suspend fun leaveConference() {
        if (_roomId.value == null) return

        try {
            notifySFULeaving()
        } catch (e: Exception) {
            Log.w(TAG, "Error notifying SFU: ${e.message}")
        }

        cleanup()
        Log.i(TAG, "Left conference room")
    }

    // ============================================
    // SFU Connection
    // ============================================

    private suspend fun connectToSFU(roomId: String) {
        val pc = createSFUPeerConnection() ?: throw ConferenceException.ConnectionFailed()
        sfuConnection = pc

        // Acquire local media
        acquireLocalMedia()

        // Add local audio track
        localAudioTrack?.let { audio ->
            audioSender = pc.addTrack(audio, listOf("local"))
        }

        // Add local video track with simulcast encoding
        localVideoTrack?.let { video ->
            val transceiver = pc.addTransceiver(video, RtpTransceiver.RtpTransceiverInit(
                RtpTransceiver.RtpTransceiverDirection.SEND_ONLY,
                listOf("local")
            ))
            transceiver?.sender?.let { sender ->
                videoSender = sender
                configureSimulcastEncodings(sender)
            }
        }

        // Create offer and send to SFU
        val constraints = MediaConstraints()
        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onSetSuccess() {
                        Log.i(TAG, "SFU offer created and set")
                    }
                    override fun onCreateFailure(p0: String?) {}
                    override fun onSetFailure(p0: String?) {}
                }, sdp)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Create offer failed: $error")
            }
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    private fun configureSimulcastEncodings(sender: RtpSender) {
        val params = sender.parameters
        params.encodings = listOf(
            createEncoding("low", 150_000, 4.0),
            createEncoding("medium", 500_000, 2.0),
            createEncoding("high", 1_500_000, 1.0)
        )
        sender.parameters = params
    }

    private fun createEncoding(rid: String, maxBitrate: Int, scaleDown: Double): RtpParameters.Encoding {
        return RtpParameters.Encoding(rid, true, scaleDown).apply {
            maxBitrateBps = maxBitrate
        }
    }

    private fun createSFUPeerConnection(): PeerConnection? {
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )

        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        return peerConnectionFactory.createPeerConnection(
            config,
            object : PeerConnection.Observer {
                override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
                override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                    Log.d(TAG, "ICE connection state: $state")
                }
                override fun onIceConnectionReceivingChange(receiving: Boolean) {}
                override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
                override fun onIceCandidate(candidate: IceCandidate?) {}
                override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
                override fun onAddStream(stream: MediaStream?) {}
                override fun onRemoveStream(stream: MediaStream?) {}
                override fun onDataChannel(dc: DataChannel?) {}
                override fun onRenegotiationNeeded() {}
                override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                    // Handle incoming tracks from SFU
                }
                override fun onTrack(transceiver: RtpTransceiver?) {
                    // Handle incoming tracks from SFU
                }
            }
        )
    }

    // ============================================
    // MLS E2EE
    // ============================================

    /**
     * Handle MLS welcome message
     */
    suspend fun handleMLSWelcome(welcome: ByteArray) {
        mlsKeyManager?.handleWelcome(welcome)
        _events.emit(ConferenceEvent.MLSEpochChanged(mlsKeyManager?.getCurrentEpoch() ?: 0))
        Log.i(TAG, "MLS welcome processed")
    }

    /**
     * Handle MLS commit message
     */
    suspend fun handleMLSCommit(commit: ByteArray, epoch: Int) {
        mlsKeyManager?.handleCommit(commit, epoch)
        _events.emit(ConferenceEvent.MLSEpochChanged(epoch))
        Log.i(TAG, "MLS commit processed, epoch: $epoch")
    }

    /**
     * Add participant to MLS group (host only)
     */
    suspend fun addParticipantToMLS(pubkey: String, keyPackage: ByteArray): ByteArray {
        if (!_isHost.value && _localRole.value != ParticipantRole.CO_HOST) {
            throw ConferenceException.HostOnly()
        }

        val mlsManager = mlsKeyManager ?: throw ConferenceException.MLSNotInitialized()
        val commit = mlsManager.addParticipant(pubkey, keyPackage)
        _events.emit(ConferenceEvent.MLSEpochChanged(mlsManager.getCurrentEpoch()))
        return commit
    }

    /**
     * Remove participant from MLS group (host only)
     */
    suspend fun removeParticipantFromMLS(pubkey: String): ByteArray {
        if (!_isHost.value && _localRole.value != ParticipantRole.CO_HOST) {
            throw ConferenceException.HostOnly()
        }

        val mlsManager = mlsKeyManager ?: throw ConferenceException.MLSNotInitialized()
        val commit = mlsManager.removeParticipant(pubkey)
        _events.emit(ConferenceEvent.MLSEpochChanged(mlsManager.getCurrentEpoch()))
        return commit
    }

    // ============================================
    // Quality Management
    // ============================================

    /**
     * Set preferred quality for a participant
     */
    suspend fun setPreferredQuality(pubkey: String, quality: QualityLayer) {
        val currentParticipants = _participants.value.toMutableMap()
        currentParticipants[pubkey]?.let { participant ->
            currentParticipants[pubkey] = participant.copy(subscribedQuality = quality)
            _participants.value = currentParticipants

            notifySFUQualityPreference(pubkey, quality)
            _events.emit(ConferenceEvent.QualityChanged(pubkey, quality))

            Log.d(TAG, "Set quality for $pubkey: ${quality.name}")
        }
    }

    /**
     * Calculate optimal quality based on tile size
     */
    fun calculateOptimalQuality(
        tileWidth: Int,
        tileHeight: Int,
        participantCount: Int
    ): QualityLayer {
        val pixels = tileWidth * tileHeight

        return when {
            pixels >= 480000 -> QualityLayer.HIGH
            pixels >= 120000 -> QualityLayer.MEDIUM
            else -> QualityLayer.LOW
        }
    }

    private fun notifySFUQualityPreference(pubkey: String, quality: QualityLayer) {
        // In production, send via SFU signaling channel
        Log.d(TAG, "Notify SFU quality preference: $pubkey -> ${quality.name}")
    }

    // ============================================
    // Local Media
    // ============================================

    private fun acquireLocalMedia() {
        // Audio track
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("echoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("noiseSuppression", "true"))
        }
        val audioSource = peerConnectionFactory.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory.createAudioTrack("audio0", audioSource)
        localAudioTrack?.setEnabled(!_isMuted.value)

        // Video track
        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        videoCapturer = createVideoCapturer()

        videoCapturer?.let { capturer ->
            val videoSource = peerConnectionFactory.createVideoSource(capturer.isScreencast)
            capturer.initialize(surfaceTextureHelper, context, videoSource.capturerObserver)
            capturer.startCapture(1280, 720, 30)

            localVideoTrack = peerConnectionFactory.createVideoTrack("video0", videoSource)
            localVideoTrack?.setEnabled(_isVideoEnabled.value)
        }

        Log.i(TAG, "Acquired local media")
    }

    private fun createVideoCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(context)

        // Try front camera first
        enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }?.let { deviceName ->
            return enumerator.createCapturer(deviceName, null)
        }

        // Fallback to any camera
        return enumerator.deviceNames.firstOrNull()?.let { deviceName ->
            enumerator.createCapturer(deviceName, null)
        }
    }

    // ============================================
    // Controls
    // ============================================

    fun toggleMute(): Boolean {
        _isMuted.value = !_isMuted.value
        localAudioTrack?.setEnabled(!_isMuted.value)
        return _isMuted.value
    }

    fun toggleVideo(): Boolean {
        _isVideoEnabled.value = !_isVideoEnabled.value
        localVideoTrack?.setEnabled(_isVideoEnabled.value)
        return _isVideoEnabled.value
    }

    // ============================================
    // Reconnection
    // ============================================

    private suspend fun attemptReconnection() {
        if (reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
            _connectionState.value = SFUConnectionState.FAILED
            _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.FAILED))
            _events.emit(ConferenceEvent.Error(ConferenceException.ReconnectionFailed()))
            return
        }

        _connectionState.value = SFUConnectionState.RECONNECTING
        _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.RECONNECTING))

        reconnectionAttempts++
        Log.i(TAG, "Attempting reconnection $reconnectionAttempts/$MAX_RECONNECTION_ATTEMPTS")

        try {
            _roomId.value?.let { roomId ->
                connectToSFU(roomId)
                _connectionState.value = SFUConnectionState.CONNECTED
                _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.CONNECTED))
                reconnectionAttempts = 0
            }
        } catch (e: Exception) {
            delay(2000L * reconnectionAttempts)
            attemptReconnection()
        }
    }

    // ============================================
    // Timers
    // ============================================

    private fun startTimers() {
        callStartTime = System.currentTimeMillis()

        durationJob = scope.launch {
            while (true) {
                delay(1000)
                _callDuration.value = System.currentTimeMillis() - callStartTime
            }
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    private suspend fun notifySFULeaving() {
        // Notify SFU via signaling
        Log.i(TAG, "Notified SFU of leaving")
    }

    private fun cleanup() {
        durationJob?.cancel()
        durationJob = null

        sfuConnection?.close()
        sfuConnection = null

        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null

        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null

        localAudioTrack?.dispose()
        localAudioTrack = null
        localVideoTrack?.dispose()
        localVideoTrack = null
        audioSender = null
        videoSender = null

        mlsKeyManager?.close()
        mlsKeyManager = null
        simulcastManager = null

        _roomId.value = null
        _isHost.value = false
        _localRole.value = ParticipantRole.PARTICIPANT
        _isMuted.value = false
        _isVideoEnabled.value = true
        _isScreenSharing.value = false
        _participants.value = emptyMap()
        _connectionState.value = SFUConnectionState.DISCONNECTED
        callStartTime = 0
        _callDuration.value = 0
        reconnectionAttempts = 0

        scope.launch {
            _events.emit(ConferenceEvent.ConnectionStateChanged(SFUConnectionState.DISCONNECTED))
        }
    }

    fun close() {
        cleanup()
        eglBase.release()
        Log.i(TAG, "SFUConferenceManager closed")
    }

    // ============================================
    // Getters
    // ============================================

    val participantCount: Int
        get() = _participants.value.size + 1

    val isHostOrCoHost: Boolean
        get() = _localRole.value == ParticipantRole.HOST || _localRole.value == ParticipantRole.CO_HOST
}

// ============================================
// Exceptions
// ============================================

sealed class ConferenceException(message: String) : Exception(message) {
    class AlreadyInRoom : ConferenceException("Already in a conference")
    class NotInRoom : ConferenceException("Not in a conference")
    class ConnectionFailed : ConferenceException("Failed to connect to conference server")
    class ReconnectionFailed : ConferenceException("Failed to reconnect after multiple attempts")
    class NoCameraAvailable : ConferenceException("No camera available")
    class HostOnly : ConferenceException("Only the host can perform this action")
    class MLSNotInitialized : ConferenceException("MLS not initialized")
    class Unauthorized : ConferenceException("Unauthorized action")
}
