// CRMCallingIntegration.swift
// BuildIt - Decentralized Mesh Communication
//
// Integration between CRM and Calling modules for caller ID and call history.
// Provides phone lookup, automatic contact creation, and call logging.

import Foundation
import Combine
import os.log

// MARK: - CRM Calling Integration

/// Integration between CRM and Calling modules for caller ID and call history
@MainActor
public class CRMCallingIntegration: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var recentCalls: [CallHistoryRecord] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    // In-memory call history cache (would be persisted in SwiftData in production)
    private var callHistory: [String: [CallHistoryRecord]] = [:] // contactId -> records
    private var contacts: [String: CRMContact] = [:] // id -> contact
    private let logger = Logger(subsystem: "com.buildit", category: "CRMCallingIntegration")

    // MARK: - Initialization

    public init() {}

    // MARK: - Phone Lookup

    /// Look up contact by phone number
    /// - Parameters:
    ///   - phone: Phone number to search
    ///   - groupId: Optional group ID to limit search scope
    /// - Returns: Caller lookup result with contact info if found
    public func lookupByPhone(phone: String, groupId: String? = nil) async throws -> CallerLookupResult {
        let normalizedPhone = normalizePhoneNumber(phone)

        logger.info("Looking up contact by phone: \(normalizedPhone)")

        // Search in local cache first
        for contact in contacts.values {
            if let group = groupId, contact.groupId != group {
                continue
            }

            // Check all phone fields
            if let contactPhone = contact.phone, normalizePhoneNumber(contactPhone) == normalizedPhone {
                let calls = callHistory[contact.id] ?? []
                return CallerLookupResult(
                    found: true,
                    contact: contact,
                    matchedField: .phone,
                    previousCalls: calls.count,
                    lastCallDate: calls.max(by: { $0.startedAt < $1.startedAt })?.startedAt
                )
            }

            if let mobile = contact.mobile, normalizePhoneNumber(mobile) == normalizedPhone {
                let calls = callHistory[contact.id] ?? []
                return CallerLookupResult(
                    found: true,
                    contact: contact,
                    matchedField: .mobile,
                    previousCalls: calls.count,
                    lastCallDate: calls.max(by: { $0.startedAt < $1.startedAt })?.startedAt
                )
            }

            if let workPhone = contact.workPhone, normalizePhoneNumber(workPhone) == normalizedPhone {
                let calls = callHistory[contact.id] ?? []
                return CallerLookupResult(
                    found: true,
                    contact: contact,
                    matchedField: .workPhone,
                    previousCalls: calls.count,
                    lastCallDate: calls.max(by: { $0.startedAt < $1.startedAt })?.startedAt
                )
            }
        }

        // In production, would query SwiftData
        // let descriptor = FetchDescriptor<ContactEntity>(...)
        // let results = try modelContext.fetch(descriptor)

        return CallerLookupResult.notFound
    }

    // MARK: - Contact Creation

    /// Create contact from call
    /// - Parameters:
    ///   - data: Contact data from call
    ///   - groupId: Group to create contact in
    /// - Returns: Created contact
    public func createContactFromCall(
        data: CreateContactFromCallData,
        groupId: String
    ) async throws -> CRMContact {
        let normalizedPhone = normalizePhoneNumber(data.phoneNumber)

        logger.info("Creating contact from call: \(normalizedPhone)")

        let contact = CRMContact(
            id: "contact-\(UUID().uuidString)",
            tableId: "", // Would be set based on CRM template
            groupId: groupId,
            name: data.name ?? "Unknown Caller",
            phone: normalizedPhone,
            customFields: [
                "source": .string("inbound-call"),
                "sourceHotline": data.hotlineId.map { .string($0) } ?? .null,
                "firstContactDate": .int(Int(Date().timeIntervalSince1970)),
                "notes": data.notes.map { .string($0) } ?? .null
            ],
            createdBy: data.operatorPubkey ?? "system",
            updatedBy: data.operatorPubkey ?? "system"
        )

        // Store in cache
        contacts[contact.id] = contact

        // In production, would save to SwiftData
        // let entity = ContactEntity.from(contact)
        // modelContext.insert(entity)
        // try modelContext.save()

        logger.info("Created contact: \(contact.id)")

        return contact
    }

    // MARK: - Call Logging

    /// Log call interaction
    /// - Parameters:
    ///   - contactId: Contact ID to log call for
    ///   - call: Call data (without id/contactId/created)
    /// - Returns: Created call history record
    public func logCallInteraction(
        contactId: String,
        direction: CallDirection,
        phoneNumber: String,
        startedAt: Date,
        endedAt: Date? = nil,
        duration: Int = 0,
        status: CallStatus = .completed,
        recordingUrl: String? = nil,
        transcriptUrl: String? = nil,
        notes: String? = nil,
        operatorPubkey: String? = nil,
        hotlineId: String? = nil
    ) async throws -> CallHistoryRecord {
        let record = CallHistoryRecord(
            id: "call-\(UUID().uuidString)",
            contactId: contactId,
            direction: direction,
            phoneNumber: phoneNumber,
            startedAt: startedAt,
            endedAt: endedAt,
            duration: duration,
            status: status,
            recordingUrl: recordingUrl,
            transcriptUrl: transcriptUrl,
            notes: notes,
            operatorPubkey: operatorPubkey,
            hotlineId: hotlineId,
            created: Date()
        )

        // Store in memory cache
        var contactCalls = callHistory[contactId] ?? []
        contactCalls.append(record)
        callHistory[contactId] = contactCalls

        // Update recent calls
        updateRecentCalls()

        logger.info("Logged call interaction for contact: \(contactId)")
        logger.info("Direction: \(direction.rawValue), Duration: \(duration), Status: \(status.rawValue)")

        // In production, would save to SwiftData
        // let entity = CallHistoryEntity.from(record)
        // modelContext.insert(entity)
        // try modelContext.save()

        return record
    }

    // MARK: - Call History

    /// Get call history for contact
    /// - Parameters:
    ///   - contactId: Contact ID to get history for
    ///   - options: Filter/pagination options
    /// - Returns: List of call history records
    public func getContactCallHistory(
        contactId: String,
        options: CallHistoryOptions? = nil
    ) async throws -> [CallHistoryRecord] {
        var calls = callHistory[contactId] ?? []

        // Apply filters
        if let opts = options {
            if let direction = opts.direction {
                calls = calls.filter { $0.direction == direction }
            }

            if let dateFrom = opts.dateFrom {
                calls = calls.filter { $0.startedAt >= dateFrom }
            }

            if let dateTo = opts.dateTo {
                calls = calls.filter { $0.startedAt <= dateTo }
            }
        }

        // Sort by date descending (most recent first)
        calls.sort { $0.startedAt > $1.startedAt }

        // Apply pagination
        if let opts = options {
            if let offset = opts.offset {
                calls = Array(calls.dropFirst(offset))
            }

            if let limit = opts.limit {
                calls = Array(calls.prefix(limit))
            }
        }

        return calls
    }

    // MARK: - Engagement Score

    /// Update engagement score after call
    /// - Parameters:
    ///   - contactId: Contact ID
    ///   - callDuration: Duration of call in seconds
    ///   - direction: Call direction
    /// - Returns: Engagement update result
    public func updateEngagementFromCall(
        contactId: String,
        callDuration: Int,
        direction: CallDirection
    ) async throws -> CallEngagementUpdate {
        // Get current engagement score (would fetch from database)
        let previousScore = contacts[contactId]?.customFields["engagement_score"]?.intValue ?? 0

        // Calculate score increase based on call metrics
        var scoreIncrease = 0

        // Base points for having a call
        scoreIncrease += direction == .inbound ? 10 : 5

        // Additional points based on duration (capped)
        let durationMinutes = callDuration / 60
        scoreIncrease += min(durationMinutes * 2, 20)

        let newScore = previousScore + scoreIncrease

        logger.info("Updated engagement score for contact: \(contactId)")
        logger.info("Previous: \(previousScore), New: \(newScore), Change: \(scoreIncrease)")

        // In production, would update in database
        if var contact = contacts[contactId] {
            contact.customFields["engagement_score"] = .int(newScore)
            contacts[contactId] = contact
        }

        return CallEngagementUpdate(
            contactId: contactId,
            previousScore: previousScore,
            newScore: newScore,
            callDuration: callDuration,
            callDirection: direction
        )
    }

    // MARK: - Call Statistics

    /// Get call statistics for a contact
    /// - Parameter contactId: Contact ID
    /// - Returns: Call statistics
    public func getContactCallStats(contactId: String) async throws -> ContactCallStats {
        let calls = callHistory[contactId] ?? []

        guard !calls.isEmpty else {
            return ContactCallStats.empty
        }

        let inboundCalls = calls.filter { $0.direction == .inbound }.count
        let outboundCalls = calls.filter { $0.direction == .outbound }.count
        let totalDuration = calls.reduce(0) { $0 + $1.duration }
        let lastCallDate = calls.max(by: { $0.startedAt < $1.startedAt })?.startedAt
        let missedCalls = calls.filter { $0.status == .missed }.count

        return ContactCallStats(
            totalCalls: calls.count,
            inboundCalls: inboundCalls,
            outboundCalls: outboundCalls,
            totalDuration: totalDuration,
            averageDuration: totalDuration / calls.count,
            lastCallDate: lastCallDate,
            missedCalls: missedCalls
        )
    }

    // MARK: - Recent Calls

    /// Get recent calls across all contacts
    /// - Parameters:
    ///   - groupId: Optional group filter
    ///   - limit: Maximum number of calls to return
    /// - Returns: Recent call records
    public func getRecentCalls(
        groupId: String? = nil,
        limit: Int = 50
    ) async throws -> [CallHistoryRecord] {
        var allCalls: [CallHistoryRecord] = []

        for calls in callHistory.values {
            allCalls.append(contentsOf: calls)
        }

        // Filter by group if specified
        if let groupId = groupId {
            let groupContactIds = Set(contacts.values.filter { $0.groupId == groupId }.map { $0.id })
            allCalls = allCalls.filter { groupContactIds.contains($0.contactId) }
        }

        // Sort by date descending
        allCalls.sort { $0.startedAt > $1.startedAt }

        return Array(allCalls.prefix(limit))
    }

    // MARK: - Recording & Notes

    /// Link call recording to contact
    /// - Parameters:
    ///   - contactId: Contact ID
    ///   - callId: Call ID
    ///   - recordingUrl: URL of the recording
    ///   - transcriptUrl: Optional URL of the transcript
    public func linkCallRecording(
        contactId: String,
        callId: String,
        recordingUrl: String,
        transcriptUrl: String? = nil
    ) async throws {
        guard var contactCalls = callHistory[contactId],
              let index = contactCalls.firstIndex(where: { $0.id == callId }) else {
            logger.warning("Call not found: \(callId) for contact: \(contactId)")
            return
        }

        var record = contactCalls[index]
        record.recordingUrl = recordingUrl
        if let transcript = transcriptUrl {
            record.transcriptUrl = transcript
        }
        contactCalls[index] = record
        callHistory[contactId] = contactCalls

        logger.info("Linked recording to call: \(callId)")
    }

    /// Add notes to a call
    /// - Parameters:
    ///   - contactId: Contact ID
    ///   - callId: Call ID
    ///   - notes: Notes to add
    public func addCallNotes(
        contactId: String,
        callId: String,
        notes: String
    ) async throws {
        guard var contactCalls = callHistory[contactId],
              let index = contactCalls.firstIndex(where: { $0.id == callId }) else {
            logger.warning("Call not found: \(callId) for contact: \(contactId)")
            return
        }

        var record = contactCalls[index]
        record.notes = notes
        contactCalls[index] = record
        callHistory[contactId] = contactCalls

        logger.info("Added notes to call: \(callId)")
    }

    // MARK: - Contact Management

    /// Add contact to cache (for testing/initialization)
    public func addContact(_ contact: CRMContact) {
        contacts[contact.id] = contact
    }

    /// Get contact by ID
    public func getContact(id: String) -> CRMContact? {
        contacts[id]
    }

    // MARK: - Module Status

    /// Check if calling module is available
    public func isCallingModuleAvailable() async -> Bool {
        // In production, would check if calling module is enabled and configured
        return true
    }

    // MARK: - Private Helpers

    private func updateRecentCalls() {
        var allCalls: [CallHistoryRecord] = []
        for calls in callHistory.values {
            allCalls.append(contentsOf: calls)
        }
        allCalls.sort { $0.startedAt > $1.startedAt }
        recentCalls = Array(allCalls.prefix(50))
    }

    /// Normalize phone number for consistent lookup
    private func normalizePhoneNumber(_ phone: String) -> String {
        // Remove all non-digit characters except leading +
        let hasPlus = phone.hasPrefix("+")
        let digits = phone.filter { $0.isNumber }

        // For US numbers, ensure E.164 format
        if digits.count == 10 {
            return "+1\(digits)"
        }

        if digits.count == 11 && digits.hasPrefix("1") {
            return "+\(digits)"
        }

        // Return with + prefix if originally had it
        return hasPlus ? "+\(digits)" : digits
    }
}

// MARK: - Errors

/// Errors for CRM calling integration
public enum CRMCallingError: LocalizedError, Sendable {
    case contactNotFound
    case callNotFound
    case invalidPhoneNumber
    case callingModuleUnavailable

    public var errorDescription: String? {
        switch self {
        case .contactNotFound:
            return "Contact not found"
        case .callNotFound:
            return "Call record not found"
        case .invalidPhoneNumber:
            return "Invalid phone number format"
        case .callingModuleUnavailable:
            return "Calling module is not available"
        }
    }
}
