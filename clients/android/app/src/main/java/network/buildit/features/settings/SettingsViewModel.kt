package network.buildit.features.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.BLEState
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.KeystoreManager
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrProfile
import network.buildit.core.nostr.RelayPool
import javax.inject.Inject

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "settings"
)

/**
 * ViewModel for the Settings feature.
 *
 * Manages:
 * - User profile settings
 * - Network configuration
 * - Security settings
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val cryptoManager: CryptoManager,
    private val keystoreManager: KeystoreManager,
    private val bleManager: BLEManager,
    private val relayPool: RelayPool,
    private val nostrClient: NostrClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private val _keyExportEvent = MutableSharedFlow<KeyExportEvent>(extraBufferCapacity = 1)
    val keyExportEvent: SharedFlow<KeyExportEvent> = _keyExportEvent.asSharedFlow()

    private val dataStore = context.settingsDataStore

    init {
        loadSettings()
        observeBleState()
        observeRelayState()
    }

    /**
     * Loads settings from DataStore.
     */
    private fun loadSettings() {
        viewModelScope.launch {
            val prefs = dataStore.data.first()

            val displayName = prefs[PreferencesKeys.DISPLAY_NAME]
            val username = prefs[PreferencesKeys.USERNAME]
            val about = prefs[PreferencesKeys.ABOUT]
            val avatarUrl = prefs[PreferencesKeys.AVATAR_URL]
            val nip05 = prefs[PreferencesKeys.NIP05]
            val biometricEnabled = prefs[PreferencesKeys.BIOMETRIC_ENABLED] ?: false

            _uiState.value = _uiState.value.copy(
                displayName = displayName,
                username = username,
                about = about,
                avatarUrl = avatarUrl,
                nip05 = nip05,
                publicKey = cryptoManager.getPublicKeyHex(),
                biometricEnabled = biometricEnabled,
                biometricAvailable = keystoreManager.biometricEnabled.value
            )
        }
    }

    /**
     * Observes BLE state changes.
     */
    private fun observeBleState() {
        viewModelScope.launch {
            bleManager.state.collect { state ->
                _uiState.value = _uiState.value.copy(
                    bleEnabled = state == BLEState.RUNNING
                )
            }
        }
    }

    /**
     * Observes relay connection state.
     */
    private fun observeRelayState() {
        viewModelScope.launch {
            relayPool.connectedRelays.collect { connectedCount ->
                _uiState.value = _uiState.value.copy(
                    connectedRelays = connectedCount,
                    totalRelays = relayPool.configuredRelays.size
                )
            }
        }
    }

    /**
     * Updates the display name and publishes to Nostr.
     */
    fun updateDisplayName(name: String) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[PreferencesKeys.DISPLAY_NAME] = name
            }

            _uiState.value = _uiState.value.copy(
                displayName = name,
                isPublishing = true
            )

            // Publish profile to Nostr
            val profile = NostrProfile(
                displayName = name,
                name = _uiState.value.username,
                about = _uiState.value.about,
                picture = _uiState.value.avatarUrl,
                nip05 = _uiState.value.nip05
            )

            val success = nostrClient.publishProfile(profile)

            _uiState.value = _uiState.value.copy(
                isPublishing = false,
                lastPublishSuccess = success
            )
        }
    }

    /**
     * Updates the username and publishes to Nostr.
     */
    fun updateUsername(username: String) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[PreferencesKeys.USERNAME] = username
            }

            _uiState.value = _uiState.value.copy(
                username = username,
                isPublishing = true
            )

            // Publish profile to Nostr
            val profile = buildCurrentProfile()
            val success = nostrClient.publishProfile(profile)

            _uiState.value = _uiState.value.copy(
                isPublishing = false,
                lastPublishSuccess = success
            )
        }
    }

    /**
     * Updates the about/bio and publishes to Nostr.
     */
    fun updateAbout(about: String) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[PreferencesKeys.ABOUT] = about
            }

            _uiState.value = _uiState.value.copy(
                about = about,
                isPublishing = true
            )

            val profile = buildCurrentProfile()
            val success = nostrClient.publishProfile(profile)

            _uiState.value = _uiState.value.copy(
                isPublishing = false,
                lastPublishSuccess = success
            )
        }
    }

    /**
     * Updates the avatar URL and publishes to Nostr.
     */
    fun updateAvatarUrl(url: String) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[PreferencesKeys.AVATAR_URL] = url
            }

            _uiState.value = _uiState.value.copy(
                avatarUrl = url,
                isPublishing = true
            )

            val profile = buildCurrentProfile()
            val success = nostrClient.publishProfile(profile)

            _uiState.value = _uiState.value.copy(
                isPublishing = false,
                lastPublishSuccess = success
            )
        }
    }

    /**
     * Builds the current profile from UI state.
     */
    private fun buildCurrentProfile(): NostrProfile {
        return NostrProfile(
            name = _uiState.value.username,
            displayName = _uiState.value.displayName,
            about = _uiState.value.about,
            picture = _uiState.value.avatarUrl,
            nip05 = _uiState.value.nip05
        )
    }

    /**
     * Toggles BLE mesh networking.
     */
    fun toggleBle(enabled: Boolean) {
        viewModelScope.launch {
            if (enabled) {
                bleManager.start()
            } else {
                bleManager.stop()
            }
        }
    }

    /**
     * Toggles biometric authentication.
     *
     * When enabled, reinitializes the keystore with biometric protection.
     * This regenerates keys with the new authentication requirement.
     */
    fun toggleBiometric(enabled: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPublishing = true)

            try {
                // Update preference first
                dataStore.edit { prefs ->
                    prefs[PreferencesKeys.BIOMETRIC_ENABLED] = enabled
                }

                // Re-initialize keystore with new biometric requirement
                // Note: This preserves existing identity by backing up and restoring
                if (enabled) {
                    // Initialize keystore with biometric requirement
                    val success = keystoreManager.initialize(requireBiometric = true)
                    if (!success) {
                        // Rollback preference change
                        dataStore.edit { prefs ->
                            prefs[PreferencesKeys.BIOMETRIC_ENABLED] = false
                        }
                        _uiState.value = _uiState.value.copy(
                            biometricEnabled = false,
                            isPublishing = false
                        )
                        return@launch
                    }
                }

                _uiState.value = _uiState.value.copy(
                    biometricEnabled = enabled,
                    isPublishing = false
                )
            } catch (e: Exception) {
                // Rollback on error
                dataStore.edit { prefs ->
                    prefs[PreferencesKeys.BIOMETRIC_ENABLED] = !enabled
                }
                _uiState.value = _uiState.value.copy(
                    biometricEnabled = !enabled,
                    isPublishing = false
                )
            }
        }
    }

    /**
     * Initiates key export process.
     *
     * Security flow:
     * 1. Emit ShowWarning event to display security implications dialog
     * 2. User must acknowledge warning
     * 3. If biometric available, require authentication
     * 4. Generate encrypted key bundle
     * 5. Emit ExportReady event with the bundle data
     */
    fun exportKeys() {
        viewModelScope.launch {
            // Step 1: Show security warning
            _keyExportEvent.emit(KeyExportEvent.ShowWarning)
        }
    }

    /**
     * Called when user acknowledges the security warning.
     * Proceeds with biometric authentication if available.
     */
    fun onExportWarningAccepted() {
        viewModelScope.launch {
            if (_uiState.value.biometricAvailable) {
                // Request biometric authentication
                _keyExportEvent.emit(KeyExportEvent.RequireBiometric)
            } else {
                // No biometric, proceed directly
                performKeyExport()
            }
        }
    }

    /**
     * Called after successful biometric authentication.
     * Performs the actual key export.
     */
    fun onBiometricSuccess() {
        viewModelScope.launch {
            performKeyExport()
        }
    }

    /**
     * Performs the actual key export operation.
     */
    private suspend fun performKeyExport() {
        try {
            _uiState.value = _uiState.value.copy(isPublishing = true)

            val publicKey = cryptoManager.getPublicKeyHex() ?: throw Exception("No public key")

            // Generate a temporary export passphrase
            val exportPassphrase = generateExportPassphrase()

            // Generate a temporary transfer key
            val transferKey = java.security.SecureRandom().generateSeed(32)

            // Export the identity bundle with double encryption
            val bundle = keystoreManager.exportIdentityBundle(exportPassphrase, transferKey)
                ?: throw Exception("Failed to export identity bundle")

            // Create export data
            val exportData = KeyExportData(
                publicKey = publicKey,
                bundleData = android.util.Base64.encodeToString(bundle.serialize(), android.util.Base64.NO_WRAP),
                passphrase = exportPassphrase,
                exportedAt = System.currentTimeMillis()
            )

            _uiState.value = _uiState.value.copy(isPublishing = false)
            _keyExportEvent.emit(KeyExportEvent.ExportReady(exportData))

        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(isPublishing = false)
            _keyExportEvent.emit(KeyExportEvent.ExportFailed(e.message ?: "Unknown error"))
        }
    }

    /**
     * Generates a human-readable export passphrase.
     */
    private fun generateExportPassphrase(): String {
        val random = java.security.SecureRandom()
        val words = PASSPHRASE_WORDS
        return (1..4).map { words[random.nextInt(words.size)] }.joinToString("-")
    }

    companion object {
        private val PASSPHRASE_WORDS = listOf(
            "apple", "brave", "cloud", "delta", "eagle", "frost", "grape", "heart",
            "ivory", "jewel", "karma", "lemon", "maple", "noble", "ocean", "piano",
            "quilt", "river", "storm", "tiger", "ultra", "vivid", "water", "xenon",
            "youth", "zebra", "amber", "blaze", "coral", "dream", "ember", "flame"
        )
    }

    /**
     * Adds a new relay.
     */
    fun addRelay(url: String, read: Boolean = true, write: Boolean = true) {
        relayPool.addRelay(
            network.buildit.core.nostr.RelayConfig(
                url = url,
                read = read,
                write = write
            )
        )
    }

    /**
     * Removes a relay.
     */
    fun removeRelay(url: String) {
        relayPool.removeRelay(url)
    }

    private object PreferencesKeys {
        val DISPLAY_NAME = stringPreferencesKey("display_name")
        val USERNAME = stringPreferencesKey("username")
        val ABOUT = stringPreferencesKey("about")
        val AVATAR_URL = stringPreferencesKey("avatar_url")
        val NIP05 = stringPreferencesKey("nip05")
        val BIOMETRIC_ENABLED = booleanPreferencesKey("biometric_enabled")
    }
}

/**
 * UI state for the Settings screen.
 */
data class SettingsUiState(
    // Profile
    val displayName: String? = null,
    val username: String? = null,
    val about: String? = null,
    val avatarUrl: String? = null,
    val nip05: String? = null,
    val publicKey: String? = null,

    // Status
    val isPublishing: Boolean = false,
    val lastPublishSuccess: Boolean? = null,

    // Settings
    val bleEnabled: Boolean = false,
    val biometricEnabled: Boolean = false,
    val biometricAvailable: Boolean = false,
    val connectedRelays: Int = 0,
    val totalRelays: Int = 0
)

/**
 * Events for the key export flow.
 */
sealed class KeyExportEvent {
    /** Show security warning dialog */
    data object ShowWarning : KeyExportEvent()

    /** Request biometric authentication */
    data object RequireBiometric : KeyExportEvent()

    /** Export is ready - display to user */
    data class ExportReady(val data: KeyExportData) : KeyExportEvent()

    /** Export failed with error message */
    data class ExportFailed(val message: String) : KeyExportEvent()
}

/**
 * Data for exported identity keys.
 */
data class KeyExportData(
    val publicKey: String,
    val bundleData: String,
    val passphrase: String,
    val exportedAt: Long
)
