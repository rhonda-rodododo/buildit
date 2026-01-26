package network.buildit.modules.mutualaid.data.local

import androidx.room.*

/**
 * Categories for mutual aid requests/offers.
 */
enum class AidCategory(val displayName: String, val icon: String) {
    FOOD("Food", "restaurant"),
    HOUSING("Housing", "home"),
    TRANSPORTATION("Transportation", "directions_bus"),
    RIDESHARE("Rideshare", "directions_car"),
    MEDICAL("Medical", "medical_services"),
    MENTAL_HEALTH("Mental Health", "psychology"),
    CHILDCARE("Childcare", "child_care"),
    PET_CARE("Pet Care", "pets"),
    LEGAL("Legal", "gavel"),
    FINANCIAL("Financial", "attach_money"),
    EMPLOYMENT("Employment", "work"),
    EDUCATION("Education", "school"),
    TECHNOLOGY("Technology", "computer"),
    TRANSLATION("Translation", "translate"),
    SUPPLIES("Supplies", "inventory_2"),
    CLOTHING("Clothing", "checkroom"),
    FURNITURE("Furniture", "chair"),
    HOUSEHOLD("Household", "house"),
    SAFETY("Safety", "security"),
    OTHER("Other", "help_outline")
}

/**
 * Status of an aid request.
 */
enum class RequestStatus(val displayName: String) {
    OPEN("Open"),
    IN_PROGRESS("In Progress"),
    PARTIALLY_FULFILLED("Partially Fulfilled"),
    FULFILLED("Fulfilled"),
    CLOSED("Closed"),
    EXPIRED("Expired"),
    CANCELLED("Cancelled")
}

/**
 * Urgency level for requests.
 */
enum class UrgencyLevel(val displayName: String, val priority: Int) {
    LOW("Low", 0),
    MEDIUM("Medium", 1),
    HIGH("High", 2),
    CRITICAL("Critical", 3)
}

/**
 * Status of a fulfillment offer.
 */
enum class FulfillmentStatus(val displayName: String) {
    OFFERED("Offered"),
    ACCEPTED("Accepted"),
    IN_PROGRESS("In Progress"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled"),
    DECLINED("Declined")
}

/**
 * Room entity for aid requests.
 */
@Entity(tableName = "aid_requests")
data class AidRequestEntity(
    @PrimaryKey val id: String,
    val groupId: String?,
    val title: String,
    val description: String?,
    val category: AidCategory,
    val status: RequestStatus,
    val urgency: UrgencyLevel,
    val requesterId: String,
    val anonymousRequest: Boolean = false,
    val locationCity: String?,
    val locationRegion: String?,
    val locationType: String?, // "point", "area", "flexible", "remote"
    val latitude: Double?,
    val longitude: Double?,
    val neededBy: Long?, // Unix timestamp
    val quantityNeeded: Double?,
    val quantityFulfilled: Double = 0.0,
    val unit: String?,
    val tags: String?, // JSON array as string
    val createdAt: Long,
    val updatedAt: Long?,
    val closedAt: Long?
) {
    val isActive: Boolean
        get() = status == RequestStatus.OPEN ||
                status == RequestStatus.IN_PROGRESS ||
                status == RequestStatus.PARTIALLY_FULFILLED

    val progressPercentage: Float
        get() {
            val needed = quantityNeeded ?: return 0f
            if (needed <= 0) return 0f
            return (quantityFulfilled / needed).coerceAtMost(1.0).toFloat()
        }

    val locationDisplay: String
        get() {
            if (locationType == "remote") return "Remote"
            if (locationType == "flexible") return "Flexible"
            return listOfNotNull(locationCity, locationRegion).joinToString(", ").ifEmpty { "Not specified" }
        }
}

/**
 * Room entity for aid offers.
 */
@Entity(tableName = "aid_offers")
data class AidOfferEntity(
    @PrimaryKey val id: String,
    val groupId: String?,
    val title: String,
    val description: String?,
    val category: AidCategory,
    val status: String, // "active", "claimed", "expired", "withdrawn"
    val offererId: String,
    val locationCity: String?,
    val locationRegion: String?,
    val locationType: String?,
    val latitude: Double?,
    val longitude: Double?,
    val availableFrom: Long?,
    val availableUntil: Long?,
    val quantity: Double?,
    val unit: String?,
    val tags: String?,
    val createdAt: Long,
    val updatedAt: Long?
) {
    val isActive: Boolean
        get() {
            if (status != "active") return false
            val now = System.currentTimeMillis()
            availableUntil?.let { if (it < now) return false }
            return true
        }

    val locationDisplay: String
        get() {
            if (locationType == "remote") return "Remote"
            if (locationType == "flexible") return "Flexible"
            return listOfNotNull(locationCity, locationRegion).joinToString(", ").ifEmpty { "Not specified" }
        }
}

/**
 * Room entity for fulfillments.
 */
@Entity(
    tableName = "fulfillments",
    foreignKeys = [
        ForeignKey(
            entity = AidRequestEntity::class,
            parentColumns = ["id"],
            childColumns = ["requestId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("requestId")]
)
data class FulfillmentEntity(
    @PrimaryKey val id: String,
    val requestId: String,
    val fulfillerId: String,
    val status: FulfillmentStatus,
    val quantity: Double?,
    val message: String?,
    val scheduledFor: Long?,
    val completedAt: Long?,
    val createdAt: Long
)
