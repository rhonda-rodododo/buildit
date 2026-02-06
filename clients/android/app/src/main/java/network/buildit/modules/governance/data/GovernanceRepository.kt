package network.buildit.modules.governance.data

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.modules.governance.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for governance data operations.
 */
@Singleton
class GovernanceRepository @Inject constructor(
    private val proposalsDao: ProposalsDao,
    private val votesDao: VotesDao,
    private val delegationsDao: DelegationsDao,
    private val resultsDao: ProposalResultsDao
) {
    private val json = Json { ignoreUnknownKeys = true }

    // MARK: - Proposals

    fun getAllProposals(): Flow<List<ProposalEntity>> = proposalsDao.getAllProposals()

    fun getProposalsByGroup(groupId: String): Flow<List<ProposalEntity>> =
        proposalsDao.getProposalsByGroup(groupId)

    fun getActiveProposals(): Flow<List<ProposalEntity>> = proposalsDao.getActiveProposals()

    fun getActiveProposalsByGroup(groupId: String): Flow<List<ProposalEntity>> =
        proposalsDao.getActiveProposalsByGroup(groupId)

    fun getCompletedProposals(): Flow<List<ProposalEntity>> = proposalsDao.getCompletedProposals()

    fun observeProposal(id: String): Flow<ProposalEntity?> = proposalsDao.observeProposal(id)

    suspend fun getProposalById(id: String): ProposalEntity? = proposalsDao.getProposalById(id)

    suspend fun createProposal(
        groupId: String,
        title: String,
        description: String?,
        type: ProposalType,
        votingSystem: VotingSystem,
        options: List<VoteOption>,
        quorumType: QuorumType?,
        quorumValue: Double?,
        thresholdType: ThresholdType?,
        thresholdPercentage: Double?,
        discussionStartsAt: Long?,
        discussionEndsAt: Long?,
        votingStartsAt: Long,
        votingEndsAt: Long,
        allowAbstain: Boolean,
        anonymousVoting: Boolean,
        allowDelegation: Boolean,
        createdBy: String,
        tags: List<String>,
        quadraticConfig: QuadraticVotingConfig? = null
    ): ProposalEntity {
        val proposal = ProposalEntity(
            id = java.util.UUID.randomUUID().toString(),
            groupId = groupId,
            title = title,
            description = description,
            type = type,
            status = if (discussionStartsAt != null) ProposalStatus.Discussion else ProposalStatus.Voting,
            votingSystem = votingSystem,
            optionsJson = json.encodeToString(options),
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
            createdBy = createdBy,
            tagsJson = json.encodeToString(tags),
            quadraticConfigJson = quadraticConfig?.let { json.encodeToString(it) }
        )
        proposalsDao.insertProposal(proposal)
        return proposal
    }

    suspend fun updateProposal(proposal: ProposalEntity) {
        proposalsDao.updateProposal(proposal.copy(updatedAt = System.currentTimeMillis() / 1000))
    }

    suspend fun updateProposalStatus(id: String, status: ProposalStatus) {
        proposalsDao.updateProposalStatus(id, status)
    }

    suspend fun deleteProposal(id: String) {
        proposalsDao.deleteProposal(id)
    }

    fun getActiveProposalCount(): Flow<Int> = proposalsDao.getActiveProposalCount()

    // MARK: - Votes

    fun getVotesForProposal(proposalId: String): Flow<List<VoteEntity>> =
        votesDao.getVotesForProposal(proposalId)

    fun getVotesByUser(userId: String): Flow<List<VoteEntity>> =
        votesDao.getVotesByUser(userId)

    suspend fun getUserVote(proposalId: String, userId: String): VoteEntity? =
        votesDao.getUserVote(proposalId, userId)

    suspend fun hasVoted(proposalId: String, userId: String): Boolean =
        votesDao.hasVoted(proposalId, userId)

    suspend fun createVote(
        proposalId: String,
        voterId: String,
        choice: List<String>,
        weight: Double = 1.0,
        delegatedFrom: List<String>? = null,
        comment: String? = null
    ): VoteEntity {
        val vote = VoteEntity(
            id = java.util.UUID.randomUUID().toString(),
            proposalId = proposalId,
            voterId = voterId,
            choiceJson = json.encodeToString(choice),
            weight = weight,
            delegatedFromJson = delegatedFrom?.let { json.encodeToString(it) },
            comment = comment
        )
        votesDao.insertVote(vote)
        return vote
    }

    suspend fun getVoteCount(proposalId: String): Int = votesDao.getVoteCount(proposalId)

    // MARK: - Delegations

    fun getActiveDelegations(delegatorId: String): Flow<List<DelegationEntity>> =
        delegationsDao.getActiveDelegations(delegatorId)

    fun getDelegationsToUser(delegateId: String): Flow<List<DelegationEntity>> =
        delegationsDao.getDelegationsToUser(delegateId)

    suspend fun createDelegation(
        delegatorId: String,
        delegateId: String,
        scope: DelegationScope,
        categoryTags: List<String>? = null,
        proposalId: String? = null,
        validUntil: Long? = null
    ): DelegationEntity {
        val delegation = DelegationEntity(
            id = java.util.UUID.randomUUID().toString(),
            delegatorId = delegatorId,
            delegateId = delegateId,
            scope = scope,
            categoryTagsJson = categoryTags?.let { json.encodeToString(it) },
            proposalId = proposalId,
            validUntil = validUntil
        )
        delegationsDao.insertDelegation(delegation)
        return delegation
    }

    suspend fun revokeDelegation(id: String) {
        delegationsDao.revokeDelegation(id)
    }

    // MARK: - Results

    suspend fun getResult(proposalId: String): ProposalResultEntity? =
        resultsDao.getResult(proposalId)

    fun observeResult(proposalId: String): Flow<ProposalResultEntity?> =
        resultsDao.observeResult(proposalId)

    suspend fun saveResult(
        proposalId: String,
        outcome: ProposalOutcome,
        winningOptions: List<String>,
        voteCounts: Map<String, Int>,
        totalVotes: Int,
        totalEligible: Int,
        participation: Double,
        quorumMet: Boolean,
        thresholdMet: Boolean
    ): ProposalResultEntity {
        val result = ProposalResultEntity(
            proposalId = proposalId,
            outcome = outcome,
            winningOptionsJson = json.encodeToString(winningOptions),
            voteCountsJson = json.encodeToString(voteCounts),
            totalVotes = totalVotes,
            totalEligible = totalEligible,
            participation = participation,
            quorumMet = quorumMet,
            thresholdMet = thresholdMet
        )
        resultsDao.insertResult(result)
        return result
    }

    // MARK: - Batch Operations

    suspend fun insertProposalsFromNostr(proposals: List<ProposalEntity>) {
        proposalsDao.insertProposals(proposals)
    }

    suspend fun insertVotesFromNostr(votes: List<VoteEntity>) {
        votesDao.insertVotes(votes)
    }
}
