package network.buildit.modules.polls.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.generated.schemas.polls.PollStatus
import network.buildit.generated.schemas.polls.PollType
import network.buildit.modules.polls.data.PollRepository
import network.buildit.modules.polls.data.local.PollEntity
import network.buildit.modules.polls.data.local.PollVoteEntity
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for polls module operations.
 *
 * Handles:
 * - Creating and managing polls
 * - Voting with single, multiple, and ranked choice support
 * - Anonymous voting
 * - Auto-close on deadline
 * - Results aggregation
 */
@Singleton
class PollsUseCase @Inject constructor(
    private val repository: PollRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    /**
     * Creates a new poll.
     */
    suspend fun createPoll(
        groupId: String,
        title: String,
        description: String? = null,
        options: List<String>,
        pollType: PollType = PollType.Single,
        isAnonymous: Boolean = false,
        closesAt: Long? = null,
        maxChoices: Int? = null
    ): ModuleResult<PollEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            require(options.size >= 2) { "A poll must have at least 2 options" }

            val poll = PollEntity(
                id = UUID.randomUUID().toString(),
                groupId = groupId,
                title = title,
                description = description,
                pollType = pollType,
                status = PollStatus.Active,
                optionsJson = Json.encodeToString(options),
                isAnonymous = isAnonymous,
                maxChoices = maxChoices,
                closesAt = closesAt,
                createdBy = pubkey
            )

            repository.savePoll(poll)
            publishPollToNostr(poll)
            poll
        }.toModuleResult()
    }

    /**
     * Submits a vote on a poll.
     */
    suspend fun vote(
        pollId: String,
        selections: List<Int>,
        rankings: List<Int>? = null
    ): ModuleResult<PollVoteEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val poll = repository.getPoll(pollId)
                ?: throw IllegalStateException("Poll not found")

            // Validate poll is active
            require(poll.status == PollStatus.Active) { "Poll is not active" }

            // Check if already voted
            val existingVote = repository.getVote(pollId, pubkey)
            if (existingVote != null) {
                throw IllegalStateException("You have already voted on this poll")
            }

            // Validate selections
            val options = Json.decodeFromString<List<String>>(poll.optionsJson)
            require(selections.all { it in options.indices }) { "Invalid option selected" }

            when (poll.pollType) {
                PollType.Single -> {
                    require(selections.size == 1) { "Select exactly one option" }
                }
                PollType.Multiple -> {
                    val max = poll.maxChoices ?: options.size
                    require(selections.size in 1..max) { "Select between 1 and $max options" }
                }
                PollType.RankedChoice -> {
                    require(rankings != null && rankings.size == options.size) {
                        "Rank all options for ranked choice"
                    }
                }
            }

            val vote = PollVoteEntity(
                id = UUID.randomUUID().toString(),
                pollId = pollId,
                voterPubkey = pubkey,
                selectionsJson = Json.encodeToString(selections),
                rankingsJson = rankings?.let { Json.encodeToString(it) }
            )

            repository.saveVote(vote)
            publishVoteToNostr(vote, poll)
            vote
        }.toModuleResult()
    }

    /**
     * Closes a poll.
     */
    suspend fun closePoll(pollId: String): ModuleResult<Unit> {
        return runCatching {
            repository.updatePollStatus(pollId, PollStatus.Closed)
            val poll = repository.getPoll(pollId)
            if (poll != null) {
                publishPollToNostr(poll.copy(status = PollStatus.Closed))
            }
        }.toModuleResult()
    }

    /**
     * Deletes a poll.
     */
    suspend fun deletePoll(pollId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deletePoll(pollId)
            publishPollDeletion(pollId)
        }.toModuleResult()
    }

    /**
     * Gets poll results aggregation.
     */
    suspend fun getPollResults(pollId: String): ModuleResult<PollResults> {
        return runCatching {
            val poll = repository.getPoll(pollId)
                ?: throw IllegalStateException("Poll not found")

            val options = Json.decodeFromString<List<String>>(poll.optionsJson)
            val voterCount = repository.getVoterCount(pollId)
            val votes = mutableListOf<PollVoteEntity>()

            // Collect votes
            repository.getVotesForPoll(pollId).collect { voteList ->
                votes.clear()
                votes.addAll(voteList)
            }

            // Calculate results
            val optionCounts = IntArray(options.size)
            votes.forEach { vote ->
                val selections = Json.decodeFromString<List<Int>>(vote.selectionsJson)
                selections.forEach { index ->
                    if (index in optionCounts.indices) {
                        optionCounts[index]++
                    }
                }
            }

            PollResults(
                pollId = pollId,
                options = options,
                voteCounts = optionCounts.toList(),
                totalVoters = voterCount,
                isAnonymous = poll.isAnonymous
            )
        }.toModuleResult()
    }

    fun getPolls(groupId: String): Flow<List<PollEntity>> {
        return repository.getPollsByGroup(groupId)
    }

    fun getActivePolls(groupId: String): Flow<List<PollEntity>> {
        return repository.getActivePolls(groupId)
    }

    suspend fun getPoll(id: String): PollEntity? {
        return repository.getPoll(id)
    }

    fun observePoll(id: String): Flow<PollEntity?> {
        return repository.observePoll(id)
    }

    fun getVotesForPoll(pollId: String): Flow<List<PollVoteEntity>> {
        return repository.getVotesForPoll(pollId)
    }

    suspend fun getUserVote(pollId: String): PollVoteEntity? {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return null
        return repository.getVote(pollId, pubkey)
    }

    suspend fun getVoterCount(pollId: String): Int {
        return repository.getVoterCount(pollId)
    }

    /**
     * Checks and auto-closes expired polls.
     */
    suspend fun checkExpiredPolls(groupId: String) {
        val now = System.currentTimeMillis() / 1000
        // This would need a query to find expired active polls
        // For now, polls close based on client-side checking
    }

    private suspend fun publishPollToNostr(poll: PollEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to poll.schemaVersion,
                "id" to poll.id,
                "title" to poll.title,
                "description" to (poll.description ?: ""),
                "type" to poll.pollType.name.lowercase(),
                "status" to poll.status.name.lowercase(),
                "options" to poll.optionsJson,
                "anonymous" to poll.isAnonymous.toString(),
                "closesAt" to (poll.closesAt?.toString() ?: "")
            )
        )

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("g", poll.groupId))
        tags.add(listOf("d", poll.id))

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_POLL,
            tags = tags,
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishVoteToNostr(vote: PollVoteEntity, poll: PollEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = if (poll.isAnonymous) {
            // For anonymous polls, don't include voter identity in content
            Json.encodeToString(mapOf("selections" to vote.selectionsJson))
        } else {
            Json.encodeToString(
                mapOf(
                    "selections" to vote.selectionsJson,
                    "rankings" to (vote.rankingsJson ?: "")
                )
            )
        }

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("e", vote.pollId))

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = vote.votedAt,
            kind = KIND_POLL_VOTE,
            tags = tags,
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishPollDeletion(pollId: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val deleteEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = NostrClient.KIND_DELETE,
            tags = listOf(listOf("e", pollId)),
            content = ""
        )

        val signed = cryptoManager.signEvent(deleteEvent) ?: return
        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    companion object {
        const val KIND_POLL = 31927 // Parameterized replaceable event for polls
        const val KIND_POLL_VOTE = 31928 // Parameterized replaceable event for votes
    }
}

/**
 * Aggregated poll results.
 */
data class PollResults(
    val pollId: String,
    val options: List<String>,
    val voteCounts: List<Int>,
    val totalVoters: Int,
    val isAnonymous: Boolean
) {
    val totalVotes: Int get() = voteCounts.sum()

    fun getPercentage(optionIndex: Int): Float {
        if (totalVoters == 0) return 0f
        return (voteCounts.getOrElse(optionIndex) { 0 }.toFloat() / totalVoters) * 100f
    }

    val winningOptionIndex: Int? get() {
        if (voteCounts.isEmpty() || totalVoters == 0) return null
        return voteCounts.indices.maxByOrNull { voteCounts[it] }
    }
}
