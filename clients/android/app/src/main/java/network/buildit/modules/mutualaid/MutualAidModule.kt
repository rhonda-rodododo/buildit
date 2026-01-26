package network.buildit.modules.mutualaid

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolunteerActivism
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
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.mutualaid.data.MutualAidRepository
import network.buildit.modules.mutualaid.data.local.*
import network.buildit.modules.mutualaid.domain.MutualAidUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Mutual Aid module for BuildIt.
 *
 * Provides resource sharing, request/offer management, and community support functionality.
 */
class MutualAidModuleImpl @Inject constructor(
    private val useCase: MutualAidUseCase,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "mutual-aid"
    override val version: String = "1.0.0"
    override val displayName: String = "Mutual Aid"
    override val description: String = "Resource sharing, requests, and community support"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to mutual aid events
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
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
            MutualAidUseCase.KIND_AID_REQUEST -> {
                handleAidRequest(event)
                true
            }
            MutualAidUseCase.KIND_AID_OFFER -> {
                handleAidOffer(event)
                true
            }
            MutualAidUseCase.KIND_FULFILLMENT -> {
                handleFulfillment(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeletion(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "mutual-aid",
                title = "Mutual Aid",
                icon = Icons.Default.VolunteerActivism,
                showInNavigation = true,
                content = { _ ->
                    // MutualAidScreen()
                }
            ),
            ModuleRoute(
                route = "mutual-aid/request/{requestId}",
                title = "Request Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val requestId = args["requestId"] ?: return@ModuleRoute
                    // RequestDetailScreen(requestId = requestId)
                }
            ),
            ModuleRoute(
                route = "mutual-aid/offer/{offerId}",
                title = "Offer Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val offerId = args["offerId"] ?: return@ModuleRoute
                    // OfferDetailScreen(offerId = offerId)
                }
            ),
            ModuleRoute(
                route = "mutual-aid/create-request",
                title = "New Request",
                icon = null,
                showInNavigation = false,
                content = { _ ->
                    // CreateRequestScreen()
                }
            ),
            ModuleRoute(
                route = "mutual-aid/create-offer",
                title = "New Offer",
                icon = null,
                showInNavigation = false,
                content = { _ ->
                    // CreateOfferScreen()
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            MutualAidUseCase.KIND_AID_REQUEST,
            MutualAidUseCase.KIND_AID_OFFER,
            MutualAidUseCase.KIND_FULFILLMENT,
            NostrClient.KIND_DELETE
        )
    }

    private suspend fun handleAidRequest(nostrEvent: NostrEvent) {
        try {
            // Decode and save to local database
            // In production, this would use kotlinx.serialization
            android.util.Log.d("MutualAidModule", "Received aid request: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("MutualAidModule", "Failed to handle aid request", e)
        }
    }

    private suspend fun handleAidOffer(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("MutualAidModule", "Received aid offer: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("MutualAidModule", "Failed to handle aid offer", e)
        }
    }

    private suspend fun handleFulfillment(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("MutualAidModule", "Received fulfillment: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("MutualAidModule", "Failed to handle fulfillment", e)
        }
    }

    private suspend fun handleDeletion(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            // Check if any of these are mutual aid events and delete locally
            android.util.Log.d("MutualAidModule", "Received deletion for: $eventIds")
        } catch (e: Exception) {
            android.util.Log.e("MutualAidModule", "Failed to handle deletion", e)
        }
    }
}

/**
 * Hilt module for Mutual Aid dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class MutualAidHiltModule {
    @Binds
    @IntoSet
    abstract fun bindMutualAidModule(impl: MutualAidModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Mutual Aid module.
 */
@Module
@InstallIn(SingletonComponent::class)
object MutualAidDaoModule {
    @Provides
    @Singleton
    fun provideAidRequestsDao(database: BuildItDatabase): AidRequestsDao {
        return database.aidRequestsDao()
    }

    @Provides
    @Singleton
    fun provideAidOffersDao(database: BuildItDatabase): AidOffersDao {
        return database.aidOffersDao()
    }

    @Provides
    @Singleton
    fun provideFulfillmentsDao(database: BuildItDatabase): FulfillmentsDao {
        return database.fulfillmentsDao()
    }
}
