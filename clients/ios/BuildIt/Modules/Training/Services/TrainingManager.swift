// TrainingManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for the Training module.

import Foundation
import os.log

/// Manager for training operations
@MainActor
public class TrainingManager {
    // MARK: - Properties

    private let store: TrainingStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingManager")

    // MARK: - Initialization

    public init(store: TrainingStore) {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
    }

    // MARK: - Course Operations

    /// List all courses
    public func listCourses(groupId: String? = nil) async throws -> [Course] {
        await store.loadCourses(groupId: groupId)
        return store.courses.map { $0.toCourse() }
    }

    /// Get a specific course
    public func getCourse(id: String) async throws -> Course? {
        store.getCourse(id: id)?.toCourse()
    }

    /// Create a new course
    public func createCourse(data: CreateCourseData) async throws -> Course {
        guard let createdBy = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        let course = Course(
            id: UUID().uuidString,
            groupId: data.groupId,
            title: data.title,
            description: data.description,
            imageUrl: data.imageUrl,
            category: data.category,
            difficulty: data.difficulty,
            estimatedHours: data.estimatedHours,
            prerequisites: data.prerequisites,
            status: .draft,
            certificationEnabled: data.certificationEnabled,
            certificationExpiryDays: data.certificationExpiryDays,
            isPublic: data.isPublic,
            isDefault: false,
            created: Date(),
            createdBy: createdBy,
            updated: Date()
        )

        let entity = CourseEntity.from(course)
        try store.saveCourse(entity)

        logger.info("Created course: \(course.title)")
        return course
    }

    /// Update a course
    public func updateCourse(_ courseId: String, data: UpdateCourseData) async throws -> Course {
        guard let entity = store.getCourse(id: courseId) else {
            throw TrainingError.courseNotFound
        }

        if let title = data.title { entity.title = title }
        if let description = data.description { entity.courseDescription = description }
        if let imageUrl = data.imageUrl { entity.imageUrl = imageUrl }
        if let category = data.category { entity.category = category.rawValue }
        if let difficulty = data.difficulty { entity.difficulty = difficulty.rawValue }
        if let estimatedHours = data.estimatedHours { entity.estimatedHours = estimatedHours }
        if let status = data.status { entity.status = status.rawValue }
        if let certificationEnabled = data.certificationEnabled { entity.certificationEnabled = certificationEnabled }
        if let certificationExpiryDays = data.certificationExpiryDays { entity.certificationExpiryDays = certificationExpiryDays }
        if let isPublic = data.isPublic { entity.isPublic = isPublic }

        if let prerequisites = data.prerequisites {
            let encoder = JSONEncoder()
            entity.prerequisitesJSON = try? encoder.encode(prerequisites)
        }

        try store.updateCourse(entity)

        logger.info("Updated course: \(courseId)")
        return entity.toCourse()
    }

    /// Delete a course
    public func deleteCourse(_ courseId: String) async throws {
        guard let entity = store.getCourse(id: courseId) else {
            throw TrainingError.courseNotFound
        }

        try store.deleteCourse(entity)
        logger.info("Deleted course: \(courseId)")
    }

    /// Publish a course
    public func publishCourse(_ courseId: String) async throws {
        guard let entity = store.getCourse(id: courseId) else {
            throw TrainingError.courseNotFound
        }

        entity.status = CourseStatus.published.rawValue
        try store.updateCourse(entity)

        logger.info("Published course: \(courseId)")
    }

    // MARK: - Module Operations

    /// List modules for a course
    public func listModules(courseId: String) async throws -> [TrainingModuleModel] {
        try store.getModules(courseId: courseId).map { $0.toModule() }
    }

    /// Create a module
    public func createModule(data: CreateModuleData) async throws -> TrainingModuleModel {
        let courseEntity = store.getCourse(id: data.courseId)

        // Get max order
        let existingModules = try store.getModules(courseId: data.courseId)
        let maxOrder = existingModules.map { $0.order }.max() ?? 0

        let module = TrainingModuleModel(
            id: UUID().uuidString,
            courseId: data.courseId,
            title: data.title,
            description: data.description,
            order: data.order ?? (maxOrder + 1),
            estimatedMinutes: data.estimatedMinutes,
            created: Date(),
            updated: Date()
        )

        let entity = ModuleEntity.from(module, course: courseEntity)
        try store.saveModule(entity)

        logger.info("Created module: \(module.title)")
        return module
    }

    // MARK: - Lesson Operations

    /// List lessons for a module
    public func listLessons(moduleId: String) async throws -> [Lesson] {
        try store.getLessons(moduleId: moduleId).compactMap { $0.toLesson() }
    }

    /// Get a specific lesson
    public func getLesson(id: String) async throws -> Lesson? {
        try store.getLesson(id: id)?.toLesson()
    }

    /// Create a lesson
    public func createLesson(data: CreateLessonData) async throws -> Lesson {
        let moduleEntity = try store.getModules(courseId: "").first { $0.id == data.moduleId }

        // Get max order
        let existingLessons = try store.getLessons(moduleId: data.moduleId)
        let maxOrder = existingLessons.map { $0.order }.max() ?? 0

        let lesson = Lesson(
            id: UUID().uuidString,
            moduleId: data.moduleId,
            type: data.type,
            title: data.title,
            description: data.description,
            content: data.content,
            order: data.order ?? (maxOrder + 1),
            estimatedMinutes: data.estimatedMinutes,
            requiredForCertification: data.requiredForCertification,
            passingScore: data.passingScore,
            created: Date(),
            updated: Date()
        )

        let entity = LessonEntity.from(lesson, module: moduleEntity)
        try store.saveLesson(entity)

        logger.info("Created lesson: \(lesson.title)")
        return lesson
    }

    // MARK: - Progress Operations

    /// Start a lesson
    public func startLesson(_ lessonId: String) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        let progress = LessonProgressEntity(
            id: "\(lessonId)-\(pubkey)",
            lessonId: lessonId,
            pubkey: pubkey,
            status: ProgressStatus.inProgress.rawValue,
            timeSpent: 0,
            created: Date(),
            updated: Date()
        )

        try store.saveLessonProgress(progress)

        // Ensure course progress exists
        if let lesson = try store.getLesson(id: lessonId),
           let module = lesson.module,
           let course = module.course {
            try await ensureCourseProgress(courseId: course.id, pubkey: pubkey)
        }

        logger.info("Started lesson: \(lessonId)")
    }

    /// Update lesson progress
    public func updateLessonProgress(
        _ lessonId: String,
        timeSpent: Int,
        position: Int? = nil
    ) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        guard let existing = try store.getLessonProgress(lessonId: lessonId, pubkey: pubkey) else {
            try await startLesson(lessonId)
            return
        }

        existing.timeSpent += timeSpent
        if let position = position {
            existing.lastPosition = position
        }
        existing.updated = Date()

        try store.saveLessonProgress(existing)
        logger.info("Updated lesson progress: \(lessonId)")
    }

    /// Complete a lesson
    public func completeLesson(_ lessonId: String, score: Int? = nil) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        var progress = try store.getLessonProgress(lessonId: lessonId, pubkey: pubkey)
        if progress == nil {
            progress = LessonProgressEntity(
                id: "\(lessonId)-\(pubkey)",
                lessonId: lessonId,
                pubkey: pubkey,
                status: ProgressStatus.inProgress.rawValue,
                created: Date(),
                updated: Date()
            )
        }

        progress!.status = ProgressStatus.completed.rawValue
        progress!.completedAt = Date()
        progress!.updated = Date()
        if let score = score {
            progress!.score = score
        }

        try store.saveLessonProgress(progress!)

        // Update course progress
        if let lesson = try store.getLesson(id: lessonId),
           let module = lesson.module,
           let course = module.course {
            try await updateCourseProgress(courseId: course.id, pubkey: pubkey)
            try await checkAndAwardCertification(courseId: course.id, pubkey: pubkey)
        }

        logger.info("Completed lesson: \(lessonId)")
    }

    /// Ensure course progress exists
    private func ensureCourseProgress(courseId: String, pubkey: String) async throws {
        if let _ = try store.getCourseProgress(courseId: courseId, pubkey: pubkey) {
            return
        }

        // Count total lessons
        let modules = try store.getModules(courseId: courseId)
        var totalLessons = 0
        for module in modules {
            totalLessons += try store.getLessons(moduleId: module.id).count
        }

        let progress = CourseProgressEntity(
            id: "\(courseId)-\(pubkey)",
            courseId: courseId,
            pubkey: pubkey,
            percentComplete: 0,
            lessonsCompleted: 0,
            totalLessons: totalLessons,
            startedAt: Date(),
            lastActivityAt: Date()
        )

        try store.saveCourseProgress(progress)
    }

    /// Update course progress based on lesson completions
    private func updateCourseProgress(courseId: String, pubkey: String) async throws {
        guard let progress = try store.getCourseProgress(courseId: courseId, pubkey: pubkey) else {
            return
        }

        let modules = try store.getModules(courseId: courseId)
        var completedLessons = 0
        var totalLessons = 0

        for module in modules {
            let lessons = try store.getLessons(moduleId: module.id)
            totalLessons += lessons.count

            for lesson in lessons {
                if let lessonProgress = try store.getLessonProgress(lessonId: lesson.id, pubkey: pubkey),
                   lessonProgress.status == ProgressStatus.completed.rawValue {
                    completedLessons += 1
                }
            }
        }

        progress.lessonsCompleted = completedLessons
        progress.totalLessons = totalLessons
        progress.percentComplete = totalLessons > 0 ? (completedLessons * 100) / totalLessons : 0
        progress.lastActivityAt = Date()

        if progress.percentComplete == 100 {
            progress.completedAt = Date()
        }

        try store.saveCourseProgress(progress)
    }

    /// Get course progress
    public func getCourseProgress(_ courseId: String) async throws -> CourseProgress? {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            return nil
        }
        return try store.getCourseProgress(courseId: courseId, pubkey: pubkey)?.toCourseProgress()
    }

    /// Get user training status
    public func getUserTrainingStatus(pubkey: String) async throws -> UserTrainingStatus {
        await store.loadCertifications(pubkey: pubkey)

        let certifications = store.certifications.map { $0.toCertification() }
        let validCertifications = certifications.filter { $0.isValid }
        let expiringSoon = certifications.filter { $0.isExpiringSoon }

        // Calculate enrollments and completions from course progress
        // This is a simplified version - would need proper enrollment tracking
        let coursesCompleted = validCertifications.count

        return UserTrainingStatus(
            pubkey: pubkey,
            coursesEnrolled: 0, // Would need enrollment tracking
            coursesCompleted: coursesCompleted,
            certificationsEarned: validCertifications.count,
            certificationsExpiring: expiringSoon.count,
            totalTimeSpent: 0, // Would need to sum from lesson progress
            lastActivity: nil
        )
    }

    // MARK: - Certification Operations

    /// List certifications
    public func listCertifications(pubkey: String? = nil) async throws -> [Certification] {
        let targetPubkey = pubkey ?? await cryptoManager.getPublicKeyHex()
        await store.loadCertifications(pubkey: targetPubkey)
        return store.certifications.map { $0.toCertification() }
    }

    /// Verify certification by code
    public func verifyCertification(code: String) async throws -> CertificationVerification {
        guard let certEntity = try store.getCertificationByCode(code) else {
            return CertificationVerification(
                valid: false,
                error: "Certification not found"
            )
        }

        let certification = certEntity.toCertification()

        if certification.revokedAt != nil {
            return CertificationVerification(
                valid: false,
                certification: certification,
                revoked: true
            )
        }

        if let expiresAt = certification.expiresAt, expiresAt < Date() {
            return CertificationVerification(
                valid: false,
                certification: certification,
                expired: true
            )
        }

        let course = store.getCourse(id: certification.courseId)?.toCourse()

        return CertificationVerification(
            valid: true,
            certification: certification,
            course: course
        )
    }

    /// Check and award certification if requirements are met
    private func checkAndAwardCertification(courseId: String, pubkey: String) async throws {
        guard let courseEntity = store.getCourse(id: courseId) else { return }

        // Check if certification is enabled
        guard courseEntity.certificationEnabled else { return }

        // Check if already certified
        if let existing = try store.getCertification(courseId: courseId, pubkey: pubkey),
           existing.revokedAt == nil {
            return
        }

        // Check all required lessons are completed
        let modules = try store.getModules(courseId: courseId)
        for module in modules {
            let lessons = try store.getLessons(moduleId: module.id)
            for lesson in lessons {
                guard lesson.requiredForCertification else { continue }

                guard let progress = try store.getLessonProgress(lessonId: lesson.id, pubkey: pubkey),
                      progress.status == ProgressStatus.completed.rawValue else {
                    return // Not all required lessons completed
                }

                // Check passing score for quizzes
                if let passingScore = lesson.passingScore,
                   let score = progress.score,
                   score < passingScore {
                    return // Quiz not passed
                }
            }
        }

        // Award certification
        let expiresAt: Date? = courseEntity.certificationExpiryDays.map {
            Date().addingTimeInterval(TimeInterval($0 * 24 * 60 * 60))
        }

        let certification = CertificationEntity(
            id: UUID().uuidString,
            courseId: courseId,
            pubkey: pubkey,
            earnedAt: Date(),
            expiresAt: expiresAt,
            verificationCode: generateVerificationCode()
        )

        try store.saveCertification(certification)
        logger.info("Awarded certification for course: \(courseId)")
    }

    /// Generate a unique verification code
    private func generateVerificationCode() -> String {
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return String((0..<16).compactMap { _ in characters.randomElement() })
    }

    // MARK: - Quiz Operations

    /// Submit a quiz attempt
    public func submitQuizAttempt(
        lessonId: String,
        answers: [QuizAnswer]
    ) async throws -> QuizAttempt {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        // Calculate score
        let totalPoints = answers.reduce(0) { $0 + $1.points }
        let earnedPoints = answers.filter { $0.isCorrect }.reduce(0) { $0 + $1.points }
        let score = totalPoints > 0 ? (earnedPoints * 100) / totalPoints : 0

        // Check passing score
        let lesson = try store.getLesson(id: lessonId)
        let passingScore = lesson?.passingScore ?? 70
        let passed = score >= passingScore

        let encoder = JSONEncoder()
        let answersData = try encoder.encode(answers)

        let attempt = QuizAttemptEntity(
            id: UUID().uuidString,
            lessonId: lessonId,
            pubkey: pubkey,
            answersJSON: answersData,
            score: score,
            passed: passed,
            startedAt: Date().addingTimeInterval(-60), // Placeholder
            completedAt: Date(),
            duration: 60 // Placeholder
        )

        try store.saveQuizAttempt(attempt)

        // Complete lesson if passed
        if passed {
            try await completeLesson(lessonId, score: score)
        }

        logger.info("Submitted quiz attempt for lesson: \(lessonId), score: \(score), passed: \(passed)")

        return attempt.toQuizAttempt()!
    }

    // MARK: - Live Session Operations

    /// RSVP to a live session
    public func rsvpLiveSession(_ lessonId: String, status: LiveSessionRSVPStatus) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        let rsvp = LiveSessionRSVPEntity(
            id: "\(lessonId)-\(pubkey)",
            lessonId: lessonId,
            pubkey: pubkey,
            status: status.rawValue,
            createdAt: Date(),
            updatedAt: Date()
        )

        try store.saveLiveSessionRSVP(rsvp)
        logger.info("RSVP for live session: \(lessonId), status: \(status.rawValue)")
    }

    /// Record live session attendance
    public func recordLiveAttendance(
        lessonId: String,
        joinedAt: Date,
        leftAt: Date?
    ) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw TrainingError.invalidData
        }

        let duration = Int((leftAt ?? Date()).timeIntervalSince(joinedAt))
        let wasCompleteSession = duration > 30 * 60 // 30 minutes

        let attendance = LiveSessionAttendanceEntity(
            id: "\(lessonId)-\(pubkey)-\(Int(joinedAt.timeIntervalSince1970))",
            lessonId: lessonId,
            pubkey: pubkey,
            joinedAt: joinedAt,
            leftAt: leftAt,
            duration: duration,
            wasCompleteSession: wasCompleteSession
        )

        try store.saveLiveSessionAttendance(attendance)

        // Complete lesson if attended long enough
        if wasCompleteSession {
            try await completeLesson(lessonId)
        }

        logger.info("Recorded attendance for live session: \(lessonId)")
    }

    // MARK: - Nostr Event Processing

    /// Process incoming Nostr events
    public func processNostrEvent(_ event: NostrEvent) async {
        // Handle training-related Nostr events
        // This would process course sharing, certification verification requests, etc.
        logger.debug("Processing Nostr event for training: \(event.id)")
    }

    // MARK: - Stats Operations

    /// Get course statistics
    public func getCourseStats(courseId: String) async throws -> CourseStats {
        // This would aggregate stats from enrollments, progress, and certifications
        // Simplified implementation
        return CourseStats(
            courseId: courseId,
            enrolledCount: 0,
            completedCount: 0,
            averageProgress: 0,
            averageCompletionTime: 0,
            certificationCount: store.certifications.filter { $0.courseId == courseId && $0.revokedAt == nil }.count,
            averageQuizScore: 0
        )
    }

    /// Calculate progress for a course
    public func calculateCourseProgress(courseId: String) async throws -> Int {
        guard let progress = try await getCourseProgress(courseId) else {
            return 0
        }
        return progress.percentComplete
    }
}
