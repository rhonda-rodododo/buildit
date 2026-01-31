package network.buildit.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import network.buildit.MainActivity
import network.buildit.R

/**
 * Home screen widget displaying unread message count and recent message previews.
 * Uses Jetpack Glance for Compose-based widget UI.
 */
class UnreadMessagesWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(
        setOf(
            androidx.compose.ui.unit.DpSize(100.dp, 100.dp),
            androidx.compose.ui.unit.DpSize(200.dp, 100.dp),
            androidx.compose.ui.unit.DpSize(300.dp, 200.dp)
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Load data before providing content
        val state = try {
            withContext(Dispatchers.IO) {
                WidgetDataProviderLocator.getProvider(context).getUnreadMessagesState()
            }
        } catch (e: Exception) {
            UnreadMessagesState(unreadCount = 0, recentMessages = emptyList())
        }

        provideContent {
            GlanceTheme {
                UnreadMessagesContent(state = state)
            }
        }
    }

    @Composable
    private fun UnreadMessagesContent(state: UnreadMessagesState) {
        val context = LocalContext.current

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(GlanceTheme.colors.surface)
                .cornerRadius(16.dp)
                .padding(12.dp)
                .clickable(actionStartActivity<MainActivity>()),
            verticalAlignment = Alignment.Top,
            horizontalAlignment = Alignment.Start
        ) {
            // Header with icon and count
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    provider = ImageProvider(R.drawable.ic_launcher_foreground),
                    contentDescription = "Messages",
                    modifier = GlanceModifier.size(24.dp)
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                Text(
                    text = "Messages",
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GlanceTheme.colors.onSurface
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                UnreadBadge(count = state.unreadCount)
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Recent messages or empty state
            if (state.recentMessages.isEmpty()) {
                Box(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .defaultWeight(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (state.unreadCount == 0) "No new messages" else "Tap to view messages",
                        style = TextStyle(
                            fontSize = 14.sp,
                            color = GlanceTheme.colors.onSurfaceVariant
                        )
                    )
                }
            } else {
                Column(
                    modifier = GlanceModifier.fillMaxWidth()
                ) {
                    state.recentMessages.take(3).forEach { message ->
                        MessagePreviewItem(message = message)
                        Spacer(modifier = GlanceModifier.height(4.dp))
                    }
                }
            }
        }
    }

    @Composable
    private fun UnreadBadge(count: Int) {
        if (count > 0) {
            Box(
                modifier = GlanceModifier
                    .background(GlanceTheme.colors.primary)
                    .cornerRadius(12.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (count > 99) "99+" else count.toString(),
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = GlanceTheme.colors.onPrimary
                    )
                )
            }
        }
    }

    @Composable
    private fun MessagePreviewItem(message: WidgetMessage) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .background(GlanceTheme.colors.surfaceVariant)
                .cornerRadius(8.dp)
                .padding(8.dp)
                .clickable(
                    actionStartActivity<MainActivity>(
                        actionParametersOf(
                            ActionParameters.Key<String>("conversationId") to message.conversationId
                        )
                    )
                ),
            verticalAlignment = Alignment.Top
        ) {
            Column(
                modifier = GlanceModifier.defaultWeight()
            ) {
                Text(
                    text = message.senderName,
                    style = TextStyle(
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp,
                        color = GlanceTheme.colors.onSurface
                    ),
                    maxLines = 1
                )
                Spacer(modifier = GlanceModifier.height(2.dp))
                Text(
                    text = message.content,
                    style = TextStyle(
                        fontSize = 12.sp,
                        color = GlanceTheme.colors.onSurfaceVariant
                    ),
                    maxLines = 1
                )
            }
        }
    }
}

/**
 * Receiver for the UnreadMessagesWidget.
 * Handles widget lifecycle events from the system.
 */
class UnreadMessagesWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UnreadMessagesWidget()
}

/**
 * Helper object to locate the WidgetDataProvider from widget context.
 * Since widgets run in a limited context, we need a way to access the provider.
 */
object WidgetDataProviderLocator {
    private var provider: WidgetDataProvider? = null

    fun setProvider(provider: WidgetDataProvider) {
        this.provider = provider
    }

    fun getProvider(context: Context): WidgetDataProvider {
        return provider ?: run {
            // Fallback: create a temporary provider for widget-only access
            // This happens when the app isn't running and widget needs data
            val app = context.applicationContext as? network.buildit.BuildItApp
            app?.widgetDataProvider ?: throw IllegalStateException(
                "WidgetDataProvider not initialized. App must be running."
            )
        }
    }
}
