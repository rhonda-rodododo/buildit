package network.buildit.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import dagger.hilt.android.qualifiers.ApplicationContext
import network.buildit.R
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Notification channels for BuildIt.
 *
 * Android 8.0+ (API 26) requires notification channels for all notifications.
 * Each channel has specific importance levels, sounds, and behaviors.
 */
@Singleton
class NotificationChannels @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        // Channel IDs
        const val CHANNEL_MESSAGES = "messages_channel"
        const val CHANNEL_EVENTS = "events_channel"
        const val CHANNEL_GOVERNANCE = "governance_channel"
        const val CHANNEL_MUTUAL_AID = "mutual_aid_channel"
        const val CHANNEL_NEWSLETTERS = "newsletters_channel"
        const val CHANNEL_BLE_SERVICE = "ble_service_channel"
        const val CHANNEL_DEVICE_SYNC = "device_sync_channel"
        const val CHANNEL_BACKGROUND_SYNC = "background_sync_channel"

        // Notification group keys
        const val GROUP_MESSAGES = "network.buildit.MESSAGES"
        const val GROUP_EVENTS = "network.buildit.EVENTS"
        const val GROUP_GOVERNANCE = "network.buildit.GOVERNANCE"
        const val GROUP_MUTUAL_AID = "network.buildit.MUTUAL_AID"
        const val GROUP_NEWSLETTERS = "network.buildit.NEWSLETTERS"
    }

    /**
     * Creates all notification channels.
     * Should be called during app initialization.
     */
    fun createAllChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(NotificationManager::class.java)

            val channels = listOf(
                createMessagesChannel(),
                createEventsChannel(),
                createGovernanceChannel(),
                createMutualAidChannel(),
                createNewslettersChannel(),
                createBleServiceChannel(),
                createDeviceSyncChannel(),
                createBackgroundSyncChannel()
            )

            notificationManager.createNotificationChannels(channels)
        }
    }

    /**
     * Messages channel - High importance with sound.
     * Used for direct messages and group chat notifications.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createMessagesChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_MESSAGES,
            context.getString(R.string.channel_messages_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.channel_messages_description)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 250, 250)
            enableLights(true)
            lightColor = 0xFF6200EE.toInt() // Material3 primary
            setShowBadge(true)
        }
    }

    /**
     * Events channel - Default importance.
     * Used for event reminders, updates, and RSVPs.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createEventsChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_EVENTS,
            context.getString(R.string.channel_events_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.channel_events_description)
            enableVibration(true)
            setShowBadge(true)
        }
    }

    /**
     * Governance channel - Default importance.
     * Used for voting reminders, proposal updates, and decisions.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createGovernanceChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_GOVERNANCE,
            context.getString(R.string.channel_governance_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.channel_governance_description)
            enableVibration(true)
            setShowBadge(true)
        }
    }

    /**
     * Mutual Aid channel - High importance with sound.
     * Used for urgent requests and offers requiring immediate attention.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createMutualAidChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_MUTUAL_AID,
            context.getString(R.string.channel_mutual_aid_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.channel_mutual_aid_description)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 200, 500)
            enableLights(true)
            lightColor = 0xFFFF5722.toInt() // Orange for urgency
            setShowBadge(true)
        }
    }

    /**
     * Newsletters channel - Low importance.
     * Used for newsletter delivery and digest notifications.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createNewslettersChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_NEWSLETTERS,
            context.getString(R.string.channel_newsletters_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.channel_newsletters_description)
            enableVibration(false)
            setShowBadge(false)
        }
    }

    /**
     * BLE Service channel - Low importance.
     * Used for foreground service notification.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createBleServiceChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_BLE_SERVICE,
            context.getString(R.string.channel_ble_service_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.channel_ble_service_description)
            setShowBadge(false)
        }
    }

    /**
     * Device Sync channel - Default importance.
     * Used for device pairing notifications.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createDeviceSyncChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_DEVICE_SYNC,
            context.getString(R.string.channel_device_sync_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.channel_device_sync_description)
        }
    }

    /**
     * Background Sync channel - Low importance.
     * Used for background sync status notifications.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createBackgroundSyncChannel(): NotificationChannel {
        return NotificationChannel(
            CHANNEL_BACKGROUND_SYNC,
            context.getString(R.string.channel_background_sync_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.channel_background_sync_description)
            setShowBadge(false)
        }
    }

    /**
     * Deletes a notification channel.
     * Use with caution - users will need to reconfigure settings.
     */
    fun deleteChannel(channelId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager.deleteNotificationChannel(channelId)
        }
    }

    /**
     * Checks if notifications are enabled for a specific channel.
     */
    fun isChannelEnabled(channelId: String): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            val channel = notificationManager.getNotificationChannel(channelId)
            return channel?.importance != NotificationManager.IMPORTANCE_NONE
        }
        return true
    }

    /**
     * Gets all channel IDs for module notifications.
     */
    fun getModuleChannelIds(): List<String> = listOf(
        CHANNEL_MESSAGES,
        CHANNEL_EVENTS,
        CHANNEL_GOVERNANCE,
        CHANNEL_MUTUAL_AID,
        CHANNEL_NEWSLETTERS
    )
}

