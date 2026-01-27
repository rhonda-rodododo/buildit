// PSTNCallManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles WebRTC-PSTN bridging for inbound and outbound phone calls.
// Integrates with CallKit for native iOS phone UI experience.

import Foundation
import CallKit
import AVFoundation
import WebRTC
import os.log

// MARK: - PSTN Call State

/// PSTN call status enum
public enum PSTNCallState: String, Codable, Sendable {
    case queued
    case ringing
    case connected
    case onHold
    case transferring
    case completed
    case failed
}

// MARK: - PSTN Call Manager Delegate

/// Delegate protocol for PSTN call events
public protocol PSTNCallManagerDelegate: AnyObject {
    func pstnCallManager(_ manager: PSTNCallManager, didConnect call: LocalPSTNCallState)
    func pstnCallManager(_ manager: PSTNCallManager, didDisconnect callSid: String, reason: String)
    func pstnCallManager(_ manager: PSTNCallManager, didFail callSid: String, error: Error)
    func pstnCallManager(_ manager: PSTNCallManager, didHold callSid: String)
    func pstnCallManager(_ manager: PSTNCallManager, didResume callSid: String)
    func pstnCallManager(_ manager: PSTNCallManager, didRevealCallerPhone callSid: String, phone: String)
    func pstnCallManager(_ manager: PSTNCallManager, qualityWarning callSid: String, metric: String, value: Double)
}

// MARK: - Local PSTN Call State

/// Local state for a PSTN call
public struct LocalPSTNCallState: Identifiable, Equatable {
    public let callSid: String
    public let hotlineId: String
    public let direction: PSTNCallDirection
    public var callerPhone: String?
    public var targetPhone: String?
    public var operatorPubkey: String?
    public var status: PSTNCallState
    public let startedAt: Date
    public var connectedAt: Date?
    public var duration: Int
    public var isWebRTCBridged: Bool

    public var id: String { callSid }

    public init(
        callSid: String,
        hotlineId: String,
        direction: PSTNCallDirection,
        callerPhone: String? = nil,
        targetPhone: String? = nil,
        operatorPubkey: String? = nil,
        status: PSTNCallState = .queued,
        startedAt: Date = Date(),
        connectedAt: Date? = nil,
        duration: Int = 0,
        isWebRTCBridged: Bool = false
    ) {
        self.callSid = callSid
        self.hotlineId = hotlineId
        self.direction = direction
        self.callerPhone = callerPhone
        self.targetPhone = targetPhone
        self.operatorPubkey = operatorPubkey
        self.status = status
        self.startedAt = startedAt
        self.connectedAt = connectedAt
        self.duration = duration
        self.isWebRTCBridged = isWebRTCBridged
    }

    /// Formatted duration string
    public var formattedDuration: String {
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        let seconds = duration % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    /// Display phone number (caller for inbound, target for outbound)
    public var displayPhone: String {
        switch direction {
        case .inbound:
            return callerPhone ?? "Unknown"
        case .outbound:
            return targetPhone ?? "Unknown"
        }
    }
}

// MARK: - Outbound Call Options

/// Options for initiating an outbound PSTN call
public struct OutboundCallOptions {
    public let targetPhone: String
    public let hotlineId: String
    public let callerId: String?

    public init(targetPhone: String, hotlineId: String, callerId: String? = nil) {
        self.targetPhone = targetPhone
        self.hotlineId = hotlineId
        self.callerId = callerId
    }
}

// MARK: - PSTN Bridge Configuration

/// Configuration for PSTN bridge
public struct PSTNBridgeConfig {
    public let workerUrl: String
    public let sipDomain: String?

    public init(workerUrl: String, sipDomain: String? = nil) {
        self.workerUrl = workerUrl
        self.sipDomain = sipDomain
    }
}

// MARK: - PSTN Call Manager

/// Manages WebRTC-PSTN bridged calls for hotlines
@MainActor
public class PSTNCallManager: NSObject, ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var activeCalls: [String: LocalPSTNCallState] = [:]

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "PSTNCallManager")

    private let workerUrl: String
    private let webRTCManager: WebRTCManager?
    private let callKitManager: CallKitManager

    private var callDurations: [String: Timer] = [:]
    private var peerConnections: [String: RTCPeerConnection] = [:]

    public weak var delegate: PSTNCallManagerDelegate?

    // Local pubkey for identifying operator
    private var localPubkey: String?

    // MARK: - Initialization

    public init(config: PSTNBridgeConfig, webRTCManager: WebRTCManager? = nil, callKitManager: CallKitManager) {
        self.workerUrl = config.workerUrl
        self.webRTCManager = webRTCManager
        self.callKitManager = callKitManager
        super.init()

        logger.info("PSTN Call Manager initialized with worker URL: \(config.workerUrl)")
    }

    /// Set the local operator pubkey
    public func setLocalPubkey(_ pubkey: String) {
        self.localPubkey = pubkey
    }

    // MARK: - Signaling Event Handling

    /// Handle incoming PSTN event from signaling
    public func handleSignalingEvent(kind: Int, content: String) {
        guard let data = content.data(using: .utf8) else {
            logger.warning("Failed to parse signaling content")
            return
        }

        let decoder = JSONDecoder()

        // PSTN_INBOUND: 24380
        if kind == 24380 {
            do {
                let inbound = try decoder.decode(PSTNInboundEvent.self, from: data)
                handleIncomingPSTNNotification(inbound)
            } catch {
                logger.error("Failed to decode PSTN inbound event: \(error.localizedDescription)")
            }
        }
        // PSTN_BRIDGE: 24382
        else if kind == 24382 {
            do {
                let bridge = try decoder.decode(PSTNBridgeEvent.self, from: data)
                handleBridgeEvent(bridge)
            } catch {
                logger.error("Failed to decode PSTN bridge event: \(error.localizedDescription)")
            }
        }
    }

    /// Handle incoming PSTN call notification
    private func handleIncomingPSTNNotification(_ data: PSTNInboundEvent) {
        let call = LocalPSTNCallState(
            callSid: data.callSid,
            hotlineId: data.hotlineId,
            direction: .inbound,
            callerPhone: data.maskedCallerId,
            status: .queued,
            startedAt: Date()
        )

        activeCalls[data.callSid] = call

        // Report to CallKit
        Task {
            do {
                try await callKitManager.reportIncomingCall(
                    callId: UUID(uuidString: data.callSid) ?? UUID(),
                    remotePubkey: data.maskedCallerId,
                    remoteName: "PSTN: \(data.maskedCallerId)",
                    hasVideo: false
                )
            } catch {
                logger.error("Failed to report PSTN call to CallKit: \(error.localizedDescription)")
            }
        }

        logger.info("Incoming PSTN call: \(data.callSid) from \(data.maskedCallerId)")
    }

    /// Handle bridge events from the PSTN bridge
    private func handleBridgeEvent(_ data: PSTNBridgeEvent) {
        guard var call = activeCalls[data.callSid] else {
            logger.warning("Received bridge event for unknown call: \(data.callSid)")
            return
        }

        switch data.type {
        case "connected":
            call.status = .connected
            call.connectedAt = Date()
            call.isWebRTCBridged = true
            startDurationTimer(data.callSid)
            activeCalls[data.callSid] = call
            delegate?.pstnCallManager(self, didConnect: call)

        case "disconnected":
            call.status = .completed
            stopDurationTimer(data.callSid)
            activeCalls[data.callSid] = call
            delegate?.pstnCallManager(self, didDisconnect: data.callSid, reason: data.reason ?? "normal")
            cleanup(data.callSid)

        case "error":
            call.status = .failed
            activeCalls[data.callSid] = call
            delegate?.pstnCallManager(self, didFail: data.callSid, error: PSTNError.bridgeError(data.message ?? "Unknown error"))
            cleanup(data.callSid)

        case "quality":
            if let metric = data.metric, let value = data.value {
                delegate?.pstnCallManager(self, qualityWarning: data.callSid, metric: metric, value: value)
            }

        default:
            logger.debug("Unknown bridge event type: \(data.type)")
        }
    }

    // MARK: - Answer Call

    /// Answer an incoming PSTN call (operator answering from queue)
    public func answerPSTNCall(_ callSid: String, operatorPubkey: String) async throws {
        guard var call = activeCalls[callSid] else {
            throw PSTNError.callNotFound
        }

        guard call.status == .queued || call.status == .ringing else {
            throw PSTNError.invalidCallState("Cannot answer call in \(call.status) state")
        }

        // Request bridge from backend
        let url = URL(string: "\(workerUrl)/api/pstn/voice/answer")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["callSid": callSid, "operatorPubkey": operatorPubkey]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw PSTNError.apiError(errorText)
        }

        let bridgeResponse = try JSONDecoder().decode(BridgeResponse.self, from: data)

        // Update call state
        call.status = .ringing
        call.operatorPubkey = operatorPubkey
        activeCalls[callSid] = call

        // Setup WebRTC connection to SIP bridge
        try await setupWebRTCBridge(
            callSid: callSid,
            sipUri: bridgeResponse.sipUri,
            webrtcConfig: bridgeResponse.webrtcConfig
        )

        logger.info("Answered PSTN call: \(callSid)")
    }

    // MARK: - Dial Outbound

    /// Initiate an outbound PSTN call
    public func dialOutbound(_ options: OutboundCallOptions) async throws -> String {
        guard let operatorPubkey = localPubkey else {
            throw PSTNError.noLocalPubkey
        }

        // Request outbound call from backend
        let url = URL(string: "\(workerUrl)/api/pstn/voice/outbound")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: String] = [
            "targetPhone": options.targetPhone,
            "hotlineId": options.hotlineId,
            "operatorPubkey": operatorPubkey
        ]
        if let callerId = options.callerId {
            body["callerId"] = callerId
        }

        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw PSTNError.apiError(errorText)
        }

        let outboundResponse = try JSONDecoder().decode(OutboundResponse.self, from: data)

        // Create local call state
        let call = LocalPSTNCallState(
            callSid: outboundResponse.callSid,
            hotlineId: options.hotlineId,
            direction: .outbound,
            targetPhone: options.targetPhone,
            operatorPubkey: operatorPubkey,
            status: .ringing,
            startedAt: Date()
        )

        activeCalls[outboundResponse.callSid] = call

        // Start CallKit outgoing call
        Task {
            do {
                try await callKitManager.startOutgoingCall(
                    callId: UUID(uuidString: outboundResponse.callSid) ?? UUID(),
                    remotePubkey: options.targetPhone,
                    remoteName: options.targetPhone,
                    hasVideo: false
                )
            } catch {
                logger.error("Failed to start CallKit call: \(error.localizedDescription)")
            }
        }

        // Setup WebRTC connection to SIP bridge
        try await setupWebRTCBridge(
            callSid: outboundResponse.callSid,
            sipUri: outboundResponse.sipUri,
            webrtcConfig: outboundResponse.webrtcConfig
        )

        logger.info("Started outbound PSTN call: \(outboundResponse.callSid) to \(maskPhoneNumber(options.targetPhone))")
        return outboundResponse.callSid
    }

    // MARK: - WebRTC Bridge Setup

    /// Setup WebRTC connection to SIP bridge
    private func setupWebRTCBridge(
        callSid: String,
        sipUri: String,
        webrtcConfig: WebRTCBridgeConfig
    ) async throws {
        // Get local audio stream
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
        try audioSession.setActive(true)

        // Create peer connection
        RTCInitializeSSL()

        let encoderFactory = RTCDefaultVideoEncoderFactory()
        let decoderFactory = RTCDefaultVideoDecoderFactory()
        let factory = RTCPeerConnectionFactory(encoderFactory: encoderFactory, decoderFactory: decoderFactory)

        let config = RTCConfiguration()
        config.iceServers = webrtcConfig.iceServers.map { server in
            if let username = server.username, let credential = server.credential {
                return RTCIceServer(urlStrings: server.urls, username: username, credential: credential)
            }
            return RTCIceServer(urlStrings: server.urls)
        }
        config.bundlePolicy = .maxBundle
        config.rtcpMuxPolicy = .require
        config.sdpSemantics = .unifiedPlan

        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: ["DtlsSrtpKeyAgreement": "true"])

        guard let peerConnection = factory.peerConnection(with: config, constraints: constraints, delegate: nil) else {
            throw PSTNError.webRTCError("Failed to create peer connection")
        }

        peerConnections[callSid] = peerConnection

        // Add audio track
        let audioSource = factory.audioSource(with: constraints)
        let audioTrack = factory.audioTrack(with: audioSource, trackId: "pstn-audio-\(callSid)")
        peerConnection.add(audioTrack, streamIds: ["pstn-stream-\(callSid)"])

        // Create offer
        let offerConstraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "false"
            ],
            optionalConstraints: nil
        )

        let offer = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<RTCSessionDescription, Error>) in
            peerConnection.offer(for: offerConstraints) { sdp, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let sdp = sdp else {
                    continuation.resume(throwing: PSTNError.webRTCError("Failed to create SDP offer"))
                    return
                }
                peerConnection.setLocalDescription(sdp) { error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: sdp)
                    }
                }
            }
        }

        // Send offer to SIP bridge
        let bridgeUrl = URL(string: "\(workerUrl)/api/pstn/voice/bridge")!
        var bridgeRequest = URLRequest(url: bridgeUrl)
        bridgeRequest.httpMethod = "POST"
        bridgeRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let bridgeBody: [String: String] = [
            "callSid": callSid,
            "sipUri": sipUri,
            "sdp": offer.sdp
        ]
        bridgeRequest.httpBody = try JSONEncoder().encode(bridgeBody)

        let (bridgeData, bridgeResponse) = try await URLSession.shared.data(for: bridgeRequest)

        guard let bridgeHttpResponse = bridgeResponse as? HTTPURLResponse, bridgeHttpResponse.statusCode == 200 else {
            peerConnection.close()
            peerConnections.removeValue(forKey: callSid)
            throw PSTNError.webRTCError("Failed to connect to SIP bridge")
        }

        let answerResponse = try JSONDecoder().decode(SDPAnswerResponse.self, from: bridgeData)

        // Set remote description
        let answer = RTCSessionDescription(type: .answer, sdp: answerResponse.sdp)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            peerConnection.setRemoteDescription(answer) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }

        logger.info("WebRTC bridge setup complete for call: \(callSid)")
    }

    // MARK: - Hold/Resume

    /// Put a PSTN call on hold
    public func holdPSTNCall(_ callSid: String) async throws {
        guard var call = activeCalls[callSid], call.status == .connected else {
            throw PSTNError.invalidCallState("Call not connected")
        }

        // Notify backend to play hold music
        let url = URL(string: "\(workerUrl)/api/pstn/voice/hold")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["callSid": callSid, "action": "hold"]
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw PSTNError.apiError("Failed to put call on hold")
        }

        call.status = .onHold
        activeCalls[callSid] = call
        delegate?.pstnCallManager(self, didHold: callSid)

        // Update CallKit
        if let uuid = UUID(uuidString: callSid) {
            try await callKitManager.setOnHold(callId: uuid, onHold: true)
        }

        logger.info("Put call on hold: \(callSid)")
    }

    /// Resume a PSTN call from hold
    public func resumePSTNCall(_ callSid: String) async throws {
        guard var call = activeCalls[callSid], call.status == .onHold else {
            throw PSTNError.invalidCallState("Call not on hold")
        }

        // Notify backend to stop hold music
        let url = URL(string: "\(workerUrl)/api/pstn/voice/hold")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["callSid": callSid, "action": "resume"]
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw PSTNError.apiError("Failed to resume call")
        }

        call.status = .connected
        activeCalls[callSid] = call
        delegate?.pstnCallManager(self, didResume: callSid)

        // Update CallKit
        if let uuid = UUID(uuidString: callSid) {
            try await callKitManager.setOnHold(callId: uuid, onHold: false)
        }

        logger.info("Resumed call from hold: \(callSid)")
    }

    // MARK: - Transfer

    /// Transfer a PSTN call to another phone number
    public func transferPSTNCall(_ callSid: String, targetPhone: String) async throws {
        guard var call = activeCalls[callSid] else {
            throw PSTNError.callNotFound
        }

        call.status = .transferring
        activeCalls[callSid] = call

        // Request transfer from backend
        let url = URL(string: "\(workerUrl)/api/pstn/voice/transfer")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["callSid": callSid, "targetPhone": targetPhone]
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw PSTNError.apiError("Failed to transfer call")
        }

        // Backend handles the transfer, our end disconnects
        call.status = .completed
        activeCalls[callSid] = call
        cleanup(callSid)

        logger.info("Transferred call \(callSid) to \(maskPhoneNumber(targetPhone))")
    }

    // MARK: - End Call

    /// End a PSTN call
    public func endPSTNCall(_ callSid: String) async {
        guard var call = activeCalls[callSid] else { return }

        // Notify backend to end call
        let url = URL(string: "\(workerUrl)/api/pstn/voice/hangup")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["callSid": callSid]
        request.httpBody = try? JSONEncoder().encode(body)

        _ = try? await URLSession.shared.data(for: request)

        // Clean up WebRTC
        if let pc = peerConnections[callSid] {
            pc.close()
            peerConnections.removeValue(forKey: callSid)
        }

        // End CallKit call
        if let uuid = UUID(uuidString: callSid) {
            try? await callKitManager.endCall(callId: uuid)
        }

        call.status = .completed
        activeCalls[callSid] = call
        delegate?.pstnCallManager(self, didDisconnect: callSid, reason: "user_hangup")
        cleanup(callSid)

        logger.info("Ended PSTN call: \(callSid)")
    }

    // MARK: - Reveal Caller Phone

    /// Reveal the real phone number (requires authorization)
    public func revealCallerPhone(_ callSid: String, operatorPubkey: String) async throws -> String {
        guard let call = activeCalls[callSid], call.direction == .inbound else {
            throw PSTNError.invalidCallState("Call not found or not inbound")
        }

        // Request reveal from backend (will be audited)
        let url = URL(string: "\(workerUrl)/api/pstn/caller/reveal")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = [
            "callSid": callSid,
            "operatorPubkey": operatorPubkey,
            "maskedId": call.callerPhone ?? ""
        ]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw PSTNError.apiError("Invalid response")
        }

        if httpResponse.statusCode == 403 {
            throw PSTNError.unauthorized("Not authorized to reveal caller phone")
        }

        guard httpResponse.statusCode == 200 else {
            throw PSTNError.apiError("Failed to reveal caller phone")
        }

        let revealResponse = try JSONDecoder().decode(RevealResponse.self, from: data)
        delegate?.pstnCallManager(self, didRevealCallerPhone: callSid, phone: revealResponse.phone)

        logger.info("Revealed caller phone for call: \(callSid)")
        return revealResponse.phone
    }

    // MARK: - Getters

    /// Get active PSTN call
    public func getCall(_ callSid: String) -> LocalPSTNCallState? {
        return activeCalls[callSid]
    }

    /// Get all active PSTN calls
    public func getAllCalls() -> [LocalPSTNCallState] {
        return Array(activeCalls.values)
    }

    // MARK: - Private Helpers

    /// Mask a phone number for privacy
    private func maskPhoneNumber(_ phone: String) -> String {
        guard phone.count > 4 else { return "****" }
        return String(repeating: "*", count: phone.count - 4) + phone.suffix(4)
    }

    /// Start duration timer for a call
    private func startDurationTimer(_ callSid: String) {
        stopDurationTimer(callSid)

        let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, var call = self.activeCalls[callSid] else { return }
                call.duration += 1
                self.activeCalls[callSid] = call
            }
        }

        callDurations[callSid] = timer
    }

    /// Stop duration timer for a call
    private func stopDurationTimer(_ callSid: String) {
        callDurations[callSid]?.invalidate()
        callDurations.removeValue(forKey: callSid)
    }

    /// Clean up call resources
    private func cleanup(_ callSid: String) {
        stopDurationTimer(callSid)
        peerConnections[callSid]?.close()
        peerConnections.removeValue(forKey: callSid)

        // Delay removal to allow UI to update
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            self.activeCalls.removeValue(forKey: callSid)
        }
    }

    /// Cleanup all resources
    public func destroy() {
        for timer in callDurations.values {
            timer.invalidate()
        }
        callDurations.removeAll()

        for pc in peerConnections.values {
            pc.close()
        }
        peerConnections.removeAll()

        activeCalls.removeAll()

        logger.info("PSTN Call Manager destroyed")
    }
}

// MARK: - Error Types

/// PSTN related errors
public enum PSTNError: LocalizedError {
    case callNotFound
    case invalidCallState(String)
    case apiError(String)
    case webRTCError(String)
    case unauthorized(String)
    case noLocalPubkey
    case bridgeError(String)

    public var errorDescription: String? {
        switch self {
        case .callNotFound:
            return "PSTN call not found"
        case .invalidCallState(let message):
            return "Invalid call state: \(message)"
        case .apiError(let message):
            return "API error: \(message)"
        case .webRTCError(let message):
            return "WebRTC error: \(message)"
        case .unauthorized(let message):
            return "Unauthorized: \(message)"
        case .noLocalPubkey:
            return "No local pubkey configured"
        case .bridgeError(let message):
            return "Bridge error: \(message)"
        }
    }
}

// MARK: - API Response Types

private struct PSTNInboundEvent: Codable {
    let callSid: String
    let hotlineId: String
    let maskedCallerId: String
    let queuePosition: Int?
}

private struct PSTNBridgeEvent: Codable {
    let type: String
    let callSid: String
    let reason: String?
    let message: String?
    let metric: String?
    let value: Double?
}

private struct BridgeResponse: Codable {
    let sipUri: String
    let webrtcConfig: WebRTCBridgeConfig
}

private struct OutboundResponse: Codable {
    let callSid: String
    let sipUri: String
    let webrtcConfig: WebRTCBridgeConfig
}

private struct WebRTCBridgeConfig: Codable {
    let iceServers: [ICEServerConfig]
}

private struct ICEServerConfig: Codable {
    let urls: [String]
    let username: String?
    let credential: String?
}

private struct SDPAnswerResponse: Codable {
    let sdp: String
}

private struct RevealResponse: Codable {
    let phone: String
}
