// TrainingModels.swift
// BuildIt - Decentralized Mesh Communication
//
// Data models for the Training module matching the protocol schema.
// Protocol types imported from generated schemas; UI-only extensions defined locally.

import Foundation

// Re-export protocol types from generated schema.
// The following types come from Sources/Generated/Schemas/training.swift:
//   Course (generated), CourseCategory, CourseDifficulty, CourseStatus,
//   LessonType, QuizQuestionType, ProgressStatus, AssignmentReviewStatus,
//   InteractiveExerciseType, LiveSessionRSVPStatus, TrainingModule,
//   QuizQuestion (generated), QuestionElement, AssignmentRubricItem, RubricElement,
//   Lesson (generated), CourseProgress (generated), Certification (generated),
//   TrainingSchema

// MARK: - UI Extensions for CourseCategory

extension CourseCategory: CaseIterable {
    public static var allCases: [CourseCategory] {
        [.appBasics, .opsec, .digitalSecurity, .legal, .medic,
         .selfDefense, .organizing, .communication, .civilDefense, .custom]
    }

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

// MARK: - UI Extensions for CourseDifficulty

extension CourseDifficulty: CaseIterable {
    public static var allCases: [CourseDifficulty] {
        [.beginner, .intermediate, .advanced]
    }

    public var displayName: String {
        rawValue.capitalized
    }
}

// MARK: - UI Extensions for CourseStatus

extension CourseStatus: CaseIterable {
    public static var allCases: [CourseStatus] {
        [.draft, .published, .archived]
    }
}

// MARK: - UI Extensions for LessonType

extension LessonType: CaseIterable {
    public static var allCases: [LessonType] {
        [.video, .document, .quiz, .assignment, .liveSession, .interactive]
    }

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

// MARK: - UI Extensions for QuizQuestionType

extension QuizQuestionType: CaseIterable {
    public static var allCases: [QuizQuestionType] {
        [.multipleChoice, .multiSelect, .trueFalse, .fillInBlank, .shortAnswer]
    }
}

// MARK: - UI Extensions for ProgressStatus

extension ProgressStatus: CaseIterable {
    public static var allCases: [ProgressStatus] {
        [.notStarted, .inProgress, .completed]
    }
}

// MARK: - UI Extensions for AssignmentReviewStatus

extension AssignmentReviewStatus: CaseIterable {
    public static var allCases: [AssignmentReviewStatus] {
        [.pending, .inReview, .approved, .rejected, .revisionRequested]
    }
}

// MARK: - UI-Only Types

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

/// Training module (UI-layer, named to avoid collision with Swift's Module type)
/// Uses Date fields instead of Int timestamps for UI convenience.
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

// MARK: - Lesson Content Types (UI-only, with Date fields and custom Codable)

/// Video lesson content
public struct VideoContent: Codable, Sendable {
    public let type: String = "video"
    public var videoUrl: String
    public var transcriptUrl: String?
    public var captionsUrl: String?
    public var chaptersUrl: String?
    public var duration: Int?

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

/// Quiz question (UI-layer with Identifiable)
public struct QuizQuestionUI: Identifiable, Codable, Sendable {
    public let id: String
    public var type: QuizQuestionType
    public var question: String
    public var options: [String]?
    public var correctAnswer: [String]
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
    public var questions: [QuizQuestionUI]
    public var passingScore: Int
    public var allowRetakes: Bool
    public var maxAttempts: Int?
    public var shuffleQuestions: Bool
    public var shuffleOptions: Bool
    public var showCorrectAfter: Bool
    public var timeLimitMinutes: Int?

    public init(
        questions: [QuizQuestionUI],
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
    public var duration: Int
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

// MARK: - Lesson (UI-layer with Date fields)

/// Lesson - individual learning unit
public struct LessonUI: Identifiable, Codable, Sendable {
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

// MARK: - Progress Types (UI-only, with Date fields)

/// User progress on a lesson
public struct LessonProgress: Identifiable, Codable, Sendable {
    public let id: String
    public var lessonId: String
    public var pubkey: String
    public var status: ProgressStatus
    public var score: Int?
    public var timeSpent: Int
    public var lastPosition: Int?
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

/// User progress on a course (UI-layer with Date fields)
public struct CourseProgressUI: Identifiable, Codable, Sendable {
    public let id: String
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
    public var score: Int
    public var passed: Bool
    public var startedAt: Date
    public var completedAt: Date
    public var duration: Int

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

// MARK: - Certification (UI-layer with Date fields and validation helpers)

/// Certification record (UI-layer with Date fields)
public struct CertificationUI: Identifiable, Codable, Sendable {
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

    public var isValid: Bool {
        if revokedAt != nil { return false }
        if let expiresAt = expiresAt, expiresAt < Date() { return false }
        return true
    }

    public var isExpiringSoon: Bool {
        guard let expiresAt = expiresAt else { return false }
        let thirtyDays = TimeInterval(30 * 24 * 60 * 60)
        return expiresAt > Date() && expiresAt < Date().addingTimeInterval(thirtyDays)
    }
}

/// Certification verification result
public struct CertificationVerification: Sendable {
    public var valid: Bool
    public var certification: CertificationUI?
    public var holderName: String?
    public var expired: Bool?
    public var revoked: Bool?
    public var error: String?

    public init(
        valid: Bool,
        certification: CertificationUI? = nil,
        holderName: String? = nil,
        expired: Bool? = nil,
        revoked: Bool? = nil,
        error: String? = nil
    ) {
        self.valid = valid
        self.certification = certification
        self.holderName = holderName
        self.expired = expired
        self.revoked = revoked
        self.error = error
    }
}

// MARK: - Stats Types (UI-only)

/// Course statistics
public struct CourseStats: Sendable {
    public var courseId: String
    public var enrolledCount: Int
    public var completedCount: Int
    public var averageProgress: Int
    public var averageCompletionTime: Double
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
    public var totalTimeSpent: Int
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

// MARK: - Live Session Types (UI-only)

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
    public var duration: Int
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
