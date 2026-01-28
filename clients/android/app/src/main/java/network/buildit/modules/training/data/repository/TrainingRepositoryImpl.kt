package network.buildit.modules.training.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import network.buildit.modules.training.data.local.*
import network.buildit.modules.training.data.mapper.*
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementation of TrainingRepository using Room database.
 */
@Singleton
class TrainingRepositoryImpl @Inject constructor(
    private val courseDao: TrainingCourseDao,
    private val moduleDao: TrainingModuleDao,
    private val lessonDao: TrainingLessonDao,
    private val progressDao: TrainingProgressDao,
    private val quizDao: TrainingQuizDao,
    private val assignmentDao: TrainingAssignmentDao,
    private val certificationDao: TrainingCertificationDao,
    private val liveSessionDao: TrainingLiveSessionDao
) : TrainingRepository {

    // ============================================================================
    // Course Operations
    // ============================================================================

    override fun getCourses(): Flow<List<Course>> {
        return courseDao.getPublishedCourses().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCourses(options: CourseQueryOptions): Flow<List<Course>> {
        return courseDao.getCoursesWithOptions(
            status = options.status?.value,
            category = options.category?.value,
            difficulty = options.difficulty?.value,
            groupId = options.groupId,
            includePublic = options.includePublic,
            search = options.search,
            sortBy = options.sortBy.name.lowercase(),
            sortOrder = options.sortOrder.name,
            limit = options.limit ?: Int.MAX_VALUE,
            offset = options.offset ?: 0
        ).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCoursesByGroup(groupId: String): Flow<List<Course>> {
        return courseDao.getCoursesByGroup(groupId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCourse(id: String): Flow<Course?> {
        return courseDao.getCourse(id).map { it?.toDomain() }
    }

    override suspend fun saveCourse(course: Course) {
        courseDao.insertCourse(course.toEntity())
    }

    override suspend fun updateCourse(course: Course) {
        courseDao.updateCourse(course.toEntity())
    }

    override suspend fun deleteCourse(id: String) {
        courseDao.deleteCourse(id)
    }

    // ============================================================================
    // Module Operations
    // ============================================================================

    override fun getModules(courseId: String): Flow<List<TrainingModule>> {
        return moduleDao.getModules(courseId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getModule(id: String): Flow<TrainingModule?> {
        return moduleDao.getModule(id).map { it?.toDomain() }
    }

    override suspend fun saveModule(module: TrainingModule) {
        moduleDao.insertModule(module.toEntity())
    }

    override suspend fun updateModule(module: TrainingModule) {
        moduleDao.updateModule(module.toEntity())
    }

    override suspend fun deleteModule(id: String) {
        moduleDao.deleteModule(id)
    }

    override suspend fun reorderModules(courseId: String, moduleIds: List<String>) {
        moduleIds.forEachIndexed { index, id ->
            moduleDao.updateModuleOrder(id, index)
        }
    }

    // ============================================================================
    // Lesson Operations
    // ============================================================================

    override fun getLessons(moduleId: String): Flow<List<Lesson>> {
        return lessonDao.getLessons(moduleId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getLessonsForCourse(courseId: String): Flow<List<Lesson>> {
        return lessonDao.getLessonsForCourse(courseId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getLesson(id: String): Flow<Lesson?> {
        return lessonDao.getLesson(id).map { it?.toDomain() }
    }

    override suspend fun saveLesson(lesson: Lesson) {
        lessonDao.insertLesson(lesson.toEntity())
    }

    override suspend fun updateLesson(lesson: Lesson) {
        lessonDao.updateLesson(lesson.toEntity())
    }

    override suspend fun deleteLesson(id: String) {
        lessonDao.deleteLesson(id)
    }

    override suspend fun reorderLessons(moduleId: String, lessonIds: List<String>) {
        lessonIds.forEachIndexed { index, id ->
            lessonDao.updateLessonOrder(id, index)
        }
    }

    // ============================================================================
    // Progress Operations
    // ============================================================================

    override fun getLessonProgress(lessonId: String, pubkey: String): Flow<LessonProgress?> {
        return progressDao.getLessonProgress(lessonId, pubkey).map { it?.toDomain() }
    }

    override fun getLessonProgressForCourse(courseId: String, pubkey: String): Flow<List<LessonProgress>> {
        return progressDao.getLessonProgressForCourse(courseId, pubkey).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCourseProgress(courseId: String, pubkey: String): Flow<CourseProgress?> {
        return progressDao.getCourseProgress(courseId, pubkey).map { it?.toDomain() }
    }

    override fun getAllCourseProgress(pubkey: String): Flow<List<CourseProgress>> {
        return progressDao.getAllCourseProgress(pubkey).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun saveProgress(progress: LessonProgress) {
        progressDao.insertProgress(progress.toEntity())
    }

    override suspend fun updateProgress(progress: LessonProgress) {
        progressDao.updateProgress(progress.toEntity())
    }

    override suspend fun saveCourseProgress(progress: CourseProgress) {
        progressDao.insertCourseProgress(progress.toEntity())
    }

    // ============================================================================
    // Quiz Operations
    // ============================================================================

    override fun getQuizAttempts(lessonId: String, pubkey: String): Flow<List<QuizAttempt>> {
        return quizDao.getQuizAttempts(lessonId, pubkey).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun saveQuizAttempt(attempt: QuizAttempt) {
        quizDao.insertQuizAttempt(attempt.toEntity())
    }

    override suspend fun getBestQuizScore(lessonId: String, pubkey: String): Int? {
        return quizDao.getBestScore(lessonId, pubkey)
    }

    // ============================================================================
    // Assignment Operations
    // ============================================================================

    override fun getAssignmentSubmissions(lessonId: String): Flow<List<AssignmentSubmission>> {
        return assignmentDao.getSubmissions(lessonId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getAssignmentSubmission(lessonId: String, pubkey: String): Flow<AssignmentSubmission?> {
        return assignmentDao.getSubmission(lessonId, pubkey).map { it?.toDomain() }
    }

    override suspend fun saveAssignmentSubmission(submission: AssignmentSubmission) {
        assignmentDao.insertSubmission(submission.toEntity())
    }

    override suspend fun updateAssignmentSubmission(submission: AssignmentSubmission) {
        assignmentDao.updateSubmission(submission.toEntity())
    }

    // ============================================================================
    // Certification Operations
    // ============================================================================

    override fun getCertifications(pubkey: String): Flow<List<Certification>> {
        return certificationDao.getCertifications(pubkey).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCertificationsForCourse(courseId: String): Flow<List<Certification>> {
        return certificationDao.getCertificationsForCourse(courseId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getCertification(id: String): Flow<Certification?> {
        return certificationDao.getCertification(id).map { it?.toDomain() }
    }

    override suspend fun getCertificationByCode(verificationCode: String): Certification? {
        return certificationDao.getCertificationByCode(verificationCode)?.toDomain()
    }

    override suspend fun issueCertification(certification: Certification) {
        certificationDao.insertCertification(certification.toEntity())
    }

    override suspend fun revokeCertification(certificationId: String, revokedBy: String, reason: String) {
        certificationDao.revokeCertification(
            id = certificationId,
            revokedAt = System.currentTimeMillis() / 1000,
            revokedBy = revokedBy,
            reason = reason
        )
    }

    // ============================================================================
    // Live Session Operations
    // ============================================================================

    override fun getLiveSessionRSVPs(lessonId: String): Flow<List<LiveSessionRSVP>> {
        return liveSessionDao.getRSVPs(lessonId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getLiveSessionRSVP(lessonId: String, pubkey: String): Flow<LiveSessionRSVP?> {
        return liveSessionDao.getRSVP(lessonId, pubkey).map { it?.toDomain() }
    }

    override suspend fun saveLiveSessionRSVP(rsvp: LiveSessionRSVP) {
        liveSessionDao.insertRSVP(rsvp.toEntity())
    }

    override fun getLiveSessionAttendance(lessonId: String): Flow<List<LiveSessionAttendance>> {
        return liveSessionDao.getAttendance(lessonId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun recordLiveSessionAttendance(attendance: LiveSessionAttendance) {
        liveSessionDao.insertAttendance(attendance.toEntity())
    }

    // ============================================================================
    // Statistics Operations
    // ============================================================================

    override suspend fun getCourseStats(courseId: String): CourseStats {
        val enrolledCount = progressDao.getEnrolledCount(courseId)
        val completedCount = progressDao.getCompletedCount(courseId)
        val certificationCount = certificationDao.getCertificationCount(courseId)

        // Calculate averages from progress data
        val allProgress = progressDao.getAllCourseProgress("").first()
        val courseProgress = allProgress.filter { it.courseId == courseId }
        val averageProgress = if (courseProgress.isNotEmpty()) {
            courseProgress.map { it.percentComplete }.average().toFloat()
        } else 0f

        val completedProgress = courseProgress.filter { it.completedAt != null }
        val averageCompletionTime = if (completedProgress.isNotEmpty()) {
            completedProgress.map { (it.completedAt!! - it.startedAt) / 3600f }.average().toFloat()
        } else 0f

        // Calculate average quiz score (simplified - would need lesson-level queries)
        val averageQuizScore = 75f // Placeholder

        return CourseStats(
            courseId = courseId,
            enrolledCount = enrolledCount,
            completedCount = completedCount,
            averageProgress = averageProgress,
            averageCompletionTimeHours = averageCompletionTime,
            certificationCount = certificationCount,
            averageQuizScore = averageQuizScore
        )
    }

    override suspend fun getUserTrainingStatus(pubkey: String): UserTrainingStatus {
        val allProgress = progressDao.getAllCourseProgress(pubkey).first()
        val certifications = certificationDao.getCertifications(pubkey).first()
        val now = System.currentTimeMillis() / 1000
        val thirtyDays = 30 * 24 * 60 * 60L

        val validCerts = certifications.filter { it.revokedAt == null }
        val expiringCerts = validCerts.filter { cert ->
            cert.expiresAt != null && cert.expiresAt > now && cert.expiresAt < now + thirtyDays
        }

        // Calculate total time spent
        val lessonProgress = mutableListOf<LessonProgressEntity>()
        // Would need to aggregate from lesson progress
        val totalTimeSpent = 0f // Placeholder

        return UserTrainingStatus(
            pubkey = pubkey,
            coursesEnrolled = allProgress.size,
            coursesCompleted = allProgress.count { it.completedAt != null },
            certificationsEarned = validCerts.size,
            certificationsExpiring = expiringCerts.size,
            totalTimeSpentHours = totalTimeSpent,
            lastActivity = allProgress.maxOfOrNull { it.lastActivityAt }
        )
    }

    override suspend fun getEnrolledCount(courseId: String): Int {
        return progressDao.getEnrolledCount(courseId)
    }

    override suspend fun getCompletedCount(courseId: String): Int {
        return progressDao.getCompletedCount(courseId)
    }
}
