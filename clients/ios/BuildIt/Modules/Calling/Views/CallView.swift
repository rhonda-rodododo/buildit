// CallView.swift
// BuildIt - Decentralized Mesh Communication
//
// Active call UI with video/audio controls.

import SwiftUI

/// Main call view for active calls
public struct CallView: View {
    @ObservedObject var service: CallingService
    let callState: LocalCallState

    @Environment(\.dismiss) private var dismiss
    @State private var showControls = true
    @State private var controlsTimer: Timer?
    @State private var callDuration: Int = 0
    @State private var durationTimer: Timer?

    public init(service: CallingService, callState: LocalCallState) {
        self.service = service
        self.callState = callState
    }

    public var body: some View {
        ZStack {
            // Background
            callBackground

            // Video views (if video call)
            if callState.callType == .video {
                videoViews
            }

            // Controls overlay
            VStack {
                // Top bar
                topBar
                    .opacity(showControls ? 1 : 0)

                Spacer()

                // Call info (shown when not connected or controls visible)
                if callState.state != .connected || showControls {
                    callInfo
                }

                Spacer()

                // Bottom controls
                bottomControls
                    .opacity(showControls ? 1 : 0)
            }
            .padding()
        }
        .onAppear {
            startTimers()
        }
        .onDisappear {
            stopTimers()
        }
        .onTapGesture {
            toggleControls()
        }
        .statusBar(hidden: true)
    }

    // MARK: - Background

    private var callBackground: some View {
        Group {
            if callState.callType == .video {
                Color.black
            } else {
                LinearGradient(
                    colors: [Color.blue.opacity(0.8), Color.purple.opacity(0.8)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Video Views

    private var videoViews: some View {
        ZStack {
            // Remote video (full screen)
            RemoteVideoView()
                .ignoresSafeArea()

            // Local video (picture-in-picture)
            if callState.isVideoEnabled {
                VStack {
                    HStack {
                        Spacer()
                        LocalVideoView()
                            .frame(width: 120, height: 160)
                            .cornerRadius(12)
                            .shadow(radius: 8)
                            .padding(.top, 60)
                            .padding(.trailing, 16)
                    }
                    Spacer()
                }
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Back/minimize button
            Button {
                // Minimize call (go to PiP mode)
            } label: {
                Image(systemName: "arrow.down.right.and.arrow.up.left")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding(12)
                    .background(Color.black.opacity(0.3))
                    .clipShape(Circle())
            }

            Spacer()

            // Encryption indicator
            if callState.isEncrypted {
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill")
                    Text("E2EE")
                }
                .font(.caption)
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.green.opacity(0.8))
                .cornerRadius(20)
            }

            Spacer()

            // Quality indicator
            HStack(spacing: 4) {
                Image(systemName: callState.quality.qualityIcon)
                    .foregroundColor(qualityColor)
            }
            .padding(12)
            .background(Color.black.opacity(0.3))
            .clipShape(Circle())
        }
    }

    private var qualityColor: Color {
        switch callState.quality.qualityLevel {
        case .excellent, .good: return .green
        case .fair: return .yellow
        case .poor: return .red
        case .unknown: return .gray
        }
    }

    // MARK: - Call Info

    private var callInfo: some View {
        VStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.2))
                    .frame(width: 120, height: 120)

                Text(String(callState.displayName.prefix(1)).uppercased())
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Name
            Text(callState.displayName)
                .font(.title)
                .fontWeight(.semibold)
                .foregroundColor(.white)

            // Call status
            HStack(spacing: 8) {
                if callState.state == .connected {
                    Text(formattedDuration)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                } else {
                    Text(statusText)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))

                    if callState.state == .ringing || callState.state == .connecting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    }
                }
            }
        }
    }

    private var statusText: String {
        switch callState.state {
        case .initiating:
            return "Initiating call..."
        case .ringing:
            return "Ringing..."
        case .connecting:
            return "Connecting..."
        case .connected:
            return "Connected"
        case .reconnecting:
            return "Reconnecting..."
        case .onHold:
            return "On Hold"
        case .ended:
            return "Call Ended"
        }
    }

    private var formattedDuration: String {
        let hours = callDuration / 3600
        let minutes = (callDuration % 3600) / 60
        let seconds = callDuration % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }

    // MARK: - Bottom Controls

    private var bottomControls: some View {
        VStack(spacing: 24) {
            // Secondary controls row
            HStack(spacing: 32) {
                // Speaker toggle
                CallControlButton(
                    icon: callState.isSpeakerOn ? "speaker.wave.3.fill" : "speaker.fill",
                    label: "Speaker",
                    isActive: callState.isSpeakerOn
                ) {
                    Task {
                        await service.toggleSpeaker(callState.callId)
                    }
                }

                // Video toggle (only for video calls)
                if callState.supportsVideo {
                    CallControlButton(
                        icon: callState.isVideoEnabled ? "video.fill" : "video.slash.fill",
                        label: "Video",
                        isActive: callState.isVideoEnabled
                    ) {
                        Task {
                            await service.toggleVideo(callState.callId)
                        }
                    }
                }

                // Flip camera (only for video calls with video enabled)
                if callState.supportsVideo && callState.isVideoEnabled {
                    CallControlButton(
                        icon: "arrow.triangle.2.circlepath.camera",
                        label: "Flip",
                        isActive: false
                    ) {
                        Task {
                            await service.switchCamera(callState.callId)
                        }
                    }
                }

                // Mute toggle
                CallControlButton(
                    icon: callState.isMuted ? "mic.slash.fill" : "mic.fill",
                    label: "Mute",
                    isActive: callState.isMuted
                ) {
                    Task {
                        await service.toggleMute(callState.callId)
                    }
                }
            }

            // Primary controls row
            HStack(spacing: 48) {
                Spacer()

                // End call button
                Button {
                    Task {
                        try? await service.endCall(callState.callId, reason: .completed)
                        dismiss()
                    }
                } label: {
                    Image(systemName: "phone.down.fill")
                        .font(.title)
                        .foregroundColor(.white)
                        .frame(width: 72, height: 72)
                        .background(Color.red)
                        .clipShape(Circle())
                }

                Spacer()
            }
        }
        .padding(.bottom, 32)
    }

    // MARK: - Timer Management

    private func startTimers() {
        // Duration timer (updates every second when connected)
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if callState.state == .connected {
                callDuration += 1
            }
        }

        // Controls auto-hide timer
        resetControlsTimer()
    }

    private func stopTimers() {
        durationTimer?.invalidate()
        controlsTimer?.invalidate()
    }

    private func toggleControls() {
        withAnimation(.easeInOut(duration: 0.2)) {
            showControls.toggle()
        }
        if showControls {
            resetControlsTimer()
        }
    }

    private func resetControlsTimer() {
        controlsTimer?.invalidate()
        controlsTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { _ in
            if callState.state == .connected {
                withAnimation(.easeInOut(duration: 0.3)) {
                    showControls = false
                }
            }
        }
    }
}

// MARK: - Control Button

struct CallControlButton: View {
    let icon: String
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(isActive ? .blue : .white)
                    .frame(width: 56, height: 56)
                    .background(isActive ? Color.white : Color.white.opacity(0.2))
                    .clipShape(Circle())

                Text(label)
                    .font(.caption2)
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - Video Views (Placeholders)

struct LocalVideoView: View {
    var body: some View {
        ZStack {
            Color.gray.opacity(0.5)
            Image(systemName: "person.fill")
                .font(.largeTitle)
                .foregroundColor(.white.opacity(0.5))
        }
    }
}

struct RemoteVideoView: View {
    var body: some View {
        ZStack {
            Color.black
            Image(systemName: "person.fill")
                .font(.system(size: 80))
                .foregroundColor(.gray.opacity(0.3))
        }
    }
}

// MARK: - Preview

#Preview {
    CallView(
        service: try! CallingService(store: try! CallingStore()),
        callState: LocalCallState(
            callId: "test-call",
            remotePubkey: "abc123456789",
            direction: .outgoing,
            callType: .video,
            state: .connected,
            startedAt: Date()
        )
    )
}
