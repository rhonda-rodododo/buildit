package network.buildit.modules.governance.presentation

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
import network.buildit.modules.governance.data.local.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main governance screen with tabs for active and completed proposals.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GovernanceScreen(
    onNavigateToCreateProposal: () -> Unit,
    onNavigateToProposalDetail: (String) -> Unit,
    viewModel: GovernanceListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Governance") },
                actions = {
                    IconButton(onClick = onNavigateToCreateProposal) {
                        Icon(Icons.Default.Add, contentDescription = "New Proposal")
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
                    text = { Text("Active") }
                )
                Tab(
                    selected = uiState.selectedTab == 1,
                    onClick = { viewModel.selectTab(1) },
                    text = { Text("Completed") }
                )
            }

            // Type filter
            TypeFilterRow(
                selectedType = uiState.selectedType,
                onTypeSelected = { viewModel.selectType(it) }
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
                val proposals = if (uiState.selectedTab == 0) {
                    uiState.activeProposals
                } else {
                    uiState.completedProposals
                }

                if (proposals.isEmpty()) {
                    EmptyStateView(
                        icon = if (uiState.selectedTab == 0) Icons.Default.HowToVote else Icons.Default.Archive,
                        title = if (uiState.selectedTab == 0) "No active proposals" else "No completed proposals",
                        message = if (uiState.selectedTab == 0) "Create a proposal to start a group decision" else "Completed proposals will appear here"
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(proposals, key = { it.id }) { proposal ->
                            ProposalCard(
                                proposal = proposal,
                                onClick = { onNavigateToProposalDetail(proposal.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Horizontal scrolling type filter chips.
 */
@Composable
fun TypeFilterRow(
    selectedType: ProposalType?,
    onTypeSelected: (ProposalType?) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selectedType == null,
            onClick = { onTypeSelected(null) },
            label = { Text("All") }
        )

        ProposalType.entries.forEach { type ->
            FilterChip(
                selected = selectedType == type,
                onClick = { onTypeSelected(type) },
                label = { Text(type.displayName) }
            )
        }
    }
}

/**
 * Card displaying a single proposal.
 */
@Composable
fun ProposalCard(
    proposal: ProposalEntity,
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
                    imageVector = when (proposal.type) {
                        ProposalType.General -> Icons.Default.Description
                        ProposalType.Policy -> Icons.Default.VerifiedUser
                        ProposalType.Budget -> Icons.Default.AttachMoney
                        ProposalType.Election -> Icons.Default.People
                        ProposalType.Amendment -> Icons.Default.Edit
                        ProposalType.Action -> Icons.Default.FlashOn
                        ProposalType.Resolution -> Icons.Default.Flag
                    },
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = proposal.type.displayName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.weight(1f))
                StatusChip(status = proposal.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = proposal.title,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            proposal.description?.let { description ->
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
                    imageVector = Icons.Default.HowToVote,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = proposal.votingSystem.displayName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                if (proposal.canVote) {
                    Text(
                        text = formatTimeRemaining(proposal.remainingTimeMs),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFF57F17)
                    )
                } else {
                    Text(
                        text = formatDate(proposal.createdAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Status indicator chip.
 */
@Composable
fun StatusChip(status: ProposalStatus) {
    val (backgroundColor, textColor) = when (status) {
        ProposalStatus.Draft -> Pair(Color(0xFFE0E0E0), Color(0xFF616161))
        ProposalStatus.Discussion -> Pair(Color(0xFFE3F2FD), Color(0xFF1976D2))
        ProposalStatus.Voting -> Pair(Color(0xFFFFF3E0), Color(0xFFE65100))
        ProposalStatus.Passed -> Pair(Color(0xFFE8F5E9), Color(0xFF2E7D32))
        ProposalStatus.Rejected -> Pair(Color(0xFFFFEBEE), Color(0xFFC62828))
        ProposalStatus.Expired, ProposalStatus.Withdrawn -> Pair(Color(0xFFE0E0E0), Color(0xFF616161))
        ProposalStatus.Implemented -> Pair(Color(0xFFF3E5F5), Color(0xFF7B1FA2))
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = backgroundColor
    ) {
        Text(
            text = status.displayName,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
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

private fun formatTimeRemaining(remainingMs: Long): String {
    val hours = (remainingMs / 3600000).toInt()
    val days = hours / 24

    return when {
        days > 0 -> "${days}d left"
        hours > 0 -> "${hours}h left"
        else -> {
            val minutes = (remainingMs / 60000).toInt()
            "${maxOf(1, minutes)}m left"
        }
    }
}

private fun formatDate(timestamp: Long): String {
    val formatter = SimpleDateFormat("MMM d", Locale.getDefault())
    return formatter.format(Date(timestamp))
}
