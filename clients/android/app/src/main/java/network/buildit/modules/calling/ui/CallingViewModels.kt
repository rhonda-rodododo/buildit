package network.buildit.modules.calling.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.generated.schemas.CallHistory
import network.buildit.generated.schemas.CallType
import network.buildit.modules.calling.data.local.ActiveCallState
import network.buildit.modules.calling.data.local.CallHistoryEntity
import network.buildit.modules.calling.domain.CallingUseCase
import org.webrtc.VideoTrack
import javax.inject.Inject

/**
 * ViewModel for the active call screen.
 */
@HiltViewModel
class CallViewModel @Inject constructor(
    private val callingUseCase: CallingUseCase
) : ViewModel() {

    private var callId: String? = null
    private var durationJob: Job? = null

    private val _callState = MutableStateFlow<ActiveCallState?>(null)
    val callState: StateFlow<ActiveCallState?> = _callState.asStateFlow()

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()

    private val _isVideoEnabled = MutableStateFlow(true)
    val isVideoEnabled: StateFlow<Boolean> = _isVideoEnabled.asStateFlow()

    private val _isSpeakerOn = MutableStateFlow(false)
    val isSpeakerOn: StateFlow<Boolean> = _isSpeakerOn.asStateFlow()

    private val _callDuration = MutableStateFlow(0L)
    val callDuration: StateFlow<Long> = _callDuration.asStateFlow()

    val remoteVideoTrack: StateFlow<VideoTrack?> = callingUseCase.remoteVideoTrack
    val localVideoTrack: StateFlow<VideoTrack?> = MutableStateFlow(null) // Would be provided by use case

    init {
        // Observe active calls
        viewModelScope.launch {
            callingUseCase.currentCall.collect { state ->
                if (state?.callId == callId) {
                    _callState.value = state
                    _isMuted.value = state.isMuted
                    _isVideoEnabled.value = state.isVideoEnabled

                    // Start duration counter when connected
                    if (state.state == "connected" && durationJob == null) {
                        startDurationCounter(state.connectedAt ?: (System.currentTimeMillis() / 1000))
                    }
                }
            }
        }
    }

    fun setCallId(id: String) {
        callId = id
        // Get current state
        _callState.value = callingUseCase.activeCalls.value[id]
    }

    private fun startDurationCounter(connectedAt: Long) {
        durationJob?.cancel()
        durationJob = viewModelScope.launch {
            while (true) {
                _callDuration.value = (System.currentTimeMillis() / 1000) - connectedAt
                delay(1000)
            }
        }
    }

    fun toggleMute() {
        callId?.let { id ->
            _isMuted.value = callingUseCase.toggleMute(id)
        }
    }

    fun toggleVideo() {
        callId?.let { id ->
            _isVideoEnabled.value = callingUseCase.toggleVideo(id)
        }
    }

    fun toggleSpeaker() {
        _isSpeakerOn.value = !_isSpeakerOn.value
        callingUseCase.setSpeakerMode(_isSpeakerOn.value)
    }

    fun switchCamera() {
        callingUseCase.switchCamera()
    }

    fun endCall() {
        durationJob?.cancel()
        viewModelScope.launch {
            callId?.let { id ->
                callingUseCase.endCall(id)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        durationJob?.cancel()
    }
}

/**
 * ViewModel for the incoming call screen.
 */
@HiltViewModel
class IncomingCallViewModel @Inject constructor(
    private val callingUseCase: CallingUseCase
) : ViewModel() {

    private var callId: String? = null

    private val _callerInfo = MutableStateFlow<CallerInfo?>(null)
    val callerInfo: StateFlow<CallerInfo?> = _callerInfo.asStateFlow()

    fun loadCallerInfo(id: String) {
        callId = id

        // Get caller info from active call state
        val callState = callingUseCase.activeCalls.value[id]
        if (callState != null) {
            _callerInfo.value = CallerInfo(
                name = callState.remoteName,
                pubkey = callState.remotePubkey
            )
        }
    }

    fun acceptCall(withVideo: Boolean) {
        viewModelScope.launch {
            callId?.let { id ->
                callingUseCase.answerCall(id, withVideo)
            }
        }
    }

    fun declineCall() {
        viewModelScope.launch {
            callId?.let { id ->
                callingUseCase.rejectCall(id)
            }
        }
    }
}

/**
 * Caller information for display.
 */
data class CallerInfo(
    val name: String?,
    val pubkey: String
)

/**
 * ViewModel for call history screen.
 */
@HiltViewModel
class CallHistoryViewModel @Inject constructor(
    private val callingUseCase: CallingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CallHistoryUiState())
    val uiState: StateFlow<CallHistoryUiState> = _uiState.asStateFlow()

    private val _selectedFilter = MutableStateFlow(CallHistoryFilter.ALL)

    init {
        loadCallHistory()
    }

    private fun loadCallHistory() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            combine(
                _selectedFilter,
                when (_selectedFilter.value) {
                    CallHistoryFilter.ALL -> callingUseCase.getCallHistory()
                    CallHistoryFilter.MISSED -> callingUseCase.getMissedCalls()
                    CallHistoryFilter.INCOMING -> callingUseCase.getCallHistory().map { calls ->
                        calls.filter { it.direction.value == "incoming" }
                    }
                    CallHistoryFilter.OUTGOING -> callingUseCase.getCallHistory().map { calls ->
                        calls.filter { it.direction.value == "outgoing" }
                    }
                }
            ) { filter, calls ->
                calls
            }.collect { calls ->
                _uiState.update {
                    it.copy(
                        calls = calls,
                        isLoading = false
                    )
                }
            }
        }

        // Also observe missed call count
        viewModelScope.launch {
            callingUseCase.getMissedCallCount().collect { count ->
                _uiState.update { it.copy(missedCallCount = count) }
            }
        }
    }

    fun setFilter(filter: CallHistoryFilter) {
        _selectedFilter.value = filter
        _uiState.update { it.copy(selectedFilter = filter) }
        loadCallHistory()
    }

    fun deleteCall(callId: String) {
        viewModelScope.launch {
            callingUseCase.deleteCallFromHistory(callId)
        }
    }

    fun clearAllHistory() {
        viewModelScope.launch {
            callingUseCase.clearCallHistory()
        }
    }

    fun initiateCall(pubkey: String, name: String?, callType: CallType) {
        viewModelScope.launch {
            callingUseCase.initiateCall(pubkey, name, callType)
        }
    }
}

/**
 * UI state for call history.
 */
data class CallHistoryUiState(
    val calls: List<CallHistory> = emptyList(),
    val selectedFilter: CallHistoryFilter = CallHistoryFilter.ALL,
    val missedCallCount: Int = 0,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Filter options for call history.
 */
enum class CallHistoryFilter {
    ALL,
    MISSED,
    INCOMING,
    OUTGOING
}

/**
 * ViewModel for call settings.
 */
@HiltViewModel
class CallSettingsViewModel @Inject constructor(
    private val callingUseCase: CallingUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CallSettingsUiState())
    val uiState: StateFlow<CallSettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    private fun loadSettings() {
        viewModelScope.launch {
            callingUseCase.observeSettings().collect { settings ->
                if (settings != null) {
                    _uiState.update {
                        it.copy(
                            defaultCallType = settings.defaultCallType,
                            allowUnknownCallers = settings.allowUnknownCallers,
                            autoAnswer = settings.autoAnswer,
                            doNotDisturb = settings.doNotDisturb,
                            relayOnlyMode = settings.relayOnlyMode,
                            echoCancellation = settings.echoCancellation,
                            noiseSuppression = settings.noiseSuppression,
                            autoGainControl = settings.autoGainControl,
                            startWithCameraOff = settings.startWithCameraOff,
                            startMuted = settings.startMuted,
                            isLoading = false
                        )
                    }
                }
            }
        }
    }

    fun updateDefaultCallType(callType: String) {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(defaultCallType = callType))
        }
    }

    fun toggleAllowUnknownCallers() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(allowUnknownCallers = !settings.allowUnknownCallers))
        }
    }

    fun toggleAutoAnswer() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(autoAnswer = !settings.autoAnswer))
        }
    }

    fun toggleDoNotDisturb() {
        viewModelScope.launch {
            callingUseCase.toggleDoNotDisturb()
        }
    }

    fun toggleRelayOnlyMode() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(relayOnlyMode = !settings.relayOnlyMode))
        }
    }

    fun toggleEchoCancellation() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(echoCancellation = !settings.echoCancellation))
        }
    }

    fun toggleNoiseSuppression() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(noiseSuppression = !settings.noiseSuppression))
        }
    }

    fun toggleAutoGainControl() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(autoGainControl = !settings.autoGainControl))
        }
    }

    fun toggleStartWithCameraOff() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(startWithCameraOff = !settings.startWithCameraOff))
        }
    }

    fun toggleStartMuted() {
        viewModelScope.launch {
            val settings = callingUseCase.getSettings() ?: return@launch
            callingUseCase.updateSettings(settings.copy(startMuted = !settings.startMuted))
        }
    }
}

/**
 * UI state for call settings.
 */
data class CallSettingsUiState(
    val defaultCallType: String = "voice",
    val allowUnknownCallers: Boolean = false,
    val autoAnswer: Boolean = false,
    val doNotDisturb: Boolean = false,
    val relayOnlyMode: Boolean = false,
    val echoCancellation: Boolean = true,
    val noiseSuppression: Boolean = true,
    val autoGainControl: Boolean = true,
    val startWithCameraOff: Boolean = false,
    val startMuted: Boolean = false,
    val isLoading: Boolean = true,
    val errorMessage: String? = null
)
