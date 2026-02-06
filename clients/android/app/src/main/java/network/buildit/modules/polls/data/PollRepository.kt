package network.buildit.modules.polls.data

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.polls.data.local.PollDao
import network.buildit.modules.polls.data.local.PollEntity
import network.buildit.modules.polls.data.local.PollStatus
import network.buildit.modules.polls.data.local.PollVoteDao
import network.buildit.modules.polls.data.local.PollVoteEntity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for poll data.
 */
@Singleton
class PollRepository @Inject constructor(
    private val pollDao: PollDao,
    private val voteDao: PollVoteDao
) {
    fun getPollsByGroup(groupId: String): Flow<List<PollEntity>> {
        return pollDao.getPollsByGroup(groupId)
    }

    fun getPollsByGroupAndStatus(groupId: String, status: PollStatus): Flow<List<PollEntity>> {
        return pollDao.getPollsByGroupAndStatus(groupId, status)
    }

    fun getActivePolls(groupId: String): Flow<List<PollEntity>> {
        return pollDao.getActivePolls(groupId)
    }

    suspend fun getPoll(id: String): PollEntity? {
        return pollDao.getPoll(id)
    }

    fun observePoll(id: String): Flow<PollEntity?> {
        return pollDao.observePoll(id)
    }

    suspend fun savePoll(poll: PollEntity) {
        pollDao.insertPoll(poll)
    }

    suspend fun updatePoll(poll: PollEntity) {
        pollDao.updatePoll(poll)
    }

    suspend fun deletePoll(pollId: String) {
        pollDao.deletePoll(pollId)
    }

    suspend fun updatePollStatus(pollId: String, status: PollStatus) {
        pollDao.updatePollStatus(pollId, status)
    }

    suspend fun getActivePollCount(groupId: String): Int {
        return pollDao.getActivePollCount(groupId)
    }

    // Vote methods

    fun getVotesForPoll(pollId: String): Flow<List<PollVoteEntity>> {
        return voteDao.getVotesForPoll(pollId)
    }

    suspend fun getVote(pollId: String, pubkey: String): PollVoteEntity? {
        return voteDao.getVote(pollId, pubkey)
    }

    suspend fun getVoteCount(pollId: String): Int {
        return voteDao.getVoteCount(pollId)
    }

    suspend fun getVoterCount(pollId: String): Int {
        return voteDao.getVoterCount(pollId)
    }

    suspend fun saveVote(vote: PollVoteEntity) {
        voteDao.insertVote(vote)
    }

    suspend fun deleteVote(pollId: String, pubkey: String) {
        voteDao.deleteVoteByPubkey(pollId, pubkey)
    }
}
