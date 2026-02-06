package network.buildit.modules.training.domain.model

// Re-export generated protocol types as the source of truth for enums.
// Only UI-specific extension properties (displayName) and lookup functions are defined locally.
import network.buildit.generated.schemas.training.CourseCategory
import network.buildit.generated.schemas.training.CourseDifficulty
import network.buildit.generated.schemas.training.CourseStatus
import network.buildit.generated.schemas.training.LessonType
import network.buildit.generated.schemas.training.QuizQuestionType
import network.buildit.generated.schemas.training.ProgressStatus
import network.buildit.generated.schemas.training.AssignmentReviewStatus
import network.buildit.generated.schemas.training.InteractiveExerciseType
import network.buildit.generated.schemas.training.LiveSessionRSVPStatus

// ============================================================================
// Extension properties for generated enums (UI display names)
// ============================================================================

val CourseCategory.displayName: String
    get() = when (this) {
        CourseCategory.AppBasics -> "App Basics"
        CourseCategory.Opsec -> "OPSEC"
        CourseCategory.DigitalSecurity -> "Digital Security"
        CourseCategory.Legal -> "Legal"
        CourseCategory.Medic -> "Medic"
        CourseCategory.SelfDefense -> "Self Defense"
        CourseCategory.Organizing -> "Organizing"
        CourseCategory.Communication -> "Communication"
        CourseCategory.CivilDefense -> "Civil Defense"
        CourseCategory.Custom -> "Custom"
    }

val CourseDifficulty.displayName: String
    get() = when (this) {
        CourseDifficulty.Beginner -> "Beginner"
        CourseDifficulty.Intermediate -> "Intermediate"
        CourseDifficulty.Advanced -> "Advanced"
    }

val CourseStatus.displayName: String
    get() = when (this) {
        CourseStatus.Draft -> "Draft"
        CourseStatus.Published -> "Published"
        CourseStatus.Archived -> "Archived"
    }

val LessonType.displayName: String
    get() = when (this) {
        LessonType.Video -> "Video"
        LessonType.Document -> "Document"
        LessonType.Quiz -> "Quiz"
        LessonType.Assignment -> "Assignment"
        LessonType.LiveSession -> "Live Session"
        LessonType.Interactive -> "Interactive"
    }

val ProgressStatus.displayName: String
    get() = when (this) {
        ProgressStatus.NotStarted -> "Not Started"
        ProgressStatus.InProgress -> "In Progress"
        ProgressStatus.Completed -> "Completed"
    }

// ============================================================================
// Lookup functions for parsing string values into generated enums
// ============================================================================

fun courseCategoryFromValue(value: String): CourseCategory =
    CourseCategory.entries.find { it.value == value } ?: CourseCategory.Custom

fun courseDifficultyFromValue(value: String): CourseDifficulty =
    CourseDifficulty.entries.find { it.value == value } ?: CourseDifficulty.Beginner

fun courseStatusFromValue(value: String): CourseStatus =
    CourseStatus.entries.find { it.value == value } ?: CourseStatus.Draft

fun lessonTypeFromValue(value: String): LessonType =
    LessonType.entries.find { it.value == value } ?: LessonType.Document

fun quizQuestionTypeFromValue(value: String): QuizQuestionType =
    QuizQuestionType.entries.find { it.value == value } ?: QuizQuestionType.MultipleChoice

fun progressStatusFromValue(value: String): ProgressStatus =
    ProgressStatus.entries.find { it.value == value } ?: ProgressStatus.NotStarted

fun assignmentReviewStatusFromValue(value: String): AssignmentReviewStatus =
    AssignmentReviewStatus.entries.find { it.value == value } ?: AssignmentReviewStatus.Pending

fun interactiveExerciseTypeFromValue(value: String): InteractiveExerciseType =
    InteractiveExerciseType.entries.find { it.value == value } ?: InteractiveExerciseType.Custom

/** Typealias for LiveSessionRSVPStatus to maintain backward compatibility as RSVPStatus. */
typealias RSVPStatus = LiveSessionRSVPStatus

fun rsvpStatusFromValue(value: String): LiveSessionRSVPStatus =
    LiveSessionRSVPStatus.entries.find { it.value == value } ?: LiveSessionRSVPStatus.Tentative

// ============================================================================
// Core Domain Models
// ============================================================================

/**
 * Training course - top-level container for training content.
 */
data class Course(
    val id: String,
    val groupId: String?,
    val title: String,
    val description: String,
    val imageUrl: String?,
    val category: CourseCategory,
    val difficulty: CourseDifficulty,
    val estimatedHours: Float,
    val prerequisites: List<String>,
    val status: CourseStatus,
    val certificationEnabled: Boolean,
    val certificationExpiryDays: Int?,
    val isPublic: Boolean,
    val isDefault: Boolean,
    val created: Long,
    val createdBy: String,
    val updated: Long
)

/**
 * Training module - chapter within a course.
 */
data class TrainingModule(
    val id: String,
    val courseId: String,
    val title: String,
    val description: String?,
    val order: Int,
    val estimatedMinutes: Int,
    val created: Long,
    val updated: Long
)

/**
 * Lesson - individual learning unit within a module.
 */
data class Lesson(
    val id: String,
    val moduleId: String,
    val type: LessonType,
    val title: String,
    val description: String?,
    val content: LessonContent,
    val order: Int,
    val estimatedMinutes: Int,
    val requiredForCertification: Boolean,
    val passingScore: Int?,
    val created: Long,
    val updated: Long
)

// ============================================================================
// Lesson Content Types (Sealed Class Hierarchy)
// ============================================================================

/**
 * Sealed class representing different types of lesson content.
 */
sealed class LessonContent {
    abstract val type: LessonType

    data class Video(
        val videoUrl: String,
        val transcriptUrl: String?,
        val captionsUrl: String?,
        val chaptersUrl: String?,
        val duration: Int?
    ) : LessonContent() {
        override val type: LessonType = LessonType.Video
    }

    data class Document(
        val markdown: String?,
        val pdfUrl: String?
    ) : LessonContent() {
        override val type: LessonType = LessonType.Document
    }

    data class Quiz(
        val questions: List<QuizQuestion>,
        val passingScore: Int,
        val allowRetakes: Boolean,
        val maxAttempts: Int?,
        val shuffleQuestions: Boolean,
        val shuffleOptions: Boolean,
        val showCorrectAfter: Boolean,
        val timeLimitMinutes: Int?
    ) : LessonContent() {
        override val type: LessonType = LessonType.Quiz
    }

    data class Assignment(
        val instructions: String,
        val allowedFileTypes: List<String>?,
        val maxFileSizeMB: Int?,
        val rubric: List<AssignmentRubricItem>?
    ) : LessonContent() {
        override val type: LessonType = LessonType.Assignment
    }

    data class LiveSession(
        val scheduledAt: Long,
        val duration: Int,
        val instructorPubkey: String,
        val conferenceRoomId: String?,
        val recordingUrl: String?,
        val maxParticipants: Int?,
        val requiresRSVP: Boolean
    ) : LessonContent() {
        override val type: LessonType = LessonType.LiveSession
    }

    data class Interactive(
        val exerciseType: InteractiveExerciseType,
        val configJson: String,
        val externalUrl: String?
    ) : LessonContent() {
        override val type: LessonType = LessonType.Interactive
    }
}

/**
 * Quiz question within a quiz lesson.
 */
data class QuizQuestion(
    val id: String,
    val type: QuizQuestionType,
    val question: String,
    val options: List<String>?,
    val correctAnswer: List<String>,
    val explanation: String?,
    val points: Int,
    val order: Int
)

/**
 * Assignment rubric item for grading.
 */
data class AssignmentRubricItem(
    val id: String,
    val criterion: String,
    val description: String,
    val maxPoints: Int
)

// ============================================================================
// Progress Tracking Models
// ============================================================================

/**
 * User progress on a lesson.
 */
data class LessonProgress(
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val status: ProgressStatus,
    val score: Int?,
    val timeSpent: Long,
    val lastPosition: Int?,
    val completedAt: Long?,
    val attempts: Int?,
    val created: Long,
    val updated: Long
)

/**
 * User progress on a course.
 */
data class CourseProgress(
    val id: String,
    val courseId: String,
    val pubkey: String,
    val percentComplete: Float,
    val lessonsCompleted: Int,
    val totalLessons: Int,
    val currentModuleId: String?,
    val currentLessonId: String?,
    val startedAt: Long,
    val lastActivityAt: Long,
    val completedAt: Long?
)

/**
 * Quiz attempt record.
 */
data class QuizAttempt(
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val answers: List<QuizAnswer>,
    val score: Int,
    val passed: Boolean,
    val startedAt: Long,
    val completedAt: Long,
    val duration: Long
)

/**
 * Individual quiz answer.
 */
data class QuizAnswer(
    val questionId: String,
    val selectedAnswer: List<String>,
    val isCorrect: Boolean,
    val points: Int
)

/**
 * Assignment submission.
 */
data class AssignmentSubmission(
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val fileUrl: String,
    val fileName: String,
    val fileSize: Long,
    val submittedAt: Long,
    val reviewStatus: AssignmentReviewStatus,
    val reviewedBy: String?,
    val reviewedAt: Long?,
    val feedback: String?,
    val score: Int?,
    val rubricScores: Map<String, Int>?
)

// ============================================================================
// Certification Models
// ============================================================================

/**
 * Certification record issued upon course completion.
 */
data class Certification(
    val id: String,
    val courseId: String,
    val pubkey: String,
    val earnedAt: Long,
    val expiresAt: Long?,
    val verificationCode: String,
    val metadata: Map<String, String>?,
    val revokedAt: Long?,
    val revokedBy: String?,
    val revokeReason: String?
) {
    val isValid: Boolean
        get() = revokedAt == null && (expiresAt == null || expiresAt > System.currentTimeMillis() / 1000)

    val isExpired: Boolean
        get() = expiresAt != null && expiresAt < System.currentTimeMillis() / 1000

    val isRevoked: Boolean
        get() = revokedAt != null
}

/**
 * Certification verification result.
 */
data class CertificationVerification(
    val valid: Boolean,
    val certification: Certification?,
    val course: Course?,
    val holderName: String?,
    val expired: Boolean,
    val revoked: Boolean,
    val error: String?
)

// ============================================================================
// Live Session Models
// ============================================================================

/**
 * Live session RSVP record.
 */
data class LiveSessionRSVP(
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val status: RSVPStatus,
    val createdAt: Long,
    val updatedAt: Long
)

/**
 * Live session attendance record.
 */
data class LiveSessionAttendance(
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val joinedAt: Long,
    val leftAt: Long?,
    val duration: Long,
    val wasCompleteSession: Boolean
)

// ============================================================================
// Statistics and Analytics Models
// ============================================================================

/**
 * Course statistics for trainers.
 */
data class CourseStats(
    val courseId: String,
    val enrolledCount: Int,
    val completedCount: Int,
    val averageProgress: Float,
    val averageCompletionTimeHours: Float,
    val certificationCount: Int,
    val averageQuizScore: Float
)

/**
 * User training status for CRM integration.
 */
data class UserTrainingStatus(
    val pubkey: String,
    val coursesEnrolled: Int,
    val coursesCompleted: Int,
    val certificationsEarned: Int,
    val certificationsExpiring: Int,
    val totalTimeSpentHours: Float,
    val lastActivity: Long?
)

// ============================================================================
// Query Options
// ============================================================================

/**
 * Options for querying courses.
 */
data class CourseQueryOptions(
    val groupId: String? = null,
    val category: CourseCategory? = null,
    val difficulty: CourseDifficulty? = null,
    val status: CourseStatus? = null,
    val includePublic: Boolean = true,
    val search: String? = null,
    val sortBy: CourseSortField = CourseSortField.CREATED,
    val sortOrder: SortOrder = SortOrder.DESC,
    val limit: Int? = null,
    val offset: Int? = null
)

/**
 * Sort fields for course queries.
 */
enum class CourseSortField {
    TITLE, CREATED, UPDATED, DIFFICULTY
}

/**
 * Sort order.
 */
enum class SortOrder {
    ASC, DESC
}
