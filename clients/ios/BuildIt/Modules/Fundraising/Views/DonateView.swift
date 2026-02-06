// DonateView.swift
// BuildIt - Decentralized Mesh Communication
//
// Donation flow with support for multiple payment methods including crypto.

import SwiftUI

// Import localization
private typealias Strings = L10n.Fundraising

/// Donation flow view
public struct DonateView: View {
    @Environment(\.dismiss) private var dismiss

    let campaign: Campaign
    let service: FundraisingService
    let onComplete: () -> Void

    @State private var amount = ""
    @State private var selectedTier: DonationTier?
    @State private var customAmount = false
    @State private var donorName = ""
    @State private var message = ""
    @State private var anonymous = false
    @State private var paymentMethod: PaymentMethod = .crypto
    @State private var cryptoType: CryptoType = .bitcoin
    @State private var showCryptoPayment = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    public init(campaign: Campaign, service: FundraisingService, onComplete: @escaping () -> Void) {
        self.campaign = campaign
        self.service = service
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Campaign info header
                    VStack(alignment: .leading, spacing: 8) {
                        Text(campaign.title)
                            .font(.headline)

                        CampaignProgressBar(progress: campaign.progressPercentage)

                        HStack {
                            Text(formatCurrency(campaign.raised))
                                .fontWeight(.semibold)
                                .foregroundColor(.accentColor)

                            Text("fundraising_of".localized(formatCurrency(campaign.goal)))
                                .foregroundColor(.secondary)
                        }
                        .font(.subheadline)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Amount selection
                    VStack(alignment: .leading, spacing: 12) {
                        Text("fundraising_chooseAmount".localized)
                            .font(.headline)

                        // Tier buttons
                        if !campaign.tiers.isEmpty && !customAmount {
                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 12) {
                                ForEach(campaign.tiers) { tier in
                                    TierSelectionButton(
                                        tier: tier,
                                        currency: campaign.currency,
                                        isSelected: selectedTier?.id == tier.id
                                    ) {
                                        selectedTier = tier
                                        amount = String(Int(tier.amount))
                                    }
                                }
                            }
                        }

                        // Quick amounts (if no tiers)
                        if campaign.tiers.isEmpty && !customAmount {
                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 12) {
                                ForEach([10, 25, 50, 100, 250, 500], id: \.self) { quickAmount in
                                    QuickAmountButton(
                                        amount: quickAmount,
                                        currency: campaign.currency,
                                        isSelected: amount == String(quickAmount)
                                    ) {
                                        amount = String(quickAmount)
                                        selectedTier = nil
                                    }
                                }
                            }
                        }

                        // Custom amount toggle
                        Toggle("fundraising_enterCustomAmount".localized, isOn: $customAmount)
                            .onChange(of: customAmount) { _, newValue in
                                if newValue {
                                    selectedTier = nil
                                    amount = ""
                                }
                            }

                        if customAmount {
                            HStack {
                                Text(currencySymbol)
                                    .font(.title)
                                    .foregroundColor(.secondary)

                                TextField("0", text: $amount)
                                    .keyboardType(.decimalPad)
                                    .font(.system(size: 36, weight: .bold))
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                        } else if let tier = selectedTier {
                            // Selected tier details
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    if let name = tier.name {
                                        Text(name)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                    }
                                    Spacer()
                                    Text(formatCurrency(tier.amount))
                                        .font(.title2)
                                        .fontWeight(.bold)
                                        .foregroundColor(.accentColor)
                                }

                                if let description = tier.description {
                                    Text(description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                if !tier.perks.isEmpty {
                                    VStack(alignment: .leading, spacing: 4) {
                                        ForEach(tier.perks, id: \.self) { perk in
                                            Label(perk, systemImage: "checkmark.circle.fill")
                                                .font(.caption)
                                                .foregroundColor(.green)
                                        }
                                    }
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Donor info
                    VStack(alignment: .leading, spacing: 12) {
                        Text("fundraising_yourInformation".localized)
                            .font(.headline)

                        TextField("fundraising_yourNameOptional".localized, text: $donorName)
                            .textContentType(.name)
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(8)

                        TextField("fundraising_leaveMessageOptional".localized, text: $message, axis: .vertical)
                            .lineLimit(3...5)
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(8)

                        Toggle("fundraising_donateAnonymously".localized, isOn: $anonymous)
                            .onChange(of: anonymous) { _, newValue in
                                if newValue {
                                    donorName = ""
                                }
                            }

                        if anonymous {
                            Text("fundraising_anonymousOrganizerNote".localized)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Payment method
                    VStack(alignment: .leading, spacing: 12) {
                        Text("fundraising_paymentMethod".localized)
                            .font(.headline)

                        ForEach(PaymentMethod.allCases, id: \.self) { method in
                            PaymentMethodRow(
                                method: method,
                                isSelected: paymentMethod == method
                            ) {
                                paymentMethod = method
                            }
                        }

                        if paymentMethod == .crypto {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("fundraising_selectCryptocurrency".localized)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)

                                HStack(spacing: 12) {
                                    ForEach(CryptoType.allCases, id: \.self) { crypto in
                                        CryptoTypeButton(
                                            crypto: crypto,
                                            isSelected: cryptoType == crypto,
                                            isEnabled: isCryptoEnabled(crypto)
                                        ) {
                                            cryptoType = crypto
                                        }
                                    }
                                }
                            }
                            .padding(.top, 8)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Error message
                    if let error = errorMessage {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }

                    // Donate button
                    Button {
                        if paymentMethod == .crypto {
                            showCryptoPayment = true
                        } else {
                            Task { await submitDonation() }
                        }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            HStack {
                                Image(systemName: "heart.fill")
                                Text("fundraising_donate".localized + " " + formatCurrency(donationAmount))
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!isValid || isSubmitting)
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("fundraising_donate".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
            }
            .sheet(isPresented: $showCryptoPayment) {
                CryptoPaymentSheet(
                    campaign: campaign,
                    amount: donationAmount,
                    cryptoType: cryptoType,
                    service: service
                ) {
                    showCryptoPayment = false
                    Task { await submitDonation() }
                }
            }
        }
    }

    private var isValid: Bool {
        donationAmount > 0
    }

    private var donationAmount: Double {
        Double(amount) ?? 0
    }

    private var currencySymbol: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = campaign.currency
        return formatter.currencySymbol
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = campaign.currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(campaign.currency) \(amount)"
    }

    private func isCryptoEnabled(_ crypto: CryptoType) -> Bool {
        guard let payment = campaign.cryptoPayment else { return false }
        switch crypto {
        case .bitcoin: return payment.bitcoinAddress != nil
        case .ethereum: return payment.ethereumAddress != nil
        case .lightning: return payment.lightningInvoice != nil || payment.lightningAddress != nil
        }
    }

    private func submitDonation() async {
        guard isValid else { return }

        isSubmitting = true
        errorMessage = nil

        do {
            _ = try await service.recordDonation(
                campaignId: campaign.id,
                amount: donationAmount,
                currency: campaign.currency,
                donorName: donorName.isEmpty ? nil : donorName,
                anonymous: anonymous,
                message: message.isEmpty ? nil : message,
                tierId: selectedTier?.id,
                paymentMethod: paymentMethod,
                cryptoType: paymentMethod == .crypto ? cryptoType : nil
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// Tier selection button
struct TierSelectionButton: View {
    let tier: DonationTier
    let currency: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                if let name = tier.name {
                    Text(name)
                        .font(.caption)
                        .foregroundColor(isSelected ? .white : .secondary)
                }

                Text(formatCurrency(tier.amount))
                    .font(.headline)
                    .foregroundColor(isSelected ? .white : .primary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? Color.accentColor : Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Quick amount button
struct QuickAmountButton: View {
    let amount: Int
    let currency: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(formatCurrency(Double(amount)))
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(isSelected ? .white : .primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(isSelected ? Color.accentColor : Color(.systemGray6))
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Payment method row
struct PaymentMethodRow: View {
    let method: PaymentMethod
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: method.icon)
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                    .frame(width: 24)

                Text(method.displayName)
                    .foregroundColor(.primary)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.accentColor)
                }
            }
            .padding()
            .background(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemGray6))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

/// Crypto type button
struct CryptoTypeButton: View {
    let crypto: CryptoType
    let isSelected: Bool
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: crypto.icon)
                    .font(.title2)

                Text(crypto.symbol)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(isSelected ? .white : (isEnabled ? .primary : .secondary))
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? Color.orange : Color(.systemGray6))
            .cornerRadius(12)
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

/// Crypto payment sheet
struct CryptoPaymentSheet: View {
    @Environment(\.dismiss) private var dismiss

    let campaign: Campaign
    let amount: Double
    let cryptoType: CryptoType
    let service: FundraisingService
    let onPaymentConfirmed: () -> Void

    @State private var paymentAddress: String = ""
    @State private var lightningInvoice: String = ""
    @State private var isLoading = true
    @State private var copied = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Amount display
                VStack(spacing: 4) {
                    Text("fundraising_send".localized)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text(formatCryptoAmount())
                        .font(.system(size: 36, weight: .bold))

                    Text("fundraising_toCompleteDonation".localized)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                if isLoading {
                    ProgressView()
                        .padding()
                } else {
                    // QR Code placeholder
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemGray6))
                        .frame(width: 200, height: 200)
                        .overlay(
                            VStack {
                                Image(systemName: "qrcode")
                                    .font(.system(size: 80))
                                    .foregroundColor(.secondary)

                                Text("fundraising_qrCode".localized)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        )

                    // Address display
                    VStack(spacing: 8) {
                        Text(cryptoType == .lightning ? "fundraising_lightningInvoice".localized : "fundraising_address".localized)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(displayAddress)
                            .font(.system(.caption, design: .monospaced))
                            .multilineTextAlignment(.center)
                            .lineLimit(3)
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(8)

                        Button {
                            SecureClipboard.copy(cryptoType == .lightning ? lightningInvoice : paymentAddress)
                            copied = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                copied = false
                            }
                        } label: {
                            Label(copied ? "fundraising_copied".localized : "fundraising_copyAddressButton".localized, systemImage: copied ? "checkmark" : "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                    }
                }

                Spacer()

                // Confirmation button
                Button {
                    onPaymentConfirmed()
                } label: {
                    Text("fundraising_sentPayment".localized)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Text("fundraising_paymentConfirmNote".localized)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
            .navigationTitle("fundraising_payWith".localized(cryptoType.displayName))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
            }
            .task {
                await loadPaymentInfo()
            }
        }
    }

    private var displayAddress: String {
        let address = cryptoType == .lightning ? lightningInvoice : paymentAddress
        if address.count > 50 {
            return String(address.prefix(25)) + "..." + String(address.suffix(15))
        }
        return address
    }

    private func formatCryptoAmount() -> String {
        // Placeholder conversion - in production would use real exchange rates
        switch cryptoType {
        case .bitcoin:
            let btcAmount = amount / 50000 // Placeholder rate
            return String(format: "%.6f BTC", btcAmount)
        case .ethereum:
            let ethAmount = amount / 3000 // Placeholder rate
            return String(format: "%.4f ETH", ethAmount)
        case .lightning:
            let sats = Int(amount * 2000) // Placeholder rate
            return "\(sats) sats"
        }
    }

    private func loadPaymentInfo() async {
        isLoading = true

        if let crypto = campaign.cryptoPayment {
            switch cryptoType {
            case .bitcoin:
                paymentAddress = crypto.bitcoinAddress ?? ""
            case .ethereum:
                paymentAddress = crypto.ethereumAddress ?? ""
            case .lightning:
                if let invoice = crypto.lightningInvoice {
                    lightningInvoice = invoice
                } else if let address = crypto.lightningAddress {
                    // Generate invoice from Lightning address
                    do {
                        let sats = Int(amount * 2000) // Placeholder conversion
                        lightningInvoice = try await service.generateLightningInvoice(
                            for: campaign.id,
                            amountSats: sats,
                            memo: "Donation to \(campaign.title)"
                        )
                    } catch {
                        lightningInvoice = address
                    }
                }
            }
        }

        isLoading = false
    }
}
