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
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import network.buildit.MainActivity
import network.buildit.R

/**
 * Quick action data class for widget actions.
 */
data class QuickAction(
    val id: String,
    val label: String,
    val iconRes: Int,
    val destination: String,
    val params: Map<String, String> = emptyMap()
)

/**
 * Home screen widget providing quick action buttons.
 * Allows users to quickly access common features like new message, scan QR, etc.
 * Uses Jetpack Glance for Compose-based widget UI.
 */
class QuickActionsWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(
        setOf(
            androidx.glance.appwidget.DpSize(100.dp, 100.dp),
            androidx.glance.appwidget.DpSize(200.dp, 100.dp),
            androidx.glance.appwidget.DpSize(300.dp, 100.dp)
        )
    )

    private val quickActions = listOf(
        QuickAction(
            id = "new_message",
            label = "New Message",
            iconRes = R.drawable.ic_launcher_foreground, // Would use ic_message_new
            destination = "contact_picker"
        ),
        QuickAction(
            id = "scan_qr",
            label = "Scan QR",
            iconRes = R.drawable.ic_launcher_foreground, // Would use ic_qr_scan
            destination = "qr_scanner"
        ),
        QuickAction(
            id = "new_event",
            label = "New Event",
            iconRes = R.drawable.ic_launcher_foreground, // Would use ic_event_add
            destination = "create_event"
        ),
        QuickAction(
            id = "groups",
            label = "Groups",
            iconRes = R.drawable.ic_launcher_foreground, // Would use ic_groups
            destination = "groups"
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            GlanceTheme {
                QuickActionsContent()
            }
        }
    }

    @Composable
    private fun QuickActionsContent() {
        val context = LocalContext.current

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(GlanceTheme.colors.surface)
                .cornerRadius(16.dp)
                .padding(12.dp),
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
                    contentDescription = "BuildIt",
                    modifier = GlanceModifier.size(24.dp)
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                Text(
                    text = "Quick Actions",
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GlanceTheme.colors.onSurface
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(12.dp))

            // Action buttons grid (2x2)
            Column(
                modifier = GlanceModifier.fillMaxWidth()
            ) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    QuickActionButton(
                        action = quickActions[0],
                        modifier = GlanceModifier.defaultWeight()
                    )
                    Spacer(modifier = GlanceModifier.width(8.dp))
                    QuickActionButton(
                        action = quickActions[1],
                        modifier = GlanceModifier.defaultWeight()
                    )
                }
                Spacer(modifier = GlanceModifier.height(8.dp))
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    QuickActionButton(
                        action = quickActions[2],
                        modifier = GlanceModifier.defaultWeight()
                    )
                    Spacer(modifier = GlanceModifier.width(8.dp))
                    QuickActionButton(
                        action = quickActions[3],
                        modifier = GlanceModifier.defaultWeight()
                    )
                }
            }
        }
    }

    @Composable
    private fun QuickActionButton(
        action: QuickAction,
        modifier: GlanceModifier = GlanceModifier
    ) {
        val actionParams = buildList {
            add(ActionParameters.Key<String>("destination") to action.destination)
            action.params.forEach { (key, value) ->
                add(ActionParameters.Key<String>(key) to value)
            }
        }.let { pairs ->
            if (pairs.isEmpty()) {
                actionParametersOf()
            } else {
                actionParametersOf(*pairs.toTypedArray())
            }
        }

        Column(
            modifier = modifier
                .background(GlanceTheme.colors.primaryContainer)
                .cornerRadius(12.dp)
                .padding(12.dp)
                .clickable(actionStartActivity<MainActivity>(actionParams)),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                provider = ImageProvider(action.iconRes),
                contentDescription = action.label,
                modifier = GlanceModifier.size(28.dp)
            )
            Spacer(modifier = GlanceModifier.height(4.dp))
            Text(
                text = action.label,
                style = TextStyle(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = GlanceTheme.colors.onPrimaryContainer,
                    textAlign = TextAlign.Center
                ),
                maxLines = 1
            )
        }
    }
}

/**
 * Receiver for the QuickActionsWidget.
 * Handles widget lifecycle events from the system.
 */
class QuickActionsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QuickActionsWidget()
}
