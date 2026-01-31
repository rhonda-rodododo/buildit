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
 * Home screen widget displaying upcoming events.
 * Shows the next 3 events with title, date, and location.
 * Uses Jetpack Glance for Compose-based widget UI.
 */
class UpcomingEventsWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(
        setOf(
            androidx.compose.ui.unit.DpSize(150.dp, 100.dp),
            androidx.compose.ui.unit.DpSize(250.dp, 150.dp),
            androidx.compose.ui.unit.DpSize(350.dp, 200.dp)
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Load data before providing content
        val state = try {
            withContext(Dispatchers.IO) {
                WidgetDataProviderLocator.getProvider(context).getUpcomingEventsState()
            }
        } catch (e: Exception) {
            UpcomingEventsState(events = emptyList())
        }

        provideContent {
            GlanceTheme {
                UpcomingEventsContent(state = state)
            }
        }
    }

    @Composable
    private fun UpcomingEventsContent(state: UpcomingEventsState) {
        val context = LocalContext.current

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(GlanceTheme.colors.surface)
                .cornerRadius(16.dp)
                .padding(12.dp)
                .clickable(
                    actionStartActivity<MainActivity>(
                        actionParametersOf(
                            ActionParameters.Key<String>("destination") to "events"
                        )
                    )
                ),
            verticalAlignment = Alignment.Top,
            horizontalAlignment = Alignment.Start
        ) {
            // Header
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    provider = ImageProvider(R.drawable.ic_launcher_foreground),
                    contentDescription = "Events",
                    modifier = GlanceModifier.size(24.dp)
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                Text(
                    text = "Upcoming Events",
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GlanceTheme.colors.onSurface
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                EventCountBadge(count = state.events.size)
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Events list or empty state
            if (state.events.isEmpty()) {
                Box(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .defaultWeight(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No upcoming events",
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
                    state.events.take(3).forEach { event ->
                        EventItem(event = event)
                        Spacer(modifier = GlanceModifier.height(6.dp))
                    }
                }
            }
        }
    }

    @Composable
    private fun EventCountBadge(count: Int) {
        if (count > 0) {
            Box(
                modifier = GlanceModifier
                    .background(GlanceTheme.colors.secondary)
                    .cornerRadius(12.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = count.toString(),
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = GlanceTheme.colors.onSecondary
                    )
                )
            }
        }
    }

    @Composable
    private fun EventItem(event: WidgetEvent) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .background(GlanceTheme.colors.surfaceVariant)
                .cornerRadius(8.dp)
                .padding(8.dp)
                .clickable(
                    actionStartActivity<MainActivity>(
                        actionParametersOf(
                            ActionParameters.Key<String>("destination") to "event_detail",
                            ActionParameters.Key<String>("eventId") to event.id
                        )
                    )
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Date badge
            Column(
                modifier = GlanceModifier
                    .background(GlanceTheme.colors.primaryContainer)
                    .cornerRadius(6.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = event.formattedDate,
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = GlanceTheme.colors.onPrimaryContainer
                    )
                )
                Text(
                    text = event.formattedTime,
                    style = TextStyle(
                        fontSize = 10.sp,
                        color = GlanceTheme.colors.onPrimaryContainer
                    )
                )
            }

            Spacer(modifier = GlanceModifier.width(8.dp))

            // Event details
            Column(
                modifier = GlanceModifier.defaultWeight()
            ) {
                Text(
                    text = event.title,
                    style = TextStyle(
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp,
                        color = GlanceTheme.colors.onSurface
                    ),
                    maxLines = 1
                )
                if (event.location != null) {
                    Spacer(modifier = GlanceModifier.height(2.dp))
                    Text(
                        text = event.location,
                        style = TextStyle(
                            fontSize = 11.sp,
                            color = GlanceTheme.colors.onSurfaceVariant
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}

/**
 * Receiver for the UpcomingEventsWidget.
 * Handles widget lifecycle events from the system.
 */
class UpcomingEventsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UpcomingEventsWidget()
}
