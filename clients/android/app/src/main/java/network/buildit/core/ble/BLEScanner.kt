package network.buildit.core.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles BLE scanning for discovering nearby BuildIt devices.
 *
 * Features:
 * - Filters scans to only find BuildIt devices (by service UUID)
 * - Maintains a list of discovered devices with RSSI and last-seen time
 * - Automatically removes stale devices
 * - Supports start/stop scanning
 */
@Singleton
class BLEScanner @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

    private val bluetoothAdapter: BluetoothAdapter? =
        bluetoothManager?.adapter

    private val bleScanner: BluetoothLeScanner?
        get() = bluetoothAdapter?.bluetoothLeScanner

    private val _discoveredDevices = MutableStateFlow<Set<DiscoveredDevice>>(emptySet())
    val discoveredDevices: StateFlow<Set<DiscoveredDevice>> = _discoveredDevices.asStateFlow()

    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    private var cleanupJob: Job? = null

    /**
     * Scan callback that processes discovered devices.
     */
    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            handleScanResult(result)
        }

        override fun onBatchScanResults(results: List<ScanResult>) {
            results.forEach { handleScanResult(it) }
        }

        override fun onScanFailed(errorCode: Int) {
            _isScanning.value = false
            // Log error or emit event
        }
    }

    /**
     * Processes a scan result and updates the discovered devices list.
     */
    @SuppressLint("MissingPermission")
    private fun handleScanResult(result: ScanResult) {
        val device = result.device
        val rssi = result.rssi

        // Extract public key from advertisement data if available
        val publicKey = result.scanRecord?.serviceData?.get(
            ParcelUuid(BLEManager.SERVICE_UUID)
        )?.let { data ->
            // First 32 bytes are the public key
            if (data.size >= 32) {
                data.take(32).toByteArray().toHexString()
            } else null
        }

        val discoveredDevice = DiscoveredDevice(
            bluetoothDevice = device,
            publicKey = publicKey,
            rssi = rssi,
            lastSeen = System.currentTimeMillis()
        )

        _discoveredDevices.value = _discoveredDevices.value
            .filter { it.bluetoothDevice.address != device.address }
            .toSet() + discoveredDevice
    }

    /**
     * Starts scanning for BuildIt devices.
     */
    @SuppressLint("MissingPermission")
    fun startScanning() {
        if (_isScanning.value) return

        val scanner = bleScanner ?: return

        // Build scan filters to only find BuildIt devices
        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(BLEManager.SERVICE_UUID))
                .build()
        )

        // Configure scan settings for balanced power/latency
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
            .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
            .setReportDelay(0)
            .build()

        scanner.startScan(filters, settings, scanCallback)
        _isScanning.value = true

        // Start cleanup job to remove stale devices
        startCleanupJob()
    }

    /**
     * Stops scanning for devices.
     */
    @SuppressLint("MissingPermission")
    fun stopScanning() {
        if (!_isScanning.value) return

        bleScanner?.stopScan(scanCallback)
        _isScanning.value = false

        cleanupJob?.cancel()
        cleanupJob = null
    }

    /**
     * Starts a background job that removes devices not seen recently.
     */
    private fun startCleanupJob() {
        cleanupJob?.cancel()
        cleanupJob = scope.launch {
            while (isActive) {
                delay(CLEANUP_INTERVAL_MS)

                val now = System.currentTimeMillis()
                _discoveredDevices.value = _discoveredDevices.value.filter { device ->
                    now - device.lastSeen < DEVICE_STALE_THRESHOLD_MS
                }.toSet()
            }
        }
    }

    /**
     * Clears all discovered devices.
     */
    fun clearDiscoveredDevices() {
        _discoveredDevices.value = emptySet()
    }

    companion object {
        /** How often to run the cleanup job (30 seconds) */
        private const val CLEANUP_INTERVAL_MS = 30_000L

        /** Devices not seen for this long are considered stale (2 minutes) */
        private const val DEVICE_STALE_THRESHOLD_MS = 120_000L
    }
}

/**
 * Extension function to convert ByteArray to hex string.
 */
private fun ByteArray.toHexString(): String =
    joinToString("") { "%02x".format(it) }
