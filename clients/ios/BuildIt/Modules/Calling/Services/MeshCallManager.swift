// MeshCallManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages peer-to-peer mesh topology for small group calls (2-8 participants).
// Each participant connects directly to every other participant with full E2EE.

import Foundation
import WebRTC
import Combine
import os.log

/// Maximum participants for mesh topology
private let maxMeshParticipants = 8

/// Connection timeout in seconds
private let connectionTimeoutSeconds: TimeInterval = 30

/// Events emitted by MeshCallManager
public enum MeshCallEvent {
    case participantJoined(pubkey: String, displayName: String?)
    case participantLeft(pubkey: String)
    case participantStateChanged(pubkey: String, state: ParticipantState)
    case remoteTrack(pubkey: String, track: RTCMediaStreamTrack)
    case activeSpeakersChanged(speakers: [String])
    case dominantSpeakerChanged(speaker: String?)
    case connectionStateChanged(state: ConnectionState)
    case roomClosed(reason: String)
    case error(Error)
}

/// Connection state
public enum ConnectionState {
    case connecting
    case connected
    case disconnected
}

/// Participant state in group call
public struct ParticipantState {
    let audioEnabled: Bool
    let videoEnabled: Bool
    let screenSharing: Bool
    let isSpeaking: Bool
}

/// Peer connection info
private struct PeerConnection {
    let connection: RTCPeerConnection
    let pubkey: String
    var displayName: String?
    var state: PeerState = .connecting
    var audioEnabled: Bool = true
    var videoEnabled: Bool = true
    var remoteStream: RTCMediaStream?
    var pendingIceCandidates: [RTCIceCandidate] = []

    enum PeerState {
        case connecting
        case connected
        case disconnected
        case failed
    }
}

/// Mesh Call Manager for group calls
@MainActor
public class MeshCallManager: ObservableObject {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "MeshCallManager")

    // Room state
    @Published public private(set) var roomId: String?
    @Published public private(set) var groupId: String?
    @Published public private(set) var callType: CallType = .voice
    @Published public private(set) var isHost: Bool = false
    @Published public private(set) var isRoomLocked: Bool = false

    // Local state
    @Published public private(set) var localPubkey: String = ""
    @Published public private(set) var localDisplayName: String?
    @Published public private(set) var localStream: RTCMediaStream?
    @Published public private(set) var isMuted: Bool = false
    @Published public private(set) var isVideoEnabled: Bool = true
    @Published public private(set) var isScreenSharing: Bool = false

    // Participants
    @Published public private(set) var participants: [String: ParticipantInfo] = [:]

    // Connection state
    @Published public private(set) var connectionState: ConnectionState = .disconnected

    // Event publisher
    public let events = PassthroughSubject<MeshCallEvent, Never>()

    // WebRTC
    private let factory: RTCPeerConnectionFactory
    private var peerConnections: [String: PeerConnection] = [:]
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?

    // E2EE
    private var keyManager: GroupKeyManager?

    // Audio
    private let audioMixer = AudioMixer()
    private let speakerDetector = ActiveSpeakerDetector()
    private var audioLevelTimer: Timer?

    // Call duration
    private var callStartTime: Date?
    @Published public private(set) var callDuration: TimeInterval = 0
    private var durationTimer: Timer?

    // MARK: - Types

    public struct ParticipantInfo: Identifiable {
        public let id: String // pubkey
        public let pubkey: String
        public var displayName: String?
        public var audioEnabled: Bool
        public var videoEnabled: Bool
        public var isSpeaking: Bool
        public var videoTrack: RTCVideoTrack?
    }

    // MARK: - Initialization

    public init() {
        RTCInitializeSSL()

        let encoderFactory = RTCDefaultVideoEncoderFactory()
        let decoderFactory = RTCDefaultVideoDecoderFactory()
        self.factory = RTCPeerConnectionFactory(
            encoderFactory: encoderFactory,
            decoderFactory: decoderFactory
        )

        // Set up speaker detector callbacks
        speakerDetector.onActiveSpeakersChanged = { [weak self] speakers in
            self?.handleActiveSpeakersChanged(speakers)
        }
        speakerDetector.onDominantSpeakerChanged = { [weak self] speaker in
            self?.handleDominantSpeakerChanged(speaker)
        }

        logger.info("MeshCallManager initialized")
    }

    deinit {
        close()
    }

    // MARK: - Room Management

    /// Create a new group call room
    public func createRoom(
        groupId: String? = nil,
        callType: CallType = .voice,
        maxParticipants: Int = maxMeshParticipants,
        invitedPubkeys: [String]? = nil
    ) async throws -> String {
        guard roomId == nil else {
            throw MeshCallError.alreadyInRoom
        }

        let newRoomId = UUID().uuidString.lowercased()
        self.roomId = newRoomId
        self.groupId = groupId
        self.callType = callType
        self.isHost = true

        // Initialize key manager
        keyManager = GroupKeyManager(roomId: newRoomId)

        // Acquire local media
        try await acquireLocalMedia()

        // Start room subscription
        startRoomSubscription()

        // Broadcast room creation
        try await broadcastRoomCreate(
            roomId: newRoomId,
            groupId: groupId,
            callType: callType,
            maxParticipants: maxParticipants,
            invitedPubkeys: invitedPubkeys
        )

        // Generate sender key
        await keyManager?.generateAndDistributeSenderKey(participants: [localPubkey])

        // Start timers
        startTimers()

        logger.info("Created group call room: \(newRoomId)")
        return newRoomId
    }

    /// Join an existing group call room
    public func joinRoom(_ roomId: String, displayName: String? = nil) async throws {
        guard self.roomId == nil else {
            throw MeshCallError.alreadyInRoom
        }

        self.roomId = roomId
        self.localDisplayName = displayName
        self.isHost = false

        // Initialize key manager
        keyManager = GroupKeyManager(roomId: roomId)

        // Acquire local media
        try await acquireLocalMedia()

        // Start room subscription
        startRoomSubscription()

        // Broadcast join
        try await broadcastJoin()

        // Start timers
        startTimers()

        logger.info("Joined group call room: \(roomId)")
    }

    /// Leave the current room
    public func leaveRoom() async {
        guard roomId != nil else { return }

        // Broadcast leave
        try? await broadcastLeave()

        // Clean up
        cleanup()

        logger.info("Left group call room")
    }

    // MARK: - Peer Management

    /// Handle new participant joining
    private func handleParticipantJoined(pubkey: String, displayName: String?) async {
        guard pubkey != localPubkey else { return }
        guard peerConnections[pubkey] == nil else { return }

        logger.info("Participant joined: \(pubkey)")

        // Add to participants list
        participants[pubkey] = ParticipantInfo(
            id: pubkey,
            pubkey: pubkey,
            displayName: displayName,
            audioEnabled: true,
            videoEnabled: callType == .video,
            isSpeaking: false
        )

        // Determine who initiates (lower pubkey initiates)
        if localPubkey < pubkey {
            await connectToPeer(pubkey: pubkey, displayName: displayName)
        }

        events.send(.participantJoined(pubkey: pubkey, displayName: displayName))

        // Redistribute sender key
        if let keyManager = keyManager {
            let allParticipants = [localPubkey] + Array(peerConnections.keys) + [pubkey]
            await keyManager.generateAndDistributeSenderKey(participants: allParticipants)
        }
    }

    /// Handle participant leaving
    private func handleParticipantLeft(pubkey: String) async {
        guard pubkey != localPubkey else { return }

        logger.info("Participant left: \(pubkey)")

        // Clean up peer connection
        cleanupPeer(pubkey)

        // Remove from participants
        participants.removeValue(forKey: pubkey)

        events.send(.participantLeft(pubkey: pubkey))

        // Rotate sender key for forward secrecy
        if let keyManager = keyManager {
            let remaining = [localPubkey] + Array(peerConnections.keys)
            await keyManager.handleParticipantLeft(pubkey, remainingParticipants: remaining)
        }
    }

    /// Connect to a peer
    private func connectToPeer(pubkey: String, displayName: String? = nil) async {
        guard peerConnections[pubkey] == nil else {
            logger.warning("Already connected to peer: \(pubkey)")
            return
        }

        logger.info("Connecting to peer: \(pubkey)")

        // Create peer connection
        guard let pc = createPeerConnection(for: pubkey) else {
            logger.error("Failed to create peer connection for: \(pubkey)")
            return
        }

        var peer = PeerConnection(
            connection: pc,
            pubkey: pubkey,
            displayName: displayName
        )

        // Add local tracks
        if let audioTrack = localAudioTrack {
            pc.add(audioTrack, streamIds: ["local"])
        }
        if let videoTrack = localVideoTrack {
            pc.add(videoTrack, streamIds: ["local"])
        }

        peerConnections[pubkey] = peer

        // Create and send offer
        do {
            let offer = try await pc.offer(for: RTCMediaConstraints(
                mandatoryConstraints: nil,
                optionalConstraints: nil
            ))
            try await pc.setLocalDescription(offer)

            try await sendSignalingMessage(to: pubkey, type: .offer, data: [
                "roomId": roomId ?? "",
                "sdp": offer.sdp,
                "callType": callType.rawValue
            ])
        } catch {
            logger.error("Failed to create offer: \(error.localizedDescription)")
            cleanupPeer(pubkey)
        }

        // Set connection timeout
        Task {
            try? await Task.sleep(nanoseconds: UInt64(connectionTimeoutSeconds * 1_000_000_000))
            if let peer = peerConnections[pubkey], peer.state == .connecting {
                logger.warning("Connection timeout: \(pubkey)")
                cleanupPeer(pubkey)
                events.send(.error(MeshCallError.connectionTimeout))
            }
        }
    }

    /// Handle incoming offer
    private func handleOffer(from pubkey: String, sdp: String, callType: CallType) async {
        // Lower pubkey should initiate - if we receive from higher pubkey, ignore
        guard pubkey < localPubkey else {
            logger.warning("Received offer from higher pubkey (they shouldn't initiate): \(pubkey)")
            return
        }

        guard peerConnections[pubkey] == nil else {
            logger.warning("Already have connection to peer: \(pubkey)")
            return
        }

        logger.info("Received offer from peer: \(pubkey)")

        // Create peer connection
        guard let pc = createPeerConnection(for: pubkey) else {
            logger.error("Failed to create peer connection for: \(pubkey)")
            return
        }

        var peer = PeerConnection(
            connection: pc,
            pubkey: pubkey,
            videoEnabled: callType == .video
        )

        // Add local tracks
        if let audioTrack = localAudioTrack {
            pc.add(audioTrack, streamIds: ["local"])
        }
        if let videoTrack = localVideoTrack {
            pc.add(videoTrack, streamIds: ["local"])
        }

        peerConnections[pubkey] = peer

        // Set remote description and create answer
        do {
            let remoteDesc = RTCSessionDescription(type: .offer, sdp: sdp)
            try await pc.setRemoteDescription(remoteDesc)

            // Process pending ICE candidates
            for candidate in peer.pendingIceCandidates {
                try await pc.add(candidate)
            }
            peerConnections[pubkey]?.pendingIceCandidates = []

            let answer = try await pc.answer(for: RTCMediaConstraints(
                mandatoryConstraints: nil,
                optionalConstraints: nil
            ))
            try await pc.setLocalDescription(answer)

            try await sendSignalingMessage(to: pubkey, type: .answer, data: [
                "roomId": roomId ?? "",
                "sdp": answer.sdp
            ])
        } catch {
            logger.error("Failed to handle offer: \(error.localizedDescription)")
            cleanupPeer(pubkey)
        }
    }

    /// Handle incoming answer
    private func handleAnswer(from pubkey: String, sdp: String) async {
        guard var peer = peerConnections[pubkey] else {
            logger.warning("Received answer for unknown peer: \(pubkey)")
            return
        }

        logger.info("Received answer from peer: \(pubkey)")

        do {
            let remoteDesc = RTCSessionDescription(type: .answer, sdp: sdp)
            try await peer.connection.setRemoteDescription(remoteDesc)

            // Process pending ICE candidates
            for candidate in peer.pendingIceCandidates {
                try await peer.connection.add(candidate)
            }
            peerConnections[pubkey]?.pendingIceCandidates = []
        } catch {
            logger.error("Failed to handle answer: \(error.localizedDescription)")
        }
    }

    /// Handle incoming ICE candidate
    private func handleIceCandidate(from pubkey: String, candidate: RTCIceCandidate) async {
        guard var peer = peerConnections[pubkey] else {
            // Store for later if we don't have the peer connection yet
            return
        }

        if peer.connection.remoteDescription != nil {
            do {
                try await peer.connection.add(candidate)
            } catch {
                logger.error("Failed to add ICE candidate: \(error.localizedDescription)")
            }
        } else {
            peerConnections[pubkey]?.pendingIceCandidates.append(candidate)
        }
    }

    // MARK: - Local Media

    /// Acquire local media (audio/video)
    private func acquireLocalMedia() async throws {
        let audioSource = factory.audioSource(with: nil)
        localAudioTrack = factory.audioTrack(with: audioSource, trackId: "audio0")
        localAudioTrack?.isEnabled = !isMuted

        if callType == .video {
            #if !targetEnvironment(simulator)
            let videoSource = factory.videoSource()
            let capturer = RTCCameraVideoCapturer(delegate: videoSource)

            // Get front camera
            guard let frontCamera = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front }) else {
                throw MeshCallError.noCameraAvailable
            }

            // Get suitable format
            let format = RTCCameraVideoCapturer.supportedFormats(for: frontCamera)
                .filter { format in
                    let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
                    return dimensions.width <= 1280 && dimensions.height <= 720
                }
                .max { a, b in
                    let aDims = CMVideoFormatDescriptionGetDimensions(a.formatDescription)
                    let bDims = CMVideoFormatDescriptionGetDimensions(b.formatDescription)
                    return aDims.width * aDims.height < bDims.width * bDims.height
                }

            guard let selectedFormat = format else {
                throw MeshCallError.noCameraAvailable
            }

            // Start capture
            let fps = selectedFormat.videoSupportedFrameRateRanges
                .max { $0.maxFrameRate < $1.maxFrameRate }?
                .maxFrameRate ?? 30

            capturer.startCapture(with: frontCamera, format: selectedFormat, fps: Int(fps))

            localVideoTrack = factory.videoTrack(with: videoSource, trackId: "video0")
            localVideoTrack?.isEnabled = isVideoEnabled
            #endif
        }

        // Create local stream
        localStream = factory.mediaStream(withStreamId: "local")
        if let audio = localAudioTrack {
            localStream?.addAudioTrack(audio)
        }
        if let video = localVideoTrack {
            localStream?.addVideoTrack(video)
        }

        logger.info("Acquired local media: audio=\(localAudioTrack != nil), video=\(localVideoTrack != nil)")
    }

    // MARK: - Controls

    /// Toggle mute
    @discardableResult
    public func toggleMute() -> Bool {
        isMuted.toggle()
        localAudioTrack?.isEnabled = !isMuted

        // Broadcast state change
        broadcastStateChange(audioEnabled: !isMuted)

        return isMuted
    }

    /// Toggle video
    @discardableResult
    public func toggleVideo() -> Bool {
        isVideoEnabled.toggle()
        localVideoTrack?.isEnabled = isVideoEnabled

        // Broadcast state change
        broadcastStateChange(videoEnabled: isVideoEnabled)

        return isVideoEnabled
    }

    /// Start screen sharing (not implemented for iOS)
    public func startScreenShare() async throws {
        throw MeshCallError.screenShareNotSupported
    }

    /// Stop screen sharing
    public func stopScreenShare() async {
        // Not implemented for iOS
    }

    /// Request mute from participant (host only)
    public func requestMute(_ pubkey: String) async throws {
        guard isHost else {
            throw MeshCallError.hostOnly
        }

        try await sendSignalingMessage(to: pubkey, type: .muteRequest, data: ["roomId": roomId ?? ""])
    }

    /// Remove participant (host only)
    public func removeParticipant(_ pubkey: String) async throws {
        guard isHost else {
            throw MeshCallError.hostOnly
        }

        try await sendSignalingMessage(to: pubkey, type: .remove, data: ["roomId": roomId ?? ""])
        cleanupPeer(pubkey)
        participants.removeValue(forKey: pubkey)
        events.send(.participantLeft(pubkey: pubkey))
    }

    /// Lock the room (host only)
    public func lockRoom() throws {
        guard isHost else {
            throw MeshCallError.hostOnly
        }
        isRoomLocked = true
        broadcastRoomState(locked: true)
    }

    /// Unlock the room (host only)
    public func unlockRoom() throws {
        guard isHost else {
            throw MeshCallError.hostOnly
        }
        isRoomLocked = false
        broadcastRoomState(locked: false)
    }

    /// End the call for everyone (host only)
    public func endCall() async throws {
        guard isHost else {
            throw MeshCallError.hostOnly
        }

        for pubkey in peerConnections.keys {
            try? await sendSignalingMessage(to: pubkey, type: .end, data: ["roomId": roomId ?? ""])
        }

        cleanup()
        events.send(.roomClosed(reason: "host_ended"))
    }

    // MARK: - WebRTC Helpers

    /// Create a peer connection for a remote peer
    private func createPeerConnection(for pubkey: String) -> RTCPeerConnection? {
        let config = RTCConfiguration()
        config.iceServers = [
            RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"])
        ]
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )

        guard let pc = factory.peerConnection(with: config, constraints: constraints, delegate: nil) else {
            return nil
        }

        // Set up ICE candidate handling
        // Note: In real implementation, would use delegate pattern

        return pc
    }

    // MARK: - Signaling

    private enum SignalingType: String {
        case offer
        case answer
        case ice
        case state
        case muteRequest = "mute-request"
        case remove
        case end
    }

    private func sendSignalingMessage(to pubkey: String, type: SignalingType, data: [String: Any]) async throws {
        // In real implementation, send via Nostr NIP-17 gift wrap
        logger.debug("Send signaling to \(pubkey): \(type.rawValue)")
    }

    private func startRoomSubscription() {
        // In real implementation, subscribe to Nostr events for room
        logger.info("Started room subscription")
    }

    private func broadcastRoomCreate(
        roomId: String,
        groupId: String?,
        callType: CallType,
        maxParticipants: Int,
        invitedPubkeys: [String]?
    ) async throws {
        // In real implementation, broadcast via Nostr
        logger.info("Broadcast room create: \(roomId)")
    }

    private func broadcastJoin() async throws {
        // In real implementation, broadcast via Nostr
        logger.info("Broadcast join")
    }

    private func broadcastLeave() async throws {
        // In real implementation, broadcast via Nostr
        logger.info("Broadcast leave")
    }

    private func broadcastStateChange(audioEnabled: Bool? = nil, videoEnabled: Bool? = nil, screenSharing: Bool? = nil) {
        // In real implementation, broadcast state change to all peers
        logger.debug("Broadcast state change")
    }

    private func broadcastRoomState(locked: Bool) {
        // In real implementation, broadcast room state change
        logger.debug("Broadcast room state: locked=\(locked)")
    }

    // MARK: - Speaker Detection

    private func handleActiveSpeakersChanged(_ speakers: [String]) {
        for (pubkey, _) in participants {
            participants[pubkey]?.isSpeaking = speakers.contains(pubkey)
        }
        events.send(.activeSpeakersChanged(speakers: speakers))
    }

    private func handleDominantSpeakerChanged(_ speaker: String?) {
        events.send(.dominantSpeakerChanged(speaker: speaker))
    }

    // MARK: - Timers

    private func startTimers() {
        callStartTime = Date()

        // Duration timer
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, let start = self.callStartTime else { return }
                self.callDuration = Date().timeIntervalSince(start)
            }
        }

        // Audio level timer
        audioLevelTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateAudioLevels()
            }
        }
    }

    private func updateAudioLevels() {
        // In real implementation, get audio levels from audio mixer
        // and update speaker detector
    }

    // MARK: - Cleanup

    /// Clean up a specific peer
    private func cleanupPeer(_ pubkey: String) {
        if let peer = peerConnections[pubkey] {
            peer.connection.close()
        }
        peerConnections.removeValue(forKey: pubkey)
        audioMixer.removeParticipant(pubkey)
        speakerDetector.removeParticipant(pubkey)
    }

    /// Clean up all resources
    private func cleanup() {
        // Stop timers
        durationTimer?.invalidate()
        durationTimer = nil
        audioLevelTimer?.invalidate()
        audioLevelTimer = nil

        // Close all peer connections
        for pubkey in peerConnections.keys {
            cleanupPeer(pubkey)
        }

        // Stop local tracks
        localAudioTrack = nil
        localVideoTrack = nil
        localStream = nil

        // Close key manager
        keyManager = nil

        // Clear audio
        audioMixer.close()
        speakerDetector.clear()

        // Reset state
        roomId = nil
        groupId = nil
        isHost = false
        isRoomLocked = false
        isMuted = false
        isVideoEnabled = true
        isScreenSharing = false
        participants.removeAll()
        connectionState = .disconnected
        callStartTime = nil
        callDuration = 0
    }

    /// Close the manager
    public func close() {
        cleanup()
        logger.info("MeshCallManager closed")
    }

    // MARK: - Getters

    public var participantCount: Int {
        return participants.count + 1 // +1 for self
    }

    public var isAtCapacity: Bool {
        return participantCount >= maxMeshParticipants
    }
}

// MARK: - Errors

public enum MeshCallError: LocalizedError {
    case alreadyInRoom
    case notInRoom
    case connectionTimeout
    case noCameraAvailable
    case screenShareNotSupported
    case hostOnly
    case signalingFailed

    public var errorDescription: String? {
        switch self {
        case .alreadyInRoom:
            return "Already in a room"
        case .notInRoom:
            return "Not in a room"
        case .connectionTimeout:
            return "Connection timed out"
        case .noCameraAvailable:
            return "No camera available"
        case .screenShareNotSupported:
            return "Screen sharing is not supported on iOS"
        case .hostOnly:
            return "Only the host can perform this action"
        case .signalingFailed:
            return "Signaling failed"
        }
    }
}

// MARK: - Supporting Types

/// Call type enum
public enum CallType: String, Codable {
    case voice
    case video
}

/// Group Key Manager placeholder
private class GroupKeyManager {
    let roomId: String

    init(roomId: String) {
        self.roomId = roomId
    }

    func generateAndDistributeSenderKey(participants: [String]) async {
        // Implementation in separate file
    }

    func handleParticipantLeft(_ pubkey: String, remainingParticipants: [String]) async {
        // Implementation in separate file
    }
}

/// Audio Mixer placeholder
private class AudioMixer {
    func removeParticipant(_ pubkey: String) {}
    func close() {}
}

/// Active Speaker Detector placeholder
private class ActiveSpeakerDetector {
    var onActiveSpeakersChanged: (([String]) -> Void)?
    var onDominantSpeakerChanged: ((String?) -> Void)?

    func removeParticipant(_ pubkey: String) {}
    func clear() {}
}
