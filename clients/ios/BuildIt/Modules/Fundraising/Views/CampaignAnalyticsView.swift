// CampaignAnalyticsView.swift
// BuildIt - Decentralized Mesh Communication
//
// Analytics and progress tracking for fundraising campaigns.

import SwiftUI

/// Campaign analytics view
public struct CampaignAnalyticsView: View {
    @Environment(\.dismiss) private var dismiss

    let campaign: Campaign
    let service: FundraisingService

    @State private var analytics: CampaignAnalytics?
    @State private var donations: [Donation] = []
    @State private var expenses: [Expense] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedTab = 0

    public init(campaign: Campaign, service: FundraisingService) {
        self.campaign = campaign
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker
                Picker("View", selection: $selectedTab) {
                    Text("Overview").tag(0)
                    Text("Donations").tag(1)
                    Text("Expenses").tag(2)
                }
                .pickerStyle(.segmented)
                .padding()

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    TabView(selection: $selectedTab) {
                        OverviewTab(campaign: campaign, analytics: analytics)
                            .tag(0)

                        DonationsTab(donations: donations, currency: campaign.currency)
                            .tag(1)

                        ExpensesTab(expenses: expenses, currency: campaign.currency)
                            .tag(2)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                }

                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding()
                }
            }
            .navigationTitle("Analytics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await loadData() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task {
                await loadData()
            }
        }
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            async let analyticsTask = service.calculateAnalytics(for: campaign.id)
            async let donationsTask = service.getDonations(campaignId: campaign.id)
            async let expensesTask = service.getExpenses(campaignId: campaign.id)

            analytics = try await analyticsTask
            donations = try await donationsTask
            expenses = try await expensesTask
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

/// Overview tab with key metrics
struct OverviewTab: View {
    let campaign: Campaign
    let analytics: CampaignAnalytics?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Progress card
                ProgressCard(campaign: campaign)

                // Key metrics
                if let analytics = analytics {
                    MetricsGrid(analytics: analytics, currency: campaign.currency)
                }

                // Progress over time chart placeholder
                ChartPlaceholder(
                    title: "Donations Over Time",
                    icon: "chart.line.uptrend.xyaxis"
                )

                // Payment method breakdown
                if let analytics = analytics, !analytics.paymentMethodBreakdown.isEmpty {
                    PaymentMethodBreakdown(
                        breakdown: analytics.paymentMethodBreakdown,
                        currency: campaign.currency
                    )
                }

                // Top donors
                if let analytics = analytics, !analytics.topDonors.isEmpty {
                    TopDonorsCard(donors: analytics.topDonors, currency: campaign.currency)
                }
            }
            .padding()
        }
    }
}

/// Progress card with visual indicator
struct ProgressCard: View {
    let campaign: Campaign

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Campaign Progress")
                    .font(.headline)
                Spacer()
                CampaignStatusBadge(status: campaign.status)
            }

            // Large progress visualization
            ZStack {
                // Background track
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(height: 40)

                // Progress fill
                GeometryReader { geometry in
                    HStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(progressGradient)
                            .frame(width: geometry.size.width * campaign.progressPercentage)
                        Spacer(minLength: 0)
                    }
                }
                .frame(height: 40)

                // Percentage label
                Text("\(Int(campaign.progressPercentage * 100))%")
                    .font(.headline)
                    .foregroundColor(.white)
            }

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Raised")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(formatCurrency(campaign.raised))
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.accentColor)
                }

                Spacer()

                VStack(alignment: .center, spacing: 2) {
                    Text("Donors")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(campaign.donorCount)")
                        .font(.title3)
                        .fontWeight(.bold)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Goal")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(formatCurrency(campaign.goal))
                        .font(.title3)
                        .fontWeight(.bold)
                }
            }

            if campaign.amountRemaining > 0 {
                Text("\(formatCurrency(campaign.amountRemaining)) to go")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                Label("Goal reached!", systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundColor(.green)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private var progressGradient: LinearGradient {
        LinearGradient(
            colors: campaign.progressPercentage >= 1.0
                ? [.green, .green.opacity(0.8)]
                : [.accentColor, .accentColor.opacity(0.8)],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = campaign.currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(campaign.currency) \(amount)"
    }
}

/// Key metrics grid
struct MetricsGrid: View {
    let analytics: CampaignAnalytics
    let currency: String

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            MetricCard(
                title: "Total Raised",
                value: formatCurrency(analytics.totalRaised),
                icon: "dollarsign.circle",
                color: .green
            )

            MetricCard(
                title: "Total Donors",
                value: "\(analytics.totalDonors)",
                icon: "person.2",
                color: .blue
            )

            MetricCard(
                title: "Average Donation",
                value: formatCurrency(analytics.averageDonation),
                icon: "chart.bar",
                color: .orange
            )

            MetricCard(
                title: "Largest Donation",
                value: formatCurrency(analytics.largestDonation),
                icon: "star.fill",
                color: .yellow
            )
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.title3)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

/// Chart placeholder
struct ChartPlaceholder: View {
    let title: String
    let icon: String

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline)
                Spacer()
            }

            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray6))
                    .frame(height: 150)

                VStack {
                    Image(systemName: icon)
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)

                    Text("Chart coming soon")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

/// Payment method breakdown
struct PaymentMethodBreakdown: View {
    let breakdown: [PaymentMethod: Double]
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Payment Methods")
                .font(.headline)

            ForEach(breakdown.sorted(by: { $0.value > $1.value }), id: \.key) { method, amount in
                HStack {
                    Image(systemName: method.icon)
                        .foregroundColor(.accentColor)
                        .frame(width: 24)

                    Text(method.displayName)

                    Spacer()

                    Text(formatCurrency(amount))
                        .fontWeight(.medium)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Top donors card
struct TopDonorsCard: View {
    let donors: [(name: String, amount: Double)]
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top Donors")
                .font(.headline)

            ForEach(donors.prefix(5).indices, id: \.self) { index in
                let donor = donors[index]
                HStack {
                    // Rank badge
                    Text("\(index + 1)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 24, height: 24)
                        .background(rankColor(index))
                        .clipShape(Circle())

                    Text(donor.name)
                        .lineLimit(1)

                    Spacer()

                    Text(formatCurrency(donor.amount))
                        .fontWeight(.medium)
                        .foregroundColor(.accentColor)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func rankColor(_ index: Int) -> Color {
        switch index {
        case 0: return .yellow
        case 1: return .gray
        case 2: return .orange
        default: return .accentColor
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

/// Donations list tab
struct DonationsTab: View {
    let donations: [Donation]
    let currency: String

    var body: some View {
        if donations.isEmpty {
            FundraisingEmptyStateView(
                icon: "heart",
                title: "No donations yet",
                message: "Donations will appear here"
            )
        } else {
            List {
                ForEach(donations) { donation in
                    DonationListRow(donation: donation, currency: currency)
                }
            }
            .listStyle(.plain)
        }
    }
}

struct DonationListRow: View {
    let donation: Donation
    let currency: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(donation.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if donation.anonymous {
                        Image(systemName: "eye.slash")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if let message = donation.message {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                HStack {
                    Image(systemName: donation.paymentMethod.icon)
                        .font(.caption2)

                    Text(donation.donatedAt, style: .relative)
                        .font(.caption)
                }
                .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(donation.amount))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.accentColor)

                DonationStatusBadge(status: donation.status)
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

struct DonationStatusBadge: View {
    let status: DonationStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch status {
        case .pending: return .yellow
        case .completed: return .green
        case .failed: return .red
        case .refunded: return .gray
        }
    }
}

/// Expenses list tab
struct ExpensesTab: View {
    let expenses: [Expense]
    let currency: String

    var body: some View {
        if expenses.isEmpty {
            FundraisingEmptyStateView(
                icon: "receipt",
                title: "No expenses recorded",
                message: "Expenses will appear here"
            )
        } else {
            List {
                // Total summary
                Section {
                    HStack {
                        Text("Total Expenses")
                            .fontWeight(.medium)
                        Spacer()
                        Text(formatCurrency(expenses.reduce(0) { $0 + $1.amount }))
                            .fontWeight(.bold)
                            .foregroundColor(.red)
                    }
                }

                // Expense list
                Section("Transactions") {
                    ForEach(expenses) { expense in
                        ExpenseListRow(expense: expense, currency: currency)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }
}

struct ExpenseListRow: View {
    let expense: Expense
    let currency: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.description)
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack {
                    if let category = expense.category {
                        Text(category)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let vendor = expense.vendor {
                        Text("- \(vendor)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Text(expense.date, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text("-\(formatCurrency(expense.amount))")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.red)
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
