package network.buildit.modules.newsletters

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
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
import network.buildit.modules.newsletters.data.local.*
import network.buildit.modules.newsletters.domain.NewslettersUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Newsletters module for BuildIt.
 *
 * Provides newsletter creation, subscriber management, campaign sending via NIP-17,
 * and delivery tracking functionality.
 */
class NewslettersModuleImpl @Inject constructor(
    private val useCase: NewslettersUseCase,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "newsletters"
    override val version: String = "1.0.0"
    override val displayName: String = "Newsletters"
    override val description: String = "Create and send newsletters to subscribers via NIP-17 DMs"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to newsletter-related Nostr events
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
            NewslettersUseCase.KIND_NEWSLETTER -> {
                handleNewsletterEvent(event)
                true
            }
            NewslettersUseCase.KIND_CAMPAIGN -> {
                handleCampaignEvent(event)
                true
            }
            NewslettersUseCase.KIND_SUBSCRIBER -> {
                handleSubscriberEvent(event)
                true
            }
            NewslettersUseCase.KIND_TEMPLATE -> {
                handleTemplateEvent(event)
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
                route = "newsletters",
                title = "Newsletters",
                icon = Icons.Default.Email,
                showInNavigation = true,
                content = { _ ->
                    // NewslettersListScreen()
                }
            ),
            ModuleRoute(
                route = "newsletters/{newsletterId}",
                title = "Newsletter",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val newsletterId = args["newsletterId"] ?: return@ModuleRoute
                    // NewsletterEditorScreen(newsletterId = newsletterId)
                }
            ),
            ModuleRoute(
                route = "newsletters/create",
                title = "Create Newsletter",
                icon = null,
                showInNavigation = false,
                content = { _ ->
                    // NewsletterEditorScreen(newsletterId = null)
                }
            ),
            ModuleRoute(
                route = "newsletters/{newsletterId}/subscribers",
                title = "Subscribers",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val newsletterId = args["newsletterId"] ?: return@ModuleRoute
                    // SubscribersScreen(newsletterId = newsletterId)
                }
            ),
            ModuleRoute(
                route = "newsletters/{newsletterId}/history",
                title = "Issue History",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val newsletterId = args["newsletterId"] ?: return@ModuleRoute
                    // IssueHistoryScreen(newsletterId = newsletterId)
                }
            ),
            ModuleRoute(
                route = "newsletters/{newsletterId}/campaign/{campaignId}",
                title = "Campaign Editor",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val newsletterId = args["newsletterId"] ?: return@ModuleRoute
                    val campaignId = args["campaignId"]
                    // CampaignEditorScreen(newsletterId = newsletterId, campaignId = campaignId)
                }
            ),
            ModuleRoute(
                route = "newsletters/delivery/{campaignId}",
                title = "Delivery Progress",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val campaignId = args["campaignId"] ?: return@ModuleRoute
                    // DeliveryProgressScreen(campaignId = campaignId)
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            NewslettersUseCase.KIND_NEWSLETTER,
            NewslettersUseCase.KIND_CAMPAIGN,
            NewslettersUseCase.KIND_SUBSCRIBER,
            NewslettersUseCase.KIND_TEMPLATE,
            NostrClient.KIND_DELETE
        )
    }

    /**
     * Handles incoming newsletter configuration events.
     */
    private suspend fun handleNewsletterEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d(TAG, "Received newsletter event: ${nostrEvent.id}")
            // In production, decode and save to local database
            // val newsletter = Json.decodeFromString<Newsletter>(nostrEvent.content)
            // useCase.saveFromNostr(newsletter)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle newsletter event", e)
        }
    }

    /**
     * Handles incoming campaign events.
     */
    private suspend fun handleCampaignEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d(TAG, "Received campaign event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle campaign event", e)
        }
    }

    /**
     * Handles incoming subscriber events (encrypted).
     */
    private suspend fun handleSubscriberEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d(TAG, "Received subscriber event: ${nostrEvent.id}")
            // Subscriber events are encrypted - need to decrypt before processing
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle subscriber event", e)
        }
    }

    /**
     * Handles incoming template events.
     */
    private suspend fun handleTemplateEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d(TAG, "Received template event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle template event", e)
        }
    }

    /**
     * Handles deletion events.
     */
    private suspend fun handleDeletionEvent(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            android.util.Log.d(TAG, "Received deletion for: $eventIds")
            // Check if any of these are newsletter-related events and delete locally
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to handle deletion event", e)
        }
    }

    companion object {
        private const val TAG = "NewslettersModule"
    }
}

/**
 * Hilt module for Newsletters dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class NewslettersHiltModule {
    @Binds
    @IntoSet
    abstract fun bindNewslettersModule(impl: NewslettersModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Newsletters module.
 */
@Module
@InstallIn(SingletonComponent::class)
object NewslettersDaoModule {
    @Provides
    @Singleton
    fun provideNewslettersDao(database: BuildItDatabase): NewslettersDao {
        return database.newslettersDao()
    }

    @Provides
    @Singleton
    fun provideNewsletterCampaignsDao(database: BuildItDatabase): CampaignsDao {
        return database.newsletterCampaignsDao()
    }

    @Provides
    @Singleton
    fun provideNewsletterSubscribersDao(database: BuildItDatabase): SubscribersDao {
        return database.newsletterSubscribersDao()
    }

    @Provides
    @Singleton
    fun provideTemplatesDao(database: BuildItDatabase): TemplatesDao {
        return database.templatesDao()
    }

    @Provides
    @Singleton
    fun provideDeliveryProgressDao(database: BuildItDatabase): DeliveryProgressDao {
        return database.deliveryProgressDao()
    }
}
