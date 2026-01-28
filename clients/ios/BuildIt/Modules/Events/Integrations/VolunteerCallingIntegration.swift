// VolunteerCallingIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration for volunteer signup flows with calling capabilities.
// Handles hotline access, operator pools, and shift management.

import Foundation
import Combine
import os.log

// MARK: - Volunteer Calling Role

/// Calling role types for volunteer positions
public enum VolunteerCallingRole: String, Codable, Sendable, CaseIterable {
    case hotlineOperator = "hotline-operator"
    case dispatcher
    case medic
    case coordinator
    case lead

    public var displayName: String {
        switch self {
        case .hotlineOperator:
            return "Hotline Operator"
        case .dispatcher:
            return "Dispatcher"
        case .medic:
            return "Medic"
        case .coordinator:
            return "Coordinator"
        case .lead:
            return "Lead"
        }
    }

    public var icon: String {
        switch self {
        case .hotlineOperator:
            return "phone.fill"
        case .dispatcher:
            return "antenna.radiowaves.left.and.right"
        case .medic:
            return "cross.fill"
        case .coordinator:
            return "person.3.fill"
        case .lead:
            return "star.fill"
        }
    }

    public var description: String {
        switch self {
        case .hotlineOperator:
            return "Answer and handle incoming calls"
        case .dispatcher:
            return "Coordinate call routing and resources"
        case .medic:
            return "Provide medical guidance and support"
        case .coordinator:
            return "Oversee operations and volunteers"
        case .lead:
            return "Lead and manage the calling team"
        }
    }
}

// MARK: - Training Requirement Status

/// Status of a training requirement for a volunteer
public struct TrainingRequirementStatus: Sendable, Codable, Identifiable {
    public let id: String
    public let courseId: String
    public let courseName: String
    public let required: Bool
    public let met: Bool
    public let certificationExpired: Bool?
    public let expiresAt: Date?

    public init(
        courseId: String,
        courseName: String,
        required: Bool,
        met: Bool,
        certificationExpired: Bool? = nil,
        expiresAt: Date? = nil
    ) {
        self.id = courseId
        self.courseId = courseId
        self.courseName = courseName
        self.required = required
        self.met = met
        self.certificationExpired = certificationExpired
        self.expiresAt = expiresAt
    }

    public var isCritical: Bool {
        required && !met
    }
}

// MARK: - Volunteer Requirements Result

/// Result of checking volunteer requirements
public struct VolunteerRequirementsResult: Sendable {
    public let met: Bool
    public let missingTrainings: [TrainingRequirementStatus]
    public let missingCallingAccess: Bool
    public let callingRoleRequired: VolunteerCallingRole?
    public let message: String?

    public init(
        met: Bool,
        missingTrainings: [TrainingRequirementStatus] = [],
        missingCallingAccess: Bool = false,
        callingRoleRequired: VolunteerCallingRole? = nil,
        message: String? = nil
    ) {
        self.met = met
        self.missingTrainings = missingTrainings
        self.missingCallingAccess = missingCallingAccess
        self.callingRoleRequired = callingRoleRequired
        self.message = message
    }

    public static var requirementsMet: VolunteerRequirementsResult {
        VolunteerRequirementsResult(met: true)
    }
}

// MARK: - Shift Configuration

/// Configuration for operator pool shifts
public struct ShiftConfig: Codable, Sendable, Identifiable, Equatable {
    public var id: String { "\(hotlineId)-\(Int(startTime.timeIntervalSince1970))" }
    public let hotlineId: String
    public let startTime: Date
    public let endTime: Date
    public let role: VolunteerCallingRole
    public let isRecurring: Bool?
    public let recurringPattern: RecurringPattern?

    public init(
        hotlineId: String,
        startTime: Date,
        endTime: Date,
        role: VolunteerCallingRole,
        isRecurring: Bool? = nil,
        recurringPattern: RecurringPattern? = nil
    ) {
        self.hotlineId = hotlineId
        self.startTime = startTime
        self.endTime = endTime
        self.role = role
        self.isRecurring = isRecurring
        self.recurringPattern = recurringPattern
    }

    public var duration: TimeInterval {
        endTime.timeIntervalSince(startTime)
    }

    public var formattedDuration: String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        return hours > 0 ? "\(hours)h \(minutes)m" : "\(minutes)m"
    }

    /// Check if this shift covers a given time
    public func covers(time: Date) -> Bool {
        time >= startTime && time <= endTime
    }
}

// MARK: - Recurring Pattern

/// Pattern for recurring shifts
public enum RecurringPattern: String, Codable, Sendable, CaseIterable {
    case daily
    case weekly
    case monthly

    public var displayName: String {
        switch self {
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        }
    }
}

// MARK: - Operator Status

/// Status of an operator in the pool
public enum OperatorStatus: String, Codable, Sendable, CaseIterable {
    case active
    case inactive
    case suspended

    public var displayName: String {
        switch self {
        case .active: return "Active"
        case .inactive: return "Inactive"
        case .suspended: return "Suspended"
        }
    }

    public var color: String {
        switch self {
        case .active: return "green"
        case .inactive: return "gray"
        case .suspended: return "red"
        }
    }
}

// MARK: - Operator Pool Entry

/// Entry in the operator pool for a hotline
public struct OperatorPoolEntry: Sendable, Identifiable, Codable {
    public var id: String { "\(hotlineId)-\(pubkey)" }
    public let pubkey: String
    public let contactId: String
    public let hotlineId: String
    public let role: VolunteerCallingRole
    public var shifts: [ShiftConfig]
    public let addedAt: Date
    public let addedBy: String
    public var status: OperatorStatus

    public init(
        pubkey: String,
        contactId: String,
        hotlineId: String,
        role: VolunteerCallingRole,
        shifts: [ShiftConfig] = [],
        addedAt: Date = Date(),
        addedBy: String,
        status: OperatorStatus = .active
    ) {
        self.pubkey = pubkey
        self.contactId = contactId
        self.hotlineId = hotlineId
        self.role = role
        self.shifts = shifts
        self.addedAt = addedAt
        self.addedBy = addedBy
        self.status = status
    }

    /// Check if operator is available at a given time
    public func isAvailable(at time: Date) -> Bool {
        guard status == .active else { return false }
        return shifts.contains { $0.covers(time: time) }
    }

    /// Get current shift if any
    public func currentShift(at time: Date = Date()) -> ShiftConfig? {
        shifts.first { $0.covers(time: time) }
    }
}

// MARK: - Signup Confirmation Result

/// Result of processing a volunteer signup confirmation
public struct SignupConfirmationResult: Sendable {
    public let accessGranted: Bool
    public let message: String

    public init(accessGranted: Bool, message: String) {
        self.accessGranted = accessGranted
        self.message = message
    }
}

// MARK: - Event Volunteer Role Extension

/// Extension to add calling-related properties to EventVolunteerRole
public struct EventVolunteerRole: Codable, Sendable, Identifiable {
    public let id: String
    public let eventId: String
    public let name: String
    public let description: String?
    public let spotsNeeded: Int
    public var spotsFilled: Int
    public let requiredTrainings: [String]?
    public let shiftStart: Date?
    public let shiftEnd: Date?
    public let created: Date
    public let createdBy: String

    // Calling requirements
    public let callingRoleRequired: VolunteerCallingRole?
    public let hotlineAccess: [String]?
    public let requiresPSTN: Bool?

    public init(
        id: String,
        eventId: String,
        name: String,
        description: String? = nil,
        spotsNeeded: Int,
        spotsFilled: Int = 0,
        requiredTrainings: [String]? = nil,
        shiftStart: Date? = nil,
        shiftEnd: Date? = nil,
        created: Date = Date(),
        createdBy: String,
        callingRoleRequired: VolunteerCallingRole? = nil,
        hotlineAccess: [String]? = nil,
        requiresPSTN: Bool? = nil
    ) {
        self.id = id
        self.eventId = eventId
        self.name = name
        self.description = description
        self.spotsNeeded = spotsNeeded
        self.spotsFilled = spotsFilled
        self.requiredTrainings = requiredTrainings
        self.shiftStart = shiftStart
        self.shiftEnd = shiftEnd
        self.created = created
        self.createdBy = createdBy
        self.callingRoleRequired = callingRoleRequired
        self.hotlineAccess = hotlineAccess
        self.requiresPSTN = requiresPSTN
    }

    public var hasCallingRequirements: Bool {
        callingRoleRequired != nil || (hotlineAccess?.isEmpty == false)
    }

    public var spotsRemaining: Int {
        max(0, spotsNeeded - spotsFilled)
    }

    public var isFilled: Bool {
        spotsFilled >= spotsNeeded
    }
}

// MARK: - Event Volunteer Signup

/// Volunteer signup for an event role
public struct EventVolunteerSignup: Codable, Sendable, Identifiable {
    public let id: String
    public let eventId: String
    public let roleId: String
    public let contactId: String
    public let contactPubkey: String?
    public var status: VolunteerSignupStatus
    public let signupTime: Date
    public var confirmedBy: String?
    public var notes: String?
    public let created: Date
    public var updated: Date

    public init(
        id: String,
        eventId: String,
        roleId: String,
        contactId: String,
        contactPubkey: String? = nil,
        status: VolunteerSignupStatus = .pending,
        signupTime: Date = Date(),
        confirmedBy: String? = nil,
        notes: String? = nil,
        created: Date = Date(),
        updated: Date = Date()
    ) {
        self.id = id
        self.eventId = eventId
        self.roleId = roleId
        self.contactId = contactId
        self.contactPubkey = contactPubkey
        self.status = status
        self.signupTime = signupTime
        self.confirmedBy = confirmedBy
        self.notes = notes
        self.created = created
        self.updated = updated
    }
}

// MARK: - Volunteer Signup Status

/// Status of a volunteer signup
public enum VolunteerSignupStatus: String, Codable, Sendable, CaseIterable {
    case pending
    case confirmed
    case declined
    case noShow = "no-show"

    public var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .confirmed: return "Confirmed"
        case .declined: return "Declined"
        case .noShow: return "No Show"
        }
    }

    public var icon: String {
        switch self {
        case .pending: return "clock"
        case .confirmed: return "checkmark.circle"
        case .declined: return "xmark.circle"
        case .noShow: return "person.crop.circle.badge.exclamationmark"
        }
    }
}

// MARK: - Volunteer Calling Integration

/// Integration for volunteer signup flows with calling capabilities
@MainActor
public class VolunteerCallingIntegration: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var operatorPools: [String: [OperatorPoolEntry]] = [:] // hotlineId -> entries
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let callingStore: CallingStore
    private let eventsStore: EventsStore
    private let logger = Logger(subsystem: "com.buildit", category: "VolunteerCallingIntegration")

    // MARK: - Initialization

    public init(callingStore: CallingStore, eventsStore: EventsStore) {
        self.callingStore = callingStore
        self.eventsStore = eventsStore
    }

    // MARK: - Requirements Checking

    /// Check if volunteer meets requirements for a role
    /// - Parameters:
    ///   - contactId: CRM contact ID
    ///   - pubkey: User's pubkey
    ///   - role: Volunteer role to check
    /// - Returns: Requirements check result
    public func checkRequirements(
        contactId: String,
        pubkey: String,
        role: EventVolunteerRole
    ) async throws -> VolunteerRequirementsResult {
        var missingTrainings: [TrainingRequirementStatus] = []
        var missingCallingAccess = false

        // Check training requirements
        if let requiredTrainings = role.requiredTrainings, !requiredTrainings.isEmpty {
            for courseId in requiredTrainings {
                // In production, would check training module for certification
                // let certification = try await trainingManager.getCertification(pubkey: pubkey, courseId: courseId)

                // Placeholder - assume not met for demo
                missingTrainings.append(TrainingRequirementStatus(
                    courseId: courseId,
                    courseName: "Training \(courseId)", // Would fetch actual name
                    required: true,
                    met: false
                ))
            }
        }

        // Check calling access requirements
        if role.callingRoleRequired != nil {
            // In production, would check calling module for access
            // let hasAccess = await callingStore.checkRoleAccess(pubkey: pubkey, role: role.callingRoleRequired!)

            // Placeholder
            missingCallingAccess = true
        }

        // Filter to only actually missing trainings
        let actuallyMissing = missingTrainings.filter { !$0.met }

        let met = actuallyMissing.isEmpty && !missingCallingAccess

        var message: String?
        if !met {
            var issues: [String] = []
            if !actuallyMissing.isEmpty {
                issues.append("\(actuallyMissing.count) required training(s) not completed")
            }
            if missingCallingAccess, let callingRole = role.callingRoleRequired {
                issues.append("\(callingRole.displayName) access not granted")
            }
            message = issues.joined(separator: ", ")
        }

        logger.info("Checked volunteer requirements for \(contactId)")
        logger.info("Role: \(role.id), Met: \(met), Missing trainings: \(actuallyMissing.count), Missing calling access: \(missingCallingAccess)")

        return VolunteerRequirementsResult(
            met: met,
            missingTrainings: actuallyMissing,
            missingCallingAccess: missingCallingAccess,
            callingRoleRequired: role.callingRoleRequired,
            message: message
        )
    }

    // MARK: - Hotline Access Management

    /// Grant hotline access when volunteer signup is confirmed
    /// - Parameters:
    ///   - contactId: CRM contact ID
    ///   - pubkey: User's pubkey
    ///   - hotlineIds: Hotline IDs to grant access to
    ///   - role: Calling role
    ///   - grantedBy: Pubkey of admin granting access
    public func grantHotlineAccess(
        contactId: String,
        pubkey: String,
        hotlineIds: [String],
        role: VolunteerCallingRole,
        grantedBy: String
    ) async throws {
        for hotlineId in hotlineIds {
            // Check if already has access
            if getOperatorPoolEntry(hotlineId: hotlineId, pubkey: pubkey) != nil {
                logger.info("Volunteer \(contactId) already has access to hotline \(hotlineId)")
                continue
            }

            // Create operator pool entry
            let entry = OperatorPoolEntry(
                pubkey: pubkey,
                contactId: contactId,
                hotlineId: hotlineId,
                role: role,
                shifts: [],
                addedAt: Date(),
                addedBy: grantedBy,
                status: .active
            )

            // Add to pool
            var pool = operatorPools[hotlineId] ?? []
            pool.append(entry)
            operatorPools[hotlineId] = pool

            logger.info("Granted hotline access to volunteer")
            logger.info("Contact: \(contactId), Pubkey: \(pubkey), Hotline: \(hotlineId), Role: \(role.rawValue)")

            // In production, would:
            // 1. Update calling module permissions
            // 2. Send notification to volunteer
            // 3. Persist to SwiftData
        }
    }

    /// Revoke hotline access
    /// - Parameters:
    ///   - pubkey: User's pubkey
    ///   - hotlineId: Hotline ID
    ///   - reason: Optional reason for revocation
    public func revokeHotlineAccess(
        pubkey: String,
        hotlineId: String,
        reason: String? = nil
    ) async throws {
        guard var pool = operatorPools[hotlineId] else { return }

        if let index = pool.firstIndex(where: { $0.pubkey == pubkey }) {
            pool.remove(at: index)
            operatorPools[hotlineId] = pool

            logger.info("Revoked hotline access")
            logger.info("Pubkey: \(pubkey), Hotline: \(hotlineId), Reason: \(reason ?? "none")")
        }
    }

    // MARK: - Operator Pool Management

    /// Add volunteer to operator pool for specific shifts
    /// - Parameters:
    ///   - contactId: CRM contact ID
    ///   - pubkey: User's pubkey
    ///   - hotlineId: Hotline ID
    ///   - shifts: Shifts to add
    public func addToOperatorPool(
        contactId: String,
        pubkey: String,
        hotlineId: String,
        shifts: [ShiftConfig]
    ) async throws {
        guard var pool = operatorPools[hotlineId],
              let index = pool.firstIndex(where: { $0.pubkey == pubkey }) else {
            logger.warning("Volunteer \(contactId) not in operator pool for \(hotlineId)")
            return
        }

        // Add shifts to existing entry
        var entry = pool[index]
        entry.shifts.append(contentsOf: shifts)
        pool[index] = entry
        operatorPools[hotlineId] = pool

        logger.info("Added shifts for volunteer")
        logger.info("Contact: \(contactId), Hotline: \(hotlineId), Shift count: \(shifts.count)")

        // In production, would:
        // 1. Update scheduler
        // 2. Send shift confirmation to volunteer
    }

    /// Remove shifts from operator
    /// - Parameters:
    ///   - pubkey: User's pubkey
    ///   - hotlineId: Hotline ID
    ///   - shiftIds: Specific shift IDs to remove (nil = all)
    public func removeFromOperatorPool(
        pubkey: String,
        hotlineId: String,
        shiftIds: [String]? = nil
    ) async throws {
        guard var pool = operatorPools[hotlineId],
              let index = pool.firstIndex(where: { $0.pubkey == pubkey }) else {
            return
        }

        var entry = pool[index]

        if let shiftIds = shiftIds {
            // Remove specific shifts
            entry.shifts = entry.shifts.filter { !shiftIds.contains($0.id) }
        } else {
            // Remove all shifts
            entry.shifts = []
        }

        pool[index] = entry
        operatorPools[hotlineId] = pool

        logger.info("Removed shifts from volunteer")
        logger.info("Pubkey: \(pubkey), Hotline: \(hotlineId)")
    }

    // MARK: - Operator Pool Queries

    /// Get operator pool entry
    /// - Parameters:
    ///   - hotlineId: Hotline ID
    ///   - pubkey: User's pubkey
    /// - Returns: Operator pool entry if found
    public func getOperatorPoolEntry(
        hotlineId: String,
        pubkey: String
    ) -> OperatorPoolEntry? {
        operatorPools[hotlineId]?.first { $0.pubkey == pubkey }
    }

    /// Get all operators for a hotline
    /// - Parameter hotlineId: Hotline ID
    /// - Returns: List of operators
    public func getHotlineOperators(hotlineId: String) -> [OperatorPoolEntry] {
        operatorPools[hotlineId] ?? []
    }

    /// Get available operators for a time slot
    /// - Parameters:
    ///   - hotlineId: Hotline ID
    ///   - time: Time to check availability
    /// - Returns: List of available operators
    public func getAvailableOperators(
        hotlineId: String,
        time: Date
    ) -> [OperatorPoolEntry] {
        let pool = operatorPools[hotlineId] ?? []
        return pool.filter { $0.isAvailable(at: time) }
    }

    // MARK: - Signup Processing

    /// Process volunteer signup confirmation
    /// - Parameters:
    ///   - signup: Volunteer signup
    ///   - role: Volunteer role
    ///   - confirmedBy: Pubkey of admin confirming
    /// - Returns: Confirmation result
    public func processSignupConfirmation(
        signup: EventVolunteerSignup,
        role: EventVolunteerRole,
        confirmedBy: String
    ) async throws -> SignupConfirmationResult {
        // Check requirements
        let requirements = try await checkRequirements(
            contactId: signup.contactId,
            pubkey: signup.contactPubkey ?? "",
            role: role
        )

        if !requirements.met {
            return SignupConfirmationResult(
                accessGranted: false,
                message: requirements.message ?? "Requirements not met"
            )
        }

        // Grant hotline access if specified
        if let hotlineAccess = role.hotlineAccess,
           !hotlineAccess.isEmpty,
           let callingRole = role.callingRoleRequired,
           let pubkey = signup.contactPubkey {
            try await grantHotlineAccess(
                contactId: signup.contactId,
                pubkey: pubkey,
                hotlineIds: hotlineAccess,
                role: callingRole,
                grantedBy: confirmedBy
            )
        }

        // Add to operator pool for shifts if role has shift times
        if let shiftStart = role.shiftStart,
           let shiftEnd = role.shiftEnd,
           let hotlineAccess = role.hotlineAccess,
           let pubkey = signup.contactPubkey {
            for hotlineId in hotlineAccess {
                let shift = ShiftConfig(
                    hotlineId: hotlineId,
                    startTime: shiftStart,
                    endTime: shiftEnd,
                    role: role.callingRoleRequired ?? .hotlineOperator
                )

                try await addToOperatorPool(
                    contactId: signup.contactId,
                    pubkey: pubkey,
                    hotlineId: hotlineId,
                    shifts: [shift]
                )
            }
        }

        logger.info("Processed volunteer signup confirmation")
        logger.info("Signup: \(signup.id), Role: \(role.id), Contact: \(signup.contactId)")

        return SignupConfirmationResult(
            accessGranted: true,
            message: "Volunteer confirmed and access granted"
        )
    }

    // MARK: - Module Status

    /// Check if calling module is available
    public func isCallingModuleAvailable() async -> Bool {
        // In production, would check if calling module is enabled and configured
        return true
    }
}
