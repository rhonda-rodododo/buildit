// TrainingModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Training module for courses, lessons, certifications, and live training sessions.

import Foundation
import SwiftUI
import os.log

/// Training module implementation
@MainActor
public final class TrainingModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "training"
    public static let version = "1.0.0"
    public static let dependencies: [String] = []

    // MARK: - Properties

    private let store: TrainingStore
    private let manager: TrainingManager
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingModule")

    // MARK: - Integrations

    private lazy var callingIntegration = TrainingCallingIntegration(manager: manager)
    private lazy var crmIntegration = TrainingCRMIntegration(manager: manager)
    private lazy var eventsIntegration = TrainingEventsIntegration(manager: manager)

    // MARK: - Initialization

    public init() throws {
        self.store = try TrainingStore()
        self.manager = TrainingManager(store: store)
        logger.info("Training module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Training module")

        // Enable by default for global scope
        try await enable(for: nil)

        // Load initial data
        await store.loadCourses()
        await store.loadCertifications()

        logger.info("Training module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route training-related Nostr events to manager
        await manager.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "training-courses",
                title: "Training",
                icon: "book.fill",
                order: 45
            ) {
                CourseListView(store: store, manager: manager)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up Training module")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Training module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Training module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API - Courses

    /// Get all available courses
    public func getCourses(groupId: String? = nil) async throws -> [Course] {
        try await manager.listCourses(groupId: groupId)
    }

    /// Get a specific course
    public func getCourse(id: String) async throws -> Course? {
        try await manager.getCourse(id: id)
    }

    /// Create a new course
    public func createCourse(data: CreateCourseData) async throws -> Course {
        try await manager.createCourse(data: data)
    }

    /// Update an existing course
    public func updateCourse(_ courseId: String, data: UpdateCourseData) async throws -> Course {
        try await manager.updateCourse(courseId, data: data)
    }

    /// Delete a course
    public func deleteCourse(_ courseId: String) async throws {
        try await manager.deleteCourse(courseId)
    }

    /// Publish a course
    public func publishCourse(_ courseId: String) async throws {
        try await manager.publishCourse(courseId)
    }

    // MARK: - Public API - Modules

    /// Create a training module within a course
    public func createModule(data: CreateModuleData) async throws -> TrainingModuleModel {
        try await manager.createModule(data: data)
    }

    /// Get modules for a course
    public func getModules(courseId: String) async throws -> [TrainingModuleModel] {
        try await manager.listModules(courseId: courseId)
    }

    // MARK: - Public API - Lessons

    /// Create a lesson within a module
    public func createLesson(data: CreateLessonData) async throws -> Lesson {
        try await manager.createLesson(data: data)
    }

    /// Get lessons for a module
    public func getLessons(moduleId: String) async throws -> [Lesson] {
        try await manager.listLessons(moduleId: moduleId)
    }

    /// Start a lesson
    public func startLesson(_ lessonId: String) async throws {
        try await manager.startLesson(lessonId)
    }

    /// Complete a lesson
    public func completeLesson(_ lessonId: String, score: Int? = nil) async throws {
        try await manager.completeLesson(lessonId, score: score)
    }

    // MARK: - Public API - Progress

    /// Get course progress for current user
    public func getCourseProgress(_ courseId: String) async throws -> CourseProgress? {
        try await manager.getCourseProgress(courseId)
    }

    /// Get overall training status for a user
    public func getUserTrainingStatus(pubkey: String) async throws -> UserTrainingStatus {
        try await manager.getUserTrainingStatus(pubkey: pubkey)
    }

    // MARK: - Public API - Certifications

    /// Get certifications for current user
    public func getCertifications() async throws -> [Certification] {
        try await manager.listCertifications()
    }

    /// Verify a certification by code
    public func verifyCertification(code: String) async throws -> CertificationVerification {
        try await manager.verifyCertification(code: code)
    }

    // MARK: - Public API - Integrations

    /// Get the calling integration
    public var calling: TrainingCallingIntegration {
        callingIntegration
    }

    /// Get the CRM integration
    public var crm: TrainingCRMIntegration {
        crmIntegration
    }

    /// Get the events integration
    public var events: TrainingEventsIntegration {
        eventsIntegration
    }
}
