package network.buildit

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import network.buildit.core.ble.BLEManager

/**
 * BuildIt Application class.
 *
 * This is the main entry point for the application, responsible for:
 * - Initializing Hilt dependency injection
 * - Setting up notification channels
 * - Configuring app-wide services
 */
@HiltAndroidApp
class BuildItApp : Application() {

    @Inject
    lateinit var bleManager: BLEManager

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    /**
     * Creates notification channels required for the app.
     * Channels are required for notifications on Android O (API 26) and above.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            // BLE Service Channel - for the foreground service notification
            val bleChannel = NotificationChannel(
                CHANNEL_BLE_SERVICE,
                "Mesh Network Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when BuildIt is running the BLE mesh network"
                setShowBadge(false)
            }

            // Messages Channel - for new message notifications
            val messagesChannel = NotificationChannel(
                CHANNEL_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new messages"
                enableVibration(true)
            }

            // Device Sync Channel - for device pairing notifications
            val deviceSyncChannel = NotificationChannel(
                CHANNEL_DEVICE_SYNC,
                "Device Sync",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for device synchronization"
            }

            notificationManager.createNotificationChannels(
                listOf(bleChannel, messagesChannel, deviceSyncChannel)
            )
        }
    }

    companion object {
        const val CHANNEL_BLE_SERVICE = "ble_service_channel"
        const val CHANNEL_MESSAGES = "messages_channel"
        const val CHANNEL_DEVICE_SYNC = "device_sync_channel"
    }
}
