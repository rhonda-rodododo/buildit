// SFUConferenceManager.swift
// BuildIt - SFU-based Conference Calls
//
// Manages SFU topology conferences for 50+ participants with MLS E2EE,
// simulcast encoding, and multi-region support.

import Foundation
import WebRTC
import Combine
import os.log

/// Maximum participants for SFU conference
private let maxConferenceParticipants = 100

/// Reconnection timeout in seconds
private let reconnectionTimeoutSeconds: TimeInterval = 30

/// Events emitted by SFUConferenceManager
public enum ConferenceEvent {
    case participantJoined(pubkey: String, displayName: String?, role: ParticipantRole)
    case participantLeft(pubkey: String)
    case participantStateChanged(pubkey: String, state: ConferenceParticipantState)
    case trackSubscribed(pubkey: String, track: RTCMediaStreamTrack, kind: TrackKind)
    case trackUnsubscribed(pubkey: String, kind: TrackKind)
    case activeSpeakerChanged(pubkey: String?)
    case qualityChanged(pubkey: String, quality: QualityLayer)
    case connectionStateChanged(state: SFUConnectionState)
    case mlsEpochChanged(epoch: Int)
    case roomClosed(reason: String)
    case error(Error)
}

/// Track kind
public enum TrackKind: String {
    case audio
    case video
    case screenShare = "screen"
}

/// SFU connection state
public enum SFUConnectionState {
    case disconnected
    case connecting
    case connected
    case reconnecting
    case failed
}

/// Quality layer for simulcast
public enum QualityLayer: String, Codable {
    case low
    case medium
    case high
}

/// Participant role
public enum ParticipantRole: String, Codable {
    case host
    case coHost = "co_host"
    case moderator
    case participant
    case viewer
}

/// Participant state
public struct ConferenceParticipantState {
    public let audioEnabled: Bool
    public let videoEnabled: Bool
    public let screenSharing: Bool
    public let handRaised: Bool
    public let isSpeaking: Bool
}

/// SFU Conference Manager
@MainActor
public class SFUConferenceManager: ObservableObject {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "SFUConferenceManager")

    // Room state
    @Published public private(set) var roomId: String?
    @Published public private(set) var isHost: Bool = false
    @Published public private(set) var localRole: ParticipantRole = .participant
    @Published public private(set) var connectionState: SFUConnectionState = .disconnected

    // Local state
    @Published public private(set) var localPubkey: String = ""
    @Published public private(set) var localDisplayName: String?
    @Published public private(set) var isMuted: Bool = false
    @Published public private(set) var isVideoEnabled: Bool = true
    @Published public private(set) var isScreenSharing: Bool = false

    // Participants
    @Published public private(set) var participants: [String: ConferenceParticipant] = [:]

    // Conference settings
    @Published public private(set) var waitingRoomEnabled: Bool = true
    @Published public private(set) var muteOnJoin: Bool = true
    @Published public private(set) var hostOnlyScreenShare: Bool = false

    // Event publisher
    public let events = PassthroughSubject<ConferenceEvent, Never>()

    // WebRTC
    private let factory: RTCPeerConnectionFactory
    private var sfuConnection: RTCPeerConnection?
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?
    private var audioSender: RTCRtpSender?
    private var videoSender: RTCRtpSender?

    // E2EE (MLS)
    private var mlsKeyManager: MLSKeyManager?

    // Simulcast
    private var simulcastManager: SimulcastManager?

    // Call duration
    private var callStartTime: Date?
    @Published public private(set) var callDuration: TimeInterval = 0
    private var durationTimer: Timer?

    // Reconnection
    private var reconnectionAttempts = 0
    private let maxReconnectionAttempts = 5

    // MARK: - Types

    public struct ConferenceParticipant: Identifiable {
        public let id: String // pubkey
        public let pubkey: String
        public var displayName: String?
        public var role: ParticipantRole
        public var audioEnabled: Bool
        public var videoEnabled: Bool
        public var screenSharing: Bool
        public var handRaised: Bool
        public var isSpeaking: Bool
        public var subscribedQuality: QualityLayer
        public var videoTrack: RTCVideoTrack?
        public var screenShareTrack: RTCVideoTrack?
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

        logger.info("SFUConferenceManager initialized")
    }

    deinit {
        close()
    }

    // MARK: - Room Management

    /// Create a new conference room
    public func createConference(
        settings: ConferenceSettings = ConferenceSettings()
    ) async throws -> String {
        guard roomId == nil else {
            throw ConferenceError.alreadyInRoom
        }

        let newRoomId = UUID().uuidString.lowercased()
        self.roomId = newRoomId
        self.isHost = true
        self.localRole = .host
        self.waitingRoomEnabled = settings.waitingRoom
        self.muteOnJoin = settings.muteOnJoin
        self.hostOnlyScreenShare = settings.hostOnlyScreenShare

        // Initialize MLS key manager
        mlsKeyManager = MLSKeyManager(roomId: newRoomId, localPubkey: localPubkey)

        // Initialize simulcast manager
        simulcastManager = SimulcastManager()

        // Connect to SFU
        try await connectToSFU(roomId: newRoomId)

        // Initialize MLS group
        try await mlsKeyManager?.initializeGroup(participants: [localPubkey])

        // Start timers
        startTimers()

        connectionState = .connected
        events.send(.connectionStateChanged(state: .connected))

        logger.info("Created conference room: \(newRoomId)")
        return newRoomId
    }

    /// Join an existing conference
    public func joinConference(
        _ roomId: String,
        displayName: String? = nil
    ) async throws {
        guard self.roomId == nil else {
            throw ConferenceError.alreadyInRoom
        }

        self.roomId = roomId
        self.localDisplayName = displayName
        self.isHost = false
        self.localRole = .participant

        connectionState = .connecting
        events.send(.connectionStateChanged(state: .connecting))

        // Initialize MLS key manager
        mlsKeyManager = MLSKeyManager(roomId: roomId, localPubkey: localPubkey)

        // Initialize simulcast manager
        simulcastManager = SimulcastManager()

        // Connect to SFU
        try await connectToSFU(roomId: roomId)

        // Join MLS group (receive welcome)
        // This happens when we receive the MLS welcome message

        // Start timers
        startTimers()

        connectionState = .connected
        events.send(.connectionStateChanged(state: .connected))

        logger.info("Joined conference room: \(roomId)")
    }

    /// Leave the conference
    public func leaveConference() async {
        guard roomId != nil else { return }

        // Notify SFU
        try? await notifySFULeaving()

        // Clean up
        cleanup()

        logger.info("Left conference room")
    }

    // MARK: - SFU Connection

    /// Connect to SFU server
    private func connectToSFU(roomId: String) async throws {
        // Create peer connection with simulcast configuration
        guard let pc = createSFUPeerConnection() else {
            throw ConferenceError.connectionFailed
        }

        sfuConnection = pc

        // Acquire local media
        try await acquireLocalMedia()

        // Add local tracks with simulcast encoding
        if let audioTrack = localAudioTrack {
            audioSender = pc.add(audioTrack, streamIds: ["local"])
        }

        if let videoTrack = localVideoTrack {
            let transceiver = pc.addTransceiver(of: .video)
            transceiver?.sender.track = videoTrack

            // Configure simulcast encodings
            if let sender = transceiver?.sender {
                videoSender = sender
                configureSimulcastEncodings(for: sender)
            }
        }

        // Create offer and send to SFU
        let offer = try await pc.offer(for: RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: nil
        ))
        try await pc.setLocalDescription(offer)

        // Send offer to SFU via signaling
        // In production, this would be via WebSocket/Nostr
        logger.info("SFU offer created")
    }

    /// Configure simulcast encodings
    private func configureSimulcastEncodings(for sender: RTCRtpSender) {
        let params = sender.parameters
        params.encodings = [
            createEncoding(rid: "low", maxBitrate: 150_000, scaleDown: 4),
            createEncoding(rid: "medium", maxBitrate: 500_000, scaleDown: 2),
            createEncoding(rid: "high", maxBitrate: 1_500_000, scaleDown: 1)
        ]
        sender.parameters = params
    }

    private func createEncoding(rid: String, maxBitrate: Int, scaleDown: Double) -> RTCRtpEncodingParameters {
        let encoding = RTCRtpEncodingParameters()
        encoding.rid = rid
        encoding.isActive = true
        encoding.maxBitrateBps = NSNumber(value: maxBitrate)
        encoding.scaleResolutionDownBy = NSNumber(value: scaleDown)
        return encoding
    }

    /// Create SFU peer connection
    private func createSFUPeerConnection() -> RTCPeerConnection? {
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

        return factory.peerConnection(with: config, constraints: constraints, delegate: nil)
    }

    // MARK: - MLS E2EE

    /// Handle MLS welcome message
    public func handleMLSWelcome(_ welcome: Data) async throws {
        try await mlsKeyManager?.handleWelcome(welcome)
        events.send(.mlsEpochChanged(epoch: mlsKeyManager?.getCurrentEpoch() ?? 0))
        logger.info("MLS welcome processed")
    }

    /// Handle MLS commit message
    public func handleMLSCommit(_ commit: Data, epoch: Int) async throws {
        try await mlsKeyManager?.handleCommit(commit, epoch: epoch)
        events.send(.mlsEpochChanged(epoch: epoch))
        logger.info("MLS commit processed, epoch: \(epoch)")
    }

    /// Add participant to MLS group (host only)
    public func addParticipantToMLS(pubkey: String, keyPackage: Data) async throws -> Data {
        guard isHost || localRole == .coHost else {
            throw ConferenceError.hostOnly
        }

        guard let mlsKeyManager = mlsKeyManager else {
            throw ConferenceError.mlsNotInitialized
        }

        let commit = try await mlsKeyManager.addParticipant(pubkey: pubkey, keyPackage: keyPackage)
        events.send(.mlsEpochChanged(epoch: mlsKeyManager.getCurrentEpoch()))
        return commit
    }

    /// Remove participant from MLS group (host only)
    public func removeParticipantFromMLS(pubkey: String) async throws -> Data {
        guard isHost || localRole == .coHost else {
            throw ConferenceError.hostOnly
        }

        guard let mlsKeyManager = mlsKeyManager else {
            throw ConferenceError.mlsNotInitialized
        }

        let commit = try await mlsKeyManager.removeParticipant(pubkey: pubkey)
        events.send(.mlsEpochChanged(epoch: mlsKeyManager.getCurrentEpoch()))
        return commit
    }

    // MARK: - Quality Management

    /// Set preferred quality for a participant
    public func setPreferredQuality(for pubkey: String, quality: QualityLayer) {
        guard var participant = participants[pubkey] else { return }
        participant.subscribedQuality = quality
        participants[pubkey] = participant

        // Notify SFU of preference change
        notifySFUQualityPreference(pubkey: pubkey, quality: quality)

        events.send(.qualityChanged(pubkey: pubkey, quality: quality))
        logger.debug("Set quality for \(pubkey): \(quality.rawValue)")
    }

    /// Calculate optimal quality based on tile size
    public func calculateOptimalQuality(
        tileWidth: CGFloat,
        tileHeight: CGFloat,
        participantCount: Int
    ) -> QualityLayer {
        let pixels = tileWidth * tileHeight

        if pixels >= 480000 {
            return .high
        } else if pixels >= 120000 {
            return .medium
        } else {
            return .low
        }
    }

    private func notifySFUQualityPreference(pubkey: String, quality: QualityLayer) {
        // In production, send via SFU signaling channel
        logger.debug("Notify SFU quality preference: \(pubkey) -> \(quality.rawValue)")
    }

    // MARK: - Local Media

    private func acquireLocalMedia() async throws {
        let audioSource = factory.audioSource(with: nil)
        localAudioTrack = factory.audioTrack(with: audioSource, trackId: "audio0")
        localAudioTrack?.isEnabled = !isMuted

        #if !targetEnvironment(simulator)
        let videoSource = factory.videoSource()
        let capturer = RTCCameraVideoCapturer(delegate: videoSource)

        guard let frontCamera = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front }) else {
            throw ConferenceError.noCameraAvailable
        }

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
            throw ConferenceError.noCameraAvailable
        }

        let fps = selectedFormat.videoSupportedFrameRateRanges
            .max { $0.maxFrameRate < $1.maxFrameRate }?
            .maxFrameRate ?? 30

        capturer.startCapture(with: frontCamera, format: selectedFormat, fps: Int(fps))

        localVideoTrack = factory.videoTrack(with: videoSource, trackId: "video0")
        localVideoTrack?.isEnabled = isVideoEnabled
        #endif

        logger.info("Acquired local media")
    }

    // MARK: - Controls

    @discardableResult
    public func toggleMute() -> Bool {
        isMuted.toggle()
        localAudioTrack?.isEnabled = !isMuted
        return isMuted
    }

    @discardableResult
    public func toggleVideo() -> Bool {
        isVideoEnabled.toggle()
        localVideoTrack?.isEnabled = isVideoEnabled
        return isVideoEnabled
    }

    // MARK: - Reconnection

    private func attemptReconnection() async {
        guard reconnectionAttempts < maxReconnectionAttempts else {
            connectionState = .failed
            events.send(.connectionStateChanged(state: .failed))
            events.send(.error(ConferenceError.reconnectionFailed))
            return
        }

        connectionState = .reconnecting
        events.send(.connectionStateChanged(state: .reconnecting))

        reconnectionAttempts += 1
        logger.info("Attempting reconnection \(reconnectionAttempts)/\(maxReconnectionAttempts)")

        do {
            if let roomId = roomId {
                try await connectToSFU(roomId: roomId)
                connectionState = .connected
                events.send(.connectionStateChanged(state: .connected))
                reconnectionAttempts = 0
            }
        } catch {
            try? await Task.sleep(nanoseconds: UInt64(2_000_000_000 * reconnectionAttempts))
            await attemptReconnection()
        }
    }

    // MARK: - Timers

    private func startTimers() {
        callStartTime = Date()

        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, let start = self.callStartTime else { return }
                self.callDuration = Date().timeIntervalSince(start)
            }
        }
    }

    // MARK: - Cleanup

    private func notifySFULeaving() async throws {
        // Notify SFU via signaling
        logger.info("Notified SFU of leaving")
    }

    private func cleanup() {
        durationTimer?.invalidate()
        durationTimer = nil

        sfuConnection?.close()
        sfuConnection = nil

        localAudioTrack = nil
        localVideoTrack = nil
        audioSender = nil
        videoSender = nil

        mlsKeyManager = nil
        simulcastManager = nil

        roomId = nil
        isHost = false
        localRole = .participant
        isMuted = false
        isVideoEnabled = true
        isScreenSharing = false
        participants.removeAll()
        connectionState = .disconnected
        callStartTime = nil
        callDuration = 0
        reconnectionAttempts = 0

        events.send(.connectionStateChanged(state: .disconnected))
    }

    public func close() {
        cleanup()
        logger.info("SFUConferenceManager closed")
    }

    // MARK: - Getters

    public var participantCount: Int {
        participants.count + 1
    }
}

// MARK: - Supporting Types

public struct ConferenceSettings {
    public var waitingRoom: Bool = true
    public var muteOnJoin: Bool = true
    public var hostOnlyScreenShare: Bool = false
    public var e2ee: Bool = true
    public var maxParticipants: Int = 100

    public init(
        waitingRoom: Bool = true,
        muteOnJoin: Bool = true,
        hostOnlyScreenShare: Bool = false,
        e2ee: Bool = true,
        maxParticipants: Int = 100
    ) {
        self.waitingRoom = waitingRoom
        self.muteOnJoin = muteOnJoin
        self.hostOnlyScreenShare = hostOnlyScreenShare
        self.e2ee = e2ee
        self.maxParticipants = maxParticipants
    }
}

// MARK: - Errors

public enum ConferenceError: LocalizedError {
    case alreadyInRoom
    case notInRoom
    case connectionFailed
    case reconnectionFailed
    case noCameraAvailable
    case hostOnly
    case mlsNotInitialized
    case unauthorized

    public var errorDescription: String? {
        switch self {
        case .alreadyInRoom: return "Already in a conference"
        case .notInRoom: return "Not in a conference"
        case .connectionFailed: return "Failed to connect to conference server"
        case .reconnectionFailed: return "Failed to reconnect after multiple attempts"
        case .noCameraAvailable: return "No camera available"
        case .hostOnly: return "Only the host can perform this action"
        case .mlsNotInitialized: return "MLS not initialized"
        case .unauthorized: return "Unauthorized action"
        }
    }
}
