package network.buildit.modules.mutualaid.data.local

import androidx.room.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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
 * Location type for aid requests/offers.
 */
enum class LocationType {
    POINT,
    AREA,
    FLEXIBLE,
    REMOTE
}

/**
 * Privacy level for location data.
 */
enum class LocationPrivacyLevel {
    EXACT,
    APPROXIMATE,
    CITY_ONLY,
    HIDDEN
}

/**
 * Coordinates for a location.
 */
@Serializable
data class Coordinates(
    val lat: Double,
    val lng: Double
)

/**
 * Nested location object matching protocol schema.
 * Used as an embedded object in Room entities.
 */
data class AidLocation(
    val type: LocationType = LocationType.POINT,
    val address: String? = null,
    val city: String? = null,
    val region: String? = null,
    val postalCode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val radius: Double? = null,
    val privacyLevel: LocationPrivacyLevel? = null
) {
    val displayName: String
        get() {
            if (type == LocationType.REMOTE) return "Remote"
            if (type == LocationType.FLEXIBLE) return "Flexible"
            return listOfNotNull(city, region).joinToString(", ").ifEmpty { "Not specified" }
        }

    val hasCoordinates: Boolean
        get() = latitude != null && longitude != null
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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String?,
    val title: String,
    val description: String?,
    val category: AidCategory,
    val status: RequestStatus,
    val urgency: UrgencyLevel,
    val requesterId: String,
    val anonymousRequest: Boolean = false,
    @Embedded(prefix = "location_") val location: AidLocation? = null,
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
        get() = location?.displayName ?: "Not specified"
}

/**
 * Room entity for aid offers.
 */
@Entity(tableName = "aid_offers")
data class AidOfferEntity(
    @PrimaryKey val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String?,
    val title: String,
    val description: String?,
    val category: AidCategory,
    val status: String, // "active", "claimed", "expired", "withdrawn"
    val offererId: String,
    @Embedded(prefix = "location_") val location: AidLocation? = null,
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
            val nowSeconds = System.currentTimeMillis() / 1000
            availableUntil?.let { if (it < nowSeconds) return false }
            return true
        }

    val locationDisplay: String
        get() = location?.displayName ?: "Not specified"
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
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val requestId: String,
    val fulfillerId: String,
    val status: FulfillmentStatus,
    val quantity: Double?,
    val message: String?,
    val scheduledFor: Long?,
    val completedAt: Long?,
    val rating: Int? = null,
    val feedback: String? = null,
    val createdAt: Long
)

/**
 * Frequency for recurring needs.
 */
enum class RecurringFrequency {
    DAILY,
    WEEKLY,
    BIWEEKLY,
    MONTHLY,
    CUSTOM
}

/**
 * Recurring need schedule (stored as JSON in parent entities).
 */
@Serializable
data class RecurringNeed(
    val frequency: RecurringFrequency,
    val interval: Int? = null,
    val daysOfWeek: List<Int>? = null,
    val endDate: Long? = null,
    val occurrences: Int? = null
)

/**
 * Status of a claim on an offer.
 */
enum class ClaimStatus {
    PENDING,
    APPROVED,
    DECLINED,
    COMPLETED
}

/**
 * A claim on an aid offer (stored as JSON array in AidOfferEntity).
 */
@Serializable
data class OfferClaim(
    val claimerId: String,
    val quantity: Double? = null,
    val message: String? = null,
    val status: ClaimStatus,
    val claimedAt: Long
)

/**
 * Type of rideshare.
 */
enum class RideType {
    OFFER,
    REQUEST
}

/**
 * Status of a rideshare.
 */
enum class RideStatus {
    ACTIVE,
    FULL,
    DEPARTED,
    COMPLETED,
    CANCELLED
}

/**
 * Luggage space capacity.
 */
enum class LuggageSpace {
    NONE,
    SMALL,
    MEDIUM,
    LARGE
}

/**
 * Rideshare preferences (stored as JSON).
 */
@Serializable
data class RidePreferences(
    val smokingAllowed: Boolean? = null,
    val petsAllowed: Boolean? = null,
    val wheelchairAccessible: Boolean? = null,
    val carSeatAvailable: Boolean? = null,
    val luggageSpace: LuggageSpace? = null
)

/**
 * Passenger status in a rideshare.
 */
enum class PassengerStatus {
    REQUESTED,
    CONFIRMED,
    CANCELLED
}

/**
 * Serializable location for JSON storage (used in RidePassenger).
 */
@Serializable
data class SerializableLocation(
    val type: String? = null,
    val address: String? = null,
    val city: String? = null,
    val region: String? = null,
    val postalCode: String? = null,
    @SerialName("lat") val latitude: Double? = null,
    @SerialName("lng") val longitude: Double? = null,
    val radius: Double? = null,
    val privacyLevel: String? = null
) {
    val displayName: String
        get() {
            if (type == "remote") return "Remote"
            if (type == "flexible") return "Flexible"
            return listOfNotNull(city, region).joinToString(", ").ifEmpty { "Not specified" }
        }
}

/**
 * A passenger in a rideshare (stored as JSON array).
 */
@Serializable
data class RidePassenger(
    val passengerId: String,
    val status: PassengerStatus,
    val pickup: SerializableLocation? = null,
    val dropoff: SerializableLocation? = null
)

/**
 * Room entity for rideshares.
 */
@Entity(
    tableName = "rideshares",
    indices = [Index("groupId"), Index("departureTime")]
)
data class RideShareEntity(
    @PrimaryKey val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String,
    val type: RideType,
    val driverId: String?,
    val requesterId: String?,
    @Embedded(prefix = "origin_") val origin: AidLocation? = null,
    @Embedded(prefix = "destination_") val destination: AidLocation? = null,
    val departureTime: Long,
    val flexibility: Int?, // minutes
    val availableSeats: Int?,
    val recurringJson: String? = null, // JSON encoded RecurringNeed
    val preferencesJson: String? = null, // JSON encoded RidePreferences
    val passengersJson: String? = null, // JSON encoded List<RidePassenger>
    val status: RideStatus,
    val notes: String?,
    val createdAt: Long,
    val updatedAt: Long? = null
) {
    val isActive: Boolean
        get() {
            val nowSeconds = System.currentTimeMillis() / 1000
            return status == RideStatus.ACTIVE && departureTime > nowSeconds
        }

    val originDisplay: String
        get() = origin?.displayName ?: "Not specified"

    val destinationDisplay: String
        get() = destination?.displayName ?: "Not specified"
}

/**
 * Room entity for community resource directory entries.
 */
@Entity(
    tableName = "resource_directory",
    indices = [Index("groupId"), Index("category")]
)
data class ResourceDirectoryEntity(
    @PrimaryKey val id: String,
    @SerialName("_v") val schemaVersion: String = "1.0.0",
    val groupId: String,
    val name: String,
    val description: String?,
    val category: AidCategory,
    val contactPhone: String?,
    val contactEmail: String?,
    val contactWebsite: String?,
    @Embedded(prefix = "location_") val location: AidLocation? = null,
    val hours: String?,
    val eligibility: String?,
    val languagesJson: String?, // JSON encoded List<String>
    val verified: Boolean = false,
    val verifiedBy: String?,
    val verifiedAt: Long?,
    val tagsJson: String?, // JSON encoded List<String>
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long? = null
) {
    val locationDisplay: String
        get() = location?.displayName ?: "Not specified"
}

/**
 * Type converters for Room.
 */
class MutualAidConverters {
    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    @TypeConverter
    fun fromAidCategory(value: AidCategory): String = value.name

    @TypeConverter
    fun toAidCategory(value: String): AidCategory = AidCategory.valueOf(value)

    @TypeConverter
    fun fromRequestStatus(value: RequestStatus): String = value.name

    @TypeConverter
    fun toRequestStatus(value: String): RequestStatus = RequestStatus.valueOf(value)

    @TypeConverter
    fun fromUrgencyLevel(value: UrgencyLevel): String = value.name

    @TypeConverter
    fun toUrgencyLevel(value: String): UrgencyLevel = UrgencyLevel.valueOf(value)

    @TypeConverter
    fun fromFulfillmentStatus(value: FulfillmentStatus): String = value.name

    @TypeConverter
    fun toFulfillmentStatus(value: String): FulfillmentStatus = FulfillmentStatus.valueOf(value)

    @TypeConverter
    fun fromRideType(value: RideType): String = value.name

    @TypeConverter
    fun toRideType(value: String): RideType = RideType.valueOf(value)

    @TypeConverter
    fun fromRideStatus(value: RideStatus): String = value.name

    @TypeConverter
    fun toRideStatus(value: String): RideStatus = RideStatus.valueOf(value)

    @TypeConverter
    fun fromLocationType(value: LocationType?): String? = value?.name

    @TypeConverter
    fun toLocationType(value: String?): LocationType? = value?.let { LocationType.valueOf(it) }

    @TypeConverter
    fun fromLocationPrivacyLevel(value: LocationPrivacyLevel?): String? = value?.name

    @TypeConverter
    fun toLocationPrivacyLevel(value: String?): LocationPrivacyLevel? = value?.let { LocationPrivacyLevel.valueOf(it) }
}
