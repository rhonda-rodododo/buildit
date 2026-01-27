package network.buildit.modules.calling.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Log
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min

/**
 * Audio configuration for PTT.
 */
data class PTTAudioConfig(
    /** Sample rate in Hz */
    val sampleRate: Int = 48000,
    /** Audio channel configuration */
    val channelConfig: Int = AudioFormat.CHANNEL_IN_MONO,
    /** Audio encoding format */
    val audioFormat: Int = AudioFormat.ENCODING_PCM_16BIT,
    /** Buffer size multiplier */
    val bufferSizeMultiplier: Int = 2,
    /** Gain level (1.0 = normal) */
    val gain: Float = 1.0f
)

/**
 * Voice Activity Detection configuration.
 */
data class VADConfig(
    /** Whether VAD is enabled */
    val enabled: Boolean = true,
    /** Threshold in dB (e.g., -40 dB) */
    val thresholdDb: Float = -40f,
    /** Time in ms before triggering silence release */
    val silenceTimeoutMs: Long = 2000L,
    /** Minimum voice duration in ms to count as speech */
    val minVoiceDurationMs: Long = 100L
)

/**
 * Audio events emitted by the manager.
 */
sealed class PTTAudioEvent {
    data class AudioLevelChanged(val level: Float, val levelDb: Float) : PTTAudioEvent()
    data class VoiceActivityDetected(val isVoice: Boolean) : PTTAudioEvent()
    data class AudioPacketReady(val data: ShortArray) : PTTAudioEvent() {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (javaClass != other?.javaClass) return false
            other as AudioPacketReady
            return data.contentEquals(other.data)
        }
        override fun hashCode(): Int = data.contentHashCode()
    }
    data class RecordingStarted(val channelId: String) : PTTAudioEvent()
    data class RecordingStopped(val channelId: String) : PTTAudioEvent()
    data class PlaybackStarted(val speakerPubkey: String) : PTTAudioEvent()
    data class PlaybackStopped(val speakerPubkey: String) : PTTAudioEvent()
    data class Error(val message: String, val exception: Exception?) : PTTAudioEvent()
    object SilenceDetected : PTTAudioEvent()
}

/**
 * Audio state.
 */
data class PTTAudioState(
    val isRecording: Boolean = false,
    val isPlaying: Boolean = false,
    val currentAudioLevel: Float = 0f,
    val currentAudioLevelDb: Float = -96f,
    val vadEnabled: Boolean = true,
    val isSilent: Boolean = true,
    val gain: Float = 1.0f
)

/**
 * PTT Audio Manager.
 *
 * Handles audio recording and playback for Push-to-Talk:
 * - AudioRecord initialization with microphone access
 * - Start/stop broadcasting with gain control
 * - Voice Activity Detection (VAD) with configurable threshold
 * - Audio encoding (Float32 to Int16) and decoding (Int16 to Float32)
 * - Audio playback via AudioTrack
 * - Audio focus management
 * - Hardware PTT button detection
 */
@Singleton
class PTTAudioManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "PTTAudioManager"

        // Audio level constants
        private const val MIN_DB = -96f
        private const val MAX_DB = 0f
        private const val REFERENCE_LEVEL = 32768f // For 16-bit audio

        // Buffer size for audio packets (20ms of audio at 48kHz mono)
        private const val PACKET_DURATION_MS = 20
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val audioManager: AudioManager by lazy {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    // Audio configuration
    private var audioConfig = PTTAudioConfig()
    private var vadConfig = VADConfig()

    // Recording
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private var recordingBuffer: ShortArray? = null
    private var bufferSizeInBytes: Int = 0

    // Playback
    private var audioTrack: AudioTrack? = null
    private var playbackJob: Job? = null

    // VAD state
    private var lastVoiceTime: Long = 0
    private var silenceStartTime: Long = 0
    private var isCurrentlyVoice: Boolean = false

    // Current channel context
    private var currentChannelId: String? = null
    private var currentSpeakerPubkey: String? = null

    // ============================================
    // State Flows
    // ============================================

    private val _audioState = MutableStateFlow(PTTAudioState())
    /** Observable audio state */
    val audioState: StateFlow<PTTAudioState> = _audioState.asStateFlow()

    private val _events = MutableSharedFlow<PTTAudioEvent>()
    /** Audio event stream */
    val events: SharedFlow<PTTAudioEvent> = _events.asSharedFlow()

    private val _audioLevel = MutableStateFlow(0f)
    /** Current audio level (0.0 to 1.0) */
    val audioLevel: StateFlow<Float> = _audioLevel.asStateFlow()

    private val _isVoiceActive = MutableStateFlow(false)
    /** Whether voice is currently detected */
    val isVoiceActive: StateFlow<Boolean> = _isVoiceActive.asStateFlow()

    // ============================================
    // Configuration
    // ============================================

    /**
     * Update audio configuration.
     *
     * @param config New audio configuration.
     */
    fun updateAudioConfig(config: PTTAudioConfig) {
        audioConfig = config
        _audioState.value = _audioState.value.copy(gain = config.gain)
    }

    /**
     * Update VAD configuration.
     *
     * @param config New VAD configuration.
     */
    fun updateVADConfig(config: VADConfig) {
        vadConfig = config
        _audioState.value = _audioState.value.copy(vadEnabled = config.enabled)
    }

    /**
     * Set audio gain level.
     *
     * @param gain Gain multiplier (1.0 = normal, 2.0 = double).
     */
    fun setGain(gain: Float) {
        audioConfig = audioConfig.copy(gain = gain.coerceIn(0.1f, 3.0f))
        _audioState.value = _audioState.value.copy(gain = audioConfig.gain)
    }

    /**
     * Enable or disable VAD.
     *
     * @param enabled Whether VAD should be enabled.
     */
    fun setVADEnabled(enabled: Boolean) {
        vadConfig = vadConfig.copy(enabled = enabled)
        _audioState.value = _audioState.value.copy(vadEnabled = enabled)
    }

    /**
     * Set VAD threshold.
     *
     * @param thresholdDb Threshold in dB (e.g., -40).
     */
    fun setVADThreshold(thresholdDb: Float) {
        vadConfig = vadConfig.copy(thresholdDb = thresholdDb)
    }

    // ============================================
    // Permission Checking
    // ============================================

    /**
     * Check if microphone permission is granted.
     *
     * @return True if permission is granted.
     */
    fun hasMicrophonePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    // ============================================
    // Audio Recording
    // ============================================

    /**
     * Initialize the audio recorder.
     *
     * @return True if initialization was successful.
     */
    fun initializeRecorder(): Boolean {
        if (!hasMicrophonePermission()) {
            Log.e(TAG, "Microphone permission not granted")
            scope.launch {
                _events.emit(PTTAudioEvent.Error("Microphone permission not granted", null))
            }
            return false
        }

        try {
            // Calculate buffer size
            val minBufferSize = AudioRecord.getMinBufferSize(
                audioConfig.sampleRate,
                audioConfig.channelConfig,
                audioConfig.audioFormat
            )

            if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                Log.e(TAG, "Failed to get min buffer size")
                return false
            }

            bufferSizeInBytes = minBufferSize * audioConfig.bufferSizeMultiplier

            // Calculate samples per packet (20ms of audio)
            val samplesPerPacket = (audioConfig.sampleRate * PACKET_DURATION_MS) / 1000
            recordingBuffer = ShortArray(samplesPerPacket)

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                audioConfig.sampleRate,
                audioConfig.channelConfig,
                audioConfig.audioFormat,
                bufferSizeInBytes
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize")
                audioRecord?.release()
                audioRecord = null
                return false
            }

            Log.i(TAG, "AudioRecord initialized: sampleRate=${audioConfig.sampleRate}, bufferSize=$bufferSizeInBytes")
            return true

        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception initializing recorder", e)
            scope.launch {
                _events.emit(PTTAudioEvent.Error("Permission denied", e))
            }
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize recorder", e)
            scope.launch {
                _events.emit(PTTAudioEvent.Error("Failed to initialize recorder: ${e.message}", e))
            }
            return false
        }
    }

    /**
     * Start recording/broadcasting audio.
     *
     * @param channelId The PTT channel ID.
     * @param onAudioPacket Callback for each audio packet ready to send.
     * @return True if recording started successfully.
     */
    suspend fun startRecording(
        channelId: String,
        onAudioPacket: (ShortArray) -> Unit
    ): Boolean {
        if (audioRecord == null && !initializeRecorder()) {
            return false
        }

        if (_audioState.value.isRecording) {
            Log.w(TAG, "Already recording")
            return true
        }

        // Request audio focus
        if (!requestAudioFocus()) {
            Log.w(TAG, "Failed to get audio focus")
            // Continue anyway, but log the warning
        }

        currentChannelId = channelId

        try {
            audioRecord?.startRecording()

            _audioState.value = _audioState.value.copy(isRecording = true)

            // Reset VAD state
            isCurrentlyVoice = false
            silenceStartTime = System.currentTimeMillis()

            // Start recording loop
            recordingJob = scope.launch {
                recordingLoop(onAudioPacket)
            }

            Log.i(TAG, "Recording started for channel: $channelId")

            _events.emit(PTTAudioEvent.RecordingStarted(channelId))

            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            _events.emit(PTTAudioEvent.Error("Failed to start recording: ${e.message}", e))
            return false
        }
    }

    /**
     * Stop recording/broadcasting audio.
     */
    suspend fun stopRecording() {
        if (!_audioState.value.isRecording) return

        recordingJob?.cancel()
        recordingJob = null

        try {
            audioRecord?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
        }

        _audioState.value = _audioState.value.copy(
            isRecording = false,
            currentAudioLevel = 0f,
            currentAudioLevelDb = MIN_DB
        )
        _audioLevel.value = 0f
        _isVoiceActive.value = false

        abandonAudioFocus()

        val channelId = currentChannelId
        currentChannelId = null

        Log.i(TAG, "Recording stopped")

        channelId?.let {
            _events.emit(PTTAudioEvent.RecordingStopped(it))
        }
    }

    /**
     * Main recording loop - reads audio samples and processes them.
     */
    private suspend fun recordingLoop(onAudioPacket: (ShortArray) -> Unit) {
        val buffer = recordingBuffer ?: return
        val record = audioRecord ?: return

        withContext(Dispatchers.IO) {
            while (isActive && _audioState.value.isRecording) {
                val readResult = record.read(buffer, 0, buffer.size)

                if (readResult > 0) {
                    // Apply gain
                    val processedBuffer = if (audioConfig.gain != 1.0f) {
                        applyGain(buffer, audioConfig.gain)
                    } else {
                        buffer.copyOf()
                    }

                    // Calculate audio level
                    val level = calculateAudioLevel(processedBuffer)
                    val levelDb = calculateAudioLevelDb(processedBuffer)

                    _audioLevel.value = level
                    _audioState.value = _audioState.value.copy(
                        currentAudioLevel = level,
                        currentAudioLevelDb = levelDb
                    )

                    // Voice Activity Detection
                    if (vadConfig.enabled) {
                        processVAD(levelDb)
                    }

                    // Emit audio packet
                    scope.launch {
                        _events.emit(PTTAudioEvent.AudioLevelChanged(level, levelDb))
                        _events.emit(PTTAudioEvent.AudioPacketReady(processedBuffer))
                    }

                    // Callback with packet
                    onAudioPacket(processedBuffer)

                } else if (readResult < 0) {
                    Log.e(TAG, "AudioRecord read error: $readResult")
                    break
                }
            }
        }
    }

    /**
     * Process Voice Activity Detection.
     */
    private suspend fun processVAD(levelDb: Float) {
        val now = System.currentTimeMillis()
        val isVoice = levelDb > vadConfig.thresholdDb

        if (isVoice) {
            lastVoiceTime = now
            silenceStartTime = 0

            if (!isCurrentlyVoice) {
                isCurrentlyVoice = true
                _isVoiceActive.value = true
                _audioState.value = _audioState.value.copy(isSilent = false)

                _events.emit(PTTAudioEvent.VoiceActivityDetected(true))
            }
        } else {
            if (isCurrentlyVoice) {
                if (silenceStartTime == 0L) {
                    silenceStartTime = now
                }

                val silenceDuration = now - silenceStartTime

                if (silenceDuration >= vadConfig.silenceTimeoutMs) {
                    isCurrentlyVoice = false
                    _isVoiceActive.value = false
                    _audioState.value = _audioState.value.copy(isSilent = true)

                    _events.emit(PTTAudioEvent.VoiceActivityDetected(false))
                    _events.emit(PTTAudioEvent.SilenceDetected)
                }
            }
        }
    }

    // ============================================
    // Audio Playback
    // ============================================

    /**
     * Initialize the audio player.
     *
     * @return True if initialization was successful.
     */
    fun initializePlayer(): Boolean {
        try {
            val minBufferSize = AudioTrack.getMinBufferSize(
                audioConfig.sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                audioConfig.audioFormat
            )

            if (minBufferSize == AudioTrack.ERROR || minBufferSize == AudioTrack.ERROR_BAD_VALUE) {
                Log.e(TAG, "Failed to get min buffer size for playback")
                return false
            }

            val bufferSize = minBufferSize * audioConfig.bufferSizeMultiplier

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(audioConfig.sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .build()

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(audioAttributes)
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            Log.i(TAG, "AudioTrack initialized: sampleRate=${audioConfig.sampleRate}, bufferSize=$bufferSize")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize player", e)
            scope.launch {
                _events.emit(PTTAudioEvent.Error("Failed to initialize player: ${e.message}", e))
            }
            return false
        }
    }

    /**
     * Start audio playback.
     *
     * @param speakerPubkey The pubkey of the current speaker.
     */
    suspend fun startPlayback(speakerPubkey: String) {
        if (audioTrack == null && !initializePlayer()) {
            return
        }

        if (_audioState.value.isPlaying) {
            Log.w(TAG, "Already playing")
            return
        }

        currentSpeakerPubkey = speakerPubkey

        try {
            audioTrack?.play()
            _audioState.value = _audioState.value.copy(isPlaying = true)

            Log.i(TAG, "Playback started for speaker: $speakerPubkey")

            _events.emit(PTTAudioEvent.PlaybackStarted(speakerPubkey))

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start playback", e)
            _events.emit(PTTAudioEvent.Error("Failed to start playback: ${e.message}", e))
        }
    }

    /**
     * Stop audio playback.
     */
    suspend fun stopPlayback() {
        if (!_audioState.value.isPlaying) return

        try {
            audioTrack?.pause()
            audioTrack?.flush()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping playback", e)
        }

        _audioState.value = _audioState.value.copy(isPlaying = false)

        val speakerPubkey = currentSpeakerPubkey
        currentSpeakerPubkey = null

        Log.i(TAG, "Playback stopped")

        speakerPubkey?.let {
            _events.emit(PTTAudioEvent.PlaybackStopped(it))
        }
    }

    /**
     * Play received audio data.
     *
     * @param audioData Int16 audio samples.
     */
    fun playAudioData(audioData: ShortArray) {
        if (!_audioState.value.isPlaying) return

        audioTrack?.write(audioData, 0, audioData.size)
    }

    /**
     * Play received audio data from ByteArray.
     *
     * @param audioData Raw audio bytes (Little Endian Int16).
     */
    fun playAudioData(audioData: ByteArray) {
        if (!_audioState.value.isPlaying) return

        // Convert bytes to shorts
        val shortBuffer = ByteBuffer.wrap(audioData)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer()
        val shorts = ShortArray(shortBuffer.remaining())
        shortBuffer.get(shorts)

        audioTrack?.write(shorts, 0, shorts.size)
    }

    // ============================================
    // Audio Encoding/Decoding
    // ============================================

    /**
     * Encode Float32 audio data to Int16.
     * Maps Float32 range [-1.0, 1.0] to Int16 range [-32768, 32767].
     *
     * @param float32Data Input Float32 array.
     * @return Int16 encoded data.
     */
    fun encodeFloat32ToInt16(float32Data: FloatArray): ShortArray {
        return ShortArray(float32Data.size) { i ->
            val clamped = float32Data[i].coerceIn(-1.0f, 1.0f)
            (clamped * 32767f).toInt().toShort()
        }
    }

    /**
     * Decode Int16 audio data to Float32.
     * Maps Int16 range [-32768, 32767] to Float32 range [-1.0, 1.0].
     *
     * @param int16Data Input Int16 array.
     * @return Float32 decoded data.
     */
    fun decodeInt16ToFloat32(int16Data: ShortArray): FloatArray {
        return FloatArray(int16Data.size) { i ->
            int16Data[i].toFloat() / 32768f
        }
    }

    /**
     * Convert ShortArray to ByteArray (Little Endian).
     *
     * @param shorts Input short array.
     * @return Byte array representation.
     */
    fun shortsToBytes(shorts: ShortArray): ByteArray {
        val buffer = ByteBuffer.allocate(shorts.size * 2)
            .order(ByteOrder.LITTLE_ENDIAN)
        buffer.asShortBuffer().put(shorts)
        return buffer.array()
    }

    /**
     * Convert ByteArray to ShortArray (Little Endian).
     *
     * @param bytes Input byte array.
     * @return Short array representation.
     */
    fun bytesToShorts(bytes: ByteArray): ShortArray {
        val shortBuffer = ByteBuffer.wrap(bytes)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer()
        val shorts = ShortArray(shortBuffer.remaining())
        shortBuffer.get(shorts)
        return shorts
    }

    // ============================================
    // Audio Processing Helpers
    // ============================================

    /**
     * Apply gain to audio samples.
     */
    private fun applyGain(samples: ShortArray, gain: Float): ShortArray {
        return ShortArray(samples.size) { i ->
            val amplified = (samples[i] * gain).toInt()
            amplified.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
    }

    /**
     * Calculate normalized audio level (0.0 to 1.0).
     */
    private fun calculateAudioLevel(samples: ShortArray): Float {
        if (samples.isEmpty()) return 0f

        var sum = 0.0
        for (sample in samples) {
            sum += abs(sample.toDouble())
        }
        val average = sum / samples.size

        // Normalize to 0-1 range
        return (average / REFERENCE_LEVEL).toFloat().coerceIn(0f, 1f)
    }

    /**
     * Calculate audio level in dB.
     */
    private fun calculateAudioLevelDb(samples: ShortArray): Float {
        if (samples.isEmpty()) return MIN_DB

        var sumSquared = 0.0
        for (sample in samples) {
            sumSquared += sample.toDouble() * sample.toDouble()
        }
        val rms = kotlin.math.sqrt(sumSquared / samples.size)

        // Convert to dB
        return if (rms > 0) {
            (20 * log10(rms / REFERENCE_LEVEL)).toFloat().coerceIn(MIN_DB, MAX_DB)
        } else {
            MIN_DB
        }
    }

    // ============================================
    // Audio Focus Management
    // ============================================

    private var audioFocusRequest: android.media.AudioFocusRequest? = null

    private fun requestAudioFocus(): Boolean {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val focusRequest = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setOnAudioFocusChangeListener { focusChange ->
                    handleAudioFocusChange(focusChange)
                }
                .build()

            audioFocusRequest = focusRequest
            val result = audioManager.requestAudioFocus(focusRequest)
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager.requestAudioFocus(
                { focusChange -> handleAudioFocusChange(focusChange) },
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
            )
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonAudioFocus() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            audioFocusRequest?.let { request ->
                audioManager.abandonAudioFocusRequest(request)
            }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }

    private fun handleAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                Log.d(TAG, "Audio focus lost")
                scope.launch {
                    stopRecording()
                    stopPlayback()
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "Audio focus lost transiently")
                // Could pause but we'll just log it
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.d(TAG, "Audio focus gained")
            }
        }
    }

    // ============================================
    // Hardware PTT Button Support
    // ============================================

    /**
     * Check if a hardware PTT button is available.
     *
     * @return True if a PTT button device is connected.
     */
    fun hasHardwarePTTButton(): Boolean {
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
        // Look for common PTT/push button devices
        return devices.any { device ->
            device.type == AudioDeviceInfo.TYPE_USB_ACCESSORY ||
                device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                // Some radios/accessories identify as headsets
                device.type == AudioDeviceInfo.TYPE_USB_HEADSET
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Release all audio resources.
     */
    fun release() {
        scope.launch {
            stopRecording()
            stopPlayback()
        }

        audioRecord?.release()
        audioRecord = null
        recordingBuffer = null

        audioTrack?.release()
        audioTrack = null

        abandonAudioFocus()

        Log.i(TAG, "PTTAudioManager released")
    }

    /**
     * Close the manager.
     */
    fun close() {
        release()
        scope.cancel()
        Log.i(TAG, "PTTAudioManager closed")
    }
}
