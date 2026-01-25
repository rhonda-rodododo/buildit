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
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles BLE advertising to make this device discoverable to other BuildIt devices.
 *
 * Features:
 * - Advertises the BuildIt service UUID
 * - Includes device's public key in service data
 * - Configures advertising for optimal power/discoverability
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
     * The advertisement includes:
     * - BuildIt service UUID for discovery
     * - First 20 bytes of public key in service data (BLE limit)
     */
    @SuppressLint("MissingPermission")
    fun startAdvertising() {
        if (_isAdvertising.value) return

        val advertiser = bleAdvertiser ?: run {
            _advertisingError.value = AdvertisingError.FeatureUnsupported
            return
        }

        // Get public key bytes for service data
        val publicKeyBytes = keystoreManager.getPublicKeyBytes()
            ?.take(MAX_SERVICE_DATA_SIZE)
            ?.toByteArray()
            ?: ByteArray(0)

        // Configure advertising settings
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .setTimeout(0) // Advertise indefinitely
            .build()

        // Build advertisement data
        val advertiseData = AdvertiseData.Builder()
            .setIncludeDeviceName(false) // Privacy - don't expose device name
            .setIncludeTxPowerLevel(true)
            .addServiceUuid(ParcelUuid(BLEManager.SERVICE_UUID))
            .build()

        // Build scan response with public key
        val scanResponse = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceData(ParcelUuid(BLEManager.SERVICE_UUID), publicKeyBytes)
            .build()

        advertiser.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
    }

    /**
     * Stops advertising this device's presence.
     */
    @SuppressLint("MissingPermission")
    fun stopAdvertising() {
        if (!_isAdvertising.value) return

        bleAdvertiser?.stopAdvertising(advertiseCallback)
        _isAdvertising.value = false
    }

    /**
     * Updates the advertised data (e.g., after key rotation).
     */
    fun refreshAdvertisement() {
        if (_isAdvertising.value) {
            stopAdvertising()
            startAdvertising()
        }
    }

    companion object {
        /**
         * Maximum size for service data in BLE advertisement.
         * BLE 4.0 advertisement packets are limited to 31 bytes total,
         * so we use a subset of the public key.
         */
        private const val MAX_SERVICE_DATA_SIZE = 20
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
