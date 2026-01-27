package network.buildit.modules.calling.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.modules.calling.service.MemberStatus
import network.buildit.modules.calling.service.PTTAudioEvent
import network.buildit.modules.calling.service.PTTAudioManager
import network.buildit.modules.calling.service.PTTChannel
import network.buildit.modules.calling.service.PTTChannelEvent
import network.buildit.modules.calling.service.PTTChannelManager
import network.buildit.modules.calling.service.PTTChannelState
import network.buildit.modules.calling.service.PTTMember
import network.buildit.modules.calling.service.SpeakPriority
import network.buildit.modules.calling.service.SpeakRequest
import network.buildit.modules.calling.service.VADConfig
import javax.inject.Inject

/**
 * UI state for the PTT screen.
 */
data class PTTUiState(
    val isLoading: Boolean = true,
    val channelState: PTTChannelState? = null,
    val channelName: String = "",
    val memberCount: Int = 0,
    val onlineMembers: List<PTTMember> = emptyList(),
    val offlineMembers: List<PTTMember> = emptyList(),
    val currentSpeaker: PTTMember? = null,
    val speakerQueue: List<SpeakRequest> = emptyList(),
    val queuePosition: Int? = null,
    val isLocalUserSpeaking: Boolean = false,
    val isPTTButtonPressed: Boolean = false,
    val audioLevel: Float = 0f,
    val vadEnabled: Boolean = true,
    val isSilent: Boolean = true,
    val speakTimeRemaining: Long = 0,
    val showMembersPanel: Boolean = false,
    val showSettingsPanel: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Events that can be triggered from the PTT screen.
 */
sealed class PTTUiEvent {
    data class ShowToast(val message: String) : PTTUiEvent()
    data class NavigateBack(val reason: String? = null) : PTTUiEvent()
    object SpeakGranted : PTTUiEvent()
    object SpeakDenied : PTTUiEvent()
    object SpeakReleased : PTTUiEvent()
    object SpeakTimeout : PTTUiEvent()
}

/**
 * ViewModel for the PTT (Push-to-Talk) screen.
 *
 * Manages:
 * - Channel state and member list
 * - PTT button press/release
 * - Speaker queue and current speaker
 * - VAD settings
 * - Audio level visualization
 */
@HiltViewModel
class PTTViewModel @Inject constructor(
    private val channelManager: PTTChannelManager,
    private val audioManager: PTTAudioManager
) : ViewModel() {

    private var channelId: String? = null
    private var localPubkey: String = ""

    private val _uiState = MutableStateFlow(PTTUiState())
    val uiState: StateFlow<PTTUiState> = _uiState.asStateFlow()

    private val _uiEvents = MutableStateFlow<PTTUiEvent?>(null)
    val uiEvents: StateFlow<PTTUiEvent?> = _uiEvents.asStateFlow()

    private var speakTimeJob: Job? = null

    init {
        observeChannelEvents()
        observeAudioEvents()
        observeAudioLevel()
    }

    /**
     * Initialize the ViewModel with a channel ID.
     *
     * @param channelId The PTT channel ID.
     * @param localPubkey The local user's pubkey.
     */
    fun initialize(channelId: String, localPubkey: String) {
        this.channelId = channelId
        this.localPubkey = localPubkey

        _uiState.update { it.copy(isLoading = true) }

        viewModelScope.launch {
            // Set up channel manager
            channelManager.setLocalIdentity(localPubkey)
            channelManager.setCurrentChannel(channelId)

            // Observe channel state
            observeChannelState(channelId)

            _uiState.update { it.copy(isLoading = false) }
        }
    }

    /**
     * Join the PTT channel.
     *
     * @param displayName Optional display name.
     */
    fun joinChannel(displayName: String? = null) {
        val id = channelId ?: return

        viewModelScope.launch {
            try {
                channelManager.joinChannel(id, displayName)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Failed to join channel: ${e.message}") }
            }
        }
    }

    /**
     * Leave the PTT channel.
     */
    fun leaveChannel() {
        val id = channelId ?: return

        viewModelScope.launch {
            try {
                channelManager.leaveChannel(id)
                _uiEvents.value = PTTUiEvent.NavigateBack("left_channel")
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Failed to leave channel: ${e.message}") }
            }
        }
    }

    // ============================================
    // PTT Button Actions
    // ============================================

    /**
     * Handle PTT button press (start speaking request).
     */
    fun onPTTButtonPressed() {
        val id = channelId ?: return

        _uiState.update { it.copy(isPTTButtonPressed = true) }

        viewModelScope.launch {
            val granted = channelManager.requestSpeak(id, SpeakPriority.NORMAL)

            if (granted) {
                // Start recording
                startRecording()
            } else {
                // Queued - update UI
                val position = channelManager.getQueuePosition(id, localPubkey)
                _uiState.update { it.copy(queuePosition = position) }
            }
        }
    }

    /**
     * Handle PTT button release (stop speaking).
     */
    fun onPTTButtonReleased() {
        val id = channelId ?: return

        _uiState.update { it.copy(isPTTButtonPressed = false) }

        viewModelScope.launch {
            // Stop recording first
            stopRecording()

            // Release speak
            channelManager.releaseSpeak(id, "manual")
        }
    }

    /**
     * Cancel pending speak request.
     */
    fun cancelSpeakRequest() {
        val id = channelId ?: return

        viewModelScope.launch {
            channelManager.cancelSpeakRequest(id)
            _uiState.update { it.copy(queuePosition = null) }
        }
    }

    // ============================================
    // Audio Recording
    // ============================================

    private suspend fun startRecording() {
        val id = channelId ?: return

        audioManager.startRecording(id) { audioPacket ->
            // Audio packet ready to send via Nostr/BLE
            // This would be handled by a separate audio transport layer
            sendAudioPacket(audioPacket)
        }
    }

    private suspend fun stopRecording() {
        audioManager.stopRecording()
    }

    private fun sendAudioPacket(audioPacket: ShortArray) {
        // Convert to bytes and send via Nostr/BLE transport
        // Implementation depends on transport layer
        val bytes = audioManager.shortsToBytes(audioPacket)
        // nostrClient.publishAudioPacket(channelId, bytes)
    }

    // ============================================
    // VAD Settings
    // ============================================

    /**
     * Toggle Voice Activity Detection.
     */
    fun toggleVAD() {
        val newEnabled = !_uiState.value.vadEnabled
        audioManager.setVADEnabled(newEnabled)
        _uiState.update { it.copy(vadEnabled = newEnabled) }
    }

    /**
     * Update VAD threshold.
     *
     * @param thresholdDb Threshold in dB.
     */
    fun setVADThreshold(thresholdDb: Float) {
        audioManager.setVADThreshold(thresholdDb)
    }

    // ============================================
    // UI Panel Toggles
    // ============================================

    /**
     * Toggle members panel visibility.
     */
    fun toggleMembersPanel() {
        _uiState.update { it.copy(showMembersPanel = !it.showMembersPanel) }
    }

    /**
     * Toggle settings panel visibility.
     */
    fun toggleSettingsPanel() {
        _uiState.update { it.copy(showSettingsPanel = !it.showSettingsPanel) }
    }

    /**
     * Dismiss error message.
     */
    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    /**
     * Clear UI event after handling.
     */
    fun clearUiEvent() {
        _uiEvents.value = null
    }

    // ============================================
    // Observers
    // ============================================

    private fun observeChannelState(channelId: String) {
        viewModelScope.launch {
            combine(
                channelManager.channelStates,
                channelManager.isSpeaking
            ) { states, isSpeaking ->
                states[channelId] to isSpeaking
            }.collect { (channelState, isSpeaking) ->
                if (channelState != null) {
                    updateUiFromChannelState(channelState, isSpeaking)
                }
            }
        }
    }

    private fun updateUiFromChannelState(state: PTTChannelState, isSpeaking: Boolean) {
        val members = state.members.values.toList()
        val onlineMembers = members.filter { it.status != MemberStatus.OFFLINE }
        val offlineMembers = members.filter { it.status == MemberStatus.OFFLINE }
        val currentSpeaker = state.currentSpeaker?.let { pubkey ->
            state.members[pubkey]
        }
        val queuePosition = channelManager.getQueuePosition(state.channel.channelId, localPubkey)

        _uiState.update {
            it.copy(
                channelState = state,
                channelName = state.channel.name,
                memberCount = members.size,
                onlineMembers = onlineMembers,
                offlineMembers = offlineMembers,
                currentSpeaker = currentSpeaker,
                speakerQueue = state.speakerQueue,
                queuePosition = queuePosition,
                isLocalUserSpeaking = isSpeaking
            )
        }

        // Start/stop speak time tracking
        if (isSpeaking) {
            startSpeakTimeTracking(state.channel.speakTimeoutMs)
        } else {
            stopSpeakTimeTracking()
        }
    }

    private fun observeChannelEvents() {
        viewModelScope.launch {
            channelManager.events.collect { event ->
                handleChannelEvent(event)
            }
        }
    }

    private fun handleChannelEvent(event: PTTChannelEvent) {
        val id = channelId ?: return

        when (event) {
            is PTTChannelEvent.SpeakGranted -> {
                if (event.channelId == id && event.pubkey == localPubkey) {
                    _uiEvents.value = PTTUiEvent.SpeakGranted
                    _uiState.update { it.copy(queuePosition = null) }
                    viewModelScope.launch { startRecording() }
                }
            }
            is PTTChannelEvent.SpeakDenied -> {
                if (event.channelId == id && event.pubkey == localPubkey) {
                    _uiEvents.value = PTTUiEvent.SpeakDenied
                    _uiState.update { it.copy(queuePosition = event.queuePosition) }
                }
            }
            is PTTChannelEvent.SpeakReleased -> {
                if (event.channelId == id && event.pubkey == localPubkey) {
                    _uiEvents.value = PTTUiEvent.SpeakReleased
                    viewModelScope.launch { stopRecording() }
                }
            }
            is PTTChannelEvent.SpeakTimeout -> {
                if (event.channelId == id && event.pubkey == localPubkey) {
                    _uiEvents.value = PTTUiEvent.SpeakTimeout
                    _uiState.update { it.copy(isPTTButtonPressed = false) }
                    viewModelScope.launch { stopRecording() }
                }
            }
            is PTTChannelEvent.QueueUpdated -> {
                if (event.channelId == id) {
                    val position = event.queue.indexOfFirst { it.pubkey == localPubkey }
                    _uiState.update {
                        it.copy(
                            speakerQueue = event.queue,
                            queuePosition = if (position >= 0) position + 1 else null
                        )
                    }
                }
            }
            is PTTChannelEvent.Error -> {
                _uiState.update { it.copy(errorMessage = event.message) }
            }
            else -> { /* Other events handled by state observation */ }
        }
    }

    private fun observeAudioEvents() {
        viewModelScope.launch {
            audioManager.events.collect { event ->
                handleAudioEvent(event)
            }
        }
    }

    private fun handleAudioEvent(event: PTTAudioEvent) {
        when (event) {
            is PTTAudioEvent.VoiceActivityDetected -> {
                _uiState.update { it.copy(isSilent = !event.isVoice) }
            }
            is PTTAudioEvent.SilenceDetected -> {
                val id = channelId ?: return
                // Notify channel manager for VAD auto-release
                channelManager.onSilenceDetected(id)
            }
            is PTTAudioEvent.Error -> {
                _uiState.update { it.copy(errorMessage = event.message) }
            }
            else -> { /* Other events */ }
        }
    }

    private fun observeAudioLevel() {
        viewModelScope.launch {
            audioManager.audioLevel.collect { level ->
                _uiState.update { it.copy(audioLevel = level) }
            }
        }
    }

    // ============================================
    // Speak Time Tracking
    // ============================================

    private fun startSpeakTimeTracking(timeoutMs: Long) {
        speakTimeJob?.cancel()
        speakTimeJob = viewModelScope.launch {
            var remaining = timeoutMs
            while (remaining > 0) {
                _uiState.update { it.copy(speakTimeRemaining = remaining) }
                kotlinx.coroutines.delay(1000)
                remaining -= 1000
            }
        }
    }

    private fun stopSpeakTimeTracking() {
        speakTimeJob?.cancel()
        speakTimeJob = null
        _uiState.update { it.copy(speakTimeRemaining = 0) }
    }

    // ============================================
    // Cleanup
    // ============================================

    override fun onCleared() {
        super.onCleared()
        speakTimeJob?.cancel()
    }
}
