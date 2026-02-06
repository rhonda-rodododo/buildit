package network.buildit.modules.governance.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.SerialName
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
    D_HONDT("D'Hondt Method", "Proportional representation method"),
    CONSENSUS("Consensus", "Unanimous agreement required"),
    MODIFIED_CONSENSUS("Modified Consensus", "Consensus with blocking threshold")
}

/**
 * Attachment type for proposals.
 */
enum class AttachmentType {
    FILE,
    URL,
    DOCUMENT
}

/**
 * Supporting document for a proposal (stored as JSON array).
 */
@Serializable
data class ProposalAttachment(
    val type: AttachmentType,
    val name: String,
    val url: String? = null,
    val mimeType: String? = null,
    val size: Int? = null
)

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
 * Configuration for quadratic voting on a proposal.
 */
@Serializable
data class QuadraticVotingConfig(
    /** Total token budget each voter receives to allocate across options */
    val tokenBudget: Int,
    /** Maximum tokens a voter can allocate to a single option (defaults to tokenBudget) */
    val maxTokensPerOption: Int? = null
) {
    companion object {
        val DEFAULT = QuadraticVotingConfig(tokenBudget = 100)
    }
}

/**
 * A quadratic voting ballot with token allocations across options.
 */
@Serializable
data class QuadraticBallot(
    /** Map of option ID to number of tokens allocated */
    val allocations: Map<String, Int>,
    /** Total tokens used in this ballot */
    val totalTokens: Int
) {
    constructor(allocations: Map<String, Int>) : this(
        allocations = allocations,
        totalTokens = allocations.values.sum()
    )

    /** Calculate effective votes for each option: sqrt(tokens) */
    val effectiveVotes: Map<String, Double>
        get() = allocations.mapValues { (_, tokens) ->
            if (tokens > 0) kotlin.math.sqrt(tokens.toDouble()) else 0.0
        }

    /** Validate that the ballot doesn't exceed the token budget */
    fun validate(config: QuadraticVotingConfig, validOptionIds: Set<String>): Boolean {
        if (totalTokens > config.tokenBudget) return false
        for ((optionId, tokens) in allocations) {
            if (tokens < 0) return false
            if (optionId !in validOptionIds) return false
            val maxPerOption = config.maxTokensPerOption
            if (maxPerOption != null && tokens > maxPerOption) return false
        }
        return true
    }
}

/**
 * Result for a single option in quadratic voting.
 */
@Serializable
data class QuadraticOptionResult(
    /** Total tokens allocated to this option across all voters */
    val totalTokens: Int,
    /** Sum of sqrt(tokens) across all voters */
    val effectiveVotes: Double,
    /** Number of voters who allocated tokens to this option */
    val voterCount: Int
)

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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
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
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null,
    val attachmentsJson: String? = null, // JSON encoded ProposalAttachment list
    val tagsJson: String = "[]", // JSON encoded tags list
    val quadraticConfigJson: String? = null, // JSON encoded QuadraticVotingConfig
    val customFieldsJson: String? = null // JSON encoded custom fields
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

    val attachments: List<ProposalAttachment>
        get() = attachmentsJson?.let {
            try {
                Json.decodeFromString<List<ProposalAttachment>>(it)
            } catch (_: Exception) {
                emptyList()
            }
        } ?: emptyList()

    val quadraticConfig: QuadraticVotingConfig?
        get() = quadraticConfigJson?.let {
            try {
                Json.decodeFromString<QuadraticVotingConfig>(it)
            } catch (_: Exception) {
                null
            }
        }

    val canVote: Boolean
        get() {
            val nowSeconds = System.currentTimeMillis() / 1000
            return status == ProposalStatus.VOTING &&
                    nowSeconds >= votingStartsAt &&
                    nowSeconds <= votingEndsAt
        }

    val isInDiscussion: Boolean
        get() {
            val nowSeconds = System.currentTimeMillis() / 1000
            return status == ProposalStatus.DISCUSSION &&
                    discussionStartsAt != null &&
                    discussionEndsAt != null &&
                    nowSeconds >= discussionStartsAt &&
                    nowSeconds <= discussionEndsAt
        }

    val remainingTimeMs: Long
        get() = maxOf(0, (votingEndsAt * 1000) - System.currentTimeMillis())
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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val proposalId: String,
    val voterId: String,
    val choiceJson: String, // JSON encoded list of option IDs
    val weight: Double = 1.0,
    val delegatedFromJson: String? = null, // JSON encoded delegator IDs
    val comment: String? = null,
    val castAt: Long = System.currentTimeMillis() / 1000,
    val signature: String? = null // Cryptographic signature of the vote
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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val delegatorId: String,
    val delegateId: String,
    val scope: DelegationScope,
    val categoryTagsJson: String? = null, // JSON encoded tags
    val proposalId: String? = null,
    val validFrom: Long = System.currentTimeMillis() / 1000,
    val validUntil: Long? = null,
    val revoked: Boolean = false,
    val createdAt: Long = System.currentTimeMillis() / 1000
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
            val nowSeconds = System.currentTimeMillis() / 1000
            if (nowSeconds < validFrom) return false
            if (validUntil != null && nowSeconds > validUntil) return false
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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val outcome: ProposalOutcome,
    val winningOptionsJson: String, // JSON encoded list of option IDs
    val voteCountsJson: String, // JSON encoded map of option ID to count
    val totalVotes: Int,
    val totalEligible: Int,
    val participation: Double,
    val quorumMet: Boolean,
    val thresholdMet: Boolean,
    val calculatedAt: Long = System.currentTimeMillis() / 1000
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
