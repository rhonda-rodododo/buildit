package network.buildit.modules.governance.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * DAO for proposal operations.
 */
@Dao
interface ProposalsDao {
    @Query("SELECT * FROM proposals ORDER BY createdAt DESC")
    fun getAllProposals(): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getProposalsByGroup(groupId: String): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE status IN ('DRAFT', 'DISCUSSION', 'VOTING') ORDER BY votingEndsAt ASC")
    fun getActiveProposals(): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE status IN ('DRAFT', 'DISCUSSION', 'VOTING') AND groupId = :groupId ORDER BY votingEndsAt ASC")
    fun getActiveProposalsByGroup(groupId: String): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE status NOT IN ('DRAFT', 'DISCUSSION', 'VOTING') ORDER BY createdAt DESC")
    fun getCompletedProposals(): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE status = :status ORDER BY createdAt DESC")
    fun getProposalsByStatus(status: ProposalStatus): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE type = :type ORDER BY createdAt DESC")
    fun getProposalsByType(type: ProposalType): Flow<List<ProposalEntity>>

    @Query("SELECT * FROM proposals WHERE id = :id")
    fun observeProposal(id: String): Flow<ProposalEntity?>

    @Query("SELECT * FROM proposals WHERE id = :id")
    suspend fun getProposalById(id: String): ProposalEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProposal(proposal: ProposalEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProposals(proposals: List<ProposalEntity>)

    @Update
    suspend fun updateProposal(proposal: ProposalEntity)

    @Query("UPDATE proposals SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateProposalStatus(id: String, status: ProposalStatus, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM proposals WHERE id = :id")
    suspend fun deleteProposal(id: String)

    @Query("SELECT COUNT(*) FROM proposals WHERE status IN ('DRAFT', 'DISCUSSION', 'VOTING')")
    fun getActiveProposalCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM proposals WHERE status = 'VOTING' AND :currentTime BETWEEN votingStartsAt AND votingEndsAt")
    fun getVotingProposalCount(currentTime: Long = System.currentTimeMillis()): Flow<Int>
}

/**
 * DAO for vote operations.
 */
@Dao
interface VotesDao {
    @Query("SELECT * FROM votes WHERE proposalId = :proposalId ORDER BY castAt ASC")
    fun getVotesForProposal(proposalId: String): Flow<List<VoteEntity>>

    @Query("SELECT * FROM votes WHERE voterId = :voterId ORDER BY castAt DESC")
    fun getVotesByUser(voterId: String): Flow<List<VoteEntity>>

    @Query("SELECT * FROM votes WHERE proposalId = :proposalId AND voterId = :voterId")
    suspend fun getUserVote(proposalId: String, voterId: String): VoteEntity?

    @Query("SELECT * FROM votes WHERE id = :id")
    suspend fun getVoteById(id: String): VoteEntity?

    @Query("SELECT EXISTS(SELECT 1 FROM votes WHERE proposalId = :proposalId AND voterId = :voterId)")
    suspend fun hasVoted(proposalId: String, voterId: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVote(vote: VoteEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVotes(votes: List<VoteEntity>)

    @Update
    suspend fun updateVote(vote: VoteEntity)

    @Query("DELETE FROM votes WHERE id = :id")
    suspend fun deleteVote(id: String)

    @Query("DELETE FROM votes WHERE proposalId = :proposalId")
    suspend fun deleteVotesForProposal(proposalId: String)

    @Query("SELECT COUNT(*) FROM votes WHERE proposalId = :proposalId")
    suspend fun getVoteCount(proposalId: String): Int
}

/**
 * DAO for delegation operations.
 */
@Dao
interface DelegationsDao {
    @Query("SELECT * FROM delegations WHERE delegatorId = :delegatorId AND revoked = 0")
    fun getActiveDelegations(delegatorId: String): Flow<List<DelegationEntity>>

    @Query("SELECT * FROM delegations WHERE delegateId = :delegateId AND revoked = 0")
    fun getDelegationsToUser(delegateId: String): Flow<List<DelegationEntity>>

    @Query("SELECT * FROM delegations WHERE id = :id")
    suspend fun getDelegationById(id: String): DelegationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDelegation(delegation: DelegationEntity)

    @Update
    suspend fun updateDelegation(delegation: DelegationEntity)

    @Query("UPDATE delegations SET revoked = 1 WHERE id = :id")
    suspend fun revokeDelegation(id: String)

    @Query("DELETE FROM delegations WHERE id = :id")
    suspend fun deleteDelegation(id: String)
}

/**
 * DAO for proposal result operations.
 */
@Dao
interface ProposalResultsDao {
    @Query("SELECT * FROM proposal_results WHERE proposalId = :proposalId")
    suspend fun getResult(proposalId: String): ProposalResultEntity?

    @Query("SELECT * FROM proposal_results WHERE proposalId = :proposalId")
    fun observeResult(proposalId: String): Flow<ProposalResultEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResult(result: ProposalResultEntity)

    @Query("DELETE FROM proposal_results WHERE proposalId = :proposalId")
    suspend fun deleteResult(proposalId: String)
}
