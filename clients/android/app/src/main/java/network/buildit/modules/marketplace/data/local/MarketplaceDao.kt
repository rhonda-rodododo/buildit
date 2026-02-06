package network.buildit.modules.marketplace.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for marketplace listings.
 */
@Dao
interface ListingsDao {
    @Query("SELECT * FROM marketplace_listings WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getListingsByGroup(groupId: String): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE status = 'active' ORDER BY createdAt DESC")
    fun getActiveListings(): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE groupId = :groupId AND status = 'active' ORDER BY createdAt DESC")
    fun getActiveListingsByGroup(groupId: String): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE type = :type AND status = 'active' ORDER BY createdAt DESC")
    fun getActiveListingsByType(type: ListingType): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getListingsByCreator(pubkey: String): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE coopId = :coopId AND status = 'active' ORDER BY createdAt DESC")
    fun getListingsByCoop(coopId: String): Flow<List<ListingEntity>>

    @Query("SELECT * FROM marketplace_listings WHERE id = :id")
    suspend fun getListing(id: String): ListingEntity?

    @Query("SELECT * FROM marketplace_listings WHERE id = :id")
    fun observeListing(id: String): Flow<ListingEntity?>

    @Query("""
        SELECT * FROM marketplace_listings
        WHERE status = 'active'
        AND (title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%')
        ORDER BY createdAt DESC
    """)
    fun searchListings(query: String): Flow<List<ListingEntity>>

    @Query("""
        SELECT * FROM marketplace_listings
        WHERE (groupId = :groupId OR groupId IS NULL)
        AND status = 'active'
        AND (title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%')
        ORDER BY createdAt DESC
    """)
    fun searchListingsInGroup(groupId: String, query: String): Flow<List<ListingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertListing(listing: ListingEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertListings(listings: List<ListingEntity>)

    @Update
    suspend fun updateListing(listing: ListingEntity)

    @Query("DELETE FROM marketplace_listings WHERE id = :id")
    suspend fun deleteListingById(id: String)

    @Query("UPDATE marketplace_listings SET status = :status, updatedAt = :updatedAt WHERE id = :listingId")
    suspend fun updateStatus(
        listingId: String,
        status: ListingStatus,
        updatedAt: Long = System.currentTimeMillis() / 1000
    )

    @Query("SELECT COUNT(*) FROM marketplace_listings WHERE groupId = :groupId AND status = 'active'")
    suspend fun getActiveListingCount(groupId: String): Int
}

/**
 * Data Access Object for co-op profiles.
 */
@Dao
interface CoopProfilesDao {
    @Query("SELECT * FROM coop_profiles ORDER BY createdAt DESC")
    fun getAllCoopProfiles(): Flow<List<CoopProfileEntity>>

    @Query("SELECT * FROM coop_profiles WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getCoopProfilesByGroup(groupId: String): Flow<List<CoopProfileEntity>>

    @Query("SELECT * FROM coop_profiles WHERE governanceModel = :model ORDER BY createdAt DESC")
    fun getCoopProfilesByGovernance(model: GovernanceModel): Flow<List<CoopProfileEntity>>

    @Query("SELECT * FROM coop_profiles WHERE id = :id")
    suspend fun getCoopProfile(id: String): CoopProfileEntity?

    @Query("SELECT * FROM coop_profiles WHERE id = :id")
    fun observeCoopProfile(id: String): Flow<CoopProfileEntity?>

    @Query("""
        SELECT * FROM coop_profiles
        WHERE name LIKE '%' || :query || '%'
        OR description LIKE '%' || :query || '%'
        OR industry LIKE '%' || :query || '%'
        ORDER BY createdAt DESC
    """)
    fun searchCoopProfiles(query: String): Flow<List<CoopProfileEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCoopProfile(coop: CoopProfileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCoopProfiles(coops: List<CoopProfileEntity>)

    @Update
    suspend fun updateCoopProfile(coop: CoopProfileEntity)

    @Query("DELETE FROM coop_profiles WHERE id = :id")
    suspend fun deleteCoopProfileById(id: String)
}

/**
 * Data Access Object for marketplace reviews.
 */
@Dao
interface ReviewsDao {
    @Query("SELECT * FROM marketplace_reviews WHERE listingId = :listingId ORDER BY createdAt DESC")
    fun getReviewsForListing(listingId: String): Flow<List<ReviewEntity>>

    @Query("SELECT * FROM marketplace_reviews WHERE reviewerPubkey = :pubkey ORDER BY createdAt DESC")
    fun getReviewsByReviewer(pubkey: String): Flow<List<ReviewEntity>>

    @Query("SELECT * FROM marketplace_reviews WHERE id = :id")
    suspend fun getReview(id: String): ReviewEntity?

    @Query("SELECT AVG(rating) FROM marketplace_reviews WHERE listingId = :listingId")
    suspend fun getAverageRating(listingId: String): Double?

    @Query("SELECT COUNT(*) FROM marketplace_reviews WHERE listingId = :listingId")
    suspend fun getReviewCount(listingId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReview(review: ReviewEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReviews(reviews: List<ReviewEntity>)

    @Query("DELETE FROM marketplace_reviews WHERE id = :id")
    suspend fun deleteReviewById(id: String)
}

/**
 * Data Access Object for skill exchanges.
 */
@Dao
interface SkillExchangesDao {
    @Query("SELECT * FROM skill_exchanges WHERE status = 'active' ORDER BY createdAt DESC")
    fun getActiveExchanges(): Flow<List<SkillExchangeEntity>>

    @Query("SELECT * FROM skill_exchanges WHERE groupId = :groupId AND status = 'active' ORDER BY createdAt DESC")
    fun getActiveExchangesByGroup(groupId: String): Flow<List<SkillExchangeEntity>>

    @Query("SELECT * FROM skill_exchanges WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getExchangesByCreator(pubkey: String): Flow<List<SkillExchangeEntity>>

    @Query("SELECT * FROM skill_exchanges WHERE id = :id")
    suspend fun getExchange(id: String): SkillExchangeEntity?

    @Query("""
        SELECT * FROM skill_exchanges
        WHERE status = 'active'
        AND (offeredSkill LIKE '%' || :query || '%' OR requestedSkill LIKE '%' || :query || '%')
        ORDER BY createdAt DESC
    """)
    fun searchExchanges(query: String): Flow<List<SkillExchangeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExchange(exchange: SkillExchangeEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExchanges(exchanges: List<SkillExchangeEntity>)

    @Update
    suspend fun updateExchange(exchange: SkillExchangeEntity)

    @Query("DELETE FROM skill_exchanges WHERE id = :id")
    suspend fun deleteExchangeById(id: String)

    @Query("UPDATE skill_exchanges SET status = :status, updatedAt = :updatedAt WHERE id = :exchangeId")
    suspend fun updateStatus(
        exchangeId: String,
        status: SkillExchangeStatus,
        updatedAt: Long = System.currentTimeMillis() / 1000
    )
}

/**
 * Data Access Object for shared resources.
 */
@Dao
interface ResourceSharesDao {
    @Query("SELECT * FROM resource_shares WHERE status = 'available' ORDER BY createdAt DESC")
    fun getAvailableResources(): Flow<List<ResourceShareEntity>>

    @Query("SELECT * FROM resource_shares WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getResourcesByGroup(groupId: String): Flow<List<ResourceShareEntity>>

    @Query("SELECT * FROM resource_shares WHERE resourceType = :type AND status = 'available' ORDER BY createdAt DESC")
    fun getAvailableResourcesByType(type: ResourceShareType): Flow<List<ResourceShareEntity>>

    @Query("SELECT * FROM resource_shares WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getResourcesByCreator(pubkey: String): Flow<List<ResourceShareEntity>>

    @Query("SELECT * FROM resource_shares WHERE id = :id")
    suspend fun getResource(id: String): ResourceShareEntity?

    @Query("""
        SELECT * FROM resource_shares
        WHERE status = 'available'
        AND (name LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%')
        ORDER BY createdAt DESC
    """)
    fun searchResources(query: String): Flow<List<ResourceShareEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResource(resource: ResourceShareEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResources(resources: List<ResourceShareEntity>)

    @Update
    suspend fun updateResource(resource: ResourceShareEntity)

    @Query("DELETE FROM resource_shares WHERE id = :id")
    suspend fun deleteResourceById(id: String)

    @Query("UPDATE resource_shares SET status = :status, updatedAt = :updatedAt WHERE id = :resourceId")
    suspend fun updateStatus(
        resourceId: String,
        status: ResourceShareStatus,
        updatedAt: Long = System.currentTimeMillis() / 1000
    )
}
