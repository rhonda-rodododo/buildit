package network.buildit.modules.fundraising.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Campaign status enum matching the schema.
 */
enum class CampaignStatus(val value: String, val displayName: String) {
    DRAFT("draft", "Draft"),
    ACTIVE("active", "Active"),
    PAUSED("paused", "Paused"),
    COMPLETED("completed", "Completed"),
    CANCELLED("cancelled", "Cancelled");

    companion object {
        fun fromValue(value: String): CampaignStatus =
            values().find { it.value == value } ?: DRAFT
    }
}

/**
 * Campaign visibility enum matching the schema.
 */
enum class CampaignVisibility(val value: String, val displayName: String) {
    PRIVATE("private", "Private"),
    GROUP("group", "Group Members"),
    PUBLIC("public", "Public");

    companion object {
        fun fromValue(value: String): CampaignVisibility =
            values().find { it.value == value } ?: GROUP
    }
}

/**
 * Payment method enum matching the schema.
 */
enum class PaymentMethod(val value: String, val displayName: String) {
    CARD("card", "Card"),
    BANK("bank", "Bank Transfer"),
    CRYPTO("crypto", "Cryptocurrency"),
    CASH("cash", "Cash"),
    CHECK("check", "Check"),
    OTHER("other", "Other");

    companion object {
        fun fromValue(value: String): PaymentMethod =
            values().find { it.value == value } ?: OTHER
    }
}

/**
 * Donation status enum matching the schema.
 */
enum class DonationStatus(val value: String, val displayName: String) {
    PENDING("pending", "Pending"),
    COMPLETED("completed", "Completed"),
    FAILED("failed", "Failed"),
    REFUNDED("refunded", "Refunded");

    companion object {
        fun fromValue(value: String): DonationStatus =
            values().find { it.value == value } ?: PENDING
    }
}

/**
 * Donation tier data class for JSON serialization.
 */
@kotlinx.serialization.Serializable
data class DonationTier(
    val amount: Double,
    val name: String? = null,
    val description: String? = null,
    val perks: List<String>? = null
)

/**
 * Campaign update data class for JSON serialization.
 */
@kotlinx.serialization.Serializable
data class CampaignUpdate(
    val content: String,
    val postedAt: Long
)

/**
 * Room entity for fundraising campaigns.
 */
@Entity(
    tableName = "campaigns",
    indices = [
        Index("createdBy"),
        Index("groupId"),
        Index("status"),
        Index("createdAt")
    ]
)
data class CampaignEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val title: String,
    val description: String?,
    val goal: Double,
    val currency: String,
    val raised: Double,
    val donorCount: Int,
    val startsAt: Long?,
    val endsAt: Long?,
    val status: CampaignStatus,
    val visibility: CampaignVisibility,
    val groupId: String?,
    val image: String?,
    val tiersJson: String?,
    val updatesJson: String?,
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?
) {
    /**
     * Gets donation tiers from JSON.
     */
    fun getTiers(): List<DonationTier> {
        return tiersJson?.let {
            try {
                Json.decodeFromString<List<DonationTier>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Gets campaign updates from JSON.
     */
    fun getUpdates(): List<CampaignUpdate> {
        return updatesJson?.let {
            try {
                Json.decodeFromString<List<CampaignUpdate>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Calculates progress percentage (0.0 to 1.0).
     */
    val progressPercentage: Float
        get() = if (goal > 0) (raised / goal).toFloat().coerceIn(0f, 1f) else 0f

    /**
     * Calculates progress percentage as integer (0 to 100).
     */
    val progressPercent: Int
        get() = (progressPercentage * 100).toInt()

    /**
     * Checks if campaign is accepting donations.
     */
    val isAcceptingDonations: Boolean
        get() = status == CampaignStatus.ACTIVE

    /**
     * Checks if campaign goal has been reached.
     */
    val isGoalReached: Boolean
        get() = raised >= goal

    companion object {
        fun create(
            id: String,
            title: String,
            description: String?,
            goal: Double,
            currency: String,
            groupId: String?,
            createdBy: String,
            image: String? = null,
            tiers: List<DonationTier>? = null,
            startsAt: Long? = null,
            endsAt: Long? = null,
            visibility: CampaignVisibility = CampaignVisibility.GROUP
        ): CampaignEntity {
            val now = System.currentTimeMillis() / 1000
            return CampaignEntity(
                id = id,
                schemaVersion = "1.0.0",
                title = title,
                description = description,
                goal = goal,
                currency = currency,
                raised = 0.0,
                donorCount = 0,
                startsAt = startsAt,
                endsAt = endsAt,
                status = CampaignStatus.DRAFT,
                visibility = visibility,
                groupId = groupId,
                image = image,
                tiersJson = tiers?.let { Json.encodeToString(it) },
                updatesJson = null,
                createdBy = createdBy,
                createdAt = now,
                updatedAt = null
            )
        }
    }
}

/**
 * Room entity for donations.
 */
@Entity(
    tableName = "donations",
    indices = [
        Index("campaignId"),
        Index("donorPubkey"),
        Index("donatedAt"),
        Index("status")
    ]
)
data class DonationEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val campaignId: String,
    val amount: Double,
    val currency: String,
    val donorPubkey: String?,
    val donorName: String?,
    val anonymous: Boolean,
    val message: String?,
    val tierId: String?,
    val paymentMethod: PaymentMethod,
    val status: DonationStatus,
    val donatedAt: Long
) {
    /**
     * Gets display name for donor.
     */
    val displayDonorName: String
        get() = when {
            anonymous -> "Anonymous"
            !donorName.isNullOrBlank() -> donorName
            !donorPubkey.isNullOrBlank() -> donorPubkey.take(8) + "..."
            else -> "Anonymous"
        }

    /**
     * Formats the donation amount with currency.
     */
    fun formatAmount(): String {
        return when (currency) {
            "USD" -> "$${String.format("%.2f", amount)}"
            "EUR" -> "${String.format("%.2f", amount)} EUR"
            "GBP" -> "${String.format("%.2f", amount)} GBP"
            "BTC" -> "${String.format("%.8f", amount)} BTC"
            "ETH" -> "${String.format("%.6f", amount)} ETH"
            else -> "${String.format("%.2f", amount)} $currency"
        }
    }

    companion object {
        fun create(
            id: String,
            campaignId: String,
            amount: Double,
            currency: String,
            donorPubkey: String?,
            donorName: String?,
            anonymous: Boolean,
            message: String?,
            tierId: String?,
            paymentMethod: PaymentMethod
        ): DonationEntity {
            val now = System.currentTimeMillis() / 1000
            return DonationEntity(
                id = id,
                schemaVersion = "1.0.0",
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                donorPubkey = donorPubkey,
                donorName = donorName,
                anonymous = anonymous,
                message = message,
                tierId = tierId,
                paymentMethod = paymentMethod,
                status = DonationStatus.PENDING,
                donatedAt = now
            )
        }
    }
}

/**
 * Room entity for campaign expenses.
 */
@Entity(
    tableName = "campaign_expenses",
    indices = [
        Index("campaignId"),
        Index("recordedBy"),
        Index("date")
    ]
)
data class ExpenseEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val campaignId: String,
    val amount: Double,
    val currency: String,
    val description: String,
    val category: String?,
    val receipt: String?,
    val vendor: String?,
    val date: Long?,
    val recordedBy: String,
    val recordedAt: Long
) {
    /**
     * Formats the expense amount with currency.
     */
    fun formatAmount(): String {
        return when (currency) {
            "USD" -> "$${String.format("%.2f", amount)}"
            "EUR" -> "${String.format("%.2f", amount)} EUR"
            "GBP" -> "${String.format("%.2f", amount)} GBP"
            else -> "${String.format("%.2f", amount)} $currency"
        }
    }

    companion object {
        fun create(
            id: String,
            campaignId: String,
            amount: Double,
            currency: String,
            description: String,
            category: String?,
            vendor: String?,
            recordedBy: String
        ): ExpenseEntity {
            val now = System.currentTimeMillis() / 1000
            return ExpenseEntity(
                id = id,
                schemaVersion = "1.0.0",
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                description = description,
                category = category,
                receipt = null,
                vendor = vendor,
                date = now,
                recordedBy = recordedBy,
                recordedAt = now
            )
        }
    }
}
