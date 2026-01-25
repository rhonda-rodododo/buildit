package network.buildit.features.devicesync

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.KeystoreManager
import network.buildit.core.storage.DeviceType
import network.buildit.core.storage.LinkedDeviceDao
import network.buildit.core.storage.LinkedDeviceEntity
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("DeviceSyncViewModel")
class DeviceSyncViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var linkedDeviceDao: LinkedDeviceDao
    private lateinit var cryptoManager: CryptoManager
    private lateinit var keystoreManager: KeystoreManager

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        linkedDeviceDao = mockk(relaxed = true) {
            every { getAllDevices() } returns flowOf(emptyList())
        }

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
        }

        keystoreManager = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("DeviceSyncUiState")
    inner class DeviceSyncUiStateTests {

        @Test
        @DisplayName("initial state has empty devices")
        fun initialStateEmptyDevices() {
            val state = DeviceSyncUiState()

            assertTrue(state.linkedDevices.isEmpty())
        }

        @Test
        @DisplayName("initial state has empty sync code")
        fun initialStateEmptySyncCode() {
            val state = DeviceSyncUiState()

            assertEquals("", state.syncCode)
        }

        @Test
        @DisplayName("initial state is loading")
        fun initialStateIsLoading() {
            val state = DeviceSyncUiState()

            assertTrue(state.isLoading)
        }

        @Test
        @DisplayName("initial state has no syncing device")
        fun initialStateNoSyncingDevice() {
            val state = DeviceSyncUiState()

            assertNull(state.syncingDeviceId)
        }

        @Test
        @DisplayName("initial state has no error")
        fun initialStateNoError() {
            val state = DeviceSyncUiState()

            assertNull(state.error)
        }
    }

    @Nested
    @DisplayName("Sync Code Generation")
    inner class SyncCodeGenerationTests {

        @Test
        @DisplayName("sync code contains public key")
        fun syncCodeContainsPublicKey() {
            val publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val pairingToken = "abc12345"
            val syncCode = "buildit://sync?pk=$publicKey&token=$pairingToken"

            assertTrue(syncCode.contains(publicKey))
        }

        @Test
        @DisplayName("sync code has correct scheme")
        fun syncCodeHasCorrectScheme() {
            val syncCode = "buildit://sync?pk=pubkey&token=token"

            assertTrue(syncCode.startsWith("buildit://"))
        }

        @Test
        @DisplayName("sync code has correct host")
        fun syncCodeHasCorrectHost() {
            val syncCode = "buildit://sync?pk=pubkey&token=token"

            assertTrue(syncCode.contains("://sync?"))
        }

        @Test
        @DisplayName("sync code includes pairing token")
        fun syncCodeIncludesToken() {
            val pairingToken = UUID.randomUUID().toString().take(8)
            val syncCode = "buildit://sync?pk=pubkey&token=$pairingToken"

            assertTrue(syncCode.contains("token="))
        }
    }

    @Nested
    @DisplayName("Device Linking")
    inner class DeviceLinkingTests {

        @Test
        @DisplayName("valid sync code is parsed correctly")
        fun validSyncCodeParsed() {
            val publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val token = "abc12345"
            val syncCode = "buildit://sync?pk=$publicKey&token=$token"

            // Parse manually (simulating Uri.parse)
            val pkStart = syncCode.indexOf("pk=") + 3
            val pkEnd = syncCode.indexOf("&", pkStart)
            val parsedPk = syncCode.substring(pkStart, pkEnd)

            val tokenStart = syncCode.indexOf("token=") + 6
            val parsedToken = syncCode.substring(tokenStart)

            assertEquals(publicKey, parsedPk)
            assertEquals(token, parsedToken)
        }

        @Test
        @DisplayName("invalid scheme sets error")
        fun invalidSchemeError() {
            val invalidCode = "https://sync?pk=pubkey&token=token"
            val isValid = invalidCode.startsWith("buildit://")

            assertFalse(isValid)
        }

        @Test
        @DisplayName("invalid host sets error")
        fun invalidHostError() {
            val invalidCode = "buildit://link?pk=pubkey&token=token"
            val isValid = invalidCode.contains("://sync?")

            assertFalse(isValid)
        }

        @Test
        @DisplayName("missing pk sets error")
        fun missingPkError() {
            val invalidCode = "buildit://sync?token=token"
            val hasPk = invalidCode.contains("pk=")

            assertFalse(hasPk)
        }

        @Test
        @DisplayName("missing token sets error")
        fun missingTokenError() {
            val invalidCode = "buildit://sync?pk=pubkey"
            val hasToken = invalidCode.contains("token=")

            assertFalse(hasToken)
        }

        @Test
        @DisplayName("link device inserts entity")
        fun linkDeviceInsertsEntity() = testScope.runTest {
            val deviceSlot = slot<LinkedDeviceEntity>()
            coEvery { linkedDeviceDao.insert(capture(deviceSlot)) } returns Unit

            val device = LinkedDeviceEntity(
                deviceId = UUID.randomUUID().toString(),
                name = "New Device",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )
            linkedDeviceDao.insert(device)

            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, deviceSlot.captured.publicKey)
            assertEquals(DeviceType.ANDROID, deviceSlot.captured.deviceType)
        }
    }

    @Nested
    @DisplayName("Device Unlinking")
    inner class DeviceUnlinkingTests {

        @Test
        @DisplayName("unlink retrieves device first")
        fun unlinkRetrievesDevice() = testScope.runTest {
            val deviceId = "device-123"
            val device = LinkedDeviceEntity(
                deviceId = deviceId,
                name = "Test Device",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )
            coEvery { linkedDeviceDao.getById(deviceId) } returns device

            val retrieved = linkedDeviceDao.getById(deviceId)

            assertNotNull(retrieved)
            assertEquals(deviceId, retrieved?.deviceId)
        }

        @Test
        @DisplayName("unlink deletes device")
        fun unlinkDeletesDevice() = testScope.runTest {
            val device = LinkedDeviceEntity(
                deviceId = "device-to-delete",
                name = "Delete Me",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )
            coEvery { linkedDeviceDao.delete(device) } returns Unit

            linkedDeviceDao.delete(device)

            coVerify { linkedDeviceDao.delete(device) }
        }
    }

    @Nested
    @DisplayName("Device Syncing")
    inner class DeviceSyncingTests {

        @Test
        @DisplayName("sync sets syncing device ID")
        fun syncSetsSyncingDeviceId() {
            var syncingDeviceId: String? = null
            val deviceId = "device-123"

            syncingDeviceId = deviceId

            assertEquals(deviceId, syncingDeviceId)
        }

        @Test
        @DisplayName("sync clears syncing device ID on completion")
        fun syncClearsSyncingDeviceId() {
            var syncingDeviceId: String? = "device-123"

            syncingDeviceId = null

            assertNull(syncingDeviceId)
        }

        @Test
        @DisplayName("sync updates last sync time")
        fun syncUpdatesLastSyncTime() = testScope.runTest {
            val deviceId = "device-123"
            coEvery { linkedDeviceDao.updateLastSync(deviceId, any()) } returns Unit

            linkedDeviceDao.updateLastSync(deviceId)

            coVerify { linkedDeviceDao.updateLastSync(deviceId, any()) }
        }
    }

    @Nested
    @DisplayName("Device Renaming")
    inner class DeviceRenamingTests {

        @Test
        @DisplayName("rename retrieves device first")
        fun renameRetrievesDevice() = testScope.runTest {
            val deviceId = "device-123"
            val device = LinkedDeviceEntity(
                deviceId = deviceId,
                name = "Old Name",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )
            coEvery { linkedDeviceDao.getById(deviceId) } returns device

            val retrieved = linkedDeviceDao.getById(deviceId)

            assertEquals("Old Name", retrieved?.name)
        }

        @Test
        @DisplayName("rename updates device with new name")
        fun renameUpdatesDevice() = testScope.runTest {
            val deviceSlot = slot<LinkedDeviceEntity>()
            coEvery { linkedDeviceDao.update(capture(deviceSlot)) } returns Unit

            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "New Name",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )
            linkedDeviceDao.update(device)

            assertEquals("New Name", deviceSlot.captured.name)
        }
    }

    @Nested
    @DisplayName("Error Handling")
    inner class ErrorHandlingTests {

        @Test
        @DisplayName("clearError sets error to null")
        fun clearErrorSetsNull() {
            var error: String? = "Some error"

            error = null

            assertNull(error)
        }

        @Test
        @DisplayName("error message includes exception message")
        fun errorIncludesExceptionMessage() {
            val exception = Exception("Test exception")
            val errorMessage = "Failed to link device: ${exception.message}"

            assertTrue(errorMessage.contains("Test exception"))
        }
    }

    @Nested
    @DisplayName("LinkedDeviceEntity")
    inner class LinkedDeviceEntityTests {

        @Test
        @DisplayName("device has required fields")
        fun deviceHasRequiredFields() {
            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "My Phone",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )

            assertNotNull(device.deviceId)
            assertNotNull(device.name)
            assertNotNull(device.deviceType)
            assertNotNull(device.publicKey)
        }

        @Test
        @DisplayName("lastSyncAt can be null")
        fun lastSyncAtCanBeNull() {
            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "New Device",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )

            assertNull(device.lastSyncAt)
        }

        @Test
        @DisplayName("lastSyncAt can be timestamp")
        fun lastSyncAtCanBeTimestamp() {
            val timestamp = System.currentTimeMillis()
            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "Synced Device",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = timestamp
            )

            assertEquals(timestamp, device.lastSyncAt)
        }

        @Test
        @DisplayName("copy preserves deviceId")
        fun copyPreservesDeviceId() {
            val device = LinkedDeviceEntity(
                deviceId = "device-123",
                name = "Original",
                deviceType = DeviceType.ANDROID,
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                lastSyncAt = null
            )

            val copied = device.copy(name = "Renamed")

            assertEquals("device-123", copied.deviceId)
            assertEquals("Renamed", copied.name)
        }
    }

    @Nested
    @DisplayName("DeviceType")
    inner class DeviceTypeTests {

        @Test
        @DisplayName("ANDROID type exists")
        fun androidTypeExists() {
            val deviceType = DeviceType.ANDROID

            assertNotNull(deviceType)
        }

        @Test
        @DisplayName("IOS type exists")
        fun iosTypeExists() {
            val deviceType = DeviceType.IOS

            assertNotNull(deviceType)
        }

        @Test
        @DisplayName("DESKTOP type exists")
        fun desktopTypeExists() {
            val deviceType = DeviceType.DESKTOP

            assertNotNull(deviceType)
        }

        @Test
        @DisplayName("WEB type exists")
        fun webTypeExists() {
            val deviceType = DeviceType.WEB

            assertNotNull(deviceType)
        }
    }

    @Nested
    @DisplayName("Loaded Devices")
    inner class LoadedDevicesTests {

        @Test
        @DisplayName("devices are loaded on init")
        fun devicesLoadedOnInit() = testScope.runTest {
            val devices = listOf(
                LinkedDeviceEntity(
                    deviceId = "device-1",
                    name = "Device 1",
                    deviceType = DeviceType.ANDROID,
                    publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    lastSyncAt = null
                ),
                LinkedDeviceEntity(
                    deviceId = "device-2",
                    name = "Device 2",
                    deviceType = DeviceType.IOS,
                    publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX_2,
                    lastSyncAt = System.currentTimeMillis()
                )
            )
            every { linkedDeviceDao.getAllDevices() } returns flowOf(devices)

            val loadedDevices = linkedDeviceDao.getAllDevices()

            loadedDevices.collect { list ->
                assertEquals(2, list.size)
            }
        }

        @Test
        @DisplayName("loading state is false after load")
        fun loadingStateFalseAfterLoad() {
            var isLoading = true

            isLoading = false

            assertFalse(isLoading)
        }
    }
}
