// CallingModule.swift
// BuildIt - Decentralized Mesh Communication
//
// Calling module for voice/video calls with WebRTC and NIP-17 signaling.

import Foundation
import SwiftUI
import os.log

/// Calling module implementation
@MainActor
public final class CallingModule: BuildItModule {
    // MARK: - Module Metadata

    public static let identifier = "calling"
    public static let version = "1.0.0"
    public static let dependencies: [String] = ["messaging"]

    // MARK: - Event Kinds

    /// Nostr event kinds for calling (24300-24399 range)
    public enum EventKind: Int {
        case callOffer = 24300
        case callAnswer = 24301
        case callIceCandidate = 24302
        case callHangup = 24303
        case groupCallCreate = 24310
        case groupCallJoin = 24311
        case groupCallLeave = 24312
        case senderKeyDistribution = 24320
    }

    // MARK: - Properties

    private let store: CallingStore
    private let service: CallingService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "CallingModule")

    // MARK: - Initialization

    public init() throws {
        self.store = try CallingStore()
        self.service = CallingService(store: store)
        logger.info("Calling module created")
    }

    // MARK: - BuildItModule Implementation

    public func initialize() async throws {
        logger.info("Initializing Calling module")

        // Enable by default for global scope
        try await enable(for: nil)

        logger.info("Calling module initialized")
    }

    public func handleEvent(_ event: NostrEvent) async {
        // Route calling-related Nostr events to service
        guard let eventKind = EventKind(rawValue: event.kind) else { return }

        switch eventKind {
        case .callOffer:
            await service.handleCallOffer(event)
        case .callAnswer:
            await service.handleCallAnswer(event)
        case .callIceCandidate:
            await service.handleIceCandidate(event)
        case .callHangup:
            await service.handleCallHangup(event)
        case .groupCallCreate:
            await service.handleGroupCallCreate(event)
        case .groupCallJoin:
            await service.handleGroupCallJoin(event)
        case .groupCallLeave:
            await service.handleGroupCallLeave(event)
        case .senderKeyDistribution:
            await service.handleSenderKeyDistribution(event)
        }
    }

    public func getViews() -> [ModuleView] {
        // The calling module provides call UI as modal overlays
        // No separate list view needed
        []
    }

    public func cleanup() async {
        logger.info("Cleaning up Calling module")
        await service.endAllCalls()
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
        logger.info("Enabled Calling module for group: \(groupId ?? "global")")
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
        logger.info("Disabled Calling module for group: \(groupId ?? "global")")
    }

    // MARK: - Public API

    /// Initiate a voice call to a contact
    public func startVoiceCall(to recipientPubkey: String) async throws {
        try await service.startCall(to: recipientPubkey, type: .voice)
    }

    /// Initiate a video call to a contact
    public func startVideoCall(to recipientPubkey: String) async throws {
        try await service.startCall(to: recipientPubkey, type: .video)
    }

    /// Accept an incoming call
    public func acceptCall(_ callId: String) async throws {
        try await service.acceptCall(callId)
    }

    /// Decline an incoming call
    public func declineCall(_ callId: String, reason: Reason = .rejected) async throws {
        try await service.declineCall(callId, reason: reason)
    }

    /// End the current call
    public func endCall(_ callId: String) async throws {
        try await service.endCall(callId, reason: .completed)
    }

    /// Toggle mute state
    public func toggleMute(_ callId: String) async {
        await service.toggleMute(callId)
    }

    /// Toggle video state
    public func toggleVideo(_ callId: String) async {
        await service.toggleVideo(callId)
    }

    /// Toggle speaker mode
    public func toggleSpeaker(_ callId: String) async {
        await service.toggleSpeaker(callId)
    }

    /// Switch camera (front/back)
    public func switchCamera(_ callId: String) async {
        await service.switchCamera(callId)
    }

    /// Get call history
    public func getCallHistory() async throws -> [CallHistory] {
        try await store.getCallHistory()
    }

    /// Get current call state
    public func getCurrentCall() -> LocalCallState? {
        service.currentCallState
    }

    /// Create a group call
    public func createGroupCall(
        groupId: String?,
        callType: CallType,
        invitedPubkeys: [String]? = nil
    ) async throws -> String {
        try await service.createGroupCall(
            groupId: groupId,
            callType: callType,
            invitedPubkeys: invitedPubkeys
        )
    }

    /// Join an existing group call
    public func joinGroupCall(roomId: String) async throws {
        try await service.joinGroupCall(roomId: roomId)
    }

    /// Leave a group call
    public func leaveGroupCall(roomId: String) async throws {
        try await service.leaveGroupCall(roomId: roomId)
    }
}
