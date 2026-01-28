// TrainingStore.swift
// BuildIt - Decentralized Mesh Communication
//
// State management for the Training module using SwiftData.

import Foundation
import SwiftData
import Combine
import os.log

/// Store for managing training data
@MainActor
public class TrainingStore: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var courses: [CourseEntity] = []
    @Published public private(set) var currentCourse: CourseEntity?
    @Published public private(set) var currentModule: ModuleEntity?
    @Published public private(set) var currentLesson: LessonEntity?
    @Published public private(set) var lessonProgress: [String: LessonProgressEntity] = [:] // lessonId -> progress
    @Published public private(set) var certifications: [CertificationEntity] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingStore")

    // MARK: - Initialization

    public init() throws {
        let schema = Schema([
            CourseEntity.self,
            ModuleEntity.self,
            LessonEntity.self,
            LessonProgressEntity.self,
            CourseProgressEntity.self,
            CertificationEntity.self,
            QuizAttemptEntity.self,
            LiveSessionRSVPEntity.self,
            LiveSessionAttendanceEntity.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [configuration])
        self.modelContext = ModelContext(modelContainer)

        logger.info("Training store initialized")
    }

    // MARK: - Course Operations

    /// Load all courses
    public func loadCourses(groupId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            var descriptor = FetchDescriptor<CourseEntity>(
                sortBy: [SortDescriptor(\.title, order: .forward)]
            )

            if let groupId = groupId {
                descriptor.predicate = #Predicate { $0.groupId == groupId || $0.isPublic }
            }

            courses = try modelContext.fetch(descriptor)
            logger.info("Loaded \(self.courses.count) courses")
        } catch {
            logger.error("Failed to load courses: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    /// Get courses by category
    public func getCourses(category: CourseCategory) -> [CourseEntity] {
        courses.filter { $0.category == category.rawValue }
    }

    /// Get published courses
    public func getPublishedCourses() -> [CourseEntity] {
        courses.filter { $0.status == CourseStatus.published.rawValue }
    }

    /// Get a specific course by ID
    public func getCourse(id: String) -> CourseEntity? {
        courses.first { $0.id == id }
    }

    /// Save a new course
    public func saveCourse(_ course: CourseEntity) throws {
        modelContext.insert(course)
        try modelContext.save()
        Task { await loadCourses() }
        logger.info("Saved course: \(course.title)")
    }

    /// Update an existing course
    public func updateCourse(_ course: CourseEntity) throws {
        course.updated = Date()
        try modelContext.save()
        Task { await loadCourses() }
        logger.info("Updated course: \(course.title)")
    }

    /// Delete a course and all related data
    public func deleteCourse(_ course: CourseEntity) throws {
        // Delete all modules (which will cascade delete lessons)
        if let modules = course.modules {
            for module in modules {
                modelContext.delete(module)
            }
        }
        modelContext.delete(course)
        try modelContext.save()
        Task { await loadCourses() }
        logger.info("Deleted course: \(course.title)")
    }

    /// Set the current course
    public func setCurrentCourse(_ course: CourseEntity?) {
        currentCourse = course
    }

    // MARK: - Module Operations

    /// Get modules for a course
    public func getModules(courseId: String) throws -> [ModuleEntity] {
        let descriptor = FetchDescriptor<ModuleEntity>(
            predicate: #Predicate { $0.courseId == courseId },
            sortBy: [SortDescriptor(\.order, order: .forward)]
        )
        return try modelContext.fetch(descriptor)
    }

    /// Save a module
    public func saveModule(_ module: ModuleEntity) throws {
        modelContext.insert(module)
        try modelContext.save()
        logger.info("Saved module: \(module.title)")
    }

    /// Update a module
    public func updateModule(_ module: ModuleEntity) throws {
        module.updated = Date()
        try modelContext.save()
        logger.info("Updated module: \(module.title)")
    }

    /// Delete a module
    public func deleteModule(_ module: ModuleEntity) throws {
        modelContext.delete(module)
        try modelContext.save()
        logger.info("Deleted module: \(module.title)")
    }

    /// Set the current module
    public func setCurrentModule(_ module: ModuleEntity?) {
        currentModule = module
    }

    // MARK: - Lesson Operations

    /// Get lessons for a module
    public func getLessons(moduleId: String) throws -> [LessonEntity] {
        let descriptor = FetchDescriptor<LessonEntity>(
            predicate: #Predicate { $0.moduleId == moduleId },
            sortBy: [SortDescriptor(\.order, order: .forward)]
        )
        return try modelContext.fetch(descriptor)
    }

    /// Get a specific lesson
    public func getLesson(id: String) throws -> LessonEntity? {
        let descriptor = FetchDescriptor<LessonEntity>(
            predicate: #Predicate { $0.id == id }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Save a lesson
    public func saveLesson(_ lesson: LessonEntity) throws {
        modelContext.insert(lesson)
        try modelContext.save()
        logger.info("Saved lesson: \(lesson.title)")
    }

    /// Update a lesson
    public func updateLesson(_ lesson: LessonEntity) throws {
        lesson.updated = Date()
        try modelContext.save()
        logger.info("Updated lesson: \(lesson.title)")
    }

    /// Delete a lesson
    public func deleteLesson(_ lesson: LessonEntity) throws {
        modelContext.delete(lesson)
        try modelContext.save()
        logger.info("Deleted lesson: \(lesson.title)")
    }

    /// Set the current lesson
    public func setCurrentLesson(_ lesson: LessonEntity?) {
        currentLesson = lesson
    }

    // MARK: - Progress Operations

    /// Get lesson progress for current user
    public func getLessonProgress(lessonId: String, pubkey: String) throws -> LessonProgressEntity? {
        let descriptor = FetchDescriptor<LessonProgressEntity>(
            predicate: #Predicate { $0.lessonId == lessonId && $0.pubkey == pubkey }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Save or update lesson progress
    public func saveLessonProgress(_ progress: LessonProgressEntity) throws {
        // Check if progress already exists
        if let existing = try getLessonProgress(lessonId: progress.lessonId, pubkey: progress.pubkey) {
            existing.status = progress.status
            existing.score = progress.score
            existing.timeSpent = progress.timeSpent
            existing.lastPosition = progress.lastPosition
            existing.completedAt = progress.completedAt
            existing.attempts = progress.attempts
            existing.updated = Date()
        } else {
            modelContext.insert(progress)
        }
        try modelContext.save()
        lessonProgress[progress.lessonId] = progress
        logger.info("Saved lesson progress for: \(progress.lessonId)")
    }

    /// Get course progress for current user
    public func getCourseProgress(courseId: String, pubkey: String) throws -> CourseProgressEntity? {
        let descriptor = FetchDescriptor<CourseProgressEntity>(
            predicate: #Predicate { $0.courseId == courseId && $0.pubkey == pubkey }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Save or update course progress
    public func saveCourseProgress(_ progress: CourseProgressEntity) throws {
        if let existing = try getCourseProgress(courseId: progress.courseId, pubkey: progress.pubkey) {
            existing.percentComplete = progress.percentComplete
            existing.lessonsCompleted = progress.lessonsCompleted
            existing.totalLessons = progress.totalLessons
            existing.currentModuleId = progress.currentModuleId
            existing.currentLessonId = progress.currentLessonId
            existing.lastActivityAt = Date()
            existing.completedAt = progress.completedAt
        } else {
            modelContext.insert(progress)
        }
        try modelContext.save()
        logger.info("Saved course progress for: \(progress.courseId)")
    }

    /// Load progress for current user
    public func loadProgress(pubkey: String) async {
        do {
            let descriptor = FetchDescriptor<LessonProgressEntity>(
                predicate: #Predicate { $0.pubkey == pubkey }
            )
            let progress = try modelContext.fetch(descriptor)
            for p in progress {
                lessonProgress[p.lessonId] = p
            }
            logger.info("Loaded progress for \(progress.count) lessons")
        } catch {
            logger.error("Failed to load progress: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    // MARK: - Certification Operations

    /// Load certifications for current user
    public func loadCertifications(pubkey: String? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            var descriptor: FetchDescriptor<CertificationEntity>
            if let pubkey = pubkey {
                descriptor = FetchDescriptor<CertificationEntity>(
                    predicate: #Predicate { $0.pubkey == pubkey },
                    sortBy: [SortDescriptor(\.earnedAt, order: .reverse)]
                )
            } else {
                descriptor = FetchDescriptor<CertificationEntity>(
                    sortBy: [SortDescriptor(\.earnedAt, order: .reverse)]
                )
            }
            certifications = try modelContext.fetch(descriptor)
            logger.info("Loaded \(self.certifications.count) certifications")
        } catch {
            logger.error("Failed to load certifications: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    /// Get certification for a course
    public func getCertification(courseId: String, pubkey: String) throws -> CertificationEntity? {
        let descriptor = FetchDescriptor<CertificationEntity>(
            predicate: #Predicate { $0.courseId == courseId && $0.pubkey == pubkey }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Get certification by verification code
    public func getCertificationByCode(_ code: String) throws -> CertificationEntity? {
        let descriptor = FetchDescriptor<CertificationEntity>(
            predicate: #Predicate { $0.verificationCode == code }
        )
        return try modelContext.fetch(descriptor).first
    }

    /// Save a certification
    public func saveCertification(_ certification: CertificationEntity) throws {
        modelContext.insert(certification)
        try modelContext.save()
        Task { await loadCertifications() }
        logger.info("Saved certification: \(certification.id)")
    }

    /// Revoke a certification
    public func revokeCertification(_ certification: CertificationEntity, by revoker: String, reason: String) throws {
        certification.revokedAt = Date()
        certification.revokedBy = revoker
        certification.revokeReason = reason
        try modelContext.save()
        Task { await loadCertifications() }
        logger.info("Revoked certification: \(certification.id)")
    }

    // MARK: - Quiz Operations

    /// Save a quiz attempt
    public func saveQuizAttempt(_ attempt: QuizAttemptEntity) throws {
        modelContext.insert(attempt)
        try modelContext.save()
        logger.info("Saved quiz attempt: \(attempt.id)")
    }

    /// Get quiz attempts for a lesson
    public func getQuizAttempts(lessonId: String, pubkey: String) throws -> [QuizAttemptEntity] {
        let descriptor = FetchDescriptor<QuizAttemptEntity>(
            predicate: #Predicate { $0.lessonId == lessonId && $0.pubkey == pubkey },
            sortBy: [SortDescriptor(\.completedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    // MARK: - Live Session Operations

    /// Save live session RSVP
    public func saveLiveSessionRSVP(_ rsvp: LiveSessionRSVPEntity) throws {
        // Check if RSVP already exists
        let descriptor = FetchDescriptor<LiveSessionRSVPEntity>(
            predicate: #Predicate { $0.lessonId == rsvp.lessonId && $0.pubkey == rsvp.pubkey }
        )
        if let existing = try modelContext.fetch(descriptor).first {
            existing.status = rsvp.status
            existing.updatedAt = Date()
        } else {
            modelContext.insert(rsvp)
        }
        try modelContext.save()
        logger.info("Saved RSVP for lesson: \(rsvp.lessonId)")
    }

    /// Get RSVPs for a lesson
    public func getLiveSessionRSVPs(lessonId: String) throws -> [LiveSessionRSVPEntity] {
        let descriptor = FetchDescriptor<LiveSessionRSVPEntity>(
            predicate: #Predicate { $0.lessonId == lessonId }
        )
        return try modelContext.fetch(descriptor)
    }

    /// Save live session attendance
    public func saveLiveSessionAttendance(_ attendance: LiveSessionAttendanceEntity) throws {
        // Check if attendance record already exists
        let descriptor = FetchDescriptor<LiveSessionAttendanceEntity>(
            predicate: #Predicate { $0.lessonId == attendance.lessonId && $0.pubkey == attendance.pubkey }
        )
        if let existing = try modelContext.fetch(descriptor).first {
            existing.leftAt = attendance.leftAt
            existing.duration = existing.duration + attendance.duration
            if attendance.duration > 30 * 60 { // 30 minutes
                existing.wasCompleteSession = true
            }
        } else {
            modelContext.insert(attendance)
        }
        try modelContext.save()
        logger.info("Saved attendance for lesson: \(attendance.lessonId)")
    }

    // MARK: - Search and Filter

    /// Search courses by title or description
    public func searchCourses(query: String) -> [CourseEntity] {
        courses.filter { course in
            course.title.localizedCaseInsensitiveContains(query) ||
            course.courseDescription.localizedCaseInsensitiveContains(query)
        }
    }

    /// Filter courses by difficulty
    public func filterCourses(difficulty: CourseDifficulty) -> [CourseEntity] {
        courses.filter { $0.difficulty == difficulty.rawValue }
    }
}

// MARK: - Errors

/// Errors related to training
public enum TrainingError: LocalizedError {
    case courseNotFound
    case moduleNotFound
    case lessonNotFound
    case progressNotFound
    case certificationNotFound
    case invalidData
    case quizNotPassed
    case prerequisitesNotMet
    case alreadyCertified

    public var errorDescription: String? {
        switch self {
        case .courseNotFound:
            return "Course not found"
        case .moduleNotFound:
            return "Module not found"
        case .lessonNotFound:
            return "Lesson not found"
        case .progressNotFound:
            return "Progress not found"
        case .certificationNotFound:
            return "Certification not found"
        case .invalidData:
            return "Invalid data"
        case .quizNotPassed:
            return "Quiz score below passing threshold"
        case .prerequisitesNotMet:
            return "Course prerequisites not met"
        case .alreadyCertified:
            return "Already certified for this course"
        }
    }
}
