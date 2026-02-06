package network.buildit.modules.marketplace.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.marketplace.data.MarketplaceRepository
import network.buildit.modules.marketplace.data.local.CoopProfileEntity
import network.buildit.modules.marketplace.data.local.GovernanceModel
import network.buildit.modules.marketplace.data.local.ListingEntity
import network.buildit.modules.marketplace.data.local.ListingStatus
import network.buildit.modules.marketplace.data.local.ListingType
import network.buildit.modules.marketplace.data.local.LocationValue
import network.buildit.modules.marketplace.data.local.ResourceShareEntity
import network.buildit.modules.marketplace.data.local.ResourceShareType
import network.buildit.modules.marketplace.data.local.ReviewEntity
import network.buildit.modules.marketplace.data.local.SkillExchangeEntity
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for marketplace module operations.
 *
 * Handles all business logic for:
 * - Creating and managing listings
 * - Co-op profile management
 * - Reviews
 * - Skill exchange matching
 * - Resource sharing
 * - Publishing to Nostr
 */
@Singleton
class MarketplaceUseCase @Inject constructor(
    private val repository: MarketplaceRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    // ============== Listing Operations ==============

    /**
     * Creates a new marketplace listing.
     */
    suspend fun createListing(
        type: ListingType,
        title: String,
        description: String?,
        price: Double?,
        currency: String = "USD",
        images: List<String> = emptyList(),
        location: LocationValue? = null,
        availability: String? = null,
        tags: List<String> = emptyList(),
        expiresAt: Long? = null,
        groupId: String? = null,
        coopId: String? = null,
        contactMethod: String = "dm"
    ): ModuleResult<ListingEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val listing = ListingEntity.create(
                id = UUID.randomUUID().toString(),
                type = type,
                title = title,
                description = description,
                price = price,
                currency = currency,
                images = images,
                location = location,
                availability = availability,
                tags = tags,
                createdBy = pubkey,
                expiresAt = expiresAt,
                groupId = groupId,
                coopId = coopId,
                contactMethod = contactMethod
            )

            repository.saveListing(listing)
            publishListingToNostr(listing)
            listing
        }.toModuleResult()
    }

    /**
     * Updates an existing listing.
     */
    suspend fun updateListing(listing: ListingEntity): ModuleResult<ListingEntity> {
        return runCatching {
            val updated = listing.copy(updatedAt = System.currentTimeMillis() / 1000)
            repository.updateListing(updated)
            publishListingToNostr(updated)
            updated
        }.toModuleResult()
    }

    /**
     * Deletes a listing.
     */
    suspend fun deleteListing(listingId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteListing(listingId)
            publishDeletionToNostr(listingId)
        }.toModuleResult()
    }

    /**
     * Marks a listing as sold.
     */
    suspend fun markListingAsSold(listingId: String): ModuleResult<Unit> {
        return runCatching {
            repository.updateListingStatus(listingId, ListingStatus.SOLD)
        }.toModuleResult()
    }

    fun getActiveListings(): Flow<List<ListingEntity>> = repository.getActiveListings()

    fun getListingsByGroup(groupId: String): Flow<List<ListingEntity>> = repository.getListingsByGroup(groupId)

    fun getActiveListingsByType(type: ListingType): Flow<List<ListingEntity>> = repository.getActiveListingsByType(type)

    fun getListingsByCoop(coopId: String): Flow<List<ListingEntity>> = repository.getListingsByCoop(coopId)

    suspend fun getListing(id: String): ListingEntity? = repository.getListing(id)

    fun observeListing(id: String): Flow<ListingEntity?> = repository.observeListing(id)

    fun searchListings(query: String): Flow<List<ListingEntity>> = repository.searchListings(query)

    fun getMyListings(): Flow<List<ListingEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return flowOf(emptyList())
        return repository.getListingsByCreator(pubkey)
    }

    // ============== Co-op Profile Operations ==============

    /**
     * Registers a new co-op profile.
     */
    suspend fun registerCoop(
        name: String,
        description: String?,
        memberCount: Int = 1,
        governanceModel: GovernanceModel = GovernanceModel.CONSENSUS,
        industry: String = "",
        location: LocationValue? = null,
        website: String? = null,
        groupId: String? = null
    ): ModuleResult<CoopProfileEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val coop = CoopProfileEntity.create(
                id = UUID.randomUUID().toString(),
                name = name,
                description = description,
                memberCount = memberCount,
                governanceModel = governanceModel,
                industry = industry,
                location = location,
                website = website,
                nostrPubkey = pubkey,
                groupId = groupId
            )

            repository.saveCoopProfile(coop)
            publishCoopToNostr(coop)
            coop
        }.toModuleResult()
    }

    fun getAllCoopProfiles(): Flow<List<CoopProfileEntity>> = repository.getAllCoopProfiles()

    fun searchCoopProfiles(query: String): Flow<List<CoopProfileEntity>> = repository.searchCoopProfiles(query)

    suspend fun getCoopProfile(id: String): CoopProfileEntity? = repository.getCoopProfile(id)

    // ============== Review Operations ==============

    /**
     * Submits a review for a listing.
     */
    suspend fun submitReview(
        listingId: String,
        rating: Int,
        text: String
    ): ModuleResult<ReviewEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val review = ReviewEntity.create(
                id = UUID.randomUUID().toString(),
                listingId = listingId,
                reviewerPubkey = pubkey,
                rating = rating,
                text = text
            )

            repository.saveReview(review)
            publishReviewToNostr(review)
            review
        }.toModuleResult()
    }

    fun getReviewsForListing(listingId: String): Flow<List<ReviewEntity>> =
        repository.getReviewsForListing(listingId)

    suspend fun getReviewStats(listingId: String): ReviewStats {
        return ReviewStats(
            averageRating = repository.getAverageRating(listingId),
            count = repository.getReviewCount(listingId)
        )
    }

    // ============== Skill Exchange Operations ==============

    /**
     * Creates a skill exchange offer.
     */
    suspend fun createExchange(
        offeredSkill: String,
        requestedSkill: String,
        availableHours: Double = 0.0,
        hourlyTimebank: Double = 0.0,
        location: LocationValue? = null,
        groupId: String? = null
    ): ModuleResult<SkillExchangeEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val exchange = SkillExchangeEntity.create(
                id = UUID.randomUUID().toString(),
                offeredSkill = offeredSkill,
                requestedSkill = requestedSkill,
                availableHours = availableHours,
                hourlyTimebank = hourlyTimebank,
                location = location,
                createdBy = pubkey,
                groupId = groupId
            )

            repository.saveExchange(exchange)
            publishExchangeToNostr(exchange)
            exchange
        }.toModuleResult()
    }

    fun getActiveExchanges(): Flow<List<SkillExchangeEntity>> = repository.getActiveExchanges()

    fun searchExchanges(query: String): Flow<List<SkillExchangeEntity>> = repository.searchExchanges(query)

    // ============== Resource Share Operations ==============

    /**
     * Creates a resource share.
     */
    suspend fun createResource(
        resourceType: ResourceShareType,
        name: String,
        description: String? = null,
        images: List<String> = emptyList(),
        location: LocationValue? = null,
        depositRequired: Boolean = false,
        depositAmount: Double? = null,
        depositCurrency: String? = null,
        groupId: String? = null
    ): ModuleResult<ResourceShareEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val resource = ResourceShareEntity.create(
                id = UUID.randomUUID().toString(),
                resourceType = resourceType,
                name = name,
                description = description,
                images = images,
                location = location,
                depositRequired = depositRequired,
                depositAmount = depositAmount,
                depositCurrency = depositCurrency,
                createdBy = pubkey,
                groupId = groupId
            )

            repository.saveResource(resource)
            publishResourceToNostr(resource)
            resource
        }.toModuleResult()
    }

    fun getAvailableResources(): Flow<List<ResourceShareEntity>> = repository.getAvailableResources()

    fun getAvailableResourcesByType(type: ResourceShareType): Flow<List<ResourceShareEntity>> =
        repository.getAvailableResourcesByType(type)

    fun searchResources(query: String): Flow<List<ResourceShareEntity>> = repository.searchResources(query)

    // ============== Nostr Publishing ==============

    private suspend fun publishListingToNostr(listing: ListingEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to listing.schemaVersion,
                "id" to listing.id,
                "type" to listing.type.value,
                "title" to listing.title,
                "description" to listing.description,
                "price" to listing.price,
                "currency" to listing.currency,
                "status" to listing.status.value,
                "contactMethod" to listing.contactMethod,
                "createdBy" to listing.createdBy,
                "createdAt" to listing.createdAt
            )
        )

        val tags = mutableListOf<List<String>>()
        listing.groupId?.let { tags.add(listOf("g", it)) }
        listing.coopId?.let { tags.add(listOf("p", it)) }
        tags.add(listOf("d", listing.id))
        tags.add(listOf("module", "marketplace"))
        tags.add(listOf("t", listing.type.value))

        publishToNostr(pubkey, KIND_LISTING, content, tags, listing.createdAt)
    }

    private suspend fun publishCoopToNostr(coop: CoopProfileEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to coop.schemaVersion,
                "id" to coop.id,
                "name" to coop.name,
                "description" to coop.description,
                "memberCount" to coop.memberCount,
                "governanceModel" to coop.governanceModel.value,
                "industry" to coop.industry,
                "nostrPubkey" to coop.nostrPubkey,
                "createdAt" to coop.createdAt
            )
        )

        val tags = mutableListOf<List<String>>()
        coop.groupId?.let { tags.add(listOf("g", it)) }
        tags.add(listOf("d", coop.id))
        tags.add(listOf("module", "marketplace"))

        publishToNostr(pubkey, KIND_COOP_PROFILE, content, tags, coop.createdAt)
    }

    private suspend fun publishReviewToNostr(review: ReviewEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to review.schemaVersion,
                "id" to review.id,
                "listingId" to review.listingId,
                "rating" to review.rating,
                "text" to review.text,
                "createdAt" to review.createdAt
            )
        )

        val tags = listOf(
            listOf("e", review.listingId),
            listOf("module", "marketplace")
        )

        publishToNostr(pubkey, KIND_REVIEW, content, tags, review.createdAt)
    }

    private suspend fun publishExchangeToNostr(exchange: SkillExchangeEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to exchange.schemaVersion,
                "id" to exchange.id,
                "offeredSkill" to exchange.offeredSkill,
                "requestedSkill" to exchange.requestedSkill,
                "availableHours" to exchange.availableHours,
                "hourlyTimebank" to exchange.hourlyTimebank,
                "status" to exchange.status.value,
                "createdBy" to exchange.createdBy,
                "createdAt" to exchange.createdAt
            )
        )

        val tags = mutableListOf<List<String>>()
        exchange.groupId?.let { tags.add(listOf("g", it)) }
        tags.add(listOf("d", exchange.id))
        tags.add(listOf("module", "marketplace"))

        publishToNostr(pubkey, KIND_SKILL_EXCHANGE, content, tags, exchange.createdAt)
    }

    private suspend fun publishResourceToNostr(resource: ResourceShareEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to resource.schemaVersion,
                "id" to resource.id,
                "resourceType" to resource.resourceType.value,
                "name" to resource.name,
                "description" to resource.description,
                "depositRequired" to resource.depositRequired,
                "status" to resource.status.value,
                "createdBy" to resource.createdBy,
                "createdAt" to resource.createdAt
            )
        )

        val tags = mutableListOf<List<String>>()
        resource.groupId?.let { tags.add(listOf("g", it)) }
        tags.add(listOf("d", resource.id))
        tags.add(listOf("module", "marketplace"))
        tags.add(listOf("t", resource.resourceType.value))

        publishToNostr(pubkey, KIND_RESOURCE_SHARE, content, tags, resource.createdAt)
    }

    private suspend fun publishDeletionToNostr(entityId: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val deleteEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = NostrClient.KIND_DELETE,
            tags = listOf(listOf("e", entityId)),
            content = ""
        )

        val signed = cryptoManager.signEvent(deleteEvent) ?: return
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

    private suspend fun publishToNostr(
        pubkey: String,
        kind: Int,
        content: String,
        tags: List<List<String>>,
        createdAt: Long
    ) {
        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = createdAt,
            kind = kind,
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

    companion object {
        // Nostr event kinds from schema (40131-40139)
        const val KIND_LISTING = 40131
        const val KIND_COOP_PROFILE = 40132
        const val KIND_REVIEW = 40133
        const val KIND_SKILL_EXCHANGE = 40134
        const val KIND_RESOURCE_SHARE = 40135
    }
}

/**
 * Review statistics for a listing.
 */
data class ReviewStats(
    val averageRating: Double,
    val count: Int
)
