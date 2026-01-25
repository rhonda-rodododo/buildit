package network.buildit.core.ble

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import network.buildit.BuildItApp
import network.buildit.MainActivity
import network.buildit.R
import javax.inject.Inject

/**
 * Foreground service for maintaining BLE mesh connectivity in the background.
 *
 * Android requires a foreground service with a persistent notification
 * for long-running BLE operations. This service:
 * - Keeps the BLE manager running when the app is backgrounded
 * - Displays a notification indicating mesh status
 * - Handles service lifecycle (start, stop, restart)
 */
@AndroidEntryPoint
class BLEForegroundService : Service() {

    @Inject
    lateinit var bleManager: BLEManager

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): BLEForegroundService = this@BLEForegroundService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startMeshService()
            ACTION_STOP -> stopMeshService()
        }
        return START_STICKY
    }

    private fun startMeshService() {
        val notification = createNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        scope.launch {
            bleManager.start()
        }
    }

    private fun stopMeshService() {
        scope.launch {
            bleManager.stop()
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, BLEForegroundService::class.java).apply {
                action = ACTION_STOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, BuildItApp.CHANNEL_BLE_SERVICE)
            .setContentTitle(getString(R.string.ble_service_notification_title))
            .setContentText(getString(R.string.ble_service_notification_text))
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                getString(R.string.action_cancel),
                stopIntent
            )
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    companion object {
        const val ACTION_START = "network.buildit.action.START_BLE_SERVICE"
        const val ACTION_STOP = "network.buildit.action.STOP_BLE_SERVICE"
        private const val NOTIFICATION_ID = 1001
    }
}
