package network.buildit.modules.governance.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Type of proposal.
 */
enum class ProposalType(val displayName: String, val icon: String) {
    GENERAL("General", "doc_text"),
    POLICY("Policy", "checkmark_shield"),
    BUDGET("Budget", "dollar_sign"),
    ELECTION("Election", "person_3"),
    AMENDMENT("Amendment", "pencil_line"),
    ACTION("Action", "bolt"),
    RESOLUTION("Resolution", "flag")
}

/**
 * Current status of a proposal.
 */
enum class ProposalStatus(val displayName: String) {
    DRAFT("Draft"),
    DISCUSSION("Discussion"),
    VOTING("Voting"),
    PASSED("Passed"),
    REJECTED("Rejected"),
    EXPIRED("Expired"),
    WITHDRAWN("Withdrawn"),
    IMPLEMENTED("Implemented");

    val isActive: Boolean
        get() = this in listOf(DRAFT, DISCUSSION, VOTING)
}

/**
 * Voting system types.
 */
enum class VotingSystem(val displayName: String, val description: String) {
    SIMPLE_MAJORITY("Simple Majority", "More than 50% required to pass"),
    SUPERMAJORITY("Supermajority (2/3)", "Two-thirds majority required"),
    RANKED_CHOICE("Ranked Choice", "Rank options in order of preference"),
    APPROVAL("Approval Voting", "Vote for all acceptable options"),
    QUADRATIC("Quadratic Voting", "Vote power scales with stake"),
    CONSENSUS("Consensus", "Unanimous agreement required"),
    MODIFIED_CONSENSUS("Modified Consensus", "Consensus with blocking threshold")
}

/**
 * Quorum requirement type.
 */
enum class QuorumType {
    PERCENTAGE,
    ABSOLUTE,
    NONE
}

/**
 * Threshold type for passing.
 */
enum class ThresholdType {
    SIMPLE_MAJORITY,
    SUPERMAJORITY,
    UNANIMOUS,
    CUSTOM
}

/**
 * Proposal outcome.
 */
enum class ProposalOutcome {
    PASSED,
    REJECTED,
    NO_QUORUM,
    TIE,
    EXPIRED
}

/**
 * A voting option for a proposal.
 */
@Serializable
data class VoteOption(
    val id: String,
    val label: String,
    val description: String? = null,
    val color: String? = null,
    val order: Int = 0
) {
    companion object {
        val YES_NO = listOf(
            VoteOption("yes", "Yes", "Vote in favor", "green", 0),
            VoteOption("no", "No", "Vote against", "red", 1),
            VoteOption("abstain", "Abstain", "Neither for nor against", "gray", 2)
        )
    }
}

/**
 * Room entity for proposals.
 */
@Entity(
    tableName = "proposals",
    indices = [
        Index("groupId"),
        Index("status"),
        Index("votingEndsAt")
    ]
)
data class ProposalEntity(
    @PrimaryKey
    val id: String,
    val groupId: String,
    val title: String,
    val description: String?,
    val type: ProposalType,
    val status: ProposalStatus,
    val votingSystem: VotingSystem,
    val optionsJson: String, // JSON encoded VoteOption list
    val quorumType: QuorumType?,
    val quorumValue: Double?,
    val quorumCountAbstentions: Boolean = true,
    val thresholdType: ThresholdType?,
    val thresholdPercentage: Double?,
    val discussionStartsAt: Long?,
    val discussionEndsAt: Long?,
    val votingStartsAt: Long,
    val votingEndsAt: Long,
    val allowAbstain: Boolean = true,
    val anonymousVoting: Boolean = false,
    val allowDelegation: Boolean = false,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long? = null,
    val tagsJson: String = "[]" // JSON encoded tags list
) {
    val options: List<VoteOption>
        get() = try {
            Json.decodeFromString(optionsJson)
        } catch (_: Exception) {
            VoteOption.YES_NO
        }

    val tags: List<String>
        get() = try {
            Json.decodeFromString(tagsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val canVote: Boolean
        get() {
            val now = System.currentTimeMillis()
            return status == ProposalStatus.VOTING &&
                    now >= votingStartsAt &&
                    now <= votingEndsAt
        }

    val isInDiscussion: Boolean
        get() {
            val now = System.currentTimeMillis()
            return status == ProposalStatus.DISCUSSION &&
                    discussionStartsAt != null &&
                    discussionEndsAt != null &&
                    now >= discussionStartsAt &&
                    now <= discussionEndsAt
        }

    val remainingTimeMs: Long
        get() = maxOf(0, votingEndsAt - System.currentTimeMillis())
}

/**
 * Room entity for votes.
 */
@Entity(
    tableName = "votes",
    indices = [
        Index("proposalId"),
        Index("voterId"),
        Index(value = ["proposalId", "voterId"], unique = true)
    ]
)
data class VoteEntity(
    @PrimaryKey
    val id: String,
    val proposalId: String,
    val voterId: String,
    val choiceJson: String, // JSON encoded list of option IDs
    val weight: Double = 1.0,
    val delegatedFromJson: String? = null, // JSON encoded delegator IDs
    val comment: String? = null,
    val castAt: Long = System.currentTimeMillis()
) {
    val choice: List<String>
        get() = try {
            Json.decodeFromString(choiceJson)
        } catch (_: Exception) {
            emptyList()
        }

    val delegatedFrom: List<String>?
        get() = delegatedFromJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (_: Exception) {
                null
            }
        }
}

/**
 * Room entity for vote delegations.
 */
@Entity(
    tableName = "delegations",
    indices = [
        Index("delegatorId"),
        Index("delegateId")
    ]
)
data class DelegationEntity(
    @PrimaryKey
    val id: String,
    val delegatorId: String,
    val delegateId: String,
    val scope: DelegationScope,
    val categoryTagsJson: String? = null, // JSON encoded tags
    val proposalId: String? = null,
    val validFrom: Long = System.currentTimeMillis(),
    val validUntil: Long? = null,
    val revoked: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
) {
    val categoryTags: List<String>?
        get() = categoryTagsJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (_: Exception) {
                null
            }
        }

    val isActive: Boolean
        get() {
            if (revoked) return false
            val now = System.currentTimeMillis()
            if (now < validFrom) return false
            if (validUntil != null && now > validUntil) return false
            return true
        }
}

enum class DelegationScope {
    ALL,
    CATEGORY,
    PROPOSAL
}

/**
 * Room entity for proposal results.
 */
@Entity(tableName = "proposal_results")
data class ProposalResultEntity(
    @PrimaryKey
    val proposalId: String,
    val outcome: ProposalOutcome,
    val winningOptionsJson: String, // JSON encoded list of option IDs
    val voteCountsJson: String, // JSON encoded map of option ID to count
    val totalVotes: Int,
    val totalEligible: Int,
    val participation: Double,
    val quorumMet: Boolean,
    val thresholdMet: Boolean,
    val calculatedAt: Long = System.currentTimeMillis()
) {
    val winningOptions: List<String>
        get() = try {
            Json.decodeFromString(winningOptionsJson)
        } catch (_: Exception) {
            emptyList()
        }

    val voteCounts: Map<String, Int>
        get() = try {
            Json.decodeFromString(voteCountsJson)
        } catch (_: Exception) {
            emptyMap()
        }
}

/**
 * Type converters for Room.
 */
class GovernanceConverters {
    @TypeConverter
    fun fromProposalType(value: ProposalType): String = value.name

    @TypeConverter
    fun toProposalType(value: String): ProposalType = ProposalType.valueOf(value)

    @TypeConverter
    fun fromProposalStatus(value: ProposalStatus): String = value.name

    @TypeConverter
    fun toProposalStatus(value: String): ProposalStatus = ProposalStatus.valueOf(value)

    @TypeConverter
    fun fromVotingSystem(value: VotingSystem): String = value.name

    @TypeConverter
    fun toVotingSystem(value: String): VotingSystem = VotingSystem.valueOf(value)

    @TypeConverter
    fun fromQuorumType(value: QuorumType?): String? = value?.name

    @TypeConverter
    fun toQuorumType(value: String?): QuorumType? = value?.let { QuorumType.valueOf(it) }

    @TypeConverter
    fun fromThresholdType(value: ThresholdType?): String? = value?.name

    @TypeConverter
    fun toThresholdType(value: String?): ThresholdType? = value?.let { ThresholdType.valueOf(it) }

    @TypeConverter
    fun fromDelegationScope(value: DelegationScope): String = value.name

    @TypeConverter
    fun toDelegationScope(value: String): DelegationScope = DelegationScope.valueOf(value)

    @TypeConverter
    fun fromProposalOutcome(value: ProposalOutcome): String = value.name

    @TypeConverter
    fun toProposalOutcome(value: String): ProposalOutcome = ProposalOutcome.valueOf(value)
}
