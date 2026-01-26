package network.buildit.core.accessibility

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// MARK: - Accessibility Announcements

/**
 * Announces a message to TalkBack users.
 *
 * @param context The Android context
 * @param message The message to announce
 */
fun announceForAccessibility(context: Context, message: String) {
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    if (accessibilityManager?.isEnabled == true) {
        val event = AccessibilityEvent.obtain().apply {
            eventType = AccessibilityEvent.TYPE_ANNOUNCEMENT
            className = context.javaClass.name
            packageName = context.packageName
            text.add(message)
        }
        accessibilityManager.sendAccessibilityEvent(event)
    }
}

/**
 * Checks if TalkBack or similar accessibility services are enabled.
 */
fun isAccessibilityEnabled(context: Context): Boolean {
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    return accessibilityManager?.isEnabled == true
}

/**
 * Checks if touch exploration (TalkBack) is enabled.
 */
fun isTalkBackEnabled(context: Context): Boolean {
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    return accessibilityManager?.isTouchExplorationEnabled == true
}

// MARK: - Composable Modifiers

/**
 * Makes an element a semantic heading for screen reader navigation.
 *
 * @param description The heading content description
 * @return Modifier with heading semantics
 */
fun Modifier.accessibilityHeading(description: String): Modifier = this.semantics {
    heading()
    contentDescription = description
}

/**
 * Marks an element as decorative (hidden from accessibility).
 *
 * @return Modifier that hides the element from screen readers
 */
fun Modifier.decorative(): Modifier = this.clearAndSetSemantics { }

/**
 * Adds standard button semantics with content description.
 *
 * @param label The accessibility label
 * @param hint Optional hint describing the action
 * @return Modifier with button semantics
 */
fun Modifier.accessibleButton(
    label: String,
    hint: String? = null
): Modifier = this.semantics {
    contentDescription = if (hint != null) "$label. $hint" else label
    role = Role.Button
}

/**
 * Adds toggle/switch semantics with state description.
 *
 * @param label The accessibility label for the toggle
 * @param isChecked The current toggle state
 * @param hint Optional hint
 * @return Modifier with toggle semantics
 */
fun Modifier.accessibleToggle(
    label: String,
    isChecked: Boolean,
    hint: String? = null
): Modifier = this.semantics {
    contentDescription = label
    stateDescription = if (isChecked) "On" else "Off"
    role = Role.Switch
    if (hint != null) {
        this.contentDescription = "$label. $hint"
    }
}

/**
 * Adds image semantics with content description.
 *
 * @param description The image description
 * @return Modifier with image semantics
 */
fun Modifier.accessibleImage(description: String): Modifier = this.semantics {
    contentDescription = description
    role = Role.Image
}

/**
 * Groups children into a single accessibility element with combined description.
 *
 * @param description The combined description for the group
 * @return Modifier that groups children
 */
fun Modifier.accessibilityGroup(description: String): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = description
}

/**
 * Ensures minimum touch target size (48dp per Material guidelines).
 *
 * @param minSize The minimum size in dp (default 48dp)
 * @return Modifier with minimum size constraint
 */
fun Modifier.minimumTouchTarget(minSize: Int = 48): Modifier = this.defaultMinSize(
    minWidth = minSize.dp,
    minHeight = minSize.dp
)

/**
 * Adds test tag and content description together.
 *
 * @param tag The test tag for UI testing
 * @param description The accessibility content description
 * @return Modifier with both test tag and content description
 */
fun Modifier.accessibilityId(tag: String, description: String): Modifier = this.semantics {
    testTag = tag
    contentDescription = description
}

// MARK: - Composable Utilities

/**
 * Wrapper that ensures minimum touch target size for accessibility.
 */
@Composable
fun MinimumTouchTarget(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    minSize: Int = 48,
    contentDescription: String? = null,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = minSize.dp, minHeight = minSize.dp)
            .clickable(
                onClick = onClick,
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            )
            .then(
                if (contentDescription != null) {
                    Modifier.semantics { this.contentDescription = contentDescription }
                } else {
                    Modifier
                }
            ),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

/**
 * Announces a message to TalkBack when composed.
 *
 * @param message The message to announce
 * @param key A key to trigger re-announcement (changes to this will re-announce)
 */
@Composable
fun AnnounceEffect(message: String, key: Any? = null) {
    val context = LocalContext.current
    LaunchedEffect(key ?: message) {
        announceForAccessibility(context, message)
    }
}

/**
 * Requests focus for accessibility services when composed.
 */
@Composable
fun RequestAccessibilityFocus(modifier: Modifier = Modifier) {
    val view = LocalView.current
    LaunchedEffect(Unit) {
        view.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
    }
}

// MARK: - Message Bubble Accessibility

/**
 * Creates accessibility description for a chat message bubble.
 *
 * @param content The message content
 * @param senderName The sender's name (null for sent messages)
 * @param timestamp The message timestamp
 * @param isSent Whether this message was sent by the current user
 * @param status The delivery status
 * @return The accessibility description string
 */
fun messageAccessibilityDescription(
    content: String,
    senderName: String?,
    timestamp: Long,
    isSent: Boolean,
    status: String
): String {
    val timeString = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(timestamp))

    return buildString {
        if (isSent) {
            append("You said: ")
        } else if (senderName != null) {
            append("$senderName said: ")
        } else {
            append("Message: ")
        }
        append(content)
        append(". Sent at $timeString")
        if (isSent) {
            append(". Status: $status")
        }
    }
}

/**
 * Modifier for chat message bubble accessibility.
 */
fun Modifier.messageBubbleSemantics(
    content: String,
    senderName: String?,
    timestamp: Long,
    isSent: Boolean,
    status: String
): Modifier = this.semantics {
    contentDescription = messageAccessibilityDescription(
        content = content,
        senderName = senderName,
        timestamp = timestamp,
        isSent = isSent,
        status = status
    )
}

// MARK: - Conversation Row Accessibility

/**
 * Creates accessibility description for a conversation list row.
 *
 * @param participantName The other participant's name
 * @param lastMessage The last message preview
 * @param unreadCount Number of unread messages
 * @param timestamp The last message timestamp
 * @return The accessibility description string
 */
fun conversationAccessibilityDescription(
    participantName: String,
    lastMessage: String?,
    unreadCount: Int,
    timestamp: Long?
): String {
    return buildString {
        append("Conversation with $participantName")
        if (unreadCount > 0) {
            append(". $unreadCount unread ${if (unreadCount == 1) "message" else "messages"}")
        }
        if (lastMessage != null) {
            val truncated = if (lastMessage.length > 50) {
                lastMessage.take(50) + "..."
            } else {
                lastMessage
            }
            append(". Last message: $truncated")
        }
        if (timestamp != null) {
            append(". ${formatRelativeTime(timestamp)}")
        }
    }
}

/**
 * Modifier for conversation row accessibility.
 */
fun Modifier.conversationRowSemantics(
    participantName: String,
    lastMessage: String?,
    unreadCount: Int,
    timestamp: Long?
): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = conversationAccessibilityDescription(
        participantName = participantName,
        lastMessage = lastMessage,
        unreadCount = unreadCount,
        timestamp = timestamp
    )
    role = Role.Button
    onClick(label = "Open conversation") { true }
}

// MARK: - Status Indicator Accessibility

/**
 * Modifier for status indicators (online/offline, connected/disconnected).
 *
 * @param status The current status
 * @param context The context (e.g., "Bluetooth", "Network")
 * @return Modifier with status semantics
 */
fun Modifier.statusIndicatorSemantics(
    status: String,
    context: String
): Modifier = this.semantics {
    contentDescription = "$context: $status"
    role = Role.Image
}

// MARK: - Haptic Feedback

/**
 * Provides haptic feedback for various actions.
 */
object HapticFeedback {
    fun success(context: Context) {
        vibrate(context, longArrayOf(0, 50, 50, 50))
    }

    fun error(context: Context) {
        vibrate(context, longArrayOf(0, 100, 50, 100))
    }

    fun warning(context: Context) {
        vibrate(context, longArrayOf(0, 75))
    }

    fun light(context: Context) {
        vibrate(context, longArrayOf(0, 10))
    }

    fun medium(context: Context) {
        vibrate(context, longArrayOf(0, 25))
    }

    fun heavy(context: Context) {
        vibrate(context, longArrayOf(0, 50))
    }

    fun selection(context: Context) {
        vibrate(context, longArrayOf(0, 5))
    }

    private fun vibrate(context: Context, pattern: LongArray) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createWaveform(pattern, -1)
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }
    }
}

// MARK: - Helper Functions

/**
 * Formats a timestamp as relative time for accessibility.
 */
private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / (60 * 1000)
    val hours = diff / (60 * 60 * 1000)
    val days = diff / (24 * 60 * 60 * 1000)

    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "$minutes ${if (minutes == 1L) "minute" else "minutes"} ago"
        hours < 24 -> "$hours ${if (hours == 1L) "hour" else "hours"} ago"
        days < 7 -> "$days ${if (days == 1L) "day" else "days"} ago"
        else -> SimpleDateFormat("MMMM d", Locale.getDefault()).format(Date(timestamp))
    }
}

// MARK: - Accessibility Strings

/**
 * Standard accessibility strings for common UI elements.
 */
object AccessibilityStrings {
    // Navigation
    const val BACK_BUTTON = "Go back"
    const val CLOSE_BUTTON = "Close"
    const val MENU_BUTTON = "Open menu"
    const val SEARCH_BUTTON = "Search"
    const val SETTINGS_BUTTON = "Settings"

    // Chat
    const val SEND_MESSAGE = "Send message"
    const val ATTACH_FILE = "Attach file"
    const val NEW_CHAT = "Start new conversation"
    const val MESSAGE_INPUT = "Message input field"

    // Groups
    const val CREATE_GROUP = "Create new group"
    const val JOIN_GROUP = "Join group"
    const val LEAVE_GROUP = "Leave group"
    const val GROUP_INFO = "View group information"

    // Status
    const val ONLINE_STATUS = "Online"
    const val OFFLINE_STATUS = "Offline"
    const val CONNECTING_STATUS = "Connecting"
    const val SYNCING_STATUS = "Syncing"

    // Actions
    const val COPY_TO_CLIPBOARD = "Copy to clipboard"
    const val SHARE = "Share"
    const val DELETE = "Delete"
    const val EDIT = "Edit"
    const val REFRESH = "Refresh"

    // Device Sync
    const val SHOW_QR_CODE = "Show QR code for device linking"
    const val SCAN_QR_CODE = "Scan QR code to link device"
    const val SYNC_NOW = "Sync now"
    const val UNLINK_DEVICE = "Unlink device"
}
