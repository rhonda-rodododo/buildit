package network.buildit

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import network.buildit.core.background.SyncWorker
import network.buildit.core.ble.BLEManager
import network.buildit.core.notifications.NotificationChannels
import network.buildit.widgets.WidgetDataProvider
import network.buildit.widgets.WidgetDataProviderLocator
import network.buildit.widgets.WidgetUpdateWorker

/**
 * BuildIt Application class.
 *
 * This is the main entry point for the application, responsible for:
 * - Initializing Hilt dependency injection
 * - Setting up notification channels
 * - Configuring app-wide services
 * - Initializing widgets and WorkManager
 * - Scheduling background sync
 */
@HiltAndroidApp
class BuildItApp : Application(), Configuration.Provider {

    @Inject
    lateinit var bleManager: BLEManager

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var widgetDataProvider: WidgetDataProvider

    @Inject
    lateinit var notificationChannels: NotificationChannels

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        initializeWidgets()
        initializeBackgroundSync()
    }

    /**
     * Provides WorkManager configuration with Hilt worker factory.
     */
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    /**
     * Initializes widget components and schedules periodic updates.
     */
    private fun initializeWidgets() {
        // Register the widget data provider for widget access
        WidgetDataProviderLocator.setProvider(widgetDataProvider)

        // Schedule periodic widget updates via WorkManager
        WidgetUpdateWorker.schedulePeriodicUpdates(this)
    }

    /**
     * Creates all notification channels required for the app.
     * Uses the NotificationChannels service to create properly configured channels.
     */
    private fun createNotificationChannels() {
        notificationChannels.createAllChannels()
    }

    /**
     * Initializes the background sync worker to periodically fetch new content.
     */
    private fun initializeBackgroundSync() {
        SyncWorker.schedule(this)
    }

    companion object {
        // Keep these constants for backward compatibility
        const val CHANNEL_BLE_SERVICE = NotificationChannels.CHANNEL_BLE_SERVICE
        const val CHANNEL_MESSAGES = NotificationChannels.CHANNEL_MESSAGES
        const val CHANNEL_DEVICE_SYNC = NotificationChannels.CHANNEL_DEVICE_SYNC
    }
}
