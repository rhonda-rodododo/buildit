// CallState.swift
// BuildIt - Decentralized Mesh Communication
//
// Local model extensions for call state management.
// These types wrap the generated schema types with UI-specific state.

import Foundation

/// Local call state for UI management
/// Wraps the generated CallState with additional local-only properties
public struct LocalCallState: Identifiable, Equatable {
    // MARK: - Core Properties

    public let callId: String
    public let remotePubkey: String
    public let direction: Direction
    public let callType: CallType
    public var state: LocalCallStateEnum
    public let startedAt: Date

    // MARK: - Timestamps

    public var connectedAt: Date?
    public var endedAt: Date?

    // MARK: - Call Reason

    public var endReason: Reason?

    // MARK: - Local Controls (not synced)

    public var isMuted: Bool = false
    public var isVideoEnabled: Bool = true
    public var isSpeakerOn: Bool = false
    public var isUsingFrontCamera: Bool = true
    public var isScreenSharing: Bool = false
    public var isEncrypted: Bool = true

    // MARK: - Remote Party Info

    public var remoteName: String?
    public var remoteAvatarURL: String?

    // MARK: - Group Call Context

    public var groupId: String?
    public var roomId: String?

    // MARK: - Quality Metrics

    public var quality: LocalCallQuality = LocalCallQuality()

    // MARK: - Identifiable

    public var id: String { callId }

    // MARK: - Initialization

    public init(
        callId: String,
        remotePubkey: String,
        direction: Direction,
        callType: CallType,
        state: LocalCallStateEnum,
        startedAt: Date,
        connectedAt: Date? = nil,
        endedAt: Date? = nil,
        endReason: Reason? = nil,
        isMuted: Bool = false,
        isVideoEnabled: Bool = true,
        isSpeakerOn: Bool = false,
        isUsingFrontCamera: Bool = true,
        isScreenSharing: Bool = false,
        isEncrypted: Bool = true,
        remoteName: String? = nil,
        remoteAvatarURL: String? = nil,
        groupId: String? = nil,
        roomId: String? = nil,
        quality: LocalCallQuality = LocalCallQuality()
    ) {
        self.callId = callId
        self.remotePubkey = remotePubkey
        self.direction = direction
        self.callType = callType
        self.state = state
        self.startedAt = startedAt
        self.connectedAt = connectedAt
        self.endedAt = endedAt
        self.endReason = endReason
        self.isMuted = isMuted
        self.isVideoEnabled = isVideoEnabled
        self.isSpeakerOn = isSpeakerOn
        self.isUsingFrontCamera = isUsingFrontCamera
        self.isScreenSharing = isScreenSharing
        self.isEncrypted = isEncrypted
        self.remoteName = remoteName
        self.remoteAvatarURL = remoteAvatarURL
        self.groupId = groupId
        self.roomId = roomId
        self.quality = quality
    }

    // MARK: - Computed Properties

    /// Duration of the call in seconds (if connected)
    public var duration: Int? {
        guard let connected = connectedAt else { return nil }
        let end = endedAt ?? Date()
        return Int(end.timeIntervalSince(connected))
    }

    /// Formatted duration string
    public var formattedDuration: String {
        guard let duration = duration else { return "00:00" }
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        let seconds = duration % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    /// Whether the call is currently active
    public var isActive: Bool {
        switch state {
        case .connecting, .connected, .reconnecting, .onHold:
            return true
        case .initiating, .ringing, .ended:
            return false
        }
    }

    /// Whether video controls should be available
    public var supportsVideo: Bool {
        callType == .video
    }

    /// Display name for the remote party
    public var displayName: String {
        remoteName ?? String(remotePubkey.prefix(8)) + "..."
    }
}

/// Local call state enum (matches CallStateState but with local-only states)
public enum LocalCallStateEnum: String, Codable, Sendable, Equatable {
    case initiating
    case ringing
    case connecting
    case connected
    case reconnecting
    case onHold
    case ended

    /// Convert from generated CallStateState
    public init(from schemaState: CallStateState) {
        switch schemaState {
        case .initiating: self = .initiating
        case .ringing: self = .ringing
        case .connecting: self = .connecting
        case .connected: self = .connected
        case .reconnecting: self = .reconnecting
        case .onHold: self = .onHold
        case .ended: self = .ended
        }
    }

    /// Convert to generated CallStateState
    public var schemaState: CallStateState {
        switch self {
        case .initiating: return .initiating
        case .ringing: return .ringing
        case .connecting: return .connecting
        case .connected: return .connected
        case .reconnecting: return .reconnecting
        case .onHold: return .onHold
        case .ended: return .ended
        }
    }
}

/// Local call quality metrics with computed quality level
public struct LocalCallQuality: Equatable {
    // MARK: - Raw Metrics

    public var roundTripTime: Double?
    public var jitter: Double?
    public var packetLoss: Double?
    public var bandwidth: Int?
    public var audioLevel: Double?

    // MARK: - Computed Quality Level

    public enum QualityLevel: String {
        case excellent
        case good
        case fair
        case poor
        case unknown
    }

    /// Overall quality assessment based on metrics
    public var qualityLevel: QualityLevel {
        guard let rtt = roundTripTime else { return .unknown }

        // Based on WebRTC quality standards
        if rtt < 150 && (packetLoss ?? 0) < 1 && (jitter ?? 0) < 30 {
            return .excellent
        } else if rtt < 300 && (packetLoss ?? 0) < 3 && (jitter ?? 0) < 50 {
            return .good
        } else if rtt < 500 && (packetLoss ?? 0) < 5 && (jitter ?? 0) < 100 {
            return .fair
        } else {
            return .poor
        }
    }

    /// Quality indicator icon
    public var qualityIcon: String {
        switch qualityLevel {
        case .excellent: return "wifi.3bar"
        case .good: return "wifi.3bar"
        case .fair: return "wifi.2bar"
        case .poor: return "wifi.1bar"
        case .unknown: return "wifi.slash"
        }
    }

    /// Quality indicator color
    public var qualityColor: String {
        switch qualityLevel {
        case .excellent: return "green"
        case .good: return "green"
        case .fair: return "yellow"
        case .poor: return "red"
        case .unknown: return "gray"
        }
    }

    // MARK: - Initialization

    public init(
        roundTripTime: Double? = nil,
        jitter: Double? = nil,
        packetLoss: Double? = nil,
        bandwidth: Int? = nil,
        audioLevel: Double? = nil
    ) {
        self.roundTripTime = roundTripTime
        self.jitter = jitter
        self.packetLoss = packetLoss
        self.bandwidth = bandwidth
        self.audioLevel = audioLevel
    }

    /// Update from generated CallQuality
    public mutating func update(from quality: CallQuality) {
        self.roundTripTime = quality.roundTripTime
        self.jitter = quality.jitter
        self.packetLoss = quality.packetLoss
        self.bandwidth = quality.bandwidth
        self.audioLevel = quality.audioLevel
    }

    /// Update from generated QualityClass
    public mutating func update(from quality: QualityClass) {
        self.roundTripTime = quality.roundTripTime
        self.jitter = quality.jitter
        self.packetLoss = quality.packetLoss
        self.bandwidth = quality.bandwidth
        self.audioLevel = quality.audioLevel
    }
}

// MARK: - Conversion Extensions

extension LocalCallState {
    /// Convert to generated CallState for syncing
    public func toCallState() -> CallState {
        CallState(
            v: CallingSchema.version,
            callID: callId,
            callType: callType,
            connectedAt: connectedAt.map { Int($0.timeIntervalSince1970) },
            direction: direction,
            endedAt: endedAt.map { Int($0.timeIntervalSince1970) },
            endReason: endReason,
            isEncrypted: isEncrypted,
            isMuted: isMuted,
            isScreenSharing: isScreenSharing,
            isVideoEnabled: isVideoEnabled,
            quality: QualityClass(
                audioLevel: quality.audioLevel,
                bandwidth: quality.bandwidth,
                jitter: quality.jitter,
                packetLoss: quality.packetLoss,
                roundTripTime: quality.roundTripTime
            ),
            remoteName: remoteName,
            remotePubkey: remotePubkey,
            startedAt: Int(startedAt.timeIntervalSince1970),
            state: state.schemaState
        )
    }

    /// Create from generated CallState
    public static func from(_ callState: CallState) -> LocalCallState {
        var quality = LocalCallQuality()
        if let q = callState.quality {
            quality.update(from: q)
        }

        return LocalCallState(
            callId: callState.callID,
            remotePubkey: callState.remotePubkey,
            direction: callState.direction,
            callType: callState.callType ?? .voice,
            state: LocalCallStateEnum(from: callState.state),
            startedAt: Date(timeIntervalSince1970: TimeInterval(callState.startedAt)),
            connectedAt: callState.connectedAt.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            endedAt: callState.endedAt.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            endReason: callState.endReason,
            isMuted: callState.isMuted ?? false,
            isVideoEnabled: callState.isVideoEnabled ?? true,
            isScreenSharing: callState.isScreenSharing ?? false,
            isEncrypted: callState.isEncrypted ?? true,
            remoteName: callState.remoteName,
            quality: quality
        )
    }
}
