// IncomingCallView.swift
// BuildIt - Decentralized Mesh Communication
//
// Incoming call UI with accept/decline buttons.
// Designed for CallKit integration.

import SwiftUI

/// Incoming call view
public struct IncomingCallView: View {
    @ObservedObject var service: CallingService
    let callState: LocalCallState

    @Environment(\.dismiss) private var dismiss
    @State private var pulseAnimation = false
    @State private var slideOffset: CGFloat = 0
    @State private var acceptButtonScale: CGFloat = 1.0
    @State private var declineButtonScale: CGFloat = 1.0

    public init(service: CallingService, callState: LocalCallState) {
        self.service = service
        self.callState = callState
    }

    public var body: some View {
        ZStack {
            // Background
            LinearGradient(
                colors: [Color.blue.opacity(0.9), Color.purple.opacity(0.9)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Caller info
                callerInfo

                Spacer()

                // Call type indicator
                callTypeIndicator

                Spacer()

                // Action buttons
                actionButtons

                Spacer()
                    .frame(height: 48)
            }
            .padding()
        }
        .onAppear {
            startAnimations()
        }
        .statusBar(hidden: true)
    }

    // MARK: - Caller Info

    private var callerInfo: some View {
        VStack(spacing: 20) {
            // Pulsing avatar ring
            ZStack {
                // Pulse rings
                ForEach(0..<3) { index in
                    Circle()
                        .stroke(Color.white.opacity(0.3 - Double(index) * 0.1), lineWidth: 2)
                        .frame(width: 140 + CGFloat(index * 20), height: 140 + CGFloat(index * 20))
                        .scaleEffect(pulseAnimation ? 1.2 : 1.0)
                        .opacity(pulseAnimation ? 0 : 1)
                        .animation(
                            .easeOut(duration: 1.5)
                            .repeatForever(autoreverses: false)
                            .delay(Double(index) * 0.3),
                            value: pulseAnimation
                        )
                }

                // Avatar
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.2))
                        .frame(width: 120, height: 120)

                    if let avatarURL = callState.remoteAvatarURL {
                        // AsyncImage for remote avatar
                        AsyncImage(url: URL(string: avatarURL)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            avatarPlaceholder
                        }
                        .frame(width: 110, height: 110)
                        .clipShape(Circle())
                    } else {
                        avatarPlaceholder
                    }
                }
            }

            // Caller name
            Text(callState.displayName)
                .font(.system(size: 32, weight: .semibold))
                .foregroundColor(.white)

            // Incoming call label
            Text("Incoming \(callState.callType == .video ? "Video" : "Voice") Call")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
        }
    }

    private var avatarPlaceholder: some View {
        Text(String(callState.displayName.prefix(1)).uppercased())
            .font(.system(size: 48, weight: .semibold))
            .foregroundColor(.white)
    }

    // MARK: - Call Type Indicator

    private var callTypeIndicator: some View {
        HStack(spacing: 12) {
            Image(systemName: callState.callType == .video ? "video.fill" : "phone.fill")
                .font(.title3)

            if callState.isEncrypted {
                Image(systemName: "lock.fill")
                    .font(.caption)
            }
        }
        .foregroundColor(.white.opacity(0.8))
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.15))
        .cornerRadius(25)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 64) {
            // Decline button
            VStack(spacing: 12) {
                Button {
                    declineButtonScale = 0.9
                    Task {
                        try? await service.declineCall(callState.callId, reason: .rejected)
                        dismiss()
                    }
                } label: {
                    Image(systemName: "phone.down.fill")
                        .font(.title)
                        .foregroundColor(.white)
                        .frame(width: 72, height: 72)
                        .background(Color.red)
                        .clipShape(Circle())
                        .scaleEffect(declineButtonScale)
                }
                .buttonStyle(PressableButtonStyle())
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in declineButtonScale = 0.95 }
                        .onEnded { _ in declineButtonScale = 1.0 }
                )

                Text("Decline")
                    .font(.subheadline)
                    .foregroundColor(.white)
            }

            // Accept button
            VStack(spacing: 12) {
                Button {
                    acceptButtonScale = 0.9
                    Task {
                        try? await service.acceptCall(callState.callId)
                        dismiss()
                    }
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.title)
                        .foregroundColor(.white)
                        .frame(width: 72, height: 72)
                        .background(Color.green)
                        .clipShape(Circle())
                        .scaleEffect(acceptButtonScale)
                }
                .buttonStyle(PressableButtonStyle())
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in acceptButtonScale = 0.95 }
                        .onEnded { _ in acceptButtonScale = 1.0 }
                )

                Text("Accept")
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
        }
    }

    // MARK: - Animations

    private func startAnimations() {
        pulseAnimation = true
    }
}

// MARK: - Pressable Button Style

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Incoming Call Overlay

/// Overlay that presents incoming call UI
public struct IncomingCallOverlay: View {
    @ObservedObject var service: CallingService

    @State private var showCallView = false
    @State private var acceptedCall: LocalCallState?

    public init(service: CallingService) {
        self.service = service
    }

    public var body: some View {
        Group {
            if let incomingCall = service.incomingCall {
                IncomingCallView(service: service, callState: incomingCall)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            if let currentCall = service.currentCallState, currentCall.isActive {
                CallView(service: service, callState: currentCall)
                    .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: service.incomingCall != nil)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: service.currentCallState?.isActive)
    }
}

// MARK: - CallKit Integration Placeholder

/// CallKit provider delegate placeholder
/// Full implementation would integrate with CallKit framework
public class CallKitManager: NSObject {
    // TODO: Implement CallKit integration
    // - CXProvider for system call UI
    // - CXCallController for call management
    // - Handle background call audio

    public static let shared = CallKitManager()

    /// Report incoming call to CallKit
    public func reportIncomingCall(
        uuid: UUID,
        handle: String,
        displayName: String?,
        hasVideo: Bool
    ) async throws {
        // Placeholder for CallKit implementation
        // let update = CXCallUpdate()
        // update.remoteHandle = CXHandle(type: .generic, value: handle)
        // update.localizedCallerName = displayName
        // update.hasVideo = hasVideo
        // try await provider.reportNewIncomingCall(with: uuid, update: update)
    }

    /// Report outgoing call to CallKit
    public func reportOutgoingCall(
        uuid: UUID,
        handle: String
    ) {
        // Placeholder for CallKit implementation
        // let handle = CXHandle(type: .generic, value: handle)
        // let startCallAction = CXStartCallAction(call: uuid, handle: handle)
        // let transaction = CXTransaction(action: startCallAction)
        // callController.request(transaction) { ... }
    }

    /// Report call connected
    public func reportCallConnected(uuid: UUID) {
        // Placeholder for CallKit implementation
        // provider.reportOutgoingCall(with: uuid, connectedAt: Date())
    }

    /// Report call ended
    public func reportCallEnded(uuid: UUID, reason: Int) {
        // Placeholder for CallKit implementation
        // provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
    }
}

// MARK: - Preview

#Preview("Incoming Call") {
    IncomingCallView(
        service: try! CallingService(store: try! CallingStore()),
        callState: LocalCallState(
            callId: "test-call",
            remotePubkey: "abc123456789",
            direction: .incoming,
            callType: .video,
            state: .ringing,
            startedAt: Date(),
            remoteName: "Alice"
        )
    )
}
