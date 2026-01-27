package network.buildit.modules.calling.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.modules.calling.services.LocalCreditBalance
import network.buildit.modules.calling.services.PSTNCreditsManager
import network.buildit.modules.calling.services.PSTNUsageRecord
import network.buildit.modules.calling.services.UsageSummary
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

/**
 * Credits Dashboard Screen
 *
 * Displays PSTN credit balance, usage statistics, and recent usage history.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditsDashboardScreen(
    groupId: String,
    viewModel: CreditsDashboardViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(groupId) {
        viewModel.loadData(groupId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("PSTN Credits") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.refresh() },
                        enabled = !uiState.isLoading
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading && uiState.balance == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Low credits alert
                if (uiState.balance?.isLow == true) {
                    item {
                        LowCreditsAlert(
                            percentUsed = uiState.balance?.percentUsed ?: 0.0
                        )
                    }
                }

                // Main balance card
                item {
                    BalanceCard(
                        balance = uiState.balance,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Stats grid
                item {
                    StatsGrid(
                        summary = uiState.summary,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Recent usage section
                item {
                    Text(
                        text = "Recent Usage",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (uiState.recentUsage.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No recent calls",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else {
                    items(uiState.recentUsage) { record ->
                        UsageRecordItem(record = record)
                    }
                }

                // Error message
                uiState.errorMessage?.let { error ->
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Error,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = error,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Low credits alert banner
 */
@Composable
private fun LowCreditsAlert(
    percentUsed: Double,
    modifier: Modifier = Modifier
) {
    val isCritical = percentUsed >= 95

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = if (isCritical)
                MaterialTheme.colorScheme.errorContainer
            else
                Color(0xFFFFF3E0) // Light orange
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCritical) Icons.Default.Warning else Icons.Default.Info,
                contentDescription = null,
                tint = if (isCritical)
                    MaterialTheme.colorScheme.error
                else
                    Color(0xFFFF9800), // Orange
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isCritical) "Credits Almost Exhausted" else "Low Credits Warning",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isCritical)
                        MaterialTheme.colorScheme.error
                    else
                        Color(0xFFE65100) // Dark orange
                )
                Text(
                    text = if (isCritical)
                        "You have used ${percentUsed.toInt()}% of your monthly allocation. Consider upgrading your plan."
                    else
                        "You have used ${percentUsed.toInt()}% of your monthly allocation.",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isCritical)
                        MaterialTheme.colorScheme.onErrorContainer
                    else
                        Color(0xFFBF360C) // Brown
                )
            }
        }
    }
}

/**
 * Main balance card with circular progress indicator
 */
@Composable
private fun BalanceCard(
    balance: LocalCreditBalance?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Circular progress indicator
            Box(
                modifier = Modifier.size(180.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressBar(
                    percentage = (balance?.percentUsed ?: 0.0).toFloat() / 100f,
                    statusColor = balance?.let {
                        PSTNCreditsManager.getStatusColor(it.percentUsed)
                    } ?: Color.Gray
                )

                // Center content
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = balance?.let {
                            PSTNCreditsManager.formatCredits(it.remaining)
                        } ?: "--",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "remaining",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Usage stats
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                BalanceStat(
                    label = "Used",
                    value = balance?.let {
                        PSTNCreditsManager.formatCredits(it.used)
                    } ?: "--"
                )
                BalanceStat(
                    label = "Total",
                    value = balance?.let {
                        PSTNCreditsManager.formatCredits(it.monthlyAllocation)
                    } ?: "--"
                )
                BalanceStat(
                    label = "Resets in",
                    value = balance?.let {
                        "${PSTNCreditsManager.getDaysUntilReset(it.resetDate)} days"
                    } ?: "--"
                )
            }
        }
    }
}

/**
 * Balance stat item
 */
@Composable
private fun BalanceStat(
    label: String,
    value: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Circular progress bar
 */
@Composable
private fun CircularProgressBar(
    percentage: Float,
    statusColor: Color,
    modifier: Modifier = Modifier
) {
    val animatedPercentage by animateFloatAsState(
        targetValue = percentage,
        animationSpec = tween(durationMillis = 1000),
        label = "progress"
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        val strokeWidth = 16.dp.toPx()
        val diameter = size.minDimension - strokeWidth
        val topLeft = Offset(
            (size.width - diameter) / 2,
            (size.height - diameter) / 2
        )

        // Background circle
        drawArc(
            color = Color.LightGray.copy(alpha = 0.3f),
            startAngle = -90f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = topLeft,
            size = Size(diameter, diameter),
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
        )

        // Progress arc
        drawArc(
            color = statusColor,
            startAngle = -90f,
            sweepAngle = 360f * animatedPercentage,
            useCenter = false,
            topLeft = topLeft,
            size = Size(diameter, diameter),
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
        )
    }
}

/**
 * Stats grid showing call statistics
 */
@Composable
private fun StatsGrid(
    summary: UsageSummary?,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "This Month",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    icon = Icons.Default.Phone,
                    value = summary?.totalCalls?.toString() ?: "0",
                    label = "Total Calls"
                )
                StatItem(
                    icon = Icons.Default.Schedule,
                    value = "${summary?.totalMinutes ?: 0}",
                    label = "Minutes"
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    icon = Icons.Default.CallReceived,
                    value = summary?.inboundCalls?.toString() ?: "0",
                    label = "Inbound"
                )
                StatItem(
                    icon = Icons.Default.CallMade,
                    value = summary?.outboundCalls?.toString() ?: "0",
                    label = "Outbound"
                )
            }
        }
    }
}

/**
 * Individual stat item
 */
@Composable
private fun StatItem(
    icon: ImageVector,
    value: String,
    label: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(8.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Usage record item
 */
@Composable
private fun UsageRecordItem(
    record: PSTNUsageRecord,
    modifier: Modifier = Modifier
) {
    val dateFormat = remember { SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()) }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Direction icon
            Surface(
                modifier = Modifier.size(40.dp),
                shape = CircleShape,
                color = if (record.direction == "inbound")
                    Color(0xFFE3F2FD) // Light blue
                else
                    Color(0xFFF3E5F5) // Light purple
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (record.direction == "inbound")
                            Icons.Default.CallReceived
                        else
                            Icons.Default.CallMade,
                        contentDescription = record.direction,
                        tint = if (record.direction == "inbound")
                            Color(0xFF1976D2) // Blue
                        else
                            Color(0xFF7B1FA2), // Purple
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Call details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = record.targetPhone ?: "Unknown",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = dateFormat.format(Date(record.timestamp)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Duration and cost
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatCallDuration(record.duration),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "${record.creditsCost.toInt()} min",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Format call duration
 */
private fun formatCallDuration(seconds: Long): String {
    val minutes = seconds / 60
    val secs = seconds % 60
    return if (minutes > 0) {
        "${minutes}m ${secs}s"
    } else {
        "${secs}s"
    }
}

/**
 * Credits Dashboard UI State
 */
data class CreditsDashboardUiState(
    val balance: LocalCreditBalance? = null,
    val summary: UsageSummary? = null,
    val recentUsage: List<PSTNUsageRecord> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Credits Dashboard ViewModel
 */
@HiltViewModel
class CreditsDashboardViewModel @Inject constructor(
    private val creditsManager: PSTNCreditsManager
) : ViewModel() {

    private var currentGroupId: String? = null

    private val _uiState = MutableStateFlow(CreditsDashboardUiState())
    val uiState: StateFlow<CreditsDashboardUiState> = _uiState.asStateFlow()

    fun loadData(groupId: String) {
        currentGroupId = groupId
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

        viewModelScope.launch {
            try {
                // Load balance
                val balance = creditsManager.getBalance(groupId)
                _uiState.value = _uiState.value.copy(balance = balance)

                // Load summary
                val summary = creditsManager.getUsageSummary(groupId)
                _uiState.value = _uiState.value.copy(summary = summary)

                // Load recent usage
                val recentUsage = creditsManager.getUsageHistory(groupId, days = 7)
                    .sortedByDescending { it.timestamp }
                    .take(20)
                _uiState.value = _uiState.value.copy(
                    recentUsage = recentUsage,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Failed to load credits data"
                )
            }
        }

        // Observe balance updates
        viewModelScope.launch {
            creditsManager.balancesFlow.collect { balances ->
                balances[groupId]?.let { balance ->
                    _uiState.value = _uiState.value.copy(balance = balance)
                }
            }
        }
    }

    fun refresh() {
        currentGroupId?.let { loadData(it) }
    }
}
