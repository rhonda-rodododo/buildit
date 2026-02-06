package network.buildit.modules.training.presentation.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.usecase.LessonCompletionResult
import network.buildit.modules.training.domain.usecase.QuizSubmissionResult
import network.buildit.modules.training.domain.usecase.QuestionFeedback
import network.buildit.modules.training.presentation.viewmodel.*

/**
 * Lesson player screen that handles different lesson types.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LessonPlayerScreen(
    lessonId: String,
    onNavigateBack: () -> Unit,
    onLessonComplete: () -> Unit,
    viewModel: LessonPlayerViewModel = hiltViewModel()
) {
    LaunchedEffect(lessonId) {
        viewModel.loadLesson(lessonId)
    }

    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val quizState by viewModel.quizState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    when (val state = uiState) {
                        is LessonPlayerUiState.Ready -> Text(state.lesson.title)
                        else -> Text("Lesson")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                },
                actions = {
                    // Timer for quizzes
                    if (quizState.timeRemaining != null && uiState is LessonPlayerUiState.Ready) {
                        val minutes = quizState.timeRemaining!! / 60
                        val seconds = quizState.timeRemaining!! % 60
                        Text(
                            text = String.format("%02d:%02d", minutes, seconds),
                            style = MaterialTheme.typography.titleMedium,
                            color = if (quizState.timeRemaining!! < 60)
                                MaterialTheme.colorScheme.error
                            else
                                MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(end = 16.dp)
                        )
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is LessonPlayerUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is LessonPlayerUiState.Error -> {
                ErrorView(
                    message = state.message,
                    onRetry = { viewModel.loadLesson(lessonId) }
                )
            }
            is LessonPlayerUiState.Ready -> {
                LessonContent(
                    lesson = state.lesson,
                    progress = state.progress,
                    quizState = quizState,
                    viewModel = viewModel,
                    modifier = Modifier.padding(padding)
                )
            }
            is LessonPlayerUiState.Completed -> {
                LessonCompletedView(
                    result = state.result,
                    onContinue = onLessonComplete
                )
            }
        }
    }
}

@Composable
private fun LessonContent(
    lesson: Lesson,
    progress: LessonProgress?,
    quizState: QuizState,
    viewModel: LessonPlayerViewModel,
    modifier: Modifier = Modifier
) {
    when (lesson.content) {
        is LessonContent.Video -> VideoLessonContent(
            content = lesson.content,
            viewModel = viewModel,
            modifier = modifier
        )
        is LessonContent.Document -> DocumentLessonContent(
            content = lesson.content,
            onMarkComplete = { viewModel.markAsRead() },
            modifier = modifier
        )
        is LessonContent.Quiz -> QuizLessonContent(
            content = lesson.content,
            quizState = quizState,
            viewModel = viewModel,
            modifier = modifier
        )
        is LessonContent.Assignment -> AssignmentLessonContent(
            content = lesson.content,
            modifier = modifier
        )
        is LessonContent.LiveSession -> LiveSessionLessonContent(
            content = lesson.content,
            modifier = modifier
        )
        is LessonContent.Interactive -> InteractiveLessonContent(
            content = lesson.content,
            onComplete = { viewModel.markAsRead() },
            modifier = modifier
        )
    }
}

// ============================================================================
// Video Content
// ============================================================================

@Composable
private fun VideoLessonContent(
    content: LessonContent.Video,
    viewModel: LessonPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val videoState by viewModel.videoState.collectAsStateWithLifecycle()

    Column(modifier = modifier.fillMaxSize()) {
        // Video player placeholder
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f),
            color = Color.Black
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.PlayCircle,
                    contentDescription = "Play video",
                    modifier = Modifier.size(64.dp),
                    tint = Color.White
                )
                Text(
                    text = "Video: ${content.videoUrl}",
                    color = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                )
            }
        }

        // Progress bar
        LinearProgressIndicator(
            progress = {
                if (videoState.duration > 0)
                    videoState.currentPosition.toFloat() / videoState.duration
                else 0f
            },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Controls
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            IconButton(onClick = { /* Skip back */ }) {
                Icon(Icons.Default.Replay10, contentDescription = "Skip back 10s")
            }
            IconButton(
                onClick = {
                    viewModel.updateVideoState(isPlaying = !videoState.isPlaying)
                }
            ) {
                Icon(
                    if (videoState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (videoState.isPlaying) "Pause" else "Play",
                    modifier = Modifier.size(48.dp)
                )
            }
            IconButton(onClick = { /* Skip forward */ }) {
                Icon(Icons.Default.Forward10, contentDescription = "Skip forward 10s")
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Mark complete button (shown when video is near end)
        Button(
            onClick = { viewModel.onVideoComplete() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text("Mark as Complete")
        }
    }
}

// ============================================================================
// Document Content
// ============================================================================

@Composable
private fun DocumentLessonContent(
    content: LessonContent.Document,
    onMarkComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            if (content.markdown != null) {
                // Simple markdown rendering (would use a proper markdown library)
                Text(
                    text = content.markdown,
                    style = MaterialTheme.typography.bodyMedium
                )
            } else if (content.pdfUrl != null) {
                // PDF placeholder
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.PictureAsPdf,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("PDF Document")
                        Text(
                            text = content.pdfUrl,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        Button(
            onClick = onMarkComplete,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text("Mark as Read")
        }
    }
}

// ============================================================================
// Quiz Content
// ============================================================================

@Composable
private fun QuizLessonContent(
    content: LessonContent.Quiz,
    quizState: QuizState,
    viewModel: LessonPlayerViewModel,
    modifier: Modifier = Modifier
) {
    // Show results if quiz was submitted
    if (quizState.result != null) {
        QuizResultsView(
            result = quizState.result,
            showCorrectAnswers = content.showCorrectAfter
        )
        return
    }

    val currentQuestion = content.questions.getOrNull(quizState.currentQuestionIndex)
        ?: return

    Column(modifier = modifier.fillMaxSize()) {
        // Progress indicator
        LinearProgressIndicator(
            progress = { (quizState.currentQuestionIndex + 1).toFloat() / content.questions.size },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        )

        Text(
            text = "Question ${quizState.currentQuestionIndex + 1} of ${content.questions.size}",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Question
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = currentQuestion.question,
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Answer options
            val selectedAnswers = quizState.answers[currentQuestion.id] ?: emptyList()

            when (currentQuestion.type) {
                QuizQuestionType.MultipleChoice,
                QuizQuestionType.TrueFalse -> {
                    Column(modifier = Modifier.selectableGroup()) {
                        currentQuestion.options?.forEach { option ->
                            RadioOption(
                                text = option,
                                selected = selectedAnswers.contains(option),
                                onClick = {
                                    viewModel.answerQuestion(currentQuestion.id, listOf(option))
                                }
                            )
                        }
                    }
                }
                QuizQuestionType.MultiSelect -> {
                    Column {
                        currentQuestion.options?.forEach { option ->
                            CheckboxOption(
                                text = option,
                                checked = selectedAnswers.contains(option),
                                onCheckedChange = { checked ->
                                    val newAnswers = if (checked) {
                                        selectedAnswers + option
                                    } else {
                                        selectedAnswers - option
                                    }
                                    viewModel.answerQuestion(currentQuestion.id, newAnswers)
                                }
                            )
                        }
                    }
                }
                QuizQuestionType.FillInBlank,
                QuizQuestionType.ShortAnswer -> {
                    OutlinedTextField(
                        value = selectedAnswers.firstOrNull() ?: "",
                        onValueChange = {
                            viewModel.answerQuestion(currentQuestion.id, listOf(it))
                        },
                        label = { Text("Your answer") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Navigation buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = { viewModel.previousQuestion() },
                enabled = quizState.currentQuestionIndex > 0,
                modifier = Modifier.weight(1f)
            ) {
                Text("Previous")
            }

            if (quizState.currentQuestionIndex < content.questions.size - 1) {
                Button(
                    onClick = { viewModel.nextQuestion() },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Next")
                }
            } else {
                Button(
                    onClick = { viewModel.submitQuiz() },
                    enabled = !quizState.isSubmitting,
                    modifier = Modifier.weight(1f)
                ) {
                    if (quizState.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Submit")
                    }
                }
            }
        }
    }
}

@Composable
private fun RadioOption(
    text: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.RadioButton
            )
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = selected,
            onClick = null
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = text)
    }
}

@Composable
private fun CheckboxOption(
    text: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = text)
    }
}

@Composable
private fun QuizResultsView(
    result: QuizSubmissionResult,
    showCorrectAnswers: Boolean
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            // Score card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (result.passed)
                        MaterialTheme.colorScheme.primaryContainer
                    else
                        MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = if (result.passed) Icons.Default.CheckCircle else Icons.Default.Cancel,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = if (result.passed)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = if (result.passed) "Passed!" else "Not Passed",
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "${result.score}%",
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "${result.correctAnswers} of ${result.totalQuestions} correct",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        if (showCorrectAnswers) {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "Question Review",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            itemsIndexed(result.feedback) { index, feedback ->
                QuestionFeedbackCard(
                    questionNumber = index + 1,
                    feedback = feedback
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun QuestionFeedbackCard(
    questionNumber: Int,
    feedback: QuestionFeedback
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (feedback.isCorrect) Icons.Default.Check else Icons.Default.Close,
                    contentDescription = null,
                    tint = if (feedback.isCorrect)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.error
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Question $questionNumber",
                    style = MaterialTheme.typography.labelMedium
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = feedback.question,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Your answer: ${feedback.selectedAnswer.joinToString(", ")}",
                style = MaterialTheme.typography.bodySmall,
                color = if (feedback.isCorrect)
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.error
            )
            if (!feedback.isCorrect) {
                Text(
                    text = "Correct answer: ${feedback.correctAnswer.joinToString(", ")}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            if (feedback.explanation != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = feedback.explanation,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ============================================================================
// Other Content Types
// ============================================================================

@Composable
private fun AssignmentLessonContent(
    content: LessonContent.Assignment,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Assignment",
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = content.instructions,
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(24.dp))

        content.allowedFileTypes?.let { types ->
            Text(
                text = "Allowed file types: ${types.joinToString(", ")}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        content.maxFileSizeMB?.let { size ->
            Text(
                text = "Maximum file size: ${size}MB",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = { /* Open file picker */ },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Upload, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Upload Submission")
        }
    }
}

@Composable
private fun LiveSessionLessonContent(
    content: LessonContent.LiveSession,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Videocam,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Live Session",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Scheduled for: ${java.text.SimpleDateFormat("MMM d, yyyy 'at' h:mm a").format(java.util.Date(content.scheduledAt * 1000))}",
            style = MaterialTheme.typography.bodyMedium
        )
        Text(
            text = "Duration: ${content.duration} minutes",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(24.dp))

        if (content.conferenceRoomId != null) {
            Button(
                onClick = { /* Join session */ },
                modifier = Modifier.fillMaxWidth(0.8f)
            ) {
                Icon(Icons.Default.VideoCall, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Join Session")
            }
        } else if (content.requiresRSVP) {
            Button(
                onClick = { /* RSVP */ },
                modifier = Modifier.fillMaxWidth(0.8f)
            ) {
                Text("RSVP")
            }
        }

        content.recordingUrl?.let {
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedButton(
                onClick = { /* Watch recording */ }
            ) {
                Icon(Icons.Default.PlayCircle, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Watch Recording")
            }
        }
    }
}

@Composable
private fun InteractiveLessonContent(
    content: LessonContent.Interactive,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.TouchApp,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Interactive Exercise",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = content.exerciseType.value.replace("-", " ").replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(24.dp))

        content.externalUrl?.let { url ->
            Button(
                onClick = { /* Open external URL */ }
            ) {
                Icon(Icons.Default.OpenInNew, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Start Exercise")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        OutlinedButton(onClick = onComplete) {
            Text("Mark Complete")
        }
    }
}

@Composable
private fun LessonCompletedView(
    result: LessonCompletionResult,
    onContinue: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Lesson Complete!",
            style = MaterialTheme.typography.headlineMedium
        )

        if (result.courseCompleted) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Congratulations! You've completed the course!",
                style = MaterialTheme.typography.bodyLarge
            )
        }

        if (result.certificationEarned != null) {
            val cert = result.certificationEarned
            Spacer(modifier = Modifier.height(24.dp))
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.EmojiEvents,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Certification Earned!",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Code: ${cert.verificationCode}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = onContinue,
            modifier = Modifier.fillMaxWidth(0.8f)
        ) {
            Text("Continue")
        }
    }
}
