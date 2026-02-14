package network.buildit.modules.polls.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import network.buildit.generated.schemas.polls.PollStatus

/**
 * Data Access Object for polls.
 */
@Dao
interface PollDao {
    @Query("SELECT * FROM polls WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getPollsByGroup(groupId: String): Flow<List<PollEntity>>

    @Query("SELECT * FROM polls WHERE groupId = :groupId AND status = :status ORDER BY createdAt DESC")
    fun getPollsByGroupAndStatus(groupId: String, status: PollStatus): Flow<List<PollEntity>>

    @Query("SELECT * FROM polls WHERE groupId = :groupId AND status = 'ACTIVE' ORDER BY closesAt ASC")
    fun getActivePolls(groupId: String): Flow<List<PollEntity>>

    @Query("SELECT * FROM polls WHERE id = :id")
    suspend fun getPoll(id: String): PollEntity?

    @Query("SELECT * FROM polls WHERE id = :id")
    fun observePoll(id: String): Flow<PollEntity?>

    @Query("SELECT * FROM polls WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getPollsByCreator(pubkey: String): Flow<List<PollEntity>>

    @Query("SELECT COUNT(*) FROM polls WHERE groupId = :groupId AND status = 'ACTIVE'")
    suspend fun getActivePollCount(groupId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPoll(poll: PollEntity)

    @Update
    suspend fun updatePoll(poll: PollEntity)

    @Query("DELETE FROM polls WHERE id = :id")
    suspend fun deletePoll(id: String)

    @Query("UPDATE polls SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updatePollStatus(id: String, status: PollStatus, updatedAt: Long = System.currentTimeMillis() / 1000)
}

/**
 * Data Access Object for poll votes.
 */
@Dao
interface PollVoteDao {
    @Query("SELECT * FROM poll_votes WHERE pollId = :pollId")
    fun getVotesForPoll(pollId: String): Flow<List<PollVoteEntity>>

    @Query("SELECT * FROM poll_votes WHERE pollId = :pollId AND voterPubkey = :pubkey")
    suspend fun getVote(pollId: String, pubkey: String): PollVoteEntity?

    @Query("SELECT COUNT(*) FROM poll_votes WHERE pollId = :pollId")
    suspend fun getVoteCount(pollId: String): Int

    @Query("SELECT COUNT(DISTINCT voterPubkey) FROM poll_votes WHERE pollId = :pollId")
    suspend fun getVoterCount(pollId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVote(vote: PollVoteEntity)

    @Delete
    suspend fun deleteVote(vote: PollVoteEntity)

    @Query("DELETE FROM poll_votes WHERE pollId = :pollId AND voterPubkey = :pubkey")
    suspend fun deleteVoteByPubkey(pollId: String, pubkey: String)
}
