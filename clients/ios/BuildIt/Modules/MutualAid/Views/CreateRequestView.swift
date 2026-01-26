// CreateRequestView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for creating a new mutual aid request.

import SwiftUI

/// View for creating a new aid request
public struct CreateRequestView: View {
    @Environment(\.dismiss) private var dismiss

    let service: MutualAidService
    let onComplete: () -> Void

    @State private var title = ""
    @State private var description = ""
    @State private var category: AidCategory = .other
    @State private var urgency: UrgencyLevel = .medium
    @State private var locationCity = ""
    @State private var locationFlexible = false
    @State private var neededByDate: Date?
    @State private var hasDeadline = false
    @State private var quantityNeeded = ""
    @State private var unit = ""
    @State private var hasQuantity = false
    @State private var anonymousRequest = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    public init(service: MutualAidService, onComplete: @escaping () -> Void) {
        self.service = service
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            Form {
                // Basic Info
                Section("What do you need?") {
                    TextField("Title", text: $title)

                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)

                    Picker("Category", selection: $category) {
                        ForEach(AidCategory.allCases, id: \.self) { cat in
                            Label(cat.displayName, systemImage: cat.icon)
                                .tag(cat)
                        }
                    }
                }

                // Urgency
                Section("How urgent?") {
                    Picker("Urgency", selection: $urgency) {
                        ForEach(UrgencyLevel.allCases, id: \.self) { level in
                            HStack {
                                Circle()
                                    .fill(urgencyColor(level))
                                    .frame(width: 10, height: 10)
                                Text(level.displayName)
                            }
                            .tag(level)
                        }
                    }
                    .pickerStyle(.menu)
                }

                // Location
                Section("Where?") {
                    Toggle("Location is flexible", isOn: $locationFlexible)

                    if !locationFlexible {
                        TextField("City or area", text: $locationCity)
                    }
                }

                // Timeline
                Section("When do you need it?") {
                    Toggle("Has deadline", isOn: $hasDeadline)

                    if hasDeadline {
                        DatePicker(
                            "Needed by",
                            selection: Binding(
                                get: { neededByDate ?? Date() },
                                set: { neededByDate = $0 }
                            ),
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }
                }

                // Quantity
                Section("How much?") {
                    Toggle("Specify quantity", isOn: $hasQuantity)

                    if hasQuantity {
                        HStack {
                            TextField("Amount", text: $quantityNeeded)
                                .keyboardType(.decimalPad)
                                .frame(width: 100)

                            TextField("Unit (e.g., meals, hours)", text: $unit)
                        }
                    }
                }

                // Privacy
                Section("Privacy") {
                    Toggle("Post anonymously", isOn: $anonymousRequest)

                    if anonymousRequest {
                        Text("Your identity will be hidden from the public. Only people who respond will be able to contact you.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Error message
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Post") {
                        Task { await submitRequest() }
                    }
                    .disabled(!isValid || isSubmitting)
                }
            }
            .disabled(isSubmitting)
            .overlay {
                if isSubmitting {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.2))
                }
            }
        }
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func urgencyColor(_ level: UrgencyLevel) -> Color {
        switch level {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }

    private func submitRequest() async {
        isSubmitting = true
        errorMessage = nil

        do {
            var location: AidLocation?
            if !locationFlexible && !locationCity.isEmpty {
                location = AidLocation(type: .area, city: locationCity)
            } else if locationFlexible {
                location = AidLocation(type: .flexible)
            }

            var qty: Double?
            if hasQuantity, let parsed = Double(quantityNeeded) {
                qty = parsed
            }

            _ = try await service.createRequest(
                title: title.trimmingCharacters(in: .whitespaces),
                description: description.isEmpty ? nil : description,
                category: category,
                urgency: urgency,
                location: location,
                neededBy: hasDeadline ? neededByDate : nil,
                quantityNeeded: qty,
                unit: hasQuantity && !unit.isEmpty ? unit : nil,
                anonymousRequest: anonymousRequest
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}

/// View for creating a new aid offer
public struct CreateOfferView: View {
    @Environment(\.dismiss) private var dismiss

    let service: MutualAidService
    let onComplete: () -> Void

    @State private var title = ""
    @State private var description = ""
    @State private var category: AidCategory = .other
    @State private var locationCity = ""
    @State private var locationFlexible = false
    @State private var availableFrom: Date = Date()
    @State private var availableUntil: Date?
    @State private var hasEndDate = false
    @State private var quantity = ""
    @State private var unit = ""
    @State private var hasQuantity = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    public init(service: MutualAidService, onComplete: @escaping () -> Void) {
        self.service = service
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            Form {
                // Basic Info
                Section("What can you offer?") {
                    TextField("Title", text: $title)

                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)

                    Picker("Category", selection: $category) {
                        ForEach(AidCategory.allCases, id: \.self) { cat in
                            Label(cat.displayName, systemImage: cat.icon)
                                .tag(cat)
                        }
                    }
                }

                // Location
                Section("Where?") {
                    Toggle("Can help remotely/anywhere", isOn: $locationFlexible)

                    if !locationFlexible {
                        TextField("City or area", text: $locationCity)
                    }
                }

                // Availability
                Section("When are you available?") {
                    DatePicker("Starting", selection: $availableFrom, displayedComponents: .date)

                    Toggle("Has end date", isOn: $hasEndDate)

                    if hasEndDate {
                        DatePicker(
                            "Until",
                            selection: Binding(
                                get: { availableUntil ?? Date().addingTimeInterval(86400 * 30) },
                                set: { availableUntil = $0 }
                            ),
                            displayedComponents: .date
                        )
                    }
                }

                // Quantity
                Section("How much can you offer?") {
                    Toggle("Specify quantity", isOn: $hasQuantity)

                    if hasQuantity {
                        HStack {
                            TextField("Amount", text: $quantity)
                                .keyboardType(.decimalPad)
                                .frame(width: 100)

                            TextField("Unit (e.g., meals, hours)", text: $unit)
                        }
                    }
                }

                // Error message
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New Offer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Post") {
                        Task { await submitOffer() }
                    }
                    .disabled(!isValid || isSubmitting)
                }
            }
            .disabled(isSubmitting)
            .overlay {
                if isSubmitting {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.2))
                }
            }
        }
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func submitOffer() async {
        isSubmitting = true
        errorMessage = nil

        do {
            var location: AidLocation?
            if !locationFlexible && !locationCity.isEmpty {
                location = AidLocation(type: .area, city: locationCity)
            } else if locationFlexible {
                location = AidLocation(type: .remote)
            }

            var qty: Double?
            if hasQuantity, let parsed = Double(quantity) {
                qty = parsed
            }

            _ = try await service.createOffer(
                title: title.trimmingCharacters(in: .whitespaces),
                description: description.isEmpty ? nil : description,
                category: category,
                location: location,
                availableFrom: availableFrom,
                availableUntil: hasEndDate ? availableUntil : nil,
                quantity: qty,
                unit: hasQuantity && !unit.isEmpty ? unit : nil
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
    }
}
