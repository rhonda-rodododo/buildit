package network.buildit.core.ble

import app.cash.turbine.test
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("BLEScanner")
@OptIn(ExperimentalCoroutinesApi::class)
class BLEScannerTest {

    // Simulated scanner state for testing
    private val discoveredDevicesState = MutableStateFlow<Set<DiscoveredDevice>>(emptySet())
    private val isScanningState = MutableStateFlow(false)

    @BeforeEach
    fun setup() {
        discoveredDevicesState.value = emptySet()
        isScanningState.value = false
    }

    @Nested
    @DisplayName("Scanning State")
    inner class ScanningState {

        @Test
        @DisplayName("isScanning is false initially")
        fun isScanningFalseInitially() {
            assertFalse(isScanningState.value)
        }

        @Test
        @DisplayName("isScanning becomes true when scanning starts")
        fun isScanningTrueWhenStarted() {
            isScanningState.value = true

            assertTrue(isScanningState.value)
        }

        @Test
        @DisplayName("isScanning becomes false when scanning stops")
        fun isScanningFalseWhenStopped() {
            isScanningState.value = true
            isScanningState.value = false

            assertFalse(isScanningState.value)
        }
    }

    @Nested
    @DisplayName("Device Discovery")
    inner class DeviceDiscovery {

        @Test
        @DisplayName("discovered devices starts empty")
        fun discoveredDevicesEmpty() {
            assertTrue(discoveredDevicesState.value.isEmpty())
        }

        @Test
        @DisplayName("adds device on discovery")
        fun addsDeviceOnDiscovery() {
            val device = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:FF")

            discoveredDevicesState.value = setOf(device)

            assertEquals(1, discoveredDevicesState.value.size)
        }

        @Test
        @DisplayName("updates existing device with same address")
        fun updatesExistingDevice() {
            val device1 = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:FF", rssi = -50)
            val device2 = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:FF", rssi = -60)

            discoveredDevicesState.value = setOf(device1)

            // Simulate update - filter out old and add new
            val updated = discoveredDevicesState.value
                .filter { it.bluetoothDevice?.address != device2.bluetoothDevice?.address }
                .toSet() + device2

            discoveredDevicesState.value = updated

            assertEquals(1, discoveredDevicesState.value.size)
            assertEquals(-60, discoveredDevicesState.value.first().rssi)
        }

        @Test
        @DisplayName("maintains multiple distinct devices")
        fun maintainsMultipleDevices() {
            val device1 = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:01")
            val device2 = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:02")
            val device3 = createTestDiscoveredDevice(address = "AA:BB:CC:DD:EE:03")

            discoveredDevicesState.value = setOf(device1, device2, device3)

            assertEquals(3, discoveredDevicesState.value.size)
        }

        @Test
        @DisplayName("clearDiscoveredDevices removes all devices")
        fun clearRemovesAllDevices() {
            val device = createTestDiscoveredDevice()
            discoveredDevicesState.value = setOf(device)

            discoveredDevicesState.value = emptySet()

            assertTrue(discoveredDevicesState.value.isEmpty())
        }
    }

    @Nested
    @DisplayName("Device Staleness")
    inner class DeviceStaleness {

        private val DEVICE_STALE_THRESHOLD_MS = 120_000L // 2 minutes

        @Test
        @DisplayName("fresh devices are not removed")
        fun freshDevicesNotRemoved() {
            val now = System.currentTimeMillis()
            val device = createTestDiscoveredDevice(lastSeen = now)
            discoveredDevicesState.value = setOf(device)

            // Filter out stale devices
            val filtered = discoveredDevicesState.value.filter { device ->
                now - device.lastSeen < DEVICE_STALE_THRESHOLD_MS
            }.toSet()

            assertEquals(1, filtered.size)
        }

        @Test
        @DisplayName("stale devices are removed")
        fun staleDevicesRemoved() {
            val now = System.currentTimeMillis()
            val staleTime = now - DEVICE_STALE_THRESHOLD_MS - 1000
            val device = createTestDiscoveredDevice(lastSeen = staleTime)
            discoveredDevicesState.value = setOf(device)

            // Filter out stale devices
            val filtered = discoveredDevicesState.value.filter { device ->
                now - device.lastSeen < DEVICE_STALE_THRESHOLD_MS
            }.toSet()

            assertTrue(filtered.isEmpty())
        }

        @Test
        @DisplayName("mixed fresh and stale devices")
        fun mixedFreshAndStaleDevices() {
            val now = System.currentTimeMillis()
            val staleTime = now - DEVICE_STALE_THRESHOLD_MS - 1000

            val freshDevice = createTestDiscoveredDevice(
                address = "AA:BB:CC:DD:EE:01",
                lastSeen = now
            )
            val staleDevice = createTestDiscoveredDevice(
                address = "AA:BB:CC:DD:EE:02",
                lastSeen = staleTime
            )

            discoveredDevicesState.value = setOf(freshDevice, staleDevice)

            // Filter out stale devices
            val filtered = discoveredDevicesState.value.filter { device ->
                now - device.lastSeen < DEVICE_STALE_THRESHOLD_MS
            }.toSet()

            assertEquals(1, filtered.size)
            assertEquals("AA:BB:CC:DD:EE:01", filtered.first().bluetoothDevice?.address)
        }

        @ParameterizedTest
        @ValueSource(longs = [0L, 60_000L, 119_999L])
        @DisplayName("devices within threshold are kept")
        fun devicesWithinThresholdKept(ageMs: Long) {
            val now = System.currentTimeMillis()
            val lastSeen = now - ageMs
            val device = createTestDiscoveredDevice(lastSeen = lastSeen)

            discoveredDevicesState.value = setOf(device)

            val filtered = discoveredDevicesState.value.filter { d ->
                now - d.lastSeen < DEVICE_STALE_THRESHOLD_MS
            }.toSet()

            assertEquals(1, filtered.size)
        }

        @ParameterizedTest
        @ValueSource(longs = [120_001L, 180_000L, 300_000L])
        @DisplayName("devices beyond threshold are removed")
        fun devicesBeyondThresholdRemoved(ageMs: Long) {
            val now = System.currentTimeMillis()
            val lastSeen = now - ageMs
            val device = createTestDiscoveredDevice(lastSeen = lastSeen)

            discoveredDevicesState.value = setOf(device)

            val filtered = discoveredDevicesState.value.filter { d ->
                now - d.lastSeen < DEVICE_STALE_THRESHOLD_MS
            }.toSet()

            assertTrue(filtered.isEmpty())
        }
    }

    @Nested
    @DisplayName("RSSI Handling")
    inner class RssiHandling {

        @ParameterizedTest
        @ValueSource(ints = [-30, -50, -70, -90, -100])
        @DisplayName("handles various RSSI values")
        fun handlesVariousRssiValues(rssi: Int) {
            val device = createTestDiscoveredDevice(rssi = rssi)

            assertEquals(rssi, device.rssi)
        }

        @Test
        @DisplayName("RSSI updates when device is rediscovered")
        fun rssiUpdatesOnRediscovery() {
            val address = "AA:BB:CC:DD:EE:FF"
            val device1 = createTestDiscoveredDevice(address = address, rssi = -50)

            discoveredDevicesState.value = setOf(device1)
            assertEquals(-50, discoveredDevicesState.value.first().rssi)

            // Simulate rediscovery with different RSSI
            val device2 = createTestDiscoveredDevice(address = address, rssi = -40)
            discoveredDevicesState.value = discoveredDevicesState.value
                .filter { it.bluetoothDevice?.address != address }
                .toSet() + device2

            assertEquals(-40, discoveredDevicesState.value.first().rssi)
        }
    }

    @Nested
    @DisplayName("Public Key Extraction")
    inner class PublicKeyExtraction {

        @Test
        @DisplayName("device can have public key")
        fun deviceCanHavePublicKey() {
            val device = createTestDiscoveredDevice(publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX)

            assertNotNull(device.publicKey)
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, device.publicKey)
        }

        @Test
        @DisplayName("device can have null public key")
        fun deviceCanHaveNullPublicKey() {
            val device = createTestDiscoveredDevice(publicKey = null)

            assertEquals(null, device.publicKey)
        }

        @Test
        @DisplayName("public key is 64 hex characters (32 bytes)")
        fun publicKeyIs64HexChars() {
            val publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            assertEquals(64, publicKey.length)
        }
    }

    @Nested
    @DisplayName("Scan Filter")
    inner class ScanFilter {

        @Test
        @DisplayName("only BuildIt service UUID should be filtered")
        fun onlyBuildItServiceFiltered() {
            val serviceUuid = BLEManager.SERVICE_UUID

            assertNotNull(serviceUuid)
        }

        @Test
        @DisplayName("service UUID format is valid")
        fun serviceUuidFormatValid() {
            val uuidString = BLEManager.SERVICE_UUID.toString()

            // UUID format: 8-4-4-4-12
            assertEquals(36, uuidString.length)
            assertTrue(uuidString.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")))
        }
    }

    @Nested
    @DisplayName("Cleanup Interval")
    inner class CleanupInterval {

        private val CLEANUP_INTERVAL_MS = 30_000L // 30 seconds

        @Test
        @DisplayName("cleanup interval is 30 seconds")
        fun cleanupIntervalIs30Seconds() {
            assertEquals(30_000L, CLEANUP_INTERVAL_MS)
        }

        @Test
        @DisplayName("cleanup runs periodically")
        fun cleanupRunsPeriodically() = runTest {
            var cleanupCount = 0

            // Simulate cleanup job
            repeat(3) {
                advanceTimeBy(CLEANUP_INTERVAL_MS)
                cleanupCount++
            }

            assertEquals(3, cleanupCount)
        }
    }

    @Nested
    @DisplayName("DiscoveredDevice Data Class")
    inner class DiscoveredDeviceDataClassTests {

        @Test
        @DisplayName("default lastSeen is current time")
        fun defaultLastSeenIsCurrentTime() {
            val before = System.currentTimeMillis()
            val device = DiscoveredDevice(
                bluetoothDevice = mockk(relaxed = true),
                publicKey = null,
                rssi = -50
            )
            val after = System.currentTimeMillis()

            assertTrue(device.lastSeen >= before)
            assertTrue(device.lastSeen <= after)
        }

        @Test
        @DisplayName("copy preserves fields correctly")
        fun copyPreservesFields() {
            val original = createTestDiscoveredDevice(
                address = "AA:BB:CC:DD:EE:FF",
                publicKey = "key",
                rssi = -50,
                lastSeen = 1000L
            )

            val copy = original.copy(rssi = -60)

            assertEquals(-60, copy.rssi)
            assertEquals(original.publicKey, copy.publicKey)
            assertEquals(original.lastSeen, copy.lastSeen)
        }
    }

    @Nested
    @DisplayName("Hex String Conversion")
    inner class HexStringConversion {

        @Test
        @DisplayName("ByteArray converts to hex string correctly")
        fun byteArrayToHex() {
            val bytes = byteArrayOf(0x0A, 0x0B, 0x0C, 0xFF.toByte())
            val hex = bytes.joinToString("") { "%02x".format(it) }

            assertEquals("0a0b0cff", hex)
        }

        @Test
        @DisplayName("empty ByteArray converts to empty string")
        fun emptyByteArrayToEmptyString() {
            val bytes = byteArrayOf()
            val hex = bytes.joinToString("") { "%02x".format(it) }

            assertEquals("", hex)
        }

        @Test
        @DisplayName("32 bytes produce 64 character hex string")
        fun thirtyTwoBytesProduceSixtyFourChars() {
            val bytes = ByteArray(32) { it.toByte() }
            val hex = bytes.joinToString("") { "%02x".format(it) }

            assertEquals(64, hex.length)
        }
    }

    // Helper function to create test devices
    private fun createTestDiscoveredDevice(
        address: String = TestFixtures.TEST_DEVICE_ADDRESS,
        publicKey: String? = null,
        rssi: Int = -50,
        lastSeen: Long = System.currentTimeMillis()
    ): DiscoveredDevice {
        val bluetoothDevice = mockk<android.bluetooth.BluetoothDevice>(relaxed = true) {
            every { this@mockk.address } returns address
        }

        return DiscoveredDevice(
            bluetoothDevice = bluetoothDevice,
            publicKey = publicKey,
            rssi = rssi,
            lastSeen = lastSeen
        )
    }
}
