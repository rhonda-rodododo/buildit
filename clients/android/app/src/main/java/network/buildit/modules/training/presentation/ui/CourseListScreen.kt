package network.buildit.modules.training.presentation.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.presentation.ui.components.*
import network.buildit.modules.training.presentation.viewmodel.TrainingUiState
import network.buildit.modules.training.presentation.viewmodel.TrainingViewModel

/**
 * Main course list screen showing available training courses.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CourseListScreen(
    onCourseClick: (String) -> Unit,
    onCertificationsClick: () -> Unit,
    viewModel: TrainingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var searchActive by remember { mutableStateOf(false) }
    var viewMode by remember { mutableStateOf(ViewMode.GRID) }

    Scaffold(
        topBar = {
            if (searchActive) {
                SearchBar(
                    query = uiState.searchQuery,
                    onQueryChange = { viewModel.search(it) },
                    onSearch = { searchActive = false },
                    active = true,
                    onActiveChange = { searchActive = it },
                    placeholder = { Text("Search courses...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotEmpty()) {
                            IconButton(onClick = {
                                viewModel.search("")
                            }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear")
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Search suggestions could go here
                }
            } else {
                TopAppBar(
                    title = { Text("Training") },
                    actions = {
                        IconButton(onClick = { searchActive = true }) {
                            Icon(Icons.Default.Search, contentDescription = "Search")
                        }
                        IconButton(onClick = {
                            viewMode = if (viewMode == ViewMode.GRID) ViewMode.LIST else ViewMode.GRID
                        }) {
                            Icon(
                                if (viewMode == ViewMode.GRID) Icons.Default.ViewList else Icons.Default.GridView,
                                contentDescription = "Toggle view"
                            )
                        }
                        BadgedBox(
                            badge = {
                                if (uiState.certifications.isNotEmpty()) {
                                    Badge { Text("${uiState.certifications.size}") }
                                }
                            }
                        ) {
                            IconButton(onClick = onCertificationsClick) {
                                Icon(Icons.Default.EmojiEvents, contentDescription = "Certifications")
                            }
                        }
                    }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Filter chips
            FilterChipsRow(
                selectedCategory = uiState.selectedCategory,
                selectedDifficulty = uiState.selectedDifficulty,
                onCategorySelected = { viewModel.filterByCategory(it) },
                onDifficultySelected = { viewModel.filterByDifficulty(it) },
                onClearFilters = { viewModel.clearFilters() }
            )

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (uiState.error != null) {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.refresh() }
                )
            } else if (uiState.courses.isEmpty()) {
                EmptyCoursesView(
                    hasFilters = uiState.selectedCategory != null ||
                            uiState.selectedDifficulty != null ||
                            uiState.searchQuery.isNotEmpty(),
                    onClearFilters = { viewModel.clearFilters() }
                )
            } else {
                when (viewMode) {
                    ViewMode.GRID -> {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 160.dp),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(uiState.courses, key = { it.id }) { course ->
                                CourseCard(
                                    course = course,
                                    onClick = { onCourseClick(course.id) }
                                )
                            }
                        }
                    }
                    ViewMode.LIST -> {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(uiState.courses, key = { it.id }) { course ->
                                CourseListItem(
                                    course = course,
                                    onClick = { onCourseClick(course.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class ViewMode {
    GRID, LIST
}

/**
 * Horizontal scrolling filter chips.
 */
@Composable
fun FilterChipsRow(
    selectedCategory: CourseCategory?,
    selectedDifficulty: CourseDifficulty?,
    onCategorySelected: (CourseCategory?) -> Unit,
    onDifficultySelected: (CourseDifficulty?) -> Unit,
    onClearFilters: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Clear filters
        if (selectedCategory != null || selectedDifficulty != null) {
            FilterChip(
                selected = false,
                onClick = onClearFilters,
                label = { Text("Clear") },
                leadingIcon = { Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(16.dp)) }
            )
        }

        // Difficulty chips
        CourseDifficulty.entries.forEach { difficulty ->
            FilterChip(
                selected = selectedDifficulty == difficulty,
                onClick = {
                    onDifficultySelected(if (selectedDifficulty == difficulty) null else difficulty)
                },
                label = { Text(difficulty.displayName) },
                leadingIcon = if (selectedDifficulty == difficulty) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Category chips
        CourseCategory.entries.forEach { category ->
            FilterChip(
                selected = selectedCategory == category,
                onClick = {
                    onCategorySelected(if (selectedCategory == category) null else category)
                },
                label = { Text(category.displayName) },
                leadingIcon = if (selectedCategory == category) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }
    }
}

/**
 * Empty state when no courses are available.
 */
@Composable
fun EmptyCoursesView(
    hasFilters: Boolean,
    onClearFilters: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.School,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (hasFilters) "No matching courses" else "No courses available",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (hasFilters) "Try adjusting your filters" else "Check back later for new training content",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (hasFilters) {
            Spacer(modifier = Modifier.height(16.dp))
            TextButton(onClick = onClearFilters) {
                Text("Clear Filters")
            }
        }
    }
}

/**
 * Error view with retry button.
 */
@Composable
fun ErrorView(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
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
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

/**
 * Course list item for list view mode.
 */
@Composable
fun CourseListItem(
    course: Course,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail
            if (course.imageUrl != null) {
                AsyncImage(
                    model = course.imageUrl,
                    contentDescription = course.title,
                    modifier = Modifier
                        .size(80.dp)
                        .clip(MaterialTheme.shapes.small),
                    contentScale = ContentScale.Crop
                )
            } else {
                Surface(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(MaterialTheme.shapes.small),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = getCategoryIcon(course.category),
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = course.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    DifficultyBadge(difficulty = course.difficulty)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${course.estimatedHours}h",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (course.certificationEnabled) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.EmojiEvents,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Certificate",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Returns an icon for a course category.
 */
fun getCategoryIcon(category: CourseCategory) = when (category) {
    CourseCategory.APP_BASICS -> Icons.Default.PhoneAndroid
    CourseCategory.OPSEC -> Icons.Default.Security
    CourseCategory.DIGITAL_SECURITY -> Icons.Default.Lock
    CourseCategory.LEGAL -> Icons.Default.Gavel
    CourseCategory.MEDIC -> Icons.Default.LocalHospital
    CourseCategory.SELF_DEFENSE -> Icons.Default.Shield
    CourseCategory.ORGANIZING -> Icons.Default.Groups
    CourseCategory.COMMUNICATION -> Icons.Default.Forum
    CourseCategory.CIVIL_DEFENSE -> Icons.Default.HealthAndSafety
    CourseCategory.CUSTOM -> Icons.Default.School
}
