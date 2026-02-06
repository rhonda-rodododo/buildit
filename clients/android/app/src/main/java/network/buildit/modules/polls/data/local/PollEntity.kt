package network.buildit.modules.polls.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

// Import generated protocol enums as source of truth
import network.buildit.generated.schemas.polls.PollType
import network.buildit.generated.schemas.polls.PollStatus

/**
 * Room entity for polls.
 */
@Entity(
    tableName = "polls",
    indices = [
        Index("groupId"),
        Index("createdBy"),
        Index("status"),
        Index("closesAt")
    ]
)
data class PollEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val groupId: String,
    val title: String,
    val description: String?,
    val pollType: PollType = PollType.Single,
    val status: PollStatus = PollStatus.Active,
    val optionsJson: String, // JSON array of option strings
    val isAnonymous: Boolean = false,
    val allowAddOptions: Boolean = false,
    val maxChoices: Int? = null, // For multiple choice, max selections allowed
    val closesAt: Long?,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null
)

/**
 * Room entity for poll votes.
 */
@Entity(
    tableName = "poll_votes",
    indices = [
        Index("pollId"),
        Index("voterPubkey"),
        Index(value = ["pollId", "voterPubkey"], unique = true)
    ]
)
data class PollVoteEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val pollId: String,
    val voterPubkey: String,
    val selectionsJson: String, // JSON array of selected option indices
    val rankingsJson: String?, // JSON array of rankings (for ranked choice)
    val votedAt: Long = System.currentTimeMillis() / 1000
)
