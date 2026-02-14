package network.buildit.modules.training.data.mapper

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.training.LessonType
import network.buildit.modules.training.data.local.*
import network.buildit.modules.training.domain.model.*

/**
 * JSON serializer for mapping complex types.
 */
private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

// ============================================================================
// Course Mappers
// ============================================================================

/**
 * Converts CourseEntity to Course domain model.
 */
fun CourseEntity.toDomain(): Course {
    return Course(
        id = id,
        groupId = groupId,
        title = title,
        description = description,
        imageUrl = imageUrl,
        category = courseCategoryFromValue(category),
        difficulty = courseDifficultyFromValue(difficulty),
        estimatedHours = estimatedHours,
        prerequisites = prerequisitesJson?.let {
            json.decodeFromString<List<String>>(it)
        } ?: emptyList(),
        status = courseStatusFromValue(status),
        certificationEnabled = certificationEnabled,
        certificationExpiryDays = certificationExpiryDays,
        isPublic = isPublic,
        isDefault = isDefault,
        created = created,
        createdBy = createdBy,
        updated = updated
    )
}

/**
 * Converts Course domain model to CourseEntity.
 */
fun Course.toEntity(): CourseEntity {
    return CourseEntity(
        id = id,
        groupId = groupId,
        title = title,
        description = description,
        imageUrl = imageUrl,
        category = category.value,
        difficulty = difficulty.value,
        estimatedHours = estimatedHours,
        prerequisitesJson = if (prerequisites.isNotEmpty()) {
            json.encodeToString(prerequisites)
        } else null,
        status = status.value,
        certificationEnabled = certificationEnabled,
        certificationExpiryDays = certificationExpiryDays,
        isPublic = isPublic,
        isDefault = isDefault,
        created = created,
        createdBy = createdBy,
        updated = updated
    )
}

// ============================================================================
// Module Mappers
// ============================================================================

/**
 * Converts ModuleEntity to TrainingModule domain model.
 */
fun ModuleEntity.toDomain(): TrainingModule {
    return TrainingModule(
        id = id,
        courseId = courseId,
        title = title,
        description = description,
        order = order,
        estimatedMinutes = estimatedMinutes,
        created = created,
        updated = updated
    )
}

/**
 * Converts TrainingModule domain model to ModuleEntity.
 */
fun TrainingModule.toEntity(): ModuleEntity {
    return ModuleEntity(
        id = id,
        courseId = courseId,
        title = title,
        description = description,
        order = order,
        estimatedMinutes = estimatedMinutes,
        created = created,
        updated = updated
    )
}

// ============================================================================
// Lesson Mappers
// ============================================================================

/**
 * Converts LessonEntity to Lesson domain model.
 */
fun LessonEntity.toDomain(): Lesson {
    return Lesson(
        id = id,
        moduleId = moduleId,
        type = lessonTypeFromValue(type),
        title = title,
        description = description,
        content = parseLessonContent(type, contentJson),
        order = order,
        estimatedMinutes = estimatedMinutes,
        requiredForCertification = requiredForCertification,
        passingScore = passingScore,
        created = created,
        updated = updated
    )
}

/**
 * Converts Lesson domain model to LessonEntity.
 */
fun Lesson.toEntity(): LessonEntity {
    return LessonEntity(
        id = id,
        moduleId = moduleId,
        type = type.value,
        title = title,
        description = description,
        contentJson = serializeLessonContent(content),
        order = order,
        estimatedMinutes = estimatedMinutes,
        requiredForCertification = requiredForCertification,
        passingScore = passingScore,
        created = created,
        updated = updated
    )
}

/**
 * Parses lesson content from JSON based on type.
 */
private fun parseLessonContent(type: String, contentJson: String): LessonContent {
    return when (lessonTypeFromValue(type)) {
        LessonType.Video -> json.decodeFromString<VideoContentDto>(contentJson).toDomain()
        LessonType.Document -> json.decodeFromString<DocumentContentDto>(contentJson).toDomain()
        LessonType.Quiz -> json.decodeFromString<QuizContentDto>(contentJson).toDomain()
        LessonType.Assignment -> json.decodeFromString<AssignmentContentDto>(contentJson).toDomain()
        LessonType.LiveSession -> json.decodeFromString<LiveSessionContentDto>(contentJson).toDomain()
        LessonType.Interactive -> json.decodeFromString<InteractiveContentDto>(contentJson).toDomain()
    }
}

/**
 * Serializes lesson content to JSON.
 */
private fun serializeLessonContent(content: LessonContent): String {
    return when (content) {
        is LessonContent.Video -> json.encodeToString(content.toDto())
        is LessonContent.Document -> json.encodeToString(content.toDto())
        is LessonContent.Quiz -> json.encodeToString(content.toDto())
        is LessonContent.Assignment -> json.encodeToString(content.toDto())
        is LessonContent.LiveSession -> json.encodeToString(content.toDto())
        is LessonContent.Interactive -> json.encodeToString(content.toDto())
    }
}

// ============================================================================
// Content DTOs for JSON Serialization
// ============================================================================

@kotlinx.serialization.Serializable
private data class VideoContentDto(
    val videoUrl: String,
    val transcriptUrl: String? = null,
    val captionsUrl: String? = null,
    val chaptersUrl: String? = null,
    val duration: Int? = null
) {
    fun toDomain() = LessonContent.Video(videoUrl, transcriptUrl, captionsUrl, chaptersUrl, duration)
}

private fun LessonContent.Video.toDto() = VideoContentDto(videoUrl, transcriptUrl, captionsUrl, chaptersUrl, duration)

@kotlinx.serialization.Serializable
private data class DocumentContentDto(
    val markdown: String? = null,
    val pdfUrl: String? = null
) {
    fun toDomain() = LessonContent.Document(markdown, pdfUrl)
}

private fun LessonContent.Document.toDto() = DocumentContentDto(markdown, pdfUrl)

@kotlinx.serialization.Serializable
private data class QuizContentDto(
    val questions: List<QuizQuestionDto>,
    val passingScore: Int,
    val allowRetakes: Boolean,
    val maxAttempts: Int? = null,
    val shuffleQuestions: Boolean,
    val shuffleOptions: Boolean,
    val showCorrectAfter: Boolean,
    val timeLimitMinutes: Int? = null
) {
    fun toDomain() = LessonContent.Quiz(
        questions.map { it.toDomain() },
        passingScore,
        allowRetakes,
        maxAttempts,
        shuffleQuestions,
        shuffleOptions,
        showCorrectAfter,
        timeLimitMinutes
    )
}

private fun LessonContent.Quiz.toDto() = QuizContentDto(
    questions.map { it.toDto() },
    passingScore,
    allowRetakes,
    maxAttempts,
    shuffleQuestions,
    shuffleOptions,
    showCorrectAfter,
    timeLimitMinutes
)

@kotlinx.serialization.Serializable
private data class QuizQuestionDto(
    val id: String,
    val type: String,
    val question: String,
    val options: List<String>? = null,
    val correctAnswer: List<String>,
    val explanation: String? = null,
    val points: Int,
    val order: Int
) {
    fun toDomain() = QuizQuestion(id, quizQuestionTypeFromValue(type), question, options, correctAnswer, explanation, points, order)
}

private fun QuizQuestion.toDto() = QuizQuestionDto(id, type.value, question, options, correctAnswer, explanation, points, order)

@kotlinx.serialization.Serializable
private data class AssignmentContentDto(
    val instructions: String,
    val allowedFileTypes: List<String>? = null,
    val maxFileSizeMB: Int? = null,
    val rubric: List<RubricItemDto>? = null
) {
    fun toDomain() = LessonContent.Assignment(instructions, allowedFileTypes, maxFileSizeMB, rubric?.map { it.toDomain() })
}

private fun LessonContent.Assignment.toDto() = AssignmentContentDto(instructions, allowedFileTypes, maxFileSizeMB, rubric?.map { it.toDto() })

@kotlinx.serialization.Serializable
private data class RubricItemDto(
    val id: String,
    val criterion: String,
    val description: String,
    val maxPoints: Int
) {
    fun toDomain() = AssignmentRubricItem(id, criterion, description, maxPoints)
}

private fun AssignmentRubricItem.toDto() = RubricItemDto(id, criterion, description, maxPoints)

@kotlinx.serialization.Serializable
private data class LiveSessionContentDto(
    val scheduledAt: Long,
    val duration: Int,
    val instructorPubkey: String,
    val conferenceRoomId: String? = null,
    val recordingUrl: String? = null,
    val maxParticipants: Int? = null,
    val requiresRSVP: Boolean
) {
    fun toDomain() = LessonContent.LiveSession(scheduledAt, duration, instructorPubkey, conferenceRoomId, recordingUrl, maxParticipants, requiresRSVP)
}

private fun LessonContent.LiveSession.toDto() = LiveSessionContentDto(scheduledAt, duration, instructorPubkey, conferenceRoomId, recordingUrl, maxParticipants, requiresRSVP)

@kotlinx.serialization.Serializable
private data class InteractiveContentDto(
    val exerciseType: String,
    val configJson: String,
    val externalUrl: String? = null
) {
    fun toDomain() = LessonContent.Interactive(interactiveExerciseTypeFromValue(exerciseType), configJson, externalUrl)
}

private fun LessonContent.Interactive.toDto() = InteractiveContentDto(exerciseType.value, configJson, externalUrl)

// ============================================================================
// Progress Mappers
// ============================================================================

/**
 * Converts LessonProgressEntity to LessonProgress domain model.
 */
fun LessonProgressEntity.toDomain(): LessonProgress {
    return LessonProgress(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        status = progressStatusFromValue(status),
        score = score,
        timeSpent = timeSpent,
        lastPosition = lastPosition,
        completedAt = completedAt,
        attempts = attempts,
        created = created,
        updated = updated
    )
}

/**
 * Converts LessonProgress domain model to LessonProgressEntity.
 */
fun LessonProgress.toEntity(): LessonProgressEntity {
    return LessonProgressEntity(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        status = status.value,
        score = score,
        timeSpent = timeSpent,
        lastPosition = lastPosition,
        completedAt = completedAt,
        attempts = attempts,
        created = created,
        updated = updated
    )
}

/**
 * Converts CourseProgressEntity to CourseProgress domain model.
 */
fun CourseProgressEntity.toDomain(): CourseProgress {
    return CourseProgress(
        id = id,
        courseId = courseId,
        pubkey = pubkey,
        percentComplete = percentComplete,
        lessonsCompleted = lessonsCompleted,
        totalLessons = totalLessons,
        currentModuleId = currentModuleId,
        currentLessonId = currentLessonId,
        startedAt = startedAt,
        lastActivityAt = lastActivityAt,
        completedAt = completedAt
    )
}

/**
 * Converts CourseProgress domain model to CourseProgressEntity.
 */
fun CourseProgress.toEntity(): CourseProgressEntity {
    return CourseProgressEntity(
        id = id,
        courseId = courseId,
        pubkey = pubkey,
        percentComplete = percentComplete,
        lessonsCompleted = lessonsCompleted,
        totalLessons = totalLessons,
        currentModuleId = currentModuleId,
        currentLessonId = currentLessonId,
        startedAt = startedAt,
        lastActivityAt = lastActivityAt,
        completedAt = completedAt
    )
}

// ============================================================================
// Quiz Attempt Mappers
// ============================================================================

@kotlinx.serialization.Serializable
private data class QuizAnswerDto(
    val questionId: String,
    val selectedAnswer: List<String>,
    val isCorrect: Boolean,
    val points: Int
) {
    fun toDomain() = QuizAnswer(questionId, selectedAnswer, isCorrect, points)
}

private fun QuizAnswer.toDto() = QuizAnswerDto(questionId, selectedAnswer, isCorrect, points)

/**
 * Converts QuizAttemptEntity to QuizAttempt domain model.
 */
fun QuizAttemptEntity.toDomain(): QuizAttempt {
    return QuizAttempt(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        answers = json.decodeFromString<List<QuizAnswerDto>>(answersJson).map { it.toDomain() },
        score = score,
        passed = passed,
        startedAt = startedAt,
        completedAt = completedAt,
        duration = duration
    )
}

/**
 * Converts QuizAttempt domain model to QuizAttemptEntity.
 */
fun QuizAttempt.toEntity(): QuizAttemptEntity {
    return QuizAttemptEntity(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        answersJson = json.encodeToString(answers.map { it.toDto() }),
        score = score,
        passed = passed,
        startedAt = startedAt,
        completedAt = completedAt,
        duration = duration
    )
}

// ============================================================================
// Assignment Submission Mappers
// ============================================================================

/**
 * Converts AssignmentSubmissionEntity to AssignmentSubmission domain model.
 */
fun AssignmentSubmissionEntity.toDomain(): AssignmentSubmission {
    return AssignmentSubmission(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        fileUrl = fileUrl,
        fileName = fileName,
        fileSize = fileSize,
        submittedAt = submittedAt,
        reviewStatus = assignmentReviewStatusFromValue(reviewStatus),
        reviewedBy = reviewedBy,
        reviewedAt = reviewedAt,
        feedback = feedback,
        score = score,
        rubricScores = rubricScoresJson?.let {
            json.decodeFromString<Map<String, Int>>(it)
        }
    )
}

/**
 * Converts AssignmentSubmission domain model to AssignmentSubmissionEntity.
 */
fun AssignmentSubmission.toEntity(): AssignmentSubmissionEntity {
    return AssignmentSubmissionEntity(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        fileUrl = fileUrl,
        fileName = fileName,
        fileSize = fileSize,
        submittedAt = submittedAt,
        reviewStatus = reviewStatus.value,
        reviewedBy = reviewedBy,
        reviewedAt = reviewedAt,
        feedback = feedback,
        score = score,
        rubricScoresJson = rubricScores?.let { json.encodeToString(it) }
    )
}

// ============================================================================
// Certification Mappers
// ============================================================================

/**
 * Converts CertificationEntity to Certification domain model.
 */
fun CertificationEntity.toDomain(): Certification {
    return Certification(
        id = id,
        courseId = courseId,
        pubkey = pubkey,
        earnedAt = earnedAt,
        expiresAt = expiresAt,
        verificationCode = verificationCode,
        metadata = metadataJson?.let {
            json.decodeFromString<Map<String, String>>(it)
        },
        revokedAt = revokedAt,
        revokedBy = revokedBy,
        revokeReason = revokeReason
    )
}

/**
 * Converts Certification domain model to CertificationEntity.
 */
fun Certification.toEntity(): CertificationEntity {
    return CertificationEntity(
        id = id,
        courseId = courseId,
        pubkey = pubkey,
        earnedAt = earnedAt,
        expiresAt = expiresAt,
        verificationCode = verificationCode,
        metadataJson = metadata?.let { json.encodeToString(it) },
        revokedAt = revokedAt,
        revokedBy = revokedBy,
        revokeReason = revokeReason
    )
}

// ============================================================================
// Live Session Mappers
// ============================================================================

/**
 * Converts LiveSessionRSVPEntity to LiveSessionRSVP domain model.
 */
fun LiveSessionRSVPEntity.toDomain(): LiveSessionRSVP {
    return LiveSessionRSVP(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        status = rsvpStatusFromValue(status),
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

/**
 * Converts LiveSessionRSVP domain model to LiveSessionRSVPEntity.
 */
fun LiveSessionRSVP.toEntity(): LiveSessionRSVPEntity {
    return LiveSessionRSVPEntity(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        status = status.value,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

/**
 * Converts LiveSessionAttendanceEntity to LiveSessionAttendance domain model.
 */
fun LiveSessionAttendanceEntity.toDomain(): LiveSessionAttendance {
    return LiveSessionAttendance(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        joinedAt = joinedAt,
        leftAt = leftAt,
        duration = duration,
        wasCompleteSession = wasCompleteSession
    )
}

/**
 * Converts LiveSessionAttendance domain model to LiveSessionAttendanceEntity.
 */
fun LiveSessionAttendance.toEntity(): LiveSessionAttendanceEntity {
    return LiveSessionAttendanceEntity(
        id = id,
        lessonId = lessonId,
        pubkey = pubkey,
        joinedAt = joinedAt,
        leftAt = leftAt,
        duration = duration,
        wasCompleteSession = wasCompleteSession
    )
}
