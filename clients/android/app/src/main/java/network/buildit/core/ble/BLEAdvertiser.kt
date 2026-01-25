package network.buildit.core.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.core.crypto.KeystoreManager
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Arrays
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service UUID rotation interval in seconds (24 hours)
 */
private const val UUID_ROTATION_INTERVAL_SECS = 86400L

/**
 * Well-known seed for UUID derivation (all BuildIt nodes use this)
 */
private const val UUID_DERIVATION_SEED = "BuildItNetwork-BLE-UUID-Seed-v1"

/**
 * Generate the current service UUID based on daily rotation.
 *
 * SECURITY: All BuildIt nodes derive the same UUID for a given day, allowing
 * discovery while preventing long-term device tracking via static UUIDs.
 */
fun getCurrentServiceUUID(): UUID {
    // Get current day (UTC) as the rotation epoch
    val now = System.currentTimeMillis() / 1000
    val dayEpoch = now / UUID_ROTATION_INTERVAL_SECS

    // Derive UUID from seed and day
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(UUID_DERIVATION_SEED.toByteArray(Charsets.UTF_8))
    digest.update(ByteBuffer.allocate(8).putLong(dayEpoch).array())
    val hash = digest.digest()

    // Use first 16 bytes of hash as UUID, but keep the version/variant bits valid
    val uuidBytes = hash.copyOfRange(0, 16)

    // Set version 4 (random) and variant 1 (RFC 4122)
    uuidBytes[6] = ((uuidBytes[6].toInt() and 0x0f) or 0x40).toByte() // Version 4
    uuidBytes[8] = ((uuidBytes[8].toInt() and 0x3f) or 0x80).toByte() // Variant 1

    // Convert to UUID
    val buffer = ByteBuffer.wrap(uuidBytes)
    val mostSigBits = buffer.long
    val leastSigBits = buffer.long
    return UUID(mostSigBits, leastSigBits)
}

/**
 * Get characteristic UUIDs based on current service UUID
 */
fun getMessageCharacteristicUUID(): UUID {
    val service = getCurrentServiceUUID()
    return UUID(service.mostSignificantBits, service.leastSignificantBits + 1)
}

fun getIdentityCharacteristicUUID(): UUID {
    val service = getCurrentServiceUUID()
    return UUID(service.mostSignificantBits, service.leastSignificantBits + 2)
}

fun getHandshakeCharacteristicUUID(): UUID {
    val service = getCurrentServiceUUID()
    return UUID(service.mostSignificantBits, service.leastSignificantBits + 3)
}

/**
 * DEPRECATED: Legacy static UUIDs - DO NOT USE
 * These expose users to long-term tracking
 */
@Deprecated("Use getCurrentServiceUUID() for rotating UUIDs", ReplaceWith("getCurrentServiceUUID()"))
val LEGACY_SERVICE_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef0")

@Deprecated("Use getMessageCharacteristicUUID() for rotating UUIDs", ReplaceWith("getMessageCharacteristicUUID()"))
val LEGACY_MESSAGE_CHAR_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef1")

@Deprecated("Use getIdentityCharacteristicUUID() for rotating UUIDs", ReplaceWith("getIdentityCharacteristicUUID()"))
val LEGACY_IDENTITY_CHAR_UUID: UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef2")

/**
 * Handles BLE advertising to make this device discoverable to other BuildIt devices.
 *
 * SECURITY FEATURES:
 * - Dynamic service UUID rotation (daily) to prevent long-term tracking
 * - Commitment scheme H(pubkey || nonce) instead of exposing public key
 * - Random nonce prevents correlation attacks between advertisements
 * - Nonce is revealed only after authenticated connection
 * - Memory protection for sensitive data
 * - No device name exposed in advertisements
 */
@Singleton
class BLEAdvertiser @Inject constructor(
    @ApplicationContext private val context: Context,
    private val keystoreManager: KeystoreManager
) {
    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

    private val bluetoothAdapter: BluetoothAdapter? =
        bluetoothManager?.adapter

    private val bleAdvertiser: BluetoothLeAdvertiser?
        get() = bluetoothAdapter?.bluetoothLeAdvertiser

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _advertisingError = MutableStateFlow<AdvertisingError?>(null)
    val advertisingError: StateFlow<AdvertisingError?> = _advertisingError.asStateFlow()

    private val secureRandom = SecureRandom()

    /**
     * Current commitment nonce - stored for reveal after connection.
     * This is regenerated each time advertising starts.
     */
    private var currentNonce: ByteArray? = null
    private val nonceLock = Any()

    /** Current service UUID (rotates daily) */
    private var currentServiceUUID: UUID = getCurrentServiceUUID()

    /** Last rotation check time */
    private var lastRotationCheck: Long = System.currentTimeMillis()

    /**
     * Callback for advertising status updates.
     */
    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            _isAdvertising.value = true
            _advertisingError.value = null
        }

        override fun onStartFailure(errorCode: Int) {
            _isAdvertising.value = false
            _advertisingError.value = when (errorCode) {
                ADVERTISE_FAILED_DATA_TOO_LARGE -> AdvertisingError.DataTooLarge
                ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> AdvertisingError.TooManyAdvertisers
                ADVERTISE_FAILED_ALREADY_STARTED -> AdvertisingError.AlreadyStarted
                ADVERTISE_FAILED_INTERNAL_ERROR -> AdvertisingError.InternalError
                ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> AdvertisingError.FeatureUnsupported
                else -> AdvertisingError.Unknown(errorCode)
            }
        }
    }

    /**
     * Starts advertising this device's presence.
     *
     * SECURITY: The advertisement includes:
     * - Rotating BuildIt service UUID for discovery (changes daily)
     * - Identity commitment H(pubkey || nonce) - NOT the actual public key
     *
     * This prevents:
     * - Identity correlation from passive BLE scanning
     * - Pre-computation attacks against the public key
     * - Long-term tracking via static public key bytes or service UUID
     *
     * The nonce is revealed only after a connection is established and authenticated.
     */
    @SuppressLint("MissingPermission")
    fun startAdvertising() {
        if (_isAdvertising.value) return

        val advertiser = bleAdvertiser ?: run {
            _advertisingError.value = AdvertisingError.FeatureUnsupported
            return
        }

        // Check for UUID rotation
        checkUUIDRotation()

        // Get public key and generate commitment
        val publicKeyBytes = keystoreManager.getPublicKeyBytes()
        if (publicKeyBytes == null) {
            _advertisingError.value = AdvertisingError.InternalError
            return
        }

        var commitment: ByteArray? = null
        var nonce: ByteArray? = null

        try {
            // Generate random nonce for this advertising session
            nonce = ByteArray(NONCE_SIZE).also { secureRandom.nextBytes(it) }

            // Create commitment: H(pubkey || nonce)
            commitment = createCommitment(publicKeyBytes, nonce)
                ?.take(MAX_SERVICE_DATA_SIZE)
                ?.toByteArray()
                ?: run {
                    _advertisingError.value = AdvertisingError.InternalError
                    return
                }

            // Store nonce for later reveal (thread-safe)
            synchronized(nonceLock) {
                // Clear old nonce first
                currentNonce?.let { Arrays.fill(it, 0.toByte()) }
                currentNonce = nonce.copyOf()
            }

            // Get current rotating service UUID
            val serviceUUID = getCurrentServiceUUID()

            // Configure advertising settings
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .setConnectable(true)
                .setTimeout(0) // Advertise indefinitely
                .build()

            // Build advertisement data with ROTATING service UUID
            val advertiseData = AdvertiseData.Builder()
                .setIncludeDeviceName(false) // Privacy - don't expose device name
                .setIncludeTxPowerLevel(false) // Privacy - don't expose TX power
                .addServiceUuid(ParcelUuid(serviceUUID))
                .build()

            // Build scan response with commitment (NOT public key)
            val scanResponse = AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceData(ParcelUuid(serviceUUID), commitment)
                .build()

            advertiser.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
        } finally {
            // Clear sensitive data from local variables
            commitment?.let { Arrays.fill(it, 0.toByte()) }
            // Note: nonce is stored in currentNonce, don't clear here
        }
    }

    /**
     * Check if service UUID needs rotation
     */
    private fun checkUUIDRotation() {
        val now = System.currentTimeMillis()
        // Check every hour
        if (now - lastRotationCheck > 3600_000) {
            lastRotationCheck = now
            val newUUID = getCurrentServiceUUID()
            if (newUUID != currentServiceUUID) {
                currentServiceUUID = newUUID
                // UUID rotated - restart advertising if active
                if (_isAdvertising.value) {
                    stopAdvertising()
                    startAdvertising()
                }
            }
        }
    }

    /**
     * Creates a cryptographic commitment from public key and nonce.
     * commitment = SHA-256(pubkey || nonce)
     */
    private fun createCommitment(publicKey: ByteArray, nonce: ByteArray): ByteArray? {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            digest.update(publicKey)
            digest.update(nonce)
            digest.digest()
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Gets the current nonce for verification after connection.
     * This should only be called after the connection is authenticated.
     *
     * @return Copy of the current nonce, or null if not advertising
     */
    fun getCurrentNonceForVerification(): ByteArray? {
        synchronized(nonceLock) {
            return currentNonce?.copyOf()
        }
    }

    /**
     * Get handshake data (pubkey + nonce) for revealing identity after connection
     */
    fun getHandshakeData(): ByteArray? {
        val pubkeyBytes = keystoreManager.getPublicKeyBytes() ?: return null
        val nonce = synchronized(nonceLock) { currentNonce?.copyOf() } ?: return null
        return pubkeyBytes + nonce
    }

    /**
     * Verifies a commitment against a public key and nonce.
     * Used by the connecting device to verify the advertiser's identity.
     */
    fun verifyCommitment(commitment: ByteArray, publicKey: ByteArray, nonce: ByteArray): Boolean {
        var computed: ByteArray? = null
        try {
            computed = createCommitment(publicKey, nonce) ?: return false
            // Constant-time comparison to prevent timing attacks
            return MessageDigest.isEqual(
                commitment.take(MAX_SERVICE_DATA_SIZE).toByteArray(),
                computed.take(MAX_SERVICE_DATA_SIZE).toByteArray()
            )
        } finally {
            computed?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    /**
     * Get current service UUID for scanning
     */
    fun getServiceUUID(): UUID {
        checkUUIDRotation()
        return getCurrentServiceUUID()
    }

    /**
     * Stops advertising this device's presence.
     * Securely clears the stored nonce.
     */
    @SuppressLint("MissingPermission")
    fun stopAdvertising() {
        if (!_isAdvertising.value) return

        bleAdvertiser?.stopAdvertising(advertiseCallback)
        _isAdvertising.value = false

        // Securely clear the nonce
        synchronized(nonceLock) {
            currentNonce?.let { Arrays.fill(it, 0.toByte()) }
            currentNonce = null
        }
    }

    /**
     * Updates the advertised data (e.g., after key rotation or UUID rotation).
     */
    fun refreshAdvertisement() {
        if (_isAdvertising.value) {
            stopAdvertising()
            startAdvertising()
        }
    }

    /**
     * Check if advertising is supported
     */
    fun isAdvertisingSupported(): Boolean {
        return bleAdvertiser != null && bluetoothAdapter?.isEnabled == true
    }

    /**
     * Clean up resources
     */
    fun cleanup() {
        stopAdvertising()
    }

    companion object {
        /**
         * Maximum size for service data in BLE advertisement.
         * BLE 4.0 advertisement packets are limited to 31 bytes total,
         * so we use a truncated commitment hash.
         */
        private const val MAX_SERVICE_DATA_SIZE = 20

        /**
         * Size of the random nonce used in commitment scheme.
         * 16 bytes (128 bits) provides sufficient randomness to prevent
         * correlation attacks while fitting within BLE constraints.
         */
        private const val NONCE_SIZE = 16
    }
}

/**
 * Errors that can occur during advertising.
 */
sealed class AdvertisingError {
    data object DataTooLarge : AdvertisingError()
    data object TooManyAdvertisers : AdvertisingError()
    data object AlreadyStarted : AdvertisingError()
    data object InternalError : AdvertisingError()
    data object FeatureUnsupported : AdvertisingError()
    data class Unknown(val errorCode: Int) : AdvertisingError()
}
