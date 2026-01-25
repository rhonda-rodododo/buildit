package network.buildit.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.R
import network.buildit.core.storage.ContactEntity
import network.buildit.ui.theme.BuildItTheme

/**
 * Contact picker screen for starting a new chat.
 *
 * @param viewModel The view model
 * @param onContactSelected Called when a contact is selected, passes the pubkey
 * @param onManualEntry Called when user wants to enter a pubkey manually
 * @param onBack Called when back is pressed
 */
@Composable
fun ContactPickerScreen(
    viewModel: ContactPickerViewModel = hiltViewModel(),
    onContactSelected: (String) -> Unit,
    onManualEntry: () -> Unit = {},
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    ContactPickerContent(
        contacts = uiState.filteredContacts,
        searchQuery = uiState.searchQuery,
        isLoading = uiState.isLoading,
        onSearchQueryChanged = viewModel::updateSearchQuery,
        onContactSelected = onContactSelected,
        onManualEntry = onManualEntry,
        onBack = onBack
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactPickerContent(
    contacts: List<ContactEntity>,
    searchQuery: String,
    isLoading: Boolean,
    onSearchQueryChanged: (String) -> Unit,
    onContactSelected: (String) -> Unit,
    onManualEntry: () -> Unit,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.contact_picker_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search bar
            SearchBar(
                query = searchQuery,
                onQueryChanged = onSearchQueryChanged,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Manual entry option
            ManualEntryItem(
                onClick = onManualEntry
            )

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            // Contacts list
            if (contacts.isEmpty() && searchQuery.isEmpty()) {
                EmptyContactsView(
                    modifier = Modifier.weight(1f)
                )
            } else if (contacts.isEmpty()) {
                NoResultsView(
                    query = searchQuery,
                    modifier = Modifier.weight(1f)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    items(contacts, key = { it.pubkey }) { contact ->
                        ContactListItem(
                            contact = contact,
                            onClick = { onContactSelected(contact.pubkey) }
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 72.dp),
                            color = MaterialTheme.colorScheme.outlineVariant
                        )
                    }
                }
            }
        }
    }
}

/**
 * Search bar for filtering contacts.
 */
@Composable
private fun SearchBar(
    query: String,
    onQueryChanged: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChanged,
        modifier = modifier,
        placeholder = {
            Text(stringResource(R.string.contact_picker_search_placeholder))
        },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChanged("") }) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Clear",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent
        ),
        shape = RoundedCornerShape(24.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search)
    )
}

/**
 * Option to manually enter a pubkey.
 */
@Composable
private fun ManualEntryItem(
    onClick: () -> Unit
) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.PersonAdd,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        },
        headlineContent = {
            Text(
                text = stringResource(R.string.contact_picker_enter_pubkey),
                style = MaterialTheme.typography.titleMedium
            )
        },
        supportingContent = {
            Text(
                text = stringResource(R.string.contact_picker_enter_pubkey_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    )
}

/**
 * A single contact in the list.
 */
@Composable
private fun ContactListItem(
    contact: ContactEntity,
    onClick: () -> Unit
) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        leadingContent = {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center
            ) {
                if (contact.avatarUrl != null) {
                    // TODO: Load avatar image with Coil
                    Text(
                        text = (contact.displayName ?: contact.pubkey).take(2).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                } else {
                    Text(
                        text = (contact.displayName ?: contact.pubkey).take(2).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        },
        headlineContent = {
            Text(
                text = contact.displayName ?: formatPubkey(contact.pubkey),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        supportingContent = {
            Column {
                contact.nip05?.let { nip05 ->
                    Text(
                        text = nip05,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (contact.displayName != null) {
                    Text(
                        text = formatPubkey(contact.pubkey),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        },
        trailingContent = {
            if (contact.isTrusted) {
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        text = "Trusted",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }
    )
}

/**
 * Empty state when there are no contacts.
 */
@Composable
private fun EmptyContactsView(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Text(
                text = stringResource(R.string.contact_picker_no_contacts),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = stringResource(R.string.contact_picker_no_contacts_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * No results view when search has no matches.
 */
@Composable
private fun NoResultsView(
    query: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Default.Search,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Text(
                text = "No contacts found for \"$query\"",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Formats a public key for display.
 */
private fun formatPubkey(pubkey: String): String {
    return if (pubkey.length > 16) {
        "${pubkey.take(8)}...${pubkey.takeLast(8)}"
    } else {
        pubkey
    }
}

@Preview(showBackground = true)
@Composable
private fun ContactPickerPreview() {
    BuildItTheme {
        ContactPickerContent(
            contacts = listOf(
                ContactEntity(
                    pubkey = "abc123def456",
                    displayName = "Alice",
                    avatarUrl = null,
                    nip05 = "alice@example.com",
                    about = null,
                    isTrusted = true
                ),
                ContactEntity(
                    pubkey = "xyz789ghi012",
                    displayName = "Bob",
                    avatarUrl = null,
                    nip05 = null,
                    about = null,
                    isTrusted = false
                )
            ),
            searchQuery = "",
            isLoading = false,
            onSearchQueryChanged = {},
            onContactSelected = {},
            onManualEntry = {},
            onBack = {}
        )
    }
}
