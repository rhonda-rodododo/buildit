// TrainingCRMIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration between Training and CRM modules for linking certifications to contacts.

import Foundation
import os.log

/// Contact training information
public struct ContactTrainingInfo: Sendable {
    public var contactId: String
    public var pubkey: String
    public var enrolledCourses: Int
    public var completedCourses: Int
    public var certifications: [Certification]
    public var certificationsExpiring: [Certification]
    public var totalTimeSpent: Int // hours
    public var lastActivity: Date?

    public init(
        contactId: String,
        pubkey: String,
        enrolledCourses: Int = 0,
        completedCourses: Int = 0,
        certifications: [Certification] = [],
        certificationsExpiring: [Certification] = [],
        totalTimeSpent: Int = 0,
        lastActivity: Date? = nil
    ) {
        self.contactId = contactId
        self.pubkey = pubkey
        self.enrolledCourses = enrolledCourses
        self.completedCourses = completedCourses
        self.certifications = certifications
        self.certificationsExpiring = certificationsExpiring
        self.totalTimeSpent = totalTimeSpent
        self.lastActivity = lastActivity
    }
}

/// Training requirement for volunteer roles
public struct TrainingRequirement: Sendable {
    public var courseId: String
    public var courseName: String
    public var required: Bool
    public var currentlyMet: Bool
    public var certificationExpired: Bool?
    public var certificationExpiresAt: Date?

    public init(
        courseId: String,
        courseName: String,
        required: Bool,
        currentlyMet: Bool,
        certificationExpired: Bool? = nil,
        certificationExpiresAt: Date? = nil
    ) {
        self.courseId = courseId
        self.courseName = courseName
        self.required = required
        self.currentlyMet = currentlyMet
        self.certificationExpired = certificationExpired
        self.certificationExpiresAt = certificationExpiresAt
    }
}

/// Training requirements check result
public struct TrainingRequirementsResult: Sendable {
    public var met: Bool
    public var requirements: [TrainingRequirement]

    public init(met: Bool, requirements: [TrainingRequirement]) {
        self.met = met
        self.requirements = requirements
    }
}

/// Contact with expiring certification
public struct ExpiringCertificationInfo: Sendable {
    public var pubkey: String
    public var certification: Certification
    public var course: Course?

    public init(pubkey: String, certification: Certification, course: Course? = nil) {
        self.pubkey = pubkey
        self.certification = certification
        self.course = course
    }
}

/// Integration between Training and CRM modules
@MainActor
public class TrainingCRMIntegration {
    // MARK: - Properties

    private let manager: TrainingManager
    private let logger = Logger(subsystem: "com.buildit", category: "TrainingCRMIntegration")

    // MARK: - Initialization

    public init(manager: TrainingManager) {
        self.manager = manager
    }

    // MARK: - Certification Management

    /// Add certification to a CRM contact record
    public func addCertificationToContact(
        contactId: String,
        certification: Certification
    ) async throws {
        // In a real implementation, this would update the CRM contact record
        // with the certification information
        logger.info("Adding certification \(certification.id) to contact \(contactId)")

        // Would store in CRM custom fields
        // This would interact with the database module/CRM module
    }

    /// Get training status for a CRM contact
    public func getContactTrainingStatus(
        contactId: String,
        pubkey: String
    ) async throws -> ContactTrainingInfo {
        let status = try await manager.getUserTrainingStatus(pubkey: pubkey)
        let certifications = try await manager.listCertifications(pubkey: pubkey)

        let now = Date()
        let thirtyDays = TimeInterval(30 * 24 * 60 * 60)
        let validCertifications = certifications.filter { $0.isValid }
        let expiringSoon = certifications.filter { cert in
            guard let expiresAt = cert.expiresAt else { return false }
            return expiresAt > now && expiresAt < now.addingTimeInterval(thirtyDays) && cert.revokedAt == nil
        }

        return ContactTrainingInfo(
            contactId: contactId,
            pubkey: pubkey,
            enrolledCourses: status.coursesEnrolled,
            completedCourses: status.coursesCompleted,
            certifications: validCertifications,
            certificationsExpiring: expiringSoon,
            totalTimeSpent: status.totalTimeSpent,
            lastActivity: status.lastActivity
        )
    }

    /// Filter CRM contacts by certification
    public func filterContactsByCertification(
        courseId: String,
        includeExpired: Bool = false
    ) async throws -> [String] {
        let certifications = try await manager.listCertifications()

        let now = Date()
        let filtered = certifications.filter { cert in
            if cert.courseId != courseId { return false }
            if cert.revokedAt != nil { return false }
            if !includeExpired {
                if let expiresAt = cert.expiresAt, expiresAt < now { return false }
            }
            return true
        }

        // Return unique pubkeys
        return Array(Set(filtered.map { $0.pubkey }))
    }

    /// Check training requirements for a contact
    public func checkTrainingRequirements(
        pubkey: String,
        requiredCourseIds: [String]
    ) async throws -> TrainingRequirementsResult {
        let certifications = try await manager.listCertifications(pubkey: pubkey)
        let now = Date()

        var requirements: [TrainingRequirement] = []
        var allMet = true

        for courseId in requiredCourseIds {
            let course = try await manager.getCourse(id: courseId)
            let cert = certifications.first { $0.courseId == courseId && $0.revokedAt == nil }

            let expired: Bool
            if let expiresAt = cert?.expiresAt {
                expired = expiresAt < now
            } else {
                expired = false
            }

            let met = cert != nil && !expired

            if !met {
                allMet = false
            }

            requirements.append(TrainingRequirement(
                courseId: courseId,
                courseName: course?.title ?? "Unknown Course",
                required: true,
                currentlyMet: met,
                certificationExpired: expired,
                certificationExpiresAt: cert?.expiresAt
            ))
        }

        return TrainingRequirementsResult(met: allMet, requirements: requirements)
    }

    /// Get contacts with expiring certifications
    public func getContactsWithExpiringCertifications(
        daysThreshold: Int = 30
    ) async throws -> [ExpiringCertificationInfo] {
        let certifications = try await manager.listCertifications()

        let now = Date()
        let threshold = TimeInterval(daysThreshold * 24 * 60 * 60)

        let expiring = certifications.filter { cert in
            guard let expiresAt = cert.expiresAt else { return false }
            return expiresAt > now && expiresAt < now.addingTimeInterval(threshold) && cert.revokedAt == nil
        }

        var results: [ExpiringCertificationInfo] = []
        for cert in expiring {
            let course = try await manager.getCourse(id: cert.courseId)
            results.append(ExpiringCertificationInfo(
                pubkey: cert.pubkey,
                certification: cert,
                course: course
            ))
        }

        return results
    }

    /// Send certification reminders to contacts
    public func sendCertificationReminders(
        pubkeys: [String],
        courseId: String,
        message: String
    ) async throws {
        // In a real implementation, this would send notifications via the messaging module
        logger.info("Sending certification reminders to \(pubkeys.count) contacts for course \(courseId)")

        // Would integrate with messaging/notifications module
    }

    /// Check if CRM module is available
    public func isCRMModuleAvailable() async -> Bool {
        // In a real implementation, would check if CRM module is enabled
        return true
    }

    /// Sync certification data to CRM
    /// Called when certifications are earned/revoked
    public func syncCertificationToCRM(certification: Certification) async throws {
        let course = try await manager.getCourse(id: certification.courseId)

        logger.info("Syncing certification \(certification.id) (\(course?.title ?? "Unknown")) to CRM for \(certification.pubkey)")

        // Would update CRM custom fields with:
        // - Certification earned date
        // - Certification expiry date
        // - Course name
        // - Verification code
    }

    /// Get all certified contacts for a course
    public func getCertifiedContacts(courseId: String) async throws -> [String] {
        try await filterContactsByCertification(courseId: courseId, includeExpired: false)
    }

    /// Get training completion rate for a group
    public func getGroupTrainingCompletion(
        groupId: String,
        courseId: String
    ) async throws -> (enrolled: Int, completed: Int, certified: Int) {
        // In a real implementation, this would query CRM and training data
        // to get completion statistics for all contacts in a group

        logger.info("Getting training completion for group \(groupId), course \(courseId)")

        return (enrolled: 0, completed: 0, certified: 0)
    }

    /// Bulk enroll contacts in a course
    public func bulkEnrollContacts(
        contactPubkeys: [String],
        courseId: String
    ) async throws {
        // In a real implementation, would create enrollments for all specified contacts
        logger.info("Bulk enrolling \(contactPubkeys.count) contacts in course \(courseId)")
    }

    /// Generate training report for CRM
    public func generateTrainingReport(
        groupId: String?,
        startDate: Date,
        endDate: Date
    ) async throws -> TrainingReport {
        // In a real implementation, would aggregate training data for the period

        return TrainingReport(
            groupId: groupId,
            startDate: startDate,
            endDate: endDate,
            totalEnrollments: 0,
            totalCompletions: 0,
            certificationIssued: 0,
            certificationsRevoked: 0,
            averageCompletionTime: 0,
            courseStats: []
        )
    }
}

/// Training report data
public struct TrainingReport: Sendable {
    public var groupId: String?
    public var startDate: Date
    public var endDate: Date
    public var totalEnrollments: Int
    public var totalCompletions: Int
    public var certificationIssued: Int
    public var certificationsRevoked: Int
    public var averageCompletionTime: Double // hours
    public var courseStats: [CourseReportStats]

    public init(
        groupId: String? = nil,
        startDate: Date,
        endDate: Date,
        totalEnrollments: Int,
        totalCompletions: Int,
        certificationIssued: Int,
        certificationsRevoked: Int,
        averageCompletionTime: Double,
        courseStats: [CourseReportStats]
    ) {
        self.groupId = groupId
        self.startDate = startDate
        self.endDate = endDate
        self.totalEnrollments = totalEnrollments
        self.totalCompletions = totalCompletions
        self.certificationIssued = certificationIssued
        self.certificationsRevoked = certificationsRevoked
        self.averageCompletionTime = averageCompletionTime
        self.courseStats = courseStats
    }
}

/// Per-course statistics in a report
public struct CourseReportStats: Sendable {
    public var courseId: String
    public var courseName: String
    public var enrollments: Int
    public var completions: Int
    public var certifications: Int

    public init(
        courseId: String,
        courseName: String,
        enrollments: Int,
        completions: Int,
        certifications: Int
    ) {
        self.courseId = courseId
        self.courseName = courseName
        self.enrollments = enrollments
        self.completions = completions
        self.certifications = certifications
    }
}
