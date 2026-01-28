package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import java.util.UUID
import javax.inject.Inject

/**
 * Result of submitting a quiz.
 */
data class QuizSubmissionResult(
    val attempt: QuizAttempt,
    val passed: Boolean,
    val score: Int,
    val totalPoints: Int,
    val correctAnswers: Int,
    val totalQuestions: Int,
    val lessonCompleted: Boolean,
    val feedback: List<QuestionFeedback>
)

/**
 * Feedback for a single question.
 */
data class QuestionFeedback(
    val questionId: String,
    val question: String,
    val selectedAnswer: List<String>,
    val correctAnswer: List<String>,
    val isCorrect: Boolean,
    val explanation: String?,
    val pointsEarned: Int,
    val maxPoints: Int
)

/**
 * Use case for submitting quiz answers.
 */
class SubmitQuizUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager,
    private val completeLessonUseCase: CompleteLessonUseCase
) {
    /**
     * Submits quiz answers and calculates the score.
     */
    suspend operator fun invoke(
        lessonId: String,
        answers: Map<String, List<String>>,
        startTime: Long
    ): ModuleResult<QuizSubmissionResult> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val now = System.currentTimeMillis() / 1000

            // Get the lesson
            val lesson = repository.getLesson(lessonId).first()
                ?: throw IllegalArgumentException("Lesson not found")

            // Verify it's a quiz lesson
            if (lesson.type != LessonType.QUIZ) {
                throw IllegalArgumentException("Lesson is not a quiz")
            }

            val quizContent = lesson.content as? LessonContent.Quiz
                ?: throw IllegalArgumentException("Invalid quiz content")

            // Check attempt limits
            val existingAttempts = repository.getQuizAttempts(lessonId, pubkey).first()
            if (!quizContent.allowRetakes && existingAttempts.isNotEmpty()) {
                throw IllegalStateException("Retakes are not allowed for this quiz")
            }
            if (quizContent.maxAttempts != null && existingAttempts.size >= quizContent.maxAttempts) {
                throw IllegalStateException("Maximum attempts reached")
            }

            // Calculate score
            var totalPoints = 0
            var earnedPoints = 0
            var correctCount = 0
            val quizAnswers = mutableListOf<QuizAnswer>()
            val feedback = mutableListOf<QuestionFeedback>()

            for (question in quizContent.questions) {
                totalPoints += question.points
                val userAnswer = answers[question.id] ?: emptyList()
                val correctAnswer = question.correctAnswer

                val isCorrect = when (question.type) {
                    QuizQuestionType.MULTIPLE_CHOICE,
                    QuizQuestionType.TRUE_FALSE,
                    QuizQuestionType.FILL_IN_BLANK -> {
                        userAnswer.firstOrNull()?.equals(correctAnswer.firstOrNull(), ignoreCase = true) == true
                    }
                    QuizQuestionType.MULTI_SELECT -> {
                        userAnswer.sorted() == correctAnswer.sorted()
                    }
                    QuizQuestionType.SHORT_ANSWER -> {
                        // For short answer, check if any correct answer matches
                        correctAnswer.any { correct ->
                            userAnswer.firstOrNull()?.contains(correct, ignoreCase = true) == true
                        }
                    }
                }

                val pointsEarned = if (isCorrect) question.points else 0
                earnedPoints += pointsEarned
                if (isCorrect) correctCount++

                quizAnswers.add(
                    QuizAnswer(
                        questionId = question.id,
                        selectedAnswer = userAnswer,
                        isCorrect = isCorrect,
                        points = pointsEarned
                    )
                )

                feedback.add(
                    QuestionFeedback(
                        questionId = question.id,
                        question = question.question,
                        selectedAnswer = userAnswer,
                        correctAnswer = correctAnswer,
                        isCorrect = isCorrect,
                        explanation = if (quizContent.showCorrectAfter) question.explanation else null,
                        pointsEarned = pointsEarned,
                        maxPoints = question.points
                    )
                )
            }

            // Calculate percentage score
            val scorePercentage = if (totalPoints > 0) {
                ((earnedPoints.toFloat() / totalPoints.toFloat()) * 100).toInt()
            } else 0

            val passed = scorePercentage >= quizContent.passingScore

            // Create quiz attempt record
            val attempt = QuizAttempt(
                id = UUID.randomUUID().toString(),
                lessonId = lessonId,
                pubkey = pubkey,
                answers = quizAnswers,
                score = scorePercentage,
                passed = passed,
                startedAt = startTime,
                completedAt = now,
                duration = now - startTime
            )

            repository.saveQuizAttempt(attempt)

            // If passed, complete the lesson
            var lessonCompleted = false
            if (passed) {
                val result = completeLessonUseCase(lessonId, scorePercentage)
                lessonCompleted = result is ModuleResult.Success
            } else {
                // Update progress with score even if not passed
                val progress = repository.getLessonProgress(lessonId, pubkey).first()
                if (progress != null) {
                    val bestScore = repository.getBestQuizScore(lessonId, pubkey) ?: 0
                    repository.updateProgress(
                        progress.copy(
                            score = maxOf(bestScore, scorePercentage),
                            attempts = (progress.attempts ?: 0) + 1,
                            updated = now
                        )
                    )
                }
            }

            QuizSubmissionResult(
                attempt = attempt,
                passed = passed,
                score = scorePercentage,
                totalPoints = totalPoints,
                correctAnswers = correctCount,
                totalQuestions = quizContent.questions.size,
                lessonCompleted = lessonCompleted,
                feedback = feedback
            )
        }.toModuleResult()
    }

    /**
     * Gets previous attempts for a quiz.
     */
    suspend fun getAttempts(lessonId: String): List<QuizAttempt> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return emptyList()
        return repository.getQuizAttempts(lessonId, pubkey).first()
    }

    /**
     * Gets the best score for a quiz.
     */
    suspend fun getBestScore(lessonId: String): Int? {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return null
        return repository.getBestQuizScore(lessonId, pubkey)
    }

    /**
     * Checks if retakes are allowed.
     */
    suspend fun canRetake(lessonId: String): Boolean {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return false

        val lesson = repository.getLesson(lessonId).first() ?: return false
        val quizContent = lesson.content as? LessonContent.Quiz ?: return false
        val attempts = repository.getQuizAttempts(lessonId, pubkey).first()

        if (!quizContent.allowRetakes && attempts.isNotEmpty()) return false
        if (quizContent.maxAttempts != null && attempts.size >= quizContent.maxAttempts) return false

        return true
    }
}
