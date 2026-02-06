// CreateListingView.swift
// BuildIt - Decentralized Mesh Communication
//
// Form view for creating a new marketplace listing.

import SwiftUI

/// Create listing form view
public struct CreateListingView: View {
    @Environment(\.dismiss) private var dismiss

    let service: MarketplaceService
    let onComplete: () -> Void

    @State private var listingType: ListingType = .product
    @State private var title = ""
    @State private var descriptionText = ""
    @State private var priceText = ""
    @State private var currency = "USD"
    @State private var availability = ""
    @State private var contactMethod = "dm"
    @State private var tagInput = ""
    @State private var tags: [String] = []
    @State private var expirationDays = 30
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let currencies = ["USD", "EUR", "GBP", "BTC", "ETH"]
    private let contactMethods = [
        ("dm", "Direct Message"),
        ("public", "Public Reply"),
        ("external", "External Contact")
    ]

    public init(service: MarketplaceService, onComplete: @escaping () -> Void) {
        self.service = service
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationStack {
            Form {
                // Listing Type
                Section {
                    Picker("marketplace_type".localized, selection: $listingType) {
                        ForEach(ListingType.allCases, id: \.self) { type in
                            HStack {
                                Image(systemName: type.icon)
                                Text(type.displayName)
                            }
                            .tag(type)
                        }
                    }
                }

                // Basic Info
                Section(header: Text("marketplace_basicInfo".localized)) {
                    TextField("marketplace_titleField".localized, text: $title)

                    ZStack(alignment: .topLeading) {
                        if descriptionText.isEmpty {
                            Text("marketplace_descriptionPlaceholder".localized)
                                .foregroundColor(.secondary)
                                .padding(.top, 8)
                        }
                        TextEditor(text: $descriptionText)
                            .frame(minHeight: 100)
                    }
                }

                // Pricing
                Section(header: Text("marketplace_pricing".localized)) {
                    HStack {
                        TextField("marketplace_price".localized, text: $priceText)
                            .keyboardType(.decimalPad)

                        Picker("", selection: $currency) {
                            ForEach(currencies, id: \.self) { cur in
                                Text(cur).tag(cur)
                            }
                        }
                        .frame(width: 100)
                    }

                    Text("marketplace_leaveBlankForFree".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                // Availability
                Section(header: Text("marketplace_availability".localized)) {
                    TextField("marketplace_availabilityPlaceholder".localized, text: $availability)

                    Picker("marketplace_contactMethod".localized, selection: $contactMethod) {
                        ForEach(contactMethods, id: \.0) { method in
                            Text(method.1).tag(method.0)
                        }
                    }
                }

                // Tags
                Section(header: Text("marketplace_tags".localized)) {
                    HStack {
                        TextField("marketplace_addTag".localized, text: $tagInput)
                            .onSubmit { addTag() }

                        Button("marketplace_add".localized) {
                            addTag()
                        }
                        .disabled(tagInput.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    if !tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(tags, id: \.self) { tag in
                                    HStack(spacing: 4) {
                                        Text(tag)
                                            .font(.caption)

                                        Button {
                                            tags.removeAll { $0 == tag }
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(.systemGray5))
                                    .cornerRadius(12)
                                }
                            }
                        }
                    }
                }

                // Expiration
                Section(header: Text("marketplace_expiration".localized)) {
                    Stepper("\(expirationDays) " + "marketplace_days".localized, value: $expirationDays, in: 1...365)
                }

                // Error
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("marketplace_createListing".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("common_cancel".localized) { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("marketplace_save".localized) {
                        Task { await saveListing() }
                    }
                    .disabled(!isValid || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    // MARK: - Validation

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func addTag() {
        let trimmed = tagInput.trimmingCharacters(in: .whitespaces).lowercased()
        guard !trimmed.isEmpty, !tags.contains(trimmed) else { return }
        tags.append(trimmed)
        tagInput = ""
    }

    private func saveListing() async {
        isSaving = true
        errorMessage = nil

        do {
            let price: Double? = {
                guard let value = Double(priceText), value > 0 else { return nil }
                return value * 100 // Store in cents
            }()

            let expiresAt = Calendar.current.date(
                byAdding: .day,
                value: expirationDays,
                to: Date()
            )

            _ = try await service.createListing(
                type: listingType,
                title: title.trimmingCharacters(in: .whitespaces),
                description: descriptionText.isEmpty ? nil : descriptionText,
                price: price,
                currency: currency,
                images: [],
                location: nil,
                availability: availability.isEmpty ? nil : availability,
                tags: tags,
                expiresAt: expiresAt,
                groupId: nil,
                coopId: nil,
                contactMethod: contactMethod
            )

            dismiss()
            onComplete()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }
}
