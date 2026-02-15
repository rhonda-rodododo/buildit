package network.buildit.testutil

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.core.ble.BLEEvent
import network.buildit.core.ble.BLEException
import network.buildit.core.ble.BLEState
import network.buildit.core.ble.DecryptedMessage
import network.buildit.core.ble.DiscoveredDevice
import java.util.UUID

/**
 * Fake implementation of BLEManager for testing.
 *
 * Provides controllable BLE behavior without requiring actual Bluetooth hardware.
 * Allows tests to simulate various BLE scenarios including:
 * - Device discovery
 * - Connection management
 * - Message sending/receiving
 * - Error conditions
 */
class FakeBLEManager {

    // ============== State ==============

    private val _state = MutableStateFlow(BLEState.IDLE)
    val state: StateFlow<BLEState> = _state.asStateFlow()

    private val _discoveredDevices = MutableStateFlow<Set<DiscoveredDevice>>(emptySet())
    val discoveredDevices: StateFlow<Set<DiscoveredDevice>> = _discoveredDevices.asStateFlow()

    private val _connectedDevices = MutableStateFlow<Set<FakeBluetoothDevice>>(emptySet())
    val connectedDevices: StateFlow<Set<FakeBluetoothDevice>> = _connectedDevices.asStateFlow()

    private val _events = MutableSharedFlow<BLEEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<BLEEvent> = _events.asSharedFlow()

    // ============== Test Configuration ==============

    var isBleSupported: Boolean = true
    var isBluetoothEnabled: Boolean = true
    var hasRequiredPermissions: Boolean = true
    var shouldFailOnStart: Boolean = false
    var shouldFailOnSend: Boolean = false
    var sendDelay: Long = 0L

    private val sentMessages = mutableListOf<SentMessage>()
    private val receivedMessages = mutableListOf<DecryptedMessage>()

    // ============== Public Methods ==============

    suspend fun start(): Result<Unit> {
        if (!isBleSupported) {
            return Result.failure(BLEException.NotSupported)
        }

        if (!isBluetoothEnabled) {
            return Result.failure(BLEException.BluetoothDisabled)
        }

        if (!hasRequiredPermissions) {
            return Result.failure(BLEException.PermissionDenied)
        }

        if (shouldFailOnStart) {
            _state.value = BLEState.ERROR
            return Result.failure(BLEException.StartupFailed("Simulated failure"))
        }

        _state.value = BLEState.STARTING

        // Simulate startup
        _state.value = BLEState.RUNNING
        _events.emit(BLEEvent.Started)

        return Result.success(Unit)
    }

    suspend fun stop() {
        _state.value = BLEState.STOPPING

        // Disconnect all devices
        _connectedDevices.value = emptySet()
        _discoveredDevices.value = emptySet()

        _state.value = BLEState.IDLE
        _events.emit(BLEEvent.Stopped)
    }

    suspend fun sendMessage(recipientPublicKey: String, payload: ByteArray): Result<Unit> {
        if (_state.value != BLEState.RUNNING) {
            return Result.failure(BLEException.NotRunning)
        }

        if (shouldFailOnSend) {
            return Result.failure(BLEException.SendFailed("Simulated send failure"))
        }

        if (sendDelay > 0) {
            kotlinx.coroutines.delay(sendDelay)
        }

        val message = SentMessage(
            id = UUID.randomUUID().toString(),
            recipientPublicKey = recipientPublicKey,
            payload = payload,
            timestamp = System.currentTimeMillis()
        )
        sentMessages.add(message)

        return Result.success(Unit)
    }

    suspend fun connectToDevice(device: DiscoveredDevice): Result<Unit> {
        if (_state.value != BLEState.RUNNING) {
            return Result.failure(BLEException.NotRunning)
        }

        val fakeDevice = FakeBluetoothDevice(device.bluetoothDevice?.address ?: "unknown")
        _connectedDevices.value = _connectedDevices.value + fakeDevice
        _events.emit(BLEEvent.DeviceConnected(device.bluetoothDevice!!))

        return Result.success(Unit)
    }

    suspend fun disconnectFromDevice(device: FakeBluetoothDevice): Result<Unit> {
        _connectedDevices.value = _connectedDevices.value.filter { it.address != device.address }.toSet()
        return Result.success(Unit)
    }

    // ============== Test Helpers ==============

    /**
     * Simulates discovering a new device.
     */
    suspend fun simulateDeviceDiscovered(device: DiscoveredDevice) {
        _discoveredDevices.value = _discoveredDevices.value + device
    }

    /**
     * Simulates receiving a decrypted message.
     */
    suspend fun simulateMessageReceived(message: DecryptedMessage) {
        receivedMessages.add(message)
        _events.emit(BLEEvent.MessageReceived(message))
    }

    /**
     * Simulates a device connection.
     */
    suspend fun simulateDeviceConnected(address: String, publicKey: String? = null) {
        val fakeDevice = FakeBluetoothDevice(address)
        _connectedDevices.value = _connectedDevices.value + fakeDevice
    }

    /**
     * Simulates a device disconnection.
     */
    suspend fun simulateDeviceDisconnected(address: String) {
        _connectedDevices.value = _connectedDevices.value.filter { it.address != address }.toSet()
    }

    /**
     * Simulates an error event.
     */
    suspend fun simulateError(exception: BLEException) {
        _state.value = BLEState.ERROR
        _events.emit(BLEEvent.Error(exception))
    }

    /**
     * Gets all messages that have been sent.
     */
    fun getSentMessages(): List<SentMessage> = sentMessages.toList()

    /**
     * Gets all messages that have been received.
     */
    fun getReceivedMessages(): List<DecryptedMessage> = receivedMessages.toList()

    /**
     * Clears recorded messages.
     */
    fun clearMessages() {
        sentMessages.clear()
        receivedMessages.clear()
    }

    /**
     * Resets the fake BLE manager to initial state.
     */
    fun reset() {
        _state.value = BLEState.IDLE
        _discoveredDevices.value = emptySet()
        _connectedDevices.value = emptySet()
        isBleSupported = true
        isBluetoothEnabled = true
        hasRequiredPermissions = true
        shouldFailOnStart = false
        shouldFailOnSend = false
        sendDelay = 0L
        clearMessages()
    }

    // ============== Data Classes ==============

    data class SentMessage(
        val id: String,
        val recipientPublicKey: String,
        val payload: ByteArray,
        val timestamp: Long
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (javaClass != other?.javaClass) return false
            other as SentMessage
            return id == other.id
        }

        override fun hashCode(): Int = id.hashCode()
    }
}

/**
 * Fake BluetoothDevice for testing.
 */
data class FakeBluetoothDevice(
    val address: String,
    val name: String? = null
)
