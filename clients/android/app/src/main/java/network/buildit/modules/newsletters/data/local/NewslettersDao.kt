package network.buildit.modules.newsletters.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for newsletters.
 */
@Dao
interface NewslettersDao {
    @Query("SELECT * FROM newsletters WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getNewslettersByGroup(groupId: String): Flow<List<NewsletterEntity>>

    @Query("SELECT * FROM newsletters WHERE ownerPubkey = :pubkey ORDER BY createdAt DESC")
    fun getNewslettersByOwner(pubkey: String): Flow<List<NewsletterEntity>>

    @Query("SELECT * FROM newsletters WHERE id = :id")
    suspend fun getNewsletter(id: String): NewsletterEntity?

    @Query("SELECT * FROM newsletters WHERE id = :id")
    fun observeNewsletter(id: String): Flow<NewsletterEntity?>

    @Query("SELECT * FROM newsletters ORDER BY createdAt DESC")
    fun getAllNewsletters(): Flow<List<NewsletterEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNewsletter(newsletter: NewsletterEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNewsletters(newsletters: List<NewsletterEntity>)

    @Update
    suspend fun updateNewsletter(newsletter: NewsletterEntity)

    @Delete
    suspend fun deleteNewsletter(newsletter: NewsletterEntity)

    @Query("DELETE FROM newsletters WHERE id = :id")
    suspend fun deleteNewsletterById(id: String)

    @Query("UPDATE newsletters SET subscriberCount = :count WHERE id = :newsletterId")
    suspend fun updateSubscriberCount(newsletterId: String, count: Int)

    @Query("SELECT COUNT(*) FROM newsletters WHERE ownerPubkey = :pubkey")
    suspend fun getNewsletterCountByOwner(pubkey: String): Int
}

/**
 * Data Access Object for campaigns.
 */
@Dao
interface CampaignsDao {
    @Query("SELECT * FROM newsletter_campaigns WHERE newsletterId = :newsletterId ORDER BY createdAt DESC")
    fun getCampaignsByNewsletter(newsletterId: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM newsletter_campaigns WHERE id = :id")
    suspend fun getCampaign(id: String): CampaignEntity?

    @Query("SELECT * FROM newsletter_campaigns WHERE id = :id")
    fun observeCampaign(id: String): Flow<CampaignEntity?>

    @Query("SELECT * FROM newsletter_campaigns WHERE status = :status ORDER BY scheduledAt ASC")
    fun getCampaignsByStatus(status: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM newsletter_campaigns WHERE newsletterId = :newsletterId AND status = 'sent' ORDER BY sentAt DESC")
    fun getSentCampaigns(newsletterId: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM newsletter_campaigns WHERE newsletterId = :newsletterId AND status = 'draft' ORDER BY createdAt DESC")
    fun getDraftCampaigns(newsletterId: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM newsletter_campaigns WHERE status = 'scheduled' AND scheduledAt <= :currentTime ORDER BY scheduledAt ASC")
    suspend fun getScheduledCampaignsToSend(currentTime: Long): List<CampaignEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCampaign(campaign: CampaignEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCampaigns(campaigns: List<CampaignEntity>)

    @Update
    suspend fun updateCampaign(campaign: CampaignEntity)

    @Delete
    suspend fun deleteCampaign(campaign: CampaignEntity)

    @Query("DELETE FROM newsletter_campaigns WHERE id = :id")
    suspend fun deleteCampaignById(id: String)

    @Query("UPDATE newsletter_campaigns SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateCampaignStatus(id: String, status: String, updatedAt: Long = System.currentTimeMillis() / 1000)

    @Query("UPDATE newsletter_campaigns SET sentAt = :sentAt, recipientCount = :recipientCount, status = 'sent' WHERE id = :id")
    suspend fun markCampaignSent(id: String, sentAt: Long, recipientCount: Int)

    @Query("UPDATE newsletter_campaigns SET openCount = openCount + 1 WHERE id = :id")
    suspend fun incrementOpenCount(id: String)

    @Query("UPDATE newsletter_campaigns SET clickCount = clickCount + 1 WHERE id = :id")
    suspend fun incrementClickCount(id: String)

    @Query("SELECT COUNT(*) FROM newsletter_campaigns WHERE newsletterId = :newsletterId")
    suspend fun getCampaignCount(newsletterId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_campaigns WHERE newsletterId = :newsletterId AND status = 'sent'")
    suspend fun getSentCampaignCount(newsletterId: String): Int
}

/**
 * Data Access Object for subscribers.
 */
@Dao
interface SubscribersDao {
    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId ORDER BY subscribedAt DESC")
    fun getSubscribersByNewsletter(newsletterId: String): Flow<List<SubscriberEntity>>

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND status = :status ORDER BY subscribedAt DESC")
    fun getSubscribersByStatus(newsletterId: String, status: String): Flow<List<SubscriberEntity>>

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND status = 'active' ORDER BY subscribedAt DESC")
    fun getActiveSubscribers(newsletterId: String): Flow<List<SubscriberEntity>>

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND status = 'active'")
    suspend fun getActiveSubscribersList(newsletterId: String): List<SubscriberEntity>

    @Query("SELECT * FROM newsletter_subscribers WHERE id = :id")
    suspend fun getSubscriber(id: String): SubscriberEntity?

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND email = :email")
    suspend fun getSubscriberByEmail(newsletterId: String, email: String): SubscriberEntity?

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND pubkey = :pubkey")
    suspend fun getSubscriberByPubkey(newsletterId: String, pubkey: String): SubscriberEntity?

    @Query("SELECT * FROM newsletter_subscribers WHERE id = :id")
    fun observeSubscriber(id: String): Flow<SubscriberEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubscriber(subscriber: SubscriberEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubscribers(subscribers: List<SubscriberEntity>)

    @Update
    suspend fun updateSubscriber(subscriber: SubscriberEntity)

    @Delete
    suspend fun deleteSubscriber(subscriber: SubscriberEntity)

    @Query("DELETE FROM newsletter_subscribers WHERE id = :id")
    suspend fun deleteSubscriberById(id: String)

    @Query("UPDATE newsletter_subscribers SET status = :status, unsubscribedAt = :unsubscribedAt WHERE id = :id")
    suspend fun updateSubscriberStatus(id: String, status: String, unsubscribedAt: Long? = null)

    @Query("UPDATE newsletter_subscribers SET status = 'active', confirmedAt = :confirmedAt WHERE id = :id")
    suspend fun confirmSubscriber(id: String, confirmedAt: Long = System.currentTimeMillis() / 1000)

    @Query("SELECT COUNT(*) FROM newsletter_subscribers WHERE newsletterId = :newsletterId")
    suspend fun getSubscriberCount(newsletterId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND status = 'active'")
    suspend fun getActiveSubscriberCount(newsletterId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND status = :status")
    suspend fun getSubscriberCountByStatus(newsletterId: String, status: String): Int

    @Query("SELECT * FROM newsletter_subscribers WHERE newsletterId = :newsletterId AND (email LIKE '%' || :query || '%' OR name LIKE '%' || :query || '%') ORDER BY subscribedAt DESC")
    fun searchSubscribers(newsletterId: String, query: String): Flow<List<SubscriberEntity>>

    @Query("DELETE FROM newsletter_subscribers WHERE newsletterId = :newsletterId")
    suspend fun deleteAllSubscribersForNewsletter(newsletterId: String)
}

/**
 * Data Access Object for templates.
 */
@Dao
interface TemplatesDao {
    @Query("SELECT * FROM newsletter_templates WHERE newsletterId = :newsletterId OR newsletterId IS NULL ORDER BY createdAt DESC")
    fun getTemplatesForNewsletter(newsletterId: String): Flow<List<TemplateEntity>>

    @Query("SELECT * FROM newsletter_templates WHERE newsletterId IS NULL ORDER BY createdAt DESC")
    fun getGlobalTemplates(): Flow<List<TemplateEntity>>

    @Query("SELECT * FROM newsletter_templates WHERE id = :id")
    suspend fun getTemplate(id: String): TemplateEntity?

    @Query("SELECT * FROM newsletter_templates WHERE id = :id")
    fun observeTemplate(id: String): Flow<TemplateEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTemplate(template: TemplateEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTemplates(templates: List<TemplateEntity>)

    @Update
    suspend fun updateTemplate(template: TemplateEntity)

    @Delete
    suspend fun deleteTemplate(template: TemplateEntity)

    @Query("DELETE FROM newsletter_templates WHERE id = :id")
    suspend fun deleteTemplateById(id: String)
}

/**
 * Data Access Object for delivery progress.
 */
@Dao
interface DeliveryProgressDao {
    @Query("SELECT * FROM newsletter_delivery_progress WHERE campaignId = :campaignId ORDER BY createdAt ASC")
    fun getDeliveryProgress(campaignId: String): Flow<List<DeliveryProgressEntity>>

    @Query("SELECT * FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND status = :status")
    fun getDeliveryProgressByStatus(campaignId: String, status: String): Flow<List<DeliveryProgressEntity>>

    @Query("SELECT * FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND subscriberId = :subscriberId")
    suspend fun getDeliveryProgressForSubscriber(campaignId: String, subscriberId: String): DeliveryProgressEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDeliveryProgress(progress: DeliveryProgressEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDeliveryProgressList(progressList: List<DeliveryProgressEntity>)

    @Update
    suspend fun updateDeliveryProgress(progress: DeliveryProgressEntity)

    @Query("UPDATE newsletter_delivery_progress SET status = :status, sentAt = :sentAt WHERE id = :id")
    suspend fun updateDeliveryStatus(id: String, status: String, sentAt: Long? = null)

    @Query("UPDATE newsletter_delivery_progress SET status = 'failed', errorMessage = :errorMessage WHERE id = :id")
    suspend fun markDeliveryFailed(id: String, errorMessage: String)

    @Query("SELECT COUNT(*) FROM newsletter_delivery_progress WHERE campaignId = :campaignId")
    suspend fun getTotalCount(campaignId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND status = 'sent'")
    suspend fun getSentCount(campaignId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND status = 'failed'")
    suspend fun getFailedCount(campaignId: String): Int

    @Query("SELECT COUNT(*) FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND status = 'pending'")
    suspend fun getPendingCount(campaignId: String): Int

    @Query("DELETE FROM newsletter_delivery_progress WHERE campaignId = :campaignId")
    suspend fun deleteProgressForCampaign(campaignId: String)

    @Query("SELECT * FROM newsletter_delivery_progress WHERE campaignId = :campaignId AND status = 'pending' ORDER BY createdAt ASC LIMIT :limit")
    suspend fun getNextBatch(campaignId: String, limit: Int): List<DeliveryProgressEntity>
}
