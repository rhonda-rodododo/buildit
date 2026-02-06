// CallingService.swift
// BuildIt - Decentralized Mesh Communication
//
// Business logic for the Calling module.
// Handles WebRTC signaling via NIP-17 gift wrap for privacy.

import Foundation
import AVFoundation
import CallKit
import WebRTC
import os.log

/// Service for managing calls with WebRTC
@MainActor
public class CallingService: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var currentCallState: LocalCallState?
    @Published public private(set) var incomingCall: LocalCallState?
    @Published public private(set) var groupParticipants: [GroupCallParticipant] = []
    @Published public private(set) var localVideoTrack: RTCVideoTrack?
    @Published public private(set) var remoteVideoTrack: RTCVideoTrack?

    // MARK: - Properties

    private let store: CallingStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "CallingService")

    // CallKit integration
    public let callKitManager: CallKitManager

    // Mapping between CallKit UUIDs and our string call IDs
    private var callIdToUUID: [String: UUID] = [:]
    private var uuidToCallId: [UUID: String] = [:]

    // WebRTC manager
    private var webRTCManager: WebRTCManager?

    // ICE candidate buffer for early candidates
    private var pendingIceCandidates: [String: [CallIceCandidate]] = [:]

    // Remote SDP storage for incoming calls
    private var pendingRemoteSDP: [String: String] = [:]

    // Audio session management
    private let audioSession = AVAudioSession.sharedInstance()

    // MARK: - Initialization

    public init(store: CallingStore) throws {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
        self.callKitManager = CallKitManager()
    }

    /// Wire up CallKit delegate after init completes.
    /// Call this once after creating CallingService.
    public func configureCallKit() {
        callKitManager.delegate = self
    }

    // MARK: - Call Initiation

    /// Start a call to a recipient
    public func startCall(to recipientPubkey: String, type: CallType, groupId: String? = nil) async throws {
        guard let senderPubkey = await cryptoManager.getPublicKeyHex() else {
            throw CallingError.noKeyPair
        }

        let callId = UUID().uuidString
        let timestamp = Int(Date().timeIntervalSince1970)

        // Create local call state
        let callState = LocalCallState(
            callId: callId,
            remotePubkey: recipientPubkey,
            direction: .outgoing,
            callType: type,
            state: .initiating,
            startedAt: Date()
        )
        currentCallState = callState

        // Configure audio session
        try configureAudioSession(for: type)

        // Initialize WebRTC
        try await initializeWebRTC(callType: type)

        // Create SDP offer
        let sdpOffer = try await createSDPOffer()

        let capabilities = CapabilitiesClass(
            e2Ee: true,
            insertableStreams: true,
            screenShare: type == .video,
            video: type == .video
        )

        let callOffer = CallOffer(
            v: CallingSchema.version,
            callID: callId,
            callType: type,
            capabilities: capabilities,
            groupID: groupId,
            hotlineID: nil,
            isReconnect: false,
            isRenegotiation: false,
            roomID: nil,
            sdp: sdpOffer,
            timestamp: timestamp
        )

        // Encode and send via NIP-17
        let encoder = JSONEncoder()
        let offerData = try encoder.encode(callOffer)
        guard let offerContent = String(data: offerData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        // Send as NIP-17 gift-wrapped direct message
        _ = try await nostrClient.sendDirectMessage(offerContent, to: recipientPubkey)

        // Update state to ringing
        currentCallState?.state = .ringing

        // Report to CallKit
        let callUUID = mapCallIdToUUID(callId)
        try await callKitManager.startOutgoingCall(
            callId: callUUID,
            remotePubkey: recipientPubkey,
            remoteName: callState.remoteName,
            hasVideo: type == .video
        )

        // Save to history
        try await store.saveCallState(callState)

        logger.info("Started \(type.rawValue) call to \(recipientPubkey.prefix(8))")
    }

    /// Accept an incoming call
    public func acceptCall(_ callId: String) async throws {
        guard var call = incomingCall, call.callId == callId else {
            throw CallingError.callNotFound
        }

        call.state = .connecting
        currentCallState = call
        incomingCall = nil

        // Configure audio session
        try configureAudioSession(for: call.callType)

        // Initialize WebRTC
        try await initializeWebRTC(callType: call.callType)

        // Get and process stored remote SDP (offer)
        guard let remoteSdp = pendingRemoteSDP[callId] else {
            throw CallingError.invalidSignalingData
        }
        try await processRemoteSDP(remoteSdp, type: .offer)
        pendingRemoteSDP.removeValue(forKey: callId)

        // Create SDP answer
        let sdpAnswer = try await createSDPAnswer()

        let callAnswer = CallAnswer(
            v: CallingSchema.version,
            callID: callId,
            sdp: sdpAnswer,
            timestamp: Int(Date().timeIntervalSince1970)
        )

        // Encode and send via NIP-17
        let encoder = JSONEncoder()
        let answerData = try encoder.encode(callAnswer)
        guard let answerContent = String(data: answerData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        _ = try await nostrClient.sendDirectMessage(answerContent, to: call.remotePubkey)

        // Process any buffered ICE candidates
        if let candidates = pendingIceCandidates[callId] {
            for candidate in candidates {
                await processIceCandidate(candidate)
            }
            pendingIceCandidates.removeValue(forKey: callId)
        }

        logger.info("Accepted call: \(callId)")
    }

    /// Decline an incoming call
    public func declineCall(_ callId: String, reason: Reason) async throws {
        guard let call = incomingCall, call.callId == callId else {
            throw CallingError.callNotFound
        }

        let hangup = CallHangup(
            v: CallingSchema.version,
            callID: callId,
            reason: reason,
            timestamp: Int(Date().timeIntervalSince1970)
        )

        // Send hangup signal
        let encoder = JSONEncoder()
        let hangupData = try encoder.encode(hangup)
        guard let hangupContent = String(data: hangupData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        _ = try await nostrClient.sendDirectMessage(hangupContent, to: call.remotePubkey)

        incomingCall = nil

        // Report decline to CallKit
        if let callUUID = callIdToUUID[callId] {
            callKitManager.reportCallEnded(callId: callUUID, reason: .declinedElsewhere)
            unmapCallId(callId)
        }

        // Save to history
        var historyCopy = call
        historyCopy.state = .ended
        historyCopy.endedAt = Date()
        historyCopy.endReason = reason
        try await store.saveCallState(historyCopy)

        logger.info("Declined call: \(callId) with reason: \(reason.rawValue)")
    }

    /// End an active call
    public func endCall(_ callId: String, reason: Reason) async throws {
        guard var call = currentCallState, call.callId == callId else {
            throw CallingError.callNotFound
        }

        let hangup = CallHangup(
            v: CallingSchema.version,
            callID: callId,
            reason: reason,
            timestamp: Int(Date().timeIntervalSince1970)
        )

        // Send hangup signal
        let encoder = JSONEncoder()
        let hangupData = try encoder.encode(hangup)
        guard let hangupContent = String(data: hangupData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        _ = try await nostrClient.sendDirectMessage(hangupContent, to: call.remotePubkey)

        // Clean up WebRTC
        await cleanupWebRTC()

        // End via CallKit
        if let callUUID = callIdToUUID[callId] {
            try? await callKitManager.endCall(callId: callUUID)
            unmapCallId(callId)
        }

        // Update state
        call.state = .ended
        call.endedAt = Date()
        call.endReason = reason

        // Save to history
        try await store.saveCallState(call)

        currentCallState = nil

        logger.info("Ended call: \(callId)")
    }

    /// End all active calls (cleanup)
    public func endAllCalls() async {
        if let call = currentCallState {
            try? await endCall(call.callId, reason: .completed)
        }
        if let call = incomingCall {
            try? await declineCall(call.callId, reason: .cancelled)
        }
    }

    // MARK: - Call Controls

    /// Toggle mute state
    public func toggleMute(_ callId: String) async {
        guard var call = currentCallState, call.callId == callId else { return }
        call.isMuted.toggle()
        currentCallState = call

        // Update local audio track (placeholder)
        // localAudioTrack?.isEnabled = !call.isMuted

        logger.debug("Mute toggled: \(call.isMuted)")
    }

    /// Toggle video state
    public func toggleVideo(_ callId: String) async {
        guard var call = currentCallState, call.callId == callId else { return }
        call.isVideoEnabled.toggle()
        currentCallState = call

        // Update local video track (placeholder)
        // localVideoTrack?.isEnabled = call.isVideoEnabled

        logger.debug("Video toggled: \(call.isVideoEnabled)")
    }

    /// Toggle speaker mode
    public func toggleSpeaker(_ callId: String) async {
        guard var call = currentCallState, call.callId == callId else { return }
        call.isSpeakerOn.toggle()
        currentCallState = call

        do {
            if call.isSpeakerOn {
                try audioSession.overrideOutputAudioPort(.speaker)
            } else {
                try audioSession.overrideOutputAudioPort(.none)
            }
        } catch {
            logger.error("Failed to toggle speaker: \(error.localizedDescription)")
        }

        logger.debug("Speaker toggled: \(call.isSpeakerOn)")
    }

    /// Switch camera (front/back)
    public func switchCamera(_ callId: String) async {
        guard var call = currentCallState, call.callId == callId else { return }
        call.isUsingFrontCamera.toggle()
        currentCallState = call

        // Switch camera (placeholder - actual WebRTC implementation needed)
        logger.debug("Camera switched to: \(call.isUsingFrontCamera ? "front" : "back")")
    }

    // MARK: - Group Calls

    /// Create a group call room
    public func createGroupCall(
        groupId: String?,
        callType: CallType,
        invitedPubkeys: [String]?
    ) async throws -> String {
        guard let createdBy = await cryptoManager.getPublicKeyHex() else {
            throw CallingError.noKeyPair
        }

        let roomId = UUID().uuidString
        let timestamp = Int(Date().timeIntervalSince1970)

        let groupCallCreate = GroupCallCreate(
            v: CallingSchema.version,
            callType: callType,
            createdBy: createdBy,
            groupID: groupId,
            invitedPubkeys: invitedPubkeys,
            maxParticipants: 10,
            roomID: roomId,
            timestamp: timestamp,
            topology: .mesh
        )

        // Publish to group or broadcast
        let encoder = JSONEncoder()
        let createData = try encoder.encode(groupCallCreate)
        guard let createContent = String(data: createData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        var tags: [[String]] = [
            ["d", roomId],
            ["type", callType.rawValue]
        ]

        if let groupId = groupId {
            tags.append(["group", groupId])
        }

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: CallingModule.EventKind.groupCallCreate.rawValue) ?? .textNote,
            content: createContent,
            tags: tags
        )

        // Save to store
        try await store.saveGroupCall(roomId: roomId, groupId: groupId, callType: callType, createdBy: createdBy)

        logger.info("Created group call room: \(roomId)")
        return roomId
    }

    /// Join a group call
    public func joinGroupCall(roomId: String) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw CallingError.noKeyPair
        }

        let timestamp = Int(Date().timeIntervalSince1970)

        let join = GroupCallJoin(
            v: CallingSchema.version,
            displayName: nil, // Could fetch from profile
            pubkey: pubkey,
            roomID: roomId,
            timestamp: timestamp
        )

        let encoder = JSONEncoder()
        let joinData = try encoder.encode(join)
        guard let joinContent = String(data: joinData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        let tags: [[String]] = [
            ["e", roomId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: CallingModule.EventKind.groupCallJoin.rawValue) ?? .textNote,
            content: joinContent,
            tags: tags
        )

        logger.info("Joined group call: \(roomId)")
    }

    /// Leave a group call
    public func leaveGroupCall(roomId: String) async throws {
        guard let pubkey = await cryptoManager.getPublicKeyHex() else {
            throw CallingError.noKeyPair
        }

        let timestamp = Int(Date().timeIntervalSince1970)

        let leave = GroupCallLeave(
            v: CallingSchema.version,
            pubkey: pubkey,
            roomID: roomId,
            timestamp: timestamp
        )

        let encoder = JSONEncoder()
        let leaveData = try encoder.encode(leave)
        guard let leaveContent = String(data: leaveData, encoding: .utf8) else {
            throw CallingError.invalidSignalingData
        }

        let tags: [[String]] = [
            ["e", roomId]
        ]

        _ = try await nostrClient.publishEvent(
            kind: NostrEventKind(rawValue: CallingModule.EventKind.groupCallLeave.rawValue) ?? .textNote,
            content: leaveContent,
            tags: tags
        )

        groupParticipants.removeAll { $0.pubkey == pubkey }

        logger.info("Left group call: \(roomId)")
    }

    // MARK: - Nostr Event Handling

    /// Handle incoming call offer
    public func handleCallOffer(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let offer = try? decoder.decode(CallOffer.self, from: data) else {
            logger.warning("Failed to decode call offer")
            return
        }

        // Check if we already have an active call
        if currentCallState != nil {
            // Auto-decline with busy reason
            let hangup = CallHangup(
                v: CallingSchema.version,
                callID: offer.callID,
                reason: .busy,
                timestamp: Int(Date().timeIntervalSince1970)
            )

            let encoder = JSONEncoder()
            if let hangupData = try? encoder.encode(hangup),
               let hangupContent = String(data: hangupData, encoding: .utf8) {
                _ = try? await nostrClient.sendDirectMessage(hangupContent, to: event.pubkey)
            }

            logger.info("Declined call from \(event.pubkey.prefix(8)): busy")
            return
        }

        // Create incoming call state
        let callState = LocalCallState(
            callId: offer.callID,
            remotePubkey: event.pubkey,
            direction: .incoming,
            callType: offer.callType,
            state: .ringing,
            startedAt: Date()
        )

        incomingCall = callState

        // Store the SDP offer for later (when accepting)
        pendingRemoteSDP[offer.callID] = offer.sdp

        // Report to CallKit for native iOS incoming call UI
        let callUUID = mapCallIdToUUID(offer.callID)
        do {
            try await callKitManager.reportIncomingCall(
                callId: callUUID,
                remotePubkey: event.pubkey,
                remoteName: nil,
                hasVideo: offer.callType == .video
            )
        } catch {
            logger.error("Failed to report incoming call to CallKit: \(error.localizedDescription)")
            // Still show in-app UI even if CallKit fails
        }

        logger.info("Incoming \(offer.callType.rawValue) call from \(event.pubkey.prefix(8))")
    }

    /// Handle call answer
    public func handleCallAnswer(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let answer = try? decoder.decode(CallAnswer.self, from: data) else {
            logger.warning("Failed to decode call answer")
            return
        }

        guard var call = currentCallState, call.callId == answer.callID else {
            logger.warning("Received answer for unknown call")
            return
        }

        // Process the SDP answer
        do {
            try await processRemoteSDP(answer.sdp, type: .answer)
        } catch {
            logger.error("Failed to process SDP answer: \(error.localizedDescription)")
            return
        }

        call.state = .connecting
        call.connectedAt = Date()
        currentCallState = call

        // Report connection progress to CallKit
        if let callUUID = callIdToUUID[answer.callID] {
            callKitManager.reportOutgoingCallStartedConnecting(callId: callUUID)
        }

        // Process any buffered ICE candidates
        if let candidates = pendingIceCandidates[answer.callID] {
            for candidate in candidates {
                await processIceCandidate(candidate)
            }
            pendingIceCandidates.removeValue(forKey: answer.callID)
        }

        logger.info("Call answered: \(answer.callID)")
    }

    /// Handle ICE candidate
    public func handleIceCandidate(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let candidate = try? decoder.decode(CallIceCandidate.self, from: data) else {
            logger.warning("Failed to decode ICE candidate")
            return
        }

        // Buffer if call not yet connected
        if currentCallState?.state != .connected {
            var buffer = pendingIceCandidates[candidate.callID] ?? []
            buffer.append(candidate)
            pendingIceCandidates[candidate.callID] = buffer
            return
        }

        await processIceCandidate(candidate)
    }

    /// Handle call hangup
    public func handleCallHangup(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let hangup = try? decoder.decode(CallHangup.self, from: data) else {
            logger.warning("Failed to decode call hangup")
            return
        }

        // Check if this is for incoming or current call
        if let call = incomingCall, call.callId == hangup.callID {
            incomingCall = nil

            // Report to CallKit
            if let callUUID = callIdToUUID[hangup.callID] {
                callKitManager.reportCallEnded(callId: callUUID, reason: .remoteEnded)
                unmapCallId(hangup.callID)
            }

            var historyCopy = call
            historyCopy.state = .ended
            historyCopy.endedAt = Date()
            historyCopy.endReason = hangup.reason
            try? await store.saveCallState(historyCopy)

            logger.info("Incoming call cancelled: \(hangup.callID)")
        } else if var call = currentCallState, call.callId == hangup.callID {
            await cleanupWebRTC()

            // Report to CallKit
            if let callUUID = callIdToUUID[hangup.callID] {
                let reason: CXCallEndedReason
                switch hangup.reason {
                case .busy:
                    reason = .unanswered
                case .rejected:
                    reason = .declinedElsewhere
                default:
                    reason = .remoteEnded
                }
                callKitManager.reportCallEnded(callId: callUUID, reason: reason)
                unmapCallId(hangup.callID)
            }

            call.state = .ended
            call.endedAt = Date()
            call.endReason = hangup.reason

            try? await store.saveCallState(call)
            currentCallState = nil

            logger.info("Call ended by remote: \(hangup.callID)")
        }
    }

    /// Handle group call creation
    public func handleGroupCallCreate(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let create = try? decoder.decode(GroupCallCreate.self, from: data) else {
            logger.warning("Failed to decode group call create")
            return
        }

        try? await store.saveGroupCall(
            roomId: create.roomID,
            groupId: create.groupID,
            callType: create.callType,
            createdBy: create.createdBy
        )

        logger.info("Group call created: \(create.roomID)")
    }

    /// Handle group call join
    public func handleGroupCallJoin(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let join = try? decoder.decode(GroupCallJoin.self, from: data) else {
            logger.warning("Failed to decode group call join")
            return
        }

        let participant = GroupCallParticipant(
            audioEnabled: true,
            displayName: join.displayName,
            isHost: false,
            isSpeaking: false,
            joinedAt: join.timestamp,
            pubkey: join.pubkey,
            screenSharing: false,
            state: .connected,
            videoEnabled: false
        )

        groupParticipants.append(participant)

        logger.info("Participant joined: \(join.pubkey.prefix(8))")
    }

    /// Handle group call leave
    public func handleGroupCallLeave(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let leave = try? decoder.decode(GroupCallLeave.self, from: data) else {
            logger.warning("Failed to decode group call leave")
            return
        }

        groupParticipants.removeAll { $0.pubkey == leave.pubkey }

        logger.info("Participant left: \(leave.pubkey.prefix(8))")
    }

    /// Handle sender key distribution for E2EE group calls
    public func handleSenderKeyDistribution(_ event: NostrEvent) async {
        let decoder = JSONDecoder()

        guard let data = event.content.data(using: .utf8),
              let _ = try? decoder.decode(SenderKeyDistribution.self, from: data) else {
            logger.warning("Failed to decode sender key distribution")
            return
        }

        // Process sender key for E2EE (placeholder - actual implementation needed)
        logger.info("Received sender key distribution")
    }

    // MARK: - Private Methods

    private func configureAudioSession(for callType: CallType) throws {
        try audioSession.setCategory(
            .playAndRecord,
            mode: callType == .video ? .videoChat : .voiceChat,
            options: [.allowBluetooth, .allowBluetoothA2DP]
        )
        try audioSession.setActive(true)
    }

    private func initializeWebRTC(callType: CallType) async throws {
        // Create WebRTC manager
        let manager = WebRTCManager()
        manager.delegate = self
        manager.initialize()

        // Get local media stream
        let hasVideo = callType == .video
        let stream = try await manager.getLocalStream(hasVideo: hasVideo)

        // Store video track for UI
        if let videoTrack = stream.videoTracks.first {
            localVideoTrack = videoTrack
        }

        webRTCManager = manager
        logger.info("WebRTC initialized")
    }

    private func createSDPOffer() async throws -> String {
        guard let manager = webRTCManager else {
            throw CallingError.connectionFailed
        }

        let sdp = try await manager.createOffer()
        return sdp.sdp
    }

    private func createSDPAnswer() async throws -> String {
        guard let manager = webRTCManager else {
            throw CallingError.connectionFailed
        }

        let sdp = try await manager.createAnswer()
        return sdp.sdp
    }

    private func processRemoteSDP(_ sdp: String, type: RTCSdpType) async throws {
        guard let manager = webRTCManager else {
            throw CallingError.connectionFailed
        }

        let rtcSdp = RTCSessionDescription(type: type, sdp: sdp)
        try await manager.setRemoteDescription(rtcSdp)
        logger.debug("Remote SDP processed")
    }

    private func processIceCandidate(_ candidate: CallIceCandidate) async {
        guard let manager = webRTCManager else {
            logger.warning("No WebRTC manager to process ICE candidate")
            return
        }

        let rtcCandidate = RTCIceCandidate(
            sdp: candidate.candidate.candidate,
            sdpMLineIndex: Int32(candidate.candidate.sdpMLineIndex ?? 0),
            sdpMid: candidate.candidate.sdpMid
        )

        do {
            try await manager.addIceCandidate(rtcCandidate)
            logger.debug("ICE candidate processed")
        } catch {
            logger.error("Failed to process ICE candidate: \(error.localizedDescription)")
        }
    }

    private func cleanupWebRTC() async {
        webRTCManager?.close()
        webRTCManager = nil

        localVideoTrack = nil
        remoteVideoTrack = nil

        try? audioSession.setActive(false)

        logger.debug("WebRTC cleaned up")
    }
}

// MARK: - WebRTCManagerDelegate

extension CallingService: WebRTCManagerDelegate {
    func webRTCManager(_ manager: WebRTCManager, didGenerateIceCandidate candidate: RTCIceCandidate) {
        guard let callState = currentCallState else { return }

        Task {
            let iceCandidate = CallIceCandidate(
                v: CallingSchema.version,
                callID: callState.callId,
                candidate: IceCandidateClass(
                    candidate: candidate.sdp,
                    sdpMLineIndex: Int(candidate.sdpMLineIndex),
                    sdpMid: candidate.sdpMid,
                    usernameFragment: nil
                ),
                timestamp: Int(Date().timeIntervalSince1970)
            )

            let encoder = JSONEncoder()
            if let data = try? encoder.encode(iceCandidate),
               let content = String(data: data, encoding: .utf8) {
                _ = try? await nostrClient.sendDirectMessage(content, to: callState.remotePubkey)
            }
        }
    }

    func webRTCManager(_ manager: WebRTCManager, didChangeConnectionState state: RTCIceConnectionState) {
        switch state {
        case .connected:
            currentCallState?.state = .connected
            currentCallState?.connectedAt = Date()

            // Report connected to CallKit
            if let callId = currentCallState?.callId, let callUUID = callIdToUUID[callId] {
                if currentCallState?.direction == .outgoing {
                    callKitManager.reportOutgoingCallConnected(callId: callUUID)
                } else {
                    callKitManager.reportCallConnected(callId: callUUID)
                }
            }
        case .disconnected, .failed:
            currentCallState?.state = .reconnecting
        case .closed:
            // Connection closed
            break
        default:
            break
        }
    }

    func webRTCManager(_ manager: WebRTCManager, didReceiveRemoteStream stream: RTCMediaStream) {
        if let videoTrack = stream.videoTracks.first {
            remoteVideoTrack = videoTrack
        }
    }

    func webRTCManager(_ manager: WebRTCManager, didRemoveRemoteStream stream: RTCMediaStream) {
        remoteVideoTrack = nil
    }

    func webRTCManagerDidNeedNegotiation(_ manager: WebRTCManager) {
        // Handle renegotiation if needed
        logger.debug("Negotiation needed")
    }
}

// MARK: - CallKit UUID Mapping

extension CallingService {
    /// Map a string call ID to a UUID for CallKit
    private func mapCallIdToUUID(_ callId: String) -> UUID {
        if let existing = callIdToUUID[callId] {
            return existing
        }
        let uuid = UUID()
        callIdToUUID[callId] = uuid
        uuidToCallId[uuid] = callId
        return uuid
    }

    /// Remove the mapping for a call ID
    private func unmapCallId(_ callId: String) {
        if let uuid = callIdToUUID.removeValue(forKey: callId) {
            uuidToCallId.removeValue(forKey: uuid)
        }
    }
}

// MARK: - CallKitManagerDelegate

extension CallingService: CallKitManagerDelegate {
    func callKitManager(_ manager: CallKitManager, didAcceptCall callId: UUID) {
        guard let stringCallId = uuidToCallId[callId] else {
            logger.warning("CallKit accepted unknown call UUID: \(callId)")
            return
        }

        Task {
            do {
                try await acceptCall(stringCallId)
            } catch {
                logger.error("Failed to accept call from CallKit: \(error.localizedDescription)")
            }
        }
    }

    func callKitManager(_ manager: CallKitManager, didDeclineCall callId: UUID) {
        guard let stringCallId = uuidToCallId[callId] else {
            logger.warning("CallKit declined unknown call UUID: \(callId)")
            return
        }

        Task {
            do {
                try await declineCall(stringCallId, reason: .rejected)
            } catch {
                logger.error("Failed to decline call from CallKit: \(error.localizedDescription)")
            }
        }
    }

    func callKitManager(_ manager: CallKitManager, didEndCall callId: UUID) {
        guard let stringCallId = uuidToCallId[callId] else {
            logger.warning("CallKit ended unknown call UUID: \(callId)")
            return
        }

        Task {
            do {
                try await endCall(stringCallId, reason: .completed)
            } catch {
                logger.error("Failed to end call from CallKit: \(error.localizedDescription)")
            }
        }
    }

    func callKitManager(_ manager: CallKitManager, didMuteCall callId: UUID, muted: Bool) {
        guard let stringCallId = uuidToCallId[callId] else { return }

        Task {
            if (currentCallState?.isMuted ?? false) != muted {
                await toggleMute(stringCallId)
            }
        }
    }

    func callKitManager(_ manager: CallKitManager, didHoldCall callId: UUID, onHold: Bool) {
        guard let stringCallId = uuidToCallId[callId] else { return }

        // Update local state to reflect hold status from CallKit
        if var call = currentCallState, call.callId == stringCallId {
            call.state = onHold ? .onHold : .connected
            currentCallState = call
        }

        logger.debug("Call \(stringCallId) hold state: \(onHold)")
    }
}

/// Errors related to calling
public enum CallingError: LocalizedError {
    case noKeyPair
    case callNotFound
    case invalidSignalingData
    case connectionFailed
    case alreadyInCall

    public var errorDescription: String? {
        switch self {
        case .noKeyPair:
            return "No key pair available"
        case .callNotFound:
            return "Call not found"
        case .invalidSignalingData:
            return "Invalid signaling data"
        case .connectionFailed:
            return "Connection failed"
        case .alreadyInCall:
            return "Already in a call"
        }
    }
}
