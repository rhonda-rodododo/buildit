package network.buildit.modules.training.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for training courses.
 */
@Dao
interface TrainingCourseDao {

    @Query("SELECT * FROM training_courses WHERE status = 'published' ORDER BY created DESC")
    fun getPublishedCourses(): Flow<List<CourseEntity>>

    @Query("SELECT * FROM training_courses WHERE groupId = :groupId ORDER BY created DESC")
    fun getCoursesByGroup(groupId: String): Flow<List<CourseEntity>>

    @Query("SELECT * FROM training_courses WHERE id = :id")
    fun getCourse(id: String): Flow<CourseEntity?>

    @Query("SELECT * FROM training_courses WHERE id = :id")
    suspend fun getCourseSync(id: String): CourseEntity?

    @Query("""
        SELECT * FROM training_courses
        WHERE (status = :status OR :status IS NULL)
        AND (category = :category OR :category IS NULL)
        AND (difficulty = :difficulty OR :difficulty IS NULL)
        AND (groupId = :groupId OR :groupId IS NULL OR (isPublic = 1 AND :includePublic = 1))
        AND (title LIKE '%' || :search || '%' OR description LIKE '%' || :search || '%' OR :search IS NULL)
        ORDER BY
            CASE WHEN :sortBy = 'title' AND :sortOrder = 'ASC' THEN title END ASC,
            CASE WHEN :sortBy = 'title' AND :sortOrder = 'DESC' THEN title END DESC,
            CASE WHEN :sortBy = 'created' AND :sortOrder = 'ASC' THEN created END ASC,
            CASE WHEN :sortBy = 'created' AND :sortOrder = 'DESC' THEN created END DESC,
            CASE WHEN :sortBy = 'updated' AND :sortOrder = 'ASC' THEN updated END ASC,
            CASE WHEN :sortBy = 'updated' AND :sortOrder = 'DESC' THEN updated END DESC,
            CASE WHEN :sortBy = 'difficulty' AND :sortOrder = 'ASC' THEN difficulty END ASC,
            CASE WHEN :sortBy = 'difficulty' AND :sortOrder = 'DESC' THEN difficulty END DESC
        LIMIT :limit OFFSET :offset
    """)
    fun getCoursesWithOptions(
        status: String?,
        category: String?,
        difficulty: String?,
        groupId: String?,
        includePublic: Boolean,
        search: String?,
        sortBy: String,
        sortOrder: String,
        limit: Int,
        offset: Int
    ): Flow<List<CourseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourse(course: CourseEntity)

    @Update
    suspend fun updateCourse(course: CourseEntity)

    @Query("DELETE FROM training_courses WHERE id = :id")
    suspend fun deleteCourse(id: String)

    @Query("SELECT COUNT(*) FROM training_courses WHERE groupId = :groupId")
    suspend fun getCourseCountForGroup(groupId: String): Int
}

/**
 * Data Access Object for training modules.
 */
@Dao
interface TrainingModuleDao {

    @Query("SELECT * FROM training_modules WHERE courseId = :courseId ORDER BY `order` ASC")
    fun getModules(courseId: String): Flow<List<ModuleEntity>>

    @Query("SELECT * FROM training_modules WHERE id = :id")
    fun getModule(id: String): Flow<ModuleEntity?>

    @Query("SELECT * FROM training_modules WHERE id = :id")
    suspend fun getModuleSync(id: String): ModuleEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertModule(module: ModuleEntity)

    @Update
    suspend fun updateModule(module: ModuleEntity)

    @Query("DELETE FROM training_modules WHERE id = :id")
    suspend fun deleteModule(id: String)

    @Query("UPDATE training_modules SET `order` = :order WHERE id = :id")
    suspend fun updateModuleOrder(id: String, order: Int)
}

/**
 * Data Access Object for lessons.
 */
@Dao
interface TrainingLessonDao {

    @Query("SELECT * FROM training_lessons WHERE moduleId = :moduleId ORDER BY `order` ASC")
    fun getLessons(moduleId: String): Flow<List<LessonEntity>>

    @Query("""
        SELECT l.* FROM training_lessons l
        INNER JOIN training_modules m ON l.moduleId = m.id
        WHERE m.courseId = :courseId
        ORDER BY m.`order` ASC, l.`order` ASC
    """)
    fun getLessonsForCourse(courseId: String): Flow<List<LessonEntity>>

    @Query("SELECT * FROM training_lessons WHERE id = :id")
    fun getLesson(id: String): Flow<LessonEntity?>

    @Query("SELECT * FROM training_lessons WHERE id = :id")
    suspend fun getLessonSync(id: String): LessonEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLesson(lesson: LessonEntity)

    @Update
    suspend fun updateLesson(lesson: LessonEntity)

    @Query("DELETE FROM training_lessons WHERE id = :id")
    suspend fun deleteLesson(id: String)

    @Query("UPDATE training_lessons SET `order` = :order WHERE id = :id")
    suspend fun updateLessonOrder(id: String, order: Int)

    @Query("SELECT COUNT(*) FROM training_lessons WHERE moduleId = :moduleId")
    suspend fun getLessonCount(moduleId: String): Int
}

/**
 * Data Access Object for lesson progress.
 */
@Dao
interface TrainingProgressDao {

    @Query("SELECT * FROM training_lesson_progress WHERE lessonId = :lessonId AND pubkey = :pubkey")
    fun getLessonProgress(lessonId: String, pubkey: String): Flow<LessonProgressEntity?>

    @Query("""
        SELECT p.* FROM training_lesson_progress p
        INNER JOIN training_lessons l ON p.lessonId = l.id
        INNER JOIN training_modules m ON l.moduleId = m.id
        WHERE m.courseId = :courseId AND p.pubkey = :pubkey
    """)
    fun getLessonProgressForCourse(courseId: String, pubkey: String): Flow<List<LessonProgressEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProgress(progress: LessonProgressEntity)

    @Update
    suspend fun updateProgress(progress: LessonProgressEntity)

    @Query("SELECT * FROM training_course_progress WHERE courseId = :courseId AND pubkey = :pubkey")
    fun getCourseProgress(courseId: String, pubkey: String): Flow<CourseProgressEntity?>

    @Query("SELECT * FROM training_course_progress WHERE pubkey = :pubkey ORDER BY lastActivityAt DESC")
    fun getAllCourseProgress(pubkey: String): Flow<List<CourseProgressEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourseProgress(progress: CourseProgressEntity)

    @Update
    suspend fun updateCourseProgress(progress: CourseProgressEntity)

    @Query("SELECT COUNT(*) FROM training_course_progress WHERE courseId = :courseId")
    suspend fun getEnrolledCount(courseId: String): Int

    @Query("SELECT COUNT(*) FROM training_course_progress WHERE courseId = :courseId AND completedAt IS NOT NULL")
    suspend fun getCompletedCount(courseId: String): Int
}

/**
 * Data Access Object for quiz attempts.
 */
@Dao
interface TrainingQuizDao {

    @Query("SELECT * FROM training_quiz_attempts WHERE lessonId = :lessonId AND pubkey = :pubkey ORDER BY completedAt DESC")
    fun getQuizAttempts(lessonId: String, pubkey: String): Flow<List<QuizAttemptEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertQuizAttempt(attempt: QuizAttemptEntity)

    @Query("SELECT MAX(score) FROM training_quiz_attempts WHERE lessonId = :lessonId AND pubkey = :pubkey")
    suspend fun getBestScore(lessonId: String, pubkey: String): Int?

    @Query("SELECT AVG(score) FROM training_quiz_attempts WHERE lessonId = :lessonId")
    suspend fun getAverageScore(lessonId: String): Float?
}

/**
 * Data Access Object for assignment submissions.
 */
@Dao
interface TrainingAssignmentDao {

    @Query("SELECT * FROM training_assignment_submissions WHERE lessonId = :lessonId ORDER BY submittedAt DESC")
    fun getSubmissions(lessonId: String): Flow<List<AssignmentSubmissionEntity>>

    @Query("SELECT * FROM training_assignment_submissions WHERE lessonId = :lessonId AND pubkey = :pubkey")
    fun getSubmission(lessonId: String, pubkey: String): Flow<AssignmentSubmissionEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubmission(submission: AssignmentSubmissionEntity)

    @Update
    suspend fun updateSubmission(submission: AssignmentSubmissionEntity)
}

/**
 * Data Access Object for certifications.
 */
@Dao
interface TrainingCertificationDao {

    @Query("SELECT * FROM training_certifications WHERE pubkey = :pubkey ORDER BY earnedAt DESC")
    fun getCertifications(pubkey: String): Flow<List<CertificationEntity>>

    @Query("SELECT * FROM training_certifications WHERE courseId = :courseId ORDER BY earnedAt DESC")
    fun getCertificationsForCourse(courseId: String): Flow<List<CertificationEntity>>

    @Query("SELECT * FROM training_certifications WHERE id = :id")
    fun getCertification(id: String): Flow<CertificationEntity?>

    @Query("SELECT * FROM training_certifications WHERE verificationCode = :code")
    suspend fun getCertificationByCode(code: String): CertificationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCertification(certification: CertificationEntity)

    @Query("""
        UPDATE training_certifications
        SET revokedAt = :revokedAt, revokedBy = :revokedBy, revokeReason = :reason
        WHERE id = :id
    """)
    suspend fun revokeCertification(id: String, revokedAt: Long, revokedBy: String, reason: String)

    @Query("SELECT COUNT(*) FROM training_certifications WHERE courseId = :courseId AND revokedAt IS NULL")
    suspend fun getCertificationCount(courseId: String): Int
}

/**
 * Data Access Object for live session RSVPs.
 */
@Dao
interface TrainingLiveSessionDao {

    @Query("SELECT * FROM training_live_session_rsvps WHERE lessonId = :lessonId")
    fun getRSVPs(lessonId: String): Flow<List<LiveSessionRSVPEntity>>

    @Query("SELECT * FROM training_live_session_rsvps WHERE lessonId = :lessonId AND pubkey = :pubkey")
    fun getRSVP(lessonId: String, pubkey: String): Flow<LiveSessionRSVPEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRSVP(rsvp: LiveSessionRSVPEntity)

    @Query("SELECT * FROM training_live_session_attendance WHERE lessonId = :lessonId")
    fun getAttendance(lessonId: String): Flow<List<LiveSessionAttendanceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: LiveSessionAttendanceEntity)
}
