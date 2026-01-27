// WebRTCManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles WebRTC peer connections for voice/video calling.
// Uses Google's WebRTC framework for native iOS support.

import Foundation
import WebRTC
import AVFoundation
import os.log

/// WebRTC event handler protocol
protocol WebRTCManagerDelegate: AnyObject {
    func webRTCManager(_ manager: WebRTCManager, didGenerateIceCandidate candidate: RTCIceCandidate)
    func webRTCManager(_ manager: WebRTCManager, didChangeConnectionState state: RTCIceConnectionState)
    func webRTCManager(_ manager: WebRTCManager, didReceiveRemoteStream stream: RTCMediaStream)
    func webRTCManager(_ manager: WebRTCManager, didRemoveRemoteStream stream: RTCMediaStream)
    func webRTCManagerDidNeedNegotiation(_ manager: WebRTCManager)
}

/// WebRTC Manager for handling peer connections
@MainActor
public class WebRTCManager: NSObject {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "WebRTCManager")

    private static var peerConnectionFactory: RTCPeerConnectionFactory?
    private var peerConnection: RTCPeerConnection?
    private var localStream: RTCMediaStream?
    private var remoteStream: RTCMediaStream?

    // Media tracks
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?
    private var videoCapturer: RTCCameraVideoCapturer?
    private var localVideoSource: RTCVideoSource?

    // Configuration
    private let rtcConfig: RTCConfiguration
    private let mediaConstraints: RTCMediaConstraints

    weak var delegate: WebRTCManagerDelegate?

    // E2EE support
    private var encryptionKey: Data?

    // MARK: - Static Initialization

    private static func initializePeerConnectionFactory() {
        guard peerConnectionFactory == nil else { return }

        // Initialize SSL
        RTCInitializeSSL()

        // Create factory
        let encoderFactory = RTCDefaultVideoEncoderFactory()
        let decoderFactory = RTCDefaultVideoDecoderFactory()
        peerConnectionFactory = RTCPeerConnectionFactory(
            encoderFactory: encoderFactory,
            decoderFactory: decoderFactory
        )
    }

    // MARK: - Initialization

    override public init() {
        // Initialize factory if needed
        Self.initializePeerConnectionFactory()

        // Configure ICE servers
        let iceServer1 = RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])
        let iceServer2 = RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"])

        rtcConfig = RTCConfiguration()
        rtcConfig.iceServers = [iceServer1, iceServer2]
        rtcConfig.bundlePolicy = .maxBundle
        rtcConfig.rtcpMuxPolicy = .require
        rtcConfig.sdpSemantics = .unifiedPlan
        rtcConfig.continualGatheringPolicy = .gatherContinually

        // Media constraints
        mediaConstraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )

        super.init()
    }

    // MARK: - Peer Connection

    /// Initialize the peer connection
    func initialize() {
        guard let factory = Self.peerConnectionFactory else {
            logger.error("Peer connection factory not initialized")
            return
        }

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: nil
        )

        peerConnection = factory.peerConnection(
            with: rtcConfig,
            constraints: constraints,
            delegate: self
        )

        logger.info("Peer connection initialized")
    }

    /// Get local media stream
    func getLocalStream(hasVideo: Bool) async throws -> RTCMediaStream {
        guard let factory = Self.peerConnectionFactory else {
            throw WebRTCError.factoryNotInitialized
        }

        let streamId = UUID().uuidString
        let stream = factory.mediaStream(withStreamId: streamId)

        // Add audio track
        let audioSource = factory.audioSource(with: mediaConstraints)
        let audioTrack = factory.audioTrack(with: audioSource, trackId: "audio0")
        stream.addAudioTrack(audioTrack)
        localAudioTrack = audioTrack

        // Add video track if requested
        if hasVideo {
            let videoSource = factory.videoSource()
            localVideoSource = videoSource

            #if !targetEnvironment(simulator)
            let capturer = RTCCameraVideoCapturer(delegate: videoSource)
            videoCapturer = capturer

            // Get front camera
            guard let device = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front })
                  ?? RTCCameraVideoCapturer.captureDevices().first else {
                throw WebRTCError.noCameraAvailable
            }

            // Get appropriate format (720p preferred)
            let formats = RTCCameraVideoCapturer.supportedFormats(for: device)
            guard let format = formats.first(where: {
                let dimensions = CMVideoFormatDescriptionGetDimensions($0.formatDescription)
                return dimensions.width == 1280 && dimensions.height == 720
            }) ?? formats.last else {
                throw WebRTCError.noSupportedFormat
            }

            // Get appropriate frame rate
            let fps = format.videoSupportedFrameRateRanges.first?.maxFrameRate ?? 30.0

            try await capturer.startCapture(with: device, format: format, fps: Int32(fps))
            #endif

            let videoTrack = factory.videoTrack(with: videoSource, trackId: "video0")
            stream.addVideoTrack(videoTrack)
            localVideoTrack = videoTrack
        }

        localStream = stream

        // Add tracks to peer connection
        if let pc = peerConnection {
            for track in stream.audioTracks {
                pc.add(track, streamIds: [streamId])
            }
            for track in stream.videoTracks {
                pc.add(track, streamIds: [streamId])
            }
        }

        logger.info("Local stream created with video: \(hasVideo)")
        return stream
    }

    /// Create SDP offer
    func createOffer() async throws -> RTCSessionDescription {
        guard let pc = peerConnection else {
            throw WebRTCError.peerConnectionNotInitialized
        }

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "true"
            ],
            optionalConstraints: nil
        )

        return try await withCheckedThrowingContinuation { continuation in
            pc.offer(for: constraints) { sdp, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let sdp = sdp else {
                    continuation.resume(throwing: WebRTCError.sdpCreationFailed)
                    return
                }

                // Set local description
                pc.setLocalDescription(sdp) { error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: sdp)
                    }
                }
            }
        }
    }

    /// Create SDP answer
    func createAnswer() async throws -> RTCSessionDescription {
        guard let pc = peerConnection else {
            throw WebRTCError.peerConnectionNotInitialized
        }

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: nil
        )

        return try await withCheckedThrowingContinuation { continuation in
            pc.answer(for: constraints) { sdp, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let sdp = sdp else {
                    continuation.resume(throwing: WebRTCError.sdpCreationFailed)
                    return
                }

                // Set local description
                pc.setLocalDescription(sdp) { error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: sdp)
                    }
                }
            }
        }
    }

    /// Set remote SDP
    func setRemoteDescription(_ sdp: RTCSessionDescription) async throws {
        guard let pc = peerConnection else {
            throw WebRTCError.peerConnectionNotInitialized
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            pc.setRemoteDescription(sdp) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }

        logger.info("Remote description set: \(sdp.type.rawValue)")
    }

    /// Add ICE candidate
    func addIceCandidate(_ candidate: RTCIceCandidate) async throws {
        guard let pc = peerConnection else {
            throw WebRTCError.peerConnectionNotInitialized
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            pc.add(candidate) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Media Controls

    /// Mute/unmute audio
    func setAudioEnabled(_ enabled: Bool) {
        localAudioTrack?.isEnabled = enabled
        logger.debug("Audio enabled: \(enabled)")
    }

    /// Enable/disable video
    func setVideoEnabled(_ enabled: Bool) {
        localVideoTrack?.isEnabled = enabled
        logger.debug("Video enabled: \(enabled)")
    }

    /// Switch camera (front/back)
    func switchCamera() async throws {
        #if !targetEnvironment(simulator)
        guard let capturer = videoCapturer else { return }

        let currentDevice = capturer.captureSession.inputs
            .compactMap { ($0 as? AVCaptureDeviceInput)?.device }
            .first

        let newPosition: AVCaptureDevice.Position = (currentDevice?.position == .front) ? .back : .front

        guard let newDevice = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == newPosition }) else {
            throw WebRTCError.noCameraAvailable
        }

        let formats = RTCCameraVideoCapturer.supportedFormats(for: newDevice)
        guard let format = formats.first(where: {
            let dimensions = CMVideoFormatDescriptionGetDimensions($0.formatDescription)
            return dimensions.width == 1280 && dimensions.height == 720
        }) ?? formats.last else {
            throw WebRTCError.noSupportedFormat
        }

        let fps = format.videoSupportedFrameRateRanges.first?.maxFrameRate ?? 30.0

        capturer.stopCapture()
        try await capturer.startCapture(with: newDevice, format: format, fps: Int32(fps))

        logger.info("Switched to \(newPosition == .front ? "front" : "back") camera")
        #endif
    }

    // MARK: - E2EE

    /// Set encryption key for E2EE
    func setEncryptionKey(_ key: Data) {
        encryptionKey = key
        // Note: Actual E2EE implementation requires RTCRtpSender/Receiver transforms
        // which would need custom frame processing through RTCFrameCryptor
        logger.info("E2EE key set")
    }

    // MARK: - Statistics

    /// Get connection statistics
    func getStats() async -> [String: Any] {
        guard let pc = peerConnection else {
            return [:]
        }

        return await withCheckedContinuation { continuation in
            pc.statistics { report in
                var stats: [String: Any] = [:]

                for (_, stat) in report.statistics {
                    if stat.type == "candidate-pair" {
                        if let rtt = stat.values["currentRoundTripTime"] as? Double {
                            stats["roundTripTime"] = rtt
                        }
                    }

                    if stat.type == "inbound-rtp" {
                        if let jitter = stat.values["jitter"] as? Double {
                            stats["jitter"] = jitter
                        }
                        if let packetsLost = stat.values["packetsLost"] as? Int,
                           let packetsReceived = stat.values["packetsReceived"] as? Int {
                            let total = packetsLost + packetsReceived
                            if total > 0 {
                                stats["packetLoss"] = Double(packetsLost) / Double(total) * 100
                            }
                        }
                    }
                }

                continuation.resume(returning: stats)
            }
        }
    }

    // MARK: - Cleanup

    /// Close the connection
    func close() {
        // Stop video capture
        #if !targetEnvironment(simulator)
        videoCapturer?.stopCapture()
        #endif

        // Disable tracks
        localAudioTrack?.isEnabled = false
        localVideoTrack?.isEnabled = false

        // Close peer connection
        peerConnection?.close()
        peerConnection = nil

        // Clear references
        localStream = nil
        remoteStream = nil
        localAudioTrack = nil
        localVideoTrack = nil
        videoCapturer = nil
        localVideoSource = nil

        logger.info("WebRTC manager closed")
    }

    deinit {
        close()
    }
}

// MARK: - RTCPeerConnectionDelegate

extension WebRTCManager: RTCPeerConnectionDelegate {
    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        Task { @MainActor in
            logger.debug("Signaling state changed: \(stateChanged.rawValue)")
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        Task { @MainActor in
            logger.info("Remote stream added")
            remoteStream = stream
            delegate?.webRTCManager(self, didReceiveRemoteStream: stream)
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        Task { @MainActor in
            logger.info("Remote stream removed")
            remoteStream = nil
            delegate?.webRTCManager(self, didRemoveRemoteStream: stream)
        }
    }

    nonisolated public func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        Task { @MainActor in
            logger.debug("Negotiation needed")
            delegate?.webRTCManagerDidNeedNegotiation(self)
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        Task { @MainActor in
            logger.info("ICE connection state: \(newState.rawValue)")
            delegate?.webRTCManager(self, didChangeConnectionState: newState)
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        Task { @MainActor in
            logger.debug("ICE gathering state: \(newState.rawValue)")
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        Task { @MainActor in
            logger.debug("Generated ICE candidate")
            delegate?.webRTCManager(self, didGenerateIceCandidate: candidate)
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {
        Task { @MainActor in
            logger.debug("ICE candidates removed")
        }
    }

    nonisolated public func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        Task { @MainActor in
            logger.info("Data channel opened")
        }
    }
}

// MARK: - Errors

public enum WebRTCError: LocalizedError {
    case factoryNotInitialized
    case peerConnectionNotInitialized
    case sdpCreationFailed
    case noCameraAvailable
    case noSupportedFormat

    public var errorDescription: String? {
        switch self {
        case .factoryNotInitialized:
            return "WebRTC factory not initialized"
        case .peerConnectionNotInitialized:
            return "Peer connection not initialized"
        case .sdpCreationFailed:
            return "Failed to create SDP"
        case .noCameraAvailable:
            return "No camera available"
        case .noSupportedFormat:
            return "No supported video format"
        }
    }
}
