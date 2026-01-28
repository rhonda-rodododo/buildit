package network.buildit.modules.training.presentation.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import network.buildit.modules.training.domain.usecase.*
import network.buildit.modules.training.presentation.ui.components.*
import network.buildit.modules.training.presentation.viewmodel.CourseDetailUiState
import network.buildit.modules.training.presentation.viewmodel.CourseDetailViewModel

/**
 * Course detail screen showing modules, lessons, and progress.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CourseDetailScreen(
    courseId: String,
    onNavigateBack: () -> Unit,
    onLessonClick: (String) -> Unit,
    viewModel: CourseDetailViewModel = hiltViewModel()
) {
    LaunchedEffect(courseId) {
        viewModel.loadCourse(courseId)
    }

    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    when (val state = uiState) {
                        is CourseDetailUiState.Success -> Text(
                            text = state.courseDetail.course.title,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        else -> Text("Course")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is CourseDetailUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is CourseDetailUiState.Error -> {
                ErrorView(
                    message = state.message,
                    onRetry = { viewModel.refresh() }
                )
            }
            is CourseDetailUiState.Success -> {
                CourseDetailContent(
                    courseDetail = state.courseDetail,
                    isEnrolled = state.isEnrolled,
                    onLessonClick = onLessonClick,
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun CourseDetailContent(
    courseDetail: CourseDetail,
    isEnrolled: Boolean,
    onLessonClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val course = courseDetail.course
    val progress = courseDetail.progress
    val expandedModules = remember { mutableStateMapOf<String, Boolean>() }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        // Course header
        item {
            CourseHeader(
                course = course,
                progress = progress,
                certification = courseDetail.certification
            )
        }

        // Progress bar if enrolled
        if (progress != null) {
            item {
                CourseProgressSection(progress = progress)
            }
        }

        // Description
        item {
            Text(
                text = course.description,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        // Modules and lessons
        item {
            Text(
                text = "Curriculum",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        items(courseDetail.modules, key = { it.module.id }) { moduleWithLessons ->
            val isExpanded = expandedModules[moduleWithLessons.module.id] ?: true

            ModuleSection(
                moduleWithLessons = moduleWithLessons,
                isExpanded = isExpanded,
                onToggleExpand = {
                    expandedModules[moduleWithLessons.module.id] = !isExpanded
                },
                onLessonClick = onLessonClick
            )
        }

        // Certification info
        if (course.certificationEnabled) {
            item {
                CertificationInfoSection(course = course)
            }
        }
    }
}

@Composable
private fun CourseHeader(
    course: Course,
    progress: CourseProgress?,
    certification: Certification?
) {
    Column {
        // Course image
        if (course.imageUrl != null) {
            AsyncImage(
                model = course.imageUrl,
                contentDescription = course.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentScale = ContentScale.Crop
            )
        } else {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = getCategoryIcon(course.category),
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Course info badges
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CategoryBadge(category = course.category)
            DifficultyBadge(difficulty = course.difficulty)
            AssistChip(
                onClick = { },
                label = { Text("${course.estimatedHours}h") },
                leadingIcon = {
                    Icon(Icons.Default.Schedule, contentDescription = null, modifier = Modifier.size(16.dp))
                }
            )
        }

        // Certification badge if earned
        if (certification != null && certification.isValid) {
            Spacer(modifier = Modifier.height(12.dp))
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = MaterialTheme.shapes.medium
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.VerifiedUser,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Certified",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Verification: ${certification.verificationCode}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseProgressSection(progress: CourseProgress) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Your Progress",
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    text = "${progress.percentComplete.toInt()}%",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progress.percentComplete / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(MaterialTheme.shapes.small)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "${progress.lessonsCompleted} of ${progress.totalLessons} lessons completed",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ModuleSection(
    moduleWithLessons: ModuleWithLessons,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onLessonClick: (String) -> Unit
) {
    val module = moduleWithLessons.module
    val completedLessons = moduleWithLessons.lessons.count {
        it.progress?.status == ProgressStatus.COMPLETED
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Column {
            // Module header
            ListItem(
                headlineContent = { Text(module.title) },
                supportingContent = {
                    Text("${moduleWithLessons.lessons.size} lessons - ${module.estimatedMinutes} min")
                },
                leadingContent = {
                    if (completedLessons == moduleWithLessons.lessons.size && moduleWithLessons.lessons.isNotEmpty()) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = "Completed",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    } else {
                        CircularProgressIndicator(
                            progress = {
                                if (moduleWithLessons.lessons.isEmpty()) 0f
                                else completedLessons.toFloat() / moduleWithLessons.lessons.size
                            },
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    }
                },
                trailingContent = {
                    IconButton(onClick = onToggleExpand) {
                        Icon(
                            if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (isExpanded) "Collapse" else "Expand"
                        )
                    }
                },
                modifier = Modifier.clickable(onClick = onToggleExpand)
            )

            // Lessons
            AnimatedVisibility(visible = isExpanded) {
                Column {
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    moduleWithLessons.lessons.forEach { lessonWithProgress ->
                        LessonListItem(
                            lessonWithProgress = lessonWithProgress,
                            onClick = { onLessonClick(lessonWithProgress.lesson.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LessonListItem(
    lessonWithProgress: LessonWithProgress,
    onClick: () -> Unit
) {
    val lesson = lessonWithProgress.lesson
    val progress = lessonWithProgress.progress
    val isCompleted = progress?.status == ProgressStatus.COMPLETED

    ListItem(
        headlineContent = {
            Text(
                text = lesson.title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        supportingContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = getLessonTypeIcon(lesson.type),
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = lesson.type.displayName,
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${lesson.estimatedMinutes} min",
                    style = MaterialTheme.typography.bodySmall
                )
                if (lesson.requiredForCertification) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = "Required",
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        },
        leadingContent = {
            when {
                isCompleted -> Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = "Completed",
                    tint = MaterialTheme.colorScheme.primary
                )
                progress?.status == ProgressStatus.IN_PROGRESS -> Icon(
                    Icons.Default.PlayCircle,
                    contentDescription = "In Progress",
                    tint = MaterialTheme.colorScheme.tertiary
                )
                else -> Icon(
                    Icons.Default.Circle,
                    contentDescription = "Not Started",
                    tint = MaterialTheme.colorScheme.outlineVariant
                )
            }
        },
        trailingContent = {
            progress?.score?.let { score ->
                Text(
                    text = "$score%",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (score >= (lesson.passingScore ?: 0))
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.error
                )
            }
        },
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(start = 16.dp)
    )
}

@Composable
private fun CertificationInfoSection(course: Course) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onTertiaryContainer
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = "Certification Available",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
                Text(
                    text = if (course.certificationExpiryDays != null)
                        "Valid for ${course.certificationExpiryDays} days after completion"
                    else
                        "No expiration",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.8f)
                )
            }
        }
    }
}

/**
 * Returns an icon for a lesson type.
 */
fun getLessonTypeIcon(type: LessonType) = when (type) {
    LessonType.VIDEO -> Icons.Default.PlayCircle
    LessonType.DOCUMENT -> Icons.Default.Article
    LessonType.QUIZ -> Icons.Default.Quiz
    LessonType.ASSIGNMENT -> Icons.Default.Assignment
    LessonType.LIVE_SESSION -> Icons.Default.Videocam
    LessonType.INTERACTIVE -> Icons.Default.TouchApp
}
