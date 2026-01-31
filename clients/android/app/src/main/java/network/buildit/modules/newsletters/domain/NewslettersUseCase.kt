package network.buildit.modules.newsletters.domain

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.newsletters.data.DeliveryStats
import network.buildit.modules.newsletters.data.NewslettersRepository
import network.buildit.modules.newsletters.data.local.*
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for newsletter module operations.
 *
 * Handles all business logic for:
 * - Newsletter CRUD operations
 * - Campaign management
 * - Subscriber management with CSV import/export
 * - NIP-17 batch DM sending
 * - Delivery tracking with progress
 */
@Singleton
class NewslettersUseCase @Inject constructor(
    private val repository: NewslettersRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    private val _sendingProgress = MutableStateFlow<SendingProgress?>(null)
    val sendingProgress: StateFlow<SendingProgress?> = _sendingProgress.asStateFlow()

    // ============== Newsletter CRUD ==============

    /**
     * Creates a new newsletter.
     */
    suspend fun createNewsletter(
        name: String,
        description: String? = null,
        groupId: String? = null,
        fromName: String? = null,
        replyTo: String? = null,
        visibility: NewsletterVisibility = NewsletterVisibility.GROUP,
        doubleOptIn: Boolean = true
    ): ModuleResult<NewsletterEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val newsletter = NewsletterEntity.create(
                id = UUID.randomUUID().toString(),
                name = name,
                description = description,
                groupId = groupId,
                fromName = fromName,
                replyTo = replyTo,
                visibility = visibility,
                doubleOptIn = doubleOptIn,
                ownerPubkey = pubkey
            )

            repository.saveNewsletter(newsletter)
            publishNewsletterToNostr(newsletter)

            newsletter
        }.toModuleResult()
    }

    /**
     * Updates an existing newsletter.
     */
    suspend fun updateNewsletter(newsletter: NewsletterEntity): ModuleResult<NewsletterEntity> {
        return runCatching {
            repository.updateNewsletter(newsletter)
            publishNewsletterToNostr(newsletter)
            newsletter
        }.toModuleResult()
    }

    /**
     * Deletes a newsletter.
     */
    suspend fun deleteNewsletter(newsletterId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteNewsletter(newsletterId)
            publishDeletionToNostr(newsletterId)
        }.toModuleResult()
    }

    /**
     * Gets a newsletter by ID.
     */
    suspend fun getNewsletter(id: String): NewsletterEntity? {
        return repository.getNewsletter(id)
    }

    /**
     * Observes a newsletter.
     */
    fun observeNewsletter(id: String): Flow<NewsletterEntity?> {
        return repository.observeNewsletter(id)
    }

    /**
     * Gets newsletters for a group.
     */
    fun getNewslettersByGroup(groupId: String): Flow<List<NewsletterEntity>> {
        return repository.getNewslettersByGroup(groupId)
    }

    /**
     * Gets all newsletters owned by the current user.
     */
    fun getMyNewsletters(): Flow<List<NewsletterEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return kotlinx.coroutines.flow.flowOf(emptyList())
        return repository.getNewslettersByOwner(pubkey)
    }

    // ============== Campaign Management ==============

    /**
     * Creates a new campaign (draft).
     */
    suspend fun createCampaign(
        newsletterId: String,
        subject: String,
        content: String,
        preheader: String? = null,
        contentType: CampaignContentType = CampaignContentType.MARKDOWN,
        segments: List<String> = emptyList()
    ): ModuleResult<CampaignEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val campaign = CampaignEntity.create(
                id = UUID.randomUUID().toString(),
                newsletterId = newsletterId,
                subject = subject,
                preheader = preheader,
                content = content,
                contentType = contentType,
                segments = segments,
                createdBy = pubkey
            )

            repository.saveCampaign(campaign)
            campaign
        }.toModuleResult()
    }

    /**
     * Updates an existing campaign.
     */
    suspend fun updateCampaign(campaign: CampaignEntity): ModuleResult<CampaignEntity> {
        return runCatching {
            val updatedCampaign = campaign.copy(
                updatedAt = System.currentTimeMillis() / 1000
            )
            repository.updateCampaign(updatedCampaign)
            updatedCampaign
        }.toModuleResult()
    }

    /**
     * Deletes a campaign.
     */
    suspend fun deleteCampaign(campaignId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteCampaign(campaignId)
        }.toModuleResult()
    }

    /**
     * Gets campaigns for a newsletter.
     */
    fun getCampaigns(newsletterId: String): Flow<List<CampaignEntity>> {
        return repository.getCampaignsByNewsletter(newsletterId)
    }

    /**
     * Gets a specific campaign.
     */
    suspend fun getCampaign(id: String): CampaignEntity? {
        return repository.getCampaign(id)
    }

    /**
     * Observes a specific campaign.
     */
    fun observeCampaign(id: String): Flow<CampaignEntity?> {
        return repository.observeCampaign(id)
    }

    /**
     * Gets sent campaigns (issue history).
     */
    fun getIssueHistory(newsletterId: String): Flow<List<CampaignEntity>> {
        return repository.getSentCampaigns(newsletterId)
    }

    /**
     * Schedules a campaign for later sending.
     */
    suspend fun scheduleCampaign(campaignId: String, scheduledAt: Long): ModuleResult<CampaignEntity> {
        return runCatching {
            val campaign = repository.getCampaign(campaignId)
                ?: throw IllegalArgumentException("Campaign not found")

            val updatedCampaign = campaign.copy(
                status = CampaignStatus.SCHEDULED.value,
                scheduledAt = scheduledAt,
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateCampaign(updatedCampaign)
            updatedCampaign
        }.toModuleResult()
    }

    // ============== NIP-17 Batch DM Sending ==============

    /**
     * Sends a campaign to all active subscribers via NIP-17 DMs.
     *
     * @param campaignId The campaign to send
     * @param batchSize Number of DMs to send in parallel
     * @param delayBetweenBatches Delay in milliseconds between batches
     */
    suspend fun sendCampaign(
        campaignId: String,
        batchSize: Int = 10,
        delayBetweenBatches: Long = 1000
    ): ModuleResult<DeliveryStats> = withContext(Dispatchers.Default) {
        runCatching {
            val campaign = repository.getCampaign(campaignId)
                ?: throw IllegalArgumentException("Campaign not found")

            if (campaign.status != CampaignStatus.DRAFT.value && campaign.status != CampaignStatus.SCHEDULED.value) {
                throw IllegalStateException("Campaign is already ${campaign.status}")
            }

            // Update status to sending
            repository.updateCampaignStatus(campaignId, CampaignStatus.SENDING)

            // Get active subscribers
            val newsletter = repository.getNewsletter(campaign.newsletterId)
                ?: throw IllegalArgumentException("Newsletter not found")

            val subscribers = repository.getActiveSubscribersList(campaign.newsletterId)
                .filter { it.pubkey != null } // Only subscribers with pubkeys can receive NIP-17 DMs

            if (subscribers.isEmpty()) {
                repository.updateCampaignStatus(campaignId, CampaignStatus.FAILED)
                throw IllegalStateException("No subscribers with pubkeys to send to")
            }

            // Create delivery progress entries
            repository.createDeliveryProgressForCampaign(campaignId, subscribers)

            // Initialize progress tracking
            _sendingProgress.value = SendingProgress(
                campaignId = campaignId,
                total = subscribers.size,
                sent = 0,
                failed = 0,
                isComplete = false
            )

            // Process batches
            var sentCount = 0
            var failedCount = 0

            try {
                while (true) {
                    val batch = repository.getNextDeliveryBatch(campaignId, batchSize)
                    if (batch.isEmpty()) break

                    for (progress in batch) {
                        val subscriber = repository.getSubscriber(progress.subscriberId)
                        val recipientPubkey = subscriber?.pubkey

                        if (recipientPubkey != null) {
                            val success = sendNip17DirectMessage(
                                recipientPubkey = recipientPubkey,
                                subject = campaign.subject,
                                content = campaign.content,
                                newsletterName = newsletter.name
                            )

                            if (success) {
                                repository.updateDeliveryStatus(
                                    progress.id,
                                    DeliveryStatus.SENT,
                                    System.currentTimeMillis() / 1000
                                )
                                sentCount++
                            } else {
                                repository.markDeliveryFailed(progress.id, "Failed to send NIP-17 DM")
                                failedCount++
                            }
                        } else {
                            repository.markDeliveryFailed(progress.id, "Subscriber has no pubkey")
                            failedCount++
                        }

                        // Update progress
                        _sendingProgress.value = SendingProgress(
                            campaignId = campaignId,
                            total = subscribers.size,
                            sent = sentCount,
                            failed = failedCount,
                            isComplete = false
                        )
                    }

                    // Delay between batches to avoid rate limiting
                    delay(delayBetweenBatches)
                }

                // Mark campaign as sent
                repository.markCampaignSent(campaignId, sentCount)
                publishCampaignToNostr(campaign.copy(
                    status = CampaignStatus.SENT.value,
                    sentAt = System.currentTimeMillis() / 1000,
                    recipientCount = sentCount
                ))

            } catch (e: Exception) {
                Log.e(TAG, "Error during campaign sending", e)
                repository.updateCampaignStatus(campaignId, CampaignStatus.FAILED)
                throw e
            } finally {
                // Mark progress complete
                _sendingProgress.value = SendingProgress(
                    campaignId = campaignId,
                    total = subscribers.size,
                    sent = sentCount,
                    failed = failedCount,
                    isComplete = true
                )
            }

            repository.getDeliveryStats(campaignId)
        }.toModuleResult()
    }

    /**
     * Sends a single NIP-17 direct message.
     */
    private suspend fun sendNip17DirectMessage(
        recipientPubkey: String,
        subject: String,
        content: String,
        newsletterName: String
    ): Boolean {
        return try {
            val formattedContent = """
                |**$subject**
                |
                |From: $newsletterName
                |
                |$content
            """.trimMargin()

            val giftWrap = cryptoManager.createGiftWrap(recipientPubkey, formattedContent)
                ?: return false

            nostrClient.publishEvent(
                network.buildit.core.nostr.NostrEvent(
                    id = giftWrap.id,
                    pubkey = giftWrap.pubkey,
                    createdAt = giftWrap.createdAt,
                    kind = giftWrap.kind,
                    tags = giftWrap.tags,
                    content = giftWrap.content,
                    sig = giftWrap.sig
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send NIP-17 DM", e)
            false
        }
    }

    /**
     * Gets delivery progress for a campaign.
     */
    fun getDeliveryProgress(campaignId: String): Flow<List<DeliveryProgressEntity>> {
        return repository.getDeliveryProgress(campaignId)
    }

    /**
     * Gets delivery statistics.
     */
    suspend fun getDeliveryStats(campaignId: String): DeliveryStats {
        return repository.getDeliveryStats(campaignId)
    }

    // ============== Subscriber Management ==============

    /**
     * Adds a subscriber.
     */
    suspend fun addSubscriber(
        newsletterId: String,
        email: String,
        name: String? = null,
        pubkey: String? = null,
        source: String? = null,
        segments: List<String> = emptyList()
    ): ModuleResult<SubscriberEntity> {
        return runCatching {
            // Check for duplicate email
            val existing = repository.getSubscriberByEmail(newsletterId, email)
            if (existing != null) {
                throw IllegalArgumentException("Subscriber with email $email already exists")
            }

            val newsletter = repository.getNewsletter(newsletterId)
                ?: throw IllegalArgumentException("Newsletter not found")

            val status = if (newsletter.doubleOptIn) SubscriberStatus.PENDING else SubscriberStatus.ACTIVE

            val subscriber = SubscriberEntity.create(
                id = UUID.randomUUID().toString(),
                newsletterId = newsletterId,
                email = email,
                name = name,
                pubkey = pubkey,
                status = status,
                source = source,
                segments = segments,
                confirmedAt = if (!newsletter.doubleOptIn) System.currentTimeMillis() / 1000 else null
            )

            repository.saveSubscriber(subscriber)
            publishSubscriberToNostr(subscriber)

            subscriber
        }.toModuleResult()
    }

    /**
     * Updates a subscriber.
     */
    suspend fun updateSubscriber(subscriber: SubscriberEntity): ModuleResult<SubscriberEntity> {
        return runCatching {
            repository.updateSubscriber(subscriber)
            publishSubscriberToNostr(subscriber)
            subscriber
        }.toModuleResult()
    }

    /**
     * Removes a subscriber.
     */
    suspend fun removeSubscriber(subscriberId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteSubscriber(subscriberId)
        }.toModuleResult()
    }

    /**
     * Unsubscribes a subscriber.
     */
    suspend fun unsubscribe(subscriberId: String): ModuleResult<Unit> {
        return runCatching {
            repository.unsubscribeSubscriber(subscriberId)
        }.toModuleResult()
    }

    /**
     * Confirms a pending subscriber.
     */
    suspend fun confirmSubscriber(subscriberId: String): ModuleResult<Unit> {
        return runCatching {
            repository.confirmSubscriber(subscriberId)
        }.toModuleResult()
    }

    /**
     * Gets subscribers for a newsletter.
     */
    fun getSubscribers(newsletterId: String): Flow<List<SubscriberEntity>> {
        return repository.getSubscribersByNewsletter(newsletterId)
    }

    /**
     * Gets active subscribers.
     */
    fun getActiveSubscribers(newsletterId: String): Flow<List<SubscriberEntity>> {
        return repository.getActiveSubscribers(newsletterId)
    }

    /**
     * Searches subscribers.
     */
    fun searchSubscribers(newsletterId: String, query: String): Flow<List<SubscriberEntity>> {
        return repository.searchSubscribers(newsletterId, query)
    }

    // ============== CSV Import/Export ==============

    /**
     * Imports subscribers from CSV.
     *
     * Expected CSV format: email,name,pubkey,segments,custom_field1,custom_field2,...
     * First row is header.
     */
    suspend fun importSubscribersFromCsv(
        newsletterId: String,
        inputStream: InputStream,
        source: String = "csv_import"
    ): ModuleResult<ImportResult> = withContext(Dispatchers.IO) {
        runCatching {
            val newsletter = repository.getNewsletter(newsletterId)
                ?: throw IllegalArgumentException("Newsletter not found")

            val reader = BufferedReader(InputStreamReader(inputStream))
            val lines = reader.readLines()

            if (lines.isEmpty()) {
                throw IllegalArgumentException("CSV file is empty")
            }

            // Parse header
            val header = lines.first().split(",").map { it.trim().lowercase() }
            val emailIndex = header.indexOf("email")
            val nameIndex = header.indexOf("name")
            val pubkeyIndex = header.indexOf("pubkey")
            val segmentsIndex = header.indexOf("segments")

            if (emailIndex == -1) {
                throw IllegalArgumentException("CSV must have an 'email' column")
            }

            val subscribers = mutableListOf<SubscriberEntity>()
            var imported = 0
            var skipped = 0
            var errors = 0
            val errorMessages = mutableListOf<String>()

            for ((index, line) in lines.drop(1).withIndex()) {
                if (line.isBlank()) continue

                try {
                    val values = parseCsvLine(line)
                    val email = values.getOrNull(emailIndex)?.trim()

                    if (email.isNullOrBlank() || !isValidEmail(email)) {
                        skipped++
                        continue
                    }

                    // Check for duplicate
                    val existing = repository.getSubscriberByEmail(newsletterId, email)
                    if (existing != null) {
                        skipped++
                        continue
                    }

                    val name = values.getOrNull(nameIndex)?.trim()?.ifBlank { null }
                    val pubkey = values.getOrNull(pubkeyIndex)?.trim()?.ifBlank { null }
                    val segmentsStr = values.getOrNull(segmentsIndex)?.trim()
                    val segments = segmentsStr?.split(";")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()

                    // Extract custom fields (any column not in standard fields)
                    val customFields = mutableMapOf<String, String>()
                    for ((i, col) in header.withIndex()) {
                        if (col !in listOf("email", "name", "pubkey", "segments") && i < values.size) {
                            val value = values[i].trim()
                            if (value.isNotBlank()) {
                                customFields[col] = value
                            }
                        }
                    }

                    val status = if (newsletter.doubleOptIn) SubscriberStatus.PENDING else SubscriberStatus.ACTIVE

                    subscribers.add(
                        SubscriberEntity.create(
                            id = UUID.randomUUID().toString(),
                            newsletterId = newsletterId,
                            email = email,
                            name = name,
                            pubkey = pubkey,
                            status = status,
                            source = source,
                            segments = segments,
                            customFields = customFields,
                            confirmedAt = if (!newsletter.doubleOptIn) System.currentTimeMillis() / 1000 else null
                        )
                    )
                    imported++
                } catch (e: Exception) {
                    errors++
                    errorMessages.add("Row ${index + 2}: ${e.message}")
                }
            }

            // Batch save
            if (subscribers.isNotEmpty()) {
                repository.saveSubscribers(subscribers)
            }

            ImportResult(
                imported = imported,
                skipped = skipped,
                errors = errors,
                errorMessages = errorMessages.take(10) // Limit error messages
            )
        }.toModuleResult()
    }

    /**
     * Exports subscribers to CSV.
     */
    suspend fun exportSubscribersToCsv(
        newsletterId: String,
        outputStream: OutputStream,
        includeUnsubscribed: Boolean = false
    ): ModuleResult<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val subscribers = if (includeUnsubscribed) {
                repository.getSubscribersByNewsletter(newsletterId)
            } else {
                repository.getActiveSubscribers(newsletterId)
            }

            // Collect subscribers synchronously
            val subscriberList = subscribers.first()

            // Build CSV
            val sb = StringBuilder()
            sb.appendLine("email,name,pubkey,status,segments,subscribed_at,confirmed_at,unsubscribed_at")

            for (subscriber in subscriberList) {
                val segments = subscriber.getSegments().joinToString(";")
                sb.appendLine(
                    listOf(
                        escapeCsvField(subscriber.email),
                        escapeCsvField(subscriber.name ?: ""),
                        escapeCsvField(subscriber.pubkey ?: ""),
                        subscriber.status,
                        escapeCsvField(segments),
                        subscriber.subscribedAt.toString(),
                        subscriber.confirmedAt?.toString() ?: "",
                        subscriber.unsubscribedAt?.toString() ?: ""
                    ).joinToString(",")
                )
            }

            outputStream.write(sb.toString().toByteArray())
            subscriberList.size
        }.toModuleResult()
    }

    // ============== Template Management ==============

    /**
     * Gets templates for a newsletter.
     */
    fun getTemplates(newsletterId: String): Flow<List<TemplateEntity>> {
        return repository.getTemplatesForNewsletter(newsletterId)
    }

    /**
     * Creates a template.
     */
    suspend fun createTemplate(
        name: String,
        content: String,
        contentType: CampaignContentType = CampaignContentType.MARKDOWN,
        newsletterId: String? = null,
        thumbnail: String? = null
    ): ModuleResult<TemplateEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val template = TemplateEntity.create(
                id = UUID.randomUUID().toString(),
                name = name,
                content = content,
                contentType = contentType,
                newsletterId = newsletterId,
                thumbnail = thumbnail,
                createdBy = pubkey
            )

            repository.saveTemplate(template)
            publishTemplateToNostr(template)

            template
        }.toModuleResult()
    }

    /**
     * Deletes a template.
     */
    suspend fun deleteTemplate(templateId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteTemplate(templateId)
        }.toModuleResult()
    }

    // ============== Nostr Publishing ==============

    private suspend fun publishNewsletterToNostr(newsletter: NewsletterEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to newsletter.schemaVersion,
                "id" to newsletter.id,
                "name" to newsletter.name,
                "description" to newsletter.description,
                "groupId" to newsletter.groupId,
                "fromName" to newsletter.fromName,
                "replyTo" to newsletter.replyTo,
                "logo" to newsletter.logo,
                "subscriberCount" to newsletter.subscriberCount,
                "visibility" to newsletter.visibility,
                "doubleOptIn" to newsletter.doubleOptIn,
                "ownerPubkey" to newsletter.ownerPubkey,
                "editors" to newsletter.getEditors(),
                "createdAt" to newsletter.createdAt
            ).filterValues { it != null }
        )

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = newsletter.createdAt,
            kind = KIND_NEWSLETTER,
            tags = listOf(
                listOf("d", newsletter.id),
                listOf("module", "newsletters")
            ),
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishCampaignToNostr(campaign: CampaignEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to campaign.schemaVersion,
                "id" to campaign.id,
                "newsletterId" to campaign.newsletterId,
                "subject" to campaign.subject,
                "preheader" to campaign.preheader,
                "content" to campaign.content,
                "contentType" to campaign.contentType,
                "status" to campaign.status,
                "scheduledAt" to campaign.scheduledAt,
                "sentAt" to campaign.sentAt,
                "recipientCount" to campaign.recipientCount,
                "openCount" to campaign.openCount,
                "clickCount" to campaign.clickCount,
                "segments" to campaign.getSegments(),
                "createdBy" to campaign.createdBy,
                "createdAt" to campaign.createdAt,
                "updatedAt" to campaign.updatedAt
            ).filterValues { it != null }
        )

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = campaign.createdAt,
            kind = KIND_CAMPAIGN,
            tags = listOf(
                listOf("e", campaign.newsletterId),
                listOf("module", "newsletters")
            ),
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishSubscriberToNostr(subscriber: SubscriberEntity) {
        // Subscriber data is encrypted for privacy
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        // Encrypt subscriber data to owner
        val subscriberData = Json.encodeToString(
            mapOf(
                "_v" to subscriber.schemaVersion,
                "id" to subscriber.id,
                "newsletterId" to subscriber.newsletterId,
                "pubkey" to subscriber.pubkey,
                "email" to subscriber.email,
                "name" to subscriber.name,
                "status" to subscriber.status,
                "segments" to subscriber.getSegments(),
                "customFields" to subscriber.getCustomFields(),
                "source" to subscriber.source,
                "subscribedAt" to subscriber.subscribedAt,
                "confirmedAt" to subscriber.confirmedAt,
                "unsubscribedAt" to subscriber.unsubscribedAt
            ).filterValues { it != null }
        )

        val encryptedContent = cryptoManager.encryptNip44(subscriberData, pubkey) ?: return

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = subscriber.subscribedAt,
            kind = KIND_SUBSCRIBER,
            tags = listOf(
                listOf("e", subscriber.newsletterId),
                listOf("module", "newsletters")
            ),
            content = encryptedContent
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishTemplateToNostr(template: TemplateEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to template.schemaVersion,
                "id" to template.id,
                "newsletterId" to template.newsletterId,
                "name" to template.name,
                "content" to template.content,
                "contentType" to template.contentType,
                "thumbnail" to template.thumbnail,
                "createdBy" to template.createdBy,
                "createdAt" to template.createdAt
            ).filterValues { it != null }
        )

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = template.createdAt,
            kind = KIND_TEMPLATE,
            tags = listOf(
                listOf("d", template.id),
                listOf("module", "newsletters")
            ),
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    private suspend fun publishDeletionToNostr(entityId: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = NostrClient.KIND_DELETE,
            tags = listOf(listOf("e", entityId)),
            content = ""
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    // ============== Utility Functions ==============

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        var inQuotes = false
        val current = StringBuilder()

        for (char in line) {
            when {
                char == '"' -> inQuotes = !inQuotes
                char == ',' && !inQuotes -> {
                    result.add(current.toString())
                    current.clear()
                }
                else -> current.append(char)
            }
        }
        result.add(current.toString())
        return result
    }

    private fun escapeCsvField(value: String): String {
        return if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }

    private fun isValidEmail(email: String): Boolean {
        return android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    }

    companion object {
        private const val TAG = "NewslettersUseCase"

        // Nostr event kinds from schema
        const val KIND_NEWSLETTER = 40081
        const val KIND_CAMPAIGN = 40082
        const val KIND_SUBSCRIBER = 40083
        const val KIND_TEMPLATE = 40084
    }
}

/**
 * Progress tracking for batch sending.
 */
data class SendingProgress(
    val campaignId: String,
    val total: Int,
    val sent: Int,
    val failed: Int,
    val isComplete: Boolean
) {
    val progress: Float
        get() = if (total > 0) (sent + failed).toFloat() / total else 0f

    val remaining: Int
        get() = total - sent - failed
}

/**
 * Result of CSV import operation.
 */
data class ImportResult(
    val imported: Int,
    val skipped: Int,
    val errors: Int,
    val errorMessages: List<String>
)

