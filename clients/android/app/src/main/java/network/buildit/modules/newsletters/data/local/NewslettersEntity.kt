package network.buildit.modules.newsletters.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Room entity for newsletters.
 * Maps to the Newsletter schema from protocol/schemas/modules/newsletters/v1.json
 */
@Entity(
    tableName = "newsletters",
    indices = [
        Index("ownerPubkey"),
        Index("groupId"),
        Index("createdAt")
    ]
)
data class NewsletterEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val name: String,
    val description: String?,
    val groupId: String?,
    val fromName: String?,
    val replyTo: String?,
    val logo: String?,
    val subscriberCount: Int,
    val visibility: String,
    val doubleOptIn: Boolean,
    val ownerPubkey: String,
    val editorsJson: String?, // JSON array of pubkey strings
    val createdAt: Long
) {
    fun getEditors(): List<String> {
        return editorsJson?.let { Json.decodeFromString<List<String>>(it) } ?: emptyList()
    }

    companion object {
        fun create(
            id: String,
            schemaVersion: String = "1.0.0",
            name: String,
            description: String? = null,
            groupId: String? = null,
            fromName: String? = null,
            replyTo: String? = null,
            logo: String? = null,
            subscriberCount: Int = 0,
            visibility: NewsletterVisibility = NewsletterVisibility.GROUP,
            doubleOptIn: Boolean = true,
            ownerPubkey: String,
            editors: List<String> = emptyList(),
            createdAt: Long = System.currentTimeMillis() / 1000
        ): NewsletterEntity {
            return NewsletterEntity(
                id = id,
                schemaVersion = schemaVersion,
                name = name,
                description = description,
                groupId = groupId,
                fromName = fromName,
                replyTo = replyTo,
                logo = logo,
                subscriberCount = subscriberCount,
                visibility = visibility.value,
                doubleOptIn = doubleOptIn,
                ownerPubkey = ownerPubkey,
                editorsJson = if (editors.isNotEmpty()) Json.encodeToString(editors) else null,
                createdAt = createdAt
            )
        }
    }
}

/**
 * Newsletter visibility options.
 */
enum class NewsletterVisibility(val value: String) {
    PRIVATE("private"),
    GROUP("group"),
    PUBLIC("public");

    companion object {
        fun fromValue(value: String): NewsletterVisibility {
            return entries.find { it.value == value } ?: GROUP
        }
    }
}

/**
 * Room entity for campaigns (newsletter issues).
 */
@Entity(
    tableName = "newsletter_campaigns",
    indices = [
        Index("newsletterId"),
        Index("createdBy"),
        Index("status"),
        Index("scheduledAt")
    ]
)
data class CampaignEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val newsletterId: String,
    val subject: String,
    val preheader: String?,
    val content: String,
    val contentType: String,
    val status: String,
    val scheduledAt: Long?,
    val sentAt: Long?,
    val recipientCount: Int?,
    val openCount: Int,
    val clickCount: Int,
    val segmentsJson: String?, // JSON array of segment strings
    val createdBy: String,
    val createdAt: Long,
    val updatedAt: Long?
) {
    fun getSegments(): List<String> {
        return segmentsJson?.let { Json.decodeFromString<List<String>>(it) } ?: emptyList()
    }

    companion object {
        fun create(
            id: String,
            schemaVersion: String = "1.0.0",
            newsletterId: String,
            subject: String,
            preheader: String? = null,
            content: String,
            contentType: CampaignContentType = CampaignContentType.MARKDOWN,
            status: CampaignStatus = CampaignStatus.DRAFT,
            scheduledAt: Long? = null,
            sentAt: Long? = null,
            recipientCount: Int? = null,
            openCount: Int = 0,
            clickCount: Int = 0,
            segments: List<String> = emptyList(),
            createdBy: String,
            createdAt: Long = System.currentTimeMillis() / 1000,
            updatedAt: Long? = null
        ): CampaignEntity {
            return CampaignEntity(
                id = id,
                schemaVersion = schemaVersion,
                newsletterId = newsletterId,
                subject = subject,
                preheader = preheader,
                content = content,
                contentType = contentType.value,
                status = status.value,
                scheduledAt = scheduledAt,
                sentAt = sentAt,
                recipientCount = recipientCount,
                openCount = openCount,
                clickCount = clickCount,
                segmentsJson = if (segments.isNotEmpty()) Json.encodeToString(segments) else null,
                createdBy = createdBy,
                createdAt = createdAt,
                updatedAt = updatedAt
            )
        }
    }
}

/**
 * Campaign content type.
 */
enum class CampaignContentType(val value: String) {
    HTML("html"),
    MARKDOWN("markdown");

    companion object {
        fun fromValue(value: String): CampaignContentType {
            return entries.find { it.value == value } ?: MARKDOWN
        }
    }
}

/**
 * Campaign status.
 */
enum class CampaignStatus(val value: String) {
    DRAFT("draft"),
    SCHEDULED("scheduled"),
    SENDING("sending"),
    SENT("sent"),
    FAILED("failed");

    companion object {
        fun fromValue(value: String): CampaignStatus {
            return entries.find { it.value == value } ?: DRAFT
        }
    }
}

/**
 * Room entity for subscribers.
 */
@Entity(
    tableName = "newsletter_subscribers",
    indices = [
        Index("newsletterId"),
        Index("pubkey"),
        Index("email"),
        Index("status"),
        Index("subscribedAt")
    ]
)
data class SubscriberEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val newsletterId: String,
    val pubkey: String?,
    val email: String,
    val name: String?,
    val status: String,
    val segmentsJson: String?, // JSON array of segment strings
    val customFieldsJson: String?, // JSON object
    val source: String?,
    val subscribedAt: Long,
    val confirmedAt: Long?,
    val unsubscribedAt: Long?
) {
    fun getSegments(): List<String> {
        return segmentsJson?.let { Json.decodeFromString<List<String>>(it) } ?: emptyList()
    }

    fun getCustomFields(): Map<String, String> {
        return customFieldsJson?.let {
            try {
                Json.decodeFromString<Map<String, String>>(it)
            } catch (e: Exception) {
                emptyMap()
            }
        } ?: emptyMap()
    }

    companion object {
        fun create(
            id: String,
            schemaVersion: String = "1.0.0",
            newsletterId: String,
            pubkey: String? = null,
            email: String,
            name: String? = null,
            status: SubscriberStatus = SubscriberStatus.PENDING,
            segments: List<String> = emptyList(),
            customFields: Map<String, String> = emptyMap(),
            source: String? = null,
            subscribedAt: Long = System.currentTimeMillis() / 1000,
            confirmedAt: Long? = null,
            unsubscribedAt: Long? = null
        ): SubscriberEntity {
            return SubscriberEntity(
                id = id,
                schemaVersion = schemaVersion,
                newsletterId = newsletterId,
                pubkey = pubkey,
                email = email,
                name = name,
                status = status.value,
                segmentsJson = if (segments.isNotEmpty()) Json.encodeToString(segments) else null,
                customFieldsJson = if (customFields.isNotEmpty()) Json.encodeToString(customFields) else null,
                source = source,
                subscribedAt = subscribedAt,
                confirmedAt = confirmedAt,
                unsubscribedAt = unsubscribedAt
            )
        }
    }
}

/**
 * Subscriber status.
 */
enum class SubscriberStatus(val value: String) {
    PENDING("pending"),
    ACTIVE("active"),
    UNSUBSCRIBED("unsubscribed"),
    BOUNCED("bounced"),
    COMPLAINED("complained");

    val displayName: String
        get() = when (this) {
            PENDING -> "Pending"
            ACTIVE -> "Active"
            UNSUBSCRIBED -> "Unsubscribed"
            BOUNCED -> "Bounced"
            COMPLAINED -> "Complained"
        }

    companion object {
        fun fromValue(value: String): SubscriberStatus {
            return entries.find { it.value == value } ?: PENDING
        }
    }
}

/**
 * Room entity for email templates.
 */
@Entity(
    tableName = "newsletter_templates",
    indices = [
        Index("newsletterId"),
        Index("createdBy"),
        Index("createdAt")
    ]
)
data class TemplateEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String,
    val newsletterId: String?,
    val name: String,
    val content: String,
    val contentType: String,
    val thumbnail: String?,
    val createdBy: String,
    val createdAt: Long
) {
    companion object {
        fun create(
            id: String,
            schemaVersion: String = "1.0.0",
            newsletterId: String? = null,
            name: String,
            content: String,
            contentType: CampaignContentType = CampaignContentType.MARKDOWN,
            thumbnail: String? = null,
            createdBy: String,
            createdAt: Long = System.currentTimeMillis() / 1000
        ): TemplateEntity {
            return TemplateEntity(
                id = id,
                schemaVersion = schemaVersion,
                newsletterId = newsletterId,
                name = name,
                content = content,
                contentType = contentType.value,
                thumbnail = thumbnail,
                createdBy = createdBy,
                createdAt = createdAt
            )
        }
    }
}

/**
 * Room entity for tracking delivery progress.
 */
@Entity(
    tableName = "newsletter_delivery_progress",
    indices = [
        Index("campaignId"),
        Index("subscriberId"),
        Index("status")
    ]
)
data class DeliveryProgressEntity(
    @PrimaryKey
    val id: String,
    val campaignId: String,
    val subscriberId: String,
    val subscriberEmail: String,
    val subscriberPubkey: String?,
    val status: String,
    val sentAt: Long?,
    val errorMessage: String?,
    val createdAt: Long
) {
    companion object {
        fun create(
            id: String,
            campaignId: String,
            subscriberId: String,
            subscriberEmail: String,
            subscriberPubkey: String? = null,
            status: DeliveryStatus = DeliveryStatus.PENDING,
            sentAt: Long? = null,
            errorMessage: String? = null,
            createdAt: Long = System.currentTimeMillis() / 1000
        ): DeliveryProgressEntity {
            return DeliveryProgressEntity(
                id = id,
                campaignId = campaignId,
                subscriberId = subscriberId,
                subscriberEmail = subscriberEmail,
                subscriberPubkey = subscriberPubkey,
                status = status.value,
                sentAt = sentAt,
                errorMessage = errorMessage,
                createdAt = createdAt
            )
        }
    }
}

/**
 * Delivery status for individual subscriber.
 */
enum class DeliveryStatus(val value: String) {
    PENDING("pending"),
    SENDING("sending"),
    SENT("sent"),
    FAILED("failed");

    companion object {
        fun fromValue(value: String): DeliveryStatus {
            return entries.find { it.value == value } ?: PENDING
        }
    }
}
