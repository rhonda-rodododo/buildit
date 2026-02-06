package network.buildit.modules.governance.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.modules.governance.data.local.*
import network.buildit.modules.governance.domain.GovernanceUseCase
import javax.inject.Inject

/**
 * UI state for the governance list screen.
 */
data class GovernanceListUiState(
    val activeProposals: List<ProposalEntity> = emptyList(),
    val completedProposals: List<ProposalEntity> = emptyList(),
    val selectedTab: Int = 0, // 0 = Active, 1 = Completed
    val selectedType: ProposalType? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for the governance list screen.
 */
@HiltViewModel
class GovernanceListViewModel @Inject constructor(
    private val useCase: GovernanceUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(GovernanceListUiState())
    val uiState: StateFlow<GovernanceListUiState> = _uiState.asStateFlow()

    private val _selectedType = MutableStateFlow<ProposalType?>(null)

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.getActiveProposals().collect { proposals ->
                val filtered = _selectedType.value?.let { type ->
                    proposals.filter { it.type == type }
                } ?: proposals

                _uiState.update {
                    it.copy(
                        activeProposals = filtered,
                        isLoading = false
                    )
                }
            }
        }

        viewModelScope.launch {
            useCase.getCompletedProposals().collect { proposals ->
                val filtered = _selectedType.value?.let { type ->
                    proposals.filter { it.type == type }
                } ?: proposals

                _uiState.update { it.copy(completedProposals = filtered) }
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun selectType(type: ProposalType?) {
        _selectedType.value = type
        _uiState.update { it.copy(selectedType = type) }
        loadData() // Refresh with filter
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}

/**
 * UI state for creating a proposal.
 */
data class CreateProposalUiState(
    val title: String = "",
    val description: String = "",
    val type: ProposalType = ProposalType.GENERAL,
    val votingSystem: VotingSystem = VotingSystem.SIMPLE_MAJORITY,
    val votingDurationDays: Int = 7,
    val includeDiscussion: Boolean = false,
    val discussionDurationDays: Int = 3,
    val useCustomOptions: Boolean = false,
    val customOptions: List<String> = listOf("Option 1", "Option 2"),
    val allowAbstain: Boolean = true,
    val tags: String = "",
    val tokenBudget: Int = 100,
    val maxTokensPerOption: Int? = null,
    val isSubmitting: Boolean = false,
    val isComplete: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for creating a proposal.
 */
@HiltViewModel
class CreateProposalViewModel @Inject constructor(
    private val useCase: GovernanceUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateProposalUiState())
    val uiState: StateFlow<CreateProposalUiState> = _uiState.asStateFlow()

    fun updateTitle(title: String) {
        _uiState.update { it.copy(title = title) }
    }

    fun updateDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun updateType(type: ProposalType) {
        _uiState.update { it.copy(type = type) }
    }

    fun updateVotingSystem(system: VotingSystem) {
        _uiState.update { it.copy(votingSystem = system) }
    }

    fun updateVotingDurationDays(days: Int) {
        _uiState.update { it.copy(votingDurationDays = days.coerceIn(1, 30)) }
    }

    fun updateIncludeDiscussion(include: Boolean) {
        _uiState.update { it.copy(includeDiscussion = include) }
    }

    fun updateDiscussionDurationDays(days: Int) {
        _uiState.update { it.copy(discussionDurationDays = days.coerceIn(1, 30)) }
    }

    fun updateUseCustomOptions(use: Boolean) {
        _uiState.update { it.copy(useCustomOptions = use) }
    }

    fun updateCustomOption(index: Int, value: String) {
        val options = _uiState.value.customOptions.toMutableList()
        if (index < options.size) {
            options[index] = value
            _uiState.update { it.copy(customOptions = options) }
        }
    }

    fun addCustomOption() {
        val options = _uiState.value.customOptions.toMutableList()
        options.add("Option ${options.size + 1}")
        _uiState.update { it.copy(customOptions = options) }
    }

    fun removeCustomOption(index: Int) {
        val options = _uiState.value.customOptions.toMutableList()
        if (options.size > 2 && index < options.size) {
            options.removeAt(index)
            _uiState.update { it.copy(customOptions = options) }
        }
    }

    fun updateAllowAbstain(allow: Boolean) {
        _uiState.update { it.copy(allowAbstain = allow) }
    }

    fun updateTags(tags: String) {
        _uiState.update { it.copy(tags = tags) }
    }

    fun updateTokenBudget(budget: Int) {
        _uiState.update { it.copy(tokenBudget = budget.coerceIn(1, 1000)) }
    }

    fun updateMaxTokensPerOption(max: Int?) {
        _uiState.update { it.copy(maxTokensPerOption = max?.coerceIn(1, _uiState.value.tokenBudget)) }
    }

    fun isValid(): Boolean {
        val state = _uiState.value
        return state.title.isNotBlank() &&
                (!state.useCustomOptions || state.customOptions.size >= 2)
    }

    fun submit(groupId: String) {
        if (!isValid()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val state = _uiState.value

                val options = if (state.useCustomOptions) {
                    state.customOptions.mapIndexed { index, label ->
                        VoteOption(
                            id = java.util.UUID.randomUUID().toString(),
                            label = label,
                            order = index
                        )
                    }
                } else {
                    val opts = mutableListOf(
                        VoteOption("yes", "Yes", "Vote in favor", "green", 0),
                        VoteOption("no", "No", "Vote against", "red", 1)
                    )
                    if (state.allowAbstain) {
                        opts.add(VoteOption("abstain", "Abstain", "Neither for nor against", "gray", 2))
                    }
                    opts
                }

                val votingDurationMs = state.votingDurationDays * 24 * 60 * 60 * 1000L
                val discussionDurationMs = if (state.includeDiscussion) {
                    state.discussionDurationDays * 24 * 60 * 60 * 1000L
                } else null

                val parsedTags = state.tags
                    .split(",")
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }

                val quadraticCfg = if (state.votingSystem == VotingSystem.QUADRATIC) {
                    QuadraticVotingConfig(
                        tokenBudget = state.tokenBudget,
                        maxTokensPerOption = state.maxTokensPerOption
                    )
                } else null

                useCase.createProposal(
                    groupId = groupId,
                    title = state.title.trim(),
                    description = state.description.ifBlank { null },
                    type = state.type,
                    votingSystem = state.votingSystem,
                    options = options,
                    discussionDurationMs = discussionDurationMs,
                    votingDurationMs = votingDurationMs,
                    allowAbstain = state.allowAbstain,
                    tags = parsedTags,
                    quadraticConfig = quadraticCfg
                )

                _uiState.update { it.copy(isSubmitting = false, isComplete = true) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to create proposal"
                    )
                }
            }
        }
    }
}

/**
 * UI state for proposal detail.
 */
data class ProposalDetailUiState(
    val proposal: ProposalEntity? = null,
    val voteCounts: Map<String, Int> = emptyMap(),
    val userVote: VoteEntity? = null,
    val hasVoted: Boolean = false,
    val result: ProposalResultEntity? = null,
    val isLoading: Boolean = true,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for proposal detail.
 */
@HiltViewModel
class ProposalDetailViewModel @Inject constructor(
    private val useCase: GovernanceUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProposalDetailUiState())
    val uiState: StateFlow<ProposalDetailUiState> = _uiState.asStateFlow()

    fun loadProposal(proposalId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.observeProposal(proposalId).collect { proposal ->
                _uiState.update { it.copy(proposal = proposal, isLoading = false) }
            }
        }

        viewModelScope.launch {
            useCase.getVotesForProposal(proposalId).collect { _ ->
                val counts = useCase.getVoteCounts(proposalId)
                _uiState.update { it.copy(voteCounts = counts) }
            }
        }

        viewModelScope.launch {
            val hasVoted = useCase.hasVoted(proposalId)
            val userVote = useCase.getUserVote(proposalId)
            _uiState.update { it.copy(hasVoted = hasVoted, userVote = userVote) }
        }

        viewModelScope.launch {
            useCase.observeResult(proposalId).collect { result ->
                _uiState.update { it.copy(result = result) }
            }
        }
    }

    fun castVote(
        proposalId: String,
        choice: List<String>,
        comment: String?
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val vote = useCase.castVote(
                    proposalId = proposalId,
                    choice = choice,
                    comment = comment
                )
                val counts = useCase.getVoteCounts(proposalId)

                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        hasVoted = true,
                        userVote = vote,
                        voteCounts = counts
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to cast vote"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
