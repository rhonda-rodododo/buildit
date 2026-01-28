// TrainingModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for the Training module matching the protocol schema.

import Foundation

// MARK: - Enums

/// Course category types
public enum CourseCategory: String, Codable, CaseIterable, Sendable {
    case appBasics = "app-basics"
    case opsec = "opsec"
    case digitalSecurity = "digital-security"
    case legal = "legal"
    case medic = "medic"
    case selfDefense = "self-defense"
    case organizing = "organizing"
    case communication = "communication"
    case civilDefense = "civil-defense"
    case custom = "custom"

    /// Display name for the category
    public var displayName: String {
        switch self {
        case .appBasics: return "App Basics"
        case .opsec: return "OpSec"
        case .digitalSecurity: return "Digital Security"
        case .legal: return "Legal"
        case .medic: return "Medic"
        case .selfDefense: return "Self Defense"
        case .organizing: return "Organizing"
        case .communication: return "Communication"
        case .civilDefense: return "Civil Defense"
        case .custom: return "Custom"
        }
    }

    /// System icon name for the category
    public var iconName: String {
        switch self {
        case .appBasics: return "app.badge"
        case .opsec: return "lock.shield"
        case .digitalSecurity: return "network.badge.shield.half.filled"
        case .legal: return "scale.3d"
        case .medic: return "cross.case"
        case .selfDefense: return "person.badge.shield.checkmark"
        case .organizing: return "person.3"
        case .communication: return "bubble.left.and.bubble.right"
        case .civilDefense: return "shield.lefthalf.filled"
        case .custom: return "square.stack.3d.up"
        }
    }
}

/// Course difficulty levels
public enum CourseDifficulty: String, Codable, CaseIterable, Sendable {
    case beginner
    case intermediate
    case advanced

    /// Display name for the difficulty
    public var displayName: String {
        rawValue.capitalized
    }
}

/// Course status
public enum CourseStatus: String, Codable, CaseIterable, Sendable {
    case draft
    case published
    case archived
}

/// Lesson types
public enum LessonType: String, Codable, CaseIterable, Sendable {
    case video
    case document
    case quiz
    case assignment
    case liveSession = "live-session"
    case interactive

    /// Display name for the lesson type
    public var displayName: String {
        switch self {
        case .video: return "Video"
        case .document: return "Document"
        case .quiz: return "Quiz"
        case .assignment: return "Assignment"
        case .liveSession: return "Live Session"
        case .interactive: return "Interactive"
        }
    }

    /// System icon name
    public var iconName: String {
        switch self {
        case .video: return "play.rectangle"
        case .document: return "doc.text"
        case .quiz: return "checkmark.circle"
        case .assignment: return "doc.badge.plus"
        case .liveSession: return "video"
        case .interactive: return "hand.tap"
        }
    }
}

/// Quiz question types
public enum QuizQuestionType: String, Codable, CaseIterable, Sendable {
    case multipleChoice = "multiple-choice"
    case multiSelect = "multi-select"
    case trueFalse = "true-false"
    case fillInBlank = "fill-in-blank"
    case shortAnswer = "short-answer"
}

/// Progress status
public enum ProgressStatus: String, Codable, CaseIterable, Sendable {
    case notStarted = "not-started"
    case inProgress = "in-progress"
    case completed
}

/// Assignment review status
public enum AssignmentReviewStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case inReview = "in-review"
    case approved
    case rejected
    case revisionRequested = "revision-requested"
}

/// RSVP status for live sessions
public enum LiveSessionRSVPStatus: String, Codable, Sendable {
    case confirmed
    case tentative
    case declined
}

// MARK: - Course Types

/// Training course - top-level container
public struct Course: Identifiable, Codable, Sendable {
    public let id: String
    public var groupId: String?
    public var title: String
    public var description: String
    public var imageUrl: String?
    public var category: CourseCategory
    public var difficulty: CourseDifficulty
    public var estimatedHours: Double
    public var prerequisites: [String]?
    public var status: CourseStatus
    public var certificationEnabled: Bool
    public var certificationExpiryDays: Int?
    public var isPublic: Bool
    public var isDefault: Bool
    public var created: Date
    public var createdBy: String
    public var updated: Date

    public init(
        id: String,
        groupId: String? = nil,
        title: String,
        description: String,
        imageUrl: String? = nil,
        category: CourseCategory,
        difficulty: CourseDifficulty,
        estimatedHours: Double,
        prerequisites: [String]? = nil,
        status: CourseStatus = .draft,
        certificationEnabled: Bool = false,
        certificationExpiryDays: Int? = nil,
        isPublic: Bool = false,
        isDefault: Bool = false,
        created: Date = Date(),
        createdBy: String,
        updated: Date = Date()
    ) {
        self.id = id
        self.groupId = groupId
        self.title = title
        self.description = description
        self.imageUrl = imageUrl
        self.category = category
        self.difficulty = difficulty
        self.estimatedHours = estimatedHours
        self.prerequisites = prerequisites
        self.status = status
        self.certificationEnabled = certificationEnabled
        self.certificationExpiryDays = certificationExpiryDays
        self.isPublic = isPublic
        self.isDefault = isDefault
        self.created = created
        self.createdBy = createdBy
        self.updated = updated
    }
}

/// Data for creating a new course
public struct CreateCourseData: Sendable {
    public var groupId: String?
    public var title: String
    public var description: String
    public var imageUrl: String?
    public var category: CourseCategory
    public var difficulty: CourseDifficulty
    public var estimatedHours: Double
    public var prerequisites: [String]?
    public var certificationEnabled: Bool
    public var certificationExpiryDays: Int?
    public var isPublic: Bool

    public init(
        groupId: String? = nil,
        title: String,
        description: String,
        imageUrl: String? = nil,
        category: CourseCategory,
        difficulty: CourseDifficulty,
        estimatedHours: Double,
        prerequisites: [String]? = nil,
        certificationEnabled: Bool = false,
        certificationExpiryDays: Int? = nil,
        isPublic: Bool = false
    ) {
        self.groupId = groupId
        self.title = title
        self.description = description
        self.imageUrl = imageUrl
        self.category = category
        self.difficulty = difficulty
        self.estimatedHours = estimatedHours
        self.prerequisites = prerequisites
        self.certificationEnabled = certificationEnabled
        self.certificationExpiryDays = certificationExpiryDays
        self.isPublic = isPublic
    }
}

/// Data for updating a course
public struct UpdateCourseData: Sendable {
    public var title: String?
    public var description: String?
    public var imageUrl: String?
    public var category: CourseCategory?
    public var difficulty: CourseDifficulty?
    public var estimatedHours: Double?
    public var prerequisites: [String]?
    public var status: CourseStatus?
    public var certificationEnabled: Bool?
    public var certificationExpiryDays: Int?
    public var isPublic: Bool?

    public init() {}
}

// MARK: - Module Types

/// Training module - chapter within a course
/// Named TrainingModuleModel to avoid collision with Swift's Module type
public struct TrainingModuleModel: Identifiable, Codable, Sendable {
    public let id: String
    public var courseId: String
    public var title: String
    public var description: String?
    public var order: Int
    public var estimatedMinutes: Int
    public var created: Date
    public var updated: Date

    public init(
        id: String,
        courseId: String,
        title: String,
        description: String? = nil,
        order: Int,
        estimatedMinutes: Int,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.courseId = courseId
        self.title = title
        self.description = description
        self.order = order
        self.estimatedMinutes = estimatedMinutes
        self.created = created
        self.updated = updated
    }
}

/// Data for creating a training module
public struct CreateModuleData: Sendable {
    public var courseId: String
    public var title: String
    public var description: String?
    public var order: Int?
    public var estimatedMinutes: Int

    public init(
        courseId: String,
        title: String,
        description: String? = nil,
        order: Int? = nil,
        estimatedMinutes: Int
    ) {
        self.courseId = courseId
        self.title = title
        self.description = description
        self.order = order
        self.estimatedMinutes = estimatedMinutes
    }
}

// MARK: - Lesson Content Types

/// Video lesson content
public struct VideoContent: Codable, Sendable {
    public let type: String = "video"
    public var videoUrl: String
    public var transcriptUrl: String?
    public var captionsUrl: String?
    public var chaptersUrl: String?
    public var duration: Int? // seconds

    public init(
        videoUrl: String,
        transcriptUrl: String? = nil,
        captionsUrl: String? = nil,
        chaptersUrl: String? = nil,
        duration: Int? = nil
    ) {
        self.videoUrl = videoUrl
        self.transcriptUrl = transcriptUrl
        self.captionsUrl = captionsUrl
        self.chaptersUrl = chaptersUrl
        self.duration = duration
    }
}

/// Document lesson content
public struct DocumentContent: Codable, Sendable {
    public let type: String = "document"
    public var markdown: String?
    public var pdfUrl: String?

    public init(markdown: String? = nil, pdfUrl: String? = nil) {
        self.markdown = markdown
        self.pdfUrl = pdfUrl
    }
}

/// Quiz question
public struct QuizQuestion: Identifiable, Codable, Sendable {
    public let id: String
    public var type: QuizQuestionType
    public var question: String
    public var options: [String]?
    public var correctAnswer: [String] // Can be single or multiple correct
    public var explanation: String?
    public var points: Int
    public var order: Int

    public init(
        id: String,
        type: QuizQuestionType,
        question: String,
        options: [String]? = nil,
        correctAnswer: [String],
        explanation: String? = nil,
        points: Int = 1,
        order: Int
    ) {
        self.id = id
        self.type = type
        self.question = question
        self.options = options
        self.correctAnswer = correctAnswer
        self.explanation = explanation
        self.points = points
        self.order = order
    }
}

/// Quiz lesson content
public struct QuizContent: Codable, Sendable {
    public let type: String = "quiz"
    public var questions: [QuizQuestion]
    public var passingScore: Int // 0-100
    public var allowRetakes: Bool
    public var maxAttempts: Int?
    public var shuffleQuestions: Bool
    public var shuffleOptions: Bool
    public var showCorrectAfter: Bool
    public var timeLimitMinutes: Int?

    public init(
        questions: [QuizQuestion],
        passingScore: Int = 70,
        allowRetakes: Bool = true,
        maxAttempts: Int? = nil,
        shuffleQuestions: Bool = false,
        shuffleOptions: Bool = false,
        showCorrectAfter: Bool = true,
        timeLimitMinutes: Int? = nil
    ) {
        self.questions = questions
        self.passingScore = passingScore
        self.allowRetakes = allowRetakes
        self.maxAttempts = maxAttempts
        self.shuffleQuestions = shuffleQuestions
        self.shuffleOptions = shuffleOptions
        self.showCorrectAfter = showCorrectAfter
        self.timeLimitMinutes = timeLimitMinutes
    }
}

/// Live session lesson content
public struct LiveSessionContent: Codable, Sendable {
    public let type: String = "live-session"
    public var scheduledAt: Date
    public var duration: Int // minutes
    public var instructorPubkey: String
    public var conferenceRoomId: String?
    public var recordingUrl: String?
    public var maxParticipants: Int?
    public var requiresRSVP: Bool

    public init(
        scheduledAt: Date,
        duration: Int,
        instructorPubkey: String,
        conferenceRoomId: String? = nil,
        recordingUrl: String? = nil,
        maxParticipants: Int? = nil,
        requiresRSVP: Bool = true
    ) {
        self.scheduledAt = scheduledAt
        self.duration = duration
        self.instructorPubkey = instructorPubkey
        self.conferenceRoomId = conferenceRoomId
        self.recordingUrl = recordingUrl
        self.maxParticipants = maxParticipants
        self.requiresRSVP = requiresRSVP
    }
}

/// Combined lesson content
public enum LessonContent: Codable, Sendable {
    case video(VideoContent)
    case document(DocumentContent)
    case quiz(QuizContent)
    case liveSession(LiveSessionContent)

    private enum CodingKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "video":
            self = .video(try VideoContent(from: decoder))
        case "document":
            self = .document(try DocumentContent(from: decoder))
        case "quiz":
            self = .quiz(try QuizContent(from: decoder))
        case "live-session":
            self = .liveSession(try LiveSessionContent(from: decoder))
        default:
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Unknown lesson content type: \(type)"
                )
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .video(let content):
            try content.encode(to: encoder)
        case .document(let content):
            try content.encode(to: encoder)
        case .quiz(let content):
            try content.encode(to: encoder)
        case .liveSession(let content):
            try content.encode(to: encoder)
        }
    }
}

// MARK: - Lesson Types

/// Lesson - individual learning unit
public struct Lesson: Identifiable, Codable, Sendable {
    public let id: String
    public var moduleId: String
    public var type: LessonType
    public var title: String
    public var description: String?
    public var content: LessonContent
    public var order: Int
    public var estimatedMinutes: Int
    public var requiredForCertification: Bool
    public var passingScore: Int?
    public var created: Date
    public var updated: Date

    public init(
        id: String,
        moduleId: String,
        type: LessonType,
        title: String,
        description: String? = nil,
        content: LessonContent,
        order: Int,
        estimatedMinutes: Int,
        requiredForCertification: Bool = true,
        passingScore: Int? = nil,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.moduleId = moduleId
        self.type = type
        self.title = title
        self.description = description
        self.content = content
        self.order = order
        self.estimatedMinutes = estimatedMinutes
        self.requiredForCertification = requiredForCertification
        self.passingScore = passingScore
        self.created = created
        self.updated = updated
    }
}

/// Data for creating a lesson
public struct CreateLessonData: Sendable {
    public var moduleId: String
    public var type: LessonType
    public var title: String
    public var description: String?
    public var content: LessonContent
    public var order: Int?
    public var estimatedMinutes: Int
    public var requiredForCertification: Bool
    public var passingScore: Int?

    public init(
        moduleId: String,
        type: LessonType,
        title: String,
        description: String? = nil,
        content: LessonContent,
        order: Int? = nil,
        estimatedMinutes: Int,
        requiredForCertification: Bool = true,
        passingScore: Int? = nil
    ) {
        self.moduleId = moduleId
        self.type = type
        self.title = title
        self.description = description
        self.content = content
        self.order = order
        self.estimatedMinutes = estimatedMinutes
        self.requiredForCertification = requiredForCertification
        self.passingScore = passingScore
    }
}

// MARK: - Progress Types

/// User progress on a lesson
public struct LessonProgress: Identifiable, Codable, Sendable {
    public let id: String
    public var lessonId: String
    public var pubkey: String
    public var status: ProgressStatus
    public var score: Int?
    public var timeSpent: Int // seconds
    public var lastPosition: Int? // video position in seconds
    public var completedAt: Date?
    public var attempts: Int?
    public var created: Date
    public var updated: Date

    public init(
        id: String,
        lessonId: String,
        pubkey: String,
        status: ProgressStatus = .notStarted,
        score: Int? = nil,
        timeSpent: Int = 0,
        lastPosition: Int? = nil,
        completedAt: Date? = nil,
        attempts: Int? = nil,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
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
}

/// User progress on a course
public struct CourseProgress: Identifiable, Codable, Sendable {
    public let id: String
    public var courseId: String
    public var pubkey: String
    public var percentComplete: Int // 0-100
    public var lessonsCompleted: Int
    public var totalLessons: Int
    public var currentModuleId: String?
    public var currentLessonId: String?
    public var startedAt: Date
    public var lastActivityAt: Date
    public var completedAt: Date?

    public init(
        id: String,
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
}

/// Quiz answer
public struct QuizAnswer: Codable, Sendable {
    public var questionId: String
    public var selectedAnswer: [String]
    public var isCorrect: Bool
    public var points: Int

    public init(questionId: String, selectedAnswer: [String], isCorrect: Bool, points: Int) {
        self.questionId = questionId
        self.selectedAnswer = selectedAnswer
        self.isCorrect = isCorrect
        self.points = points
    }
}

/// Quiz attempt record
public struct QuizAttempt: Identifiable, Codable, Sendable {
    public let id: String
    public var lessonId: String
    public var pubkey: String
    public var answers: [QuizAnswer]
    public var score: Int // 0-100
    public var passed: Bool
    public var startedAt: Date
    public var completedAt: Date
    public var duration: Int // seconds

    public init(
        id: String,
        lessonId: String,
        pubkey: String,
        answers: [QuizAnswer],
        score: Int,
        passed: Bool,
        startedAt: Date,
        completedAt: Date,
        duration: Int
    ) {
        self.id = id
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.answers = answers
        self.score = score
        self.passed = passed
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.duration = duration
    }
}

// MARK: - Certification Types

/// Certification record
public struct Certification: Identifiable, Codable, Sendable {
    public let id: String
    public var courseId: String
    public var pubkey: String
    public var earnedAt: Date
    public var expiresAt: Date?
    public var verificationCode: String
    public var metadata: [String: String]?
    public var revokedAt: Date?
    public var revokedBy: String?
    public var revokeReason: String?

    public init(
        id: String,
        courseId: String,
        pubkey: String,
        earnedAt: Date,
        expiresAt: Date? = nil,
        verificationCode: String,
        metadata: [String: String]? = nil,
        revokedAt: Date? = nil,
        revokedBy: String? = nil,
        revokeReason: String? = nil
    ) {
        self.id = id
        self.courseId = courseId
        self.pubkey = pubkey
        self.earnedAt = earnedAt
        self.expiresAt = expiresAt
        self.verificationCode = verificationCode
        self.metadata = metadata
        self.revokedAt = revokedAt
        self.revokedBy = revokedBy
        self.revokeReason = revokeReason
    }

    /// Whether this certification is currently valid
    public var isValid: Bool {
        if revokedAt != nil { return false }
        if let expiresAt = expiresAt, expiresAt < Date() { return false }
        return true
    }

    /// Whether this certification is expiring soon (within 30 days)
    public var isExpiringSoon: Bool {
        guard let expiresAt = expiresAt else { return false }
        let thirtyDays = TimeInterval(30 * 24 * 60 * 60)
        return expiresAt > Date() && expiresAt < Date().addingTimeInterval(thirtyDays)
    }
}

/// Certification verification result
public struct CertificationVerification: Sendable {
    public var valid: Bool
    public var certification: Certification?
    public var course: Course?
    public var holderName: String?
    public var expired: Bool?
    public var revoked: Bool?
    public var error: String?

    public init(
        valid: Bool,
        certification: Certification? = nil,
        course: Course? = nil,
        holderName: String? = nil,
        expired: Bool? = nil,
        revoked: Bool? = nil,
        error: String? = nil
    ) {
        self.valid = valid
        self.certification = certification
        self.course = course
        self.holderName = holderName
        self.expired = expired
        self.revoked = revoked
        self.error = error
    }
}

// MARK: - Stats Types

/// Course statistics
public struct CourseStats: Sendable {
    public var courseId: String
    public var enrolledCount: Int
    public var completedCount: Int
    public var averageProgress: Int
    public var averageCompletionTime: Double // hours
    public var certificationCount: Int
    public var averageQuizScore: Int

    public init(
        courseId: String,
        enrolledCount: Int = 0,
        completedCount: Int = 0,
        averageProgress: Int = 0,
        averageCompletionTime: Double = 0,
        certificationCount: Int = 0,
        averageQuizScore: Int = 0
    ) {
        self.courseId = courseId
        self.enrolledCount = enrolledCount
        self.completedCount = completedCount
        self.averageProgress = averageProgress
        self.averageCompletionTime = averageCompletionTime
        self.certificationCount = certificationCount
        self.averageQuizScore = averageQuizScore
    }
}

/// User training status
public struct UserTrainingStatus: Sendable {
    public var pubkey: String
    public var coursesEnrolled: Int
    public var coursesCompleted: Int
    public var certificationsEarned: Int
    public var certificationsExpiring: Int
    public var totalTimeSpent: Int // hours
    public var lastActivity: Date?

    public init(
        pubkey: String,
        coursesEnrolled: Int = 0,
        coursesCompleted: Int = 0,
        certificationsEarned: Int = 0,
        certificationsExpiring: Int = 0,
        totalTimeSpent: Int = 0,
        lastActivity: Date? = nil
    ) {
        self.pubkey = pubkey
        self.coursesEnrolled = coursesEnrolled
        self.coursesCompleted = coursesCompleted
        self.certificationsEarned = certificationsEarned
        self.certificationsExpiring = certificationsExpiring
        self.totalTimeSpent = totalTimeSpent
        self.lastActivity = lastActivity
    }
}

// MARK: - Live Session Types

/// Live session RSVP
public struct LiveSessionRSVP: Identifiable, Codable, Sendable {
    public let id: String
    public var lessonId: String
    public var pubkey: String
    public var status: LiveSessionRSVPStatus
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: String,
        lessonId: String,
        pubkey: String,
        status: LiveSessionRSVPStatus,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Live session attendance record
public struct LiveSessionAttendance: Identifiable, Codable, Sendable {
    public let id: String
    public var lessonId: String
    public var pubkey: String
    public var joinedAt: Date
    public var leftAt: Date?
    public var duration: Int // seconds
    public var wasCompleteSession: Bool

    public init(
        id: String,
        lessonId: String,
        pubkey: String,
        joinedAt: Date,
        leftAt: Date? = nil,
        duration: Int = 0,
        wasCompleteSession: Bool = false
    ) {
        self.id = id
        self.lessonId = lessonId
        self.pubkey = pubkey
        self.joinedAt = joinedAt
        self.leftAt = leftAt
        self.duration = duration
        self.wasCompleteSession = wasCompleteSession
    }
}
