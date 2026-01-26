package network.buildit.modules.fundraising.presentation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.CurrencyBitcoin
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ProgressIndicatorDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import network.buildit.modules.fundraising.data.local.CampaignEntity
import network.buildit.modules.fundraising.data.local.CampaignStatus
import network.buildit.modules.fundraising.data.local.CampaignVisibility
import network.buildit.modules.fundraising.data.local.DonationEntity
import network.buildit.modules.fundraising.data.local.DonationTier
import network.buildit.modules.fundraising.data.local.PaymentMethod

/**
 * Main campaigns list screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignsListScreen(
    onNavigateToCreateCampaign: () -> Unit,
    onNavigateToCampaignDetail: (String) -> Unit,
    viewModel: FundraisingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        viewModel.loadCampaigns(null)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fundraising") },
                actions = {
                    IconButton(onClick = { /* Toggle search */ }) {
                        Icon(Icons.Default.Search, contentDescription = "Search")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreateCampaign) {
                Icon(Icons.Default.Add, contentDescription = "Create Campaign")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Tab Row
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = {
                        selectedTab = 0
                        viewModel.loadActiveCampaigns()
                    },
                    text = { Text("Active") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = {
                        selectedTab = 1
                        viewModel.loadMyCampaigns()
                    },
                    text = { Text("My Campaigns") }
                )
            }

            when (val state = uiState) {
                is FundraisingUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is FundraisingUiState.CampaignList -> {
                    if (state.campaigns.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.Campaign,
                            title = "No campaigns yet",
                            message = if (selectedTab == 0) {
                                "Be the first to start a fundraising campaign"
                            } else {
                                "Create your first campaign to start raising funds"
                            }
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(state.campaigns, key = { it.id }) { campaign ->
                                CampaignCard(
                                    campaign = campaign,
                                    onClick = { onNavigateToCampaignDetail(campaign.id) }
                                )
                            }
                        }
                    }
                }
                is FundraisingUiState.Error -> {
                    ErrorView(message = state.message)
                }
            }
        }
    }
}

/**
 * Campaign card with animated progress indicator.
 */
@Composable
fun CampaignCard(
    campaign: CampaignEntity,
    onClick: () -> Unit
) {
    var animatedProgress by remember { mutableStateOf(0f) }

    LaunchedEffect(campaign.progressPercentage) {
        val animatable = Animatable(animatedProgress)
        animatable.animateTo(
            targetValue = campaign.progressPercentage,
            animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing)
        )
        animatedProgress = animatable.value
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Campaign Image
            if (campaign.image != null) {
                AsyncImage(
                    model = campaign.image,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)),
                    contentScale = ContentScale.Crop
                )
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Status and Visibility
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CampaignStatusChip(status = campaign.status)
                    Spacer(modifier = Modifier.width(8.dp))
                    CampaignVisibilityIcon(visibility = campaign.visibility)
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = campaign.currency,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Title
                Text(
                    text = campaign.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                campaign.description?.let { description ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Progress
                AnimatedProgressSection(
                    raised = campaign.raised,
                    goal = campaign.goal,
                    currency = campaign.currency,
                    progress = animatedProgress,
                    donorCount = campaign.donorCount
                )
            }
        }
    }
}

/**
 * Animated progress section with counter.
 */
@Composable
fun AnimatedProgressSection(
    raised: Double,
    goal: Double,
    currency: String,
    progress: Float,
    donorCount: Int
) {
    var animatedRaised by remember { mutableDoubleStateOf(0.0) }
    var animatedDonorCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(raised) {
        val steps = 30
        val stepDelay = 33L
        val stepAmount = raised / steps
        for (i in 1..steps) {
            animatedRaised = stepAmount * i
            delay(stepDelay)
        }
        animatedRaised = raised
    }

    LaunchedEffect(donorCount) {
        val steps = 20
        val stepDelay = 50L
        val stepAmount = donorCount.toDouble() / steps
        for (i in 1..steps) {
            animatedDonorCount = (stepAmount * i).toInt()
            delay(stepDelay)
        }
        animatedDonorCount = donorCount
    }

    Column {
        // Progress bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            strokeCap = StrokeCap.Round,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Amount raised
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Column {
                AnimatedContent(
                    targetState = animatedRaised,
                    label = "raised_amount"
                ) { amount ->
                    Text(
                        text = formatCurrency(amount, currency),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                Text(
                    text = "raised of ${formatCurrency(goal, currency)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${(progress * 100).toInt()}%",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                AnimatedContent(
                    targetState = animatedDonorCount,
                    label = "donor_count"
                ) { count ->
                    Text(
                        text = "$count donors",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Campaign status chip.
 */
@Composable
fun CampaignStatusChip(status: CampaignStatus) {
    val (backgroundColor, textColor, text) = when (status) {
        CampaignStatus.DRAFT -> Triple(Color(0xFFE3F2FD), Color(0xFF1565C0), "Draft")
        CampaignStatus.ACTIVE -> Triple(Color(0xFFE8F5E9), Color(0xFF2E7D32), "Active")
        CampaignStatus.PAUSED -> Triple(Color(0xFFFFF8E1), Color(0xFFF57F17), "Paused")
        CampaignStatus.COMPLETED -> Triple(Color(0xFFE8F5E9), Color(0xFF2E7D32), "Completed")
        CampaignStatus.CANCELLED -> Triple(Color(0xFFFFEBEE), Color(0xFFC62828), "Cancelled")
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

/**
 * Campaign visibility icon.
 */
@Composable
fun CampaignVisibilityIcon(visibility: CampaignVisibility) {
    val icon = when (visibility) {
        CampaignVisibility.PRIVATE -> Icons.Default.Lock
        CampaignVisibility.GROUP -> Icons.Default.Group
        CampaignVisibility.PUBLIC -> Icons.Default.Public
    }

    Icon(
        imageVector = icon,
        contentDescription = visibility.displayName,
        modifier = Modifier.size(16.dp),
        tint = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

/**
 * Campaign detail screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignDetailScreen(
    campaignId: String,
    onNavigateBack: () -> Unit,
    onNavigateToDonate: (String) -> Unit,
    viewModel: FundraisingViewModel = hiltViewModel()
) {
    val state by viewModel.campaignDetailState.collectAsState()
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var showUpdateDialog by remember { mutableStateOf(false) }

    LaunchedEffect(campaignId) {
        viewModel.loadCampaignDetail(campaignId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Campaign") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.shareCampaign(campaignId) }) {
                        Icon(Icons.Default.Share, contentDescription = "Share")
                    }
                }
            )
        }
    ) { padding ->
        when (val detailState = state) {
            is CampaignDetailState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is CampaignDetailState.Success -> {
                val campaign = detailState.campaign

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    // Campaign Header
                    item {
                        CampaignDetailHeader(
                            campaign = campaign,
                            onDonateClick = { onNavigateToDonate(campaignId) },
                            onLaunchClick = { viewModel.launchCampaign(campaignId) },
                            onPauseClick = { viewModel.pauseCampaign(campaignId) },
                            onCompleteClick = { viewModel.completeCampaign(campaignId) },
                            onAddUpdateClick = { showUpdateDialog = true }
                        )
                    }

                    // Tabs
                    item {
                        TabRow(selectedTabIndex = selectedTab) {
                            Tab(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                text = { Text("About") }
                            )
                            Tab(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                text = { Text("Donors (${detailState.donations.size})") }
                            )
                            Tab(
                                selected = selectedTab == 2,
                                onClick = { selectedTab = 2 },
                                text = { Text("Updates") }
                            )
                        }
                    }

                    // Tab Content
                    when (selectedTab) {
                        0 -> {
                            item {
                                CampaignAboutSection(
                                    campaign = campaign,
                                    donationStats = detailState.donationStats,
                                    expenseSummary = detailState.expenseSummary
                                )
                            }
                        }
                        1 -> {
                            if (detailState.donations.isEmpty()) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(32.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "No donations yet. Be the first!",
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            } else {
                                items(detailState.donations) { donation ->
                                    DonationItem(donation = donation)
                                }
                            }
                        }
                        2 -> {
                            val updates = campaign.getUpdates()
                            if (updates.isEmpty()) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(32.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "No updates posted yet",
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            } else {
                                items(updates.sortedByDescending { it.postedAt }) { update ->
                                    CampaignUpdateItem(update = update)
                                }
                            }
                        }
                    }
                }

                // Add Update Dialog
                if (showUpdateDialog) {
                    AddUpdateDialog(
                        onDismiss = { showUpdateDialog = false },
                        onAddUpdate = { content ->
                            viewModel.addCampaignUpdate(campaignId, content)
                            showUpdateDialog = false
                        }
                    )
                }
            }
            is CampaignDetailState.Error -> {
                ErrorView(message = detailState.message)
            }
        }
    }
}

/**
 * Campaign detail header with progress.
 */
@Composable
fun CampaignDetailHeader(
    campaign: CampaignEntity,
    onDonateClick: () -> Unit,
    onLaunchClick: () -> Unit,
    onPauseClick: () -> Unit,
    onCompleteClick: () -> Unit,
    onAddUpdateClick: () -> Unit
) {
    val animatedProgress by animateFloatAsState(
        targetValue = campaign.progressPercentage,
        animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
        label = "progress"
    )

    Column(modifier = Modifier.padding(16.dp)) {
        // Image
        if (campaign.image != null) {
            AsyncImage(
                model = campaign.image,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .clip(RoundedCornerShape(12.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Status
        Row(verticalAlignment = Alignment.CenterVertically) {
            CampaignStatusChip(status = campaign.status)
            Spacer(modifier = Modifier.width(8.dp))
            CampaignVisibilityIcon(visibility = campaign.visibility)
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Title
        Text(
            text = campaign.title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Circular Progress Indicator
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier.size(180.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    progress = { animatedProgress },
                    modifier = Modifier.fillMaxSize(),
                    strokeWidth = 12.dp,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                    strokeCap = StrokeCap.Round,
                )

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${(animatedProgress * 100).toInt()}%",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "funded",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Amount raised
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatColumn(
                value = formatCurrency(campaign.raised, campaign.currency),
                label = "Raised"
            )
            StatColumn(
                value = formatCurrency(campaign.goal, campaign.currency),
                label = "Goal"
            )
            StatColumn(
                value = campaign.donorCount.toString(),
                label = "Donors"
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Action Buttons
        if (campaign.isAcceptingDonations) {
            Button(
                onClick = onDonateClick,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.AttachMoney, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Donate Now")
            }
        }

        // Campaign management buttons (for owner)
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            when (campaign.status) {
                CampaignStatus.DRAFT -> {
                    OutlinedButton(
                        onClick = onLaunchClick,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Launch")
                    }
                }
                CampaignStatus.ACTIVE -> {
                    OutlinedButton(
                        onClick = onPauseClick,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Pause, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Pause")
                    }
                    OutlinedButton(
                        onClick = onCompleteClick,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Complete")
                    }
                }
                CampaignStatus.PAUSED -> {
                    OutlinedButton(
                        onClick = onLaunchClick,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Resume")
                    }
                }
                else -> {}
            }
            OutlinedButton(
                onClick = onAddUpdateClick,
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Edit, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Update")
            }
        }
    }
}

@Composable
fun StatColumn(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun CampaignAboutSection(
    campaign: CampaignEntity,
    donationStats: network.buildit.modules.fundraising.domain.DonationStats,
    expenseSummary: network.buildit.modules.fundraising.domain.ExpenseSummary
) {
    Column(modifier = Modifier.padding(16.dp)) {
        // Description
        campaign.description?.let { description ->
            Text(
                text = "About this campaign",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        // Donation Tiers
        val tiers = campaign.getTiers()
        if (tiers.isNotEmpty()) {
            Text(
                text = "Donation Tiers",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            tiers.forEach { tier ->
                DonationTierCard(tier = tier, currency = campaign.currency)
                Spacer(modifier = Modifier.height(8.dp))
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Financial Summary
        Text(
            text = "Financial Summary",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                SummaryRow("Total Raised", formatCurrency(donationStats.total, campaign.currency))
                SummaryRow("Total Expenses", formatCurrency(expenseSummary.total, campaign.currency))
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                SummaryRow(
                    "Net Amount",
                    formatCurrency(donationStats.total - expenseSummary.total, campaign.currency),
                    isBold = true
                )
            }
        }
    }
}

@Composable
fun SummaryRow(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
fun DonationTierCard(tier: DonationTier, currency: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = formatCurrency(tier.amount, currency),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                tier.name?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                tier.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun DonationItem(donation: DonationEntity) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar placeholder
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = donation.displayDonorName.first().toString().uppercase(),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = donation.displayDonorName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            donation.message?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Text(
            text = donation.formatAmount(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
fun CampaignUpdateItem(update: network.buildit.modules.fundraising.data.local.CampaignUpdate) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = formatRelativeTime(update.postedAt),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = update.content,
            style = MaterialTheme.typography.bodyMedium
        )
        HorizontalDivider(modifier = Modifier.padding(top = 16.dp))
    }
}

/**
 * Create campaign screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateCampaignScreen(
    onNavigateBack: () -> Unit,
    onCampaignCreated: (String) -> Unit,
    viewModel: FundraisingViewModel = hiltViewModel()
) {
    val createState by viewModel.createCampaignState.collectAsState()

    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var goalText by rememberSaveable { mutableStateOf("") }
    var currency by rememberSaveable { mutableStateOf("USD") }
    var visibility by rememberSaveable { mutableStateOf(CampaignVisibility.GROUP) }

    LaunchedEffect(createState) {
        if (createState is CreateCampaignState.Success) {
            val campaign = (createState as CreateCampaignState.Success).campaign
            viewModel.resetCreateCampaignState()
            onCampaignCreated(campaign.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Campaign") },
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
            item {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Campaign Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

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

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedTextField(
                        value = goalText,
                        onValueChange = { goalText = it },
                        label = { Text("Goal Amount") },
                        modifier = Modifier.weight(2f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )

                    CurrencySelector(
                        selectedCurrency = currency,
                        onCurrencySelected = { currency = it },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                Text(
                    text = "Visibility",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    CampaignVisibility.entries.forEachIndexed { index, option ->
                        SegmentedButton(
                            selected = visibility == option,
                            onClick = { visibility = option },
                            shape = SegmentedButtonDefaults.itemShape(
                                index = index,
                                count = CampaignVisibility.entries.size
                            )
                        ) {
                            Text(option.displayName)
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        val goal = goalText.toDoubleOrNull() ?: 0.0
                        if (title.isNotBlank() && goal > 0) {
                            viewModel.createCampaign(
                                title = title,
                                description = description.ifBlank { null },
                                goal = goal,
                                currency = currency,
                                visibility = visibility
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = title.isNotBlank() && goalText.toDoubleOrNull()?.let { it > 0 } == true &&
                            createState !is CreateCampaignState.Creating
                ) {
                    if (createState is CreateCampaignState.Creating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Create Campaign")
                    }
                }

                if (createState is CreateCampaignState.Error) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = (createState as CreateCampaignState.Error).message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
fun CurrencySelector(
    selectedCurrency: String,
    onCurrencySelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val currencies = listOf("USD", "EUR", "GBP", "BTC", "ETH")

    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
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
            currencies.forEach { currency ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(currency) },
                    onClick = {
                        onCurrencySelected(currency)
                        expanded = false
                    }
                )
            }
        }
    }
}

/**
 * Donate screen with payment options.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DonateScreen(
    campaignId: String,
    onNavigateBack: () -> Unit,
    onDonationComplete: () -> Unit,
    viewModel: FundraisingViewModel = hiltViewModel()
) {
    val donateState by viewModel.donateState.collectAsState()
    val campaignDetailState by viewModel.campaignDetailState.collectAsState()

    var amount by rememberSaveable { mutableStateOf("") }
    var donorName by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf("") }
    var anonymous by rememberSaveable { mutableStateOf(false) }
    var selectedPaymentMethod by rememberSaveable { mutableStateOf(PaymentMethod.CARD) }
    var selectedTierId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(campaignId) {
        viewModel.loadCampaignDetail(campaignId)
    }

    LaunchedEffect(donateState) {
        if (donateState is DonateState.Success) {
            viewModel.resetDonateState()
            onDonationComplete()
        }
    }

    val campaign = (campaignDetailState as? CampaignDetailState.Success)?.campaign

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Donate") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (campaign == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Campaign Info
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = campaign.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { campaign.progressPercentage },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${campaign.progressPercent}% of ${formatCurrency(campaign.goal, campaign.currency)} raised",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Donation Tiers
            val tiers = campaign.getTiers()
            if (tiers.isNotEmpty()) {
                item {
                    Text(
                        text = "Select an amount",
                        style = MaterialTheme.typography.labelLarge
                    )
                }

                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        tiers.forEach { tier ->
                            FilterChip(
                                selected = amount == tier.amount.toString(),
                                onClick = {
                                    amount = tier.amount.toString()
                                    selectedTierId = tier.name
                                },
                                label = { Text(formatCurrency(tier.amount, campaign.currency)) }
                            )
                        }
                        FilterChip(
                            selected = selectedTierId == null && amount.isNotBlank() &&
                                    tiers.none { it.amount.toString() == amount },
                            onClick = {
                                selectedTierId = null
                                amount = ""
                            },
                            label = { Text("Custom") }
                        )
                    }
                }
            }

            // Custom Amount
            item {
                OutlinedTextField(
                    value = amount,
                    onValueChange = {
                        amount = it
                        if (tiers.none { tier -> tier.amount.toString() == it }) {
                            selectedTierId = null
                        }
                    },
                    label = { Text("Donation Amount") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    prefix = { Text(getCurrencySymbol(campaign.currency)) }
                )
            }

            // Donor Info
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Donate anonymously")
                    Switch(
                        checked = anonymous,
                        onCheckedChange = { anonymous = it }
                    )
                }
            }

            if (!anonymous) {
                item {
                    OutlinedTextField(
                        value = donorName,
                        onValueChange = { donorName = it },
                        label = { Text("Your Name (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            }

            item {
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text("Message (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )
            }

            // Payment Method
            item {
                Text(
                    text = "Payment Method",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            item {
                PaymentMethodSelector(
                    selectedMethod = selectedPaymentMethod,
                    onMethodSelected = { selectedPaymentMethod = it }
                )
            }

            // Crypto Payment Options
            if (selectedPaymentMethod == PaymentMethod.CRYPTO) {
                item {
                    CryptoPaymentOptions(currency = campaign.currency)
                }
            }

            // Donate Button
            item {
                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        val donationAmount = amount.toDoubleOrNull() ?: 0.0
                        if (donationAmount > 0) {
                            viewModel.donate(
                                campaignId = campaignId,
                                amount = donationAmount,
                                currency = campaign.currency,
                                donorName = donorName.ifBlank { null },
                                anonymous = anonymous,
                                message = message.ifBlank { null },
                                tierId = selectedTierId,
                                paymentMethod = selectedPaymentMethod
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = amount.toDoubleOrNull()?.let { it > 0 } == true &&
                            donateState !is DonateState.Processing
                ) {
                    if (donateState is DonateState.Processing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text("Donate ${formatCurrency(amount.toDoubleOrNull() ?: 0.0, campaign.currency)}")
                    }
                }

                if (donateState is DonateState.Error) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = (donateState as DonateState.Error).message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            // Awaiting Crypto Payment
            if (donateState is DonateState.AwaitingPayment) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator()
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Awaiting payment confirmation...",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            TextButton(
                                onClick = {
                                    val donation = (donateState as DonateState.AwaitingPayment).donation
                                    viewModel.confirmCryptoPayment(donation.id)
                                }
                            ) {
                                Text("I've completed the payment")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PaymentMethodSelector(
    selectedMethod: PaymentMethod,
    onMethodSelected: (PaymentMethod) -> Unit
) {
    val methods = listOf(
        PaymentMethod.CARD to Pair(Icons.Default.CreditCard, "Card"),
        PaymentMethod.CRYPTO to Pair(Icons.Default.CurrencyBitcoin, "Crypto")
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        methods.forEach { (method, iconAndLabel) ->
            val (icon, label) = iconAndLabel
            PaymentMethodCard(
                icon = icon,
                label = label,
                selected = selectedMethod == method,
                onClick = { onMethodSelected(method) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun PaymentMethodCard(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        border = if (selected) {
            androidx.compose.foundation.BorderStroke(
                2.dp,
                MaterialTheme.colorScheme.primary
            )
        } else null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = if (selected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
            )
        }
    }
}

@Composable
fun CryptoPaymentOptions(currency: String) {
    val cryptoOptions = listOf(
        "BTC" to "Bitcoin",
        "ETH" to "Ethereum",
        "USDC" to "USD Coin",
        "DAI" to "DAI"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Select Cryptocurrency",
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                cryptoOptions.forEach { (symbol, name) ->
                    FilterChip(
                        selected = false,
                        onClick = { /* Handle crypto selection */ },
                        label = { Text(symbol) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Payment will be processed through our secure crypto payment gateway. " +
                        "You'll receive a wallet address to send your donation.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun AddUpdateDialog(
    onDismiss: () -> Unit,
    onAddUpdate: (String) -> Unit
) {
    var content by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Post Update") },
        text = {
            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                label = { Text("Update Content") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6
            )
        },
        confirmButton = {
            Button(
                onClick = { onAddUpdate(content) },
                enabled = content.isNotBlank()
            ) {
                Text("Post")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============== Shared Components ==============

@Composable
fun EmptyStateView(
    icon: ImageVector,
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

@Composable
fun ErrorView(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error
        )
    }
}

// ============== Utility Functions ==============

private fun formatCurrency(amount: Double, currency: String): String {
    return when (currency) {
        "USD" -> "$${String.format("%.2f", amount)}"
        "EUR" -> "${String.format("%.2f", amount)} EUR"
        "GBP" -> "${String.format("%.2f", amount)} GBP"
        "BTC" -> "${String.format("%.8f", amount)} BTC"
        "ETH" -> "${String.format("%.6f", amount)} ETH"
        else -> "${String.format("%.2f", amount)} $currency"
    }
}

private fun getCurrencySymbol(currency: String): String {
    return when (currency) {
        "USD" -> "$"
        "EUR" -> "EUR "
        "GBP" -> "GBP "
        "BTC" -> "BTC "
        "ETH" -> "ETH "
        else -> "$currency "
    }
}

private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis() / 1000
    val diff = now - timestamp
    val minutes = diff / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        else -> {
            val formatter = java.text.SimpleDateFormat("MMM d", java.util.Locale.getDefault())
            formatter.format(java.util.Date(timestamp * 1000))
        }
    }
}
