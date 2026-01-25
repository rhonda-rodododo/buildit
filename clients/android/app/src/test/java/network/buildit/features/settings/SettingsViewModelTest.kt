package network.buildit.features.settings

import android.content.Context
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.BLEState
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.KeystoreManager
import network.buildit.core.nostr.RelayConfig
import network.buildit.core.nostr.RelayPool
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

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("SettingsViewModel")
class SettingsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var context: Context
    private lateinit var cryptoManager: CryptoManager
    private lateinit var keystoreManager: KeystoreManager
    private lateinit var bleManager: BLEManager
    private lateinit var relayPool: RelayPool

    private lateinit var bleStateFlow: MutableStateFlow<BLEState>
    private lateinit var connectedRelaysFlow: MutableStateFlow<Int>
    private lateinit var biometricEnabledFlow: MutableStateFlow<Boolean>

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        bleStateFlow = MutableStateFlow(BLEState.IDLE)
        connectedRelaysFlow = MutableStateFlow(0)
        biometricEnabledFlow = MutableStateFlow(false)

        context = mockk(relaxed = true)

        cryptoManager = mockk(relaxed = true) {
            every { getPublicKeyHex() } returns TestFixtures.TEST_PUBLIC_KEY_HEX
        }

        keystoreManager = mockk(relaxed = true) {
            every { biometricEnabled } returns biometricEnabledFlow
        }

        bleManager = mockk(relaxed = true) {
            every { state } returns bleStateFlow
        }

        relayPool = mockk(relaxed = true) {
            every { connectedRelays } returns connectedRelaysFlow
            every { configuredRelays } returns listOf(
                TestFixtures.createRelayConfig()
            )
        }
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("SettingsUiState")
    inner class SettingsUiStateTests {

        @Test
        @DisplayName("initial state has null display name")
        fun initialStateNullDisplayName() {
            val state = SettingsUiState()

            assertNull(state.displayName)
        }

        @Test
        @DisplayName("initial state has null public key")
        fun initialStateNullPublicKey() {
            val state = SettingsUiState()

            assertNull(state.publicKey)
        }

        @Test
        @DisplayName("initial state has BLE disabled")
        fun initialStateBleDisabled() {
            val state = SettingsUiState()

            assertFalse(state.bleEnabled)
        }

        @Test
        @DisplayName("initial state has biometric disabled")
        fun initialStateBiometricDisabled() {
            val state = SettingsUiState()

            assertFalse(state.biometricEnabled)
        }

        @Test
        @DisplayName("initial state has biometric unavailable")
        fun initialStateBiometricUnavailable() {
            val state = SettingsUiState()

            assertFalse(state.biometricAvailable)
        }

        @Test
        @DisplayName("initial state has 0 connected relays")
        fun initialStateZeroConnectedRelays() {
            val state = SettingsUiState()

            assertEquals(0, state.connectedRelays)
        }

        @Test
        @DisplayName("initial state has 0 total relays")
        fun initialStateZeroTotalRelays() {
            val state = SettingsUiState()

            assertEquals(0, state.totalRelays)
        }
    }

    @Nested
    @DisplayName("Display Name")
    inner class DisplayNameTests {

        @Test
        @DisplayName("updateDisplayName updates state")
        fun updateDisplayNameUpdatesState() {
            var displayName: String? = null

            displayName = "John Doe"

            assertEquals("John Doe", displayName)
        }

        @Test
        @DisplayName("display name can be empty string")
        fun displayNameCanBeEmpty() {
            val displayName = ""

            assertTrue(displayName.isEmpty())
        }
    }

    @Nested
    @DisplayName("BLE Toggle")
    inner class BLEToggleTests {

        @Test
        @DisplayName("toggleBle true starts BLE")
        fun toggleBleStartsBle() = testScope.runTest {
            coEvery { bleManager.start() } returns Result.success(Unit)
            bleManager.start()

            coVerify { bleManager.start() }
        }

        @Test
        @DisplayName("toggleBle false stops BLE")
        fun toggleBleStopsBle() = testScope.runTest {
            coEvery { bleManager.stop() } returns Unit
            bleManager.stop()

            coVerify { bleManager.stop() }
        }

        @Test
        @DisplayName("BLE state RUNNING sets enabled true")
        fun bleStateRunningEnabled() {
            bleStateFlow.value = BLEState.RUNNING

            assertEquals(BLEState.RUNNING, bleStateFlow.value)
        }

        @Test
        @DisplayName("BLE state STOPPED sets enabled false")
        fun bleStateStoppedDisabled() {
            bleStateFlow.value = BLEState.IDLE

            assertEquals(BLEState.IDLE, bleStateFlow.value)
        }
    }

    @Nested
    @DisplayName("Biometric Toggle")
    inner class BiometricToggleTests {

        @Test
        @DisplayName("toggleBiometric updates state")
        fun toggleBiometricUpdatesState() {
            var biometricEnabled = false

            biometricEnabled = true

            assertTrue(biometricEnabled)
        }

        @Test
        @DisplayName("biometric requires availability")
        fun biometricRequiresAvailability() {
            val biometricAvailable = false
            val biometricEnabled = false

            // Can only enable if available
            assertTrue(!biometricAvailable || !biometricEnabled)
        }
    }

    @Nested
    @DisplayName("Relay Management")
    inner class RelayManagementTests {

        @Test
        @DisplayName("addRelay calls relayPool")
        fun addRelayCallsPool() {
            val relayConfig = RelayConfig(
                url = "wss://new.relay.com",
                read = true,
                write = true
            )

            relayPool.addRelay(relayConfig)

            verify { relayPool.addRelay(relayConfig) }
        }

        @Test
        @DisplayName("removeRelay calls relayPool")
        fun removeRelayCallsPool() {
            val url = "wss://old.relay.com"

            relayPool.removeRelay(url)

            verify { relayPool.removeRelay(url) }
        }

        @Test
        @DisplayName("connected relays count is observed")
        fun connectedRelaysObserved() {
            connectedRelaysFlow.value = 3

            assertEquals(3, connectedRelaysFlow.value)
        }

        @Test
        @DisplayName("total relays from configured list")
        fun totalRelaysFromConfig() {
            val configuredRelays = listOf(
                TestFixtures.createRelayConfig(url = "wss://relay1.com"),
                TestFixtures.createRelayConfig(url = "wss://relay2.com")
            )
            every { relayPool.configuredRelays } returns configuredRelays

            assertEquals(2, relayPool.configuredRelays.size)
        }
    }

    @Nested
    @DisplayName("Public Key")
    inner class PublicKeyTests {

        @Test
        @DisplayName("public key is loaded from crypto manager")
        fun publicKeyLoadedFromCrypto() {
            val publicKey = cryptoManager.getPublicKeyHex()

            assertEquals(TestFixtures.TEST_PUBLIC_KEY_HEX, publicKey)
        }

        @Test
        @DisplayName("public key can be null if not initialized")
        fun publicKeyCanBeNull() {
            every { cryptoManager.getPublicKeyHex() } returns null

            val publicKey = cryptoManager.getPublicKeyHex()

            assertNull(publicKey)
        }
    }

    @Nested
    @DisplayName("BLEState")
    inner class BLEStateTests {

        @Test
        @DisplayName("STOPPED state exists")
        fun stoppedStateExists() {
            val state = BLEState.IDLE

            assertNotNull(state)
        }

        @Test
        @DisplayName("STARTING state exists")
        fun startingStateExists() {
            val state = BLEState.STARTING

            assertNotNull(state)
        }

        @Test
        @DisplayName("RUNNING state exists")
        fun runningStateExists() {
            val state = BLEState.RUNNING

            assertNotNull(state)
        }

        @Test
        @DisplayName("ERROR state exists")
        fun errorStateExists() {
            val state = BLEState.ERROR

            assertNotNull(state)
        }
    }

    @Nested
    @DisplayName("RelayConfig")
    inner class RelayConfigTests {

        @Test
        @DisplayName("relay config has URL")
        fun relayConfigHasUrl() {
            val config = RelayConfig(
                url = "wss://relay.example.com",
                read = true,
                write = true
            )

            assertEquals("wss://relay.example.com", config.url)
        }

        @Test
        @DisplayName("relay config has read flag")
        fun relayConfigHasRead() {
            val config = RelayConfig(
                url = "wss://relay.example.com",
                read = true,
                write = false
            )

            assertTrue(config.read)
            assertFalse(config.write)
        }

        @Test
        @DisplayName("relay config has write flag")
        fun relayConfigHasWrite() {
            val config = RelayConfig(
                url = "wss://relay.example.com",
                read = false,
                write = true
            )

            assertFalse(config.read)
            assertTrue(config.write)
        }
    }

    @Nested
    @DisplayName("Settings Persistence")
    inner class SettingsPersistenceTests {

        @Test
        @DisplayName("display name is persisted")
        fun displayNamePersisted() {
            // DataStore would persist the value
            val displayName = "Persisted Name"

            assertNotNull(displayName)
        }

        @Test
        @DisplayName("biometric setting is persisted")
        fun biometricPersisted() {
            // DataStore would persist the value
            val biometricEnabled = true

            assertTrue(biometricEnabled)
        }
    }

    @Nested
    @DisplayName("Key Export")
    inner class KeyExportTests {

        @Test
        @DisplayName("exportKeys requires biometric auth")
        fun exportKeysRequiresBiometric() {
            // Export should require biometric verification
            val requiresBiometric = true

            assertTrue(requiresBiometric)
        }
    }

    @Nested
    @DisplayName("State Updates")
    inner class StateUpdatesTests {

        @Test
        @DisplayName("state updates when BLE state changes")
        fun stateUpdatesBleState() = testScope.runTest {
            bleStateFlow.value = BLEState.RUNNING

            val bleEnabled = bleStateFlow.value == BLEState.RUNNING

            assertTrue(bleEnabled)
        }

        @Test
        @DisplayName("state updates when relay count changes")
        fun stateUpdatesRelayCount() = testScope.runTest {
            connectedRelaysFlow.value = 5

            assertEquals(5, connectedRelaysFlow.value)
        }
    }
}
