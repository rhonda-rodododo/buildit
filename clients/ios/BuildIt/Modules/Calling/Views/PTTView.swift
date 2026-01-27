// PTTView.swift
// BuildIt - Decentralized Mesh Communication
//
// Push-to-Talk (PTT) user interface with channel controls,
// speaker queue display, and visual audio feedback.

import SwiftUI
import Combine

// MARK: - PTT View

/// Main PTT channel view
public struct PTTView: View {
    @ObservedObject var channelManager: PTTChannelManager
    @ObservedObject var audioManager: PTTAudioManager

    let channelId: String

    @State private var isPressing: Bool = false
    @State private var showSettings: Bool = false
    @State private var showMembersPanel: Bool = false

    public init(
        channelManager: PTTChannelManager,
        audioManager: PTTAudioManager,
        channelId: String
    ) {
        self.channelManager = channelManager
        self.audioManager = audioManager
        self.channelId = channelId
    }

    private var channel: PTTChannel? {
        channelManager.channels[channelId]
    }

    private var members: [PTTMember] {
        channelManager.channelMembers[channelId] ?? []
    }

    private var currentSpeaker: CurrentSpeaker? {
        channelManager.currentSpeakers[channelId]
    }

    private var speakerQueue: [SpeakerQueueEntry] {
        channelManager.speakerQueues[channelId] ?? []
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Channel header
            channelHeader

            Divider()

            // Main content
            ScrollView {
                VStack(spacing: 24) {
                    // Current speaker indicator
                    currentSpeakerView

                    // PTT Button
                    pttButton

                    // Speaker queue
                    if !speakerQueue.isEmpty {
                        speakerQueueView
                    }

                    // VAD toggle
                    vadToggle

                    Spacer(minLength: 20)
                }
                .padding()
            }

            // Members panel (bottom sheet style)
            if showMembersPanel {
                membersPanel
                    .transition(.move(edge: .bottom))
            }
        }
        .background(Color(.systemGroupedBackground))
        .sheet(isPresented: $showSettings) {
            PTTSettingsView(audioManager: audioManager)
        }
    }

    // MARK: - Channel Header

    private var channelHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(channel?.name ?? "PTT Channel")
                    .font(.headline)
                    .foregroundColor(.primary)

                HStack(spacing: 4) {
                    Image(systemName: "person.2.fill")
                        .font(.caption)
                    Text("\(members.filter { $0.isOnline }.count) online")
                        .font(.caption)

                    if channel?.isE2EE == true {
                        Image(systemName: "lock.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
                .foregroundColor(.secondary)
            }

            Spacer()

            // Members button
            Button {
                withAnimation(.spring()) {
                    showMembersPanel.toggle()
                }
            } label: {
                Image(systemName: "person.2.circle")
                    .font(.title2)
                    .foregroundColor(.blue)
            }

            // Settings button
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.title2)
                    .foregroundColor(.gray)
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }

    // MARK: - Current Speaker View

    private var currentSpeakerView: some View {
        VStack(spacing: 16) {
            if let speaker = currentSpeaker {
                // Speaker avatar with audio visualization
                ZStack {
                    // Outer pulse ring (animated based on audio level)
                    Circle()
                        .stroke(Color.green.opacity(0.3), lineWidth: 3)
                        .frame(width: 140, height: 140)
                        .scaleEffect(1 + CGFloat(audioManager.audioLevel) * 0.3)
                        .animation(.easeOut(duration: 0.1), value: audioManager.audioLevel)

                    // Inner ring
                    Circle()
                        .stroke(Color.green, lineWidth: 4)
                        .frame(width: 120, height: 120)

                    // Avatar
                    Circle()
                        .fill(Color.green.opacity(0.2))
                        .frame(width: 110, height: 110)

                    // Initial or icon
                    Text(speaker.displayName?.prefix(1).uppercased() ?? "?")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.green)
                }

                // Speaker name
                VStack(spacing: 4) {
                    Text(speaker.displayName ?? String(speaker.pubkey.prefix(8)) + "...")
                        .font(.title2)
                        .fontWeight(.semibold)

                    HStack(spacing: 4) {
                        Image(systemName: "mic.fill")
                            .foregroundColor(.green)
                        Text("Speaking")
                            .foregroundColor(.green)

                        if speaker.priority != .normal {
                            Text("(\(speaker.priority.rawValue.capitalized))")
                                .foregroundColor(.orange)
                        }
                    }
                    .font(.subheadline)
                }

                // Audio level indicator
                audioLevelIndicator
            } else {
                // No one speaking
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 3)
                        .frame(width: 120, height: 120)

                    Circle()
                        .fill(Color.gray.opacity(0.1))
                        .frame(width: 110, height: 110)

                    Image(systemName: "waveform")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                }

                Text("No one speaking")
                    .font(.headline)
                    .foregroundColor(.secondary)

                Text("Press and hold to talk")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 24)
    }

    // MARK: - Audio Level Indicator

    private var audioLevelIndicator: some View {
        HStack(spacing: 3) {
            ForEach(0..<10, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(barColor(for: index))
                    .frame(width: 8, height: 20)
                    .opacity(audioManager.audioLevel * 10 > Float(index) ? 1 : 0.3)
            }
        }
        .padding(.horizontal)
    }

    private func barColor(for index: Int) -> Color {
        if index < 6 {
            return .green
        } else if index < 8 {
            return .yellow
        } else {
            return .red
        }
    }

    // MARK: - PTT Button

    private var pttButton: some View {
        VStack(spacing: 12) {
            // Main PTT button
            ZStack {
                // Background glow when pressing
                if isPressing {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.blue.opacity(0.4), Color.clear],
                                center: .center,
                                startRadius: 50,
                                endRadius: 100
                            )
                        )
                        .frame(width: 200, height: 200)
                }

                // Button
                Circle()
                    .fill(isPressing ? Color.blue : Color.blue.opacity(0.8))
                    .frame(width: 120, height: 120)
                    .shadow(color: .blue.opacity(isPressing ? 0.5 : 0.2), radius: isPressing ? 20 : 10)
                    .scaleEffect(isPressing ? 1.1 : 1.0)

                // Icon
                VStack(spacing: 8) {
                    Image(systemName: isPressing ? "mic.fill" : "mic")
                        .font(.system(size: 36))
                        .foregroundColor(.white)

                    Text(isPressing ? "SPEAKING" : "PUSH")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressing {
                            handlePTTPress()
                        }
                    }
                    .onEnded { _ in
                        handlePTTRelease()
                    }
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressing)

            // Status text
            pttStatusText
        }
    }

    private var pttStatusText: some View {
        Group {
            if let _ = currentSpeaker {
                if isPressing {
                    Text("Release to stop speaking")
                        .foregroundColor(.blue)
                } else {
                    Text("Wait for your turn")
                        .foregroundColor(.orange)
                }
            } else {
                Text("Press and hold to talk")
                    .foregroundColor(.secondary)
            }
        }
        .font(.subheadline)
    }

    // MARK: - Speaker Queue View

    private var speakerQueueView: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "list.number")
                Text("Speaker Queue")
                    .font(.headline)
                Spacer()
                Text("\(speakerQueue.count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            VStack(spacing: 8) {
                ForEach(Array(speakerQueue.enumerated()), id: \.element.id) { index, entry in
                    HStack {
                        // Position
                        Text("\(index + 1)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .frame(width: 24, height: 24)
                            .background(priorityColor(entry.priority))
                            .clipShape(Circle())

                        // Name
                        Text(entry.displayName ?? String(entry.pubkey.prefix(8)) + "...")
                            .font(.subheadline)

                        Spacer()

                        // Priority badge
                        if entry.priority != .normal {
                            Text(entry.priority.rawValue.capitalized)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(priorityColor(entry.priority).opacity(0.2))
                                .foregroundColor(priorityColor(entry.priority))
                                .cornerRadius(8)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemGroupedBackground))
                    .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func priorityColor(_ priority: SpeakingPriority) -> Color {
        switch priority {
        case .normal: return .blue
        case .high: return .orange
        case .moderator: return .purple
        }
    }

    // MARK: - VAD Toggle

    private var vadToggle: some View {
        VStack(spacing: 12) {
            Toggle(isOn: Binding(
                get: { audioManager.vadState.isEnabled },
                set: { audioManager.setVADEnabled($0) }
            )) {
                HStack {
                    Image(systemName: "waveform.badge.mic")
                        .foregroundColor(.blue)
                    VStack(alignment: .leading) {
                        Text("Voice Activity Detection")
                            .font(.subheadline)
                        Text("Auto-release when silent")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .toggleStyle(SwitchToggleStyle(tint: .blue))

            if audioManager.vadState.isEnabled {
                // VAD threshold slider
                HStack {
                    Text("Threshold")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Slider(
                        value: Binding(
                            get: { Double(audioManager.vadState.threshold) },
                            set: { audioManager.setVADThreshold(Float($0)) }
                        ),
                        in: -60...0
                    )

                    Text("\(Int(audioManager.vadState.threshold)) dB")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(width: 50)
                }

                // Current level indicator
                HStack {
                    Text("Level:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.gray.opacity(0.2))

                            Rectangle()
                                .fill(audioManager.vadState.isSpeaking ? Color.green : Color.gray)
                                .frame(width: levelWidth(geometry: geometry))

                            // Threshold marker
                            Rectangle()
                                .fill(Color.red)
                                .frame(width: 2)
                                .offset(x: thresholdPosition(geometry: geometry))
                        }
                    }
                    .frame(height: 8)
                    .cornerRadius(4)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func levelWidth(geometry: GeometryProxy) -> CGFloat {
        let normalized = (audioManager.audioLevelDB + 60) / 60 // -60 to 0 -> 0 to 1
        return max(0, min(geometry.size.width, CGFloat(normalized) * geometry.size.width))
    }

    private func thresholdPosition(geometry: GeometryProxy) -> CGFloat {
        let normalized = (audioManager.vadState.threshold + 60) / 60
        return max(0, min(geometry.size.width - 2, CGFloat(normalized) * geometry.size.width))
    }

    // MARK: - Members Panel

    private var membersPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Handle
            HStack {
                Spacer()
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.gray.opacity(0.4))
                    .frame(width: 40, height: 4)
                Spacer()
            }
            .padding(.vertical, 8)

            // Title
            HStack {
                Text("Members")
                    .font(.headline)
                Spacer()
                Text("\(members.count) total")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            .padding(.bottom, 12)

            Divider()

            // Online members
            VStack(alignment: .leading, spacing: 4) {
                Text("Online")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                    .padding(.top, 8)

                ForEach(channelManager.getOnlineMembers(channelId: channelId)) { member in
                    memberRow(member, isOnline: true)
                }
            }

            // Offline members
            let offlineMembers = channelManager.getOfflineMembers(channelId: channelId)
            if !offlineMembers.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Offline")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                        .padding(.top, 12)

                    ForEach(offlineMembers) { member in
                        memberRow(member, isOnline: false)
                    }
                }
            }

            Spacer()
        }
        .frame(maxHeight: 300)
        .background(Color(.systemBackground))
        .cornerRadius(16, corners: [.topLeft, .topRight])
        .shadow(radius: 5)
    }

    private func memberRow(_ member: PTTMember, isOnline: Bool) -> some View {
        HStack {
            // Status dot
            Circle()
                .fill(isOnline ? Color.green : Color.gray)
                .frame(width: 8, height: 8)

            // Name
            Text(member.displayName ?? String(member.pubkey.prefix(8)) + "...")
                .font(.subheadline)
                .foregroundColor(isOnline ? .primary : .secondary)

            Spacer()

            // Speaking indicator
            if currentSpeaker?.pubkey == member.pubkey {
                Image(systemName: "waveform")
                    .foregroundColor(.green)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Actions

    private func handlePTTPress() {
        isPressing = true

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()

        Task {
            do {
                // Request speak
                try await channelManager.requestSpeak(channelId)

                // Start broadcasting
                try audioManager.startBroadcasting()
            } catch {
                // Handle error (might be queued)
                print("PTT press error: \(error.localizedDescription)")
            }
        }
    }

    private func handlePTTRelease() {
        isPressing = false

        // Stop broadcasting
        audioManager.stopBroadcasting()

        Task {
            // Release speak
            try? await channelManager.releaseSpeak(channelId)
        }
    }
}

// MARK: - PTT Settings View

struct PTTSettingsView: View {
    @ObservedObject var audioManager: PTTAudioManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Audio")) {
                    // Gain slider
                    HStack {
                        Text("Microphone Gain")
                        Slider(
                            value: $audioManager.gain,
                            in: 0...2
                        )
                        Text(String(format: "%.1fx", audioManager.gain))
                            .foregroundColor(.secondary)
                            .frame(width: 40)
                    }
                }

                Section(header: Text("Voice Activity Detection")) {
                    Toggle("Enable VAD", isOn: Binding(
                        get: { audioManager.vadState.isEnabled },
                        set: { audioManager.setVADEnabled($0) }
                    ))

                    if audioManager.vadState.isEnabled {
                        HStack {
                            Text("Threshold")
                            Slider(
                                value: Binding(
                                    get: { Double(audioManager.vadState.threshold) },
                                    set: { audioManager.setVADThreshold(Float($0)) }
                                ),
                                in: -60...0
                            )
                            Text("\(Int(audioManager.vadState.threshold)) dB")
                                .foregroundColor(.secondary)
                                .frame(width: 50)
                        }
                    }
                }

                Section(header: Text("Info")) {
                    HStack {
                        Text("Microphone Access")
                        Spacer()
                        Text(audioManager.hasMicrophoneAccess ? "Granted" : "Denied")
                            .foregroundColor(audioManager.hasMicrophoneAccess ? .green : .red)
                    }
                }
            }
            .navigationTitle("PTT Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - Preview

#Preview {
    PTTView(
        channelManager: PTTChannelManager(),
        audioManager: PTTAudioManager(),
        channelId: "preview-channel"
    )
}
