package network.buildit.modules.events

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.storage.BuildItDatabase
import network.buildit.generated.schemas.Event
import network.buildit.generated.schemas.Rsvp
import network.buildit.modules.events.data.local.EventEntity
import network.buildit.modules.events.data.local.EventsDao
import network.buildit.modules.events.data.local.RsvpEntity
import network.buildit.modules.events.data.local.RsvpsDao
import network.buildit.modules.events.domain.EventsUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Events module for BuildIt.
 *
 * Provides event creation, RSVP tracking, and calendar functionality.
 */
class EventsModule @Inject constructor(
    private val eventsUseCase: EventsUseCase,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "events"
    override val version: String = "1.0.0"
    override val displayName: String = "Events"
    override val description: String = "Create and manage events with RSVP tracking"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to event-related Nostr events
        subscriptionId = nostrClient.subscribe(
            network.buildit.core.nostr.NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 // Last 24 hours
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            EventsUseCase.KIND_EVENT -> {
                handleEventCreation(event)
                true
            }
            EventsUseCase.KIND_RSVP -> {
                handleRsvpEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleEventDeletion(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "events",
                title = "Events",
                icon = Icons.Default.Event,
                showInNavigation = true,
                content = { args ->
                    // EventsListScreen(groupId = args["groupId"])
                }
            ),
            ModuleRoute(
                route = "events/{eventId}",
                title = "Event Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val eventId = args["eventId"] ?: return@ModuleRoute
                    // EventDetailScreen(eventId = eventId)
                }
            ),
            ModuleRoute(
                route = "events/create",
                title = "Create Event",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    // CreateEventScreen(groupId = args["groupId"])
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            EventsUseCase.KIND_EVENT,
            EventsUseCase.KIND_RSVP,
            NostrClient.KIND_DELETE
        )
    }

    /**
     * Handles incoming event creation from Nostr.
     */
    private suspend fun handleEventCreation(nostrEvent: NostrEvent) {
        try {
            val event = Json.decodeFromString<Event>(nostrEvent.content)

            // Extract group ID from tags
            val groupId = nostrEvent.tags.find { it.firstOrNull() == "g" }?.getOrNull(1)

            // Save to local database
            eventsUseCase.createEvent(event, groupId)
        } catch (e: Exception) {
            // Log error but don't crash
            android.util.Log.e("EventsModule", "Failed to handle event creation", e)
        }
    }

    /**
     * Handles incoming RSVP from Nostr.
     */
    private suspend fun handleRsvpEvent(nostrEvent: NostrEvent) {
        try {
            val rsvp = Json.decodeFromString<Rsvp>(nostrEvent.content)

            // The use case will handle publishing, so we directly save to repository
            // to avoid duplicate publishing
            eventsUseCase.getRsvps(rsvp.eventID).first() // Ensure event exists

            // Save locally (repository layer)
            // This would typically go through a repository method
        } catch (e: Exception) {
            android.util.Log.e("EventsModule", "Failed to handle RSVP", e)
        }
    }

    /**
     * Handles event deletion from Nostr.
     */
    private suspend fun handleEventDeletion(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            eventIds.forEach { eventId ->
                eventsUseCase.deleteEvent(eventId)
            }
        } catch (e: Exception) {
            android.util.Log.e("EventsModule", "Failed to handle event deletion", e)
        }
    }
}

/**
 * Hilt module for Events dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class EventsHiltModule {
    @Binds
    @IntoSet
    abstract fun bindEventsModule(impl: EventsModule): BuildItModule
}

/**
 * Provides DAOs for Events module.
 * Note: DAOs are now provided by DatabaseModule in core/storage/Database.kt
 */
