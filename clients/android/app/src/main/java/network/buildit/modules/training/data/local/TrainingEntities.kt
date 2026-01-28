package network.buildit.modules.training.data.local

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity for training courses.
 */
@Entity(
    tableName = "training_courses",
    indices = [
        Index("groupId"),
        Index("status"),
        Index("category"),
        Index("createdBy")
    ]
)
data class CourseEntity(
    @PrimaryKey
    val id: String,
    val groupId: String?,
    val title: String,
    val description: String,
    val imageUrl: String?,
    val category: String,
    val difficulty: String,
    val estimatedHours: Float,
    val prerequisitesJson: String?,
    val status: String,
    val certificationEnabled: Boolean,
    val certificationExpiryDays: Int?,
    val isPublic: Boolean,
    val isDefault: Boolean,
    val created: Long,
    val createdBy: String,
    val updated: Long
)

/**
 * Room entity for training modules (chapters).
 */
@Entity(
    tableName = "training_modules",
    indices = [
        Index("courseId"),
        Index("order")
    ],
    foreignKeys = [
        ForeignKey(
            entity = CourseEntity::class,
            parentColumns = ["id"],
            childColumns = ["courseId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class ModuleEntity(
    @PrimaryKey
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
 * Room entity for lessons.
 */
@Entity(
    tableName = "training_lessons",
    indices = [
        Index("moduleId"),
        Index("order"),
        Index("type")
    ],
    foreignKeys = [
        ForeignKey(
            entity = ModuleEntity::class,
            parentColumns = ["id"],
            childColumns = ["moduleId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class LessonEntity(
    @PrimaryKey
    val id: String,
    val moduleId: String,
    val type: String,
    val title: String,
    val description: String?,
    val contentJson: String,
    val order: Int,
    val estimatedMinutes: Int,
    val requiredForCertification: Boolean,
    val passingScore: Int?,
    val created: Long,
    val updated: Long
)

/**
 * Room entity for lesson progress.
 */
@Entity(
    tableName = "training_lesson_progress",
    indices = [
        Index("lessonId"),
        Index("pubkey"),
        Index(value = ["lessonId", "pubkey"], unique = true)
    ]
)
data class LessonProgressEntity(
    @PrimaryKey
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val status: String,
    val score: Int?,
    val timeSpent: Long,
    val lastPosition: Int?,
    val completedAt: Long?,
    val attempts: Int?,
    val created: Long,
    val updated: Long
)

/**
 * Room entity for course progress.
 */
@Entity(
    tableName = "training_course_progress",
    indices = [
        Index("courseId"),
        Index("pubkey"),
        Index(value = ["courseId", "pubkey"], unique = true)
    ]
)
data class CourseProgressEntity(
    @PrimaryKey
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
 * Room entity for quiz attempts.
 */
@Entity(
    tableName = "training_quiz_attempts",
    indices = [
        Index("lessonId"),
        Index("pubkey"),
        Index("completedAt")
    ]
)
data class QuizAttemptEntity(
    @PrimaryKey
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val answersJson: String,
    val score: Int,
    val passed: Boolean,
    val startedAt: Long,
    val completedAt: Long,
    val duration: Long
)

/**
 * Room entity for assignment submissions.
 */
@Entity(
    tableName = "training_assignment_submissions",
    indices = [
        Index("lessonId"),
        Index("pubkey"),
        Index("reviewStatus"),
        Index(value = ["lessonId", "pubkey"], unique = true)
    ]
)
data class AssignmentSubmissionEntity(
    @PrimaryKey
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val fileUrl: String,
    val fileName: String,
    val fileSize: Long,
    val submittedAt: Long,
    val reviewStatus: String,
    val reviewedBy: String?,
    val reviewedAt: Long?,
    val feedback: String?,
    val score: Int?,
    val rubricScoresJson: String?
)

/**
 * Room entity for certifications.
 */
@Entity(
    tableName = "training_certifications",
    indices = [
        Index("courseId"),
        Index("pubkey"),
        Index("verificationCode", unique = true),
        Index("earnedAt")
    ]
)
data class CertificationEntity(
    @PrimaryKey
    val id: String,
    val courseId: String,
    val pubkey: String,
    val earnedAt: Long,
    val expiresAt: Long?,
    val verificationCode: String,
    val metadataJson: String?,
    val revokedAt: Long?,
    val revokedBy: String?,
    val revokeReason: String?
)

/**
 * Room entity for live session RSVPs.
 */
@Entity(
    tableName = "training_live_session_rsvps",
    indices = [
        Index("lessonId"),
        Index("pubkey"),
        Index(value = ["lessonId", "pubkey"], unique = true)
    ]
)
data class LiveSessionRSVPEntity(
    @PrimaryKey
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val status: String,
    val createdAt: Long,
    val updatedAt: Long
)

/**
 * Room entity for live session attendance.
 */
@Entity(
    tableName = "training_live_session_attendance",
    indices = [
        Index("lessonId"),
        Index("pubkey")
    ]
)
data class LiveSessionAttendanceEntity(
    @PrimaryKey
    val id: String,
    val lessonId: String,
    val pubkey: String,
    val joinedAt: Long,
    val leftAt: Long?,
    val duration: Long,
    val wasCompleteSession: Boolean
)
