package network.buildit.modules.newsletters.presentation

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.newsletters.data.local.*
import network.buildit.modules.newsletters.domain.SendingProgress

// ============== Newsletters List Screen ==============

/**
 * Main newsletters list screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewslettersListScreen(
    onNavigateToNewsletter: (String) -> Unit,
    onNavigateToCreateNewsletter: () -> Unit,
    viewModel: NewslettersViewModel = hiltViewModel()
) {
    val state by viewModel.newslettersState.collectAsState()
    val errorState by viewModel.errorState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadNewsletters()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Newsletters") },
                actions = {
                    IconButton(onClick = onNavigateToCreateNewsletter) {
                        Icon(Icons.Default.Add, contentDescription = "Create Newsletter")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val currentState = state) {
                is NewslettersListState.Loading, NewslettersListState.Creating -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is NewslettersListState.Success -> {
                    if (currentState.newsletters.isEmpty()) {
                        EmptyNewslettersView(onCreateClick = onNavigateToCreateNewsletter)
                    } else {
                        NewslettersList(
                            newsletters = currentState.newsletters,
                            onNewsletterClick = onNavigateToNewsletter
                        )
                    }
                }
                is NewslettersListState.Error -> {
                    ErrorView(
                        message = currentState.message,
                        onRetry = { viewModel.loadNewsletters() }
                    )
                }
            }

            // Error Snackbar
            errorState?.let { error ->
                Snackbar(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    action = {
                        TextButton(onClick = { viewModel.clearError() }) {
                            Text("Dismiss")
                        }
                    }
                ) {
                    Text(error)
                }
            }
        }
    }
}

@Composable
private fun NewslettersList(
    newsletters: List<NewsletterEntity>,
    onNewsletterClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(newsletters, key = { it.id }) { newsletter ->
            NewsletterCard(
                newsletter = newsletter,
                onClick = { onNewsletterClick(newsletter.id) }
            )
        }
    }
}

@Composable
private fun NewsletterCard(
    newsletter: NewsletterEntity,
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
                    imageVector = Icons.Default.Email,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = newsletter.name,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    newsletter.description?.let { description ->
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                VisibilityBadge(visibility = NewsletterVisibility.fromValue(newsletter.visibility))
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.People,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${newsletter.subscriberCount} subscribers",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun VisibilityBadge(visibility: NewsletterVisibility) {
    val (color, text) = when (visibility) {
        NewsletterVisibility.PUBLIC -> Pair(Color(0xFF4CAF50), "Public")
        NewsletterVisibility.GROUP -> Pair(Color(0xFF2196F3), "Group")
        NewsletterVisibility.PRIVATE -> Pair(Color(0xFF9E9E9E), "Private")
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.1f)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun EmptyNewslettersView(onCreateClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Email,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No newsletters yet",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Create your first newsletter to start reaching your audience",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onCreateClick) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Create Newsletter")
        }
    }
}

// ============== Newsletter Editor Screen ==============

/**
 * Screen for creating/editing a newsletter.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsletterEditorScreen(
    newsletterId: String? = null,
    onNavigateBack: () -> Unit,
    onNavigateToSubscribers: (String) -> Unit,
    onNavigateToIssueHistory: (String) -> Unit,
    onNavigateToCampaignEditor: (String, String?) -> Unit,
    viewModel: NewslettersViewModel = hiltViewModel()
) {
    val detailState by viewModel.newsletterDetailState.collectAsState()
    val errorState by viewModel.errorState.collectAsState()

    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var fromName by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf("") }
    var visibility by remember { mutableStateOf(NewsletterVisibility.GROUP) }
    var doubleOptIn by remember { mutableStateOf(true) }
    var isInitialized by remember { mutableStateOf(false) }

    val isEditing = newsletterId != null

    LaunchedEffect(newsletterId) {
        if (newsletterId != null) {
            viewModel.loadNewsletterDetail(newsletterId)
        }
    }

    // Initialize form fields from loaded newsletter
    LaunchedEffect(detailState) {
        if (detailState is NewsletterDetailState.Success && !isInitialized) {
            val newsletter = (detailState as NewsletterDetailState.Success).newsletter
            name = newsletter.name
            description = newsletter.description ?: ""
            fromName = newsletter.fromName ?: ""
            replyTo = newsletter.replyTo ?: ""
            visibility = NewsletterVisibility.fromValue(newsletter.visibility)
            doubleOptIn = newsletter.doubleOptIn
            isInitialized = true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEditing) "Edit Newsletter" else "New Newsletter") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (isEditing) {
                        val newsletter = (detailState as? NewsletterDetailState.Success)?.newsletter
                        if (newsletter != null) {
                            IconButton(onClick = { onNavigateToSubscribers(newsletter.id) }) {
                                Icon(Icons.Default.People, contentDescription = "Subscribers")
                            }
                            IconButton(onClick = { onNavigateToIssueHistory(newsletter.id) }) {
                                Icon(Icons.Default.History, contentDescription = "History")
                            }
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Name
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Newsletter Name *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5
            )

            // From Name
            OutlinedTextField(
                value = fromName,
                onValueChange = { fromName = it },
                label = { Text("From Name") },
                placeholder = { Text("Sender display name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Reply To
            OutlinedTextField(
                value = replyTo,
                onValueChange = { replyTo = it },
                label = { Text("Reply-To Email") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            // Visibility
            Text(
                text = "Visibility",
                style = MaterialTheme.typography.labelLarge
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                NewsletterVisibility.entries.forEach { vis ->
                    FilterChip(
                        selected = visibility == vis,
                        onClick = { visibility = vis },
                        label = { Text(vis.value.replaceFirstChar { it.uppercase() }) }
                    )
                }
            }

            // Double Opt-In
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Double Opt-In",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = "Require email confirmation for new subscribers",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = doubleOptIn,
                    onCheckedChange = { doubleOptIn = it }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action Buttons
            if (isEditing) {
                val newsletter = (detailState as? NewsletterDetailState.Success)?.newsletter
                if (newsletter != null) {
                    Button(
                        onClick = { onNavigateToCampaignEditor(newsletter.id, null) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Create, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Create New Issue")
                    }
                }
            }

            Button(
                onClick = {
                    if (isEditing && detailState is NewsletterDetailState.Success) {
                        val newsletter = (detailState as NewsletterDetailState.Success).newsletter
                        viewModel.updateNewsletter(
                            newsletter.copy(
                                name = name,
                                description = description.ifBlank { null },
                                fromName = fromName.ifBlank { null },
                                replyTo = replyTo.ifBlank { null },
                                visibility = visibility.value,
                                doubleOptIn = doubleOptIn
                            )
                        )
                    } else {
                        viewModel.createNewsletter(
                            name = name,
                            description = description.ifBlank { null },
                            fromName = fromName.ifBlank { null },
                            replyTo = replyTo.ifBlank { null },
                            visibility = visibility,
                            doubleOptIn = doubleOptIn
                        )
                    }
                    onNavigateBack()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = name.isNotBlank()
            ) {
                Text(if (isEditing) "Save Changes" else "Create Newsletter")
            }
        }
    }
}

// ============== Subscribers Screen ==============

/**
 * Screen for managing newsletter subscribers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscribersScreen(
    newsletterId: String,
    onNavigateBack: () -> Unit,
    viewModel: NewslettersViewModel = hiltViewModel()
) {
    val state by viewModel.subscribersState.collectAsState()
    val errorState by viewModel.errorState.collectAsState()
    val context = LocalContext.current

    var searchQuery by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(false) }
    var showImportResult by remember { mutableStateOf(false) }

    // File pickers
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            context.contentResolver.openInputStream(it)?.let { inputStream ->
                viewModel.importSubscribersFromCsv(newsletterId, inputStream)
            }
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri: Uri? ->
        uri?.let {
            context.contentResolver.openOutputStream(it)?.let { outputStream ->
                viewModel.exportSubscribersToCsv(newsletterId, outputStream)
            }
        }
    }

    LaunchedEffect(newsletterId) {
        viewModel.loadSubscribers(newsletterId)
    }

    // Show import result
    LaunchedEffect(state) {
        if (state is SubscribersState.Success) {
            val successState = state as SubscribersState.Success
            if (successState.lastImportResult != null) {
                showImportResult = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscribers") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { importLauncher.launch("text/csv") }) {
                        Icon(Icons.Default.Upload, contentDescription = "Import CSV")
                    }
                    IconButton(onClick = { exportLauncher.launch("subscribers.csv") }) {
                        Icon(Icons.Default.Download, contentDescription = "Export CSV")
                    }
                    IconButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.PersonAdd, contentDescription = "Add Subscriber")
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
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { query ->
                    searchQuery = query
                    viewModel.searchSubscribers(newsletterId, query)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search subscribers...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search)
            )

            when (val currentState = state) {
                is SubscribersState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is SubscribersState.Success -> {
                    // Import/Export progress indicators
                    if (currentState.isImporting) {
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                        )
                        Text(
                            text = "Importing subscribers...",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    if (currentState.isExporting) {
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                        )
                        Text(
                            text = "Exporting subscribers...",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    if (currentState.subscribers.isEmpty()) {
                        EmptySubscribersView()
                    } else {
                        SubscribersList(
                            subscribers = currentState.subscribers,
                            onUnsubscribe = { subscriberId ->
                                viewModel.unsubscribeSubscriber(subscriberId, newsletterId)
                            },
                            onRemove = { subscriberId ->
                                viewModel.removeSubscriber(subscriberId, newsletterId)
                            }
                        )
                    }
                }
                is SubscribersState.Error -> {
                    ErrorView(
                        message = currentState.message,
                        onRetry = { viewModel.loadSubscribers(newsletterId) }
                    )
                }
            }
        }
    }

    // Add Subscriber Dialog
    if (showAddDialog) {
        AddSubscriberDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { email, name, pubkey ->
                viewModel.addSubscriber(newsletterId, email, name, pubkey)
                showAddDialog = false
            }
        )
    }

    // Import Result Dialog
    if (showImportResult && state is SubscribersState.Success) {
        val importResult = (state as SubscribersState.Success).lastImportResult
        if (importResult != null) {
            AlertDialog(
                onDismissRequest = { showImportResult = false },
                title = { Text("Import Complete") },
                text = {
                    Column {
                        Text("Imported: ${importResult.imported}")
                        Text("Skipped: ${importResult.skipped}")
                        Text("Errors: ${importResult.errors}")
                        if (importResult.errorMessages.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Errors:", style = MaterialTheme.typography.labelMedium)
                            importResult.errorMessages.forEach { error ->
                                Text(
                                    text = error,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showImportResult = false }) {
                        Text("OK")
                    }
                }
            )
        }
    }
}

@Composable
private fun SubscribersList(
    subscribers: List<SubscriberEntity>,
    onUnsubscribe: (String) -> Unit,
    onRemove: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(subscribers, key = { it.id }) { subscriber ->
            SubscriberCard(
                subscriber = subscriber,
                onUnsubscribe = { onUnsubscribe(subscriber.id) },
                onRemove = { onRemove(subscriber.id) }
            )
        }
    }
}

@Composable
private fun SubscriberCard(
    subscriber: SubscriberEntity,
    onUnsubscribe: () -> Unit,
    onRemove: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = subscriber.name ?: subscriber.email,
                    style = MaterialTheme.typography.bodyLarge
                )
                if (subscriber.name != null) {
                    Text(
                        text = subscriber.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (subscriber.pubkey != null) {
                    Text(
                        text = "Nostr: ${subscriber.pubkey.take(8)}...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            SubscriberStatusBadge(status = SubscriberStatus.fromValue(subscriber.status))

            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "More options")
                }
                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false }
                ) {
                    if (subscriber.status != SubscriberStatus.UNSUBSCRIBED.value) {
                        DropdownMenuItem(
                            text = { Text("Unsubscribe") },
                            onClick = {
                                onUnsubscribe()
                                showMenu = false
                            }
                        )
                    }
                    DropdownMenuItem(
                        text = { Text("Remove") },
                        onClick = {
                            onRemove()
                            showMenu = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SubscriberStatusBadge(status: SubscriberStatus) {
    val (color, text) = when (status) {
        SubscriberStatus.ACTIVE -> Pair(Color(0xFF4CAF50), "Active")
        SubscriberStatus.PENDING -> Pair(Color(0xFFFFC107), "Pending")
        SubscriberStatus.UNSUBSCRIBED -> Pair(Color(0xFF9E9E9E), "Unsubscribed")
        SubscriberStatus.BOUNCED -> Pair(Color(0xFFF44336), "Bounced")
        SubscriberStatus.COMPLAINED -> Pair(Color(0xFFF44336), "Complained")
    }

    Surface(
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = 0.1f)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun EmptySubscribersView() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.People,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No subscribers yet",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add subscribers manually or import from CSV",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AddSubscriberDialog(
    onDismiss: () -> Unit,
    onAdd: (email: String, name: String?, pubkey: String?) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var pubkey by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Subscriber") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email *") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = pubkey,
                    onValueChange = { pubkey = it },
                    label = { Text("Nostr Pubkey") },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("For NIP-17 delivery") }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onAdd(email, name.ifBlank { null }, pubkey.ifBlank { null })
                },
                enabled = email.isNotBlank()
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============== Issue History Screen ==============

/**
 * Screen showing sent campaigns (issue history).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueHistoryScreen(
    newsletterId: String,
    onNavigateBack: () -> Unit,
    onNavigateToCampaign: (String) -> Unit,
    viewModel: NewslettersViewModel = hiltViewModel()
) {
    val state by viewModel.issueHistoryState.collectAsState()

    LaunchedEffect(newsletterId) {
        viewModel.loadIssueHistory(newsletterId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Issue History") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        when (val currentState = state) {
            is IssueHistoryState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is IssueHistoryState.Success -> {
                if (currentState.campaigns.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.History,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No issues sent yet",
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(currentState.campaigns, key = { it.id }) { campaign ->
                            IssueCard(
                                campaign = campaign,
                                onClick = { onNavigateToCampaign(campaign.id) }
                            )
                        }
                    }
                }
            }
            is IssueHistoryState.Error -> {
                ErrorView(
                    message = currentState.message,
                    onRetry = { viewModel.loadIssueHistory(newsletterId) },
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun IssueCard(
    campaign: CampaignEntity,
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
            Text(
                text = campaign.subject,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                campaign.sentAt?.let { sentAt ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = formatDate(sentAt),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                campaign.recipientCount?.let { count ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.People,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "$count recipients",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Stats
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "${campaign.openCount} opens",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "${campaign.clickCount} clicks",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// ============== Delivery Progress Screen ==============

/**
 * Screen showing batch sending progress.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeliveryProgressScreen(
    campaignId: String,
    onNavigateBack: () -> Unit,
    onComplete: () -> Unit,
    viewModel: NewslettersViewModel = hiltViewModel()
) {
    val progressState by viewModel.deliveryProgressState.collectAsState()
    val sendingProgress by viewModel.sendingProgress.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sending Newsletter") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            when (val currentState = progressState) {
                is DeliveryProgressState.Idle, DeliveryProgressState.Starting -> {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Starting delivery...")
                }
                is DeliveryProgressState.Sending -> {
                    val progress = currentState.progress

                    CircularProgressIndicator(
                        progress = { progress.progress },
                        modifier = Modifier.size(100.dp),
                        strokeWidth = 8.dp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = "${(progress.progress * 100).toInt()}%",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Sending ${progress.sent + progress.failed + 1} of ${progress.total}",
                        style = MaterialTheme.typography.bodyLarge
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${progress.sent}",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color(0xFF4CAF50)
                            )
                            Text(
                                text = "Sent",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${progress.failed}",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color(0xFFF44336)
                            )
                            Text(
                                text = "Failed",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${progress.remaining}",
                                style = MaterialTheme.typography.titleLarge
                            )
                            Text(
                                text = "Remaining",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    LinearProgressIndicator(
                        progress = { progress.progress },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                is DeliveryProgressState.Complete -> {
                    val stats = currentState.stats

                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(80.dp),
                        tint = Color(0xFF4CAF50)
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = "Delivery Complete",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(32.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${stats.sent}",
                                style = MaterialTheme.typography.headlineSmall,
                                color = Color(0xFF4CAF50)
                            )
                            Text("Delivered")
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${stats.failed}",
                                style = MaterialTheme.typography.headlineSmall,
                                color = if (stats.failed > 0) Color(0xFFF44336) else MaterialTheme.colorScheme.onSurface
                            )
                            Text("Failed")
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Success rate: ${(stats.successRate * 100).toInt()}%",
                        style = MaterialTheme.typography.bodyLarge
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    Button(onClick = {
                        viewModel.resetDeliveryProgress()
                        onComplete()
                    }) {
                        Text("Done")
                    }
                }
                is DeliveryProgressState.Error -> {
                    Icon(
                        imageVector = Icons.Default.Error,
                        contentDescription = null,
                        modifier = Modifier.size(80.dp),
                        tint = Color(0xFFF44336)
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = "Delivery Failed",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = currentState.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    Button(onClick = {
                        viewModel.resetDeliveryProgress()
                        onNavigateBack()
                    }) {
                        Text("Go Back")
                    }
                }
            }
        }
    }
}

// ============== Common Components ==============

@Composable
private fun ErrorView(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Something went wrong",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

// Utility functions

private fun formatDate(timestamp: Long): String {
    val formatter = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.getDefault())
    return formatter.format(java.util.Date(timestamp * 1000))
}
