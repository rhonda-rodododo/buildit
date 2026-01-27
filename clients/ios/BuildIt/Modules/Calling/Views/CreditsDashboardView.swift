// CreditsDashboardView.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI view for displaying PSTN credit balance and usage statistics.

import SwiftUI

// MARK: - Credits Dashboard View

/// Main dashboard view for PSTN credits
public struct CreditsDashboardView: View {
    @ObservedObject var creditsManager: PSTNCreditsManager
    let groupId: String

    @State private var balance: LocalCreditBalance?
    @State private var summary: UsageSummary?
    @State private var recentUsage: [PSTNUsageRecord] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showLowCreditsAlert = false

    public init(creditsManager: PSTNCreditsManager, groupId: String) {
        self.creditsManager = creditsManager
        self.groupId = groupId
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Balance Card
                balanceCard

                // Stats Grid
                if let summary = summary {
                    statsGrid(summary)
                }

                // Recent Usage
                recentUsageSection

                // Error Message
                if let error = errorMessage {
                    errorView(error)
                }
            }
            .padding()
        }
        .navigationTitle("PSTN Credits")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                refreshButton
            }
        }
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
        .alert("Low Credits Warning", isPresented: $showLowCreditsAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            if let balance = balance {
                Text("You have used \(PSTNCreditsManager.formatPercentage(balance.percentUsed)) of your monthly allocation. Only \(PSTNCreditsManager.formatCredits(balance.remaining)) remaining.")
            }
        }
    }

    // MARK: - Balance Card

    private var balanceCard: some View {
        VStack(spacing: 16) {
            if isLoading && balance == nil {
                ProgressView()
                    .frame(height: 200)
            } else if let balance = balance {
                // Progress Ring
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.2), lineWidth: 16)
                        .frame(width: 160, height: 160)

                    Circle()
                        .trim(from: 0, to: min(balance.percentUsed / 100, 1.0))
                        .stroke(
                            balance.statusColor,
                            style: StrokeStyle(lineWidth: 16, lineCap: .round)
                        )
                        .frame(width: 160, height: 160)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.5), value: balance.percentUsed)

                    VStack(spacing: 4) {
                        Text(PSTNCreditsManager.formatCredits(balance.remaining))
                            .font(.system(size: 32, weight: .bold, design: .rounded))

                        Text("remaining")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.top, 8)

                // Balance Details
                HStack(spacing: 24) {
                    VStack(spacing: 4) {
                        Text(PSTNCreditsManager.formatCredits(balance.used))
                            .font(.headline)
                        Text("Used")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Divider()
                        .frame(height: 40)

                    VStack(spacing: 4) {
                        Text(PSTNCreditsManager.formatCredits(balance.monthlyAllocation))
                            .font(.headline)
                        Text("Allocation")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Divider()
                        .frame(height: 40)

                    VStack(spacing: 4) {
                        Text("\(PSTNCreditsManager.getDaysUntilReset(balance.resetDate))")
                            .font(.headline)
                        Text("Days left")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Low credits warning indicator
                if balance.isLow {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.yellow)

                        Text(balance.percentUsed >= CreditThreshold.critical * 100 ? "Credits critical" : "Credits running low")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.yellow.opacity(0.1))
                    .cornerRadius(8)
                }
            } else {
                // No data state
                VStack(spacing: 8) {
                    Image(systemName: "creditcard")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("No credit data available")
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
                .frame(height: 200)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    // MARK: - Stats Grid

    private func statsGrid(_ summary: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("This Month")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                StatCard(
                    icon: "phone.fill",
                    value: "\(summary.totalCalls)",
                    label: "Total Calls",
                    color: .blue
                )

                StatCard(
                    icon: "clock.fill",
                    value: "\(summary.totalMinutes)",
                    label: "Total Minutes",
                    color: .purple
                )

                StatCard(
                    icon: "phone.arrow.down.left.fill",
                    value: "\(summary.inboundCalls)",
                    label: "Inbound",
                    color: .green
                )

                StatCard(
                    icon: "phone.arrow.up.right.fill",
                    value: "\(summary.outboundCalls)",
                    label: "Outbound",
                    color: .orange
                )
            }
        }
    }

    // MARK: - Recent Usage Section

    private var recentUsageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Usage")
                .font(.headline)

            if recentUsage.isEmpty && !isLoading {
                VStack(spacing: 8) {
                    Image(systemName: "list.bullet")
                        .font(.title)
                        .foregroundColor(.gray)

                    Text("No recent calls")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                ForEach(recentUsage.prefix(10)) { record in
                    UsageRecordRow(record: record)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    // MARK: - Refresh Button

    private var refreshButton: some View {
        Button {
            Task {
                await loadData()
            }
        } label: {
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
            } else {
                Image(systemName: "arrow.clockwise")
            }
        }
        .disabled(isLoading)
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.red)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .cornerRadius(8)
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            // Fetch balance
            balance = try await creditsManager.getBalance(groupId)

            // Check for low credits alert
            if let balance = balance, balance.isLow {
                showLowCreditsAlert = true
            }

            // Fetch summary
            summary = try await creditsManager.getUsageSummary(groupId)

            // Fetch recent usage
            recentUsage = try await creditsManager.getUsageHistory(groupId, days: 30)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)

                Spacer()
            }

            HStack {
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)

                Spacer()
            }

            HStack {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

// MARK: - Usage Record Row

private struct UsageRecordRow: View {
    let record: PSTNUsageRecord

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: record.date)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Direction Icon
            ZStack {
                Circle()
                    .fill(record.direction == .inbound ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: record.direction == .inbound ? "phone.arrow.down.left.fill" : "phone.arrow.up.right.fill")
                    .foregroundColor(record.direction == .inbound ? .green : .orange)
            }

            // Details
            VStack(alignment: .leading, spacing: 4) {
                Text(record.direction == .inbound ? "Inbound Call" : "Outbound Call")
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack(spacing: 8) {
                    Text(formattedDate)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(record.formattedDuration)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Cost
            VStack(alignment: .trailing, spacing: 4) {
                Text("-\(String(format: "%.1f", record.creditsCost))m")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.red)

                if let phone = record.targetPhone {
                    Text(phone)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CreditsDashboardView(
            creditsManager: PSTNCreditsManager(workerUrl: "https://example.com"),
            groupId: "test-group"
        )
    }
}
