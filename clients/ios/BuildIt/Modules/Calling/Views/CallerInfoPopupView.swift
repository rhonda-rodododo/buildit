// CallerInfoPopupView.swift
// BuildIt - Decentralized Mesh Communication
//
// Popup view showing CRM contact info during incoming calls.
// Part of the CRM-Calling integration.

import SwiftUI

/// Popup view showing caller info from CRM during incoming calls
public struct CallerInfoPopupView: View {
    let phoneNumber: String
    let integration: CRMCallingIntegration
    let onCreateContact: (() -> Void)?
    let onViewContact: ((CRMContact) -> Void)?

    @State private var lookupResult: CallerLookupResult?
    @State private var isLoading: Bool = true

    public init(
        phoneNumber: String,
        integration: CRMCallingIntegration,
        onCreateContact: (() -> Void)? = nil,
        onViewContact: ((CRMContact) -> Void)? = nil
    ) {
        self.phoneNumber = phoneNumber
        self.integration = integration
        self.onCreateContact = onCreateContact
        self.onViewContact = onViewContact
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            Divider()

            if isLoading {
                loadingContent
            } else if let result = lookupResult, result.found, let contact = result.contact {
                contactContent(contact, result: result)
            } else {
                unknownCallerContent
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(radius: 8)
        .frame(maxWidth: 320)
        .task {
            await performLookup()
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack {
            Image(systemName: "phone.fill")
                .foregroundColor(.green)

            Text("Incoming Call")
                .font(.headline)

            Spacer()
        }
        .padding()
    }

    private var loadingContent: some View {
        HStack {
            ProgressView()
            Text("Looking up caller...")
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
    }

    private func contactContent(_ contact: CRMContact, result: CallerLookupResult) -> some View {
        VStack(spacing: 16) {
            // Contact avatar and name
            HStack(spacing: 12) {
                ContactAvatar(name: contact.displayName, size: 48)

                VStack(alignment: .leading, spacing: 4) {
                    Text(contact.displayName)
                        .font(.headline)

                    if let matchedField = result.matchedField {
                        Text("Matched: \(matchedField.displayName)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Verified indicator
                if contact.pubkey != nil {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundColor(.green)
                }
            }

            // Contact details
            VStack(spacing: 8) {
                if let email = contact.email {
                    ContactDetailRow(icon: "envelope", value: email)
                }

                ContactDetailRow(icon: "phone", value: phoneNumber)

                if let previousCalls = result.previousCalls, previousCalls > 0 {
                    ContactDetailRow(
                        icon: "phone.badge.checkmark",
                        value: "\(previousCalls) previous call\(previousCalls == 1 ? "" : "s")"
                    )
                }

                if let lastCall = result.lastCallDate {
                    ContactDetailRow(
                        icon: "clock",
                        value: "Last: \(lastCall.formatted(date: .abbreviated, time: .shortened))"
                    )
                }
            }

            // View contact button
            Button {
                onViewContact?(contact)
            } label: {
                HStack {
                    Image(systemName: "person.crop.rectangle")
                    Text("View Contact")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    private var unknownCallerContent: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            VStack(spacing: 4) {
                Text("Unknown Caller")
                    .font(.headline)

                Text(phoneNumber)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Button {
                onCreateContact?()
            } label: {
                HStack {
                    Image(systemName: "person.crop.circle.badge.plus")
                    Text("Add to Contacts")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Data Loading

    private func performLookup() async {
        isLoading = true
        defer { isLoading = false }

        do {
            lookupResult = try await integration.lookupByPhone(phone: phoneNumber)
        } catch {
            lookupResult = .notFound
        }
    }
}

// MARK: - Contact Avatar

struct ContactAvatar: View {
    let name: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(avatarColor)

            Text(initials)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundColor(.white)
        }
        .frame(width: size, height: size)
    }

    private var initials: String {
        let components = name.components(separatedBy: " ")
        let firstInitial = components.first?.first.map(String.init) ?? ""
        let lastInitial = components.dropFirst().first?.first.map(String.init) ?? ""
        return (firstInitial + lastInitial).uppercased()
    }

    private var avatarColor: Color {
        // Generate consistent color based on name
        let hash = name.hashValue
        let hue = Double(abs(hash) % 360) / 360.0
        return Color(hue: hue, saturation: 0.6, brightness: 0.7)
    }
}

// MARK: - Contact Detail Row

struct ContactDetailRow: View {
    let icon: String
    let value: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.secondary)
                .frame(width: 20)

            Text(value)
                .font(.subheadline)

            Spacer()
        }
    }
}

// MARK: - Incoming Call Overlay

/// Full-screen overlay for incoming calls with caller info
public struct IncomingCallOverlay: View {
    let phoneNumber: String
    let integration: CRMCallingIntegration
    let onAnswer: () -> Void
    let onDecline: () -> Void
    let onCreateContact: (() -> Void)?

    @State private var lookupResult: CallerLookupResult?
    @State private var isLoading: Bool = true

    public init(
        phoneNumber: String,
        integration: CRMCallingIntegration,
        onAnswer: @escaping () -> Void,
        onDecline: @escaping () -> Void,
        onCreateContact: (() -> Void)? = nil
    ) {
        self.phoneNumber = phoneNumber
        self.integration = integration
        self.onAnswer = onAnswer
        self.onDecline = onDecline
        self.onCreateContact = onCreateContact
    }

    public var body: some View {
        ZStack {
            // Background
            Color.black.opacity(0.9)
                .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Caller info
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else if let result = lookupResult, result.found, let contact = result.contact {
                    knownCallerHeader(contact)
                } else {
                    unknownCallerHeader
                }

                // Phone number
                Text(phoneNumber)
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.8))

                // Calling indicator
                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(Color.white.opacity(0.6))
                            .frame(width: 8, height: 8)
                            .scaleEffect(1.0)
                            .animation(
                                Animation.easeInOut(duration: 0.5)
                                    .repeatForever()
                                    .delay(Double(index) * 0.2),
                                value: isLoading
                            )
                    }
                }

                Spacer()

                // Action buttons
                HStack(spacing: 60) {
                    // Decline button
                    Button(action: onDecline) {
                        VStack {
                            Image(systemName: "phone.down.fill")
                                .font(.title)
                                .frame(width: 70, height: 70)
                                .background(Color.red)
                                .clipShape(Circle())

                            Text("Decline")
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.white)

                    // Answer button
                    Button(action: onAnswer) {
                        VStack {
                            Image(systemName: "phone.fill")
                                .font(.title)
                                .frame(width: 70, height: 70)
                                .background(Color.green)
                                .clipShape(Circle())

                            Text("Answer")
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.white)
                }
                .padding(.bottom, 40)
            }
        }
        .task {
            await performLookup()
        }
    }

    private func knownCallerHeader(_ contact: CRMContact) -> some View {
        VStack(spacing: 16) {
            ContactAvatar(name: contact.displayName, size: 100)

            Text(contact.displayName)
                .font(.largeTitle)
                .fontWeight(.semibold)
                .foregroundColor(.white)

            if contact.pubkey != nil {
                Label("Verified Contact", systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        }
    }

    private var unknownCallerHeader: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 80))
                .foregroundColor(.white.opacity(0.8))

            Text("Unknown Caller")
                .font(.largeTitle)
                .fontWeight(.semibold)
                .foregroundColor(.white)

            if onCreateContact != nil {
                Button {
                    onCreateContact?()
                } label: {
                    Label("Add Contact", systemImage: "person.crop.circle.badge.plus")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(.white)
            }
        }
    }

    private func performLookup() async {
        isLoading = true
        defer { isLoading = false }

        do {
            lookupResult = try await integration.lookupByPhone(phone: phoneNumber)
        } catch {
            lookupResult = .notFound
        }
    }
}

// MARK: - Preview

#Preview("Caller Info Popup") {
    CallerInfoPopupView(
        phoneNumber: "+1 (555) 123-4567",
        integration: CRMCallingIntegration()
    )
    .padding()
    .background(Color(.systemGray6))
}

#Preview("Incoming Call Overlay") {
    IncomingCallOverlay(
        phoneNumber: "+1 (555) 123-4567",
        integration: CRMCallingIntegration(),
        onAnswer: {},
        onDecline: {}
    )
}
