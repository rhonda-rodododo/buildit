package network.buildit.modules.wiki.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import network.buildit.modules.wiki.data.local.WikiCategoryEntity
import network.buildit.modules.wiki.data.local.WikiPageEntity

/**
 * Category browsing screen for the wiki.
 *
 * Features:
 * - Browse all categories in a group
 * - View pages within a category
 * - Category tree hierarchy (parent/child)
 * - Page count per category
 * - Category creation for admins
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiCategoryScreen(
    groupId: String,
    categoryId: String? = null, // null = show all categories, non-null = show specific category
    onCategoryClick: (String) -> Unit,
    onPageClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: WikiCategoryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(groupId, categoryId) {
        viewModel.load(groupId, categoryId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(uiState.currentCategory?.name ?: "Categories")
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState.currentCategory == null) {
                        IconButton(onClick = { viewModel.showCreateDialog() }) {
                            Icon(Icons.Default.CreateNewFolder, contentDescription = "New category")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.currentCategory != null -> {
                // Viewing a specific category - show its pages
                CategoryDetailContent(
                    category = uiState.currentCategory!!,
                    pages = uiState.categoryPages,
                    subcategories = uiState.subcategories,
                    onPageClick = onPageClick,
                    onSubcategoryClick = onCategoryClick,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                )
            }
            else -> {
                // Viewing all categories
                CategoryListContent(
                    categories = uiState.categories,
                    onCategoryClick = onCategoryClick,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                )
            }
        }
    }

    // Create category dialog
    if (uiState.showCreateDialog) {
        CreateCategoryDialog(
            parentCategories = uiState.categories,
            onDismiss = { viewModel.hideCreateDialog() },
            onCreate = { name, description, parentId, icon ->
                viewModel.createCategory(name, description, parentId, icon)
            }
        )
    }
}

@Composable
private fun CategoryListContent(
    categories: List<WikiCategoryEntity>,
    onCategoryClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (categories.isEmpty()) {
        Box(
            modifier = modifier,
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Folder,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No categories yet",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Create a category to organize wiki pages",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else {
        // Group categories by parent (top-level first, then children under each)
        val topLevel = categories.filter { it.parentId == null }
        val childMap = categories.filter { it.parentId != null }
            .groupBy { it.parentId }

        LazyColumn(
            modifier = modifier,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            topLevel.forEach { category ->
                item(key = category.id) {
                    CategoryCard(
                        category = category,
                        isTopLevel = true,
                        onClick = { onCategoryClick(category.id) }
                    )
                }

                // Show children indented
                childMap[category.id]?.let { children ->
                    items(
                        items = children,
                        key = { it.id }
                    ) { child ->
                        CategoryCard(
                            category = child,
                            isTopLevel = false,
                            onClick = { onCategoryClick(child.id) },
                            modifier = Modifier.padding(start = 24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: WikiCategoryEntity,
    isTopLevel: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isTopLevel) MaterialTheme.colorScheme.surfaceVariant
            else MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Category icon
            Surface(
                color = if (category.color != null) {
                    try {
                        androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(category.color))
                            .copy(alpha = 0.15f)
                    } catch (_: Exception) {
                        MaterialTheme.colorScheme.primaryContainer
                    }
                } else {
                    MaterialTheme.colorScheme.primaryContainer
                },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.size(48.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (category.icon != null) {
                        Text(
                            text = category.icon,
                            style = MaterialTheme.typography.titleMedium
                        )
                    } else {
                        Icon(
                            Icons.Default.Folder,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Category info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = category.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                category.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                }
            }

            // Page count badge
            if (category.pageCount > 0) {
                Badge(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                ) {
                    Text(
                        text = category.pageCount.toString(),
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun CategoryDetailContent(
    category: WikiCategoryEntity,
    pages: List<WikiPageEntity>,
    subcategories: List<WikiCategoryEntity>,
    onPageClick: (String) -> Unit,
    onSubcategoryClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Category info header
        item {
            CategoryDetailHeader(category = category)
        }

        // Subcategories section
        if (subcategories.isNotEmpty()) {
            item {
                Text(
                    text = "Subcategories",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            items(subcategories, key = { it.id }) { sub ->
                CategoryCard(
                    category = sub,
                    isTopLevel = false,
                    onClick = { onSubcategoryClick(sub.id) }
                )
            }
        }

        // Pages section
        if (pages.isNotEmpty()) {
            item {
                Text(
                    text = "Pages (${pages.size})",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            items(pages, key = { it.id }) { page ->
                CategoryPageItem(
                    page = page,
                    onClick = { onPageClick(page.id) }
                )
            }
        }

        // Empty state
        if (pages.isEmpty() && subcategories.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Description,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No pages in this category",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryDetailHeader(category: WikiCategoryEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (category.icon != null) {
                    Text(
                        text = category.icon,
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                }
                Column {
                    Text(
                        text = category.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${category.pageCount} page${if (category.pageCount != 1) "s" else ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            category.description?.let { desc ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CategoryPageItem(
    page: WikiPageEntity,
    onClick: () -> Unit
) {
    ListItem(
        headlineContent = {
            Text(
                text = page.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
        },
        supportingContent = {
            page.summary?.let { summary ->
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        },
        leadingContent = {
            Icon(
                Icons.Default.Description,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        trailingContent = {
            Text(
                text = "v${page.version}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        modifier = Modifier.clickable(onClick = onClick)
    )
}

/**
 * Dialog for creating a new wiki category.
 */
@Composable
private fun CreateCategoryDialog(
    parentCategories: List<WikiCategoryEntity>,
    onDismiss: () -> Unit,
    onCreate: (name: String, description: String?, parentId: String?, icon: String?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedParentId by remember { mutableStateOf<String?>(null) }
    var icon by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Category") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Category Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = icon,
                    onValueChange = { icon = it },
                    label = { Text("Icon (emoji, optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (parentCategories.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = it }
                    ) {
                        OutlinedTextField(
                            value = parentCategories.find { it.id == selectedParentId }?.name ?: "None (top-level)",
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            label = { Text("Parent Category") },
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                            }
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("None (top-level)") },
                                onClick = {
                                    selectedParentId = null
                                    expanded = false
                                }
                            )
                            parentCategories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text(cat.name) },
                                    onClick = {
                                        selectedParentId = cat.id
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onCreate(
                        name,
                        description.ifBlank { null },
                        selectedParentId,
                        icon.ifBlank { null }
                    )
                    onDismiss()
                },
                enabled = name.isNotBlank()
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
