// CallKitManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles CallKit integration for iOS system call UI.
// Provides native iOS call experience with lock screen controls.

import Foundation
import CallKit
import AVFoundation
import os.log

/// CallKit delegate for handling system call actions
protocol CallKitManagerDelegate: AnyObject {
    func callKitManager(_ manager: CallKitManager, didAcceptCall callId: UUID)
    func callKitManager(_ manager: CallKitManager, didDeclineCall callId: UUID)
    func callKitManager(_ manager: CallKitManager, didEndCall callId: UUID)
    func callKitManager(_ manager: CallKitManager, didMuteCall callId: UUID, muted: Bool)
    func callKitManager(_ manager: CallKitManager, didHoldCall callId: UUID, onHold: Bool)
}

/// Manages CallKit provider for system call integration
@MainActor
public class CallKitManager: NSObject {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "CallKitManager")

    private let provider: CXProvider
    private let callController = CXCallController()

    weak var delegate: CallKitManagerDelegate?

    // Track active calls
    private var activeCalls: [UUID: CallInfo] = [:]

    // MARK: - Types

    struct CallInfo {
        let callId: UUID
        let remotePubkey: String
        let remoteName: String?
        let hasVideo: Bool
        let direction: CallDirection
        var isConnected: Bool = false
        var isMuted: Bool = false
        var isOnHold: Bool = false

        enum CallDirection {
            case incoming
            case outgoing
        }
    }

    // MARK: - Initialization

    public override init() {
        // Configure CallKit provider
        let config = CXProviderConfiguration()
        config.localizedName = "BuildIt"
        config.supportsVideo = true
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        config.supportedHandleTypes = [.generic]
        config.includesCallsInRecents = true

        // Set ringtone
        config.ringtoneSound = "ringtone.caf"

        provider = CXProvider(configuration: config)

        super.init()

        provider.setDelegate(self, queue: nil)

        logger.info("CallKit manager initialized")
    }

    // MARK: - Incoming Calls

    /// Report an incoming call to CallKit
    func reportIncomingCall(
        callId: UUID,
        remotePubkey: String,
        remoteName: String?,
        hasVideo: Bool
    ) async throws {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: remotePubkey)
        update.localizedCallerName = remoteName ?? "Unknown Caller"
        update.hasVideo = hasVideo
        update.supportsDTMF = false
        update.supportsHolding = true
        update.supportsGrouping = false
        update.supportsUngrouping = false

        // Track the call
        activeCalls[callId] = CallInfo(
            callId: callId,
            remotePubkey: remotePubkey,
            remoteName: remoteName,
            hasVideo: hasVideo,
            direction: .incoming
        )

        // Report to CallKit
        try await provider.reportNewIncomingCall(with: callId, update: update)

        logger.info("Reported incoming call to CallKit: \(callId)")
    }

    // MARK: - Outgoing Calls

    /// Start an outgoing call via CallKit
    func startOutgoingCall(
        callId: UUID,
        remotePubkey: String,
        remoteName: String?,
        hasVideo: Bool
    ) async throws {
        let handle = CXHandle(type: .generic, value: remotePubkey)
        let startCallAction = CXStartCallAction(call: callId, handle: handle)
        startCallAction.isVideo = hasVideo
        startCallAction.contactIdentifier = remoteName

        let transaction = CXTransaction(action: startCallAction)

        // Track the call
        activeCalls[callId] = CallInfo(
            callId: callId,
            remotePubkey: remotePubkey,
            remoteName: remoteName,
            hasVideo: hasVideo,
            direction: .outgoing
        )

        try await callController.request(transaction)

        logger.info("Started outgoing call via CallKit: \(callId)")
    }

    /// Report that an outgoing call started connecting
    func reportOutgoingCallStartedConnecting(callId: UUID) {
        provider.reportOutgoingCall(with: callId, startedConnectingAt: Date())
        logger.debug("Outgoing call started connecting: \(callId)")
    }

    /// Report that an outgoing call connected
    func reportOutgoingCallConnected(callId: UUID) {
        provider.reportOutgoingCall(with: callId, connectedAt: Date())
        activeCalls[callId]?.isConnected = true
        logger.info("Outgoing call connected: \(callId)")
    }

    // MARK: - Call Updates

    /// Report that a call has connected
    func reportCallConnected(callId: UUID) {
        activeCalls[callId]?.isConnected = true
        logger.info("Call connected: \(callId)")
    }

    /// End a call via CallKit
    func endCall(callId: UUID) async throws {
        let endCallAction = CXEndCallAction(call: callId)
        let transaction = CXTransaction(action: endCallAction)

        try await callController.request(transaction)

        activeCalls.removeValue(forKey: callId)

        logger.info("Ended call via CallKit: \(callId)")
    }

    /// Report that a call ended (from remote)
    func reportCallEnded(callId: UUID, reason: CXCallEndedReason) {
        provider.reportCall(with: callId, endedAt: Date(), reason: reason)
        activeCalls.removeValue(forKey: callId)

        logger.info("Reported call ended: \(callId), reason: \(reason.rawValue)")
    }

    // MARK: - Call Controls

    /// Mute/unmute a call
    func setMuted(callId: UUID, muted: Bool) async throws {
        let setMutedAction = CXSetMutedCallAction(call: callId, muted: muted)
        let transaction = CXTransaction(action: setMutedAction)

        try await callController.request(transaction)

        activeCalls[callId]?.isMuted = muted

        logger.debug("Set muted \(muted) for call: \(callId)")
    }

    /// Hold/unhold a call
    func setOnHold(callId: UUID, onHold: Bool) async throws {
        let setHeldAction = CXSetHeldCallAction(call: callId, onHold: onHold)
        let transaction = CXTransaction(action: setHeldAction)

        try await callController.request(transaction)

        activeCalls[callId]?.isOnHold = onHold

        logger.debug("Set on hold \(onHold) for call: \(callId)")
    }

    // MARK: - Audio Session

    /// Configure audio session for voice call
    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()

        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [
                .allowBluetooth,
                .allowBluetoothA2DP,
                .defaultToSpeaker
            ]
        )

        try session.setActive(true)

        logger.debug("Audio session configured for voice call")
    }

    /// Deactivate audio session
    private func deactivateAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setActive(false)
            logger.debug("Audio session deactivated")
        } catch {
            logger.error("Failed to deactivate audio session: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    /// Get call info for a call ID
    func getCallInfo(callId: UUID) -> CallInfo? {
        return activeCalls[callId]
    }

    /// Check if there's an active call
    var hasActiveCall: Bool {
        return !activeCalls.isEmpty
    }

    /// Get all active call IDs
    var activeCallIds: [UUID] {
        return Array(activeCalls.keys)
    }
}

// MARK: - CXProviderDelegate

extension CallKitManager: CXProviderDelegate {
    nonisolated public func providerDidReset(_ provider: CXProvider) {
        Task { @MainActor in
            logger.info("CallKit provider did reset")
            // End all calls
            activeCalls.removeAll()
        }
    }

    nonisolated public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        Task { @MainActor in
            logger.info("CallKit: Start call action for \(action.callUUID)")

            do {
                try configureAudioSession()
                action.fulfill()
            } catch {
                logger.error("Failed to configure audio session: \(error.localizedDescription)")
                action.fail()
            }
        }
    }

    nonisolated public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        Task { @MainActor in
            logger.info("CallKit: Answer call action for \(action.callUUID)")

            do {
                try configureAudioSession()
                delegate?.callKitManager(self, didAcceptCall: action.callUUID)
                action.fulfill()
            } catch {
                logger.error("Failed to configure audio session: \(error.localizedDescription)")
                action.fail()
            }
        }
    }

    nonisolated public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        Task { @MainActor in
            logger.info("CallKit: End call action for \(action.callUUID)")

            delegate?.callKitManager(self, didEndCall: action.callUUID)
            deactivateAudioSession()
            activeCalls.removeValue(forKey: action.callUUID)
            action.fulfill()
        }
    }

    nonisolated public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        Task { @MainActor in
            logger.debug("CallKit: Set muted \(action.isMuted) for \(action.callUUID)")

            delegate?.callKitManager(self, didMuteCall: action.callUUID, muted: action.isMuted)
            activeCalls[action.callUUID]?.isMuted = action.isMuted
            action.fulfill()
        }
    }

    nonisolated public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        Task { @MainActor in
            logger.debug("CallKit: Set held \(action.isOnHold) for \(action.callUUID)")

            delegate?.callKitManager(self, didHoldCall: action.callUUID, onHold: action.isOnHold)
            activeCalls[action.callUUID]?.isOnHold = action.isOnHold
            action.fulfill()
        }
    }

    nonisolated public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        Task { @MainActor in
            logger.debug("CallKit: Audio session activated")
        }
    }

    nonisolated public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        Task { @MainActor in
            logger.debug("CallKit: Audio session deactivated")
        }
    }
}
