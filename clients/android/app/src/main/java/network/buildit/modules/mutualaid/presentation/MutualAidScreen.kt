package network.buildit.modules.mutualaid.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.mutualaid.data.local.*

/**
 * Main mutual aid screen with tabs for requests and offers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MutualAidScreen(
    onNavigateToCreateRequest: () -> Unit,
    onNavigateToCreateOffer: () -> Unit,
    onNavigateToRequestDetail: (String) -> Unit,
    onNavigateToOfferDetail: (String) -> Unit,
    viewModel: MutualAidViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mutual Aid") },
                actions = {
                    IconButton(onClick = {
                        if (uiState.selectedTab == 0) {
                            onNavigateToCreateRequest()
                        } else {
                            onNavigateToCreateOffer()
                        }
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "Add")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Tab Row
            TabRow(selectedTabIndex = uiState.selectedTab) {
                Tab(
                    selected = uiState.selectedTab == 0,
                    onClick = { viewModel.selectTab(0) },
                    text = { Text("Requests") }
                )
                Tab(
                    selected = uiState.selectedTab == 1,
                    onClick = { viewModel.selectTab(1) },
                    text = { Text("Offers") }
                )
            }

            // Category filter
            CategoryFilterRow(
                selectedCategory = uiState.selectedCategory,
                onCategorySelected = { viewModel.selectCategory(it) }
            )

            // Content
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                if (uiState.selectedTab == 0) {
                    RequestsList(
                        requests = uiState.requests,
                        onRequestClick = onNavigateToRequestDetail
                    )
                } else {
                    OffersList(
                        offers = uiState.offers,
                        onOfferClick = onNavigateToOfferDetail
                    )
                }
            }
        }
    }
}

/**
 * Horizontal scrolling category filter chips.
 */
@Composable
fun CategoryFilterRow(
    selectedCategory: AidCategory?,
    onCategorySelected: (AidCategory?) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selectedCategory == null,
            onClick = { onCategorySelected(null) },
            label = { Text("All") }
        )

        AidCategory.values().forEach { category ->
            FilterChip(
                selected = selectedCategory == category,
                onClick = { onCategorySelected(category) },
                label = { Text(category.displayName) }
            )
        }
    }
}

/**
 * List of aid requests.
 */
@Composable
fun RequestsList(
    requests: List<AidRequestEntity>,
    onRequestClick: (String) -> Unit
) {
    if (requests.isEmpty()) {
        EmptyStateView(
            icon = Icons.Default.VolunteerActivism,
            title = "No requests yet",
            message = "Be the first to create a mutual aid request"
        )
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(requests, key = { it.id }) { request ->
                RequestCard(
                    request = request,
                    onClick = { onRequestClick(request.id) }
                )
            }
        }
    }
}

/**
 * Card displaying a single request.
 */
@Composable
fun RequestCard(
    request: AidRequestEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Category,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = request.category.displayName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.weight(1f))
                UrgencyChip(urgency = request.urgency)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = request.title,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            request.description?.let { description ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = request.locationDisplay,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                // Progress if has quantity
                request.quantityNeeded?.let {
                    LinearProgressIndicator(
                        progress = request.progressPercentage,
                        modifier = Modifier.width(60.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }

                Text(
                    text = formatRelativeTime(request.createdAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Urgency indicator chip.
 */
@Composable
fun UrgencyChip(urgency: UrgencyLevel) {
    val (backgroundColor, textColor) = when (urgency) {
        UrgencyLevel.LOW -> Pair(Color(0xFFE8F5E9), Color(0xFF2E7D32))
        UrgencyLevel.MEDIUM -> Pair(Color(0xFFFFF8E1), Color(0xFFF57F17))
        UrgencyLevel.HIGH -> Pair(Color(0xFFFFF3E0), Color(0xFFE65100))
        UrgencyLevel.CRITICAL -> Pair(Color(0xFFFFEBEE), Color(0xFFC62828))
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = backgroundColor
    ) {
        Text(
            text = urgency.displayName,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

/**
 * List of aid offers.
 */
@Composable
fun OffersList(
    offers: List<AidOfferEntity>,
    onOfferClick: (String) -> Unit
) {
    if (offers.isEmpty()) {
        EmptyStateView(
            icon = Icons.Default.CardGiftcard,
            title = "No offers yet",
            message = "Share what you can offer to help others"
        )
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(offers, key = { it.id }) { offer ->
                OfferCard(
                    offer = offer,
                    onClick = { onOfferClick(offer.id) }
                )
            }
        }
    }
}

/**
 * Card displaying a single offer.
 */
@Composable
fun OfferCard(
    offer: AidOfferEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Category,
                    contentDescription = null,
                    tint = Color(0xFF2E7D32),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = offer.category.displayName,
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF2E7D32)
                )
                Spacer(modifier = Modifier.weight(1f))
                if (offer.isActive) {
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = Color(0xFFE8F5E9)
                    ) {
                        Text(
                            text = "Available",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF2E7D32),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = offer.title,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            offer.description?.let { description ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = offer.locationDisplay,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                offer.availableUntil?.let { until ->
                    Text(
                        text = "Until ${formatDate(until)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Empty state placeholder.
 */
@Composable
fun EmptyStateView(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    message: String
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// Utility functions

private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / 60000
    val hours = minutes / 60
    val days = hours / 24

    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        else -> formatDate(timestamp)
    }
}

private fun formatDate(timestamp: Long): String {
    val formatter = java.text.SimpleDateFormat("MMM d", java.util.Locale.getDefault())
    return formatter.format(java.util.Date(timestamp))
}
