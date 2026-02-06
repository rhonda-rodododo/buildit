package network.buildit.modules.polls.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.polls.data.local.PollEntity
import network.buildit.modules.polls.data.local.PollType
import network.buildit.modules.polls.data.local.PollVoteEntity
import network.buildit.modules.polls.domain.PollResults
import network.buildit.modules.polls.domain.PollsUseCase
import javax.inject.Inject

/**
 * UI state for the polls list screen.
 */
data class PollsUiState(
    val polls: List<PollEntity> = emptyList(),
    val groupId: String? = null,
    val showActiveOnly: Boolean = true,
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * UI state for a poll detail screen.
 */
data class PollDetailUiState(
    val poll: PollEntity? = null,
    val options: List<String> = emptyList(),
    val userVote: PollVoteEntity? = null,
    val results: PollResults? = null,
    val voterCount: Int = 0,
    val hasVoted: Boolean = false,
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * ViewModel for the Polls module.
 */
@HiltViewModel
class PollsViewModel @Inject constructor(
    private val pollsUseCase: PollsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(PollsUiState())
    val uiState: StateFlow<PollsUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow(PollDetailUiState())
    val detailState: StateFlow<PollDetailUiState> = _detailState.asStateFlow()

    /**
     * Loads polls for a group.
     */
    fun loadPolls(groupId: String) {
        _uiState.update { it.copy(groupId = groupId, isLoading = true, error = null) }

        viewModelScope.launch {
            val flow = if (_uiState.value.showActiveOnly) {
                pollsUseCase.getActivePolls(groupId)
            } else {
                pollsUseCase.getPolls(groupId)
            }

            flow
                .catch { e -> _uiState.update { it.copy(error = e.message, isLoading = false) } }
                .collect { polls ->
                    _uiState.update { it.copy(polls = polls, isLoading = false) }
                }
        }
    }

    /**
     * Toggles between showing active only or all polls.
     */
    fun toggleActiveFilter() {
        _uiState.update { it.copy(showActiveOnly = !it.showActiveOnly) }
        _uiState.value.groupId?.let { loadPolls(it) }
    }

    /**
     * Creates a new poll.
     */
    fun createPoll(
        title: String,
        description: String?,
        options: List<String>,
        pollType: PollType,
        isAnonymous: Boolean,
        closesAt: Long?,
        maxChoices: Int?
    ) {
        val groupId = _uiState.value.groupId ?: return

        viewModelScope.launch {
            when (val result = pollsUseCase.createPoll(
                groupId = groupId,
                title = title,
                description = description,
                options = options,
                pollType = pollType,
                isAnonymous = isAnonymous,
                closesAt = closesAt,
                maxChoices = maxChoices
            )) {
                is ModuleResult.Success -> {
                    loadPolls(groupId)
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Polls module not enabled") }
                }
            }
        }
    }

    /**
     * Loads poll detail with votes and results.
     */
    fun loadPollDetail(pollId: String) {
        _detailState.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            pollsUseCase.observePoll(pollId)
                .catch { e -> _detailState.update { it.copy(error = e.message, isLoading = false) } }
                .collect { poll ->
                    if (poll == null) {
                        _detailState.update { it.copy(error = "Poll not found", isLoading = false) }
                        return@collect
                    }

                    val options = try {
                        kotlinx.serialization.json.Json.decodeFromString<List<String>>(poll.optionsJson)
                    } catch (_: Exception) {
                        emptyList()
                    }

                    val userVote = pollsUseCase.getUserVote(pollId)
                    val voterCount = pollsUseCase.getVoterCount(pollId)

                    _detailState.update {
                        it.copy(
                            poll = poll,
                            options = options,
                            userVote = userVote,
                            hasVoted = userVote != null,
                            voterCount = voterCount,
                            isLoading = false
                        )
                    }
                }
        }

        // Load results
        viewModelScope.launch {
            when (val result = pollsUseCase.getPollResults(pollId)) {
                is ModuleResult.Success -> {
                    _detailState.update { it.copy(results = result.data) }
                }
                is ModuleResult.Error -> {
                    // Results may not be available yet
                }
                ModuleResult.NotEnabled -> { /* ignore */ }
            }
        }
    }

    /**
     * Submits a vote.
     */
    fun vote(pollId: String, selections: List<Int>, rankings: List<Int>? = null) {
        viewModelScope.launch {
            when (val result = pollsUseCase.vote(pollId, selections, rankings)) {
                is ModuleResult.Success -> {
                    loadPollDetail(pollId)
                }
                is ModuleResult.Error -> {
                    _detailState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _detailState.update { it.copy(error = "Polls module not enabled") }
                }
            }
        }
    }

    /**
     * Closes a poll.
     */
    fun closePoll(pollId: String) {
        viewModelScope.launch {
            when (val result = pollsUseCase.closePoll(pollId)) {
                is ModuleResult.Success -> {
                    loadPollDetail(pollId)
                }
                is ModuleResult.Error -> {
                    _detailState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _detailState.update { it.copy(error = "Polls module not enabled") }
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
        _detailState.update { it.copy(error = null) }
    }
}
