// CreateCampaignView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for creating a new fundraising campaign with wizard-style flow.

import SwiftUI

/// Campaign creation wizard
public struct CreateCampaignView: View {
    @Environment(\.dismiss) private var dismiss

    let service: FundraisingService
    let onComplete: () -> Void

    @State private var currentStep = 0
    @State private var title = ""
    @State private var description = ""
    @State private var goal = ""
    @State private var currency = "USD"
    @State private var hasDeadline = false
    @State private var deadline: Date = Date().addingTimeInterval(86400 * 30) // 30 days
    @State private var visibility: CampaignVisibility = .group
    @State private var useTiers = false
    @State private var tiers: [DonationTier] = DonationTier.defaults
    @State private var enableCrypto = false
    @State private var bitcoinAddress = ""
    @State private var ethereumAddress = ""
    @State private var lightningAddress = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let steps = ["Basic Info", "Goal & Timing", "Options", "Review"]

    public init(service: FundraisingService, onComplete: @escaping () -> Void) {
        self.service = service
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress indicator
                StepProgressBar(currentStep: currentStep, totalSteps: steps.count, stepNames: steps)
                    .padding()

                // Step content
                TabView(selection: $currentStep) {
                    BasicInfoStep(
                        title: $title,
                        description: $description
                    )
                    .tag(0)

                    GoalTimingStep(
                        goal: $goal,
                        currency: $currency,
                        hasDeadline: $hasDeadline,
                        deadline: $deadline
                    )
                    .tag(1)

                    OptionsStep(
                        visibility: $visibility,
                        useTiers: $useTiers,
                        tiers: $tiers,
                        enableCrypto: $enableCrypto,
                        bitcoinAddress: $bitcoinAddress,
                        ethereumAddress: $ethereumAddress,
                        lightningAddress: $lightningAddress,
                        service: service
                    )
                    .tag(2)

                    ReviewStep(
                        title: title,
                        description: description,
                        goal: goal,
                        currency: currency,
                        hasDeadline: hasDeadline,
                        deadline: deadline,
                        visibility: visibility,
                        useTiers: useTiers,
                        tiers: tiers,
                        enableCrypto: enableCrypto
                    )
                    .tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentStep)

                // Error message
                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding(.horizontal)
                }

                // Navigation buttons
                HStack(spacing: 16) {
                    if currentStep > 0 {
                        Button {
                            withAnimation { currentStep -= 1 }
                        } label: {
                            Label("Back", systemImage: "chevron.left")
                        }
                        .buttonStyle(.bordered)
                    }

                    Spacer()

                    if currentStep < steps.count - 1 {
                        Button {
                            if validateCurrentStep() {
                                withAnimation { currentStep += 1 }
                            }
                        } label: {
                            Label("Next", systemImage: "chevron.right")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!canProceed)
                    } else {
                        Button {
                            Task { await createCampaign() }
                        } label: {
                            if isSubmitting {
                                ProgressView()
                            } else {
                                Label("Create Campaign", systemImage: "checkmark.circle")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!canCreate || isSubmitting)
                    }
                }
                .padding()
            }
            .navigationTitle("New Campaign")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var canProceed: Bool {
        switch currentStep {
        case 0:
            return !title.trimmingCharacters(in: .whitespaces).isEmpty
        case 1:
            return Double(goal) != nil && Double(goal)! > 0
        default:
            return true
        }
    }

    private var canCreate: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        Double(goal) != nil && Double(goal)! > 0
    }

    private func validateCurrentStep() -> Bool {
        errorMessage = nil

        switch currentStep {
        case 0:
            if title.trimmingCharacters(in: .whitespaces).isEmpty {
                errorMessage = "Please enter a campaign title"
                return false
            }
        case 1:
            guard let goalAmount = Double(goal), goalAmount > 0 else {
                errorMessage = "Please enter a valid goal amount"
                return false
            }
        default:
            break
        }

        return true
    }

    private func createCampaign() async {
        guard validateCurrentStep() else { return }

        isSubmitting = true
        errorMessage = nil

        do {
            var cryptoPayment: CryptoPaymentInfo?
            if enableCrypto {
                cryptoPayment = CryptoPaymentInfo(
                    bitcoinAddress: bitcoinAddress.isEmpty ? nil : bitcoinAddress,
                    ethereumAddress: ethereumAddress.isEmpty ? nil : ethereumAddress,
                    lightningAddress: lightningAddress.isEmpty ? nil : lightningAddress
                )
            }

            _ = try await service.createCampaign(
                title: title.trimmingCharacters(in: .whitespaces),
                description: description.isEmpty ? nil : description,
                goal: Double(goal) ?? 0,
                currency: currency,
                endsAt: hasDeadline ? deadline : nil,
                visibility: visibility,
                tiers: useTiers ? tiers : [],
                cryptoPayment: cryptoPayment
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// Step progress bar
struct StepProgressBar: View {
    let currentStep: Int
    let totalSteps: Int
    let stepNames: [String]

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(0..<totalSteps, id: \.self) { step in
                    Rectangle()
                        .fill(step <= currentStep ? Color.accentColor : Color(.systemGray4))
                        .frame(height: 4)
                        .cornerRadius(2)
                }
            }

            HStack {
                Text(stepNames[currentStep])
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.accentColor)

                Spacer()

                Text("Step \(currentStep + 1) of \(totalSteps)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

/// Basic info step
struct BasicInfoStep: View {
    @Binding var title: String
    @Binding var description: String

    var body: some View {
        Form {
            Section("Campaign Title") {
                TextField("What are you fundraising for?", text: $title)
                    .font(.title3)

                Text("Choose a clear, compelling title that describes your cause")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Section("Description") {
                TextField("Tell your story...", text: $description, axis: .vertical)
                    .lineLimit(5...10)

                Text("Explain why this campaign matters and how the funds will be used")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

/// Goal and timing step
struct GoalTimingStep: View {
    @Binding var goal: String
    @Binding var currency: String
    @Binding var hasDeadline: Bool
    @Binding var deadline: Date

    private let currencies = ["USD", "EUR", "GBP", "BTC", "ETH"]

    var body: some View {
        Form {
            Section("Fundraising Goal") {
                HStack {
                    Picker("Currency", selection: $currency) {
                        ForEach(currencies, id: \.self) { curr in
                            Text(curr).tag(curr)
                        }
                    }
                    .labelsHidden()
                    .frame(width: 80)

                    TextField("Amount", text: $goal)
                        .keyboardType(.decimalPad)
                        .font(.title2)
                }

                Text("Set a realistic but ambitious goal")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Section("Timeline") {
                Toggle("Set a deadline", isOn: $hasDeadline)

                if hasDeadline {
                    DatePicker(
                        "Campaign ends",
                        selection: $deadline,
                        in: Date()...,
                        displayedComponents: .date
                    )

                    let days = Calendar.current.dateComponents([.day], from: Date(), to: deadline).day ?? 0
                    Text("Campaign will run for \(days) days")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

/// Options step
struct OptionsStep: View {
    @Binding var visibility: CampaignVisibility
    @Binding var useTiers: Bool
    @Binding var tiers: [DonationTier]
    @Binding var enableCrypto: Bool
    @Binding var bitcoinAddress: String
    @Binding var ethereumAddress: String
    @Binding var lightningAddress: String

    let service: FundraisingService

    @State private var isGeneratingAddresses = false

    var body: some View {
        Form {
            Section("Visibility") {
                Picker("Who can see this campaign?", selection: $visibility) {
                    ForEach(CampaignVisibility.allCases, id: \.self) { vis in
                        Label(vis.displayName, systemImage: vis.icon)
                            .tag(vis)
                    }
                }
            }

            Section("Donation Tiers") {
                Toggle("Use suggested donation tiers", isOn: $useTiers)

                if useTiers {
                    ForEach($tiers) { $tier in
                        TierEditor(tier: $tier)
                    }

                    Button {
                        tiers.append(DonationTier(amount: 0))
                    } label: {
                        Label("Add Tier", systemImage: "plus.circle")
                    }
                }
            }

            Section("Cryptocurrency") {
                Toggle("Accept crypto payments", isOn: $enableCrypto)

                if enableCrypto {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Image(systemName: "bitcoinsign.circle")
                                .foregroundColor(.orange)
                            TextField("Bitcoin Address", text: $bitcoinAddress)
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "diamond")
                                .foregroundColor(.purple)
                            TextField("Ethereum Address", text: $ethereumAddress)
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "bolt.circle")
                                .foregroundColor(.yellow)
                            TextField("Lightning Address", text: $lightningAddress)
                                .font(.caption)
                        }

                        Button {
                            Task { await generateAddresses() }
                        } label: {
                            if isGeneratingAddresses {
                                ProgressView()
                            } else {
                                Label("Generate Addresses", systemImage: "wand.and.stars")
                            }
                        }
                        .disabled(isGeneratingAddresses)
                    }

                    Text("Note: Crypto address generation is a placeholder. Connect your wallet for real addresses.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func generateAddresses() async {
        isGeneratingAddresses = true
        do {
            bitcoinAddress = try await service.generateBitcoinAddress(for: "temp")
            ethereumAddress = try await service.generateEthereumAddress(for: "temp")
            lightningAddress = "user@buildit.network" // Placeholder Lightning address
        } catch {
            // Handle error
        }
        isGeneratingAddresses = false
    }
}

/// Tier editor
struct TierEditor: View {
    @Binding var tier: DonationTier

    @State private var amountText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                TextField("Tier Name", text: Binding(
                    get: { tier.name ?? "" },
                    set: { tier.name = $0.isEmpty ? nil : $0 }
                ))

                TextField("Amount", text: $amountText)
                    .keyboardType(.decimalPad)
                    .frame(width: 80)
                    .onChange(of: amountText) { _, newValue in
                        if let amount = Double(newValue) {
                            tier.amount = amount
                        }
                    }
                    .onAppear {
                        amountText = tier.amount > 0 ? String(Int(tier.amount)) : ""
                    }
            }

            TextField("Description (optional)", text: Binding(
                get: { tier.description ?? "" },
                set: { tier.description = $0.isEmpty ? nil : $0 }
            ))
            .font(.caption)
        }
        .padding(.vertical, 4)
    }
}

/// Review step
struct ReviewStep: View {
    let title: String
    let description: String
    let goal: String
    let currency: String
    let hasDeadline: Bool
    let deadline: Date
    let visibility: CampaignVisibility
    let useTiers: Bool
    let tiers: [DonationTier]
    let enableCrypto: Bool

    var body: some View {
        Form {
            Section("Campaign Preview") {
                VStack(alignment: .leading, spacing: 12) {
                    Text(title)
                        .font(.title2)
                        .fontWeight(.bold)

                    if !description.isEmpty {
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Section("Details") {
                ReviewRow(label: "Goal", value: formatCurrency(Double(goal) ?? 0))
                ReviewRow(label: "Visibility", value: visibility.displayName)

                if hasDeadline {
                    ReviewRow(label: "Deadline", value: deadline.formatted(date: .abbreviated, time: .omitted))
                } else {
                    ReviewRow(label: "Deadline", value: "No deadline")
                }

                ReviewRow(label: "Donation Tiers", value: useTiers ? "\(tiers.count) tiers" : "None")
                ReviewRow(label: "Crypto Payments", value: enableCrypto ? "Enabled" : "Disabled")
            }

            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Your campaign will start as a draft", systemImage: "info.circle")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("You can launch it when you're ready from the campaign details page.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

struct ReviewRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}
