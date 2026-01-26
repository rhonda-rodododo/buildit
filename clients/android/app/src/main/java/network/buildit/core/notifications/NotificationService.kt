package network.buildit.core.notifications

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.MainActivity
import network.buildit.R
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service for creating and managing notifications.
 *
 * Provides Material3-styled notifications with:
 * - Proper channel assignment
 * - Action buttons with intents
 * - Notification grouping
 * - Reply actions with RemoteInput
 * - Read/dismiss actions
 */
@Singleton
class NotificationService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val notificationChannels: NotificationChannels
) {
    private val notificationManager = NotificationManagerCompat.from(context)

    private val _permissionGranted = MutableStateFlow(checkNotificationPermission())
    val permissionGranted: StateFlow<Boolean> = _permissionGranted.asStateFlow()

    companion object {
        // Notification IDs
        private const val NOTIFICATION_ID_BASE_MESSAGES = 1000
        private const val NOTIFICATION_ID_BASE_EVENTS = 2000
        private const val NOTIFICATION_ID_BASE_GOVERNANCE = 3000
        private const val NOTIFICATION_ID_BASE_MUTUAL_AID = 4000
        private const val NOTIFICATION_ID_BASE_NEWSLETTERS = 5000
        private const val NOTIFICATION_ID_SYNC = 6000
        private const val NOTIFICATION_ID_SUMMARY_MESSAGES = 999

        // RemoteInput key for reply action
        const val KEY_REPLY_TEXT = "key_reply_text"

        // Intent extras
        const val EXTRA_NOTIFICATION_ID = "notification_id"
        const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val EXTRA_MESSAGE_ID = "message_id"
        const val EXTRA_EVENT_ID = "event_id"
        const val EXTRA_PROPOSAL_ID = "proposal_id"
        const val EXTRA_REQUEST_ID = "request_id"

        // Request codes for PendingIntents
        private const val REQUEST_CONTENT = 0
        private const val REQUEST_REPLY = 1
        private const val REQUEST_MARK_READ = 2
        private const val REQUEST_DISMISS = 3
    }

    /**
     * Checks if notification permission is granted.
     * Returns true for Android < 13 or if permission is granted.
     */
    fun checkNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Updates the permission state.
     * Call this after requesting permission.
     */
    fun updatePermissionState() {
        _permissionGranted.value = checkNotificationPermission()
    }

    /**
     * Shows a direct message notification with reply action.
     */
    fun showMessageNotification(
        conversationId: String,
        messageId: String,
        senderName: String,
        senderPubkey: String,
        content: String,
        timestamp: Long,
        senderAvatar: Bitmap? = null,
        isGroupMessage: Boolean = false,
        groupName: String? = null
    ) {
        if (!canShowNotification()) return

        val notificationId = (conversationId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_MESSAGES

        // Build the person for messaging style
        val sender = Person.Builder()
            .setName(senderName)
            .setKey(senderPubkey)
            .apply {
                senderAvatar?.let { setIcon(IconCompat.createWithBitmap(it)) }
            }
            .build()

        // Create messaging style notification
        val messagingStyle = NotificationCompat.MessagingStyle(sender)
            .setConversationTitle(if (isGroupMessage) groupName else null)
            .addMessage(content, timestamp, sender)

        // Content intent - opens the conversation
        val contentIntent = createContentIntent(conversationId, notificationId)

        // Reply action with RemoteInput
        val replyAction = createReplyAction(conversationId, messageId, notificationId)

        // Mark as read action
        val markReadAction = createMarkReadAction(conversationId, messageId, notificationId)

        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification_message)
            .setStyle(messagingStyle)
            .setContentIntent(contentIntent)
            .addAction(replyAction)
            .addAction(markReadAction)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup(NotificationChannels.GROUP_MESSAGES)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        notificationManager.notify(notificationId, notification)

        // Show group summary
        showMessagesSummary()
    }

    /**
     * Shows a summary notification for grouped messages.
     */
    private fun showMessagesSummary() {
        val summaryNotification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification_message)
            .setContentTitle(context.getString(R.string.notification_messages_summary_title))
            .setContentText(context.getString(R.string.notification_messages_summary_text))
            .setGroup(NotificationChannels.GROUP_MESSAGES)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_ID_SUMMARY_MESSAGES, summaryNotification)
    }

    /**
     * Shows an event notification.
     */
    fun showEventNotification(
        eventId: String,
        title: String,
        description: String,
        eventTime: String,
        location: String? = null
    ) {
        if (!canShowNotification()) return

        val notificationId = (eventId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_EVENTS

        val contentText = buildString {
            append(eventTime)
            location?.let {
                append(" - ")
                append(it)
            }
        }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .bigText(description)
            .setSummaryText(contentText)

        val contentIntent = createEventContentIntent(eventId, notificationId)

        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_EVENTS)
            .setSmallIcon(R.drawable.ic_notification_event)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(bigTextStyle)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setGroup(NotificationChannels.GROUP_EVENTS)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    /**
     * Shows a governance notification for votes/proposals.
     */
    fun showGovernanceNotification(
        proposalId: String,
        title: String,
        description: String,
        deadline: String? = null,
        proposalType: GovernanceNotificationType = GovernanceNotificationType.NEW_PROPOSAL
    ) {
        if (!canShowNotification()) return

        val notificationId = (proposalId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_GOVERNANCE

        val contentText = when (proposalType) {
            GovernanceNotificationType.NEW_PROPOSAL ->
                context.getString(R.string.notification_governance_new_proposal)
            GovernanceNotificationType.VOTE_REMINDER ->
                context.getString(R.string.notification_governance_vote_reminder, deadline ?: "")
            GovernanceNotificationType.RESULT ->
                context.getString(R.string.notification_governance_result)
        }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .bigText(description)
            .setSummaryText(contentText)

        val contentIntent = createGovernanceContentIntent(proposalId, notificationId)

        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_GOVERNANCE)
            .setSmallIcon(R.drawable.ic_notification_governance)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(bigTextStyle)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setGroup(NotificationChannels.GROUP_GOVERNANCE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    /**
     * Shows a mutual aid notification.
     */
    fun showMutualAidNotification(
        requestId: String,
        title: String,
        description: String,
        requestType: MutualAidNotificationType,
        isUrgent: Boolean = false
    ) {
        if (!canShowNotification()) return

        val notificationId = (requestId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_MUTUAL_AID

        val icon = when (requestType) {
            MutualAidNotificationType.REQUEST -> R.drawable.ic_notification_mutual_aid_request
            MutualAidNotificationType.OFFER -> R.drawable.ic_notification_mutual_aid_offer
            MutualAidNotificationType.MATCH -> R.drawable.ic_notification_mutual_aid_match
        }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .bigText(description)

        val contentIntent = createMutualAidContentIntent(requestId, notificationId)

        val builder = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MUTUAL_AID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(description)
            .setStyle(bigTextStyle)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setGroup(NotificationChannels.GROUP_MUTUAL_AID)
            .setPriority(
                if (isUrgent) NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )

        if (isUrgent) {
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
        }

        notificationManager.notify(notificationId, builder.build())
    }

    /**
     * Shows a newsletter notification.
     */
    fun showNewsletterNotification(
        newsletterId: String,
        title: String,
        preview: String,
        publisherName: String
    ) {
        if (!canShowNotification()) return

        val notificationId = (newsletterId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_NEWSLETTERS

        val inboxStyle = NotificationCompat.InboxStyle()
            .setBigContentTitle(title)
            .setSummaryText(context.getString(R.string.notification_newsletter_from, publisherName))
            .addLine(preview)

        val contentIntent = createNewsletterContentIntent(newsletterId, notificationId)

        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_NEWSLETTERS)
            .setSmallIcon(R.drawable.ic_notification_newsletter)
            .setContentTitle(title)
            .setContentText(context.getString(R.string.notification_newsletter_from, publisherName))
            .setStyle(inboxStyle)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setGroup(NotificationChannels.GROUP_NEWSLETTERS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    /**
     * Shows a sync progress notification.
     */
    fun showSyncProgressNotification(current: Int, total: Int) {
        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_BACKGROUND_SYNC)
            .setSmallIcon(R.drawable.ic_notification_sync)
            .setContentTitle(context.getString(R.string.notification_sync_title))
            .setContentText(context.getString(R.string.notification_sync_progress, current, total))
            .setProgress(total, current, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        notificationManager.notify(NOTIFICATION_ID_SYNC, notification)
    }

    /**
     * Hides the sync progress notification.
     */
    fun hideSyncProgressNotification() {
        notificationManager.cancel(NOTIFICATION_ID_SYNC)
    }

    /**
     * Cancels a specific notification.
     */
    fun cancelNotification(notificationId: Int) {
        notificationManager.cancel(notificationId)
    }

    /**
     * Cancels all notifications for a conversation.
     */
    fun cancelConversationNotifications(conversationId: String) {
        val notificationId = (conversationId.hashCode() and 0xFFFFF) + NOTIFICATION_ID_BASE_MESSAGES
        notificationManager.cancel(notificationId)
    }

    /**
     * Cancels all notifications.
     */
    fun cancelAllNotifications() {
        notificationManager.cancelAll()
    }

    private fun canShowNotification(): Boolean {
        return checkNotificationPermission() && notificationManager.areNotificationsEnabled()
    }

    private fun createContentIntent(conversationId: String, notificationId: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_CONVERSATION_ID, conversationId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        return PendingIntent.getActivity(
            context,
            notificationId + REQUEST_CONTENT,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createReplyAction(
        conversationId: String,
        messageId: String,
        notificationId: Int
    ): NotificationCompat.Action {
        val remoteInput = RemoteInput.Builder(KEY_REPLY_TEXT)
            .setLabel(context.getString(R.string.notification_action_reply_hint))
            .build()

        val replyIntent = Intent(context, NotificationReceiver::class.java).apply {
            action = NotificationReceiver.ACTION_REPLY
            putExtra(EXTRA_CONVERSATION_ID, conversationId)
            putExtra(EXTRA_MESSAGE_ID, messageId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        val replyPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + REQUEST_REPLY,
            replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        return NotificationCompat.Action.Builder(
            R.drawable.ic_notification_reply,
            context.getString(R.string.notification_action_reply),
            replyPendingIntent
        )
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .build()
    }

    private fun createMarkReadAction(
        conversationId: String,
        messageId: String,
        notificationId: Int
    ): NotificationCompat.Action {
        val markReadIntent = Intent(context, NotificationReceiver::class.java).apply {
            action = NotificationReceiver.ACTION_MARK_READ
            putExtra(EXTRA_CONVERSATION_ID, conversationId)
            putExtra(EXTRA_MESSAGE_ID, messageId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        val markReadPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + REQUEST_MARK_READ,
            markReadIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Action.Builder(
            R.drawable.ic_notification_mark_read,
            context.getString(R.string.notification_action_mark_read),
            markReadPendingIntent
        ).build()
    }

    private fun createEventContentIntent(eventId: String, notificationId: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_EVENT_ID, eventId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        return PendingIntent.getActivity(
            context,
            notificationId + REQUEST_CONTENT,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createGovernanceContentIntent(proposalId: String, notificationId: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_PROPOSAL_ID, proposalId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        return PendingIntent.getActivity(
            context,
            notificationId + REQUEST_CONTENT,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createMutualAidContentIntent(requestId: String, notificationId: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_REQUEST_ID, requestId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        return PendingIntent.getActivity(
            context,
            notificationId + REQUEST_CONTENT,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createNewsletterContentIntent(newsletterId: String, notificationId: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("newsletter_id", newsletterId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        return PendingIntent.getActivity(
            context,
            notificationId + REQUEST_CONTENT,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

/**
 * Types of governance notifications.
 */
enum class GovernanceNotificationType {
    NEW_PROPOSAL,
    VOTE_REMINDER,
    RESULT
}

/**
 * Types of mutual aid notifications.
 */
enum class MutualAidNotificationType {
    REQUEST,
    OFFER,
    MATCH
}
