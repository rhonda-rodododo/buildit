package network.buildit.modules.fundraising.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.fundraising.data.CampaignWithStats
import network.buildit.modules.fundraising.data.FundraisingRepository
import network.buildit.modules.fundraising.data.local.CampaignEntity
import network.buildit.modules.fundraising.data.local.CampaignStatus
import network.buildit.modules.fundraising.data.local.CampaignUpdate
import network.buildit.modules.fundraising.data.local.CampaignVisibility
import network.buildit.modules.fundraising.data.local.DonationEntity
import network.buildit.modules.fundraising.data.local.DonationStatus
import network.buildit.modules.fundraising.data.local.DonationTier
import network.buildit.modules.fundraising.data.local.ExpenseEntity
import network.buildit.modules.fundraising.data.local.PaymentMethod
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for fundraising module operations.
 *
 * Handles all business logic for:
 * - Creating and managing campaigns
 * - Processing donations
 * - Tracking expenses
 * - Publishing to Nostr
 */
@Singleton
class FundraisingUseCase @Inject constructor(
    private val repository: FundraisingRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    // ============== Campaign Operations ==============

    /**
     * Creates a new fundraising campaign.
     *
     * @param title Campaign title
     * @param description Campaign description
     * @param goal Target amount to raise
     * @param currency Currency code (e.g., "USD")
     * @param groupId Optional group ID for group-scoped campaigns
     * @param image Campaign cover image URL
     * @param tiers Donation tier options
     * @param startsAt Campaign start timestamp
     * @param endsAt Campaign end timestamp
     * @param visibility Campaign visibility level
     * @return Result containing the created campaign
     */
    suspend fun createCampaign(
        title: String,
        description: String?,
        goal: Double,
        currency: String,
        groupId: String? = null,
        image: String? = null,
        tiers: List<DonationTier>? = null,
        startsAt: Long? = null,
        endsAt: Long? = null,
        visibility: CampaignVisibility = CampaignVisibility.GROUP
    ): ModuleResult<CampaignEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val campaign = CampaignEntity.create(
                id = UUID.randomUUID().toString(),
                title = title,
                description = description,
                goal = goal,
                currency = currency,
                groupId = groupId,
                createdBy = pubkey,
                image = image,
                tiers = tiers,
                startsAt = startsAt,
                endsAt = endsAt,
                visibility = visibility
            )

            // Save to local storage
            repository.saveCampaign(campaign)

            // Publish to Nostr
            publishCampaignToNostr(campaign)

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
            publishCampaignToNostr(updatedCampaign)

            updatedCampaign
        }.toModuleResult()
    }

    /**
     * Launches a campaign (sets status to active).
     */
    suspend fun launchCampaign(campaignId: String): ModuleResult<CampaignEntity> {
        return runCatching {
            val campaign = repository.getCampaign(campaignId)
                ?: throw IllegalStateException("Campaign not found")

            val updatedCampaign = campaign.copy(
                status = CampaignStatus.ACTIVE,
                startsAt = campaign.startsAt ?: (System.currentTimeMillis() / 1000),
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateCampaign(updatedCampaign)
            publishCampaignToNostr(updatedCampaign)

            updatedCampaign
        }.toModuleResult()
    }

    /**
     * Pauses a campaign.
     */
    suspend fun pauseCampaign(campaignId: String): ModuleResult<CampaignEntity> {
        return runCatching {
            repository.updateCampaignStatus(campaignId, CampaignStatus.PAUSED)
            val campaign = repository.getCampaign(campaignId)!!
            publishCampaignToNostr(campaign)
            campaign
        }.toModuleResult()
    }

    /**
     * Completes a campaign.
     */
    suspend fun completeCampaign(campaignId: String): ModuleResult<CampaignEntity> {
        return runCatching {
            repository.updateCampaignStatus(campaignId, CampaignStatus.COMPLETED)
            val campaign = repository.getCampaign(campaignId)!!
            publishCampaignToNostr(campaign)
            campaign
        }.toModuleResult()
    }

    /**
     * Cancels a campaign.
     */
    suspend fun cancelCampaign(campaignId: String): ModuleResult<CampaignEntity> {
        return runCatching {
            repository.updateCampaignStatus(campaignId, CampaignStatus.CANCELLED)
            val campaign = repository.getCampaign(campaignId)!!
            publishCampaignToNostr(campaign)
            campaign
        }.toModuleResult()
    }

    /**
     * Deletes a campaign.
     */
    suspend fun deleteCampaign(campaignId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteCampaign(campaignId)

            // Publish deletion event to Nostr (Kind 5)
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val deleteEvent = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = NostrClient.KIND_DELETE,
                tags = listOf(listOf("e", campaignId)),
                content = ""
            )

            val signed = cryptoManager.signEvent(deleteEvent)
            if (signed != null) {
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
        }.toModuleResult()
    }

    /**
     * Adds an update to a campaign.
     */
    suspend fun addCampaignUpdate(campaignId: String, content: String): ModuleResult<CampaignEntity> {
        return runCatching {
            val campaign = repository.getCampaign(campaignId)
                ?: throw IllegalStateException("Campaign not found")

            val updates = campaign.getUpdates().toMutableList()
            updates.add(
                CampaignUpdate(
                    content = content,
                    postedAt = System.currentTimeMillis() / 1000
                )
            )

            val updatedCampaign = campaign.copy(
                updatesJson = Json.encodeToString(updates),
                updatedAt = System.currentTimeMillis() / 1000
            )

            repository.updateCampaign(updatedCampaign)
            publishCampaignToNostr(updatedCampaign)

            updatedCampaign
        }.toModuleResult()
    }

    /**
     * Gets campaigns for a group.
     */
    fun getCampaigns(groupId: String?): Flow<List<CampaignEntity>> {
        return if (groupId != null) {
            repository.getCampaignsByGroup(groupId)
        } else {
            repository.getPublicCampaigns()
        }
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
     * Gets active campaigns.
     */
    fun getActiveCampaigns(): Flow<List<CampaignEntity>> {
        return repository.getActiveCampaigns()
    }

    /**
     * Gets campaigns created by the current user.
     */
    fun getMyCampaigns(): Flow<List<CampaignEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getCampaignsByCreator(pubkey)
    }

    /**
     * Searches campaigns.
     */
    fun searchCampaigns(groupId: String?, query: String): Flow<List<CampaignEntity>> {
        return repository.searchCampaigns(groupId, query)
    }

    /**
     * Gets campaigns with statistics.
     */
    fun getCampaignsWithStats(groupId: String): Flow<List<CampaignWithStats>> {
        return repository.getCampaignsWithStats(groupId)
    }

    /**
     * Generates a shareable link for a campaign.
     */
    fun getShareableLink(campaignId: String): String {
        return "https://buildit.network/campaign/$campaignId"
    }

    /**
     * Gets share text for a campaign.
     */
    suspend fun getShareText(campaignId: String): String? {
        val campaign = repository.getCampaign(campaignId) ?: return null
        val link = getShareableLink(campaignId)
        val progress = "${campaign.progressPercent}% funded"
        return """
            Support "${campaign.title}"

            ${campaign.description?.take(100) ?: "Help us reach our goal!"}...

            $progress - Goal: ${formatCurrency(campaign.goal, campaign.currency)}

            Donate: $link
        """.trimIndent()
    }

    // ============== Donation Operations ==============

    /**
     * Creates a new donation.
     */
    suspend fun createDonation(
        campaignId: String,
        amount: Double,
        currency: String,
        donorName: String?,
        anonymous: Boolean,
        message: String?,
        tierId: String?,
        paymentMethod: PaymentMethod
    ): ModuleResult<DonationEntity> {
        return runCatching {
            val campaign = repository.getCampaign(campaignId)
                ?: throw IllegalStateException("Campaign not found")

            if (!campaign.isAcceptingDonations) {
                throw IllegalStateException("Campaign is not accepting donations")
            }

            val donorPubkey = if (!anonymous) {
                cryptoManager.getPublicKeyHex()
            } else null

            val donation = DonationEntity.create(
                id = UUID.randomUUID().toString(),
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                donorPubkey = donorPubkey,
                donorName = donorName,
                anonymous = anonymous,
                message = message,
                tierId = tierId,
                paymentMethod = paymentMethod
            )

            // Save to local storage
            repository.saveDonation(donation)

            // Update campaign totals
            repository.addDonationToCampaign(campaignId, amount)

            // Publish to Nostr
            publishDonationToNostr(donation)

            donation
        }.toModuleResult()
    }

    /**
     * Completes a donation (marks as successful).
     */
    suspend fun completeDonation(donationId: String): ModuleResult<DonationEntity> {
        return runCatching {
            repository.updateDonationStatus(donationId, DonationStatus.COMPLETED)
            val donation = repository.getDonation(donationId)!!

            // Publish status update
            publishDonationToNostr(donation)

            donation
        }.toModuleResult()
    }

    /**
     * Fails a donation.
     */
    suspend fun failDonation(donationId: String): ModuleResult<DonationEntity> {
        return runCatching {
            repository.updateDonationStatus(donationId, DonationStatus.FAILED)
            repository.getDonation(donationId)!!
        }.toModuleResult()
    }

    /**
     * Refunds a donation.
     */
    suspend fun refundDonation(donationId: String): ModuleResult<DonationEntity> {
        return runCatching {
            val donation = repository.getDonation(donationId)
                ?: throw IllegalStateException("Donation not found")

            repository.updateDonationStatus(donationId, DonationStatus.REFUNDED)

            // Subtract from campaign totals (negative amount)
            repository.addDonationToCampaign(donation.campaignId, -donation.amount)

            repository.getDonation(donationId)!!
        }.toModuleResult()
    }

    /**
     * Gets donations for a campaign.
     */
    fun getDonations(campaignId: String): Flow<List<DonationEntity>> {
        return repository.getDonationsForCampaign(campaignId)
    }

    /**
     * Gets completed donations for a campaign.
     */
    fun getCompletedDonations(campaignId: String): Flow<List<DonationEntity>> {
        return repository.getCompletedDonationsForCampaign(campaignId)
    }

    /**
     * Gets donations by the current user.
     */
    fun getMyDonations(): Flow<List<DonationEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getDonationsByDonor(pubkey)
    }

    /**
     * Gets top donations for a campaign.
     */
    fun getTopDonations(campaignId: String, limit: Int = 10): Flow<List<DonationEntity>> {
        return repository.getTopDonations(campaignId, limit)
    }

    /**
     * Gets donation statistics for a campaign.
     */
    suspend fun getDonationStats(campaignId: String): DonationStats {
        return DonationStats(
            count = repository.getDonationCount(campaignId),
            total = repository.getTotalDonations(campaignId),
            average = repository.getAverageDonation(campaignId)
        )
    }

    // ============== Expense Operations ==============

    /**
     * Records an expense for a campaign.
     */
    suspend fun recordExpense(
        campaignId: String,
        amount: Double,
        currency: String,
        description: String,
        category: String?,
        vendor: String?
    ): ModuleResult<ExpenseEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val expense = ExpenseEntity.create(
                id = UUID.randomUUID().toString(),
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                description = description,
                category = category,
                vendor = vendor,
                recordedBy = pubkey
            )

            repository.saveExpense(expense)
            publishExpenseToNostr(expense)

            expense
        }.toModuleResult()
    }

    /**
     * Gets expenses for a campaign.
     */
    fun getExpenses(campaignId: String): Flow<List<ExpenseEntity>> {
        return repository.getExpensesForCampaign(campaignId)
    }

    /**
     * Gets expense summary for a campaign.
     */
    suspend fun getExpenseSummary(campaignId: String): ExpenseSummary {
        val total = repository.getTotalExpenses(campaignId)
        val categories = repository.getExpenseCategories(campaignId)
        val byCategory = categories.associateWith { category ->
            repository.getTotalExpensesByCategory(campaignId, category)
        }

        return ExpenseSummary(
            total = total,
            byCategory = byCategory
        )
    }

    // ============== Nostr Publishing ==============

    private suspend fun publishCampaignToNostr(campaign: CampaignEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to campaign.schemaVersion,
                "id" to campaign.id,
                "title" to campaign.title,
                "description" to campaign.description,
                "goal" to campaign.goal,
                "currency" to campaign.currency,
                "raised" to campaign.raised,
                "donorCount" to campaign.donorCount,
                "status" to campaign.status.value,
                "visibility" to campaign.visibility.value,
                "createdBy" to campaign.createdBy,
                "createdAt" to campaign.createdAt
            )
        )

        val tags = mutableListOf<List<String>>()
        campaign.groupId?.let { tags.add(listOf("g", it)) }
        tags.add(listOf("d", campaign.id))
        tags.add(listOf("module", "fundraising"))

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = campaign.createdAt,
            kind = KIND_CAMPAIGN,
            tags = tags,
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

    private suspend fun publishDonationToNostr(donation: DonationEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to donation.schemaVersion,
                "id" to donation.id,
                "campaignId" to donation.campaignId,
                "amount" to donation.amount,
                "currency" to donation.currency,
                "anonymous" to donation.anonymous,
                "message" to donation.message,
                "paymentMethod" to donation.paymentMethod.value,
                "status" to donation.status.value,
                "donatedAt" to donation.donatedAt
            )
        )

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = donation.donatedAt,
            kind = KIND_DONATION,
            tags = listOf(
                listOf("e", donation.campaignId),
                listOf("module", "fundraising")
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

    private suspend fun publishExpenseToNostr(expense: ExpenseEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to expense.schemaVersion,
                "id" to expense.id,
                "campaignId" to expense.campaignId,
                "amount" to expense.amount,
                "currency" to expense.currency,
                "description" to expense.description,
                "category" to expense.category,
                "vendor" to expense.vendor,
                "recordedBy" to expense.recordedBy,
                "recordedAt" to expense.recordedAt
            )
        )

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = expense.recordedAt,
            kind = KIND_EXPENSE,
            tags = listOf(
                listOf("e", expense.campaignId),
                listOf("module", "fundraising")
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

    private fun formatCurrency(amount: Double, currency: String): String {
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
        // Nostr event kinds from schema
        const val KIND_CAMPAIGN = 40061
        const val KIND_DONATION = 40062
        const val KIND_EXPENSE = 40063
    }
}

/**
 * Donation statistics.
 */
data class DonationStats(
    val count: Int,
    val total: Double,
    val average: Double
)

/**
 * Expense summary.
 */
data class ExpenseSummary(
    val total: Double,
    val byCategory: Map<String, Double>
)
