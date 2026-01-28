package network.buildit.modules.training.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Course category types for organizing training content.
 */
@Serializable
enum class CourseCategory(val value: String, val displayName: String) {
    @SerialName("app-basics") APP_BASICS("app-basics", "App Basics"),
    @SerialName("opsec") OPSEC("opsec", "OPSEC"),
    @SerialName("digital-security") DIGITAL_SECURITY("digital-security", "Digital Security"),
    @SerialName("legal") LEGAL("legal", "Legal"),
    @SerialName("medic") MEDIC("medic", "Medic"),
    @SerialName("self-defense") SELF_DEFENSE("self-defense", "Self Defense"),
    @SerialName("organizing") ORGANIZING("organizing", "Organizing"),
    @SerialName("communication") COMMUNICATION("communication", "Communication"),
    @SerialName("civil-defense") CIVIL_DEFENSE("civil-defense", "Civil Defense"),
    @SerialName("custom") CUSTOM("custom", "Custom");

    companion object {
        fun fromValue(value: String): CourseCategory {
            return entries.find { it.value == value } ?: CUSTOM
        }
    }
}

/**
 * Course difficulty levels.
 */
@Serializable
enum class CourseDifficulty(val value: String, val displayName: String) {
    @SerialName("beginner") BEGINNER("beginner", "Beginner"),
    @SerialName("intermediate") INTERMEDIATE("intermediate", "Intermediate"),
    @SerialName("advanced") ADVANCED("advanced", "Advanced");

    companion object {
        fun fromValue(value: String): CourseDifficulty {
            return entries.find { it.value == value } ?: BEGINNER
        }
    }
}

/**
 * Course publication status.
 */
@Serializable
enum class CourseStatus(val value: String, val displayName: String) {
    @SerialName("draft") DRAFT("draft", "Draft"),
    @SerialName("published") PUBLISHED("published", "Published"),
    @SerialName("archived") ARCHIVED("archived", "Archived");

    companion object {
        fun fromValue(value: String): CourseStatus {
            return entries.find { it.value == value } ?: DRAFT
        }
    }
}

/**
 * Lesson content types.
 */
@Serializable
enum class LessonType(val value: String, val displayName: String) {
    @SerialName("video") VIDEO("video", "Video"),
    @SerialName("document") DOCUMENT("document", "Document"),
    @SerialName("quiz") QUIZ("quiz", "Quiz"),
    @SerialName("assignment") ASSIGNMENT("assignment", "Assignment"),
    @SerialName("live-session") LIVE_SESSION("live-session", "Live Session"),
    @SerialName("interactive") INTERACTIVE("interactive", "Interactive");

    companion object {
        fun fromValue(value: String): LessonType {
            return entries.find { it.value == value } ?: DOCUMENT
        }
    }
}

/**
 * Quiz question types.
 */
@Serializable
enum class QuizQuestionType(val value: String) {
    @SerialName("multiple-choice") MULTIPLE_CHOICE("multiple-choice"),
    @SerialName("multi-select") MULTI_SELECT("multi-select"),
    @SerialName("true-false") TRUE_FALSE("true-false"),
    @SerialName("fill-in-blank") FILL_IN_BLANK("fill-in-blank"),
    @SerialName("short-answer") SHORT_ANSWER("short-answer");

    companion object {
        fun fromValue(value: String): QuizQuestionType {
            return entries.find { it.value == value } ?: MULTIPLE_CHOICE
        }
    }
}

/**
 * Progress tracking status.
 */
@Serializable
enum class ProgressStatus(val value: String, val displayName: String) {
    @SerialName("not-started") NOT_STARTED("not-started", "Not Started"),
    @SerialName("in-progress") IN_PROGRESS("in-progress", "In Progress"),
    @SerialName("completed") COMPLETED("completed", "Completed");

    companion object {
        fun fromValue(value: String): ProgressStatus {
            return entries.find { it.value == value } ?: NOT_STARTED
        }
    }
}

/**
 * Assignment review status.
 */
@Serializable
enum class AssignmentReviewStatus(val value: String) {
    @SerialName("pending") PENDING("pending"),
    @SerialName("in-review") IN_REVIEW("in-review"),
    @SerialName("approved") APPROVED("approved"),
    @SerialName("rejected") REJECTED("rejected"),
    @SerialName("revision-requested") REVISION_REQUESTED("revision-requested");

    companion object {
        fun fromValue(value: String): AssignmentReviewStatus {
            return entries.find { it.value == value } ?: PENDING
        }
    }
}

/**
 * Interactive exercise types.
 */
@Serializable
enum class InteractiveExerciseType(val value: String) {
    @SerialName("threat-model") THREAT_MODEL("threat-model"),
    @SerialName("security-audit") SECURITY_AUDIT("security-audit"),
    @SerialName("scenario") SCENARIO("scenario"),
    @SerialName("simulation") SIMULATION("simulation"),
    @SerialName("custom") CUSTOM("custom");

    companion object {
        fun fromValue(value: String): InteractiveExerciseType {
            return entries.find { it.value == value } ?: CUSTOM
        }
    }
}

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

    /**
     * Video lesson content.
     */
    data class Video(
        val videoUrl: String,
        val transcriptUrl: String?,
        val captionsUrl: String?,
        val chaptersUrl: String?,
        val duration: Int?
    ) : LessonContent() {
        override val type: LessonType = LessonType.VIDEO
    }

    /**
     * Document lesson content (Markdown or PDF).
     */
    data class Document(
        val markdown: String?,
        val pdfUrl: String?
    ) : LessonContent() {
        override val type: LessonType = LessonType.DOCUMENT
    }

    /**
     * Quiz lesson content.
     */
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
        override val type: LessonType = LessonType.QUIZ
    }

    /**
     * Assignment lesson content.
     */
    data class Assignment(
        val instructions: String,
        val allowedFileTypes: List<String>?,
        val maxFileSizeMB: Int?,
        val rubric: List<AssignmentRubricItem>?
    ) : LessonContent() {
        override val type: LessonType = LessonType.ASSIGNMENT
    }

    /**
     * Live session lesson content.
     */
    data class LiveSession(
        val scheduledAt: Long,
        val duration: Int,
        val instructorPubkey: String,
        val conferenceRoomId: String?,
        val recordingUrl: String?,
        val maxParticipants: Int?,
        val requiresRSVP: Boolean
    ) : LessonContent() {
        override val type: LessonType = LessonType.LIVE_SESSION
    }

    /**
     * Interactive exercise lesson content.
     */
    data class Interactive(
        val exerciseType: InteractiveExerciseType,
        val configJson: String,
        val externalUrl: String?
    ) : LessonContent() {
        override val type: LessonType = LessonType.INTERACTIVE
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
 * Live session RSVP status.
 */
@Serializable
enum class RSVPStatus(val value: String) {
    @SerialName("confirmed") CONFIRMED("confirmed"),
    @SerialName("tentative") TENTATIVE("tentative"),
    @SerialName("declined") DECLINED("declined");

    companion object {
        fun fromValue(value: String): RSVPStatus {
            return entries.find { it.value == value } ?: TENTATIVE
        }
    }
}

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
