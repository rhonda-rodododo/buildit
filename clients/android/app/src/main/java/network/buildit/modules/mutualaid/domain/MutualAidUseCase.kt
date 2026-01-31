package network.buildit.modules.mutualaid.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.mutualaid.data.MutualAidRepository
import network.buildit.modules.mutualaid.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for mutual aid business logic.
 */
@Singleton
class MutualAidUseCase @Inject constructor(
    private val repository: MutualAidRepository,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager
) {
    companion object {
        const val KIND_AID_REQUEST = 40101
        const val KIND_AID_OFFER = 40102
        const val KIND_FULFILLMENT = 40103
    }

    // Current user ID
    private val currentUserId: String
        get() = cryptoManager.getPublicKeyHex() ?: ""

    // MARK: - Requests

    fun getActiveRequests(): Flow<List<AidRequestEntity>> = repository.getActiveRequests()

    fun getActiveRequestsByCategory(category: AidCategory): Flow<List<AidRequestEntity>> =
        repository.getActiveRequestsByCategory(category)

    fun observeRequest(id: String): Flow<AidRequestEntity?> = repository.observeRequest(id)

    suspend fun createRequest(
        title: String,
        description: String?,
        category: AidCategory,
        urgency: UrgencyLevel,
        groupId: String? = null,
        anonymousRequest: Boolean = false,
        locationCity: String? = null,
        locationRegion: String? = null,
        locationType: String? = null,
        neededBy: Long? = null,
        quantityNeeded: Double? = null,
        unit: String? = null
    ): AidRequestEntity {
        val request = repository.createRequest(
            title = title,
            description = description,
            category = category,
            urgency = urgency,
            requesterId = currentUserId,
            groupId = groupId,
            anonymousRequest = anonymousRequest,
            locationCity = locationCity,
            locationRegion = locationRegion,
            locationType = locationType,
            neededBy = neededBy,
            quantityNeeded = quantityNeeded,
            unit = unit
        )

        // Publish to Nostr
        publishRequest(request)

        return request
    }

    suspend fun updateRequest(request: AidRequestEntity): AidRequestEntity {
        // Verify ownership
        val existing = repository.getRequestById(request.id)
            ?: throw IllegalStateException("Request not found")

        if (existing.requesterId != currentUserId) {
            throw SecurityException("Not authorized to update this request")
        }

        repository.updateRequest(request)
        publishRequest(request)

        return request
    }

    suspend fun closeRequest(id: String) {
        val request = repository.getRequestById(id)
            ?: throw IllegalStateException("Request not found")

        if (request.requesterId != currentUserId) {
            throw SecurityException("Not authorized to close this request")
        }

        repository.closeRequest(id)
        publishRequestDeletion(id)
    }

    // MARK: - Offers

    fun getActiveOffers(): Flow<List<AidOfferEntity>> = repository.getActiveOffers()

    fun getActiveOffersByCategory(category: AidCategory): Flow<List<AidOfferEntity>> =
        repository.getActiveOffersByCategory(category)

    fun observeOffer(id: String): Flow<AidOfferEntity?> = repository.observeOffer(id)

    suspend fun createOffer(
        title: String,
        description: String?,
        category: AidCategory,
        groupId: String? = null,
        locationCity: String? = null,
        locationRegion: String? = null,
        locationType: String? = null,
        availableFrom: Long? = null,
        availableUntil: Long? = null,
        quantity: Double? = null,
        unit: String? = null
    ): AidOfferEntity {
        val offer = repository.createOffer(
            title = title,
            description = description,
            category = category,
            offererId = currentUserId,
            groupId = groupId,
            locationCity = locationCity,
            locationRegion = locationRegion,
            locationType = locationType,
            availableFrom = availableFrom,
            availableUntil = availableUntil,
            quantity = quantity,
            unit = unit
        )

        // Publish to Nostr
        publishOffer(offer)

        return offer
    }

    suspend fun withdrawOffer(id: String) {
        val offer = repository.getOfferById(id)
            ?: throw IllegalStateException("Offer not found")

        if (offer.offererId != currentUserId) {
            throw SecurityException("Not authorized to withdraw this offer")
        }

        repository.withdrawOffer(id)
        publishOfferWithdrawal(id)
    }

    // MARK: - Fulfillments

    fun getFulfillmentsByRequest(requestId: String): Flow<List<FulfillmentEntity>> =
        repository.getFulfillmentsByRequest(requestId)

    fun getMyFulfillments(): Flow<List<FulfillmentEntity>> =
        repository.getFulfillmentsByUser(currentUserId)

    suspend fun offerFulfillment(
        requestId: String,
        quantity: Double? = null,
        message: String? = null,
        scheduledFor: Long? = null
    ): FulfillmentEntity {
        // Verify request exists
        repository.getRequestById(requestId)
            ?: throw IllegalStateException("Request not found")

        val fulfillment = repository.createFulfillment(
            requestId = requestId,
            fulfillerId = currentUserId,
            quantity = quantity,
            message = message,
            scheduledFor = scheduledFor
        )

        publishFulfillment(fulfillment)

        return fulfillment
    }

    suspend fun acceptFulfillment(fulfillmentId: String, requestId: String) {
        val request = repository.getRequestById(requestId)
            ?: throw IllegalStateException("Request not found")

        if (request.requesterId != currentUserId) {
            throw SecurityException("Not authorized to accept fulfillments for this request")
        }

        repository.acceptFulfillment(fulfillmentId)

        // Update request status
        repository.updateRequestStatus(requestId, RequestStatus.IN_PROGRESS)

        val fulfillment = repository.getFulfillmentById(fulfillmentId)
        fulfillment?.let { publishFulfillment(it) }
    }

    suspend fun completeFulfillment(fulfillmentId: String, requestId: String) {
        val fulfillment = repository.getFulfillmentById(fulfillmentId)
            ?: throw IllegalStateException("Fulfillment not found")

        repository.completeFulfillment(fulfillmentId)

        // Update request quantities
        val request = repository.getRequestById(requestId)
        if (request != null) {
            val newFulfilled = request.quantityFulfilled + (fulfillment.quantity ?: 0.0)
            val newStatus = when {
                request.quantityNeeded != null && newFulfilled >= request.quantityNeeded -> RequestStatus.FULFILLED
                newFulfilled > 0 -> RequestStatus.PARTIALLY_FULFILLED
                else -> request.status
            }

            repository.updateRequest(
                request.copy(
                    quantityFulfilled = newFulfilled,
                    status = newStatus
                )
            )
        }

        val updated = repository.getFulfillmentById(fulfillmentId)
        updated?.let { publishFulfillment(it) }
    }

    suspend fun declineFulfillment(fulfillmentId: String, requestId: String) {
        val request = repository.getRequestById(requestId)
            ?: throw IllegalStateException("Request not found")

        if (request.requesterId != currentUserId) {
            throw SecurityException("Not authorized to decline fulfillments for this request")
        }

        repository.declineFulfillment(fulfillmentId)

        val fulfillment = repository.getFulfillmentById(fulfillmentId)
        fulfillment?.let { publishFulfillment(it) }
    }

    // MARK: - Nostr Publishing

    private suspend fun publishRequest(request: AidRequestEntity) {
        // In production, this would serialize and publish via NostrClient
        android.util.Log.d("MutualAidUseCase", "Would publish request: ${request.id}")
    }

    private suspend fun publishRequestDeletion(requestId: String) {
        android.util.Log.d("MutualAidUseCase", "Would publish request deletion: $requestId")
    }

    private suspend fun publishOffer(offer: AidOfferEntity) {
        android.util.Log.d("MutualAidUseCase", "Would publish offer: ${offer.id}")
    }

    private suspend fun publishOfferWithdrawal(offerId: String) {
        android.util.Log.d("MutualAidUseCase", "Would publish offer withdrawal: $offerId")
    }

    private suspend fun publishFulfillment(fulfillment: FulfillmentEntity) {
        android.util.Log.d("MutualAidUseCase", "Would publish fulfillment: ${fulfillment.id}")
    }
}
