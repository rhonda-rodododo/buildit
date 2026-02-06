package network.buildit.modules.governance.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.governance.data.GovernanceRepository
import network.buildit.modules.governance.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for governance business logic.
 */
@Singleton
class GovernanceUseCase @Inject constructor(
    private val repository: GovernanceRepository,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager
) {
    companion object {
        const val KIND_PROPOSAL = 40201
        const val KIND_VOTE = 40202
        const val KIND_DELEGATION = 40203
        const val KIND_RESULT = 40204
    }

    // Current user ID
    private val currentUserId: String
        get() = cryptoManager.getPublicKeyHex() ?: ""

    // MARK: - Proposals

    fun getAllProposals(): Flow<List<ProposalEntity>> = repository.getAllProposals()

    fun getActiveProposals(): Flow<List<ProposalEntity>> = repository.getActiveProposals()

    fun getActiveProposalsByGroup(groupId: String): Flow<List<ProposalEntity>> =
        repository.getActiveProposalsByGroup(groupId)

    fun getCompletedProposals(): Flow<List<ProposalEntity>> = repository.getCompletedProposals()

    fun observeProposal(id: String): Flow<ProposalEntity?> = repository.observeProposal(id)

    suspend fun createProposal(
        groupId: String,
        title: String,
        description: String?,
        type: ProposalType = ProposalType.General,
        votingSystem: VotingSystem = VotingSystem.SimpleMajority,
        options: List<VoteOption> = VoteOption.YES_NO,
        quorumType: QuorumType? = null,
        quorumValue: Double? = null,
        thresholdType: ThresholdType? = ThresholdType.SimpleMajority,
        thresholdPercentage: Double? = 50.01,
        discussionDurationMs: Long? = null,
        votingDurationMs: Long,
        allowAbstain: Boolean = true,
        anonymousVoting: Boolean = false,
        allowDelegation: Boolean = false,
        tags: List<String> = emptyList(),
        quadraticConfig: QuadraticVotingConfig? = null
    ): ProposalEntity {
        val nowSeconds = System.currentTimeMillis() / 1000
        // Convert durations from milliseconds to seconds
        val discussionDurationSeconds = discussionDurationMs?.let { it / 1000 }
        val votingDurationSeconds = votingDurationMs / 1000

        val discussionStartsAt: Long?
        val discussionEndsAt: Long?
        val votingStartsAt: Long

        if (discussionDurationSeconds != null && discussionDurationSeconds > 0) {
            discussionStartsAt = nowSeconds
            discussionEndsAt = nowSeconds + discussionDurationSeconds
            votingStartsAt = discussionEndsAt
        } else {
            discussionStartsAt = null
            discussionEndsAt = null
            votingStartsAt = nowSeconds
        }

        val votingEndsAt = votingStartsAt + votingDurationSeconds

        val proposal = repository.createProposal(
            groupId = groupId,
            title = title,
            description = description,
            type = type,
            votingSystem = votingSystem,
            options = options,
            quorumType = quorumType,
            quorumValue = quorumValue,
            thresholdType = thresholdType,
            thresholdPercentage = thresholdPercentage,
            discussionStartsAt = discussionStartsAt,
            discussionEndsAt = discussionEndsAt,
            votingStartsAt = votingStartsAt,
            votingEndsAt = votingEndsAt,
            allowAbstain = allowAbstain,
            anonymousVoting = anonymousVoting,
            allowDelegation = allowDelegation,
            createdBy = currentUserId,
            tags = tags,
            quadraticConfig = if (votingSystem == VotingSystem.Quadratic) {
                quadraticConfig ?: QuadraticVotingConfig.DEFAULT
            } else null
        )

        publishProposal(proposal)
        return proposal
    }

    suspend fun startVoting(proposalId: String) {
        val proposal = repository.getProposalById(proposalId)
            ?: throw IllegalStateException("Proposal not found")

        if (proposal.createdBy != currentUserId) {
            throw SecurityException("Not authorized to start voting on this proposal")
        }

        repository.updateProposalStatus(proposalId, ProposalStatus.Voting)
        repository.getProposalById(proposalId)?.let { publishProposal(it) }
    }

    suspend fun withdrawProposal(proposalId: String) {
        val proposal = repository.getProposalById(proposalId)
            ?: throw IllegalStateException("Proposal not found")

        if (proposal.createdBy != currentUserId) {
            throw SecurityException("Not authorized to withdraw this proposal")
        }

        repository.updateProposalStatus(proposalId, ProposalStatus.Withdrawn)
        publishProposalDeletion(proposalId)
    }

    // MARK: - Voting

    fun getVotesForProposal(proposalId: String): Flow<List<VoteEntity>> =
        repository.getVotesForProposal(proposalId)

    suspend fun getUserVote(proposalId: String): VoteEntity? =
        repository.getUserVote(proposalId, currentUserId)

    suspend fun hasVoted(proposalId: String): Boolean =
        repository.hasVoted(proposalId, currentUserId)

    suspend fun castVote(
        proposalId: String,
        choice: List<String>,
        comment: String? = null
    ): VoteEntity {
        // Validate proposal is in voting period
        val proposal = repository.getProposalById(proposalId)
            ?: throw IllegalStateException("Proposal not found")

        if (!proposal.canVote) {
            throw IllegalStateException("Voting is not open for this proposal")
        }

        // Check if already voted
        if (repository.hasVoted(proposalId, currentUserId)) {
            throw IllegalStateException("Already voted on this proposal")
        }

        // Validate choices
        val validOptionIds = proposal.options.map { it.id }.toSet()
        for (optionId in choice) {
            if (optionId !in validOptionIds) {
                throw IllegalArgumentException("Invalid vote option: $optionId")
            }
        }

        val vote = repository.createVote(
            proposalId = proposalId,
            voterId = currentUserId,
            choice = choice,
            comment = comment
        )

        publishVote(vote)
        return vote
    }

    /**
     * Cast a quadratic vote on a proposal.
     *
     * The ballot contains token allocations per option. Effective votes = sqrt(tokens).
     */
    suspend fun castQuadraticVote(
        proposalId: String,
        ballot: QuadraticBallot,
        comment: String? = null
    ): VoteEntity {
        val proposal = repository.getProposalById(proposalId)
            ?: throw IllegalStateException("Proposal not found")

        if (!proposal.canVote) {
            throw IllegalStateException("Voting is not open for this proposal")
        }

        if (proposal.votingSystem != VotingSystem.Quadratic) {
            throw IllegalStateException("Proposal does not use quadratic voting")
        }

        val config = proposal.quadraticConfig
            ?: throw IllegalStateException("Proposal is missing quadratic voting configuration")

        if (repository.hasVoted(proposalId, currentUserId)) {
            throw IllegalStateException("Already voted on this proposal")
        }

        val validOptionIds = proposal.options.map { it.id }.toSet()
        if (!ballot.validate(config, validOptionIds)) {
            throw IllegalArgumentException("Invalid quadratic ballot: exceeds budget or contains invalid options")
        }

        // Encode ballot as JSON in the comment with a marker prefix
        val ballotJson = kotlinx.serialization.json.Json.encodeToString(
            QuadraticBallot.serializer(), ballot
        )
        val enrichedComment = "__quadratic_ballot__:$ballotJson" +
            (comment?.let { "\n$it" } ?: "")

        val vote = repository.createVote(
            proposalId = proposalId,
            voterId = currentUserId,
            choice = ballot.allocations.filter { it.value > 0 }.keys.toList(),
            comment = enrichedComment
        )

        publishVote(vote)
        return vote
    }

    /**
     * Calculate quadratic voting results for a proposal.
     */
    suspend fun calculateQuadraticResults(proposalId: String): Map<String, QuadraticOptionResult> {
        val votes = repository.getVotesForProposal(proposalId).first()
        val optionResults = mutableMapOf<String, Triple<Int, Double, Int>>() // (totalTokens, effectiveVotes, voterCount)

        for (vote in votes) {
            val commentText = vote.comment ?: continue
            if (!commentText.startsWith("__quadratic_ballot__:")) continue

            val prefix = "__quadratic_ballot__:"
            val ballotJsonStr = commentText.removePrefix(prefix).substringBefore("\n")

            val ballot = try {
                kotlinx.serialization.json.Json.decodeFromString(
                    QuadraticBallot.serializer(), ballotJsonStr
                )
            } catch (_: Exception) { continue }

            for ((optionId, tokens) in ballot.allocations) {
                if (tokens <= 0) continue
                val current = optionResults.getOrDefault(optionId, Triple(0, 0.0, 0))
                optionResults[optionId] = Triple(
                    current.first + tokens,
                    current.second + kotlin.math.sqrt(tokens.toDouble()),
                    current.third + 1
                )
            }
        }

        return optionResults.mapValues { (_, triple) ->
            QuadraticOptionResult(
                totalTokens = triple.first,
                effectiveVotes = (triple.second * 1000).toLong() / 1000.0,
                voterCount = triple.third
            )
        }
    }

    suspend fun getVoteCounts(proposalId: String): Map<String, Int> {
        val votes = repository.getVotesForProposal(proposalId).first()
        val counts = mutableMapOf<String, Int>()

        for (vote in votes) {
            for (optionId in vote.choice) {
                counts[optionId] = counts.getOrDefault(optionId, 0) + vote.weight.toInt()
            }
        }

        return counts
    }

    // MARK: - Finalization

    suspend fun finalizeProposal(proposalId: String, totalEligible: Int): ProposalResultEntity {
        val proposal = repository.getProposalById(proposalId)
            ?: throw IllegalStateException("Proposal not found")

        val votes = repository.getVotesForProposal(proposalId).first()
        val voteCounts = getVoteCounts(proposalId)
        val totalVotes = votes.size

        // Check quorum
        val quorumMet: Boolean = when (proposal.quorumType) {
            QuorumType.Percentage -> {
                val required = (totalEligible * (proposal.quorumValue ?: 0.0) / 100).toInt()
                totalVotes >= required
            }
            QuorumType.Absolute -> totalVotes >= (proposal.quorumValue ?: 0.0).toInt()
            QuorumType.None, null -> true
        }

        // Determine outcome
        val outcome: ProposalOutcome
        val winningOptions: List<String>
        var thresholdMet = false

        if (!quorumMet) {
            outcome = ProposalOutcome.NoQuorum
            winningOptions = emptyList()
        } else {
            val sortedOptions = voteCounts.entries.sortedByDescending { it.value }
            if (sortedOptions.isNotEmpty()) {
                val winner = sortedOptions.first()
                val totalVotesForOptions = voteCounts.values.sum()
                val winnerPercentage = if (totalVotesForOptions > 0) {
                    winner.value.toDouble() / totalVotesForOptions * 100
                } else 0.0

                val requiredPercentage = proposal.thresholdPercentage ?: 50.01
                thresholdMet = winnerPercentage >= requiredPercentage

                // Check for tie
                val topCount = winner.value
                val ties = sortedOptions.filter { it.value == topCount }

                when {
                    ties.size > 1 -> {
                        outcome = ProposalOutcome.Tie
                        winningOptions = ties.map { it.key }
                    }
                    thresholdMet && winner.key == "yes" -> {
                        outcome = ProposalOutcome.Passed
                        winningOptions = listOf(winner.key)
                    }
                    thresholdMet && winner.key == "no" -> {
                        outcome = ProposalOutcome.Rejected
                        winningOptions = listOf(winner.key)
                    }
                    thresholdMet -> {
                        outcome = ProposalOutcome.Passed
                        winningOptions = listOf(winner.key)
                    }
                    else -> {
                        outcome = ProposalOutcome.Rejected
                        winningOptions = emptyList()
                    }
                }
            } else {
                outcome = ProposalOutcome.NoQuorum
                winningOptions = emptyList()
            }
        }

        val participation = if (totalEligible > 0) {
            totalVotes.toDouble() / totalEligible * 100
        } else 0.0

        val result = repository.saveResult(
            proposalId = proposalId,
            outcome = outcome,
            winningOptions = winningOptions,
            voteCounts = voteCounts,
            totalVotes = totalVotes,
            totalEligible = totalEligible,
            participation = participation,
            quorumMet = quorumMet,
            thresholdMet = thresholdMet
        )

        // Update proposal status
        val newStatus = if (outcome == ProposalOutcome.Passed) ProposalStatus.Passed else ProposalStatus.Rejected
        repository.updateProposalStatus(proposalId, newStatus)

        publishResult(result)
        return result
    }

    suspend fun getResult(proposalId: String): ProposalResultEntity? =
        repository.getResult(proposalId)

    fun observeResult(proposalId: String): Flow<ProposalResultEntity?> =
        repository.observeResult(proposalId)

    // MARK: - Delegations

    fun getActiveDelegations(): Flow<List<DelegationEntity>> =
        repository.getActiveDelegations(currentUserId)

    suspend fun createDelegation(
        delegateId: String,
        scope: DelegationScope = DelegationScope.All,
        categoryTags: List<String>? = null,
        proposalId: String? = null,
        validUntil: Long? = null
    ): DelegationEntity {
        val delegation = repository.createDelegation(
            delegatorId = currentUserId,
            delegateId = delegateId,
            scope = scope,
            categoryTags = categoryTags,
            proposalId = proposalId,
            validUntil = validUntil
        )

        publishDelegation(delegation)
        return delegation
    }

    suspend fun revokeDelegation(id: String) {
        repository.revokeDelegation(id)
        publishDelegationRevocation(id)
    }

    // MARK: - Nostr Publishing

    private suspend fun publishProposal(proposal: ProposalEntity) {
        android.util.Log.d("GovernanceUseCase", "Would publish proposal: ${proposal.id}")
    }

    private suspend fun publishProposalDeletion(proposalId: String) {
        android.util.Log.d("GovernanceUseCase", "Would publish proposal deletion: $proposalId")
    }

    private suspend fun publishVote(vote: VoteEntity) {
        android.util.Log.d("GovernanceUseCase", "Would publish vote: ${vote.id}")
    }

    private suspend fun publishDelegation(delegation: DelegationEntity) {
        android.util.Log.d("GovernanceUseCase", "Would publish delegation: ${delegation.id}")
    }

    private suspend fun publishDelegationRevocation(delegationId: String) {
        android.util.Log.d("GovernanceUseCase", "Would publish delegation revocation: $delegationId")
    }

    private suspend fun publishResult(result: ProposalResultEntity) {
        android.util.Log.d("GovernanceUseCase", "Would publish result for proposal: ${result.proposalId}")
    }
}
