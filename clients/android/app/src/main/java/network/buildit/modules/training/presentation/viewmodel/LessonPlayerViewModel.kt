package network.buildit.modules.training.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.usecase.*
import javax.inject.Inject

/**
 * UI state for the lesson player.
 */
sealed class LessonPlayerUiState {
    data object Loading : LessonPlayerUiState()
    data class Ready(
        val lesson: Lesson,
        val progress: LessonProgress?,
        val courseProgress: CourseProgress
    ) : LessonPlayerUiState()
    data class Completed(
        val result: LessonCompletionResult
    ) : LessonPlayerUiState()
    data class Error(val message: String) : LessonPlayerUiState()
}

/**
 * UI state for video playback.
 */
data class VideoPlaybackState(
    val isPlaying: Boolean = false,
    val currentPosition: Int = 0,
    val duration: Int = 0,
    val bufferedPosition: Int = 0
)

/**
 * UI state for quiz.
 */
data class QuizState(
    val currentQuestionIndex: Int = 0,
    val answers: Map<String, List<String>> = emptyMap(),
    val isSubmitting: Boolean = false,
    val result: QuizSubmissionResult? = null,
    val startTime: Long = System.currentTimeMillis() / 1000,
    val timeRemaining: Int? = null
)

/**
 * ViewModel for the lesson player screen.
 */
@HiltViewModel
class LessonPlayerViewModel @Inject constructor(
    private val startLessonUseCase: StartLessonUseCase,
    private val completeLessonUseCase: CompleteLessonUseCase,
    private val submitQuizUseCase: SubmitQuizUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<LessonPlayerUiState>(LessonPlayerUiState.Loading)
    val uiState: StateFlow<LessonPlayerUiState> = _uiState.asStateFlow()

    private val _videoState = MutableStateFlow(VideoPlaybackState())
    val videoState: StateFlow<VideoPlaybackState> = _videoState.asStateFlow()

    private val _quizState = MutableStateFlow(QuizState())
    val quizState: StateFlow<QuizState> = _quizState.asStateFlow()

    private var timeTrackingJob: Job? = null
    private var quizTimerJob: Job? = null
    private var currentLessonId: String? = null

    /**
     * Loads and starts a lesson.
     */
    fun loadLesson(lessonId: String) {
        currentLessonId = lessonId
        viewModelScope.launch {
            _uiState.value = LessonPlayerUiState.Loading

            when (val result = startLessonUseCase(lessonId)) {
                is ModuleResult.Success -> {
                    val data = result.data
                    _uiState.value = LessonPlayerUiState.Ready(
                        lesson = data.lesson,
                        progress = data.progress,
                        courseProgress = data.courseProgress
                    )

                    // Initialize content-specific state
                    when (val content = data.lesson.content) {
                        is LessonContent.Video -> initializeVideoState(content, data.progress)
                        is LessonContent.Quiz -> initializeQuizState(content)
                        else -> {}
                    }

                    // Start time tracking
                    startTimeTracking(lessonId)
                }
                is ModuleResult.Error -> {
                    _uiState.value = LessonPlayerUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _uiState.value = LessonPlayerUiState.Error("Training module not enabled")
                }
            }
        }
    }

    // ============================================================================
    // Video Content
    // ============================================================================

    private fun initializeVideoState(content: LessonContent.Video, progress: LessonProgress?) {
        _videoState.value = VideoPlaybackState(
            currentPosition = progress?.lastPosition ?: 0,
            duration = content.duration ?: 0
        )
    }

    /**
     * Updates video playback state.
     */
    fun updateVideoState(
        isPlaying: Boolean? = null,
        currentPosition: Int? = null,
        duration: Int? = null,
        bufferedPosition: Int? = null
    ) {
        _videoState.update { state ->
            state.copy(
                isPlaying = isPlaying ?: state.isPlaying,
                currentPosition = currentPosition ?: state.currentPosition,
                duration = duration ?: state.duration,
                bufferedPosition = bufferedPosition ?: state.bufferedPosition
            )
        }

        // Save position periodically
        currentPosition?.let { position ->
            if (position % 10 == 0) { // Every 10 seconds
                currentLessonId?.let { lessonId ->
                    viewModelScope.launch {
                        startLessonUseCase.updateVideoPosition(lessonId, position)
                    }
                }
            }
        }
    }

    /**
     * Called when video reaches the end.
     */
    fun onVideoComplete() {
        currentLessonId?.let { lessonId ->
            viewModelScope.launch {
                completeLesson()
            }
        }
    }

    // ============================================================================
    // Quiz Content
    // ============================================================================

    private fun initializeQuizState(content: LessonContent.Quiz) {
        _quizState.value = QuizState(
            startTime = System.currentTimeMillis() / 1000,
            timeRemaining = content.timeLimitMinutes?.times(60)
        )

        // Start timer if time limit is set
        content.timeLimitMinutes?.let { minutes ->
            startQuizTimer(minutes * 60)
        }
    }

    /**
     * Answers a quiz question.
     */
    fun answerQuestion(questionId: String, answer: List<String>) {
        _quizState.update { state ->
            state.copy(
                answers = state.answers + (questionId to answer)
            )
        }
    }

    /**
     * Navigates to the next question.
     */
    fun nextQuestion() {
        val state = _uiState.value
        if (state is LessonPlayerUiState.Ready) {
            val quizContent = state.lesson.content as? LessonContent.Quiz ?: return
            _quizState.update { quizState ->
                val nextIndex = (quizState.currentQuestionIndex + 1)
                    .coerceAtMost(quizContent.questions.size - 1)
                quizState.copy(currentQuestionIndex = nextIndex)
            }
        }
    }

    /**
     * Navigates to the previous question.
     */
    fun previousQuestion() {
        _quizState.update { state ->
            state.copy(currentQuestionIndex = maxOf(0, state.currentQuestionIndex - 1))
        }
    }

    /**
     * Goes to a specific question.
     */
    fun goToQuestion(index: Int) {
        _quizState.update { state ->
            state.copy(currentQuestionIndex = index)
        }
    }

    /**
     * Submits quiz answers.
     */
    fun submitQuiz() {
        val lessonId = currentLessonId ?: return
        val quizState = _quizState.value

        viewModelScope.launch {
            _quizState.update { it.copy(isSubmitting = true) }

            when (val result = submitQuizUseCase(
                lessonId = lessonId,
                answers = quizState.answers,
                startTime = quizState.startTime
            )) {
                is ModuleResult.Success -> {
                    quizTimerJob?.cancel()
                    _quizState.update {
                        it.copy(isSubmitting = false, result = result.data)
                    }

                    if (result.data.lessonCompleted) {
                        _uiState.value = LessonPlayerUiState.Completed(
                            LessonCompletionResult(
                                lessonProgress = LessonProgress(
                                    id = "",
                                    lessonId = lessonId,
                                    pubkey = "",
                                    status = ProgressStatus.COMPLETED,
                                    score = result.data.score,
                                    timeSpent = 0,
                                    lastPosition = null,
                                    completedAt = System.currentTimeMillis() / 1000,
                                    attempts = result.data.attempt.answers.size,
                                    created = 0,
                                    updated = 0
                                ),
                                courseProgress = CourseProgress(
                                    id = "",
                                    courseId = "",
                                    pubkey = "",
                                    percentComplete = 0f,
                                    lessonsCompleted = 0,
                                    totalLessons = 0,
                                    currentModuleId = null,
                                    currentLessonId = null,
                                    startedAt = 0,
                                    lastActivityAt = 0,
                                    completedAt = null
                                ),
                                courseCompleted = false,
                                certificationEarned = null
                            )
                        )
                    }
                }
                is ModuleResult.Error -> {
                    _quizState.update {
                        it.copy(isSubmitting = false)
                    }
                    _uiState.value = LessonPlayerUiState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _quizState.update { it.copy(isSubmitting = false) }
                }
            }
        }
    }

    private fun startQuizTimer(seconds: Int) {
        quizTimerJob?.cancel()
        quizTimerJob = viewModelScope.launch {
            var remaining = seconds
            while (remaining > 0 && isActive) {
                _quizState.update { it.copy(timeRemaining = remaining) }
                delay(1000)
                remaining--
            }
            // Auto-submit when time runs out
            if (remaining <= 0) {
                submitQuiz()
            }
        }
    }

    // ============================================================================
    // Document & General Content
    // ============================================================================

    /**
     * Marks a document/content as read.
     */
    fun markAsRead() {
        viewModelScope.launch {
            completeLesson()
        }
    }

    // ============================================================================
    // Common Operations
    // ============================================================================

    /**
     * Completes the current lesson.
     */
    suspend fun completeLesson(score: Int? = null) {
        val lessonId = currentLessonId ?: return

        when (val result = completeLessonUseCase(lessonId, score)) {
            is ModuleResult.Success -> {
                _uiState.value = LessonPlayerUiState.Completed(result.data)
            }
            is ModuleResult.Error -> {
                _uiState.value = LessonPlayerUiState.Error(result.message)
            }
            ModuleResult.NotEnabled -> {
                _uiState.value = LessonPlayerUiState.Error("Training module not enabled")
            }
        }
    }

    private fun startTimeTracking(lessonId: String) {
        timeTrackingJob?.cancel()
        timeTrackingJob = viewModelScope.launch {
            var elapsed = 0L
            while (isActive) {
                delay(60_000) // Update every minute
                elapsed += 60
                startLessonUseCase.updateTimeSpent(lessonId, 60)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        timeTrackingJob?.cancel()
        quizTimerJob?.cancel()

        // Save final video position
        val state = _uiState.value
        if (state is LessonPlayerUiState.Ready && state.lesson.type == LessonType.VIDEO) {
            currentLessonId?.let { lessonId ->
                viewModelScope.launch {
                    startLessonUseCase.updateVideoPosition(lessonId, _videoState.value.currentPosition)
                }
            }
        }
    }
}
