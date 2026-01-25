package network.buildit.core.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
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
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import network.buildit.core.crypto.KeystoreManager
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Manages GATT server and client operations for BuildIt mesh networking.
 *
 * Responsibilities:
 * - Hosts the BuildIt GATT service with message and identity characteristics
 * - Handles incoming connections from other devices
 * - Initiates outgoing connections to discovered devices
 * - Manages characteristic read/write operations
 * - Buffers and reassembles fragmented messages
 */
@Singleton
class GattServer @Inject constructor(
    @ApplicationContext private val context: Context,
    private val keystoreManager: KeystoreManager
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

    private var gattServer: BluetoothGattServer? = null

    private val _connectedDevices = MutableStateFlow<Set<BluetoothDevice>>(emptySet())
    val connectedDevices: StateFlow<Set<BluetoothDevice>> = _connectedDevices.asStateFlow()

    private val _receivedMessages = MutableSharedFlow<ReceivedMessage>(extraBufferCapacity = 64)
    val receivedMessages: SharedFlow<ReceivedMessage> = _receivedMessages.asSharedFlow()

    /** Active GATT client connections */
    private val clientConnections = ConcurrentHashMap<String, BluetoothGatt>()

    /** Message buffers for reassembling fragmented messages */
    private val messageBuffers = ConcurrentHashMap<String, MessageBuffer>()

    /**
     * GATT server callback handling incoming requests.
     */
    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    _connectedDevices.value = _connectedDevices.value + device
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    _connectedDevices.value = _connectedDevices.value - device
                    messageBuffers.remove(device.address)
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            val response = when (characteristic.uuid) {
                BLEManager.IDENTITY_CHARACTERISTIC_UUID -> {
                    keystoreManager.getPublicKeyBytes() ?: ByteArray(0)
                }
                else -> ByteArray(0)
            }

            gattServer?.sendResponse(
                device,
                requestId,
                BluetoothGatt.GATT_SUCCESS,
                offset,
                response.drop(offset).toByteArray()
            )
        }

        @SuppressLint("MissingPermission")
        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            when (characteristic.uuid) {
                BLEManager.MESSAGE_CHARACTERISTIC_UUID -> {
                    handleIncomingMessageChunk(device, value)
                }
            }

            if (responseNeeded) {
                gattServer?.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    offset,
                    value
                )
            }
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            // Handle notification subscription
            if (responseNeeded) {
                gattServer?.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    offset,
                    value
                )
            }
        }

        override fun onMtuChanged(device: BluetoothDevice, mtu: Int) {
            // Store MTU for optimal chunking
            deviceMtus[device.address] = mtu
        }
    }

    /** Store negotiated MTUs for each device */
    private val deviceMtus = ConcurrentHashMap<String, Int>()

    /**
     * Starts the GATT server.
     */
    @SuppressLint("MissingPermission")
    fun start() {
        if (gattServer != null) return

        gattServer = bluetoothManager?.openGattServer(context, serverCallback)?.apply {
            addService(createBuildItService())
        }
    }

    /**
     * Stops the GATT server and closes all connections.
     */
    @SuppressLint("MissingPermission")
    fun stop() {
        // Close all client connections
        clientConnections.values.forEach { it.close() }
        clientConnections.clear()

        // Close server
        gattServer?.close()
        gattServer = null

        _connectedDevices.value = emptySet()
        messageBuffers.clear()
        deviceMtus.clear()
    }

    /**
     * Creates the BuildIt GATT service with all characteristics.
     */
    private fun createBuildItService(): BluetoothGattService {
        val service = BluetoothGattService(
            BLEManager.SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        )

        // Identity characteristic - readable, contains public key
        val identityCharacteristic = BluetoothGattCharacteristic(
            BLEManager.IDENTITY_CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ
        )

        // Message characteristic - writable, receives messages
        val messageCharacteristic = BluetoothGattCharacteristic(
            BLEManager.MESSAGE_CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE or
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
                    BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        ).apply {
            // Add Client Characteristic Configuration Descriptor for notifications
            addDescriptor(BluetoothGattDescriptor(
                CLIENT_CONFIG_DESCRIPTOR_UUID,
                BluetoothGattDescriptor.PERMISSION_READ or
                        BluetoothGattDescriptor.PERMISSION_WRITE
            ))
        }

        // Routing characteristic - for mesh metadata
        val routingCharacteristic = BluetoothGattCharacteristic(
            BLEManager.ROUTING_CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or
                    BluetoothGattCharacteristic.PROPERTY_WRITE,
            BluetoothGattCharacteristic.PERMISSION_READ or
                    BluetoothGattCharacteristic.PERMISSION_WRITE
        )

        service.addCharacteristic(identityCharacteristic)
        service.addCharacteristic(messageCharacteristic)
        service.addCharacteristic(routingCharacteristic)

        return service
    }

    /**
     * Connects to a remote device as a GATT client.
     */
    @SuppressLint("MissingPermission")
    suspend fun connectToDevice(device: BluetoothDevice): Result<Unit> {
        if (clientConnections.containsKey(device.address)) {
            return Result.success(Unit)
        }

        return withTimeoutOrNull(CONNECTION_TIMEOUT_MS) {
            suspendCancellableCoroutine { continuation ->
                val callback = object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                        when (newState) {
                            BluetoothProfile.STATE_CONNECTED -> {
                                clientConnections[device.address] = gatt
                                gatt.discoverServices()
                            }
                            BluetoothProfile.STATE_DISCONNECTED -> {
                                clientConnections.remove(device.address)
                                gatt.close()
                                if (continuation.isActive) {
                                    continuation.resume(Result.failure(
                                        BLEException.ConnectionFailed("Disconnected")
                                    ))
                                }
                            }
                        }
                    }

                    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                        if (status == BluetoothGatt.GATT_SUCCESS) {
                            // Request higher MTU for better throughput
                            gatt.requestMtu(MAX_MTU)
                        } else {
                            continuation.resume(Result.failure(
                                BLEException.ConnectionFailed("Service discovery failed")
                            ))
                        }
                    }

                    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
                        deviceMtus[device.address] = mtu
                        if (continuation.isActive) {
                            continuation.resume(Result.success(Unit))
                        }
                    }
                }

                val gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
                } else {
                    device.connectGatt(context, false, callback)
                }

                continuation.invokeOnCancellation {
                    gatt?.close()
                }
            }
        } ?: Result.failure(BLEException.ConnectionFailed("Connection timeout"))
    }

    /**
     * Disconnects from a remote device.
     */
    @SuppressLint("MissingPermission")
    suspend fun disconnectFromDevice(device: BluetoothDevice): Result<Unit> {
        clientConnections.remove(device.address)?.let { gatt ->
            gatt.disconnect()
            gatt.close()
        }
        return Result.success(Unit)
    }

    /**
     * Sends a message to a connected device.
     */
    @SuppressLint("MissingPermission")
    suspend fun sendMessage(device: BluetoothDevice, data: ByteArray): Result<Unit> {
        val gatt = clientConnections[device.address]
            ?: return Result.failure(BLEException.SendFailed("Device not connected"))

        val service = gatt.getService(BLEManager.SERVICE_UUID)
            ?: return Result.failure(BLEException.SendFailed("Service not found"))

        val characteristic = service.getCharacteristic(BLEManager.MESSAGE_CHARACTERISTIC_UUID)
            ?: return Result.failure(BLEException.SendFailed("Characteristic not found"))

        // Get MTU and calculate chunk size (MTU - 3 for ATT header)
        val mtu = deviceMtus[device.address] ?: DEFAULT_MTU
        val chunkSize = mtu - ATT_HEADER_SIZE

        // Fragment and send message
        val chunks = fragmentMessage(data, chunkSize)

        for ((index, chunk) in chunks.withIndex()) {
            val packetData = buildMessagePacket(
                chunkIndex = index,
                totalChunks = chunks.size,
                payload = chunk
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeCharacteristic(
                    characteristic,
                    packetData,
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                )
            } else {
                @Suppress("DEPRECATION")
                characteristic.value = packetData
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(characteristic)
            }
        }

        return Result.success(Unit)
    }

    /**
     * Handles an incoming message chunk.
     */
    private fun handleIncomingMessageChunk(device: BluetoothDevice, data: ByteArray) {
        if (data.size < MESSAGE_HEADER_SIZE) return

        val chunkIndex = data[0].toInt() and 0xFF
        val totalChunks = data[1].toInt() and 0xFF
        val payload = data.drop(MESSAGE_HEADER_SIZE).toByteArray()

        val buffer = messageBuffers.getOrPut(device.address) {
            MessageBuffer(totalChunks)
        }

        buffer.addChunk(chunkIndex, payload)

        if (buffer.isComplete()) {
            val completeMessage = buffer.assemble()
            messageBuffers.remove(device.address)

            scope.launch {
                _receivedMessages.emit(
                    ReceivedMessage(
                        senderAddress = device.address,
                        data = completeMessage
                    )
                )
            }
        }
    }

    /**
     * Fragments a message into chunks.
     */
    private fun fragmentMessage(data: ByteArray, chunkSize: Int): List<ByteArray> {
        val payloadSize = chunkSize - MESSAGE_HEADER_SIZE
        return data.toList()
            .chunked(payloadSize)
            .map { it.toByteArray() }
    }

    /**
     * Builds a message packet with header.
     */
    private fun buildMessagePacket(
        chunkIndex: Int,
        totalChunks: Int,
        payload: ByteArray
    ): ByteArray {
        return byteArrayOf(
            chunkIndex.toByte(),
            totalChunks.toByte()
        ) + payload
    }

    companion object {
        private val CLIENT_CONFIG_DESCRIPTOR_UUID =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        private const val CONNECTION_TIMEOUT_MS = 30_000L
        private const val DEFAULT_MTU = 23
        private const val MAX_MTU = 517
        private const val ATT_HEADER_SIZE = 3
        private const val MESSAGE_HEADER_SIZE = 2
    }
}

/**
 * Represents a message received from a device.
 */
data class ReceivedMessage(
    val senderAddress: String,
    val data: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as ReceivedMessage
        return senderAddress == other.senderAddress && data.contentEquals(other.data)
    }

    override fun hashCode(): Int {
        var result = senderAddress.hashCode()
        result = 31 * result + data.contentHashCode()
        return result
    }
}

/**
 * Buffer for reassembling fragmented messages.
 */
private class MessageBuffer(private val expectedChunks: Int) {
    private val chunks = mutableMapOf<Int, ByteArray>()

    fun addChunk(index: Int, data: ByteArray) {
        chunks[index] = data
    }

    fun isComplete(): Boolean = chunks.size == expectedChunks

    fun assemble(): ByteArray {
        return (0 until expectedChunks)
            .mapNotNull { chunks[it] }
            .fold(ByteArray(0)) { acc, chunk -> acc + chunk }
    }
}
