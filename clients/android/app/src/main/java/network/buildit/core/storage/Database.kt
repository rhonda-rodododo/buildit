package network.buildit.core.storage

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.Update
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow
import net.sqlcipher.database.SupportFactory
import java.security.SecureRandom
import java.util.Arrays
import javax.inject.Singleton

/**
 * Main Room database for BuildIt.
 *
 * Stores:
 * - Contacts and their metadata
 * - Conversations/threads
 * - Messages (encrypted at rest)
 * - Group memberships
 * - Device sync state
 */
@Database(
    entities = [
        ContactEntity::class,
        ConversationEntity::class,
        MessageEntity::class,
        GroupEntity::class,
        GroupMemberEntity::class,
        LinkedDeviceEntity::class,
        ReactionEntity::class,
        AttachmentEntity::class,
        network.buildit.modules.events.data.local.EventEntity::class,
        network.buildit.modules.events.data.local.RsvpEntity::class,
        network.buildit.modules.messaging.data.local.MessagingMetadataEntity::class,
        network.buildit.modules.messaging.data.local.ReadReceiptEntity::class,
        network.buildit.modules.messaging.data.local.MessageReactionEntity::class,
        network.buildit.modules.mutualaid.data.local.AidRequestEntity::class,
        network.buildit.modules.mutualaid.data.local.AidOfferEntity::class,
        network.buildit.modules.mutualaid.data.local.FulfillmentEntity::class,
        network.buildit.modules.governance.data.local.ProposalEntity::class,
        network.buildit.modules.governance.data.local.VoteEntity::class,
        network.buildit.modules.governance.data.local.DelegationEntity::class,
        network.buildit.modules.governance.data.local.ProposalResultEntity::class,
        network.buildit.modules.wiki.data.local.WikiPageEntity::class,
        network.buildit.modules.wiki.data.local.WikiCategoryEntity::class,
        network.buildit.modules.wiki.data.local.PageRevisionEntity::class,
        network.buildit.modules.contacts.data.local.ContactNoteEntity::class,
        network.buildit.modules.contacts.data.local.ContactTagEntity::class,
        network.buildit.modules.contacts.data.local.ContactTagAssignmentEntity::class,
        network.buildit.modules.fundraising.data.local.CampaignEntity::class,
        network.buildit.modules.fundraising.data.local.DonationEntity::class,
        network.buildit.modules.fundraising.data.local.ExpenseEntity::class,
        network.buildit.core.sync.QueuedOperationEntity::class,
        network.buildit.modules.newsletters.data.local.NewsletterEntity::class,
        network.buildit.modules.newsletters.data.local.CampaignEntity::class,
        network.buildit.modules.newsletters.data.local.SubscriberEntity::class,
        network.buildit.modules.newsletters.data.local.TemplateEntity::class,
        network.buildit.modules.newsletters.data.local.DeliveryProgressEntity::class,
        network.buildit.modules.publishing.data.local.ArticleEntity::class,
        network.buildit.modules.publishing.data.local.CommentEntity::class,
        network.buildit.modules.publishing.data.local.PublicationEntity::class,
        network.buildit.modules.publishing.data.local.SubscriberEntity::class,
        network.buildit.modules.forms.data.local.FormEntity::class,
        network.buildit.modules.forms.data.local.FormResponseEntity::class,
        network.buildit.modules.calling.data.local.CallHistoryEntity::class,
        network.buildit.modules.calling.data.local.CallSettingsEntity::class,
        network.buildit.modules.training.data.local.CourseEntity::class,
        network.buildit.modules.training.data.local.ModuleEntity::class,
        network.buildit.modules.training.data.local.LessonEntity::class,
        network.buildit.modules.training.data.local.LessonProgressEntity::class,
        network.buildit.modules.training.data.local.CourseProgressEntity::class,
        network.buildit.modules.training.data.local.QuizAttemptEntity::class,
        network.buildit.modules.training.data.local.AssignmentSubmissionEntity::class,
        network.buildit.modules.training.data.local.CertificationEntity::class,
        network.buildit.modules.training.data.local.LiveSessionRSVPEntity::class,
        network.buildit.modules.training.data.local.LiveSessionAttendanceEntity::class,
        network.buildit.modules.tasks.data.local.TaskEntity::class,
        network.buildit.modules.files.data.local.FileEntity::class,
        network.buildit.modules.polls.data.local.PollEntity::class,
        network.buildit.modules.polls.data.local.PollVoteEntity::class,
        network.buildit.modules.marketplace.data.local.ListingEntity::class,
        network.buildit.modules.marketplace.data.local.CoopProfileEntity::class,
        network.buildit.modules.marketplace.data.local.ReviewEntity::class,
        network.buildit.modules.marketplace.data.local.SkillExchangeEntity::class,
        network.buildit.modules.marketplace.data.local.ResourceShareEntity::class
    ],
    version = 18,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class BuildItDatabase : RoomDatabase() {
    abstract fun contactDao(): ContactDao
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
    abstract fun groupDao(): GroupDao
    abstract fun linkedDeviceDao(): LinkedDeviceDao
    abstract fun reactionDao(): ReactionDao
    abstract fun attachmentDao(): AttachmentDao
    abstract fun eventsDao(): network.buildit.modules.events.data.local.EventsDao
    abstract fun rsvpsDao(): network.buildit.modules.events.data.local.RsvpsDao
    abstract fun messagingMetadataDao(): network.buildit.modules.messaging.data.local.MessagingMetadataDao
    abstract fun messagingReadReceiptDao(): network.buildit.modules.messaging.data.local.MessagingReadReceiptDao
    abstract fun messagingReactionDao(): network.buildit.modules.messaging.data.local.MessagingReactionDao
    abstract fun aidRequestsDao(): network.buildit.modules.mutualaid.data.local.AidRequestsDao
    abstract fun aidOffersDao(): network.buildit.modules.mutualaid.data.local.AidOffersDao
    abstract fun fulfillmentsDao(): network.buildit.modules.mutualaid.data.local.FulfillmentsDao
    abstract fun proposalsDao(): network.buildit.modules.governance.data.local.ProposalsDao
    abstract fun votesDao(): network.buildit.modules.governance.data.local.VotesDao
    abstract fun delegationsDao(): network.buildit.modules.governance.data.local.DelegationsDao
    abstract fun proposalResultsDao(): network.buildit.modules.governance.data.local.ProposalResultsDao
    abstract fun wikiPagesDao(): network.buildit.modules.wiki.data.local.WikiPagesDao
    abstract fun wikiCategoriesDao(): network.buildit.modules.wiki.data.local.WikiCategoriesDao
    abstract fun pageRevisionsDao(): network.buildit.modules.wiki.data.local.PageRevisionsDao
    abstract fun contactNotesDao(): network.buildit.modules.contacts.data.local.ContactNotesDao
    abstract fun contactTagsDao(): network.buildit.modules.contacts.data.local.ContactTagsDao
    abstract fun contactTagAssignmentsDao(): network.buildit.modules.contacts.data.local.ContactTagAssignmentsDao
    abstract fun campaignsDao(): network.buildit.modules.fundraising.data.local.CampaignsDao
    abstract fun donationsDao(): network.buildit.modules.fundraising.data.local.DonationsDao
    abstract fun expensesDao(): network.buildit.modules.fundraising.data.local.ExpensesDao
    abstract fun offlineQueueDao(): network.buildit.core.sync.OfflineQueueDao
    abstract fun newslettersDao(): network.buildit.modules.newsletters.data.local.NewslettersDao
    abstract fun newsletterCampaignsDao(): network.buildit.modules.newsletters.data.local.CampaignsDao
    abstract fun newsletterSubscribersDao(): network.buildit.modules.newsletters.data.local.SubscribersDao
    abstract fun templatesDao(): network.buildit.modules.newsletters.data.local.TemplatesDao
    abstract fun deliveryProgressDao(): network.buildit.modules.newsletters.data.local.DeliveryProgressDao

    // Publishing DAOs
    abstract fun articlesDao(): network.buildit.modules.publishing.data.local.ArticlesDao
    abstract fun commentsDao(): network.buildit.modules.publishing.data.local.CommentsDao
    abstract fun publicationsDao(): network.buildit.modules.publishing.data.local.PublicationsDao
    abstract fun subscribersDao(): network.buildit.modules.publishing.data.local.SubscribersDao

    // Forms DAOs
    abstract fun formsDao(): network.buildit.modules.forms.data.local.FormsDao
    abstract fun formResponsesDao(): network.buildit.modules.forms.data.local.FormResponsesDao

    // Calling DAOs
    abstract fun callHistoryDao(): network.buildit.modules.calling.data.local.CallHistoryDao
    abstract fun callSettingsDao(): network.buildit.modules.calling.data.local.CallSettingsDao

    // Training DAOs
    abstract fun trainingCourseDao(): network.buildit.modules.training.data.local.TrainingCourseDao
    abstract fun trainingModuleDao(): network.buildit.modules.training.data.local.TrainingModuleDao
    abstract fun trainingLessonDao(): network.buildit.modules.training.data.local.TrainingLessonDao
    abstract fun trainingProgressDao(): network.buildit.modules.training.data.local.TrainingProgressDao
    abstract fun trainingQuizDao(): network.buildit.modules.training.data.local.TrainingQuizDao
    abstract fun trainingAssignmentDao(): network.buildit.modules.training.data.local.TrainingAssignmentDao
    abstract fun trainingCertificationDao(): network.buildit.modules.training.data.local.TrainingCertificationDao
    abstract fun trainingLiveSessionDao(): network.buildit.modules.training.data.local.TrainingLiveSessionDao

    // Tasks DAOs
    abstract fun taskDao(): network.buildit.modules.tasks.data.local.TaskDao

    // Files DAOs
    abstract fun fileDao(): network.buildit.modules.files.data.local.FileDao

    // Polls DAOs
    abstract fun pollDao(): network.buildit.modules.polls.data.local.PollDao
    abstract fun pollVoteDao(): network.buildit.modules.polls.data.local.PollVoteDao

    // Marketplace DAOs
    abstract fun listingsDao(): network.buildit.modules.marketplace.data.local.ListingsDao
    abstract fun coopProfilesDao(): network.buildit.modules.marketplace.data.local.CoopProfilesDao
    abstract fun reviewsDao(): network.buildit.modules.marketplace.data.local.ReviewsDao
    abstract fun skillExchangesDao(): network.buildit.modules.marketplace.data.local.SkillExchangesDao
    abstract fun resourceSharesDao(): network.buildit.modules.marketplace.data.local.ResourceSharesDao
}

/**
 * Type alias for the WikiModule's AppDatabase reference.
 */
typealias AppDatabase = BuildItDatabase

// ============== Entities ==============

/**
 * Represents a contact in the database.
 */
@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey
    val pubkey: String,
    val displayName: String?,
    val avatarUrl: String?,
    val nip05: String?,
    val about: String?,
    val isBlocked: Boolean = false,
    val isTrusted: Boolean = false,
    val lastSeenAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * Represents a conversation thread.
 */
@Entity(
    tableName = "conversations",
    indices = [Index("lastMessageAt")]
)
data class ConversationEntity(
    @PrimaryKey
    val id: String,
    val type: ConversationType,
    val participantPubkeys: String, // JSON array of pubkeys
    val groupId: String? = null,
    val title: String? = null,
    val lastMessageId: String? = null,
    val lastMessageAt: Long? = null,
    val unreadCount: Int = 0,
    val isPinned: Boolean = false,
    val isMuted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

enum class ConversationType {
    DIRECT,
    GROUP
}

/**
 * Represents a message.
 */
@Entity(
    tableName = "messages",
    foreignKeys = [
        ForeignKey(
            entity = ConversationEntity::class,
            parentColumns = ["id"],
            childColumns = ["conversationId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("conversationId"),
        Index("senderPubkey"),
        Index("timestamp")
    ]
)
data class MessageEntity(
    @PrimaryKey
    val id: String,
    val conversationId: String,
    val senderPubkey: String,
    val content: String, // Encrypted content
    val contentType: MessageContentType = MessageContentType.TEXT,
    val replyToId: String? = null,
    val status: MessageStatus = MessageStatus.PENDING,
    val timestamp: Long,
    val receivedAt: Long = System.currentTimeMillis(),
    val readAt: Long? = null
)

enum class MessageContentType {
    TEXT,
    IMAGE,
    FILE,
    VOICE,
    LOCATION
}

enum class MessageStatus {
    PENDING,
    SENT,
    DELIVERED,
    READ,
    FAILED
}

/**
 * Represents a group.
 */
@Entity(tableName = "groups")
data class GroupEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val description: String? = null,
    val avatarUrl: String? = null,
    val ownerPubkey: String,
    val isPublic: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * Represents a group membership.
 */
@Entity(
    tableName = "group_members",
    primaryKeys = ["groupId", "pubkey"],
    foreignKeys = [
        ForeignKey(
            entity = GroupEntity::class,
            parentColumns = ["id"],
            childColumns = ["groupId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class GroupMemberEntity(
    val groupId: String,
    val pubkey: String,
    val role: GroupRole = GroupRole.MEMBER,
    val joinedAt: Long = System.currentTimeMillis()
)

enum class GroupRole {
    OWNER,
    ADMIN,
    MEMBER
}

/**
 * Represents a linked device for multi-device sync.
 */
@Entity(tableName = "linked_devices")
data class LinkedDeviceEntity(
    @PrimaryKey
    val deviceId: String,
    val name: String,
    val deviceType: DeviceType,
    val publicKey: String,
    val lastSyncAt: Long? = null,
    val linkedAt: Long = System.currentTimeMillis()
)

enum class DeviceType {
    ANDROID,
    IOS,
    DESKTOP,
    WEB
}

/**
 * Represents a reaction to a message (NIP-25).
 */
@Entity(
    tableName = "reactions",
    foreignKeys = [
        ForeignKey(
            entity = MessageEntity::class,
            parentColumns = ["id"],
            childColumns = ["messageId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("messageId")]
)
data class ReactionEntity(
    @PrimaryKey
    val id: String,
    val messageId: String,
    val emoji: String,
    val reactorPubkey: String,
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Represents a media attachment to a message.
 */
@Entity(
    tableName = "attachments",
    foreignKeys = [
        ForeignKey(
            entity = MessageEntity::class,
            parentColumns = ["id"],
            childColumns = ["messageId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("messageId")]
)
data class AttachmentEntity(
    @PrimaryKey
    val id: String,
    val messageId: String,
    val type: AttachmentType,
    val url: String,
    val localPath: String? = null,
    val mimeType: String,
    val fileName: String? = null,
    val fileSize: Long? = null,
    val width: Int? = null,
    val height: Int? = null,
    val blurhash: String? = null,
    val uploadStatus: UploadStatus = UploadStatus.PENDING,
    val createdAt: Long = System.currentTimeMillis()
)

enum class AttachmentType {
    IMAGE,
    VIDEO,
    AUDIO,
    FILE
}

enum class UploadStatus {
    PENDING,
    UPLOADING,
    COMPLETED,
    FAILED
}

// ============== Type Converters ==============

class Converters {
    @TypeConverter
    fun fromConversationType(value: ConversationType): String = value.name

    @TypeConverter
    fun toConversationType(value: String): ConversationType = ConversationType.valueOf(value)

    @TypeConverter
    fun fromMessageContentType(value: MessageContentType): String = value.name

    @TypeConverter
    fun toMessageContentType(value: String): MessageContentType = MessageContentType.valueOf(value)

    @TypeConverter
    fun fromMessageStatus(value: MessageStatus): String = value.name

    @TypeConverter
    fun toMessageStatus(value: String): MessageStatus = MessageStatus.valueOf(value)

    @TypeConverter
    fun fromGroupRole(value: GroupRole): String = value.name

    @TypeConverter
    fun toGroupRole(value: String): GroupRole = GroupRole.valueOf(value)

    @TypeConverter
    fun fromDeviceType(value: DeviceType): String = value.name

    @TypeConverter
    fun toDeviceType(value: String): DeviceType = DeviceType.valueOf(value)

    @TypeConverter
    fun fromAttachmentType(value: AttachmentType): String = value.name

    @TypeConverter
    fun toAttachmentType(value: String): AttachmentType = AttachmentType.valueOf(value)

    @TypeConverter
    fun fromUploadStatus(value: UploadStatus): String = value.name

    @TypeConverter
    fun toUploadStatus(value: String): UploadStatus = UploadStatus.valueOf(value)

    // Mutual Aid converters
    @TypeConverter
    fun fromAidCategory(value: network.buildit.modules.mutualaid.data.local.AidCategory): String = value.name

    @TypeConverter
    fun toAidCategory(value: String): network.buildit.modules.mutualaid.data.local.AidCategory =
        network.buildit.modules.mutualaid.data.local.AidCategory.valueOf(value)

    @TypeConverter
    fun fromLocationType(value: network.buildit.modules.mutualaid.data.local.LocationType?): String? = value?.name

    @TypeConverter
    fun toLocationType(value: String?): network.buildit.modules.mutualaid.data.local.LocationType? =
        value?.let { network.buildit.modules.mutualaid.data.local.LocationType.valueOf(it) }

    @TypeConverter
    fun fromLocationPrivacyLevel(value: network.buildit.modules.mutualaid.data.local.LocationPrivacyLevel?): String? = value?.name

    @TypeConverter
    fun toLocationPrivacyLevel(value: String?): network.buildit.modules.mutualaid.data.local.LocationPrivacyLevel? =
        value?.let { network.buildit.modules.mutualaid.data.local.LocationPrivacyLevel.valueOf(it) }

    @TypeConverter
    fun fromRequestStatus(value: network.buildit.modules.mutualaid.data.local.RequestStatus): String = value.name

    @TypeConverter
    fun toRequestStatus(value: String): network.buildit.modules.mutualaid.data.local.RequestStatus =
        network.buildit.modules.mutualaid.data.local.RequestStatus.valueOf(value)

    @TypeConverter
    fun fromUrgencyLevel(value: network.buildit.modules.mutualaid.data.local.UrgencyLevel): String = value.name

    @TypeConverter
    fun toUrgencyLevel(value: String): network.buildit.modules.mutualaid.data.local.UrgencyLevel =
        network.buildit.modules.mutualaid.data.local.UrgencyLevel.valueOf(value)

    @TypeConverter
    fun fromFulfillmentStatus(value: network.buildit.modules.mutualaid.data.local.FulfillmentStatus): String = value.name

    @TypeConverter
    fun toFulfillmentStatus(value: String): network.buildit.modules.mutualaid.data.local.FulfillmentStatus =
        network.buildit.modules.mutualaid.data.local.FulfillmentStatus.valueOf(value)

    // Governance converters
    @TypeConverter
    fun fromProposalType(value: network.buildit.modules.governance.data.local.ProposalType): String = value.name

    @TypeConverter
    fun toProposalType(value: String): network.buildit.modules.governance.data.local.ProposalType =
        network.buildit.modules.governance.data.local.ProposalType.valueOf(value)

    @TypeConverter
    fun fromProposalStatus(value: network.buildit.modules.governance.data.local.ProposalStatus): String = value.name

    @TypeConverter
    fun toProposalStatus(value: String): network.buildit.modules.governance.data.local.ProposalStatus =
        network.buildit.modules.governance.data.local.ProposalStatus.valueOf(value)

    @TypeConverter
    fun fromVotingSystem(value: network.buildit.modules.governance.data.local.VotingSystem): String = value.name

    @TypeConverter
    fun toVotingSystem(value: String): network.buildit.modules.governance.data.local.VotingSystem =
        network.buildit.modules.governance.data.local.VotingSystem.valueOf(value)

    @TypeConverter
    fun fromQuorumType(value: network.buildit.modules.governance.data.local.QuorumType?): String? = value?.name

    @TypeConverter
    fun toQuorumType(value: String?): network.buildit.modules.governance.data.local.QuorumType? =
        value?.let { network.buildit.modules.governance.data.local.QuorumType.valueOf(it) }

    @TypeConverter
    fun fromThresholdType(value: network.buildit.modules.governance.data.local.ThresholdType?): String? = value?.name

    @TypeConverter
    fun toThresholdType(value: String?): network.buildit.modules.governance.data.local.ThresholdType? =
        value?.let { network.buildit.modules.governance.data.local.ThresholdType.valueOf(it) }

    @TypeConverter
    fun fromDelegationScope(value: network.buildit.modules.governance.data.local.DelegationScope): String = value.name

    @TypeConverter
    fun toDelegationScope(value: String): network.buildit.modules.governance.data.local.DelegationScope =
        network.buildit.modules.governance.data.local.DelegationScope.valueOf(value)

    @TypeConverter
    fun fromProposalOutcome(value: network.buildit.modules.governance.data.local.ProposalOutcome): String = value.name

    @TypeConverter
    fun toProposalOutcome(value: String): network.buildit.modules.governance.data.local.ProposalOutcome =
        network.buildit.modules.governance.data.local.ProposalOutcome.valueOf(value)

    // Wiki converters
    @TypeConverter
    fun fromPageStatus(value: network.buildit.modules.wiki.data.local.PageStatus): String = value.name

    @TypeConverter
    fun toPageStatus(value: String): network.buildit.modules.wiki.data.local.PageStatus =
        network.buildit.modules.wiki.data.local.PageStatus.valueOf(value)

    @TypeConverter
    fun fromPageVisibility(value: network.buildit.modules.wiki.data.local.PageVisibility): String = value.name

    @TypeConverter
    fun toPageVisibility(value: String): network.buildit.modules.wiki.data.local.PageVisibility =
        network.buildit.modules.wiki.data.local.PageVisibility.valueOf(value)

    @TypeConverter
    fun fromEditType(value: network.buildit.modules.wiki.data.local.EditType): String = value.name

    @TypeConverter
    fun toEditType(value: String): network.buildit.modules.wiki.data.local.EditType =
        network.buildit.modules.wiki.data.local.EditType.valueOf(value)

    // Contact Notes converters
    @TypeConverter
    fun fromNoteCategory(value: network.buildit.generated.schemas.contacts.NoteCategory): String = value.name

    @TypeConverter
    fun toNoteCategory(value: String): network.buildit.generated.schemas.contacts.NoteCategory =
        network.buildit.generated.schemas.contacts.NoteCategory.valueOf(value)

    // Fundraising converters
    @TypeConverter
    fun fromCampaignStatus(value: network.buildit.modules.fundraising.data.local.CampaignStatus): String = value.name

    @TypeConverter
    fun toCampaignStatus(value: String): network.buildit.modules.fundraising.data.local.CampaignStatus =
        network.buildit.modules.fundraising.data.local.CampaignStatus.valueOf(value)

    @TypeConverter
    fun fromCampaignVisibility(value: network.buildit.modules.fundraising.data.local.CampaignVisibility): String = value.name

    @TypeConverter
    fun toCampaignVisibility(value: String): network.buildit.modules.fundraising.data.local.CampaignVisibility =
        network.buildit.modules.fundraising.data.local.CampaignVisibility.valueOf(value)

    @TypeConverter
    fun fromPaymentMethod(value: network.buildit.modules.fundraising.data.local.PaymentMethod): String = value.name

    @TypeConverter
    fun toPaymentMethod(value: String): network.buildit.modules.fundraising.data.local.PaymentMethod =
        network.buildit.modules.fundraising.data.local.PaymentMethod.valueOf(value)

    @TypeConverter
    fun fromDonationStatus(value: network.buildit.modules.fundraising.data.local.DonationStatus): String = value.name

    @TypeConverter
    fun toDonationStatus(value: String): network.buildit.modules.fundraising.data.local.DonationStatus =
        network.buildit.modules.fundraising.data.local.DonationStatus.valueOf(value)

    // Sync converters
    @TypeConverter
    fun fromOperationType(value: network.buildit.core.sync.OperationType): String = value.name

    @TypeConverter
    fun toOperationType(value: String): network.buildit.core.sync.OperationType =
        network.buildit.core.sync.OperationType.valueOf(value)

    @TypeConverter
    fun fromOperationStatus(value: network.buildit.core.sync.OperationStatus): String = value.name

    @TypeConverter
    fun toOperationStatus(value: String): network.buildit.core.sync.OperationStatus =
        network.buildit.core.sync.OperationStatus.valueOf(value)

    // Publishing converters
    @TypeConverter
    fun fromArticleStatus(value: network.buildit.modules.publishing.data.local.ArticleStatus): String = value.name

    @TypeConverter
    fun toArticleStatus(value: String): network.buildit.modules.publishing.data.local.ArticleStatus =
        network.buildit.modules.publishing.data.local.ArticleStatus.valueOf(value)

    @TypeConverter
    fun fromPublishingVisibility(value: network.buildit.modules.publishing.data.local.PublishingVisibility): String = value.name

    @TypeConverter
    fun toPublishingVisibility(value: String): network.buildit.modules.publishing.data.local.PublishingVisibility =
        network.buildit.modules.publishing.data.local.PublishingVisibility.valueOf(value)

    // Newsletter converters
    @TypeConverter
    fun fromNewsletterVisibility(value: network.buildit.modules.newsletters.data.local.NewsletterVisibility): String = value.value

    @TypeConverter
    fun toNewsletterVisibility(value: String): network.buildit.modules.newsletters.data.local.NewsletterVisibility =
        network.buildit.modules.newsletters.data.local.NewsletterVisibility.fromValue(value)

    @TypeConverter
    fun fromNewsletterCampaignStatus(value: network.buildit.modules.newsletters.data.local.CampaignStatus): String = value.value

    @TypeConverter
    fun toNewsletterCampaignStatus(value: String): network.buildit.modules.newsletters.data.local.CampaignStatus =
        network.buildit.modules.newsletters.data.local.CampaignStatus.fromValue(value)

    @TypeConverter
    fun fromNewsletterCampaignContentType(value: network.buildit.modules.newsletters.data.local.CampaignContentType): String = value.value

    @TypeConverter
    fun toNewsletterCampaignContentType(value: String): network.buildit.modules.newsletters.data.local.CampaignContentType =
        network.buildit.modules.newsletters.data.local.CampaignContentType.fromValue(value)

    @TypeConverter
    fun fromSubscriberStatus(value: network.buildit.modules.newsletters.data.local.SubscriberStatus): String = value.value

    @TypeConverter
    fun toSubscriberStatus(value: String): network.buildit.modules.newsletters.data.local.SubscriberStatus =
        network.buildit.modules.newsletters.data.local.SubscriberStatus.fromValue(value)

    @TypeConverter
    fun fromDeliveryStatus(value: network.buildit.modules.newsletters.data.local.DeliveryStatus): String = value.value

    @TypeConverter
    fun toDeliveryStatus(value: String): network.buildit.modules.newsletters.data.local.DeliveryStatus =
        network.buildit.modules.newsletters.data.local.DeliveryStatus.fromValue(value)

    // Forms converters
    @TypeConverter
    fun fromFormFieldType(value: network.buildit.modules.forms.data.local.FormFieldType): String = value.name

    @TypeConverter
    fun toFormFieldType(value: String): network.buildit.modules.forms.data.local.FormFieldType =
        network.buildit.modules.forms.data.local.FormFieldType.valueOf(value)

    @TypeConverter
    fun fromFormVisibility(value: network.buildit.modules.forms.data.local.FormVisibility): String = value.name

    @TypeConverter
    fun toFormVisibility(value: String): network.buildit.modules.forms.data.local.FormVisibility =
        network.buildit.modules.forms.data.local.FormVisibility.valueOf(value)

    @TypeConverter
    fun fromFormStatus(value: network.buildit.modules.forms.data.local.FormStatus): String = value.name

    @TypeConverter
    fun toFormStatus(value: String): network.buildit.modules.forms.data.local.FormStatus =
        network.buildit.modules.forms.data.local.FormStatus.valueOf(value)

    // Tasks converters
    @TypeConverter
    fun fromTaskPriority(value: network.buildit.modules.tasks.data.local.TaskPriority): String = value.name

    @TypeConverter
    fun toTaskPriority(value: String): network.buildit.modules.tasks.data.local.TaskPriority =
        network.buildit.modules.tasks.data.local.TaskPriority.valueOf(value)

    @TypeConverter
    fun fromTaskStatus(value: network.buildit.modules.tasks.data.local.TaskStatus): String = value.name

    @TypeConverter
    fun toTaskStatus(value: String): network.buildit.modules.tasks.data.local.TaskStatus =
        network.buildit.modules.tasks.data.local.TaskStatus.valueOf(value)

    // Files converters
    @TypeConverter
    fun fromFileEntryType(value: network.buildit.modules.files.data.local.FileEntryType): String = value.name

    @TypeConverter
    fun toFileEntryType(value: String): network.buildit.modules.files.data.local.FileEntryType =
        network.buildit.modules.files.data.local.FileEntryType.valueOf(value)

    // Polls converters
    @TypeConverter
    fun fromPollType(value: network.buildit.generated.schemas.polls.PollType): String = value.name

    @TypeConverter
    fun toPollType(value: String): network.buildit.generated.schemas.polls.PollType =
        network.buildit.generated.schemas.polls.PollType.valueOf(value)

    @TypeConverter
    fun fromPollStatus(value: network.buildit.generated.schemas.polls.PollStatus): String = value.name

    @TypeConverter
    fun toPollStatus(value: String): network.buildit.generated.schemas.polls.PollStatus =
        network.buildit.generated.schemas.polls.PollStatus.valueOf(value)
}

// ============== DAOs ==============

@Dao
interface ContactDao {
    @Query("SELECT * FROM contacts WHERE isBlocked = 0 ORDER BY displayName ASC")
    fun getAllContacts(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE pubkey = :pubkey")
    suspend fun getByPubkey(pubkey: String): ContactEntity?

    @Query("SELECT * FROM contacts WHERE pubkey IN (:pubkeys)")
    suspend fun getByPubkeys(pubkeys: List<String>): List<ContactEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(contact: ContactEntity)

    @Update
    suspend fun update(contact: ContactEntity)

    @Delete
    suspend fun delete(contact: ContactEntity)

    @Query("UPDATE contacts SET isBlocked = :blocked WHERE pubkey = :pubkey")
    suspend fun setBlocked(pubkey: String, blocked: Boolean)

    @Query("SELECT * FROM contacts WHERE displayName LIKE '%' || :query || '%' OR nip05 LIKE '%' || :query || '%'")
    fun search(query: String): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE updatedAt > :timestamp")
    suspend fun getContactsUpdatedSince(timestamp: Long): List<ContactEntity>
}

@Dao
interface ConversationDao {
    @Query("SELECT * FROM conversations ORDER BY isPinned DESC, lastMessageAt DESC")
    fun getAllConversations(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun getById(id: String): ConversationEntity?

    @Query("SELECT * FROM conversations WHERE type = :type")
    fun getByType(type: ConversationType): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE participantPubkeys LIKE '%' || :pubkey || '%' AND type = 'DIRECT' LIMIT 1")
    suspend fun findDirectConversation(pubkey: String): ConversationEntity?

    @Query("SELECT * FROM conversations WHERE groupId = :groupId AND type = 'GROUP' LIMIT 1")
    suspend fun findGroupConversation(groupId: String): ConversationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(conversation: ConversationEntity)

    @Update
    suspend fun update(conversation: ConversationEntity)

    @Delete
    suspend fun delete(conversation: ConversationEntity)

    @Query("UPDATE conversations SET unreadCount = 0 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("UPDATE conversations SET isPinned = :pinned WHERE id = :id")
    suspend fun setPinned(id: String, pinned: Boolean)

    @Query("SELECT SUM(unreadCount) FROM conversations")
    fun getTotalUnreadCount(): Flow<Int?>

    @Query("SELECT * FROM conversations WHERE updatedAt > :timestamp")
    suspend fun getConversationsUpdatedSince(timestamp: Long): List<ConversationEntity>
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    fun getMessagesForConversation(conversationId: String, limit: Int = 50, offset: Int = 0): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE id = :id")
    suspend fun getById(id: String): MessageEntity?

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastMessage(conversationId: String): MessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(messages: List<MessageEntity>)

    @Update
    suspend fun update(message: MessageEntity)

    @Delete
    suspend fun delete(message: MessageEntity)

    @Query("UPDATE messages SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: MessageStatus)

    @Query("UPDATE messages SET readAt = :readAt WHERE conversationId = :conversationId AND readAt IS NULL")
    suspend fun markConversationAsRead(conversationId: String, readAt: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM messages WHERE conversationId = :conversationId AND readAt IS NULL AND senderPubkey != :ourPubkey")
    suspend fun getUnreadCount(conversationId: String, ourPubkey: String): Int

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId AND readAt IS NULL AND senderPubkey != :ourPubkey")
    suspend fun getUnreadMessagesForConversation(conversationId: String, ourPubkey: String): List<MessageEntity>

    @Query("SELECT * FROM messages WHERE content LIKE '%' || :query || '%' ORDER BY timestamp DESC")
    fun search(query: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE timestamp > :timestamp ORDER BY timestamp ASC")
    suspend fun getMessagesSince(timestamp: Long): List<MessageEntity>
}

@Dao
interface GroupDao {
    @Query("SELECT * FROM groups ORDER BY name ASC")
    fun getAllGroups(): Flow<List<GroupEntity>>

    @Query("SELECT * FROM groups WHERE id = :id")
    suspend fun getById(id: String): GroupEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(group: GroupEntity)

    @Update
    suspend fun update(group: GroupEntity)

    @Delete
    suspend fun delete(group: GroupEntity)

    @Query("SELECT * FROM group_members WHERE groupId = :groupId")
    fun getMembersForGroup(groupId: String): Flow<List<GroupMemberEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMember(member: GroupMemberEntity)

    @Query("DELETE FROM group_members WHERE groupId = :groupId AND pubkey = :pubkey")
    suspend fun removeMember(groupId: String, pubkey: String)

    @Query("UPDATE group_members SET role = :role WHERE groupId = :groupId AND pubkey = :pubkey")
    suspend fun updateMemberRole(groupId: String, pubkey: String, role: GroupRole)
}

@Dao
interface LinkedDeviceDao {
    @Query("SELECT * FROM linked_devices ORDER BY linkedAt DESC")
    fun getAllDevices(): Flow<List<LinkedDeviceEntity>>

    @Query("SELECT * FROM linked_devices WHERE deviceId = :deviceId")
    suspend fun getById(deviceId: String): LinkedDeviceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(device: LinkedDeviceEntity)

    @Update
    suspend fun update(device: LinkedDeviceEntity)

    @Delete
    suspend fun delete(device: LinkedDeviceEntity)

    @Query("UPDATE linked_devices SET lastSyncAt = :syncAt WHERE deviceId = :deviceId")
    suspend fun updateLastSync(deviceId: String, syncAt: Long = System.currentTimeMillis())
}

@Dao
interface ReactionDao {
    @Query("SELECT * FROM reactions WHERE messageId = :messageId")
    fun getReactionsForMessage(messageId: String): Flow<List<ReactionEntity>>

    @Query("SELECT * FROM reactions WHERE messageId IN (:messageIds)")
    fun getReactionsForMessages(messageIds: List<String>): Flow<List<ReactionEntity>>

    @Query("SELECT * FROM reactions WHERE id = :id")
    suspend fun getById(id: String): ReactionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(reaction: ReactionEntity)

    @Delete
    suspend fun delete(reaction: ReactionEntity)

    @Query("DELETE FROM reactions WHERE messageId = :messageId AND reactorPubkey = :reactorPubkey AND emoji = :emoji")
    suspend fun deleteReaction(messageId: String, reactorPubkey: String, emoji: String)

    @Query("SELECT COUNT(*) FROM reactions WHERE messageId = :messageId AND emoji = :emoji")
    suspend fun getReactionCount(messageId: String, emoji: String): Int

    @Query("SELECT DISTINCT emoji FROM reactions WHERE messageId = :messageId")
    suspend fun getUniqueEmojisForMessage(messageId: String): List<String>
}

@Dao
interface AttachmentDao {
    @Query("SELECT * FROM attachments WHERE messageId = :messageId")
    fun getAttachmentsForMessage(messageId: String): Flow<List<AttachmentEntity>>

    @Query("SELECT * FROM attachments WHERE messageId IN (:messageIds)")
    fun getAttachmentsForMessages(messageIds: List<String>): Flow<List<AttachmentEntity>>

    @Query("SELECT * FROM attachments WHERE id = :id")
    suspend fun getById(id: String): AttachmentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(attachment: AttachmentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(attachments: List<AttachmentEntity>)

    @Update
    suspend fun update(attachment: AttachmentEntity)

    @Delete
    suspend fun delete(attachment: AttachmentEntity)

    @Query("UPDATE attachments SET uploadStatus = :status WHERE id = :id")
    suspend fun updateUploadStatus(id: String, status: UploadStatus)

    @Query("UPDATE attachments SET url = :url, uploadStatus = :status WHERE id = :id")
    suspend fun updateUrlAndStatus(id: String, url: String, status: UploadStatus)

    @Query("SELECT * FROM attachments WHERE uploadStatus = :status")
    fun getAttachmentsByStatus(status: UploadStatus): Flow<List<AttachmentEntity>>
}

// ============== Hilt Module ==============

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private const val DATABASE_KEY_PREFS = "buildit_db_key_prefs"
    private const val DATABASE_KEY_NAME = "database_encryption_key"
    private const val DATABASE_KEY_SIZE = 32 // 256 bits

    /**
     * Gets or creates the database encryption key.
     *
     * The key is:
     * 1. Generated using SecureRandom if not exists
     * 2. Stored in EncryptedSharedPreferences (protected by Keystore)
     * 3. Retrieved and used to encrypt the Room database via SQLCipher
     *
     * This provides hardware-backed protection for the database key on devices with TEE/StrongBox.
     */
    private fun getDatabaseKey(context: Context): ByteArray {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        val encryptedPrefs = EncryptedSharedPreferences.create(
            context,
            DATABASE_KEY_PREFS,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        // Check if key exists
        val existingKey = encryptedPrefs.getString(DATABASE_KEY_NAME, null)
        if (existingKey != null) {
            return android.util.Base64.decode(existingKey, android.util.Base64.NO_WRAP)
        }

        // Generate new key
        val newKey = ByteArray(DATABASE_KEY_SIZE)
        SecureRandom().nextBytes(newKey)

        // Store the key
        encryptedPrefs.edit()
            .putString(DATABASE_KEY_NAME, android.util.Base64.encodeToString(newKey, android.util.Base64.NO_WRAP))
            .apply()

        return newKey
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): BuildItDatabase {
        // Get the database encryption key (Keystore-protected)
        val dbKey = getDatabaseKey(context)

        try {
            // Create SQLCipher factory with the key
            val passphrase = dbKey
            val factory = SupportFactory(passphrase)

            return Room.databaseBuilder(
                context,
                BuildItDatabase::class.java,
                "buildit.db"
            )
                .openHelperFactory(factory)
                .fallbackToDestructiveMigration()
                .build()
        } finally {
            // Clear the key from memory after database is initialized
            Arrays.fill(dbKey, 0.toByte())
        }
    }

    @Provides
    fun provideContactDao(database: BuildItDatabase): ContactDao = database.contactDao()

    @Provides
    fun provideConversationDao(database: BuildItDatabase): ConversationDao = database.conversationDao()

    @Provides
    fun provideMessageDao(database: BuildItDatabase): MessageDao = database.messageDao()

    @Provides
    fun provideGroupDao(database: BuildItDatabase): GroupDao = database.groupDao()

    @Provides
    fun provideLinkedDeviceDao(database: BuildItDatabase): LinkedDeviceDao = database.linkedDeviceDao()

    @Provides
    fun provideReactionDao(database: BuildItDatabase): ReactionDao = database.reactionDao()

    @Provides
    fun provideAttachmentDao(database: BuildItDatabase): AttachmentDao = database.attachmentDao()

    @Provides
    fun provideEventsDao(database: BuildItDatabase): network.buildit.modules.events.data.local.EventsDao = database.eventsDao()

    @Provides
    fun provideRsvpsDao(database: BuildItDatabase): network.buildit.modules.events.data.local.RsvpsDao = database.rsvpsDao()

    @Provides
    fun provideMessagingMetadataDao(database: BuildItDatabase): network.buildit.modules.messaging.data.local.MessagingMetadataDao = database.messagingMetadataDao()

    @Provides
    fun provideMessagingReadReceiptDao(database: BuildItDatabase): network.buildit.modules.messaging.data.local.MessagingReadReceiptDao = database.messagingReadReceiptDao()

    @Provides
    fun provideMessagingReactionDao(database: BuildItDatabase): network.buildit.modules.messaging.data.local.MessagingReactionDao = database.messagingReactionDao()

    // Wiki and Contact DAOs are provided by their respective module Hilt modules
    // (WikiModule.kt and ContactNotesModule.kt) to avoid duplicate bindings

    @Provides
    fun provideOfflineQueueDao(database: BuildItDatabase): network.buildit.core.sync.OfflineQueueDao = database.offlineQueueDao()

    @Provides
    @Singleton
    fun provideSyncManager(
        @ApplicationContext context: Context,
        offlineQueueDao: network.buildit.core.sync.OfflineQueueDao,
        transportRouter: network.buildit.core.transport.TransportRouter
    ): network.buildit.core.sync.SyncManager = network.buildit.core.sync.SyncManager(context, offlineQueueDao, transportRouter)
}
