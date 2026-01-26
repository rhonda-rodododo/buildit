package network.buildit.modules.mutualaid.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * DAO for aid requests.
 */
@Dao
interface AidRequestsDao {
    @Query("SELECT * FROM aid_requests ORDER BY createdAt DESC")
    fun getAllRequests(): Flow<List<AidRequestEntity>>

    @Query("SELECT * FROM aid_requests WHERE status IN ('OPEN', 'IN_PROGRESS', 'PARTIALLY_FULFILLED') ORDER BY urgency DESC, createdAt DESC")
    fun getActiveRequests(): Flow<List<AidRequestEntity>>

    @Query("SELECT * FROM aid_requests WHERE category = :category AND status IN ('OPEN', 'IN_PROGRESS', 'PARTIALLY_FULFILLED') ORDER BY urgency DESC, createdAt DESC")
    fun getActiveRequestsByCategory(category: AidCategory): Flow<List<AidRequestEntity>>

    @Query("SELECT * FROM aid_requests WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getRequestsByGroup(groupId: String): Flow<List<AidRequestEntity>>

    @Query("SELECT * FROM aid_requests WHERE requesterId = :userId ORDER BY createdAt DESC")
    fun getRequestsByUser(userId: String): Flow<List<AidRequestEntity>>

    @Query("SELECT * FROM aid_requests WHERE id = :id")
    suspend fun getRequestById(id: String): AidRequestEntity?

    @Query("SELECT * FROM aid_requests WHERE id = :id")
    fun observeRequest(id: String): Flow<AidRequestEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRequest(request: AidRequestEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRequests(requests: List<AidRequestEntity>)

    @Update
    suspend fun updateRequest(request: AidRequestEntity)

    @Query("UPDATE aid_requests SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateRequestStatus(id: String, status: RequestStatus, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE aid_requests SET quantityFulfilled = :fulfilled, status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateRequestFulfillment(
        id: String,
        fulfilled: Double,
        status: RequestStatus,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query("DELETE FROM aid_requests WHERE id = :id")
    suspend fun deleteRequest(id: String)

    @Query("SELECT COUNT(*) FROM aid_requests WHERE status IN ('OPEN', 'IN_PROGRESS', 'PARTIALLY_FULFILLED')")
    fun getActiveRequestCount(): Flow<Int>
}

/**
 * DAO for aid offers.
 */
@Dao
interface AidOffersDao {
    @Query("SELECT * FROM aid_offers ORDER BY createdAt DESC")
    fun getAllOffers(): Flow<List<AidOfferEntity>>

    @Query("SELECT * FROM aid_offers WHERE status = 'active' ORDER BY createdAt DESC")
    fun getActiveOffers(): Flow<List<AidOfferEntity>>

    @Query("SELECT * FROM aid_offers WHERE category = :category AND status = 'active' ORDER BY createdAt DESC")
    fun getActiveOffersByCategory(category: AidCategory): Flow<List<AidOfferEntity>>

    @Query("SELECT * FROM aid_offers WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getOffersByGroup(groupId: String): Flow<List<AidOfferEntity>>

    @Query("SELECT * FROM aid_offers WHERE offererId = :userId ORDER BY createdAt DESC")
    fun getOffersByUser(userId: String): Flow<List<AidOfferEntity>>

    @Query("SELECT * FROM aid_offers WHERE id = :id")
    suspend fun getOfferById(id: String): AidOfferEntity?

    @Query("SELECT * FROM aid_offers WHERE id = :id")
    fun observeOffer(id: String): Flow<AidOfferEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOffer(offer: AidOfferEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOffers(offers: List<AidOfferEntity>)

    @Update
    suspend fun updateOffer(offer: AidOfferEntity)

    @Query("UPDATE aid_offers SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateOfferStatus(id: String, status: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM aid_offers WHERE id = :id")
    suspend fun deleteOffer(id: String)

    @Query("SELECT COUNT(*) FROM aid_offers WHERE status = 'active'")
    fun getActiveOfferCount(): Flow<Int>
}

/**
 * DAO for fulfillments.
 */
@Dao
interface FulfillmentsDao {
    @Query("SELECT * FROM fulfillments WHERE requestId = :requestId ORDER BY createdAt DESC")
    fun getFulfillmentsByRequest(requestId: String): Flow<List<FulfillmentEntity>>

    @Query("SELECT * FROM fulfillments WHERE fulfillerId = :userId ORDER BY createdAt DESC")
    fun getFulfillmentsByUser(userId: String): Flow<List<FulfillmentEntity>>

    @Query("SELECT * FROM fulfillments WHERE id = :id")
    suspend fun getFulfillmentById(id: String): FulfillmentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFulfillment(fulfillment: FulfillmentEntity)

    @Update
    suspend fun updateFulfillment(fulfillment: FulfillmentEntity)

    @Query("UPDATE fulfillments SET status = :status WHERE id = :id")
    suspend fun updateFulfillmentStatus(id: String, status: FulfillmentStatus)

    @Query("UPDATE fulfillments SET status = :status, completedAt = :completedAt WHERE id = :id")
    suspend fun completeFulfillment(
        id: String,
        status: FulfillmentStatus = FulfillmentStatus.COMPLETED,
        completedAt: Long = System.currentTimeMillis()
    )

    @Query("DELETE FROM fulfillments WHERE id = :id")
    suspend fun deleteFulfillment(id: String)

    @Query("SELECT COUNT(*) FROM fulfillments WHERE requestId = :requestId AND status IN ('OFFERED', 'ACCEPTED', 'IN_PROGRESS')")
    suspend fun getPendingFulfillmentCount(requestId: String): Int
}
