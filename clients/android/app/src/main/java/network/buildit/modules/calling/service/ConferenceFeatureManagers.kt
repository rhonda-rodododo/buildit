package network.buildit.modules.calling.service

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.Date
import java.util.UUID

// ============================================
// Waiting Room Manager
// ============================================

data class WaitingParticipant(
    val pubkey: String,
    val displayName: String? = null,
    val joinedAt: Date = Date()
)

sealed class WaitingRoomEvent {
    data class ParticipantWaiting(val participant: WaitingParticipant) : WaitingRoomEvent()
    data class ParticipantAdmitted(val pubkey: String) : WaitingRoomEvent()
    data class ParticipantDenied(val pubkey: String, val reason: String?) : WaitingRoomEvent()
    data class QueueUpdated(val queue: List<WaitingParticipant>) : WaitingRoomEvent()
}

class WaitingRoomManager(private val roomId: String) {
    companion object {
        private const val TAG = "WaitingRoomManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _isEnabled = MutableStateFlow(true)
    val isEnabled: StateFlow<Boolean> = _isEnabled.asStateFlow()

    private val _waitingQueue = MutableStateFlow<List<WaitingParticipant>>(emptyList())
    val waitingQueue: StateFlow<List<WaitingParticipant>> = _waitingQueue.asStateFlow()

    private val _events = MutableSharedFlow<WaitingRoomEvent>()
    val events: SharedFlow<WaitingRoomEvent> = _events.asSharedFlow()

    private var onAdmit: (suspend (String) -> Unit)? = null
    private var onDeny: (suspend (String, String?) -> Unit)? = null

    fun setEnabled(enabled: Boolean) {
        _isEnabled.value = enabled
    }

    fun setCallbacks(
        onAdmit: suspend (String) -> Unit,
        onDeny: suspend (String, String?) -> Unit
    ) {
        this.onAdmit = onAdmit
        this.onDeny = onDeny
    }

    fun addToWaitingRoom(pubkey: String, displayName: String?) {
        if (!_isEnabled.value) {
            scope.launch { _events.emit(WaitingRoomEvent.ParticipantAdmitted(pubkey)) }
            return
        }

        val participant = WaitingParticipant(pubkey, displayName, Date())
        _waitingQueue.value = _waitingQueue.value + participant

        scope.launch {
            _events.emit(WaitingRoomEvent.ParticipantWaiting(participant))
            _events.emit(WaitingRoomEvent.QueueUpdated(_waitingQueue.value))
        }

        Log.i(TAG, "Added to waiting room: $pubkey")
    }

    suspend fun admitParticipant(pubkey: String) {
        val queue = _waitingQueue.value.toMutableList()
        val index = queue.indexOfFirst { it.pubkey == pubkey }
        if (index == -1) return

        queue.removeAt(index)
        _waitingQueue.value = queue

        onAdmit?.invoke(pubkey)
        _events.emit(WaitingRoomEvent.ParticipantAdmitted(pubkey))
        _events.emit(WaitingRoomEvent.QueueUpdated(queue))

        Log.i(TAG, "Admitted: $pubkey")
    }

    suspend fun denyParticipant(pubkey: String, reason: String? = null) {
        val queue = _waitingQueue.value.toMutableList()
        val index = queue.indexOfFirst { it.pubkey == pubkey }
        if (index == -1) return

        queue.removeAt(index)
        _waitingQueue.value = queue

        onDeny?.invoke(pubkey, reason)
        _events.emit(WaitingRoomEvent.ParticipantDenied(pubkey, reason))
        _events.emit(WaitingRoomEvent.QueueUpdated(queue))

        Log.i(TAG, "Denied: $pubkey")
    }

    suspend fun admitAll() {
        val pubkeys = _waitingQueue.value.map { it.pubkey }
        for (pubkey in pubkeys) {
            admitParticipant(pubkey)
        }
    }

    fun close() {
        _waitingQueue.value = emptyList()
    }
}

// ============================================
// Host Controls Manager
// ============================================

enum class ConferenceRole {
    HOST,
    CO_HOST,
    MODERATOR,
    PARTICIPANT,
    VIEWER
}

sealed class HostControlEvent {
    data class MuteRequested(val pubkey: String) : HostControlEvent()
    data class MuteAllRequested(val exceptHosts: Boolean) : HostControlEvent()
    object AudioLocked : HostControlEvent()
    object AudioUnlocked : HostControlEvent()
    data class ParticipantRemoved(val pubkey: String) : HostControlEvent()
    data class RoleChanged(val pubkey: String, val role: ConferenceRole) : HostControlEvent()
    object RoomLocked : HostControlEvent()
    object RoomUnlocked : HostControlEvent()
    object MeetingEnded : HostControlEvent()
}

class HostControlsManager(
    private val roomId: String,
    private val localPubkey: String,
    isHost: Boolean
) {
    companion object {
        private const val TAG = "HostControlsManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _localRole = MutableStateFlow(if (isHost) ConferenceRole.HOST else ConferenceRole.PARTICIPANT)
    val localRole: StateFlow<ConferenceRole> = _localRole.asStateFlow()

    private val _isRoomLocked = MutableStateFlow(false)
    val isRoomLocked: StateFlow<Boolean> = _isRoomLocked.asStateFlow()

    private val _isAudioLocked = MutableStateFlow(false)
    val isAudioLocked: StateFlow<Boolean> = _isAudioLocked.asStateFlow()

    private val _events = MutableSharedFlow<HostControlEvent>()
    val events: SharedFlow<HostControlEvent> = _events.asSharedFlow()

    private val participantRoles = mutableMapOf<String, ConferenceRole>()
    private val mutedParticipants = mutableSetOf<String>()
    private var onSendControl: (suspend (String, String, Map<String, Any>?) -> Unit)? = null

    init {
        participantRoles[localPubkey] = _localRole.value
    }

    fun setOnSendControl(callback: suspend (String, String, Map<String, Any>?) -> Unit) {
        this.onSendControl = callback
    }

    val isHostOrCoHost: Boolean
        get() = _localRole.value == ConferenceRole.HOST || _localRole.value == ConferenceRole.CO_HOST

    val isModerator: Boolean
        get() = _localRole.value in listOf(ConferenceRole.HOST, ConferenceRole.CO_HOST, ConferenceRole.MODERATOR)

    fun getParticipantRole(pubkey: String): ConferenceRole =
        participantRoles[pubkey] ?: ConferenceRole.PARTICIPANT

    fun setParticipantRole(pubkey: String, role: ConferenceRole) {
        participantRoles[pubkey] = role
    }

    suspend fun requestMute(pubkey: String) {
        if (!isModerator) throw HostControlException.Unauthorized()

        onSendControl?.invoke(pubkey, "mute-request", mapOf("roomId" to roomId))
        _events.emit(HostControlEvent.MuteRequested(pubkey))
        Log.i(TAG, "Mute requested: $pubkey")
    }

    suspend fun forceMute(pubkey: String) {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()

        mutedParticipants.add(pubkey)
        onSendControl?.invoke(pubkey, "force-mute", mapOf("roomId" to roomId))
        _events.emit(HostControlEvent.MuteRequested(pubkey))
        Log.i(TAG, "Force muted: $pubkey")
    }

    suspend fun muteAll(exceptHosts: Boolean = true) {
        if (!isModerator) throw HostControlException.Unauthorized()

        for ((pubkey, role) in participantRoles) {
            if (pubkey == localPubkey) continue
            if (exceptHosts && role in listOf(ConferenceRole.HOST, ConferenceRole.CO_HOST)) continue
            requestMute(pubkey)
        }

        _events.emit(HostControlEvent.MuteAllRequested(exceptHosts))
    }

    suspend fun lockAudio() {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        _isAudioLocked.value = true
        _events.emit(HostControlEvent.AudioLocked)
    }

    suspend fun unlockAudio() {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        _isAudioLocked.value = false
        mutedParticipants.clear()
        _events.emit(HostControlEvent.AudioUnlocked)
    }

    fun canUnmute(pubkey: String): Boolean {
        if (_isAudioLocked.value && getParticipantRole(pubkey) !in listOf(ConferenceRole.HOST, ConferenceRole.CO_HOST)) {
            return false
        }
        return pubkey !in mutedParticipants
    }

    suspend fun removeParticipant(pubkey: String) {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        if (getParticipantRole(pubkey) == ConferenceRole.HOST) throw HostControlException.CannotRemoveHost()

        onSendControl?.invoke(pubkey, "remove", mapOf("roomId" to roomId))
        participantRoles.remove(pubkey)
        _events.emit(HostControlEvent.ParticipantRemoved(pubkey))
        Log.i(TAG, "Removed: $pubkey")
    }

    suspend fun promoteToCoHost(pubkey: String) {
        if (_localRole.value != ConferenceRole.HOST) throw HostControlException.HostOnly()

        participantRoles[pubkey] = ConferenceRole.CO_HOST
        onSendControl?.invoke(pubkey, "role-change", mapOf("roomId" to roomId, "role" to "co_host"))
        _events.emit(HostControlEvent.RoleChanged(pubkey, ConferenceRole.CO_HOST))
    }

    suspend fun promoteToModerator(pubkey: String) {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()

        participantRoles[pubkey] = ConferenceRole.MODERATOR
        onSendControl?.invoke(pubkey, "role-change", mapOf("roomId" to roomId, "role" to "moderator"))
        _events.emit(HostControlEvent.RoleChanged(pubkey, ConferenceRole.MODERATOR))
    }

    suspend fun demoteToParticipant(pubkey: String) {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        if (getParticipantRole(pubkey) == ConferenceRole.HOST) throw HostControlException.CannotDemoteHost()

        participantRoles[pubkey] = ConferenceRole.PARTICIPANT
        onSendControl?.invoke(pubkey, "role-change", mapOf("roomId" to roomId, "role" to "participant"))
        _events.emit(HostControlEvent.RoleChanged(pubkey, ConferenceRole.PARTICIPANT))
    }

    suspend fun lockRoom() {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        _isRoomLocked.value = true
        _events.emit(HostControlEvent.RoomLocked)
    }

    suspend fun unlockRoom() {
        if (!isHostOrCoHost) throw HostControlException.Unauthorized()
        _isRoomLocked.value = false
        _events.emit(HostControlEvent.RoomUnlocked)
    }

    suspend fun endMeetingForAll() {
        if (_localRole.value != ConferenceRole.HOST) throw HostControlException.HostOnly()

        for (pubkey in participantRoles.keys) {
            if (pubkey != localPubkey) {
                onSendControl?.invoke(pubkey, "meeting-ended", mapOf("roomId" to roomId))
            }
        }

        _events.emit(HostControlEvent.MeetingEnded)
    }

    fun close() {
        participantRoles.clear()
        mutedParticipants.clear()
    }
}

sealed class HostControlException(message: String) : Exception(message) {
    class Unauthorized : HostControlException("Unauthorized action")
    class HostOnly : HostControlException("Only host can perform this action")
    class CannotRemoveHost : HostControlException("Cannot remove the host")
    class CannotDemoteHost : HostControlException("Cannot demote the host")
}

// ============================================
// Hand Raise Manager
// ============================================

data class RaisedHand(
    val pubkey: String,
    val raisedAt: Date,
    val position: Int
)

sealed class HandRaiseEvent {
    data class HandRaised(val hand: RaisedHand) : HandRaiseEvent()
    data class HandLowered(val pubkey: String) : HandRaiseEvent()
    data class QueueUpdated(val queue: List<RaisedHand>) : HandRaiseEvent()
}

class HandRaiseManager(private val roomId: String) {
    companion object {
        private const val TAG = "HandRaiseManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _raisedHands = MutableStateFlow<List<RaisedHand>>(emptyList())
    val raisedHands: StateFlow<List<RaisedHand>> = _raisedHands.asStateFlow()

    private val _events = MutableSharedFlow<HandRaiseEvent>()
    val events: SharedFlow<HandRaiseEvent> = _events.asSharedFlow()

    private val handsMap = mutableMapOf<String, Date>()
    private var onSendHandRaise: (suspend (String, String) -> Unit)? = null

    fun setOnSendHandRaise(callback: suspend (String, String) -> Unit) {
        this.onSendHandRaise = callback
    }

    suspend fun raiseHand(pubkey: String) {
        if (handsMap.containsKey(pubkey)) return

        handsMap[pubkey] = Date()
        updateQueue()

        onSendHandRaise?.invoke(pubkey, "raise")

        _raisedHands.value.find { it.pubkey == pubkey }?.let { hand ->
            _events.emit(HandRaiseEvent.HandRaised(hand))
        }
        _events.emit(HandRaiseEvent.QueueUpdated(_raisedHands.value))

        Log.i(TAG, "Hand raised: $pubkey")
    }

    suspend fun lowerHand(pubkey: String) {
        if (!handsMap.containsKey(pubkey)) return

        handsMap.remove(pubkey)
        updateQueue()

        onSendHandRaise?.invoke(pubkey, "lower")

        _events.emit(HandRaiseEvent.HandLowered(pubkey))
        _events.emit(HandRaiseEvent.QueueUpdated(_raisedHands.value))

        Log.i(TAG, "Hand lowered: $pubkey")
    }

    fun handleRemoteHandRaise(pubkey: String, action: String) {
        scope.launch {
            if (action == "raise") {
                if (!handsMap.containsKey(pubkey)) {
                    handsMap[pubkey] = Date()
                    updateQueue()
                    _raisedHands.value.find { it.pubkey == pubkey }?.let { hand ->
                        _events.emit(HandRaiseEvent.HandRaised(hand))
                    }
                }
            } else {
                if (handsMap.containsKey(pubkey)) {
                    handsMap.remove(pubkey)
                    updateQueue()
                    _events.emit(HandRaiseEvent.HandLowered(pubkey))
                }
            }
            _events.emit(HandRaiseEvent.QueueUpdated(_raisedHands.value))
        }
    }

    suspend fun lowerAllHands() {
        val pubkeys = handsMap.keys.toList()
        for (pubkey in pubkeys) {
            lowerHand(pubkey)
        }
    }

    fun isHandRaised(pubkey: String): Boolean = handsMap.containsKey(pubkey)

    fun getPosition(pubkey: String): Int? =
        _raisedHands.value.find { it.pubkey == pubkey }?.position

    private fun updateQueue() {
        _raisedHands.value = handsMap.entries
            .sortedBy { it.value }
            .mapIndexed { index, entry ->
                RaisedHand(entry.key, entry.value, index + 1)
            }
    }

    fun close() {
        handsMap.clear()
        _raisedHands.value = emptyList()
    }
}

// ============================================
// Reaction Manager
// ============================================

val SUPPORTED_REACTIONS = listOf("👍", "👎", "❤️", "😂", "😮", "🎉", "👏", "✋")

data class ReactionEvent(
    val id: String,
    val pubkey: String,
    val emoji: String,
    val timestamp: Date
)

sealed class ReactionManagerEvent {
    data class ReactionReceived(val reaction: ReactionEvent) : ReactionManagerEvent()
    data class ReactionExpired(val id: String) : ReactionManagerEvent()
    data class ReactionsUpdated(val reactions: List<ReactionEvent>) : ReactionManagerEvent()
}

class ReactionManager(private val roomId: String) {
    companion object {
        private const val TAG = "ReactionManager"
        private const val DISPLAY_DURATION_MS = 5000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _activeReactions = MutableStateFlow<List<ReactionEvent>>(emptyList())
    val activeReactions: StateFlow<List<ReactionEvent>> = _activeReactions.asStateFlow()

    private val _events = MutableSharedFlow<ReactionManagerEvent>()
    val events: SharedFlow<ReactionManagerEvent> = _events.asSharedFlow()

    private var reactionCounter = 0
    private val expirationJobs = mutableMapOf<String, Job>()
    private var onSendReaction: (suspend (String) -> Unit)? = null

    fun setOnSendReaction(callback: suspend (String) -> Unit) {
        this.onSendReaction = callback
    }

    suspend fun sendReaction(pubkey: String, emoji: String) {
        if (emoji !in SUPPORTED_REACTIONS) return

        val reaction = createReaction(pubkey, emoji)
        addReaction(reaction)

        onSendReaction?.invoke(emoji)

        Log.d(TAG, "Reaction sent: $emoji")
    }

    fun handleRemoteReaction(pubkey: String, emoji: String) {
        if (emoji !in SUPPORTED_REACTIONS) return

        val reaction = createReaction(pubkey, emoji)
        scope.launch { addReaction(reaction) }

        Log.d(TAG, "Remote reaction: $emoji")
    }

    private fun createReaction(pubkey: String, emoji: String): ReactionEvent {
        reactionCounter++
        return ReactionEvent(
            id = "$pubkey-$reactionCounter",
            pubkey = pubkey,
            emoji = emoji,
            timestamp = Date()
        )
    }

    private suspend fun addReaction(reaction: ReactionEvent) {
        _activeReactions.value = _activeReactions.value + reaction
        _events.emit(ReactionManagerEvent.ReactionReceived(reaction))
        _events.emit(ReactionManagerEvent.ReactionsUpdated(_activeReactions.value))

        // Schedule expiration
        val job = scope.launch {
            delay(DISPLAY_DURATION_MS)
            removeReaction(reaction.id)
        }
        expirationJobs[reaction.id] = job
    }

    private suspend fun removeReaction(id: String) {
        _activeReactions.value = _activeReactions.value.filter { it.id != id }
        expirationJobs[id]?.cancel()
        expirationJobs.remove(id)

        _events.emit(ReactionManagerEvent.ReactionExpired(id))
        _events.emit(ReactionManagerEvent.ReactionsUpdated(_activeReactions.value))
    }

    fun getReactionCounts(): Map<String, Int> {
        return SUPPORTED_REACTIONS.associateWith { emoji ->
            _activeReactions.value.count { it.emoji == emoji }
        }
    }

    fun close() {
        expirationJobs.values.forEach { it.cancel() }
        expirationJobs.clear()
        _activeReactions.value = emptyList()
    }
}

// ============================================
// Poll Manager
// ============================================

data class PollOption(
    val id: String,
    val text: String
)

data class PollSettings(
    val anonymous: Boolean = true,
    val multiSelect: Boolean = false,
    val showLiveResults: Boolean = true,
    val allowChangeVote: Boolean = false
)

data class Poll(
    val id: String,
    val roomId: String,
    val creatorPubkey: String,
    val question: String,
    val options: List<PollOption>,
    val settings: PollSettings,
    var status: PollStatus,
    val createdAt: Date,
    var closedAt: Date? = null
)

enum class PollStatus {
    DRAFT,
    ACTIVE,
    CLOSED
}

data class PollResults(
    val pollId: String,
    val totalVotes: Int,
    val optionCounts: Map<String, Int>,
    val percentages: Map<String, Double>
)

data class PollVote(
    val pollId: String,
    val voterToken: String,
    val selectedOptions: List<String>,
    val timestamp: Date
)

sealed class PollManagerEvent {
    data class PollCreated(val poll: Poll) : PollManagerEvent()
    data class PollLaunched(val poll: Poll) : PollManagerEvent()
    data class PollClosed(val poll: Poll, val results: PollResults) : PollManagerEvent()
    data class VoteReceived(val pollId: String, val totalVotes: Int) : PollManagerEvent()
    data class ResultsUpdated(val pollId: String, val results: PollResults) : PollManagerEvent()
}

class PollManager(
    private val roomId: String,
    private val localPubkey: String
) {
    companion object {
        private const val TAG = "PollManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _polls = MutableStateFlow<List<Poll>>(emptyList())
    val polls: StateFlow<List<Poll>> = _polls.asStateFlow()

    private val _events = MutableSharedFlow<PollManagerEvent>()
    val events: SharedFlow<PollManagerEvent> = _events.asSharedFlow()

    private val votes = mutableMapOf<String, MutableMap<String, PollVote>>() // pollId -> voterToken -> vote
    private val localVotes = mutableMapOf<String, List<String>>() // pollId -> selectedOptions

    private var onSendPoll: (suspend (Poll) -> Unit)? = null
    private var onSendVote: (suspend (PollVote) -> Unit)? = null
    private var onClosePoll: (suspend (String, PollResults) -> Unit)? = null

    fun setCallbacks(
        onSendPoll: suspend (Poll) -> Unit,
        onSendVote: suspend (PollVote) -> Unit,
        onClosePoll: suspend (String, PollResults) -> Unit
    ) {
        this.onSendPoll = onSendPoll
        this.onSendVote = onSendVote
        this.onClosePoll = onClosePoll
    }

    fun createPoll(question: String, options: List<String>, settings: PollSettings = PollSettings()): Poll {
        val poll = Poll(
            id = UUID.randomUUID().toString(),
            roomId = roomId,
            creatorPubkey = localPubkey,
            question = question,
            options = options.map { PollOption(UUID.randomUUID().toString(), it) },
            settings = settings,
            status = PollStatus.DRAFT,
            createdAt = Date()
        )

        _polls.value = _polls.value + poll
        votes[poll.id] = mutableMapOf()

        scope.launch { _events.emit(PollManagerEvent.PollCreated(poll)) }

        Log.i(TAG, "Poll created: ${poll.id}")
        return poll
    }

    suspend fun launchPoll(pollId: String) {
        val pollList = _polls.value.toMutableList()
        val index = pollList.indexOfFirst { it.id == pollId }
        if (index == -1) throw PollException.PollNotFound()
        if (pollList[index].status != PollStatus.DRAFT) throw PollException.PollAlreadyLaunched()

        pollList[index] = pollList[index].copy(status = PollStatus.ACTIVE)
        _polls.value = pollList

        onSendPoll?.invoke(pollList[index])
        _events.emit(PollManagerEvent.PollLaunched(pollList[index]))

        Log.i(TAG, "Poll launched: $pollId")
    }

    suspend fun vote(pollId: String, selectedOptions: List<String>) {
        val poll = _polls.value.find { it.id == pollId } ?: throw PollException.PollNotFound()
        if (poll.status != PollStatus.ACTIVE) throw PollException.PollNotActive()

        // Validate options
        val validOptions = poll.options.map { it.id }.toSet()
        for (optionId in selectedOptions) {
            if (optionId !in validOptions) throw PollException.InvalidOption()
        }

        // Check multi-select
        if (!poll.settings.multiSelect && selectedOptions.size > 1) {
            throw PollException.MultiSelectNotAllowed()
        }

        // Check if already voted
        if (localVotes.containsKey(pollId) && !poll.settings.allowChangeVote) {
            throw PollException.AlreadyVoted()
        }

        // Generate anonymous voter token
        val voterToken = generateVoterToken(pollId)

        val vote = PollVote(
            pollId = pollId,
            voterToken = voterToken,
            selectedOptions = selectedOptions,
            timestamp = Date()
        )

        votes[pollId]?.set(voterToken, vote)
        localVotes[pollId] = selectedOptions

        onSendVote?.invoke(vote)

        val results = calculateResults(pollId)
        _events.emit(PollManagerEvent.VoteReceived(pollId, results.totalVotes))

        if (poll.settings.showLiveResults) {
            _events.emit(PollManagerEvent.ResultsUpdated(pollId, results))
        }

        Log.i(TAG, "Vote submitted for poll: $pollId")
    }

    fun handleRemoteVote(vote: PollVote) {
        val poll = _polls.value.find { it.id == vote.pollId } ?: return

        votes[vote.pollId]?.set(vote.voterToken, vote)

        scope.launch {
            val results = calculateResults(vote.pollId)
            _events.emit(PollManagerEvent.VoteReceived(vote.pollId, results.totalVotes))

            if (poll.settings.showLiveResults) {
                _events.emit(PollManagerEvent.ResultsUpdated(vote.pollId, results))
            }
        }
    }

    suspend fun closePoll(pollId: String): PollResults {
        val pollList = _polls.value.toMutableList()
        val index = pollList.indexOfFirst { it.id == pollId }
        if (index == -1) throw PollException.PollNotFound()
        if (pollList[index].status == PollStatus.CLOSED) throw PollException.PollAlreadyClosed()

        pollList[index] = pollList[index].copy(status = PollStatus.CLOSED, closedAt = Date())
        _polls.value = pollList

        val results = calculateResults(pollId)
        onClosePoll?.invoke(pollId, results)
        _events.emit(PollManagerEvent.PollClosed(pollList[index], results))

        Log.i(TAG, "Poll closed: $pollId")
        return results
    }

    fun calculateResults(pollId: String): PollResults {
        val poll = _polls.value.find { it.id == pollId }
            ?: return PollResults(pollId, 0, emptyMap(), emptyMap())

        val pollVotes = votes[pollId] ?: return PollResults(pollId, 0, emptyMap(), emptyMap())

        val optionCounts = poll.options.associate { it.id to 0 }.toMutableMap()

        for (vote in pollVotes.values) {
            for (optionId in vote.selectedOptions) {
                optionCounts[optionId] = (optionCounts[optionId] ?: 0) + 1
            }
        }

        val totalVotes = pollVotes.size
        val percentages = optionCounts.mapValues { (_, count) ->
            if (totalVotes > 0) count.toDouble() / totalVotes * 100 else 0.0
        }

        return PollResults(pollId, totalVotes, optionCounts, percentages)
    }

    fun getMyVote(pollId: String): List<String>? = localVotes[pollId]

    fun hasVoted(pollId: String): Boolean = localVotes.containsKey(pollId)

    private fun generateVoterToken(pollId: String): String {
        val data = "$roomId:$pollId:$localPubkey".toByteArray()
        val hash = MessageDigest.getInstance("SHA-256").digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    fun close() {
        _polls.value = emptyList()
        votes.clear()
        localVotes.clear()
    }
}

sealed class PollException(message: String) : Exception(message) {
    class PollNotFound : PollException("Poll not found")
    class PollAlreadyLaunched : PollException("Poll already launched")
    class PollNotActive : PollException("Poll is not active")
    class PollAlreadyClosed : PollException("Poll already closed")
    class InvalidOption : PollException("Invalid option selected")
    class MultiSelectNotAllowed : PollException("Multiple selection not allowed")
    class AlreadyVoted : PollException("Already voted")
}

// ============================================
// Breakout Room Manager
// ============================================

data class BreakoutRoom(
    val id: String,
    val name: String,
    var participants: MutableList<String> = mutableListOf(),
    var capacity: Int? = null,
    var mlsGroupId: String? = null
)

data class BreakoutState(
    var isOpen: Boolean = false,
    var duration: Long? = null, // milliseconds
    var openedAt: Date? = null,
    var warningIssued: Boolean = false
)

sealed class BreakoutRoomEvent {
    data class RoomsCreated(val rooms: List<BreakoutRoom>) : BreakoutRoomEvent()
    data class ParticipantAssigned(val pubkey: String, val breakoutId: String) : BreakoutRoomEvent()
    data class BreakoutsOpened(val duration: Long?) : BreakoutRoomEvent()
    object BreakoutsClosed : BreakoutRoomEvent()
    data class TimerWarning(val secondsRemaining: Int) : BreakoutRoomEvent()
    data class HelpRequested(val pubkey: String, val breakoutId: String) : BreakoutRoomEvent()
    data class BroadcastSent(val message: String) : BreakoutRoomEvent()
}

class BreakoutRoomManager(private val mainRoomId: String) {
    companion object {
        private const val TAG = "BreakoutRoomManager"
        private const val WARNING_THRESHOLD_SECONDS = 60
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _rooms = MutableStateFlow<List<BreakoutRoom>>(emptyList())
    val rooms: StateFlow<List<BreakoutRoom>> = _rooms.asStateFlow()

    private val _state = MutableStateFlow(BreakoutState())
    val state: StateFlow<BreakoutState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<BreakoutRoomEvent>()
    val events: SharedFlow<BreakoutRoomEvent> = _events.asSharedFlow()

    private val participantAssignments = mutableMapOf<String, String>() // pubkey -> breakoutId
    private var timerJob: Job? = null
    private var onSendToBreakout: (suspend (String, String, Map<String, Any>?) -> Unit)? = null
    private var onBroadcastAll: (suspend (String) -> Unit)? = null

    fun setCallbacks(
        onSendToBreakout: suspend (String, String, Map<String, Any>?) -> Unit,
        onBroadcastAll: suspend (String) -> Unit
    ) {
        this.onSendToBreakout = onSendToBreakout
        this.onBroadcastAll = onBroadcastAll
    }

    fun createBreakoutRooms(count: Int, names: List<String>? = null): List<BreakoutRoom> {
        val newRooms = (0 until count).map { i ->
            BreakoutRoom(
                id = UUID.randomUUID().toString(),
                name = names?.getOrNull(i) ?: "Breakout ${i + 1}"
            )
        }

        _rooms.value = newRooms
        scope.launch { _events.emit(BreakoutRoomEvent.RoomsCreated(newRooms)) }

        Log.i(TAG, "Created $count breakout rooms")
        return newRooms
    }

    fun assignParticipant(pubkey: String, breakoutId: String) {
        // Remove from previous assignment
        participantAssignments[pubkey]?.let { previousId ->
            _rooms.value.find { it.id == previousId }?.participants?.remove(pubkey)
        }

        // Add to new room
        _rooms.value.find { it.id == breakoutId }?.let { room ->
            room.participants.add(pubkey)
            participantAssignments[pubkey] = breakoutId

            scope.launch { _events.emit(BreakoutRoomEvent.ParticipantAssigned(pubkey, breakoutId)) }
            Log.i(TAG, "Assigned $pubkey to breakout $breakoutId")
        }
    }

    fun autoAssign(participants: List<String>, mode: AutoAssignMode = AutoAssignMode.RANDOM) {
        if (_rooms.value.isEmpty()) return

        val sorted = when (mode) {
            AutoAssignMode.RANDOM -> participants.shuffled()
            AutoAssignMode.ALPHABETICAL -> participants.sorted()
        }

        sorted.forEachIndexed { index, pubkey ->
            val roomIndex = index % _rooms.value.size
            assignParticipant(pubkey, _rooms.value[roomIndex].id)
        }

        Log.i(TAG, "Auto-assigned ${participants.size} participants")
    }

    fun openBreakouts(duration: Long? = null) {
        _state.value = BreakoutState(
            isOpen = true,
            duration = duration,
            openedAt = Date(),
            warningIssued = false
        )

        if (duration != null) {
            startTimer(duration)
        }

        scope.launch { _events.emit(BreakoutRoomEvent.BreakoutsOpened(duration)) }
        Log.i(TAG, "Breakouts opened")
    }

    suspend fun closeBreakouts() {
        stopTimer()
        _state.value = BreakoutState(isOpen = false)

        for (room in _rooms.value) {
            onSendToBreakout?.invoke(room.id, "return-to-main", mapOf("mainRoomId" to mainRoomId))
        }

        _events.emit(BreakoutRoomEvent.BreakoutsClosed)
        Log.i(TAG, "Breakouts closed")
    }

    fun getRemainingTime(): Long? {
        val currentState = _state.value
        if (!currentState.isOpen || currentState.duration == null || currentState.openedAt == null) {
            return null
        }
        val elapsed = System.currentTimeMillis() - currentState.openedAt!!.time
        return maxOf(0, currentState.duration!! - elapsed)
    }

    fun requestHelp(pubkey: String) {
        participantAssignments[pubkey]?.let { breakoutId ->
            scope.launch { _events.emit(BreakoutRoomEvent.HelpRequested(pubkey, breakoutId)) }
            Log.i(TAG, "Help requested from $pubkey")
        }
    }

    suspend fun broadcastToAll(message: String) {
        onBroadcastAll?.invoke(message)

        for (room in _rooms.value) {
            onSendToBreakout?.invoke(room.id, "broadcast", mapOf("message" to message))
        }

        _events.emit(BreakoutRoomEvent.BroadcastSent(message))
        Log.i(TAG, "Broadcast sent")
    }

    private fun startTimer(duration: Long) {
        stopTimer()

        timerJob = scope.launch {
            while (true) {
                delay(1000)

                val remaining = getRemainingTime() ?: break
                val remainingSeconds = (remaining / 1000).toInt()

                if (!_state.value.warningIssued && remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
                    _state.value = _state.value.copy(warningIssued = true)
                    _events.emit(BreakoutRoomEvent.TimerWarning(remainingSeconds))
                    broadcastToAll("Breakouts closing in $remainingSeconds seconds")
                }

                if (remaining <= 0) {
                    closeBreakouts()
                    break
                }
            }
        }
    }

    private fun stopTimer() {
        timerJob?.cancel()
        timerJob = null
    }

    fun getParticipantBreakout(pubkey: String): String? = participantAssignments[pubkey]

    fun close() {
        stopTimer()
        _rooms.value = emptyList()
        participantAssignments.clear()
        _state.value = BreakoutState()
    }

    enum class AutoAssignMode {
        RANDOM,
        ALPHABETICAL
    }
}

// ============================================
// Simulcast Manager (placeholder)
// ============================================

class SimulcastManager {
    // Placeholder for simulcast quality management
    fun close() {}
}
