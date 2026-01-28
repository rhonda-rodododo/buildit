// TrainingPersistence.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftData entities for the Training module.

import Foundation
import SwiftData

// MARK: - Course Entity

/// SwiftData model for courses
@Model
public final class CourseEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var groupId: String?
    public var title: String
    public var courseDescription: String
    public var imageUrl: String?
    public var category: String
    public var difficulty: String
    public var estimatedHours: Double
    public var prerequisitesJSON: Data?
    public var status: String
    public var certificationEnabled: Bool
    public var certificationExpiryDays: Int?
    public var isPublic: Bool
    public var isDefault: Bool
    public var created: Date
    public var createdBy: String
    public var updated: Date

    @Relationship(deleteRule: .cascade, inverse: \ModuleEntity.course)
    public var modules: [ModuleEntity]?

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        groupId: String? = nil,
        title: String,
        courseDescription: String,
        imageUrl: String? = nil,
        category: String,
        difficulty: String,
        estimatedHours: Double,
        prerequisitesJSON: Data? = nil,
        status: String = "draft",
        certificationEnabled: Bool = false,
        certificationExpiryDays: Int? = nil,
        isPublic: Bool = false,
        isDefault: Bool = false,
        created: Date = Date(),
        createdBy: String,
        updated: Date = Date()
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.groupId = groupId
        self.title = title
        self.courseDescription = courseDescription
        self.imageUrl = imageUrl
        self.category = category
        self.difficulty = difficulty
        self.estimatedHours = estimatedHours
        self.prerequisitesJSON = prerequisitesJSON
        self.status = status
        self.certificationEnabled = certificationEnabled
        self.certificationExpiryDays = certificationExpiryDays
        self.isPublic = isPublic
        self.isDefault = isDefault
        self.created = created
        self.createdBy = createdBy
        self.updated = updated
    }

    /// Convert from domain model
    public static func from(_ course: Course) -> CourseEntity {
        let encoder = JSONEncoder()
        return CourseEntity(
            id: course.id,
            groupId: course.groupId,
            title: course.title,
            courseDescription: course.description,
            imageUrl: course.imageUrl,
            category: course.category.rawValue,
            difficulty: course.difficulty.rawValue,
            estimatedHours: course.estimatedHours,
            prerequisitesJSON: course.prerequisites.flatMap { try? encoder.encode($0) },
            status: course.status.rawValue,
            certificationEnabled: course.certificationEnabled,
            certificationExpiryDays: course.certificationExpiryDays,
            isPublic: course.isPublic,
            isDefault: course.isDefault,
            created: course.created,
            createdBy: course.createdBy,
            updated: course.updated
        )
    }

    /// Convert to domain model
    public func toCourse() -> Course {
        let decoder = JSONDecoder()
        let prerequisites = prerequisitesJSON.flatMap { try? decoder.decode([String].self, from: $0) }

        return Course(
            id: id,
            groupId: groupId,
            title: title,
            description: courseDescription,
            imageUrl: imageUrl,
            category: CourseCategory(rawValue: category) ?? .custom,
            difficulty: CourseDifficulty(rawValue: difficulty) ?? .beginner,
            estimatedHours: estimatedHours,
            prerequisites: prerequisites,
            status: CourseStatus(rawValue: status) ?? .draft,
            certificationEnabled: certificationEnabled,
            certificationExpiryDays: certificationExpiryDays,
            isPublic: isPublic,
            isDefault: isDefault,
            created: created,
            createdBy: createdBy,
            updated: updated
        )
    }
}

// MARK: - Module Entity

/// SwiftData model for training modules
@Model
public final class ModuleEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var courseId: String
    public var title: String
    public var moduleDescription: String?
    public var order: Int
    public var estimatedMinutes: Int
    public var created: Date
    public var updated: Date

    public var course: CourseEntity?

    @Relationship(deleteRule: .cascade, inverse: \LessonEntity.module)
    public var lessons: [LessonEntity]?

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        courseId: String,
        title: String,
        moduleDescription: String? = nil,
        order: Int,
        estimatedMinutes: Int,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.courseId = courseId
        self.title = title
        self.moduleDescription = moduleDescription
        self.order = order
        self.estimatedMinutes = estimatedMinutes
        self.created = created
        self.updated = updated
    }

    /// Convert from domain model
    public static func from(_ module: TrainingModuleModel, course: CourseEntity?) -> ModuleEntity {
        let entity = ModuleEntity(
            id: module.id,
            courseId: module.courseId,
            title: module.title,
            moduleDescription: module.description,
            order: module.order,
            estimatedMinutes: module.estimatedMinutes,
            created: module.created,
            updated: module.updated
        )
        entity.course = course
        return entity
    }

    /// Convert to domain model
    public func toModule() -> TrainingModuleModel {
        TrainingModuleModel(
            id: id,
            courseId: courseId,
            title: title,
            description: moduleDescription,
            order: order,
            estimatedMinutes: estimatedMinutes,
            created: created,
            updated: updated
        )
    }
}

// MARK: - Lesson Entity

/// SwiftData model for lessons
@Model
public final class LessonEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var moduleId: String
    public var type: String
    public var title: String
    public var lessonDescription: String?
    public var contentJSON: Data
    public var order: Int
    public var estimatedMinutes: Int
    public var requiredForCertification: Bool
    public var passingScore: Int?
    public var created: Date
    public var updated: Date

    public var module: ModuleEntity?

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        moduleId: String,
        type: String,
        title: String,
        lessonDescription: String? = nil,
        contentJSON: Data,
        order: Int,
        estimatedMinutes: Int,
        requiredForCertification: Bool = true,
        passingScore: Int? = nil,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.moduleId = moduleId
        self.type = type
        self.title = title
        self.lessonDescription = lessonDescription
        self.contentJSON = contentJSON
        self.order = order
        self.estimatedMinutes = estimatedMinutes
        self.requiredForCertification = requiredForCertification
        self.passingScore = passingScore
        self.created = created
        self.updated = updated
    }

    /// Convert from domain model
    public static func from(_ lesson: Lesson, module: ModuleEntity?) -> LessonEntity {
        let encoder = JSONEncoder()
        let contentData = (try? encoder.encode(lesson.content)) ?? Data()

        let entity = LessonEntity(
            id: lesson.id,
            moduleId: lesson.moduleId,
            type: lesson.type.rawValue,
            title: lesson.title,
            lessonDescription: lesson.description,
            contentJSON: contentData,
            order: lesson.order,
            estimatedMinutes: lesson.estimatedMinutes,
            requiredForCertification: lesson.requiredForCertification,
            passingScore: lesson.passingScore,
            created: lesson.created,
            updated: lesson.updated
        )
        entity.module = module
        return entity
    }

    /// Convert to domain model
    public func toLesson() -> Lesson? {
        let decoder = JSONDecoder()
        guard let content = try? decoder.decode(LessonContent.self, from: contentJSON),
              let lessonType = LessonType(rawValue: type) else {
            return nil
        }

        return Lesson(
            id: id,
            moduleId: moduleId,
            type: lessonType,
            title: title,
            description: lessonDescription,
            content: content,
            order: order,
            estimatedMinutes: estimatedMinutes,
            requiredForCertification: requiredForCertification,
            passingScore: passingScore,
            created: created,
            updated: updated
        )
    }
}

// MARK: - Progress Entities

/// SwiftData model for lesson progress
@Model
public final class LessonProgressEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var lessonId: String
    public var pubkey: String
    public var status: String
    public var score: Int?
    public var timeSpent: Int
    public var lastPosition: Int?
    public var completedAt: Date?
    public var attempts: Int?
    public var created: Date
    public var updated: Date

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        lessonId: String,
        pubkey: String,
        status: String = "not-started",
        score: Int? = nil,
        timeSpent: Int = 0,
        lastPosition: Int? = nil,
        completedAt: Date? = nil,
        attempts: Int? = nil,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.status = status
        self.score = score
        self.timeSpent = timeSpent
        self.lastPosition = lastPosition
        self.completedAt = completedAt
        self.attempts = attempts
        self.created = created
        self.updated = updated
    }

    /// Convert to domain model
    public func toProgress() -> LessonProgress {
        LessonProgress(
            id: id,
            lessonId: lessonId,
            pubkey: pubkey,
            status: ProgressStatus(rawValue: status) ?? .notStarted,
            score: score,
            timeSpent: timeSpent,
            lastPosition: lastPosition,
            completedAt: completedAt,
            attempts: attempts,
            created: created,
            updated: updated
        )
    }
}

/// SwiftData model for course progress
@Model
public final class CourseProgressEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var courseId: String
    public var pubkey: String
    public var percentComplete: Int
    public var lessonsCompleted: Int
    public var totalLessons: Int
    public var currentModuleId: String?
    public var currentLessonId: String?
    public var startedAt: Date
    public var lastActivityAt: Date
    public var completedAt: Date?

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        courseId: String,
        pubkey: String,
        percentComplete: Int = 0,
        lessonsCompleted: Int = 0,
        totalLessons: Int = 0,
        currentModuleId: String? = nil,
        currentLessonId: String? = nil,
        startedAt: Date = Date(),
        lastActivityAt: Date = Date(),
        completedAt: Date? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.courseId = courseId
        self.pubkey = pubkey
        self.percentComplete = percentComplete
        self.lessonsCompleted = lessonsCompleted
        self.totalLessons = totalLessons
        self.currentModuleId = currentModuleId
        self.currentLessonId = currentLessonId
        self.startedAt = startedAt
        self.lastActivityAt = lastActivityAt
        self.completedAt = completedAt
    }

    /// Convert to domain model
    public func toCourseProgress() -> CourseProgress {
        CourseProgress(
            id: id,
            courseId: courseId,
            pubkey: pubkey,
            percentComplete: percentComplete,
            lessonsCompleted: lessonsCompleted,
            totalLessons: totalLessons,
            currentModuleId: currentModuleId,
            currentLessonId: currentLessonId,
            startedAt: startedAt,
            lastActivityAt: lastActivityAt,
            completedAt: completedAt
        )
    }
}

// MARK: - Certification Entity

/// SwiftData model for certifications
@Model
public final class CertificationEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var courseId: String
    public var pubkey: String
    public var earnedAt: Date
    public var expiresAt: Date?
    public var verificationCode: String
    public var metadataJSON: Data?
    public var revokedAt: Date?
    public var revokedBy: String?
    public var revokeReason: String?

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        courseId: String,
        pubkey: String,
        earnedAt: Date,
        expiresAt: Date? = nil,
        verificationCode: String,
        metadataJSON: Data? = nil,
        revokedAt: Date? = nil,
        revokedBy: String? = nil,
        revokeReason: String? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.courseId = courseId
        self.pubkey = pubkey
        self.earnedAt = earnedAt
        self.expiresAt = expiresAt
        self.verificationCode = verificationCode
        self.metadataJSON = metadataJSON
        self.revokedAt = revokedAt
        self.revokedBy = revokedBy
        self.revokeReason = revokeReason
    }

    /// Convert to domain model
    public func toCertification() -> Certification {
        let decoder = JSONDecoder()
        let metadata = metadataJSON.flatMap { try? decoder.decode([String: String].self, from: $0) }

        return Certification(
            id: id,
            courseId: courseId,
            pubkey: pubkey,
            earnedAt: earnedAt,
            expiresAt: expiresAt,
            verificationCode: verificationCode,
            metadata: metadata,
            revokedAt: revokedAt,
            revokedBy: revokedBy,
            revokeReason: revokeReason
        )
    }
}

// MARK: - Quiz Attempt Entity

/// SwiftData model for quiz attempts
@Model
public final class QuizAttemptEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var lessonId: String
    public var pubkey: String
    public var answersJSON: Data
    public var score: Int
    public var passed: Bool
    public var startedAt: Date
    public var completedAt: Date
    public var duration: Int

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        lessonId: String,
        pubkey: String,
        answersJSON: Data,
        score: Int,
        passed: Bool,
        startedAt: Date,
        completedAt: Date,
        duration: Int
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.answersJSON = answersJSON
        self.score = score
        self.passed = passed
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.duration = duration
    }

    /// Convert to domain model
    public func toQuizAttempt() -> QuizAttempt? {
        let decoder = JSONDecoder()
        guard let answers = try? decoder.decode([QuizAnswer].self, from: answersJSON) else {
            return nil
        }

        return QuizAttempt(
            id: id,
            lessonId: lessonId,
            pubkey: pubkey,
            answers: answers,
            score: score,
            passed: passed,
            startedAt: startedAt,
            completedAt: completedAt,
            duration: duration
        )
    }
}

// MARK: - Live Session Entities

/// SwiftData model for live session RSVPs
@Model
public final class LiveSessionRSVPEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var lessonId: String
    public var pubkey: String
    public var status: String
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        lessonId: String,
        pubkey: String,
        status: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Convert to domain model
    public func toRSVP() -> LiveSessionRSVP {
        LiveSessionRSVP(
            id: id,
            lessonId: lessonId,
            pubkey: pubkey,
            status: LiveSessionRSVPStatus(rawValue: status) ?? .tentative,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

/// SwiftData model for live session attendance
@Model
public final class LiveSessionAttendanceEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var lessonId: String
    public var pubkey: String
    public var joinedAt: Date
    public var leftAt: Date?
    public var duration: Int
    public var wasCompleteSession: Bool

    public init(
        id: String,
        schemaVersion: String = "1.0.0",
        lessonId: String,
        pubkey: String,
        joinedAt: Date,
        leftAt: Date? = nil,
        duration: Int = 0,
        wasCompleteSession: Bool = false
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.joinedAt = joinedAt
        self.leftAt = leftAt
        self.duration = duration
        self.wasCompleteSession = wasCompleteSession
    }

    /// Convert to domain model
    public func toAttendance() -> LiveSessionAttendance {
        LiveSessionAttendance(
            id: id,
            lessonId: lessonId,
            pubkey: pubkey,
            joinedAt: joinedAt,
            leftAt: leftAt,
            duration: duration,
            wasCompleteSession: wasCompleteSession
        )
    }
}
