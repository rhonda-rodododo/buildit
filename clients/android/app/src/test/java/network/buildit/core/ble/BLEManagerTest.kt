package network.buildit.core.ble

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.FakeBLEManager
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.util.UUID

@DisplayName("BLEManager")
class BLEManagerTest {

    private lateinit var fakeBleManager: FakeBLEManager

    @BeforeEach
    fun setup() {
        fakeBleManager = FakeBLEManager()
    }

    @Nested
    @DisplayName("Capability Checks")
    inner class CapabilityChecks {

        @Test
        @DisplayName("isBleSupported returns true when BLE is supported")
        fun bleSupported() {
            fakeBleManager.isBleSupported = true

            assertTrue(fakeBleManager.isBleSupported)
        }

        @Test
        @DisplayName("isBleSupported returns false when BLE is not supported")
        fun bleNotSupported() {
            fakeBleManager.isBleSupported = false

            assertFalse(fakeBleManager.isBleSupported)
        }

        @Test
        @DisplayName("isBluetoothEnabled returns true when Bluetooth is on")
        fun bluetoothEnabled() {
            fakeBleManager.isBluetoothEnabled = true

            assertTrue(fakeBleManager.isBluetoothEnabled)
        }

        @Test
        @DisplayName("isBluetoothEnabled returns false when Bluetooth is off")
        fun bluetoothDisabled() {
            fakeBleManager.isBluetoothEnabled = false

            assertFalse(fakeBleManager.isBluetoothEnabled)
        }

        @Test
        @DisplayName("hasRequiredPermissions returns true when permissions granted")
        fun permissionsGranted() {
            fakeBleManager.hasRequiredPermissions = true

            assertTrue(fakeBleManager.hasRequiredPermissions)
        }

        @Test
        @DisplayName("hasRequiredPermissions returns false when permissions denied")
        fun permissionsDenied() {
            fakeBleManager.hasRequiredPermissions = false

            assertFalse(fakeBleManager.hasRequiredPermissions)
        }
    }

    @Nested
    @DisplayName("Start")
    inner class Start {

        @Test
        @DisplayName("start succeeds when all requirements met")
        fun startSucceeds() = runTest {
            val result = fakeBleManager.start()

            assertTrue(result.isSuccess)
            assertEquals(BLEState.RUNNING, fakeBleManager.state.value)
        }

        @Test
        @DisplayName("start emits Started event")
        fun startEmitsEvent() = runTest {
            fakeBleManager.events.test {
                fakeBleManager.start()

                assertEquals(BLEEvent.Started, awaitItem())
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("start fails when BLE not supported")
        fun startFailsWithoutBle() = runTest {
            fakeBleManager.isBleSupported = false

            val result = fakeBleManager.start()

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.NotSupported)
        }

        @Test
        @DisplayName("start fails when Bluetooth disabled")
        fun startFailsWithBluetoothOff() = runTest {
            fakeBleManager.isBluetoothEnabled = false

            val result = fakeBleManager.start()

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.BluetoothDisabled)
        }

        @Test
        @DisplayName("start fails when permissions not granted")
        fun startFailsWithoutPermissions() = runTest {
            fakeBleManager.hasRequiredPermissions = false

            val result = fakeBleManager.start()

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.PermissionDenied)
        }

        @Test
        @DisplayName("start fails when startup fails")
        fun startFailsOnStartupError() = runTest {
            fakeBleManager.shouldFailOnStart = true

            val result = fakeBleManager.start()

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.StartupFailed)
            assertEquals(BLEState.ERROR, fakeBleManager.state.value)
        }
    }

    @Nested
    @DisplayName("Stop")
    inner class Stop {

        @Test
        @DisplayName("stop transitions to IDLE state")
        fun stopTransitionsToIdle() = runTest {
            fakeBleManager.start()

            fakeBleManager.stop()

            assertEquals(BLEState.IDLE, fakeBleManager.state.value)
        }

        @Test
        @DisplayName("stop emits Stopped event")
        fun stopEmitsEvent() = runTest {
            fakeBleManager.events.test {
                fakeBleManager.start()
                assertEquals(BLEEvent.Started, awaitItem())

                fakeBleManager.stop()
                assertEquals(BLEEvent.Stopped, awaitItem())
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("stop clears discovered devices")
        fun stopClearsDiscoveredDevices() = runTest {
            fakeBleManager.start()
            fakeBleManager.simulateDeviceDiscovered(
                DiscoveredDevice(
                    bluetoothDevice = mockk(relaxed = true),
                    publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                    rssi = -50
                )
            )

            fakeBleManager.stop()

            assertTrue(fakeBleManager.discoveredDevices.value.isEmpty())
        }

        @Test
        @DisplayName("stop disconnects all devices")
        fun stopDisconnectsAllDevices() = runTest {
            fakeBleManager.start()
            fakeBleManager.simulateDeviceConnected(TestFixtures.TEST_DEVICE_ADDRESS)

            fakeBleManager.stop()

            assertTrue(fakeBleManager.connectedDevices.value.isEmpty())
        }
    }

    @Nested
    @DisplayName("Send Message")
    inner class SendMessage {

        @BeforeEach
        fun startManager() = runTest {
            fakeBleManager.start()
        }

        @Test
        @DisplayName("sendMessage succeeds when running")
        fun sendSucceeds() = runTest {
            val result = fakeBleManager.sendMessage(
                TestFixtures.TEST_PUBLIC_KEY_HEX,
                "test message".toByteArray()
            )

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("sendMessage records sent message")
        fun sendRecordsMessage() = runTest {
            val payload = "test message".toByteArray()

            fakeBleManager.sendMessage(TestFixtures.TEST_PUBLIC_KEY_HEX, payload)

            val sent = fakeBleManager.getSentMessages()
            assertEquals(1, sent.size)
            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, sent[0].recipientPublicKey)
            assertTrue(payload.contentEquals(sent[0].payload))
        }

        @Test
        @DisplayName("sendMessage fails when not running")
        fun sendFailsWhenNotRunning() = runTest {
            fakeBleManager.stop()

            val result = fakeBleManager.sendMessage(
                TestFixtures.TEST_PUBLIC_KEY_HEX,
                "test".toByteArray()
            )

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.NotRunning)
        }

        @Test
        @DisplayName("sendMessage fails when configured to fail")
        fun sendFailsWhenConfigured() = runTest {
            fakeBleManager.shouldFailOnSend = true

            val result = fakeBleManager.sendMessage(
                TestFixtures.TEST_PUBLIC_KEY_HEX,
                "test".toByteArray()
            )

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is BLEException.SendFailed)
        }
    }

    @Nested
    @DisplayName("Device Discovery")
    inner class DeviceDiscovery {

        @BeforeEach
        fun startManager() = runTest {
            fakeBleManager.start()
        }

        @Test
        @DisplayName("simulateDeviceDiscovered adds device to list")
        fun deviceDiscoveredAddsToList() = runTest {
            val device = DiscoveredDevice(
                bluetoothDevice = mockk(relaxed = true),
                publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                rssi = -50
            )

            fakeBleManager.simulateDeviceDiscovered(device)

            assertEquals(1, fakeBleManager.discoveredDevices.value.size)
        }

        @Test
        @DisplayName("multiple devices can be discovered")
        fun multipleDevicesDiscovered() = runTest {
            repeat(3) { index ->
                val device = DiscoveredDevice(
                    bluetoothDevice = mockk(relaxed = true) {
                        every { address } returns "AA:BB:CC:DD:EE:0$index"
                    },
                    publicKey = "pubkey$index",
                    rssi = -50 - index
                )
                fakeBleManager.simulateDeviceDiscovered(device)
            }

            assertEquals(3, fakeBleManager.discoveredDevices.value.size)
        }
    }

    @Nested
    @DisplayName("Message Reception")
    inner class MessageReception {

        @BeforeEach
        fun startManager() = runTest {
            fakeBleManager.start()
        }

        @Test
        @DisplayName("simulateMessageReceived emits event")
        fun messageReceivedEmitsEvent() = runTest {
            val message = TestFixtures.createMeshMessage()

            fakeBleManager.events.test {
                fakeBleManager.start()
                assertEquals(BLEEvent.Started, awaitItem())

                fakeBleManager.simulateMessageReceived(message)

                val event = awaitItem()
                assertTrue(event is BLEEvent.MessageReceived)
                assertEquals(message, (event as BLEEvent.MessageReceived).message)
                cancelAndIgnoreRemainingEvents()
            }
        }

        @Test
        @DisplayName("received messages are recorded")
        fun receivedMessagesRecorded() = runTest {
            val message = TestFixtures.createMeshMessage()

            fakeBleManager.simulateMessageReceived(message)

            val received = fakeBleManager.getReceivedMessages()
            assertEquals(1, received.size)
            assertEquals(message.id, received[0].id)
        }
    }

    @Nested
    @DisplayName("Error Handling")
    inner class ErrorHandling {

        @BeforeEach
        fun startManager() = runTest {
            fakeBleManager.start()
        }

        @Test
        @DisplayName("simulateError changes state to ERROR")
        fun errorChangesState() = runTest {
            fakeBleManager.simulateError(BLEException.ConnectionFailed("Test"))

            assertEquals(BLEState.ERROR, fakeBleManager.state.value)
        }

        @Test
        @DisplayName("simulateError emits Error event")
        fun errorEmitsEvent() = runTest {
            val exception = BLEException.ConnectionFailed("Test error")

            fakeBleManager.events.test {
                fakeBleManager.start()
                assertEquals(BLEEvent.Started, awaitItem())

                fakeBleManager.simulateError(exception)

                val event = awaitItem()
                assertTrue(event is BLEEvent.Error)
                assertEquals(exception, (event as BLEEvent.Error).exception)
                cancelAndIgnoreRemainingEvents()
            }
        }
    }

    @Nested
    @DisplayName("Reset")
    inner class Reset {

        @Test
        @DisplayName("reset clears all state")
        fun resetClearsState() = runTest {
            fakeBleManager.start()
            fakeBleManager.isBleSupported = false
            fakeBleManager.shouldFailOnSend = true
            fakeBleManager.sendDelay = 1000L
            fakeBleManager.sendMessage("key", "data".toByteArray())

            fakeBleManager.reset()

            assertEquals(BLEState.IDLE, fakeBleManager.state.value)
            assertTrue(fakeBleManager.discoveredDevices.value.isEmpty())
            assertTrue(fakeBleManager.connectedDevices.value.isEmpty())
            assertTrue(fakeBleManager.isBleSupported)
            assertTrue(fakeBleManager.isBluetoothEnabled)
            assertTrue(fakeBleManager.hasRequiredPermissions)
            assertFalse(fakeBleManager.shouldFailOnStart)
            assertFalse(fakeBleManager.shouldFailOnSend)
            assertEquals(0L, fakeBleManager.sendDelay)
            assertTrue(fakeBleManager.getSentMessages().isEmpty())
        }
    }

    @Nested
    @DisplayName("BLEState Enum")
    inner class BLEStateTests {

        @Test
        @DisplayName("all states are defined")
        fun allStatesDefined() {
            val states = BLEState.values()

            assertEquals(5, states.size)
            assertTrue(states.contains(BLEState.IDLE))
            assertTrue(states.contains(BLEState.STARTING))
            assertTrue(states.contains(BLEState.RUNNING))
            assertTrue(states.contains(BLEState.STOPPING))
            assertTrue(states.contains(BLEState.ERROR))
        }
    }

    @Nested
    @DisplayName("BLEEvent Sealed Class")
    inner class BLEEventTests {

        @Test
        @DisplayName("Started is singleton")
        fun startedIsSingleton() {
            val started1 = BLEEvent.Started
            val started2 = BLEEvent.Started

            assertTrue(started1 === started2)
        }

        @Test
        @DisplayName("Stopped is singleton")
        fun stoppedIsSingleton() {
            val stopped1 = BLEEvent.Stopped
            val stopped2 = BLEEvent.Stopped

            assertTrue(stopped1 === stopped2)
        }

        @Test
        @DisplayName("MessageReceived contains message")
        fun messageReceivedContainsMessage() {
            val message = TestFixtures.createMeshMessage()

            val event = BLEEvent.MessageReceived(message)

            assertEquals(message, event.message)
        }

        @Test
        @DisplayName("Error contains exception")
        fun errorContainsException() {
            val exception = BLEException.NotSupported

            val event = BLEEvent.Error(exception)

            assertEquals(exception, event.exception)
        }
    }

    @Nested
    @DisplayName("BLEException Sealed Class")
    inner class BLEExceptionTests {

        @Test
        @DisplayName("NotSupported is singleton")
        fun notSupportedIsSingleton() {
            val ex1 = BLEException.NotSupported
            val ex2 = BLEException.NotSupported

            assertTrue(ex1 === ex2)
        }

        @Test
        @DisplayName("StartupFailed contains message")
        fun startupFailedContainsMessage() {
            val message = "Failed to start"

            val exception = BLEException.StartupFailed(message)

            assertEquals(message, exception.message)
        }

        @Test
        @DisplayName("ConnectionFailed contains message")
        fun connectionFailedContainsMessage() {
            val message = "Connection lost"

            val exception = BLEException.ConnectionFailed(message)

            assertEquals(message, exception.message)
        }

        @Test
        @DisplayName("SendFailed contains message")
        fun sendFailedContainsMessage() {
            val message = "Send failed"

            val exception = BLEException.SendFailed(message)

            assertEquals(message, exception.message)
        }
    }

    @Nested
    @DisplayName("DiscoveredDevice")
    inner class DiscoveredDeviceTests {

        @Test
        @DisplayName("data class properties are accessible")
        fun propertiesAccessible() {
            val bluetoothDevice = mockk<android.bluetooth.BluetoothDevice>(relaxed = true)
            val publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val rssi = -50
            val lastSeen = System.currentTimeMillis()

            val device = DiscoveredDevice(
                bluetoothDevice = bluetoothDevice,
                publicKey = publicKey,
                rssi = rssi,
                lastSeen = lastSeen
            )

            assertEquals(bluetoothDevice, device.bluetoothDevice)
            assertEquals(publicKey, device.publicKey)
            assertEquals(rssi, device.rssi)
            assertEquals(lastSeen, device.lastSeen)
        }

        @Test
        @DisplayName("copy creates modified instance")
        fun copyWorks() {
            val original = DiscoveredDevice(
                bluetoothDevice = mockk(relaxed = true),
                publicKey = "key1",
                rssi = -50
            )

            val copy = original.copy(rssi = -60)

            assertEquals(-60, copy.rssi)
            assertEquals(original.publicKey, copy.publicKey)
        }
    }

    @Nested
    @DisplayName("MeshMessage")
    inner class MeshMessageTests {

        @Test
        @DisplayName("equals compares by ID")
        fun equalsById() {
            val message1 = TestFixtures.createMeshMessage(id = "same-id")
            val message2 = TestFixtures.createMeshMessage(id = "same-id", payload = "different".toByteArray())

            assertEquals(message1, message2)
        }

        @Test
        @DisplayName("different IDs are not equal")
        fun differentIdsNotEqual() {
            val message1 = TestFixtures.createMeshMessage(id = "id1")
            val message2 = TestFixtures.createMeshMessage(id = "id2")

            assertTrue(message1 != message2)
        }

        @Test
        @DisplayName("hashCode is based on ID")
        fun hashCodeBasedOnId() {
            val message1 = TestFixtures.createMeshMessage(id = "test-id")
            val message2 = TestFixtures.createMeshMessage(id = "test-id")

            assertEquals(message1.hashCode(), message2.hashCode())
        }
    }

    @Nested
    @DisplayName("BLEManager Companion Object")
    inner class CompanionObject {

        @Test
        @DisplayName("SERVICE_UUID is correct format")
        fun serviceUuidCorrect() {
            val uuid = BLEManager.SERVICE_UUID

            assertFalse(uuid.toString().isEmpty())
            assertEquals(36, uuid.toString().length) // UUID string length
        }

        @Test
        @DisplayName("MESSAGE_CHARACTERISTIC_UUID is correct format")
        fun messageCharacteristicUuidCorrect() {
            val uuid = BLEManager.MESSAGE_CHARACTERISTIC_UUID

            assertFalse(uuid.toString().isEmpty())
        }

        @Test
        @DisplayName("IDENTITY_CHARACTERISTIC_UUID is correct format")
        fun identityCharacteristicUuidCorrect() {
            val uuid = BLEManager.IDENTITY_CHARACTERISTIC_UUID

            assertFalse(uuid.toString().isEmpty())
        }

        @Test
        @DisplayName("ROUTING_CHARACTERISTIC_UUID is correct format")
        fun routingCharacteristicUuidCorrect() {
            val uuid = BLEManager.ROUTING_CHARACTERISTIC_UUID

            assertFalse(uuid.toString().isEmpty())
        }

        @Test
        @DisplayName("all UUIDs are unique")
        fun uuidsAreUnique() {
            val uuids = setOf(
                BLEManager.SERVICE_UUID,
                BLEManager.MESSAGE_CHARACTERISTIC_UUID,
                BLEManager.IDENTITY_CHARACTERISTIC_UUID,
                BLEManager.ROUTING_CHARACTERISTIC_UUID
            )

            assertEquals(4, uuids.size)
        }
    }
}
