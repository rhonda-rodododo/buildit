package network.buildit.widgets

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import network.buildit.core.storage.BuildItDatabase
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.MessageEntity
import network.buildit.modules.events.data.local.EventEntity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Data class representing an unread message for display in widgets.
 */
data class WidgetMessage(
    val id: String,
    val senderName: String,
    val content: String,
    val timestamp: Long,
    val conversationId: String
)

/**
 * Data class representing an upcoming event for display in widgets.
 */
data class WidgetEvent(
    val id: String,
    val title: String,
    val startAt: Long,
    val location: String?,
    val formattedDate: String,
    val formattedTime: String
)

/**
 * Data class representing widget state for unread messages.
 */
data class UnreadMessagesState(
    val unreadCount: Int,
    val recentMessages: List<WidgetMessage>
)

/**
 * Data class representing widget state for upcoming events.
 */
data class UpcomingEventsState(
    val events: List<WidgetEvent>
)

/**
 * Provides data from Room database to widgets.
 * Triggers widget updates when data changes.
 */
@Singleton
class WidgetDataProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val database: BuildItDatabase
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val dateFormat = SimpleDateFormat("MMM d", Locale.getDefault())
    private val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())

    /**
     * Observes unread message count and recent messages.
     */
    fun observeUnreadMessages(): Flow<UnreadMessagesState> {
        return database.conversationDao().getAllConversations().map { conversations ->
            val totalUnread = conversations.sumOf { it.unreadCount }
            val recentMessages = getRecentUnreadMessages(conversations)
            UnreadMessagesState(
                unreadCount = totalUnread,
                recentMessages = recentMessages
            )
        }
    }

    /**
     * Gets the current unread message state synchronously.
     */
    suspend fun getUnreadMessagesState(): UnreadMessagesState {
        val conversations = database.conversationDao().getAllConversations().first()
        val totalUnread = conversations.sumOf { it.unreadCount }
        val recentMessages = getRecentUnreadMessages(conversations)
        return UnreadMessagesState(
            unreadCount = totalUnread,
            recentMessages = recentMessages
        )
    }

    private suspend fun getRecentUnreadMessages(
        conversations: List<ConversationEntity>
    ): List<WidgetMessage> {
        val unreadConversations = conversations
            .filter { it.unreadCount > 0 }
            .sortedByDescending { it.lastMessageAt }
            .take(3)

        return unreadConversations.mapNotNull { conversation ->
            val lastMessageId = conversation.lastMessageId ?: return@mapNotNull null
            val message = database.messageDao().getById(lastMessageId) ?: return@mapNotNull null
            val contact = database.contactDao().getByPubkey(message.senderPubkey)

            WidgetMessage(
                id = message.id,
                senderName = contact?.displayName ?: message.senderPubkey.take(8) + "...",
                content = truncateContent(message.content),
                timestamp = message.timestamp,
                conversationId = conversation.id
            )
        }
    }

    /**
     * Observes upcoming events.
     */
    fun observeUpcomingEvents(): Flow<UpcomingEventsState> {
        val now = System.currentTimeMillis()
        return database.eventsDao().getPublicEvents().map { events ->
            val upcoming = events
                .filter { it.startAt >= now }
                .sortedBy { it.startAt }
                .take(3)
                .map { it.toWidgetEvent() }
            UpcomingEventsState(events = upcoming)
        }
    }

    /**
     * Gets the current upcoming events state synchronously.
     */
    suspend fun getUpcomingEventsState(): UpcomingEventsState {
        val now = System.currentTimeMillis()
        val events = database.eventsDao().getPublicEvents().first()
        val upcoming = events
            .filter { it.startAt >= now }
            .sortedBy { it.startAt }
            .take(3)
            .map { it.toWidgetEvent() }
        return UpcomingEventsState(events = upcoming)
    }

    private fun EventEntity.toWidgetEvent(): WidgetEvent {
        val startDate = Date(startAt)
        val locationText = locationJson?.let {
            // Extract address from JSON if available
            try {
                kotlinx.serialization.json.Json.decodeFromString<network.buildit.generated.schemas.LocationClass>(it).address
            } catch (e: Exception) {
                null
            }
        }

        return WidgetEvent(
            id = id,
            title = title,
            startAt = startAt,
            location = locationText,
            formattedDate = dateFormat.format(startDate),
            formattedTime = timeFormat.format(startDate)
        )
    }

    /**
     * Triggers update of all widgets.
     * Call this when data changes that should be reflected in widgets.
     */
    fun triggerWidgetUpdates() {
        scope.launch {
            try {
                UnreadMessagesWidget().updateAll(context)
                UpcomingEventsWidget().updateAll(context)
            } catch (e: Exception) {
                // Widget might not be placed, ignore errors
            }
        }
    }

    /**
     * Triggers update of the unread messages widget only.
     */
    fun triggerUnreadMessagesWidgetUpdate() {
        scope.launch {
            try {
                UnreadMessagesWidget().updateAll(context)
            } catch (e: Exception) {
                // Widget might not be placed, ignore errors
            }
        }
    }

    /**
     * Triggers update of the upcoming events widget only.
     */
    fun triggerEventsWidgetUpdate() {
        scope.launch {
            try {
                UpcomingEventsWidget().updateAll(context)
            } catch (e: Exception) {
                // Widget might not be placed, ignore errors
            }
        }
    }

    private fun truncateContent(content: String, maxLength: Int = 50): String {
        return if (content.length > maxLength) {
            content.take(maxLength - 3) + "..."
        } else {
            content
        }
    }
}
