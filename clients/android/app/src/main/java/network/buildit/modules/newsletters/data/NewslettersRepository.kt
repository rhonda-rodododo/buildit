package network.buildit.modules.newsletters.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.modules.newsletters.data.local.*
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for newsletter data.
 *
 * Provides a clean API for accessing newsletters, campaigns, subscribers, and templates.
 */
@Singleton
class NewslettersRepository @Inject constructor(
    private val newslettersDao: NewslettersDao,
    private val campaignsDao: CampaignsDao,
    private val subscribersDao: SubscribersDao,
    private val templatesDao: TemplatesDao,
    private val deliveryProgressDao: DeliveryProgressDao
) {
    // ============== Newsletter Methods ==============

    /**
     * Gets all newsletters for a specific group.
     */
    fun getNewslettersByGroup(groupId: String): Flow<List<NewsletterEntity>> {
        return newslettersDao.getNewslettersByGroup(groupId)
    }

    /**
     * Gets all newsletters owned by a specific user.
     */
    fun getNewslettersByOwner(pubkey: String): Flow<List<NewsletterEntity>> {
        return newslettersDao.getNewslettersByOwner(pubkey)
    }

    /**
     * Gets a specific newsletter by ID.
     */
    suspend fun getNewsletter(id: String): NewsletterEntity? {
        return newslettersDao.getNewsletter(id)
    }

    /**
     * Observes a specific newsletter.
     */
    fun observeNewsletter(id: String): Flow<NewsletterEntity?> {
        return newslettersDao.observeNewsletter(id)
    }

    /**
     * Gets all newsletters.
     */
    fun getAllNewsletters(): Flow<List<NewsletterEntity>> {
        return newslettersDao.getAllNewsletters()
    }

    /**
     * Saves a newsletter.
     */
    suspend fun saveNewsletter(newsletter: NewsletterEntity) {
        newslettersDao.insertNewsletter(newsletter)
    }

    /**
     * Updates a newsletter.
     */
    suspend fun updateNewsletter(newsletter: NewsletterEntity) {
        newslettersDao.updateNewsletter(newsletter)
    }

    /**
     * Deletes a newsletter.
     */
    suspend fun deleteNewsletter(newsletterId: String) {
        newslettersDao.deleteNewsletterById(newsletterId)
    }

    /**
     * Updates subscriber count for a newsletter.
     */
    suspend fun updateSubscriberCount(newsletterId: String) {
        val count = subscribersDao.getActiveSubscriberCount(newsletterId)
        newslettersDao.updateSubscriberCount(newsletterId, count)
    }

    // ============== Campaign Methods ==============

    /**
     * Gets all campaigns for a newsletter.
     */
    fun getCampaignsByNewsletter(newsletterId: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getCampaignsByNewsletter(newsletterId)
    }

    /**
     * Gets a specific campaign.
     */
    suspend fun getCampaign(id: String): CampaignEntity? {
        return campaignsDao.getCampaign(id)
    }

    /**
     * Observes a specific campaign.
     */
    fun observeCampaign(id: String): Flow<CampaignEntity?> {
        return campaignsDao.observeCampaign(id)
    }

    /**
     * Gets sent campaigns for a newsletter.
     */
    fun getSentCampaigns(newsletterId: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getSentCampaigns(newsletterId)
    }

    /**
     * Gets draft campaigns for a newsletter.
     */
    fun getDraftCampaigns(newsletterId: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getDraftCampaigns(newsletterId)
    }

    /**
     * Gets campaigns that are scheduled and due to be sent.
     */
    suspend fun getScheduledCampaignsToSend(): List<CampaignEntity> {
        return campaignsDao.getScheduledCampaignsToSend(System.currentTimeMillis() / 1000)
    }

    /**
     * Saves a campaign.
     */
    suspend fun saveCampaign(campaign: CampaignEntity) {
        campaignsDao.insertCampaign(campaign)
    }

    /**
     * Updates a campaign.
     */
    suspend fun updateCampaign(campaign: CampaignEntity) {
        campaignsDao.updateCampaign(campaign)
    }

    /**
     * Deletes a campaign.
     */
    suspend fun deleteCampaign(campaignId: String) {
        campaignsDao.deleteCampaignById(campaignId)
    }

    /**
     * Updates campaign status.
     */
    suspend fun updateCampaignStatus(campaignId: String, status: CampaignStatus) {
        campaignsDao.updateCampaignStatus(campaignId, status.value)
    }

    /**
     * Marks a campaign as sent.
     */
    suspend fun markCampaignSent(campaignId: String, recipientCount: Int) {
        campaignsDao.markCampaignSent(campaignId, System.currentTimeMillis() / 1000, recipientCount)
    }

    /**
     * Gets campaign count for a newsletter.
     */
    suspend fun getCampaignCount(newsletterId: String): Int {
        return campaignsDao.getCampaignCount(newsletterId)
    }

    // ============== Subscriber Methods ==============

    /**
     * Gets all subscribers for a newsletter.
     */
    fun getSubscribersByNewsletter(newsletterId: String): Flow<List<SubscriberEntity>> {
        return subscribersDao.getSubscribersByNewsletter(newsletterId)
    }

    /**
     * Gets subscribers by status.
     */
    fun getSubscribersByStatus(newsletterId: String, status: SubscriberStatus): Flow<List<SubscriberEntity>> {
        return subscribersDao.getSubscribersByStatus(newsletterId, status.value)
    }

    /**
     * Gets active subscribers.
     */
    fun getActiveSubscribers(newsletterId: String): Flow<List<SubscriberEntity>> {
        return subscribersDao.getActiveSubscribers(newsletterId)
    }

    /**
     * Gets active subscribers list (non-flow).
     */
    suspend fun getActiveSubscribersList(newsletterId: String): List<SubscriberEntity> {
        return subscribersDao.getActiveSubscribersList(newsletterId)
    }

    /**
     * Gets a specific subscriber.
     */
    suspend fun getSubscriber(id: String): SubscriberEntity? {
        return subscribersDao.getSubscriber(id)
    }

    /**
     * Gets subscriber by email.
     */
    suspend fun getSubscriberByEmail(newsletterId: String, email: String): SubscriberEntity? {
        return subscribersDao.getSubscriberByEmail(newsletterId, email)
    }

    /**
     * Gets subscriber by pubkey.
     */
    suspend fun getSubscriberByPubkey(newsletterId: String, pubkey: String): SubscriberEntity? {
        return subscribersDao.getSubscriberByPubkey(newsletterId, pubkey)
    }

    /**
     * Observes a specific subscriber.
     */
    fun observeSubscriber(id: String): Flow<SubscriberEntity?> {
        return subscribersDao.observeSubscriber(id)
    }

    /**
     * Saves a subscriber.
     */
    suspend fun saveSubscriber(subscriber: SubscriberEntity) {
        subscribersDao.insertSubscriber(subscriber)
        updateSubscriberCount(subscriber.newsletterId)
    }

    /**
     * Saves multiple subscribers (for batch import).
     */
    suspend fun saveSubscribers(subscribers: List<SubscriberEntity>) {
        if (subscribers.isEmpty()) return
        subscribersDao.insertSubscribers(subscribers)
        // Update count for the first newsletter (assumes all belong to same newsletter)
        subscribers.firstOrNull()?.let { updateSubscriberCount(it.newsletterId) }
    }

    /**
     * Updates a subscriber.
     */
    suspend fun updateSubscriber(subscriber: SubscriberEntity) {
        subscribersDao.updateSubscriber(subscriber)
        updateSubscriberCount(subscriber.newsletterId)
    }

    /**
     * Deletes a subscriber.
     */
    suspend fun deleteSubscriber(subscriberId: String) {
        val subscriber = subscribersDao.getSubscriber(subscriberId)
        subscribersDao.deleteSubscriberById(subscriberId)
        subscriber?.let { updateSubscriberCount(it.newsletterId) }
    }

    /**
     * Confirms a subscriber (moves from pending to active).
     */
    suspend fun confirmSubscriber(subscriberId: String) {
        subscribersDao.confirmSubscriber(subscriberId)
        val subscriber = subscribersDao.getSubscriber(subscriberId)
        subscriber?.let { updateSubscriberCount(it.newsletterId) }
    }

    /**
     * Unsubscribes a subscriber.
     */
    suspend fun unsubscribeSubscriber(subscriberId: String) {
        subscribersDao.updateSubscriberStatus(
            subscriberId,
            SubscriberStatus.UNSUBSCRIBED.value,
            System.currentTimeMillis() / 1000
        )
        val subscriber = subscribersDao.getSubscriber(subscriberId)
        subscriber?.let { updateSubscriberCount(it.newsletterId) }
    }

    /**
     * Gets subscriber count for a newsletter.
     */
    suspend fun getSubscriberCount(newsletterId: String): Int {
        return subscribersDao.getSubscriberCount(newsletterId)
    }

    /**
     * Gets active subscriber count for a newsletter.
     */
    suspend fun getActiveSubscriberCount(newsletterId: String): Int {
        return subscribersDao.getActiveSubscriberCount(newsletterId)
    }

    /**
     * Searches subscribers.
     */
    fun searchSubscribers(newsletterId: String, query: String): Flow<List<SubscriberEntity>> {
        return subscribersDao.searchSubscribers(newsletterId, query)
    }

    // ============== Template Methods ==============

    /**
     * Gets templates for a newsletter (including global templates).
     */
    fun getTemplatesForNewsletter(newsletterId: String): Flow<List<TemplateEntity>> {
        return templatesDao.getTemplatesForNewsletter(newsletterId)
    }

    /**
     * Gets global templates.
     */
    fun getGlobalTemplates(): Flow<List<TemplateEntity>> {
        return templatesDao.getGlobalTemplates()
    }

    /**
     * Gets a specific template.
     */
    suspend fun getTemplate(id: String): TemplateEntity? {
        return templatesDao.getTemplate(id)
    }

    /**
     * Saves a template.
     */
    suspend fun saveTemplate(template: TemplateEntity) {
        templatesDao.insertTemplate(template)
    }

    /**
     * Updates a template.
     */
    suspend fun updateTemplate(template: TemplateEntity) {
        templatesDao.updateTemplate(template)
    }

    /**
     * Deletes a template.
     */
    suspend fun deleteTemplate(templateId: String) {
        templatesDao.deleteTemplateById(templateId)
    }

    // ============== Delivery Progress Methods ==============

    /**
     * Gets delivery progress for a campaign.
     */
    fun getDeliveryProgress(campaignId: String): Flow<List<DeliveryProgressEntity>> {
        return deliveryProgressDao.getDeliveryProgress(campaignId)
    }

    /**
     * Gets delivery progress by status.
     */
    fun getDeliveryProgressByStatus(campaignId: String, status: DeliveryStatus): Flow<List<DeliveryProgressEntity>> {
        return deliveryProgressDao.getDeliveryProgressByStatus(campaignId, status.value)
    }

    /**
     * Creates initial delivery progress entries for a campaign.
     */
    suspend fun createDeliveryProgressForCampaign(campaignId: String, subscribers: List<SubscriberEntity>) {
        val progressList = subscribers.map { subscriber ->
            DeliveryProgressEntity.create(
                id = UUID.randomUUID().toString(),
                campaignId = campaignId,
                subscriberId = subscriber.id,
                subscriberEmail = subscriber.email,
                subscriberPubkey = subscriber.pubkey
            )
        }
        deliveryProgressDao.insertDeliveryProgressList(progressList)
    }

    /**
     * Updates delivery status for a subscriber.
     */
    suspend fun updateDeliveryStatus(progressId: String, status: DeliveryStatus, sentAt: Long? = null) {
        deliveryProgressDao.updateDeliveryStatus(progressId, status.value, sentAt)
    }

    /**
     * Marks delivery as failed.
     */
    suspend fun markDeliveryFailed(progressId: String, errorMessage: String) {
        deliveryProgressDao.markDeliveryFailed(progressId, errorMessage)
    }

    /**
     * Gets delivery statistics for a campaign.
     */
    suspend fun getDeliveryStats(campaignId: String): DeliveryStats {
        val total = deliveryProgressDao.getTotalCount(campaignId)
        val sent = deliveryProgressDao.getSentCount(campaignId)
        val failed = deliveryProgressDao.getFailedCount(campaignId)
        val pending = deliveryProgressDao.getPendingCount(campaignId)

        return DeliveryStats(
            total = total,
            sent = sent,
            failed = failed,
            pending = pending
        )
    }

    /**
     * Gets the next batch of pending deliveries.
     */
    suspend fun getNextDeliveryBatch(campaignId: String, batchSize: Int): List<DeliveryProgressEntity> {
        return deliveryProgressDao.getNextBatch(campaignId, batchSize)
    }

    /**
     * Deletes all delivery progress for a campaign.
     */
    suspend fun deleteDeliveryProgress(campaignId: String) {
        deliveryProgressDao.deleteProgressForCampaign(campaignId)
    }
}

/**
 * Statistics for campaign delivery.
 */
data class DeliveryStats(
    val total: Int,
    val sent: Int,
    val failed: Int,
    val pending: Int
) {
    val progress: Float
        get() = if (total > 0) (sent + failed).toFloat() / total else 0f

    val successRate: Float
        get() = if (sent + failed > 0) sent.toFloat() / (sent + failed) else 0f

    val isComplete: Boolean
        get() = pending == 0
}
