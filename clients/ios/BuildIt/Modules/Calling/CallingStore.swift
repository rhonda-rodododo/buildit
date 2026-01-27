// CallingStore.swift
// BuildIt - Decentralized Mesh Communication
//
// State management for the Calling module using SwiftData.

import Foundation
import SwiftData
import Combine
import os.log

/// Store for managing call data
@MainActor
public class CallingStore: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var callHistory: [CallHistoryEntity] = []
    @Published public private(set) var activeGroupCalls: [GroupCallEntity] = []
    @Published public private(set) var settings: CallSettingsEntity?
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    // MARK: - Private Properties

    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "CallingStore")

    // In-memory storage for temporary call data
    private var remoteSDP: [String: String] = [:]
    private var activeCallStates: [String: LocalCallState] = [:]

    // MARK: - Initialization

    public init() throws {
        let schema = Schema([
            CallHistoryEntity.self,
            GroupCallEntity.self,
            CallSettingsEntity.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [configuration])
        self.modelContext = ModelContext(modelContainer)

        loadData()
    }

    // MARK: - Data Loading

    private func loadData() {
        isLoading = true
        defer { isLoading = false }

        do {
            // Load call history
            let historyDescriptor = FetchDescriptor<CallHistoryEntity>(
                sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
            )
            callHistory = try modelContext.fetch(historyDescriptor)

            // Load active group calls
            let groupCallDescriptor = FetchDescriptor<GroupCallEntity>(
                predicate: #Predicate { $0.isActive }
            )
            activeGroupCalls = try modelContext.fetch(groupCallDescriptor)

            // Load settings
            let settingsDescriptor = FetchDescriptor<CallSettingsEntity>()
            settings = try modelContext.fetch(settingsDescriptor).first

            logger.info("Loaded \(self.callHistory.count) call history entries")
        } catch {
            logger.error("Failed to load call data: \(error.localizedDescription)")
            lastError = error.localizedDescription
        }
    }

    // MARK: - Call History Operations

    /// Save a call state to history
    public func saveCallState(_ state: LocalCallState) async throws {
        let entity = CallHistoryEntity.from(state)
        modelContext.insert(entity)
        try modelContext.save()
        loadData()
        logger.info("Saved call to history: \(state.callId)")
    }

    /// Get call history
    public func getCallHistory() async throws -> [CallHistory] {
        callHistory.map { $0.toCallHistory() }
    }

    /// Get call history for a specific contact
    public func getCallHistory(for pubkey: String) -> [CallHistoryEntity] {
        callHistory.filter { $0.remotePubkey == pubkey }
    }

    /// Clear call history
    public func clearCallHistory() throws {
        for entry in callHistory {
            modelContext.delete(entry)
        }
        try modelContext.save()
        callHistory = []
        logger.info("Cleared call history")
    }

    /// Delete a specific call history entry
    public func deleteCallHistory(id: String) throws {
        guard let entry = callHistory.first(where: { $0.id == id }) else {
            return
        }
        modelContext.delete(entry)
        try modelContext.save()
        loadData()
        logger.info("Deleted call history: \(id)")
    }

    // MARK: - Group Call Operations

    /// Save a group call
    public func saveGroupCall(
        roomId: String,
        groupId: String?,
        callType: CallType,
        createdBy: String
    ) async throws {
        let entity = GroupCallEntity(
            id: roomId,
            roomId: roomId,
            groupId: groupId,
            callType: callType.rawValue,
            createdBy: createdBy,
            createdAt: Date(),
            isActive: true
        )
        modelContext.insert(entity)
        try modelContext.save()
        loadData()
        logger.info("Saved group call: \(roomId)")
    }

    /// Get active group calls
    public func getActiveGroupCalls() -> [GroupCallEntity] {
        activeGroupCalls
    }

    /// Get group call by room ID
    public func getGroupCall(roomId: String) -> GroupCallEntity? {
        activeGroupCalls.first { $0.roomId == roomId }
    }

    /// End a group call
    public func endGroupCall(roomId: String) throws {
        guard let call = activeGroupCalls.first(where: { $0.roomId == roomId }) else {
            return
        }
        call.isActive = false
        call.endedAt = Date()
        try modelContext.save()
        loadData()
        logger.info("Ended group call: \(roomId)")
    }

    // MARK: - Temporary Call Data

    /// Store remote SDP for a call
    public func saveRemoteSDP(_ sdp: String, for callId: String) async throws {
        remoteSDP[callId] = sdp
    }

    /// Get remote SDP for a call
    public func getRemoteSDP(for callId: String) -> String? {
        remoteSDP[callId]
    }

    /// Remove remote SDP
    public func removeRemoteSDP(for callId: String) {
        remoteSDP.removeValue(forKey: callId)
    }

    // MARK: - Settings Operations

    /// Get call settings
    public func getSettings() -> CallSettings {
        settings?.toCallSettings() ?? CallSettings(
            v: CallingSchema.version,
            allowUnknownCallers: true,
            autoAnswer: false,
            autoGainControl: true,
            defaultCallType: .voice,
            doNotDisturb: false,
            echoCancellation: true,
            noiseSuppression: true,
            preferredAudioInput: nil,
            preferredAudioOutput: nil,
            preferredVideoInput: nil,
            relayOnlyMode: false
        )
    }

    /// Save call settings
    public func saveSettings(_ callSettings: CallSettings) throws {
        if let existing = settings {
            existing.updateFrom(callSettings)
        } else {
            let entity = CallSettingsEntity.from(callSettings)
            modelContext.insert(entity)
            settings = entity
        }
        try modelContext.save()
        logger.info("Saved call settings")
    }

    /// Update Do Not Disturb setting
    public func setDoNotDisturb(_ enabled: Bool) throws {
        if let existing = settings {
            existing.doNotDisturb = enabled
        } else {
            let entity = CallSettingsEntity(
                id: UUID().uuidString,
                schemaVersion: CallingSchema.version,
                doNotDisturb: enabled,
                allowUnknownCallers: true,
                autoAnswer: false,
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
                relayOnlyMode: false,
                defaultCallType: "voice"
            )
            modelContext.insert(entity)
            settings = entity
        }
        try modelContext.save()
        logger.info("Do Not Disturb: \(enabled)")
    }
}

// MARK: - SwiftData Models

/// SwiftData model for call history
@Model
public final class CallHistoryEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var callType: String
    public var direction: String
    public var remotePubkey: String
    public var remoteName: String?
    public var startedAt: Date
    public var connectedAt: Date?
    public var endedAt: Date?
    public var endReason: String?
    public var duration: Int?
    public var wasEncrypted: Bool
    public var groupId: String?
    public var roomId: String?

    public init(
        id: String,
        schemaVersion: String,
        callType: String,
        direction: String,
        remotePubkey: String,
        remoteName: String?,
        startedAt: Date,
        connectedAt: Date?,
        endedAt: Date?,
        endReason: String?,
        duration: Int?,
        wasEncrypted: Bool,
        groupId: String?,
        roomId: String?
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.callType = callType
        self.direction = direction
        self.remotePubkey = remotePubkey
        self.remoteName = remoteName
        self.startedAt = startedAt
        self.connectedAt = connectedAt
        self.endedAt = endedAt
        self.endReason = endReason
        self.duration = duration
        self.wasEncrypted = wasEncrypted
        self.groupId = groupId
        self.roomId = roomId
    }

    /// Convert from LocalCallState
    public static func from(_ state: LocalCallState) -> CallHistoryEntity {
        var duration: Int?
        if let connected = state.connectedAt, let ended = state.endedAt {
            duration = Int(ended.timeIntervalSince(connected))
        }

        return CallHistoryEntity(
            id: state.callId,
            schemaVersion: CallingSchema.version,
            callType: state.callType.rawValue,
            direction: state.direction.rawValue,
            remotePubkey: state.remotePubkey,
            remoteName: state.remoteName,
            startedAt: state.startedAt,
            connectedAt: state.connectedAt,
            endedAt: state.endedAt,
            endReason: state.endReason?.rawValue,
            duration: duration,
            wasEncrypted: state.isEncrypted,
            groupId: state.groupId,
            roomId: state.roomId
        )
    }

    /// Convert to generated CallHistory type
    public func toCallHistory() -> CallHistory {
        CallHistory(
            v: schemaVersion,
            callID: id,
            callType: CallHistoryCallType(rawValue: callType),
            connectedAt: connectedAt.map { Int($0.timeIntervalSince1970) },
            direction: Direction(rawValue: direction) ?? .outgoing,
            duration: duration,
            endedAt: endedAt.map { Int($0.timeIntervalSince1970) },
            endReason: endReason.flatMap { Reason(rawValue: $0) },
            groupID: groupId,
            participantCount: nil,
            remoteName: remoteName,
            remotePubkey: remotePubkey,
            roomID: roomId,
            startedAt: Int(startedAt.timeIntervalSince1970),
            wasEncrypted: wasEncrypted
        )
    }
}

/// SwiftData model for group calls
@Model
public final class GroupCallEntity {
    @Attribute(.unique) public var id: String
    public var roomId: String
    public var groupId: String?
    public var callType: String
    public var createdBy: String
    public var createdAt: Date
    public var endedAt: Date?
    public var isActive: Bool

    public init(
        id: String,
        roomId: String,
        groupId: String?,
        callType: String,
        createdBy: String,
        createdAt: Date,
        isActive: Bool
    ) {
        self.id = id
        self.roomId = roomId
        self.groupId = groupId
        self.callType = callType
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.isActive = isActive
    }
}

/// SwiftData model for call settings
@Model
public final class CallSettingsEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    public var doNotDisturb: Bool
    public var allowUnknownCallers: Bool
    public var autoAnswer: Bool
    public var autoGainControl: Bool
    public var echoCancellation: Bool
    public var noiseSuppression: Bool
    public var relayOnlyMode: Bool
    public var defaultCallType: String
    public var preferredAudioInput: String?
    public var preferredAudioOutput: String?
    public var preferredVideoInput: String?

    public init(
        id: String,
        schemaVersion: String,
        doNotDisturb: Bool,
        allowUnknownCallers: Bool,
        autoAnswer: Bool,
        autoGainControl: Bool,
        echoCancellation: Bool,
        noiseSuppression: Bool,
        relayOnlyMode: Bool,
        defaultCallType: String,
        preferredAudioInput: String? = nil,
        preferredAudioOutput: String? = nil,
        preferredVideoInput: String? = nil
    ) {
        self.id = id
        self.schemaVersion = schemaVersion
        self.doNotDisturb = doNotDisturb
        self.allowUnknownCallers = allowUnknownCallers
        self.autoAnswer = autoAnswer
        self.autoGainControl = autoGainControl
        self.echoCancellation = echoCancellation
        self.noiseSuppression = noiseSuppression
        self.relayOnlyMode = relayOnlyMode
        self.defaultCallType = defaultCallType
        self.preferredAudioInput = preferredAudioInput
        self.preferredAudioOutput = preferredAudioOutput
        self.preferredVideoInput = preferredVideoInput
    }

    /// Convert from generated CallSettings type
    public static func from(_ settings: CallSettings) -> CallSettingsEntity {
        CallSettingsEntity(
            id: UUID().uuidString,
            schemaVersion: settings.v ?? CallingSchema.version,
            doNotDisturb: settings.doNotDisturb ?? false,
            allowUnknownCallers: settings.allowUnknownCallers ?? true,
            autoAnswer: settings.autoAnswer ?? false,
            autoGainControl: settings.autoGainControl ?? true,
            echoCancellation: settings.echoCancellation ?? true,
            noiseSuppression: settings.noiseSuppression ?? true,
            relayOnlyMode: settings.relayOnlyMode ?? false,
            defaultCallType: settings.defaultCallType?.rawValue ?? "voice",
            preferredAudioInput: settings.preferredAudioInput,
            preferredAudioOutput: settings.preferredAudioOutput,
            preferredVideoInput: settings.preferredVideoInput
        )
    }

    /// Convert to generated CallSettings type
    public func toCallSettings() -> CallSettings {
        CallSettings(
            v: schemaVersion,
            allowUnknownCallers: allowUnknownCallers,
            autoAnswer: autoAnswer,
            autoGainControl: autoGainControl,
            defaultCallType: CallType(rawValue: defaultCallType),
            doNotDisturb: doNotDisturb,
            echoCancellation: echoCancellation,
            noiseSuppression: noiseSuppression,
            preferredAudioInput: preferredAudioInput,
            preferredAudioOutput: preferredAudioOutput,
            preferredVideoInput: preferredVideoInput,
            relayOnlyMode: relayOnlyMode
        )
    }

    /// Update from CallSettings
    public func updateFrom(_ settings: CallSettings) {
        if let v = settings.v { schemaVersion = v }
        if let dnd = settings.doNotDisturb { doNotDisturb = dnd }
        if let allow = settings.allowUnknownCallers { allowUnknownCallers = allow }
        if let auto = settings.autoAnswer { autoAnswer = auto }
        if let agc = settings.autoGainControl { autoGainControl = agc }
        if let ec = settings.echoCancellation { echoCancellation = ec }
        if let ns = settings.noiseSuppression { noiseSuppression = ns }
        if let relay = settings.relayOnlyMode { relayOnlyMode = relay }
        if let type = settings.defaultCallType { defaultCallType = type.rawValue }
        preferredAudioInput = settings.preferredAudioInput
        preferredAudioOutput = settings.preferredAudioOutput
        preferredVideoInput = settings.preferredVideoInput
    }
}
