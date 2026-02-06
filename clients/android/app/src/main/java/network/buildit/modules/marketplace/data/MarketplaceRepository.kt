package network.buildit.modules.marketplace.data

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.marketplace.data.local.CoopProfileEntity
import network.buildit.modules.marketplace.data.local.CoopProfilesDao
import network.buildit.modules.marketplace.data.local.GovernanceModel
import network.buildit.modules.marketplace.data.local.ListingEntity
import network.buildit.modules.marketplace.data.local.ListingStatus
import network.buildit.modules.marketplace.data.local.ListingType
import network.buildit.modules.marketplace.data.local.ListingsDao
import network.buildit.modules.marketplace.data.local.ResourceShareEntity
import network.buildit.modules.marketplace.data.local.ResourceShareStatus
import network.buildit.modules.marketplace.data.local.ResourceShareType
import network.buildit.modules.marketplace.data.local.ResourceSharesDao
import network.buildit.modules.marketplace.data.local.ReviewEntity
import network.buildit.modules.marketplace.data.local.ReviewsDao
import network.buildit.modules.marketplace.data.local.SkillExchangeEntity
import network.buildit.modules.marketplace.data.local.SkillExchangeStatus
import network.buildit.modules.marketplace.data.local.SkillExchangesDao
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for marketplace data.
 *
 * Provides a clean API for accessing listings, co-ops, reviews,
 * skill exchanges, and resource shares from local storage.
 */
@Singleton
class MarketplaceRepository @Inject constructor(
    private val listingsDao: ListingsDao,
    private val coopProfilesDao: CoopProfilesDao,
    private val reviewsDao: ReviewsDao,
    private val skillExchangesDao: SkillExchangesDao,
    private val resourceSharesDao: ResourceSharesDao
) {
    // ============== Listing Methods ==============

    fun getActiveListings(): Flow<List<ListingEntity>> {
        return listingsDao.getActiveListings()
    }

    fun getListingsByGroup(groupId: String): Flow<List<ListingEntity>> {
        return listingsDao.getListingsByGroup(groupId)
    }

    fun getActiveListingsByGroup(groupId: String): Flow<List<ListingEntity>> {
        return listingsDao.getActiveListingsByGroup(groupId)
    }

    fun getActiveListingsByType(type: ListingType): Flow<List<ListingEntity>> {
        return listingsDao.getActiveListingsByType(type)
    }

    fun getListingsByCreator(pubkey: String): Flow<List<ListingEntity>> {
        return listingsDao.getListingsByCreator(pubkey)
    }

    fun getListingsByCoop(coopId: String): Flow<List<ListingEntity>> {
        return listingsDao.getListingsByCoop(coopId)
    }

    suspend fun getListing(id: String): ListingEntity? {
        return listingsDao.getListing(id)
    }

    fun observeListing(id: String): Flow<ListingEntity?> {
        return listingsDao.observeListing(id)
    }

    fun searchListings(query: String): Flow<List<ListingEntity>> {
        return listingsDao.searchListings(query)
    }

    fun searchListingsInGroup(groupId: String, query: String): Flow<List<ListingEntity>> {
        return listingsDao.searchListingsInGroup(groupId, query)
    }

    suspend fun saveListing(listing: ListingEntity) {
        listingsDao.insertListing(listing)
    }

    suspend fun updateListing(listing: ListingEntity) {
        listingsDao.updateListing(listing)
    }

    suspend fun deleteListing(listingId: String) {
        listingsDao.deleteListingById(listingId)
    }

    suspend fun updateListingStatus(listingId: String, status: ListingStatus) {
        listingsDao.updateStatus(listingId, status)
    }

    suspend fun getActiveListingCount(groupId: String): Int {
        return listingsDao.getActiveListingCount(groupId)
    }

    // ============== Co-op Profile Methods ==============

    fun getAllCoopProfiles(): Flow<List<CoopProfileEntity>> {
        return coopProfilesDao.getAllCoopProfiles()
    }

    fun getCoopProfilesByGroup(groupId: String): Flow<List<CoopProfileEntity>> {
        return coopProfilesDao.getCoopProfilesByGroup(groupId)
    }

    fun getCoopProfilesByGovernance(model: GovernanceModel): Flow<List<CoopProfileEntity>> {
        return coopProfilesDao.getCoopProfilesByGovernance(model)
    }

    suspend fun getCoopProfile(id: String): CoopProfileEntity? {
        return coopProfilesDao.getCoopProfile(id)
    }

    fun observeCoopProfile(id: String): Flow<CoopProfileEntity?> {
        return coopProfilesDao.observeCoopProfile(id)
    }

    fun searchCoopProfiles(query: String): Flow<List<CoopProfileEntity>> {
        return coopProfilesDao.searchCoopProfiles(query)
    }

    suspend fun saveCoopProfile(coop: CoopProfileEntity) {
        coopProfilesDao.insertCoopProfile(coop)
    }

    suspend fun updateCoopProfile(coop: CoopProfileEntity) {
        coopProfilesDao.updateCoopProfile(coop)
    }

    suspend fun deleteCoopProfile(coopId: String) {
        coopProfilesDao.deleteCoopProfileById(coopId)
    }

    // ============== Review Methods ==============

    fun getReviewsForListing(listingId: String): Flow<List<ReviewEntity>> {
        return reviewsDao.getReviewsForListing(listingId)
    }

    fun getReviewsByReviewer(pubkey: String): Flow<List<ReviewEntity>> {
        return reviewsDao.getReviewsByReviewer(pubkey)
    }

    suspend fun getReview(id: String): ReviewEntity? {
        return reviewsDao.getReview(id)
    }

    suspend fun getAverageRating(listingId: String): Double {
        return reviewsDao.getAverageRating(listingId) ?: 0.0
    }

    suspend fun getReviewCount(listingId: String): Int {
        return reviewsDao.getReviewCount(listingId)
    }

    suspend fun saveReview(review: ReviewEntity) {
        reviewsDao.insertReview(review)
    }

    suspend fun deleteReview(reviewId: String) {
        reviewsDao.deleteReviewById(reviewId)
    }

    // ============== Skill Exchange Methods ==============

    fun getActiveExchanges(): Flow<List<SkillExchangeEntity>> {
        return skillExchangesDao.getActiveExchanges()
    }

    fun getActiveExchangesByGroup(groupId: String): Flow<List<SkillExchangeEntity>> {
        return skillExchangesDao.getActiveExchangesByGroup(groupId)
    }

    fun getExchangesByCreator(pubkey: String): Flow<List<SkillExchangeEntity>> {
        return skillExchangesDao.getExchangesByCreator(pubkey)
    }

    suspend fun getExchange(id: String): SkillExchangeEntity? {
        return skillExchangesDao.getExchange(id)
    }

    fun searchExchanges(query: String): Flow<List<SkillExchangeEntity>> {
        return skillExchangesDao.searchExchanges(query)
    }

    suspend fun saveExchange(exchange: SkillExchangeEntity) {
        skillExchangesDao.insertExchange(exchange)
    }

    suspend fun updateExchange(exchange: SkillExchangeEntity) {
        skillExchangesDao.updateExchange(exchange)
    }

    suspend fun deleteExchange(exchangeId: String) {
        skillExchangesDao.deleteExchangeById(exchangeId)
    }

    suspend fun updateExchangeStatus(exchangeId: String, status: SkillExchangeStatus) {
        skillExchangesDao.updateStatus(exchangeId, status)
    }

    // ============== Resource Share Methods ==============

    fun getAvailableResources(): Flow<List<ResourceShareEntity>> {
        return resourceSharesDao.getAvailableResources()
    }

    fun getResourcesByGroup(groupId: String): Flow<List<ResourceShareEntity>> {
        return resourceSharesDao.getResourcesByGroup(groupId)
    }

    fun getAvailableResourcesByType(type: ResourceShareType): Flow<List<ResourceShareEntity>> {
        return resourceSharesDao.getAvailableResourcesByType(type)
    }

    fun getResourcesByCreator(pubkey: String): Flow<List<ResourceShareEntity>> {
        return resourceSharesDao.getResourcesByCreator(pubkey)
    }

    suspend fun getResource(id: String): ResourceShareEntity? {
        return resourceSharesDao.getResource(id)
    }

    fun searchResources(query: String): Flow<List<ResourceShareEntity>> {
        return resourceSharesDao.searchResources(query)
    }

    suspend fun saveResource(resource: ResourceShareEntity) {
        resourceSharesDao.insertResource(resource)
    }

    suspend fun updateResource(resource: ResourceShareEntity) {
        resourceSharesDao.updateResource(resource)
    }

    suspend fun deleteResource(resourceId: String) {
        resourceSharesDao.deleteResourceById(resourceId)
    }

    suspend fun updateResourceStatus(resourceId: String, status: ResourceShareStatus) {
        resourceSharesDao.updateStatus(resourceId, status)
    }

    // ============== Sync Methods ==============

    suspend fun syncListings(listings: List<ListingEntity>) {
        listingsDao.insertListings(listings)
    }

    suspend fun syncCoopProfiles(coops: List<CoopProfileEntity>) {
        coopProfilesDao.insertCoopProfiles(coops)
    }

    suspend fun syncReviews(reviews: List<ReviewEntity>) {
        reviewsDao.insertReviews(reviews)
    }

    suspend fun syncExchanges(exchanges: List<SkillExchangeEntity>) {
        skillExchangesDao.insertExchanges(exchanges)
    }

    suspend fun syncResources(resources: List<ResourceShareEntity>) {
        resourceSharesDao.insertResources(resources)
    }
}
