package network.buildit.modules.marketplace

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Store
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
import network.buildit.modules.marketplace.data.MarketplaceRepository
import network.buildit.modules.marketplace.data.local.CoopProfileEntity
import network.buildit.modules.marketplace.data.local.CoopProfilesDao
import network.buildit.modules.marketplace.data.local.GovernanceModel
import network.buildit.modules.marketplace.data.local.ListingEntity
import network.buildit.modules.marketplace.data.local.ListingStatus
import network.buildit.modules.marketplace.data.local.ListingType
import network.buildit.modules.marketplace.data.local.ListingsDao
import network.buildit.modules.marketplace.data.local.ResourceSharesDao
import network.buildit.modules.marketplace.data.local.ReviewsDao
import network.buildit.modules.marketplace.data.local.SkillExchangesDao
import network.buildit.modules.marketplace.domain.MarketplaceUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Marketplace module for BuildIt.
 *
 * Provides:
 * - Marketplace listings (products, services, co-ops, initiatives, resources)
 * - Co-op directory with governance models
 * - Skill exchange / time-banking
 * - Resource sharing (tools, spaces, vehicles)
 * - Community reviews
 */
class MarketplaceModule @Inject constructor(
    private val marketplaceUseCase: MarketplaceUseCase,
    private val repository: MarketplaceRepository,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "marketplace"
    override val version: String = "1.0.0"
    override val displayName: String = "Marketplace"
    override val description: String = "Cooperative marketplace with skill exchange and resource sharing"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to marketplace-related Nostr events
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
            MarketplaceUseCase.KIND_LISTING -> {
                handleListingEvent(event)
                true
            }
            MarketplaceUseCase.KIND_COOP_PROFILE -> {
                handleCoopProfileEvent(event)
                true
            }
            MarketplaceUseCase.KIND_REVIEW -> {
                handleReviewEvent(event)
                true
            }
            MarketplaceUseCase.KIND_SKILL_EXCHANGE -> {
                handleSkillExchangeEvent(event)
                true
            }
            MarketplaceUseCase.KIND_RESOURCE_SHARE -> {
                handleResourceShareEvent(event)
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
                route = "marketplace",
                title = "Marketplace",
                icon = Icons.Default.Store,
                showInNavigation = true,
                content = { args ->
                    // MarketplaceScreen handled by navigation
                }
            ),
            ModuleRoute(
                route = "marketplace/{listingId}",
                title = "Listing Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val listingId = args["listingId"] ?: return@ModuleRoute
                    // ListingDetailScreen handled by navigation
                }
            ),
            ModuleRoute(
                route = "marketplace/create",
                title = "Create Listing",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    // CreateListingScreen handled by navigation
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            MarketplaceUseCase.KIND_LISTING,
            MarketplaceUseCase.KIND_COOP_PROFILE,
            MarketplaceUseCase.KIND_REVIEW,
            MarketplaceUseCase.KIND_SKILL_EXCHANGE,
            MarketplaceUseCase.KIND_RESOURCE_SHARE,
            NostrClient.KIND_DELETE
        )
    }

    /**
     * Handles incoming listing events from Nostr.
     */
    private suspend fun handleListingEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val listing = ListingEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                type = ListingType.fromValue(content["type"]?.toString()?.trim('"') ?: "product"),
                title = content["title"]?.toString()?.trim('"') ?: return,
                description = content["description"]?.toString()?.trim('"'),
                price = content["price"]?.toString()?.toDoubleOrNull(),
                currency = content["currency"]?.toString()?.trim('"') ?: "USD",
                imagesJson = content["images"]?.toString(),
                locationJson = content["location"]?.toString(),
                availability = content["availability"]?.toString()?.trim('"'),
                tagsJson = content["tags"]?.toString(),
                createdBy = content["createdBy"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt,
                updatedAt = content["updatedAt"]?.toString()?.toLongOrNull(),
                expiresAt = content["expiresAt"]?.toString()?.toLongOrNull(),
                status = ListingStatus.fromValue(content["status"]?.toString()?.trim('"') ?: "active"),
                groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1),
                coopId = nostrEvent.tags.find { it.firstOrNull() == "p" }?.getOrNull(1),
                contactMethod = content["contactMethod"]?.toString()?.trim('"') ?: "dm"
            )

            repository.saveListing(listing)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle listing event", e)
        }
    }

    /**
     * Handles incoming co-op profile events from Nostr.
     */
    private suspend fun handleCoopProfileEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val coop = CoopProfileEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                name = content["name"]?.toString()?.trim('"') ?: return,
                description = content["description"]?.toString()?.trim('"'),
                memberCount = content["memberCount"]?.toString()?.toIntOrNull() ?: 1,
                governanceModel = GovernanceModel.fromValue(
                    content["governanceModel"]?.toString()?.trim('"') ?: "consensus"
                ),
                industry = content["industry"]?.toString()?.trim('"') ?: "",
                locationJson = content["location"]?.toString(),
                website = content["website"]?.toString()?.trim('"'),
                nostrPubkey = content["nostrPubkey"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                verifiedByJson = content["verifiedBy"]?.toString(),
                image = content["image"]?.toString()?.trim('"'),
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt,
                updatedAt = content["updatedAt"]?.toString()?.toLongOrNull(),
                groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)
            )

            repository.saveCoopProfile(coop)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle co-op profile event", e)
        }
    }

    /**
     * Handles incoming review events from Nostr.
     */
    private suspend fun handleReviewEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val review = network.buildit.modules.marketplace.data.local.ReviewEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                listingId = content["listingId"]?.toString()?.trim('"') ?: return,
                reviewerPubkey = content["reviewerPubkey"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                rating = content["rating"]?.toString()?.toIntOrNull()?.coerceIn(1, 5) ?: return,
                text = content["text"]?.toString()?.trim('"') ?: return,
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt
            )

            repository.saveReview(review)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle review event", e)
        }
    }

    /**
     * Handles incoming skill exchange events from Nostr.
     */
    private suspend fun handleSkillExchangeEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val exchange = network.buildit.modules.marketplace.data.local.SkillExchangeEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                offeredSkill = content["offeredSkill"]?.toString()?.trim('"') ?: return,
                requestedSkill = content["requestedSkill"]?.toString()?.trim('"') ?: return,
                availableHours = content["availableHours"]?.toString()?.toDoubleOrNull() ?: 0.0,
                hourlyTimebank = content["hourlyTimebank"]?.toString()?.toDoubleOrNull() ?: 0.0,
                locationJson = content["location"]?.toString(),
                createdBy = content["createdBy"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt,
                updatedAt = content["updatedAt"]?.toString()?.toLongOrNull(),
                status = network.buildit.modules.marketplace.data.local.SkillExchangeStatus.fromValue(
                    content["status"]?.toString()?.trim('"') ?: "active"
                ),
                groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)
            )

            repository.saveExchange(exchange)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle skill exchange event", e)
        }
    }

    /**
     * Handles incoming resource share events from Nostr.
     */
    private suspend fun handleResourceShareEvent(nostrEvent: NostrEvent) {
        try {
            val json = Json { ignoreUnknownKeys = true }
            val content = json.decodeFromString<Map<String, kotlinx.serialization.json.JsonElement>>(nostrEvent.content)

            val resource = network.buildit.modules.marketplace.data.local.ResourceShareEntity(
                id = content["id"]?.toString()?.trim('"') ?: return,
                schemaVersion = content["_v"]?.toString()?.trim('"') ?: "1.0.0",
                resourceType = network.buildit.modules.marketplace.data.local.ResourceShareType.fromValue(
                    content["resourceType"]?.toString()?.trim('"') ?: "tool"
                ),
                name = content["name"]?.toString()?.trim('"') ?: return,
                description = content["description"]?.toString()?.trim('"'),
                imagesJson = content["images"]?.toString(),
                locationJson = content["location"]?.toString(),
                depositRequired = content["depositRequired"]?.toString() == "true",
                depositAmount = content["depositAmount"]?.toString()?.toDoubleOrNull(),
                depositCurrency = content["depositCurrency"]?.toString()?.trim('"'),
                createdBy = content["createdBy"]?.toString()?.trim('"') ?: nostrEvent.pubkey,
                createdAt = content["createdAt"]?.toString()?.toLongOrNull() ?: nostrEvent.createdAt,
                updatedAt = content["updatedAt"]?.toString()?.toLongOrNull(),
                status = network.buildit.modules.marketplace.data.local.ResourceShareStatus.fromValue(
                    content["status"]?.toString()?.trim('"') ?: "available"
                ),
                groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)
            )

            repository.saveResource(resource)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle resource share event", e)
        }
    }

    /**
     * Handles deletion events from Nostr.
     */
    private suspend fun handleDeletionEvent(nostrEvent: NostrEvent) {
        try {
            val entityIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            entityIds.forEach { entityId ->
                // Try to delete from all tables (only one will match)
                repository.deleteListing(entityId)
                repository.deleteCoopProfile(entityId)
                repository.deleteReview(entityId)
                repository.deleteExchange(entityId)
                repository.deleteResource(entityId)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle deletion event", e)
        }
    }

    companion object {
        private const val TAG = "MarketplaceModule"
    }
}

/**
 * Hilt module for Marketplace dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class MarketplaceHiltModule {
    @Binds
    @IntoSet
    abstract fun bindMarketplaceModule(impl: MarketplaceModule): BuildItModule
}

/**
 * Provides DAOs for Marketplace module.
 */
@Module
@InstallIn(SingletonComponent::class)
object MarketplaceDaoModule {
    @Provides
    @Singleton
    fun provideListingsDao(database: BuildItDatabase): ListingsDao = database.listingsDao()

    @Provides
    @Singleton
    fun provideCoopProfilesDao(database: BuildItDatabase): CoopProfilesDao = database.coopProfilesDao()

    @Provides
    @Singleton
    fun provideReviewsDao(database: BuildItDatabase): ReviewsDao = database.reviewsDao()

    @Provides
    @Singleton
    fun provideSkillExchangesDao(database: BuildItDatabase): SkillExchangesDao = database.skillExchangesDao()

    @Provides
    @Singleton
    fun provideResourceSharesDao(database: BuildItDatabase): ResourceSharesDao = database.resourceSharesDao()
}
