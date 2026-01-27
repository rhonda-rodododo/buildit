// PTTAudioManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles audio broadcasting and receiving for Push-to-Talk channels.
// Uses AVFoundation for microphone access and audio playback.

import Foundation
import AVFoundation
import Combine
import Accelerate
import os.log

// MARK: - Audio Configuration

/// Configuration for PTT audio
public struct PTTAudioConfig: Sendable {
    /// Sample rate in Hz
    public let sampleRate: Double

    /// Audio format for capture/playback
    public let format: AVAudioFormat?

    /// Buffer size in frames
    public let bufferSize: AVAudioFrameCount

    /// VAD threshold in dB (default -40 dB)
    public let vadThreshold: Float

    /// VAD silence timeout in milliseconds
    public let vadSilenceTimeout: TimeInterval

    public static let `default` = PTTAudioConfig(
        sampleRate: 48000,
        format: AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1),
        bufferSize: 4096,
        vadThreshold: -40,
        vadSilenceTimeout: 2.0
    )

    public init(
        sampleRate: Double = 48000,
        format: AVAudioFormat? = nil,
        bufferSize: AVAudioFrameCount = 4096,
        vadThreshold: Float = -40,
        vadSilenceTimeout: TimeInterval = 2.0
    ) {
        self.sampleRate = sampleRate
        self.format = format ?? AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
        self.bufferSize = bufferSize
        self.vadThreshold = vadThreshold
        self.vadSilenceTimeout = vadSilenceTimeout
    }
}

// MARK: - Audio Manager Errors

public enum PTTAudioError: LocalizedError {
    case audioSessionFailed
    case engineStartFailed
    case microphoneAccessDenied
    case noInputDevice
    case encodingFailed
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .audioSessionFailed:
            return "Failed to configure audio session"
        case .engineStartFailed:
            return "Failed to start audio engine"
        case .microphoneAccessDenied:
            return "Microphone access denied"
        case .noInputDevice:
            return "No audio input device available"
        case .encodingFailed:
            return "Failed to encode audio data"
        case .decodingFailed:
            return "Failed to decode audio data"
        }
    }
}

// MARK: - VAD State

/// Voice Activity Detection state
public struct VADState: Equatable, Sendable {
    public var isEnabled: Bool
    public var threshold: Float
    public var currentLevel: Float
    public var isSpeaking: Bool
    public var silenceStartedAt: Date?

    public init(
        isEnabled: Bool = false,
        threshold: Float = -40,
        currentLevel: Float = -100,
        isSpeaking: Bool = false,
        silenceStartedAt: Date? = nil
    ) {
        self.isEnabled = isEnabled
        self.threshold = threshold
        self.currentLevel = currentLevel
        self.isSpeaking = isSpeaking
        self.silenceStartedAt = silenceStartedAt
    }
}

// MARK: - PTT Audio Manager

/// Manages audio broadcasting and receiving for PTT channels
@MainActor
public class PTTAudioManager: ObservableObject {
    // MARK: - Published Properties

    /// Whether currently broadcasting
    @Published public private(set) var isBroadcasting: Bool = false

    /// Current audio level (0-1 normalized)
    @Published public private(set) var audioLevel: Float = 0

    /// Current audio level in dB
    @Published public private(set) var audioLevelDB: Float = -100

    /// VAD state
    @Published public var vadState: VADState = VADState()

    /// Whether microphone access is granted
    @Published public private(set) var hasMicrophoneAccess: Bool = false

    /// Gain level (0-2, default 1)
    @Published public var gain: Float = 1.0

    // MARK: - Private Properties

    private let config: PTTAudioConfig
    private let logger = Logger(subsystem: "com.buildit", category: "PTTAudioManager")

    private let audioSession = AVAudioSession.sharedInstance()
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var playerNode: AVAudioPlayerNode?
    private var mixerNode: AVAudioMixerNode?

    /// Buffer for outgoing audio data
    private var captureBuffer: [Float] = []

    /// Lock for thread-safe buffer access
    private let bufferLock = NSLock()

    /// VAD silence timer
    private var vadSilenceTimer: Task<Void, Never>?

    // MARK: - Event Publishers

    /// Emits encoded audio data for transmission
    public let audioDataCaptured = PassthroughSubject<Data, Never>()

    /// Emits when voice activity is detected (VAD)
    public let voiceActivityDetected = PassthroughSubject<Bool, Never>()

    /// Emits when VAD triggers auto-release
    public let vadAutoRelease = PassthroughSubject<Void, Never>()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(config: PTTAudioConfig = .default) {
        self.config = config
        self.vadState.threshold = config.vadThreshold
    }

    deinit {
        stopBroadcasting()
        vadSilenceTimer?.cancel()
    }

    // MARK: - Audio Session Setup

    /// Initialize the audio context with microphone access
    public func initialize() async throws {
        // Request microphone permission
        let granted = await requestMicrophoneAccess()
        guard granted else {
            throw PTTAudioError.microphoneAccessDenied
        }

        // Configure audio session
        try configureAudioSession()

        // Setup audio engine
        try setupAudioEngine()

        logger.info("PTT Audio Manager initialized")
    }

    private func requestMicrophoneAccess() async -> Bool {
        return await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                Task { @MainActor in
                    self.hasMicrophoneAccess = granted
                }
                continuation.resume(returning: granted)
            }
        }
    }

    private func configureAudioSession() throws {
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
            )
            try audioSession.setPreferredSampleRate(config.sampleRate)
            try audioSession.setPreferredIOBufferDuration(0.005) // 5ms buffer
            try audioSession.setActive(true)

            logger.info("Audio session configured: sampleRate=\(self.audioSession.sampleRate)")
        } catch {
            logger.error("Audio session configuration failed: \(error.localizedDescription)")
            throw PTTAudioError.audioSessionFailed
        }
    }

    private func setupAudioEngine() throws {
        audioEngine = AVAudioEngine()

        guard let engine = audioEngine else {
            throw PTTAudioError.engineStartFailed
        }

        inputNode = engine.inputNode
        playerNode = AVAudioPlayerNode()
        mixerNode = AVAudioMixerNode()

        guard let playerNode = playerNode,
              let mixerNode = mixerNode else {
            throw PTTAudioError.engineStartFailed
        }

        // Attach nodes
        engine.attach(playerNode)
        engine.attach(mixerNode)

        // Get input format
        guard let inputFormat = inputNode?.outputFormat(forBus: 0),
              inputFormat.sampleRate > 0 else {
            throw PTTAudioError.noInputDevice
        }

        // Connect nodes for playback
        let outputFormat = engine.outputNode.inputFormat(forBus: 0)
        engine.connect(playerNode, to: mixerNode, format: outputFormat)
        engine.connect(mixerNode, to: engine.mainMixerNode, format: outputFormat)

        logger.info("Audio engine configured")
    }

    // MARK: - Broadcasting

    /// Start broadcasting audio
    public func startBroadcasting() throws {
        guard !isBroadcasting else { return }

        guard let engine = audioEngine,
              let inputNode = inputNode else {
            throw PTTAudioError.engineStartFailed
        }

        let inputFormat = inputNode.outputFormat(forBus: 0)

        // Install tap on input for audio capture
        inputNode.installTap(
            onBus: 0,
            bufferSize: config.bufferSize,
            format: inputFormat
        ) { [weak self] buffer, time in
            self?.processInputBuffer(buffer)
        }

        // Start engine
        do {
            try engine.start()
            isBroadcasting = true
            logger.info("Broadcasting started")
        } catch {
            logger.error("Failed to start engine: \(error.localizedDescription)")
            throw PTTAudioError.engineStartFailed
        }
    }

    /// Stop broadcasting audio
    public func stopBroadcasting() {
        guard isBroadcasting else { return }

        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        isBroadcasting = false

        // Clear VAD state
        vadSilenceTimer?.cancel()
        vadState.silenceStartedAt = nil
        vadState.isSpeaking = false

        audioLevel = 0
        audioLevelDB = -100

        logger.info("Broadcasting stopped")
    }

    // MARK: - Audio Processing

    private func processInputBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }

        let frameCount = Int(buffer.frameLength)

        // Apply gain
        var samples = [Float](repeating: 0, count: frameCount)
        for i in 0..<frameCount {
            samples[i] = channelData[i] * gain
        }

        // Calculate audio level
        let level = calculateRMSLevel(samples)
        let levelDB = 20 * log10(max(level, 0.000001))

        Task { @MainActor in
            self.audioLevel = level
            self.audioLevelDB = levelDB

            // Update VAD
            if self.vadState.isEnabled {
                self.processVAD(levelDB: levelDB)
            }
        }

        // Encode and emit audio data
        if let encodedData = encodeAudioData(samples) {
            Task { @MainActor in
                self.audioDataCaptured.send(encodedData)
            }
        }
    }

    private func calculateRMSLevel(_ samples: [Float]) -> Float {
        var rms: Float = 0
        vDSP_measqv(samples, 1, &rms, vDSP_Length(samples.count))
        return sqrt(rms)
    }

    // MARK: - Voice Activity Detection

    private func processVAD(levelDB: Float) {
        vadState.currentLevel = levelDB

        let wasAboveThreshold = vadState.isSpeaking
        let isAboveThreshold = levelDB > vadState.threshold

        if isAboveThreshold {
            // Voice detected
            vadState.isSpeaking = true
            vadState.silenceStartedAt = nil

            // Cancel silence timer
            vadSilenceTimer?.cancel()
            vadSilenceTimer = nil

            if !wasAboveThreshold {
                voiceActivityDetected.send(true)
            }
        } else if wasAboveThreshold && !isAboveThreshold {
            // Silence started
            vadState.silenceStartedAt = Date()

            // Start silence timer
            vadSilenceTimer?.cancel()
            vadSilenceTimer = Task { [weak self] in
                guard let self = self else { return }
                let timeout = UInt64(self.config.vadSilenceTimeout * 1_000_000_000)
                try? await Task.sleep(nanoseconds: timeout)
                guard !Task.isCancelled else { return }
                await self.handleVADSilenceTimeout()
            }
        }
    }

    private func handleVADSilenceTimeout() async {
        guard vadState.isEnabled && vadState.silenceStartedAt != nil else { return }

        vadState.isSpeaking = false
        vadState.silenceStartedAt = nil

        voiceActivityDetected.send(false)
        vadAutoRelease.send()

        logger.info("VAD silence timeout - auto release triggered")
    }

    /// Enable/disable VAD
    public func setVADEnabled(_ enabled: Bool) {
        vadState.isEnabled = enabled
        if !enabled {
            vadSilenceTimer?.cancel()
            vadState.silenceStartedAt = nil
        }
    }

    /// Set VAD threshold in dB
    public func setVADThreshold(_ threshold: Float) {
        vadState.threshold = threshold
    }

    // MARK: - Audio Encoding/Decoding

    /// Encode Float32 samples to Int16 data for transmission
    /// Float32 [-1, 1] -> Int16 [-32768, 32767]
    public func encodeAudioData(_ samples: [Float]) -> Data? {
        var int16Samples = [Int16](repeating: 0, count: samples.count)

        for i in 0..<samples.count {
            // Clamp to [-1, 1]
            let clamped = max(-1.0, min(1.0, samples[i]))
            // Scale to Int16 range
            int16Samples[i] = Int16(clamped * Float(Int16.max))
        }

        return int16Samples.withUnsafeBufferPointer { bufferPointer in
            Data(buffer: bufferPointer)
        }
    }

    /// Decode Int16 data back to Float32 samples
    /// Int16 [-32768, 32767] -> Float32 [-1, 1]
    public func decodeAudioData(_ data: Data) -> [Float]? {
        guard data.count >= 2 else { return nil }

        let int16Count = data.count / MemoryLayout<Int16>.size
        var int16Samples = [Int16](repeating: 0, count: int16Count)

        _ = int16Samples.withUnsafeMutableBufferPointer { bufferPointer in
            data.copyBytes(to: bufferPointer)
        }

        var floatSamples = [Float](repeating: 0, count: int16Count)
        for i in 0..<int16Count {
            floatSamples[i] = Float(int16Samples[i]) / Float(Int16.max)
        }

        return floatSamples
    }

    // MARK: - Playback

    /// Play received audio data
    public func playReceivedAudio(_ data: Data) {
        guard let samples = decodeAudioData(data),
              let engine = audioEngine,
              let playerNode = playerNode,
              let format = AVAudioFormat(
                  standardFormatWithSampleRate: config.sampleRate,
                  channels: 1
              ) else {
            return
        }

        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(samples.count)
        ) else {
            return
        }

        buffer.frameLength = AVAudioFrameCount(samples.count)

        if let channelData = buffer.floatChannelData?[0] {
            for i in 0..<samples.count {
                channelData[i] = samples[i]
            }
        }

        // Ensure engine is running
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                logger.error("Failed to start engine for playback: \(error.localizedDescription)")
                return
            }
        }

        // Play buffer
        playerNode.scheduleBuffer(buffer) {
            // Buffer finished playing
        }

        if !playerNode.isPlaying {
            playerNode.play()
        }
    }

    /// Play audio samples directly
    public func playSamples(_ samples: [Float]) {
        if let data = encodeAudioData(samples) {
            playReceivedAudio(data)
        }
    }

    // MARK: - Cleanup

    public func cleanup() {
        stopBroadcasting()
        vadSilenceTimer?.cancel()
        vadSilenceTimer = nil

        audioEngine?.stop()
        audioEngine = nil
        inputNode = nil
        playerNode = nil
        mixerNode = nil

        try? audioSession.setActive(false)

        cancellables.removeAll()
    }
}
