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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
     */
    fun toggleBiometric(enabled: Boolean) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[PreferencesKeys.BIOMETRIC_ENABLED] = enabled
            }

            _uiState.value = _uiState.value.copy(biometricEnabled = enabled)

            // TODO: Re-initialize keystore with biometric requirement
        }
    }

    /**
     * Exports identity keys (shows warning and proceeds).
     */
    fun exportKeys() {
        // TODO: Implement secure key export
        // This should show a warning about security implications
        // and require biometric authentication
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
