// CampaignDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view of a fundraising campaign with donation options.

import SwiftUI

// Import localization
private typealias Strings = L10n.Fundraising

/// Detailed view of a campaign
public struct CampaignDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let campaign: Campaign
    let service: FundraisingService

    @State private var donations: [Donation] = []
    @State private var isLoading = true
    @State private var showDonateSheet = false
    @State private var showShareSheet = false
    @State private var showAnalyticsSheet = false
    @State private var errorMessage: String?

    public init(campaign: Campaign, service: FundraisingService) {
        self.campaign = campaign
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Hero section with progress
                    CampaignHeroSection(campaign: campaign)

                    // Quick stats
                    CampaignStatsSection(campaign: campaign)

                    // Description
                    if let description = campaign.description {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("fundraising_about".localized)
                                .font(.headline)

                            Text(description)
                                .font(.body)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                    }

                    // Donation tiers
                    if !campaign.tiers.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("fundraising_donationTiers".localized)
                                .font(.headline)

                            ForEach(campaign.tiers) { tier in
                                DonationTierRow(
                                    tier: tier,
                                    currency: campaign.currency
                                ) {
                                    showDonateSheet = true
                                }
                            }
                        }
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                    }

                    // Crypto payment info
                    if let crypto = campaign.cryptoPayment, crypto.hasAnyAddress {
                        CryptoPaymentSection(cryptoPayment: crypto)
                    }

                    // Recent donations
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("fundraising_recentDonations".localized)
                                .font(.headline)

                            Spacer()

                            Text("\(donations.count)")
                                .foregroundColor(.secondary)
                        }

                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if donations.isEmpty {
                            Text("fundraising_beFirstToDonate".localized)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else {
                            ForEach(donations.prefix(5)) { donation in
                                DonationRow(donation: donation, currency: campaign.currency)
                            }

                            if donations.count > 5 {
                                Button("fundraising_viewAllDonations".localized(donations.count)) {
                                    // Navigate to full donations list
                                }
                                .font(.subheadline)
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Updates
                    if !campaign.updates.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("fundraising_updates".localized)
                                .font(.headline)

                            ForEach(campaign.updates) { update in
                                CampaignUpdateRow(update: update)
                            }
                        }
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                    }

                    // Action buttons
                    if campaign.isAcceptingDonations {
                        Button {
                            showDonateSheet = true
                        } label: {
                            Label("fundraising_donateNow".localized, systemImage: "heart.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                    }

                    // Error
                    if let error = errorMessage {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("fundraising_campaign".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.done) { dismiss() }
                }

                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        showShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }

                    Button {
                        showAnalyticsSheet = true
                    } label: {
                        Image(systemName: "chart.bar")
                    }
                }
            }
            .sheet(isPresented: $showDonateSheet) {
                DonateView(campaign: campaign, service: service) {
                    showDonateSheet = false
                    Task { await loadDonations() }
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ShareCampaignSheet(campaign: campaign)
            }
            .sheet(isPresented: $showAnalyticsSheet) {
                CampaignAnalyticsView(campaign: campaign, service: service)
            }
            .task {
                await loadDonations()
            }
        }
    }

    private func loadDonations() async {
        isLoading = true
        do {
            donations = try await service.getDonations(campaignId: campaign.id, limit: 50)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

/// Campaign hero section with large progress display
struct CampaignHeroSection: View {
    let campaign: Campaign

    var body: some View {
        VStack(spacing: 16) {
            // Title and status
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(campaign.title)
                        .font(.title2)
                        .fontWeight(.bold)

                    if let creatorName = campaign.creatorName {
                        Text("fundraising_by".localized(creatorName))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                CampaignStatusBadge(status: campaign.status)
            }

            // Large progress indicator
            GoalMeter(
                raised: campaign.raised,
                goal: campaign.goal,
                currency: campaign.currency
            )

            // Time remaining
            if let days = campaign.daysRemaining, days > 0 {
                HStack {
                    Image(systemName: "clock")
                    Text("fundraising_daysRemaining".localized(days))
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            } else if campaign.hasEnded {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("fundraising_campaignEnded".localized)
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

/// Large goal meter visualization
struct GoalMeter: View {
    let raised: Double
    let goal: Double
    let currency: String

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(raised / goal, 1.0)
    }

    var body: some View {
        VStack(spacing: 12) {
            // Circular progress
            ZStack {
                Circle()
                    .stroke(Color(.systemGray5), lineWidth: 12)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        progressColor,
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)

                VStack(spacing: 4) {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 32, weight: .bold))

                    Text("fundraising_funded".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(width: 120, height: 120)

            // Amount raised
            VStack(spacing: 4) {
                Text(formatCurrency(raised))
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.accentColor)

                Text("fundraising_raisedOfGoal".localized(formatCurrency(goal)))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var progressColor: Color {
        if progress >= 1.0 {
            return .green
        } else if progress >= 0.75 {
            return .blue
        } else {
            return .accentColor
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Campaign stats section
struct CampaignStatsSection: View {
    let campaign: Campaign

    var body: some View {
        HStack(spacing: 0) {
            StatBox(
                value: "\(campaign.donorCount)",
                label: "fundraising_donors".localized,
                icon: "person.2"
            )

            Divider()

            StatBox(
                value: formatAmount(campaign.raised / max(Double(campaign.donorCount), 1)),
                label: "fundraising_avgDonation".localized,
                icon: "chart.bar"
            )

            Divider()

            StatBox(
                value: campaign.daysRemaining.map { "\($0)" } ?? "--",
                label: "fundraising_daysLeftLabel".localized,
                icon: "clock"
            )
        }
        .frame(height: 80)
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func formatAmount(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = campaign.currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(Int(amount))"
    }
}

struct StatBox: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.headline)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Donation tier row
struct DonationTierRow: View {
    let tier: DonationTier
    let currency: String
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    if let name = tier.name {
                        Text(name)
                            .font(.headline)
                    }

                    Text(formatCurrency(tier.amount))
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.accentColor)

                    if let description = tier.description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if !tier.perks.isEmpty {
                        ForEach(tier.perks, id: \.self) { perk in
                            Label(perk, systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Crypto payment section
struct CryptoPaymentSection: View {
    let cryptoPayment: CryptoPaymentInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("fundraising_payWithCrypto".localized, systemImage: "bitcoinsign.circle")
                .font(.headline)

            if let btc = cryptoPayment.bitcoinAddress {
                CryptoAddressRow(
                    type: .bitcoin,
                    address: btc
                )
            }

            if let eth = cryptoPayment.ethereumAddress {
                CryptoAddressRow(
                    type: .ethereum,
                    address: eth
                )
            }

            if let ln = cryptoPayment.lightningAddress ?? cryptoPayment.lightningInvoice {
                CryptoAddressRow(
                    type: .lightning,
                    address: ln
                )
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

struct CryptoAddressRow: View {
    let type: CryptoType
    let address: String

    @State private var copied = false

    var body: some View {
        HStack {
            Image(systemName: type.icon)
                .foregroundColor(.orange)

            Text(type.displayName)
                .font(.subheadline)

            Spacer()

            Text(truncatedAddress)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)

            Button {
                UIPasteboard.general.string = address
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    copied = false
                }
            } label: {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    .foregroundColor(copied ? .green : .accentColor)
            }
        }
        .padding(.vertical, 8)
    }

    private var truncatedAddress: String {
        if address.count > 20 {
            return String(address.prefix(10)) + "..." + String(address.suffix(6))
        }
        return address
    }
}

/// Donation row
struct DonationRow: View {
    let donation: Donation
    let currency: String

    var body: some View {
        HStack {
            // Avatar placeholder
            Circle()
                .fill(Color(.systemGray4))
                .frame(width: 40, height: 40)
                .overlay(
                    Text(donation.displayName.prefix(1).uppercased())
                        .font(.headline)
                        .foregroundColor(.white)
                )

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(donation.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(formatCurrency(donation.amount))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.accentColor)
                }

                if let message = donation.message {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                Text(donation.donatedAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Campaign update row
struct CampaignUpdateRow: View {
    let update: CampaignUpdate

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(update.postedAt, style: .date)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(update.content)
                .font(.body)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

/// Share campaign sheet
struct ShareCampaignSheet: View {
    @Environment(\.dismiss) private var dismiss

    let campaign: Campaign

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // Preview card
                VStack(spacing: 12) {
                    Text(campaign.title)
                        .font(.headline)

                    CampaignProgressBar(progress: campaign.progressPercentage)

                    Text("\(Int(campaign.progressPercentage * 100))% funded")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)

                // Share options
                VStack(spacing: 12) {
                    ShareOptionButton(
                        icon: "link",
                        title: "fundraising_copyLink".localized,
                        color: .accentColor
                    ) {
                        // Copy campaign link
                        UIPasteboard.general.string = "https://buildit.network/campaign/\(campaign.id)"
                    }

                    ShareOptionButton(
                        icon: "message",
                        title: "fundraising_shareViaMessage".localized,
                        color: .green
                    ) {
                        // Open share sheet
                    }

                    ShareOptionButton(
                        icon: "qrcode",
                        title: "fundraising_showQrCode".localized,
                        color: .purple
                    ) {
                        // Show QR code
                    }
                }

                Spacer()
            }
            .padding()
            .navigationTitle("fundraising_shareCampaign".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.done) { dismiss() }
                }
            }
        }
    }
}

struct ShareOptionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .frame(width: 40)

                Text(title)
                    .font(.body)

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}
