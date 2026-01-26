package network.buildit.modules.fundraising

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.serialization.json.Json
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.fundraising.data.FundraisingRepository
import network.buildit.modules.fundraising.data.local.CampaignEntity
import network.buildit.modules.fundraising.data.local.CampaignStatus
import network.buildit.modules.fundraising.data.local.CampaignVisibility
import network.buildit.modules.fundraising.data.local.CampaignsDao
import network.buildit.modules.fundraising.data.local.DonationEntity
import network.buildit.modules.fundraising.data.local.DonationStatus
import network.buildit.modules.fundraising.data.local.DonationsDao
import network.buildit.modules.fundraising.data.local.ExpenseEntity
import network.buildit.modules.fundraising.data.local.ExpensesDao
import network.buildit.modules.fundraising.data.local.PaymentMethod
import network.buildit.modules.fundraising.domain.FundraisingUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Fundraising module for BuildIt.
 *
 * Provides:
 * - Campaign creation and management
 * - Donation tracking
 * - Expense reporting
 * - Crypto payment integration
 */
class FundraisingModule @Inject constructor(
    private val fundraisingUseCase: FundraisingUseCase,
    private val repository: FundraisingRepository,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "fundraising"
    override val version: String = "1.0.0"
    override val displayName: String = "Fundraising"
    override val description: String = "Create campaigns and accept donations"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to fundraising-related Nostr events
        subscriptionId = nostrClient.subscribe(
            network.buildit.core.nostr.NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 * 7 // Last 7 days
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            FundraisingUseCase.KIND_CAMPAIGN -> {
                handleCampaignEvent(event)
                true
            }
            FundraisingUseCase.KIND_DONATION -> {
                handleDonationEvent(event)
                true
            }
            FundraisingUseCase.KIND_EXPENSE -> {
                handleExpenseEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeletionEvent(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "fundraising",
                title = "Fundraising",
                icon = Icons.Default.AttachMoney,
                showInNavigation = true,
                content = { args ->
                    // CampaignsListScreen handled by navigation
                }
            ),
            ModuleRoute(
                route = "fundraising/{campaignId}",
                title = "Campaign Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val campaignId = args["campaignId"] ?: return@ModuleRoute
                    // CampaignDetailScreen handled by navigation
                }
            ),
            ModuleRoute(
                route = "fundraising/create",
                title = "Create Campaign",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    // CreateCampaignScreen handled by navigation
                }
            ),
            ModuleRoute(
                route = "fundraising/{campaignId}/donate",
                title = "Donate",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val campaignId = args["campaignId"] ?: return@ModuleRoute
                    // DonateScreen handled by navigation
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            FundraisingUseCase.KIND_CAMPAIGN,
            FundraisingUseCase.KIND_DONATION,
            FundraisingUseCase.KIND_EXPENSE,
            NostrClient.KIND_DELETE
        )
    }

    /**
     * Handles incoming campaign events from Nostr.
     */
    private suspend fun handleCampaignEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val campaign = CampaignEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                title = content["title"]?.toString()?.trim('"') ?: return,
                description = content["description"]?.toString()?.trim('"'),
                goal = content["goal"]?.toString()?.toDoubleOrNull() ?: return,
                currency = content["currency"]?.toString()?.trim('"') ?: "USD",
                raised = content["raised"]?.toString()?.toDoubleOrNull() ?: 0.0,
                donorCount = content["donorCount"]?.toString()?.toIntOrNull() ?: 0,
                startsAt = content["startsAt"]?.toString()?.toLongOrNull(),
                endsAt = content["endsAt"]?.toString()?.toLongOrNull(),
                status = CampaignStatus.fromValue(
                    content["status"]?.toString()?.trim('"') ?: "draft"
                ),
                visibility = CampaignVisibility.fromValue(
                    content["visibility"]?.toString()?.trim('"') ?: "group"
                ),
                groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1),
                image = content["image"]?.toString()?.trim('"'),
                tiersJson = content["tiers"]?.toString(),
                updatesJson = content["updates"]?.toString(),
                createdBy = content["createdBy"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt,
                updatedAt = content["updatedAt"]?.toString()?.toLongOrNull()
            )

            repository.saveCampaign(campaign)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle campaign event", e)
        }
    }

    /**
     * Handles incoming donation events from Nostr.
     */
    private suspend fun handleDonationEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val donation = DonationEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                campaignId = content["campaignId"]?.toString()?.trim('"') ?: return,
                amount = content["amount"]?.toString()?.toDoubleOrNull() ?: return,
                currency = content["currency"]?.toString()?.trim('"') ?: "USD",
                donorPubkey = content["donorPubkey"]?.toString()?.trim('"'),
                donorName = content["donorName"]?.toString()?.trim('"'),
                anonymous = content["anonymous"]?.toString() == "true",
                message = content["message"]?.toString()?.trim('"'),
                tierId = content["tierId"]?.toString()?.trim('"'),
                paymentMethod = PaymentMethod.fromValue(
                    content["paymentMethod"]?.toString()?.trim('"') ?: "other"
                ),
                status = DonationStatus.fromValue(
                    content["status"]?.toString()?.trim('"') ?: "completed"
                ),
                donatedAt = content["donatedAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt
            )

            repository.saveDonation(donation)

            // Update campaign totals if donation is completed
            if (donation.status == DonationStatus.COMPLETED) {
                repository.addDonationToCampaign(donation.campaignId, donation.amount)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle donation event", e)
        }
    }

    /**
     * Handles incoming expense events from Nostr.
     */
    private suspend fun handleExpenseEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val expense = ExpenseEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                campaignId = content["campaignId"]?.toString()?.trim('"') ?: return,
                amount = content["amount"]?.toString()?.toDoubleOrNull() ?: return,
                currency = content["currency"]?.toString()?.trim('"') ?: "USD",
                description = content["description"]?.toString()?.trim('"') ?: return,
                category = content["category"]?.toString()?.trim('"'),
                receipt = content["receipt"]?.toString()?.trim('"'),
                vendor = content["vendor"]?.toString()?.trim('"'),
                date = content["date"]?.toString()?.toLongOrNull(),
                recordedBy = content["recordedBy"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                recordedAt = content["recordedAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt
            )

            repository.saveExpense(expense)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle expense event", e)
        }
    }

    /**
     * Handles deletion events from Nostr.
     */
    private suspend fun handleDeletionEvent(nostrEvent: NostrEvent) {
        try {
            val campaignIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            campaignIds.forEach { campaignId ->
                repository.deleteCampaign(campaignId)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle deletion event", e)
        }
    }

    companion object {
        private const val TAG = "FundraisingModule"
    }
}

/**
 * Hilt module for Fundraising dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class FundraisingHiltModule {
    @Binds
    @IntoSet
    abstract fun bindFundraisingModule(impl: FundraisingModule): BuildItModule
}

/**
 * Provides DAOs for Fundraising module.
 */
@Module
@InstallIn(SingletonComponent::class)
object FundraisingDaoModule {
    @Provides
    @Singleton
    fun provideCampaignsDao(database: BuildItDatabase): CampaignsDao = database.campaignsDao()

    @Provides
    @Singleton
    fun provideDonationsDao(database: BuildItDatabase): DonationsDao = database.donationsDao()

    @Provides
    @Singleton
    fun provideExpensesDao(database: BuildItDatabase): ExpensesDao = database.expensesDao()
}
