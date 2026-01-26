// RequestDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view of a mutual aid request with fulfillment options.

import SwiftUI

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
                            Text("Posted by \(name)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        } else if request.anonymousRequest {
                            Text("Posted anonymously")
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
                            Text("Description")
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
                        Text("Details")
                            .font(.headline)

                        if let location = request.location {
                            DetailRow(icon: "location", label: "Location", value: location.displayString)
                        }

                        if let neededBy = request.neededBy {
                            DetailRow(icon: "clock", label: "Needed by", value: neededBy.formatted(date: .abbreviated, time: .shortened))
                        }

                        if let qty = request.quantityNeeded {
                            let unit = request.unit ?? "units"
                            DetailRow(icon: "number", label: "Needed", value: "\(Int(qty)) \(unit)")

                            if request.quantityFulfilled > 0 {
                                DetailRow(icon: "checkmark.circle", label: "Fulfilled", value: "\(Int(request.quantityFulfilled)) \(unit)")

                                ProgressView(value: request.progressPercentage)
                                    .tint(.green)
                            }
                        }

                        DetailRow(icon: "tag", label: "Status", value: request.status.displayName)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)

                    // Fulfillments
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Responses")
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
                            Text("No one has offered to help yet")
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
                            Label("Offer to Help", systemImage: "hand.raised")
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
            .navigationTitle("Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
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
        case .offered: return "Offered"
        case .accepted: return "Accepted"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        case .declined: return "Declined"
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
                Section("Your offer") {
                    TextField("Message (optional)", text: $message, axis: .vertical)
                        .lineLimit(3...6)
                }

                if request.quantityNeeded != nil {
                    Section("How much can you provide?") {
                        HStack {
                            TextField("Quantity", text: $quantity)
                                .keyboardType(.decimalPad)

                            if let unit = request.unit {
                                Text(unit)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                Section("When?") {
                    Toggle("Schedule a time", isOn: $hasSchedule)

                    if hasSchedule {
                        DatePicker("Date & Time", selection: $scheduledDate)
                    }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Offer to Help")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
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
                                Text("Available")
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
                            Text("Offered by \(name)")
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
                            Text("Description")
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
                        Text("Details")
                            .font(.headline)

                        if let location = offer.location {
                            DetailRow(icon: "location", label: "Location", value: location.displayString)
                        }

                        if let from = offer.availableFrom {
                            DetailRow(icon: "calendar", label: "Available from", value: from.formatted(date: .abbreviated, time: .omitted))
                        }

                        if let until = offer.availableUntil {
                            DetailRow(icon: "calendar.badge.clock", label: "Until", value: until.formatted(date: .abbreviated, time: .omitted))
                        }

                        if let qty = offer.quantity {
                            let unit = offer.unit ?? "units"
                            DetailRow(icon: "number", label: "Quantity", value: "\(Int(qty)) \(unit)")
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
                            Label("Contact Offerer", systemImage: "message")
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
            .navigationTitle("Offer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
