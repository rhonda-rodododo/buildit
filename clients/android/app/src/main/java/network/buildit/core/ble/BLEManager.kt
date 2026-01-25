package network.buildit.core.ble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Central manager for all BLE operations in BuildIt.
 *
 * Coordinates between:
 * - BLEScanner: Discovers nearby BuildIt devices
 * - BLEAdvertiser: Makes this device discoverable
 * - GattServer: Handles GATT connections and data transfer
 * - MeshRouter: Routes messages through the mesh network
 *
 * This class manages the BLE lifecycle and ensures proper resource cleanup.
 */
@Singleton
class BLEManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val scanner: BLEScanner,
    private val advertiser: BLEAdvertiser,
    private val gattServer: GattServer,
    private val meshRouter: MeshRouter
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

    private val bluetoothAdapter: BluetoothAdapter? =
        bluetoothManager?.adapter

    private val _state = MutableStateFlow(BLEState.IDLE)
    val state: StateFlow<BLEState> = _state.asStateFlow()

    private val _discoveredDevices = MutableStateFlow<Set<DiscoveredDevice>>(emptySet())
    val discoveredDevices: StateFlow<Set<DiscoveredDevice>> = _discoveredDevices.asStateFlow()

    private val _connectedDevices = MutableStateFlow<Set<BluetoothDevice>>(emptySet())
    val connectedDevices: StateFlow<Set<BluetoothDevice>> = _connectedDevices.asStateFlow()

    private val _events = MutableSharedFlow<BLEEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<BLEEvent> = _events.asSharedFlow()

    init {
        // Collect scanner results
        scope.launch {
            scanner.discoveredDevices.collect { devices ->
                _discoveredDevices.value = devices
            }
        }

        // Collect GATT server connection events
        scope.launch {
            gattServer.connectedDevices.collect { devices ->
                _connectedDevices.value = devices
            }
        }

        // Collect mesh messages
        scope.launch {
            meshRouter.incomingMessages.collect { message ->
                _events.emit(BLEEvent.MessageReceived(message))
            }
        }
    }

    /**
     * Checks if BLE is supported on this device.
     */
    fun isBleSupported(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
    }

    /**
     * Checks if Bluetooth is currently enabled.
     */
    fun isBluetoothEnabled(): Boolean {
        return bluetoothAdapter?.isEnabled == true
    }

    /**
     * Checks if necessary permissions are granted.
     */
    fun hasRequiredPermissions(): Boolean {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            listOf(
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }

        return permissions.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) ==
                    PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Starts the BLE mesh network.
     *
     * This begins:
     * 1. Advertising this device's presence
     * 2. Scanning for other BuildIt devices
     * 3. Starting the GATT server for connections
     */
    suspend fun start(): Result<Unit> {
        if (!isBleSupported()) {
            return Result.failure(BLEException.NotSupported)
        }

        if (!isBluetoothEnabled()) {
            return Result.failure(BLEException.BluetoothDisabled)
        }

        if (!hasRequiredPermissions()) {
            return Result.failure(BLEException.PermissionDenied)
        }

        return try {
            _state.value = BLEState.STARTING

            // Start GATT server first
            gattServer.start()

            // Begin advertising
            advertiser.startAdvertising()

            // Begin scanning
            scanner.startScanning()

            _state.value = BLEState.RUNNING
            _events.emit(BLEEvent.Started)

            Result.success(Unit)
        } catch (e: Exception) {
            _state.value = BLEState.ERROR
            Result.failure(BLEException.StartupFailed(e.message ?: "Unknown error"))
        }
    }

    /**
     * Stops the BLE mesh network and releases resources.
     */
    suspend fun stop() {
        _state.value = BLEState.STOPPING

        scanner.stopScanning()
        advertiser.stopAdvertising()
        gattServer.stop()

        _state.value = BLEState.IDLE
        _events.emit(BLEEvent.Stopped)
    }

    /**
     * Sends a message through the mesh network.
     *
     * @param recipientPublicKey The recipient's public key (hex encoded)
     * @param payload The message payload
     * @return Result indicating success or failure
     */
    suspend fun sendMessage(recipientPublicKey: String, payload: ByteArray): Result<Unit> {
        if (_state.value != BLEState.RUNNING) {
            return Result.failure(BLEException.NotRunning)
        }

        return meshRouter.sendMessage(recipientPublicKey, payload)
    }

    /**
     * Connects to a specific device.
     *
     * @param device The device to connect to
     */
    suspend fun connectToDevice(device: DiscoveredDevice): Result<Unit> {
        if (_state.value != BLEState.RUNNING) {
            return Result.failure(BLEException.NotRunning)
        }

        return gattServer.connectToDevice(device.bluetoothDevice)
    }

    /**
     * Disconnects from a specific device.
     */
    suspend fun disconnectFromDevice(device: BluetoothDevice): Result<Unit> {
        return gattServer.disconnectFromDevice(device)
    }

    companion object {
        /**
         * BuildIt BLE Service UUID.
         * Used for advertising and discovering BuildIt devices.
         */
        val SERVICE_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef0")

        /**
         * Characteristic UUID for message exchange.
         */
        val MESSAGE_CHARACTERISTIC_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef1")

        /**
         * Characteristic UUID for device identity (public key).
         */
        val IDENTITY_CHARACTERISTIC_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef2")

        /**
         * Characteristic UUID for mesh routing metadata.
         */
        val ROUTING_CHARACTERISTIC_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef3")
    }
}

/**
 * Represents the current state of the BLE manager.
 */
enum class BLEState {
    IDLE,
    STARTING,
    RUNNING,
    STOPPING,
    ERROR
}

/**
 * Events emitted by the BLE manager.
 */
sealed class BLEEvent {
    data object Started : BLEEvent()
    data object Stopped : BLEEvent()
    data class DeviceConnected(val device: BluetoothDevice) : BLEEvent()
    data class DeviceDisconnected(val device: BluetoothDevice) : BLEEvent()
    data class MessageReceived(val message: MeshMessage) : BLEEvent()
    data class Error(val exception: BLEException) : BLEEvent()
}

/**
 * Exceptions that can occur during BLE operations.
 */
sealed class BLEException : Exception() {
    data object NotSupported : BLEException()
    data object BluetoothDisabled : BLEException()
    data object PermissionDenied : BLEException()
    data object NotRunning : BLEException()
    data class StartupFailed(override val message: String) : BLEException()
    data class ConnectionFailed(override val message: String) : BLEException()
    data class SendFailed(override val message: String) : BLEException()
}

/**
 * Represents a discovered BuildIt device.
 */
data class DiscoveredDevice(
    val bluetoothDevice: BluetoothDevice,
    val publicKey: String?,
    val rssi: Int,
    val lastSeen: Long = System.currentTimeMillis()
)

/**
 * Represents a message in the mesh network.
 */
data class MeshMessage(
    val id: String,
    val senderPublicKey: String,
    val recipientPublicKey: String,
    val payload: ByteArray,
    val hopCount: Int,
    val timestamp: Long
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as MeshMessage
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
