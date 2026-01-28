package network.buildit.modules.training.domain.repository

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.training.domain.model.*

/**
 * Repository interface for training module data operations.
 * Provides an abstraction layer between domain and data layers.
 */
interface TrainingRepository {

    // ============================================================================
    // Course Operations
    // ============================================================================

    /**
     * Gets all published courses.
     */
    fun getCourses(): Flow<List<Course>>

    /**
     * Gets courses with query options.
     */
    fun getCourses(options: CourseQueryOptions): Flow<List<Course>>

    /**
     * Gets courses for a specific group.
     */
    fun getCoursesByGroup(groupId: String): Flow<List<Course>>

    /**
     * Gets a specific course by ID.
     */
    fun getCourse(id: String): Flow<Course?>

    /**
     * Saves a course (insert or update).
     */
    suspend fun saveCourse(course: Course)

    /**
     * Updates an existing course.
     */
    suspend fun updateCourse(course: Course)

    /**
     * Deletes a course.
     */
    suspend fun deleteCourse(id: String)

    // ============================================================================
    // Module Operations
    // ============================================================================

    /**
     * Gets all modules for a course.
     */
    fun getModules(courseId: String): Flow<List<TrainingModule>>

    /**
     * Gets a specific module by ID.
     */
    fun getModule(id: String): Flow<TrainingModule?>

    /**
     * Saves a training module.
     */
    suspend fun saveModule(module: TrainingModule)

    /**
     * Updates a training module.
     */
    suspend fun updateModule(module: TrainingModule)

    /**
     * Deletes a training module.
     */
    suspend fun deleteModule(id: String)

    /**
     * Reorders modules within a course.
     */
    suspend fun reorderModules(courseId: String, moduleIds: List<String>)

    // ============================================================================
    // Lesson Operations
    // ============================================================================

    /**
     * Gets all lessons for a module.
     */
    fun getLessons(moduleId: String): Flow<List<Lesson>>

    /**
     * Gets all lessons for a course (across all modules).
     */
    fun getLessonsForCourse(courseId: String): Flow<List<Lesson>>

    /**
     * Gets a specific lesson by ID.
     */
    fun getLesson(id: String): Flow<Lesson?>

    /**
     * Saves a lesson.
     */
    suspend fun saveLesson(lesson: Lesson)

    /**
     * Updates a lesson.
     */
    suspend fun updateLesson(lesson: Lesson)

    /**
     * Deletes a lesson.
     */
    suspend fun deleteLesson(id: String)

    /**
     * Reorders lessons within a module.
     */
    suspend fun reorderLessons(moduleId: String, lessonIds: List<String>)

    // ============================================================================
    // Progress Operations
    // ============================================================================

    /**
     * Gets lesson progress for a user.
     */
    fun getLessonProgress(lessonId: String, pubkey: String): Flow<LessonProgress?>

    /**
     * Gets all lesson progress for a user in a course.
     */
    fun getLessonProgressForCourse(courseId: String, pubkey: String): Flow<List<LessonProgress>>

    /**
     * Gets course progress for a user.
     */
    fun getCourseProgress(courseId: String, pubkey: String): Flow<CourseProgress?>

    /**
     * Gets all course progress for a user.
     */
    fun getAllCourseProgress(pubkey: String): Flow<List<CourseProgress>>

    /**
     * Saves lesson progress.
     */
    suspend fun saveProgress(progress: LessonProgress)

    /**
     * Updates lesson progress.
     */
    suspend fun updateProgress(progress: LessonProgress)

    /**
     * Saves or updates course progress.
     */
    suspend fun saveCourseProgress(progress: CourseProgress)

    // ============================================================================
    // Quiz Operations
    // ============================================================================

    /**
     * Gets quiz attempts for a user on a lesson.
     */
    fun getQuizAttempts(lessonId: String, pubkey: String): Flow<List<QuizAttempt>>

    /**
     * Saves a quiz attempt.
     */
    suspend fun saveQuizAttempt(attempt: QuizAttempt)

    /**
     * Gets best quiz score for a user on a lesson.
     */
    suspend fun getBestQuizScore(lessonId: String, pubkey: String): Int?

    // ============================================================================
    // Assignment Operations
    // ============================================================================

    /**
     * Gets assignment submissions for a lesson.
     */
    fun getAssignmentSubmissions(lessonId: String): Flow<List<AssignmentSubmission>>

    /**
     * Gets assignment submission for a specific user.
     */
    fun getAssignmentSubmission(lessonId: String, pubkey: String): Flow<AssignmentSubmission?>

    /**
     * Saves an assignment submission.
     */
    suspend fun saveAssignmentSubmission(submission: AssignmentSubmission)

    /**
     * Updates assignment submission (for reviews).
     */
    suspend fun updateAssignmentSubmission(submission: AssignmentSubmission)

    // ============================================================================
    // Certification Operations
    // ============================================================================

    /**
     * Gets all certifications for a user.
     */
    fun getCertifications(pubkey: String): Flow<List<Certification>>

    /**
     * Gets certifications for a specific course.
     */
    fun getCertificationsForCourse(courseId: String): Flow<List<Certification>>

    /**
     * Gets a specific certification.
     */
    fun getCertification(id: String): Flow<Certification?>

    /**
     * Gets certification by verification code.
     */
    suspend fun getCertificationByCode(verificationCode: String): Certification?

    /**
     * Issues a new certification.
     */
    suspend fun issueCertification(certification: Certification)

    /**
     * Revokes a certification.
     */
    suspend fun revokeCertification(
        certificationId: String,
        revokedBy: String,
        reason: String
    )

    // ============================================================================
    // Live Session Operations
    // ============================================================================

    /**
     * Gets RSVPs for a live session.
     */
    fun getLiveSessionRSVPs(lessonId: String): Flow<List<LiveSessionRSVP>>

    /**
     * Gets a user's RSVP for a live session.
     */
    fun getLiveSessionRSVP(lessonId: String, pubkey: String): Flow<LiveSessionRSVP?>

    /**
     * Saves a live session RSVP.
     */
    suspend fun saveLiveSessionRSVP(rsvp: LiveSessionRSVP)

    /**
     * Gets attendance records for a live session.
     */
    fun getLiveSessionAttendance(lessonId: String): Flow<List<LiveSessionAttendance>>

    /**
     * Records live session attendance.
     */
    suspend fun recordLiveSessionAttendance(attendance: LiveSessionAttendance)

    // ============================================================================
    // Statistics Operations
    // ============================================================================

    /**
     * Gets statistics for a course.
     */
    suspend fun getCourseStats(courseId: String): CourseStats

    /**
     * Gets training status for a user.
     */
    suspend fun getUserTrainingStatus(pubkey: String): UserTrainingStatus

    /**
     * Gets enrolled count for a course.
     */
    suspend fun getEnrolledCount(courseId: String): Int

    /**
     * Gets completed count for a course.
     */
    suspend fun getCompletedCount(courseId: String): Int
}
