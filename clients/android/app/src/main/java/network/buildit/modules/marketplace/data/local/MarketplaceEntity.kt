package network.buildit.modules.marketplace.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// ============== Enums ==============

/**
 * Type of marketplace listing.
 */
enum class ListingType(val value: String, val displayName: String) {
    PRODUCT("product", "Product"),
    SERVICE("service", "Service"),
    COOP("co-op", "Co-op"),
    INITIATIVE("initiative", "Initiative"),
    RESOURCE("resource", "Resource");

    companion object {
        fun fromValue(value: String): ListingType =
            entries.find { it.value == value } ?: PRODUCT
    }
}

/**
 * Status of a marketplace listing.
 */
enum class ListingStatus(val value: String, val displayName: String) {
    ACTIVE("active", "Active"),
    SOLD("sold", "Sold"),
    EXPIRED("expired", "Expired"),
    REMOVED("removed", "Removed");

    companion object {
        fun fromValue(value: String): ListingStatus =
            entries.find { it.value == value } ?: ACTIVE
    }
}

/**
 * Governance model for co-ops.
 */
enum class GovernanceModel(val value: String, val displayName: String) {
    CONSENSUS("consensus", "Consensus"),
    DEMOCRATIC("democratic", "Democratic"),
    SOCIOCRACY("sociocracy", "Sociocracy"),
    HOLACRACY("holacracy", "Holacracy"),
    HYBRID("hybrid", "Hybrid"),
    OTHER("other", "Other");

    companion object {
        fun fromValue(value: String): GovernanceModel =
            entries.find { it.value == value } ?: CONSENSUS
    }
}

/**
 * Status of a skill exchange.
 */
enum class SkillExchangeStatus(val value: String, val displayName: String) {
    ACTIVE("active", "Active"),
    MATCHED("matched", "Matched"),
    COMPLETED("completed", "Completed"),
    CANCELLED("cancelled", "Cancelled");

    companion object {
        fun fromValue(value: String): SkillExchangeStatus =
            entries.find { it.value == value } ?: ACTIVE
    }
}

/**
 * Type of shared resource.
 */
enum class ResourceShareType(val value: String, val displayName: String) {
    TOOL("tool", "Tool"),
    SPACE("space", "Space"),
    VEHICLE("vehicle", "Vehicle");

    companion object {
        fun fromValue(value: String): ResourceShareType =
            entries.find { it.value == value } ?: TOOL
    }
}

/**
 * Status of a shared resource.
 */
enum class ResourceShareStatus(val value: String, val displayName: String) {
    AVAILABLE("available", "Available"),
    BORROWED("borrowed", "Borrowed"),
    UNAVAILABLE("unavailable", "Unavailable");

    companion object {
        fun fromValue(value: String): ResourceShareStatus =
            entries.find { it.value == value } ?: AVAILABLE
    }
}

// ============== JSON Data Classes ==============

/**
 * Privacy-aware location value.
 */
@Serializable
data class LocationValue(
    val lat: Double,
    val lng: Double,
    val label: String,
    val precision: String = "neighborhood" // exact, neighborhood, city, region
)

// ============== Room Entities ==============

/**
 * Room entity for marketplace listings.
 */
@Entity(
    tableName = "marketplace_listings",
    indices = [
        Index("createdBy"),
        Index("groupId"),
        Index("type"),
        Index("status"),
        Index("createdAt"),
        Index("coopId")
    ]
)
data class ListingEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val type: ListingType,
    val title: String,
    val description: String?,
    val price: Double?,
    val currency: String,
    val imagesJson: String?,
    val locationJson: String?,
    val availability: String?,
    val tagsJson: String?,
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?,
    val expiresAt: Long?,
    val status: ListingStatus,
    val groupId: String?,
    val coopId: String?,
    val contactMethod: String
) {
    /**
     * Gets images from JSON.
     */
    fun getImages(): List<String> {
        return imagesJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Gets location from JSON.
     */
    fun getLocation(): LocationValue? {
        return locationJson?.let {
            try {
                Json.decodeFromString<LocationValue>(it)
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Gets tags from JSON.
     */
    fun getTags(): List<String> {
        return tagsJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Formatted price for display.
     */
    fun formatPrice(): String {
        val p = price ?: return "Free / Negotiable"
        if (p <= 0) return "Free / Negotiable"
        val display = p / 100.0
        return when (currency) {
            "USD" -> "$${String.format("%.2f", display)}"
            "EUR" -> "${String.format("%.2f", display)} EUR"
            "GBP" -> "${String.format("%.2f", display)} GBP"
            "BTC" -> "${String.format("%.8f", display)} BTC"
            "ETH" -> "${String.format("%.6f", display)} ETH"
            else -> "${String.format("%.2f", display)} $currency"
        }
    }

    /**
     * Whether the listing has expired.
     */
    val isExpired: Boolean
        get() {
            val now = System.currentTimeMillis() / 1000
            return (expiresAt != null && expiresAt < now) || status == ListingStatus.EXPIRED
        }

    companion object {
        fun create(
            id: String,
            type: ListingType,
            title: String,
            description: String?,
            price: Double?,
            currency: String = "USD",
            images: List<String> = emptyList(),
            location: LocationValue? = null,
            availability: String? = null,
            tags: List<String> = emptyList(),
            createdBy: String,
            expiresAt: Long? = null,
            groupId: String? = null,
            coopId: String? = null,
            contactMethod: String = "dm"
        ): ListingEntity {
            val now = System.currentTimeMillis() / 1000
            return ListingEntity(
                id = id,
                schemaVersion = "1.0.0",
                type = type,
                title = title,
                description = description,
                price = price,
                currency = currency,
                imagesJson = if (images.isNotEmpty()) Json.encodeToString(images) else null,
                locationJson = location?.let { Json.encodeToString(it) },
                availability = availability,
                tagsJson = if (tags.isNotEmpty()) Json.encodeToString(tags) else null,
                createdBy = createdBy,
                createdAt = now,
                updatedAt = null,
                expiresAt = expiresAt,
                status = ListingStatus.ACTIVE,
                groupId = groupId,
                coopId = coopId,
                contactMethod = contactMethod
            )
        }
    }
}

/**
 * Room entity for co-op profiles.
 */
@Entity(
    tableName = "coop_profiles",
    indices = [
        Index("nostrPubkey"),
        Index("groupId"),
        Index("governanceModel"),
        Index("createdAt")
    ]
)
data class CoopProfileEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val name: String,
    val description: String?,
    val memberCount: Int,
    val governanceModel: GovernanceModel,
    val industry: String,
    val locationJson: String?,
    val website: String?,
    val nostrPubkey: String,
    val verifiedByJson: String?,
    val image: String?,
    val createdAt: Long,
    val updatedAt: Long?,
    val groupId: String?
) {
    /**
     * Gets location from JSON.
     */
    fun getLocation(): LocationValue? {
        return locationJson?.let {
            try {
                Json.decodeFromString<LocationValue>(it)
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Gets verified-by list from JSON.
     */
    fun getVerifiedBy(): List<String> {
        return verifiedByJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Number of vouchers.
     */
    val vouchCount: Int
        get() = getVerifiedBy().size

    companion object {
        fun create(
            id: String,
            name: String,
            description: String?,
            memberCount: Int = 1,
            governanceModel: GovernanceModel = GovernanceModel.CONSENSUS,
            industry: String = "",
            location: LocationValue? = null,
            website: String? = null,
            nostrPubkey: String,
            verifiedBy: List<String> = emptyList(),
            image: String? = null,
            groupId: String? = null
        ): CoopProfileEntity {
            val now = System.currentTimeMillis() / 1000
            return CoopProfileEntity(
                id = id,
                schemaVersion = "1.0.0",
                name = name,
                description = description,
                memberCount = memberCount,
                governanceModel = governanceModel,
                industry = industry,
                locationJson = location?.let { Json.encodeToString(it) },
                website = website,
                nostrPubkey = nostrPubkey,
                verifiedByJson = if (verifiedBy.isNotEmpty()) Json.encodeToString(verifiedBy) else null,
                image = image,
                createdAt = now,
                updatedAt = null,
                groupId = groupId
            )
        }
    }
}

/**
 * Room entity for marketplace reviews.
 */
@Entity(
    tableName = "marketplace_reviews",
    indices = [
        Index("listingId"),
        Index("reviewerPubkey"),
        Index("createdAt")
    ]
)
data class ReviewEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val listingId: String,
    val reviewerPubkey: String,
    val rating: Int,
    val text: String,
    val createdAt: Long
) {
    companion object {
        fun create(
            id: String,
            listingId: String,
            reviewerPubkey: String,
            rating: Int,
            text: String
        ): ReviewEntity {
            val now = System.currentTimeMillis() / 1000
            return ReviewEntity(
                id = id,
                schemaVersion = "1.0.0",
                listingId = listingId,
                reviewerPubkey = reviewerPubkey,
                rating = rating.coerceIn(1, 5),
                text = text,
                createdAt = now
            )
        }
    }
}

/**
 * Room entity for skill exchanges.
 */
@Entity(
    tableName = "skill_exchanges",
    indices = [
        Index("createdBy"),
        Index("groupId"),
        Index("status"),
        Index("createdAt")
    ]
)
data class SkillExchangeEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val offeredSkill: String,
    val requestedSkill: String,
    val availableHours: Double,
    val hourlyTimebank: Double,
    val locationJson: String?,
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?,
    val status: SkillExchangeStatus,
    val groupId: String?
) {
    /**
     * Gets location from JSON.
     */
    fun getLocation(): LocationValue? {
        return locationJson?.let {
            try {
                Json.decodeFromString<LocationValue>(it)
            } catch (e: Exception) {
                null
            }
        }
    }

    companion object {
        fun create(
            id: String,
            offeredSkill: String,
            requestedSkill: String,
            availableHours: Double = 0.0,
            hourlyTimebank: Double = 0.0,
            location: LocationValue? = null,
            createdBy: String,
            groupId: String? = null
        ): SkillExchangeEntity {
            val now = System.currentTimeMillis() / 1000
            return SkillExchangeEntity(
                id = id,
                schemaVersion = "1.0.0",
                offeredSkill = offeredSkill,
                requestedSkill = requestedSkill,
                availableHours = availableHours,
                hourlyTimebank = hourlyTimebank,
                locationJson = location?.let { Json.encodeToString(it) },
                createdBy = createdBy,
                createdAt = now,
                updatedAt = null,
                status = SkillExchangeStatus.ACTIVE,
                groupId = groupId
            )
        }
    }
}

/**
 * Room entity for shared resources.
 */
@Entity(
    tableName = "resource_shares",
    indices = [
        Index("createdBy"),
        Index("groupId"),
        Index("resourceType"),
        Index("status"),
        Index("createdAt")
    ]
)
data class ResourceShareEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val resourceType: ResourceShareType,
    val name: String,
    val description: String?,
    val imagesJson: String?,
    val locationJson: String?,
    val depositRequired: Boolean,
    val depositAmount: Double?,
    val depositCurrency: String?,
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?,
    val status: ResourceShareStatus,
    val groupId: String?
) {
    /**
     * Gets images from JSON.
     */
    fun getImages(): List<String> {
        return imagesJson?.let {
            try {
                Json.decodeFromString<List<String>>(it)
            } catch (e: Exception) {
                emptyList()
            }
        } ?: emptyList()
    }

    /**
     * Gets location from JSON.
     */
    fun getLocation(): LocationValue? {
        return locationJson?.let {
            try {
                Json.decodeFromString<LocationValue>(it)
            } catch (e: Exception) {
                null
            }
        }
    }

    companion object {
        fun create(
            id: String,
            resourceType: ResourceShareType,
            name: String,
            description: String? = null,
            images: List<String> = emptyList(),
            location: LocationValue? = null,
            depositRequired: Boolean = false,
            depositAmount: Double? = null,
            depositCurrency: String? = null,
            createdBy: String,
            groupId: String? = null
        ): ResourceShareEntity {
            val now = System.currentTimeMillis() / 1000
            return ResourceShareEntity(
                id = id,
                schemaVersion = "1.0.0",
                resourceType = resourceType,
                name = name,
                description = description,
                imagesJson = if (images.isNotEmpty()) Json.encodeToString(images) else null,
                locationJson = location?.let { Json.encodeToString(it) },
                depositRequired = depositRequired,
                depositAmount = depositAmount,
                depositCurrency = depositCurrency,
                createdBy = createdBy,
                createdAt = now,
                updatedAt = null,
                status = ResourceShareStatus.AVAILABLE,
                groupId = groupId
            )
        }
    }
}
