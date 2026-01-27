// OutboundDialerView.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI phone dialer for initiating outbound PSTN calls.

import SwiftUI

// MARK: - Hotline Info

/// Information about a hotline for the dialer
public struct HotlineInfo: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let phoneNumber: String?

    public init(id: String, name: String, phoneNumber: String? = nil) {
        self.id = id
        self.name = name
        self.phoneNumber = phoneNumber
    }
}

// MARK: - Outbound Dialer View

/// Phone dialer for initiating outbound PSTN calls
public struct OutboundDialerView: View {
    @ObservedObject var pstnCallManager: PSTNCallManager
    @ObservedObject var creditsManager: PSTNCreditsManager

    let hotlines: [HotlineInfo]
    let groupId: String

    @State private var phoneNumber: String = ""
    @State private var selectedHotline: HotlineInfo?
    @State private var isDialing = false
    @State private var errorMessage: String?
    @State private var showNoCreditsAlert = false
    @State private var creditBalance: LocalCreditBalance?

    @Environment(\.dismiss) private var dismiss

    public init(
        pstnCallManager: PSTNCallManager,
        creditsManager: PSTNCreditsManager,
        hotlines: [HotlineInfo],
        groupId: String
    ) {
        self.pstnCallManager = pstnCallManager
        self.creditsManager = creditsManager
        self.hotlines = hotlines
        self.groupId = groupId
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Credit Balance Indicator
            creditIndicator

            Spacer()

            // Phone Number Display
            phoneNumberDisplay

            Spacer()

            // Hotline Selector
            hotlineSelector

            // Numpad
            numpad

            // Call Button
            callButton

            Spacer()
                .frame(height: 24)
        }
        .padding(.horizontal)
        .navigationTitle("Dial")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            selectedHotline = hotlines.first
            await loadCredits()
        }
        .alert("Insufficient Credits", isPresented: $showNoCreditsAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("You don't have enough credits to make this call. Please contact your administrator.")
        }
    }

    // MARK: - Credit Indicator

    private var creditIndicator: some View {
        HStack(spacing: 8) {
            Image(systemName: "creditcard.fill")
                .foregroundColor(creditBalance?.statusColor ?? .gray)

            if let balance = creditBalance {
                Text("\(PSTNCreditsManager.formatCredits(balance.remaining)) available")
                    .font(.subheadline)

                if balance.isLow {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.yellow)
                        .font(.caption)
                }
            } else {
                Text("Loading...")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
        .padding(.top, 16)
    }

    // MARK: - Phone Number Display

    private var phoneNumberDisplay: some View {
        VStack(spacing: 8) {
            Text(formattedPhoneNumber)
                .font(.system(size: 36, weight: .light, design: .rounded))
                .foregroundColor(phoneNumber.isEmpty ? .secondary : .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(height: 50)

            // Clear button
            if !phoneNumber.isEmpty {
                Button {
                    phoneNumber = ""
                } label: {
                    Text("Clear")
                        .font(.subheadline)
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.horizontal, 32)
    }

    /// Format phone number with dashes (US format)
    private var formattedPhoneNumber: String {
        if phoneNumber.isEmpty {
            return "Enter number"
        }

        var number = phoneNumber
        // Add +1 prefix display for US numbers
        if number.count <= 10 && !number.hasPrefix("+") {
            // Format as (XXX) XXX-XXXX
            var formatted = ""
            for (index, char) in number.enumerated() {
                if index == 0 {
                    formatted += "("
                }
                formatted += String(char)
                if index == 2 {
                    formatted += ") "
                } else if index == 5 {
                    formatted += "-"
                }
            }
            return formatted.isEmpty ? "Enter number" : formatted
        }

        return number
    }

    // MARK: - Hotline Selector

    private var hotlineSelector: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Call from")
                .font(.caption)
                .foregroundColor(.secondary)

            Menu {
                ForEach(hotlines) { hotline in
                    Button {
                        selectedHotline = hotline
                    } label: {
                        HStack {
                            Text(hotline.name)
                            if hotline.id == selectedHotline?.id {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedHotline?.name ?? "Select hotline")
                            .font(.headline)

                        if let phone = selectedHotline?.phoneNumber {
                            Text(phone)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()

                    Image(systemName: "chevron.down")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.bottom, 24)
    }

    // MARK: - Numpad

    private var numpad: some View {
        VStack(spacing: 16) {
            ForEach(numpadRows, id: \.self) { row in
                HStack(spacing: 24) {
                    ForEach(row, id: \.self) { key in
                        NumpadButton(key: key) {
                            handleKeyPress(key)
                        }
                    }
                }
            }
        }
        .padding(.horizontal)
    }

    private let numpadRows = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["*", "0", "#"]
    ]

    private let numpadLetters: [String: String] = [
        "2": "ABC",
        "3": "DEF",
        "4": "GHI",
        "5": "JKL",
        "6": "MNO",
        "7": "PQRS",
        "8": "TUV",
        "9": "WXYZ"
    ]

    private func handleKeyPress(_ key: String) {
        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        // Limit to reasonable phone number length
        guard phoneNumber.count < 15 else { return }
        phoneNumber += key
    }

    // MARK: - Call Button

    private var callButton: some View {
        VStack(spacing: 12) {
            Button {
                Task {
                    await makeCall()
                }
            } label: {
                HStack(spacing: 8) {
                    if isDialing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "phone.fill")
                    }

                    Text(isDialing ? "Calling..." : "Call")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(canCall ? Color.green : Color.gray)
                .foregroundColor(.white)
                .cornerRadius(28)
            }
            .disabled(!canCall || isDialing)

            // Error message
            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(.top, 24)
    }

    /// Check if call can be made
    private var canCall: Bool {
        !phoneNumber.isEmpty &&
        phoneNumber.count >= 10 &&
        selectedHotline != nil &&
        creditBalance != nil &&
        (creditBalance?.remaining ?? 0) > 0
    }

    // MARK: - Actions

    private func loadCredits() async {
        creditBalance = try? await creditsManager.getBalance(groupId)
    }

    private func makeCall() async {
        guard let hotline = selectedHotline else { return }

        // Check credits
        let hasCredits = await creditsManager.hasCredits(groupId)
        guard hasCredits else {
            showNoCreditsAlert = true
            return
        }

        isDialing = true
        errorMessage = nil

        do {
            // Format phone number (add +1 for US if not present)
            var dialNumber = phoneNumber
            if !dialNumber.hasPrefix("+") && dialNumber.count == 10 {
                dialNumber = "+1" + dialNumber
            } else if !dialNumber.hasPrefix("+") {
                dialNumber = "+" + dialNumber
            }

            let options = OutboundCallOptions(
                targetPhone: dialNumber,
                hotlineId: hotline.id,
                callerId: hotline.phoneNumber
            )

            _ = try await pstnCallManager.dialOutbound(options)

            // Dismiss the dialer on success
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isDialing = false
    }
}

// MARK: - Numpad Button

private struct NumpadButton: View {
    let key: String
    let action: () -> Void

    private let letters: [String: String] = [
        "2": "ABC",
        "3": "DEF",
        "4": "GHI",
        "5": "JKL",
        "6": "MNO",
        "7": "PQRS",
        "8": "TUV",
        "9": "WXYZ",
        "0": "+"
    ]

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(key)
                    .font(.system(size: 32, weight: .light, design: .rounded))

                if let subText = letters[key] {
                    Text(subText)
                        .font(.system(size: 10, weight: .medium))
                        .tracking(2)
                        .foregroundColor(.secondary)
                } else {
                    Text(" ")
                        .font(.system(size: 10))
                }
            }
            .frame(width: 80, height: 80)
            .background(Color(.secondarySystemBackground))
            .clipShape(Circle())
        }
        .buttonStyle(NumpadButtonStyle())
    }
}

// MARK: - Numpad Button Style

private struct NumpadButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        OutboundDialerView(
            pstnCallManager: PSTNCallManager(
                config: PSTNBridgeConfig(workerUrl: "https://example.com"),
                callKitManager: CallKitManager()
            ),
            creditsManager: PSTNCreditsManager(workerUrl: "https://example.com"),
            hotlines: [
                HotlineInfo(id: "1", name: "Main Hotline", phoneNumber: "+1 (555) 123-4567"),
                HotlineInfo(id: "2", name: "Support Line", phoneNumber: "+1 (555) 987-6543")
            ],
            groupId: "test-group"
        )
    }
}
