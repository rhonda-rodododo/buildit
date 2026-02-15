package network.buildit.core.notifications

import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import network.buildit.R
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.messaging.data.MessagingRepository
import javax.inject.Inject

/**
 * BroadcastReceiver for handling notification actions.
 *
 * Handles:
 * - Reply action with RemoteInput
 * - Mark as read action
 * - Dismiss action
 */
@AndroidEntryPoint
class NotificationReceiver : BroadcastReceiver() {

    @Inject
    lateinit var nostrClient: NostrClient

    @Inject
    lateinit var messagingRepository: MessagingRepository

    @Inject
    lateinit var notificationService: NotificationService

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        const val ACTION_REPLY = "network.buildit.action.REPLY"
        const val ACTION_MARK_READ = "network.buildit.action.MARK_READ"
        const val ACTION_DISMISS = "network.buildit.action.DISMISS"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val conversationId = intent.getStringExtra(NotificationService.EXTRA_CONVERSATION_ID) ?: return
        val messageId = intent.getStringExtra(NotificationService.EXTRA_MESSAGE_ID)
        val notificationId = intent.getIntExtra(NotificationService.EXTRA_NOTIFICATION_ID, -1)

        when (intent.action) {
            ACTION_REPLY -> handleReplyAction(context, intent, conversationId, notificationId)
            ACTION_MARK_READ -> handleMarkReadAction(context, conversationId, messageId, notificationId)
            ACTION_DISMISS -> handleDismissAction(context, notificationId)
        }
    }

    /**
     * Handles the reply action from notification.
     * Extracts the reply text from RemoteInput and sends the message.
     */
    private fun handleReplyAction(
        context: Context,
        intent: Intent,
        conversationId: String,
        notificationId: Int
    ) {
        val remoteInput = RemoteInput.getResultsFromIntent(intent)
        val replyText = remoteInput?.getCharSequence(NotificationService.KEY_REPLY_TEXT)?.toString()

        if (replyText.isNullOrBlank()) {
            return
        }

        // Show "sending" notification immediately
        showSendingNotification(context, notificationId)

        scope.launch {
            try {
                // Extract recipient pubkey from conversation ID
                // Conversation IDs are typically in format: dm_<pubkey> or group_<groupId>
                val recipientPubkey = extractRecipientFromConversationId(conversationId)

                if (recipientPubkey != null) {
                    // Send the direct message
                    val success = nostrClient.sendDirectMessage(recipientPubkey, replyText)

                    if (success) {
                        // Update notification to show sent
                        showSentNotification(context, notificationId)
                    } else {
                        // Show error notification
                        showSendFailedNotification(context, notificationId, replyText)
                    }
                } else {
                    // Could be a group message - handle differently
                    // For now, show error
                    showSendFailedNotification(context, notificationId, replyText)
                }
            } catch (e: Exception) {
                showSendFailedNotification(context, notificationId, replyText)
            }
        }
    }

    /**
     * Handles the mark as read action.
     * Sends a read receipt and dismisses the notification.
     */
    private fun handleMarkReadAction(
        context: Context,
        conversationId: String,
        messageId: String?,
        notificationId: Int
    ) {
        scope.launch {
            try {
                messageId?.let { id ->
                    val recipientPubkey = extractRecipientFromConversationId(conversationId)
                    if (recipientPubkey != null) {
                        // Send read receipt
                        nostrClient.sendReadReceipt(id, recipientPubkey)
                    }
                }

                // Cancel the notification
                val notificationManager = NotificationManagerCompat.from(context)
                notificationManager.cancel(notificationId)
            } catch (e: Exception) {
                // Still cancel notification even if read receipt fails
                val notificationManager = NotificationManagerCompat.from(context)
                notificationManager.cancel(notificationId)
            }
        }
    }

    /**
     * Handles the dismiss action.
     * Simply cancels the notification.
     */
    private fun handleDismissAction(context: Context, notificationId: Int) {
        if (notificationId != -1) {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.cancel(notificationId)
        }
    }

    /**
     * Shows a notification indicating the message is being sent.
     */
    @SuppressLint("MissingPermission")
    private fun showSendingNotification(context: Context, notificationId: Int) {
        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification_message)
            .setContentTitle(context.getString(R.string.notification_sending_title))
            .setContentText(context.getString(R.string.notification_sending_text))
            .setProgress(0, 0, true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    /**
     * Shows a notification indicating the message was sent.
     */
    @SuppressLint("MissingPermission")
    private fun showSentNotification(context: Context, notificationId: Int) {
        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification_message)
            .setContentTitle(context.getString(R.string.notification_sent_title))
            .setContentText(context.getString(R.string.notification_sent_text))
            .setAutoCancel(true)
            .setTimeoutAfter(3000) // Auto-dismiss after 3 seconds
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    /**
     * Shows a notification indicating send failed with retry option.
     */
    @SuppressLint("MissingPermission")
    private fun showSendFailedNotification(
        context: Context,
        notificationId: Int,
        failedMessage: String
    ) {
        val notification = NotificationCompat.Builder(context, NotificationChannels.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification_error)
            .setContentTitle(context.getString(R.string.notification_send_failed_title))
            .setContentText(context.getString(R.string.notification_send_failed_text))
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(context.getString(R.string.notification_send_failed_detail, failedMessage))
            )
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    /**
     * Extracts the recipient pubkey from a conversation ID.
     * Returns null if this is not a DM conversation.
     */
    private fun extractRecipientFromConversationId(conversationId: String): String? {
        return when {
            conversationId.startsWith("dm_") -> conversationId.removePrefix("dm_")
            conversationId.length == 64 -> conversationId // Assume it's a raw pubkey
            else -> null // Likely a group conversation
        }
    }
}
