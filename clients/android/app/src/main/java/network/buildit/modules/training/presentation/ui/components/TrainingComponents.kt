package network.buildit.modules.training.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.usecase.CertificationWithCourse
import network.buildit.modules.training.presentation.ui.getCategoryIcon

/**
 * Course card for grid view.
 */
@Composable
fun CourseCard(
    course: Course,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column {
            // Image
            if (course.imageUrl != null) {
                AsyncImage(
                    model = course.imageUrl,
                    contentDescription = course.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                    contentScale = ContentScale.Crop
                )
            } else {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp),
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

            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = course.title,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    DifficultyBadge(difficulty = course.difficulty, compact = true)
                    Spacer(modifier = Modifier.weight(1f))
                    if (course.certificationEnabled) {
                        Icon(
                            imageVector = Icons.Default.EmojiEvents,
                            contentDescription = "Certification available",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${course.estimatedHours}h",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Category badge chip.
 */
@Composable
fun CategoryBadge(
    category: CourseCategory,
    modifier: Modifier = Modifier
) {
    AssistChip(
        onClick = { },
        label = { Text(category.displayName) },
        leadingIcon = {
            Icon(
                imageVector = getCategoryIcon(category),
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        modifier = modifier
    )
}

/**
 * Difficulty badge.
 */
@Composable
fun DifficultyBadge(
    difficulty: CourseDifficulty,
    compact: Boolean = false,
    modifier: Modifier = Modifier
) {
    val (color, backgroundColor) = when (difficulty) {
        CourseDifficulty.BEGINNER -> Pair(
            Color(0xFF2E7D32),
            Color(0xFFE8F5E9)
        )
        CourseDifficulty.INTERMEDIATE -> Pair(
            Color(0xFFF57C00),
            Color(0xFFFFF3E0)
        )
        CourseDifficulty.ADVANCED -> Pair(
            Color(0xFFC62828),
            Color(0xFFFFEBEE)
        )
    }

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.small,
        color = backgroundColor
    ) {
        Text(
            text = if (compact) difficulty.displayName.take(3).uppercase() else difficulty.displayName,
            style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
            color = color,
            modifier = Modifier.padding(
                horizontal = if (compact) 6.dp else 8.dp,
                vertical = if (compact) 2.dp else 4.dp
            )
        )
    }
}

/**
 * Progress bar with percentage label.
 */
@Composable
fun ProgressBarWithLabel(
    progress: Float,
    label: String? = null,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            label?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "${(progress * 100).toInt()}%",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(MaterialTheme.shapes.small)
        )
    }
}

/**
 * Certificate badge for displaying earned certifications.
 */
@Composable
fun CertificateBadge(
    certification: CertificationWithCourse,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Badge icon
            Surface(
                modifier = Modifier.size(48.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.VerifiedUser,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = certification.course?.title ?: "Unknown Course",
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "Earned ${formatDate(certification.certification.earnedAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Expiry warning
                certification.expiresInDays?.let { days ->
                    if (days <= 30) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (days > 0) "Expires in $days days" else "Expired",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }

            // Verification code
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = certification.certification.verificationCode,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Module item showing progress.
 */
@Composable
fun ModuleItem(
    module: TrainingModule,
    completedLessons: Int,
    totalLessons: Int,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = if (totalLessons > 0) completedLessons.toFloat() / totalLessons else 0f

    ListItem(
        headlineContent = { Text(module.title) },
        supportingContent = {
            Column {
                Text("$completedLessons of $totalLessons lessons - ${module.estimatedMinutes} min")
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(MaterialTheme.shapes.small)
                )
            }
        },
        leadingContent = {
            if (completedLessons == totalLessons && totalLessons > 0) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = "Completed",
                    tint = MaterialTheme.colorScheme.primary
                )
            } else {
                Box(
                    modifier = Modifier.size(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        progress = { progress },
                        strokeWidth = 2.dp,
                        modifier = Modifier.fillMaxSize()
                    )
                    Text(
                        text = "${(progress * 100).toInt()}",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
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
        modifier = modifier.clickable(onClick = onToggleExpand)
    )
}

/**
 * Lesson item with status indicator.
 */
@Composable
fun LessonItem(
    lesson: Lesson,
    progress: LessonProgress?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isCompleted = progress?.status == ProgressStatus.COMPLETED
    val isInProgress = progress?.status == ProgressStatus.IN_PROGRESS

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
                Text(
                    text = lesson.type.displayName,
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    text = " - ${lesson.estimatedMinutes} min",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        leadingContent = {
            Icon(
                imageVector = when {
                    isCompleted -> Icons.Default.CheckCircle
                    isInProgress -> Icons.Default.PlayCircle
                    else -> Icons.Default.Circle
                },
                contentDescription = null,
                tint = when {
                    isCompleted -> MaterialTheme.colorScheme.primary
                    isInProgress -> MaterialTheme.colorScheme.tertiary
                    else -> MaterialTheme.colorScheme.outlineVariant
                }
            )
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
        modifier = modifier.clickable(onClick = onClick)
    )
}

/**
 * Quiz component for inline quizzes.
 */
@Composable
fun QuizComponent(
    question: QuizQuestion,
    selectedAnswers: List<String>,
    onAnswerSelected: (List<String>) -> Unit,
    showFeedback: Boolean = false,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = question.question,
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(12.dp))

            question.options?.forEach { option ->
                val isSelected = selectedAnswers.contains(option)
                val isCorrect = question.correctAnswer.contains(option)

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable(enabled = !showFeedback) {
                            val newAnswers = when (question.type) {
                                QuizQuestionType.MULTI_SELECT -> {
                                    if (isSelected) selectedAnswers - option
                                    else selectedAnswers + option
                                }
                                else -> listOf(option)
                            }
                            onAnswerSelected(newAnswers)
                        },
                    shape = MaterialTheme.shapes.small,
                    color = when {
                        showFeedback && isCorrect -> Color(0xFFE8F5E9)
                        showFeedback && isSelected && !isCorrect -> Color(0xFFFFEBEE)
                        isSelected -> MaterialTheme.colorScheme.primaryContainer
                        else -> MaterialTheme.colorScheme.surface
                    },
                    tonalElevation = if (isSelected) 2.dp else 0.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (question.type == QuizQuestionType.MULTI_SELECT) {
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = null,
                                enabled = !showFeedback
                            )
                        } else {
                            RadioButton(
                                selected = isSelected,
                                onClick = null,
                                enabled = !showFeedback
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = option)

                        if (showFeedback) {
                            Spacer(modifier = Modifier.weight(1f))
                            if (isCorrect) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = "Correct",
                                    tint = Color(0xFF2E7D32)
                                )
                            } else if (isSelected) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Incorrect",
                                    tint = Color(0xFFC62828)
                                )
                            }
                        }
                    }
                }
            }

            if (showFeedback && question.explanation != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = question.explanation,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }
    }
}

/**
 * Formats a Unix timestamp to a human-readable date.
 */
private fun formatDate(timestamp: Long): String {
    val formatter = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.getDefault())
    return formatter.format(java.util.Date(timestamp * 1000))
}
