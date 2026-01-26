// RequestDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view of a mutual aid request with fulfillment options.

import SwiftUI

// Import localization
private typealias Strings = L10n.MutualAid

/// Detailed view of an aid request
public struct RequestDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let request: AidRequest
    let service: MutualAidService

    @State private var fulfillments: [Fulfillment] = []
    @State private var isLoading = true
    @State private var showOfferSheet = false
    @State private var errorMessage: String?

    public init(request: AidRequest, service: MutualAidService) {
        self.request = request
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label(request.category.displayName, systemImage: request.category.icon)
                                .font(.subheadline)
                                .foregroundColor(.accentColor)

                            Spacer()

                            UrgencyBadge(urgency: request.urgency)
                        }

                        Text(request.title)
                            .font(.title2)
                            .fontWeight(.bold)

                        if !request.anonymousRequest, let name = request.requesterName {
                            Text("mutualaid_postedBy".localized(name))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        } else if request.anonymousRequest {
                            Text("mutualaid_postedAnonymously".localized)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        Text(request.createdAt, style: .relative) + Text(" ago")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Description
                    if let description = request.description {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("mutualaid_description".localized)
                                .font(.headline)

                            Text(description)
                                .font(.body)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                    }

                    // Details
                    VStack(alignment: .leading, spacing: 12) {
                        Text("mutualaid_details".localized)
                            .font(.headline)

                        if let location = request.location {
                            DetailRow(icon: "location", label: "mutualaid_location".localized, value: location.displayString)
                        }

                        if let neededBy = request.neededBy {
                            DetailRow(icon: "clock", label: "mutualaid_neededBy".localized, value: neededBy.formatted(date: .abbreviated, time: .shortened))
                        }

                        if let qty = request.quantityNeeded {
                            let unit = request.unit ?? "units"
                            DetailRow(icon: "number", label: "mutualaid_needed".localized, value: "\(Int(qty)) \(unit)")

                            if request.quantityFulfilled > 0 {
                                DetailRow(icon: "checkmark.circle", label: "mutualaid_fulfilled".localized, value: "\(Int(request.quantityFulfilled)) \(unit)")

                                ProgressView(value: request.progressPercentage)
                                    .tint(.green)
                            }
                        }

                        DetailRow(icon: "tag", label: "mutualaid_status".localized, value: request.status.displayName)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Fulfillments
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("mutualaid_requests".localized)
                                .font(.headline)

                            Spacer()

                            Text("\(fulfillments.count)")
                                .foregroundColor(.secondary)
                        }

                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if fulfillments.isEmpty {
                            Text("mutualaid_noOneOfferedYet".localized)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else {
                            ForEach(fulfillments) { fulfillment in
                                FulfillmentRow(fulfillment: fulfillment)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Action Button
                    if request.isActive {
                        Button {
                            showOfferSheet = true
                        } label: {
                            Label("mutualaid_offerToHelp".localized, systemImage: "hand.raised")
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
            .navigationTitle("mutualaid_request".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.done) { dismiss() }
                }
            }
            .sheet(isPresented: $showOfferSheet) {
                OfferFulfillmentSheet(
                    request: request,
                    service: service
                ) {
                    showOfferSheet = false
                    Task { await loadFulfillments() }
                }
            }
            .task {
                await loadFulfillments()
            }
        }
    }

    private func loadFulfillments() async {
        isLoading = true
        do {
            fulfillments = try await service.getFulfillments(requestId: request.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

/// Detail row component
struct DetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.secondary)
                .frame(width: 24)

            Text(label)
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
        }
    }
}

/// Fulfillment row
struct FulfillmentRow: View {
    let fulfillment: Fulfillment

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(fulfillment.fulfillerName ?? "Someone")
                    .font(.subheadline)
                    .fontWeight(.medium)

                if let message = fulfillment.message {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let qty = fulfillment.quantity {
                    Text("Offering: \(Int(qty))")
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }

            Spacer()

            FulfillmentStatusBadge(status: fulfillment.status)
        }
        .padding(.vertical, 8)
    }
}

/// Fulfillment status badge
struct FulfillmentStatusBadge: View {
    let status: Fulfillment.FulfillmentStatus

    var body: some View {
        Text(statusText)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }

    private var statusText: String {
        switch status {
        case .offered: return "mutualaid_offered".localized
        case .accepted: return "mutualaid_accepted".localized
        case .inProgress: return "mutualaid_inProgress".localized
        case .completed: return L10n.Common.completed
        case .cancelled: return "mutualaid_cancelled".localized
        case .declined: return "mutualaid_declined".localized
        }
    }

    private var statusColor: Color {
        switch status {
        case .offered: return .blue
        case .accepted: return .green
        case .inProgress: return .orange
        case .completed: return .green
        case .cancelled: return .gray
        case .declined: return .red
        }
    }
}

/// Sheet for offering fulfillment
struct OfferFulfillmentSheet: View {
    @Environment(\.dismiss) private var dismiss

    let request: AidRequest
    let service: MutualAidService
    let onComplete: () -> Void

    @State private var message = ""
    @State private var quantity = ""
    @State private var scheduledDate: Date = Date()
    @State private var hasSchedule = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("mutualaid_yourOffer".localized) {
                    TextField("mutualaid_messageOptional".localized, text: $message, axis: .vertical)
                        .lineLimit(3...6)
                }

                if request.quantityNeeded != nil {
                    Section("mutualaid_howMuchCanYouProvide".localized) {
                        HStack {
                            TextField("mutualaid_quantity".localized, text: $quantity)
                                .keyboardType(.decimalPad)

                            if let unit = request.unit {
                                Text(unit)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                Section("mutualaid_when".localized) {
                    Toggle("mutualaid_scheduleTime".localized, isOn: $hasSchedule)

                    if hasSchedule {
                        DatePicker("mutualaid_dateTime".localized, selection: $scheduledDate)
                    }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("mutualaid_offerToHelp".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("mutualaid_send".localized) {
                        Task { await submitOffer() }
                    }
                    .disabled(isSubmitting)
                }
            }
            .disabled(isSubmitting)
        }
    }

    private func submitOffer() async {
        isSubmitting = true
        errorMessage = nil

        do {
            var qty: Double?
            if !quantity.isEmpty, let parsed = Double(quantity) {
                qty = parsed
            }

            _ = try await service.offerFulfillment(
                requestId: request.id,
                quantity: qty,
                message: message.isEmpty ? nil : message,
                scheduledFor: hasSchedule ? scheduledDate : nil
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// Detail view for an offer
public struct OfferDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let offer: AidOffer
    let service: MutualAidService

    public init(offer: AidOffer, service: MutualAidService) {
        self.offer = offer
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label(offer.category.displayName, systemImage: offer.category.icon)
                                .font(.subheadline)
                                .foregroundColor(.green)

                            Spacer()

                            if offer.isActive {
                                Text("mutualaid_available".localized)
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.green.opacity(0.2))
                                    .foregroundColor(.green)
                                    .clipShape(Capsule())
                            }
                        }

                        Text(offer.title)
                            .font(.title2)
                            .fontWeight(.bold)

                        if let name = offer.offererName {
                            Text("mutualaid_offeredBy".localized(name))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        Text(offer.createdAt, style: .relative) + Text(" ago")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Description
                    if let description = offer.description {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("mutualaid_description".localized)
                                .font(.headline)

                            Text(description)
                                .font(.body)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                    }

                    // Details
                    VStack(alignment: .leading, spacing: 12) {
                        Text("mutualaid_details".localized)
                            .font(.headline)

                        if let location = offer.location {
                            DetailRow(icon: "location", label: "mutualaid_location".localized, value: location.displayString)
                        }

                        if let from = offer.availableFrom {
                            DetailRow(icon: "calendar", label: "mutualaid_availableFrom".localized, value: from.formatted(date: .abbreviated, time: .omitted))
                        }

                        if let until = offer.availableUntil {
                            DetailRow(icon: "calendar.badge.clock", label: "mutualaid_until".localized, value: until.formatted(date: .abbreviated, time: .omitted))
                        }

                        if let qty = offer.quantity {
                            let unit = offer.unit ?? "units"
                            DetailRow(icon: "number", label: "mutualaid_quantity".localized, value: "\(Int(qty)) \(unit)")
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Contact Button
                    if offer.isActive {
                        Button {
                            // Would open a DM with the offerer
                        } label: {
                            Label("mutualaid_contactOfferer".localized, systemImage: "message")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("mutualaid_offer".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.done) { dismiss() }
                }
            }
        }
    }
}
