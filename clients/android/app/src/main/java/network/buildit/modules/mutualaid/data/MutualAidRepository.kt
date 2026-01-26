package network.buildit.modules.mutualaid.data

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.mutualaid.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for mutual aid data operations.
 */
@Singleton
class MutualAidRepository @Inject constructor(
    private val requestsDao: AidRequestsDao,
    private val offersDao: AidOffersDao,
    private val fulfillmentsDao: FulfillmentsDao
) {
    // MARK: - Requests

    fun getActiveRequests(): Flow<List<AidRequestEntity>> = requestsDao.getActiveRequests()

    fun getActiveRequestsByCategory(category: AidCategory): Flow<List<AidRequestEntity>> =
        requestsDao.getActiveRequestsByCategory(category)

    fun getRequestsByGroup(groupId: String): Flow<List<AidRequestEntity>> =
        requestsDao.getRequestsByGroup(groupId)

    fun getRequestsByUser(userId: String): Flow<List<AidRequestEntity>> =
        requestsDao.getRequestsByUser(userId)

    fun observeRequest(id: String): Flow<AidRequestEntity?> = requestsDao.observeRequest(id)

    suspend fun getRequestById(id: String): AidRequestEntity? = requestsDao.getRequestById(id)

    suspend fun createRequest(
        title: String,
        description: String?,
        category: AidCategory,
        urgency: UrgencyLevel,
        requesterId: String,
        groupId: String? = null,
        anonymousRequest: Boolean = false,
        locationCity: String? = null,
        locationRegion: String? = null,
        locationType: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        neededBy: Long? = null,
        quantityNeeded: Double? = null,
        unit: String? = null,
        tags: String? = null
    ): AidRequestEntity {
        val request = AidRequestEntity(
            id = java.util.UUID.randomUUID().toString(),
            groupId = groupId,
            title = title,
            description = description,
            category = category,
            status = RequestStatus.OPEN,
            urgency = urgency,
            requesterId = requesterId,
            anonymousRequest = anonymousRequest,
            locationCity = locationCity,
            locationRegion = locationRegion,
            locationType = locationType,
            latitude = latitude,
            longitude = longitude,
            neededBy = neededBy,
            quantityNeeded = quantityNeeded,
            quantityFulfilled = 0.0,
            unit = unit,
            tags = tags,
            createdAt = System.currentTimeMillis(),
            updatedAt = null,
            closedAt = null
        )
        requestsDao.insertRequest(request)
        return request
    }

    suspend fun updateRequest(request: AidRequestEntity) {
        requestsDao.updateRequest(request.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun updateRequestStatus(id: String, status: RequestStatus) {
        requestsDao.updateRequestStatus(id, status)
    }

    suspend fun closeRequest(id: String) {
        requestsDao.updateRequestStatus(id, RequestStatus.CLOSED)
    }

    suspend fun deleteRequest(id: String) {
        requestsDao.deleteRequest(id)
    }

    fun getActiveRequestCount(): Flow<Int> = requestsDao.getActiveRequestCount()

    // MARK: - Offers

    fun getActiveOffers(): Flow<List<AidOfferEntity>> = offersDao.getActiveOffers()

    fun getActiveOffersByCategory(category: AidCategory): Flow<List<AidOfferEntity>> =
        offersDao.getActiveOffersByCategory(category)

    fun getOffersByGroup(groupId: String): Flow<List<AidOfferEntity>> =
        offersDao.getOffersByGroup(groupId)

    fun getOffersByUser(userId: String): Flow<List<AidOfferEntity>> =
        offersDao.getOffersByUser(userId)

    fun observeOffer(id: String): Flow<AidOfferEntity?> = offersDao.observeOffer(id)

    suspend fun getOfferById(id: String): AidOfferEntity? = offersDao.getOfferById(id)

    suspend fun createOffer(
        title: String,
        description: String?,
        category: AidCategory,
        offererId: String,
        groupId: String? = null,
        locationCity: String? = null,
        locationRegion: String? = null,
        locationType: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        availableFrom: Long? = null,
        availableUntil: Long? = null,
        quantity: Double? = null,
        unit: String? = null,
        tags: String? = null
    ): AidOfferEntity {
        val offer = AidOfferEntity(
            id = java.util.UUID.randomUUID().toString(),
            groupId = groupId,
            title = title,
            description = description,
            category = category,
            status = "active",
            offererId = offererId,
            locationCity = locationCity,
            locationRegion = locationRegion,
            locationType = locationType,
            latitude = latitude,
            longitude = longitude,
            availableFrom = availableFrom,
            availableUntil = availableUntil,
            quantity = quantity,
            unit = unit,
            tags = tags,
            createdAt = System.currentTimeMillis(),
            updatedAt = null
        )
        offersDao.insertOffer(offer)
        return offer
    }

    suspend fun updateOffer(offer: AidOfferEntity) {
        offersDao.updateOffer(offer.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun withdrawOffer(id: String) {
        offersDao.updateOfferStatus(id, "withdrawn")
    }

    suspend fun deleteOffer(id: String) {
        offersDao.deleteOffer(id)
    }

    fun getActiveOfferCount(): Flow<Int> = offersDao.getActiveOfferCount()

    // MARK: - Fulfillments

    fun getFulfillmentsByRequest(requestId: String): Flow<List<FulfillmentEntity>> =
        fulfillmentsDao.getFulfillmentsByRequest(requestId)

    fun getFulfillmentsByUser(userId: String): Flow<List<FulfillmentEntity>> =
        fulfillmentsDao.getFulfillmentsByUser(userId)

    suspend fun getFulfillmentById(id: String): FulfillmentEntity? =
        fulfillmentsDao.getFulfillmentById(id)

    suspend fun createFulfillment(
        requestId: String,
        fulfillerId: String,
        quantity: Double? = null,
        message: String? = null,
        scheduledFor: Long? = null
    ): FulfillmentEntity {
        val fulfillment = FulfillmentEntity(
            id = java.util.UUID.randomUUID().toString(),
            requestId = requestId,
            fulfillerId = fulfillerId,
            status = FulfillmentStatus.OFFERED,
            quantity = quantity,
            message = message,
            scheduledFor = scheduledFor,
            completedAt = null,
            createdAt = System.currentTimeMillis()
        )
        fulfillmentsDao.insertFulfillment(fulfillment)
        return fulfillment
    }

    suspend fun acceptFulfillment(id: String) {
        fulfillmentsDao.updateFulfillmentStatus(id, FulfillmentStatus.ACCEPTED)
    }

    suspend fun completeFulfillment(id: String) {
        fulfillmentsDao.completeFulfillment(id)
    }

    suspend fun declineFulfillment(id: String) {
        fulfillmentsDao.updateFulfillmentStatus(id, FulfillmentStatus.DECLINED)
    }

    suspend fun cancelFulfillment(id: String) {
        fulfillmentsDao.updateFulfillmentStatus(id, FulfillmentStatus.CANCELLED)
    }

    suspend fun deleteFulfillment(id: String) {
        fulfillmentsDao.deleteFulfillment(id)
    }

    // MARK: - Batch Operations

    suspend fun insertRequestsFromNostr(requests: List<AidRequestEntity>) {
        requestsDao.insertRequests(requests)
    }

    suspend fun insertOffersFromNostr(offers: List<AidOfferEntity>) {
        offersDao.insertOffers(offers)
    }
}
