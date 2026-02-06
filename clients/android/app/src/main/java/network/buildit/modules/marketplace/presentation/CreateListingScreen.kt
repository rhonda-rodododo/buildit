package network.buildit.modules.marketplace.presentation

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.marketplace.data.local.ListingType

/**
 * Create listing screen with form fields.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateListingScreen(
    onNavigateBack: () -> Unit,
    onListingCreated: (String) -> Unit,
    viewModel: MarketplaceViewModel = hiltViewModel()
) {
    val createState by viewModel.createListingState.collectAsState()

    var selectedType by rememberSaveable { mutableStateOf(ListingType.PRODUCT) }
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var priceText by rememberSaveable { mutableStateOf("") }
    var currency by rememberSaveable { mutableStateOf("USD") }
    var availability by rememberSaveable { mutableStateOf("") }
    var contactMethod by rememberSaveable { mutableStateOf("dm") }
    var tagInput by rememberSaveable { mutableStateOf("") }
    val tags = remember { mutableStateListOf<String>() }
    var expirationDays by remember { mutableFloatStateOf(30f) }

    val currencies = listOf("USD", "EUR", "GBP", "BTC", "ETH")
    val contactMethods = listOf("dm" to "Direct Message", "public" to "Public Reply", "external" to "External")

    LaunchedEffect(createState) {
        if (createState is CreateListingState.Success) {
            val listing = (createState as CreateListingState.Success).listing
            viewModel.resetCreateListingState()
            onListingCreated(listing.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Listing") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Listing Type
            item {
                Text(
                    text = "Listing Type",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ListingType.entries.forEach { type ->
                        FilterChip(
                            selected = selectedType == type,
                            onClick = { selectedType = type },
                            label = { Text(type.displayName) }
                        )
                    }
                }
            }

            // Title
            item {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            // Description
            item {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4,
                    maxLines = 8
                )
            }

            // Price & Currency
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedTextField(
                        value = priceText,
                        onValueChange = { priceText = it },
                        label = { Text("Price") },
                        modifier = Modifier.weight(2f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        supportingText = { Text("Leave blank for free / negotiable") }
                    )

                    CurrencyDropdown(
                        selectedCurrency = currency,
                        currencies = currencies,
                        onCurrencySelected = { currency = it },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Availability
            item {
                OutlinedTextField(
                    value = availability,
                    onValueChange = { availability = it },
                    label = { Text("Availability (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    supportingText = { Text("e.g., Weekdays 9am-5pm, Pickup only") }
                )
            }

            // Contact Method
            item {
                Text(
                    text = "Contact Method",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    contactMethods.forEachIndexed { index, (value, label) ->
                        SegmentedButton(
                            selected = contactMethod == value,
                            onClick = { contactMethod = value },
                            shape = SegmentedButtonDefaults.itemShape(
                                index = index,
                                count = contactMethods.size
                            )
                        ) {
                            Text(label, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            // Tags
            item {
                Text(
                    text = "Tags",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = tagInput,
                        onValueChange = { tagInput = it },
                        label = { Text("Add tag") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedButton(
                        onClick = {
                            val trimmed = tagInput.trim().lowercase()
                            if (trimmed.isNotEmpty() && trimmed !in tags) {
                                tags.add(trimmed)
                                tagInput = ""
                            }
                        },
                        enabled = tagInput.trim().isNotEmpty()
                    ) {
                        Text("Add")
                    }
                }

                if (tags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        tags.forEach { tag ->
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Row(
                                    modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = tag,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                    IconButton(
                                        onClick = { tags.remove(tag) },
                                        modifier = Modifier.size(20.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Remove",
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Expiration
            item {
                Text(
                    text = "Expires in ${expirationDays.toInt()} days",
                    style = MaterialTheme.typography.labelLarge
                )
                Slider(
                    value = expirationDays,
                    onValueChange = { expirationDays = it },
                    valueRange = 1f..365f,
                    steps = 0,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Submit Button
            item {
                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        val price = priceText.toDoubleOrNull()?.let { it * 100 } // Convert to cents
                        val expiresAt = System.currentTimeMillis() / 1000 + (expirationDays.toLong() * 86400)

                        viewModel.createListing(
                            type = selectedType,
                            title = title.trim(),
                            description = description.ifBlank { null },
                            price = price,
                            currency = currency,
                            availability = availability.ifBlank { null },
                            tags = tags.toList(),
                            expiresAt = expiresAt,
                            contactMethod = contactMethod
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = title.trim().isNotEmpty() && createState !is CreateListingState.Creating
                ) {
                    if (createState is CreateListingState.Creating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text("Create Listing")
                    }
                }

                if (createState is CreateListingState.Error) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = (createState as CreateListingState.Error).message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
fun CurrencyDropdown(
    selectedCurrency: String,
    currencies: List<String>,
    onCurrencySelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(selectedCurrency)
        }

        androidx.compose.material3.DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            currencies.forEach { cur ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(cur) },
                    onClick = {
                        onCurrencySelected(cur)
                        expanded = false
                    }
                )
            }
        }
    }
}
