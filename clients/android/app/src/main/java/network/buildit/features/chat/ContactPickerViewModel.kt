package network.buildit.features.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import network.buildit.core.crypto.Bech32
import network.buildit.core.storage.ContactDao
import network.buildit.core.storage.ContactEntity
import javax.inject.Inject

/**
 * ViewModel for the Contact Picker screen.
 *
 * Manages:
 * - Contact list with search/filter
 * - Contact selection
 */
@HiltViewModel
class ContactPickerViewModel @Inject constructor(
    private val contactDao: ContactDao
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    private val _uiState = MutableStateFlow(ContactPickerUiState())
    val uiState: StateFlow<ContactPickerUiState> = _uiState.asStateFlow()

    init {
        loadContacts()
    }

    /**
     * Loads contacts and sets up filtering.
     */
    private fun loadContacts() {
        viewModelScope.launch {
            combine(
                contactDao.getAllContacts(),
                _searchQuery
            ) { contacts, query ->
                val filtered = if (query.isBlank()) {
                    contacts
                } else {
                    // If query looks like an npub, convert to hex for comparison
                    val hexFromNpub = if (query.startsWith("npub1")) {
                        Bech32.npubToHex(query)
                    } else null

                    contacts.filter { contact ->
                        contact.displayName?.contains(query, ignoreCase = true) == true ||
                                contact.nip05?.contains(query, ignoreCase = true) == true ||
                                contact.pubkey.contains(query, ignoreCase = true) ||
                                (hexFromNpub != null && contact.pubkey.equals(hexFromNpub, ignoreCase = true))
                    }
                }

                // Sort: trusted first, then by name
                val sorted = filtered.sortedWith(
                    compareByDescending<ContactEntity> { it.isTrusted }
                        .thenBy { it.displayName?.lowercase() ?: it.pubkey }
                )

                ContactPickerUiState(
                    allContacts = contacts,
                    filteredContacts = sorted,
                    searchQuery = query,
                    isLoading = false
                )
            }.collect { state ->
                _uiState.value = state
            }
        }
    }

    /**
     * Updates the search query.
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    /**
     * Validates a pubkey format.
     */
    fun isValidPubkey(pubkey: String): Boolean {
        // Basic validation: 64 hex characters
        return pubkey.length == 64 && pubkey.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }
    }

    /**
     * Validates and normalizes a npub to a hex pubkey.
     *
     * @param npub The npub string (e.g., "npub1...")
     * @return The 64-character hex pubkey, or null if invalid
     */
    fun normalizeNpub(npub: String): String? {
        return Bech32.npubToHex(npub)
    }

    /**
     * Converts a hex pubkey to an npub for display.
     *
     * @param hexPubkey The 64-character hex pubkey
     * @return The npub string, or null if invalid
     */
    fun hexToNpub(hexPubkey: String): String? {
        return Bech32.hexToNpub(hexPubkey)
    }

    /**
     * Normalizes input that could be either a hex pubkey or npub.
     *
     * @param input Either a 64-char hex pubkey or an npub string
     * @return The 64-character hex pubkey, or null if invalid
     */
    fun normalizeInput(input: String): String? {
        val trimmed = input.trim()

        // Check if it's already a valid hex pubkey
        if (isValidPubkey(trimmed)) {
            return trimmed.lowercase()
        }

        // Check if it's an npub
        if (trimmed.startsWith("npub1")) {
            return normalizeNpub(trimmed)
        }

        return null
    }
}

/**
 * UI state for the Contact Picker screen.
 */
data class ContactPickerUiState(
    val allContacts: List<ContactEntity> = emptyList(),
    val filteredContacts: List<ContactEntity> = emptyList(),
    val searchQuery: String = "",
    val isLoading: Boolean = true
)
