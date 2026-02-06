// ListingDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view of a marketplace listing with images, description, and contact.

import SwiftUI

/// Detailed view of a marketplace listing
public struct ListingDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let listing: Listing
    let service: MarketplaceService

    @State private var currentImageIndex = 0
    @State private var showContactSheet = false
    @State private var showDeleteConfirmation = false
    @State private var errorMessage: String?

    public init(listing: Listing, service: MarketplaceService) {
        self.listing = listing
        self.service = service
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Image gallery
                    imageGallery

                    VStack(alignment: .leading, spacing: 16) {
                        // Header: Type badge + Status
                        HStack {
                            ListingTypeBadge(type: listing.type)
                            Spacer()
                            ListingStatusBadge(status: listing.status)
                        }

                        // Title
                        Text(listing.title)
                            .font(.title2)
                            .fontWeight(.bold)

                        // Price
                        Text(listing.formattedPrice)
                            .font(.title)
                            .foregroundColor(.accentColor)
                            .fontWeight(.bold)

                        // Location
                        if let location = listing.location {
                            HStack(spacing: 6) {
                                Image(systemName: "mappin.circle.fill")
                                    .foregroundColor(.red)
                                Text(location.label)
                                    .font(.subheadline)

                                Spacer()

                                Text("(\(location.precision))")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                        }

                        // Description
                        if let description = listing.description {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("marketplace_about".localized)
                                    .font(.headline)

                                Text(description)
                                    .font(.body)
                            }
                        }

                        // Availability
                        if let availability = listing.availability {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("marketplace_availability".localized)
                                    .font(.headline)

                                HStack {
                                    Image(systemName: "clock")
                                        .foregroundColor(.secondary)
                                    Text(availability)
                                        .font(.subheadline)
                                }
                            }
                        }

                        // Tags
                        if !listing.tags.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("marketplace_tags".localized)
                                    .font(.headline)

                                FlowLayout(spacing: 8) {
                                    ForEach(listing.tags, id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(Color(.systemGray5))
                                            .cornerRadius(12)
                                    }
                                }
                            }
                        }

                        // Metadata
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "person.circle")
                                    .foregroundColor(.secondary)
                                Text("marketplace_postedBy".localized)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(String(listing.createdBy.prefix(8)) + "...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            HStack {
                                Image(systemName: "calendar")
                                    .foregroundColor(.secondary)
                                Text(listing.createdAt, style: .date)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            if let expiresAt = listing.expiresAt {
                                HStack {
                                    Image(systemName: "clock.badge.exclamationmark")
                                        .foregroundColor(listing.isExpired ? .red : .orange)
                                    Text(listing.isExpired ? "marketplace_expired".localized : "marketplace_expiresOn".localized)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(expiresAt, style: .date)
                                        .font(.caption)
                                        .foregroundColor(listing.isExpired ? .red : .secondary)
                                }
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)

                        // Contact button
                        if listing.status == .active && !listing.isExpired {
                            Button {
                                showContactSheet = true
                            } label: {
                                Label("marketplace_contactSeller".localized, systemImage: "envelope.fill")
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
                    .padding(.horizontal)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("marketplace_listing".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("common_done".localized) { dismiss() }
                }
            }
            .sheet(isPresented: $showContactSheet) {
                ContactSellerSheet(listing: listing)
            }
        }
    }

    // MARK: - Image Gallery

    @ViewBuilder
    private var imageGallery: some View {
        if listing.images.isEmpty {
            ZStack {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .aspectRatio(16/9, contentMode: .fill)

                Image(systemName: listing.type.icon)
                    .font(.system(size: 48))
                    .foregroundColor(.secondary)
            }
        } else {
            TabView(selection: $currentImageIndex) {
                ForEach(Array(listing.images.enumerated()), id: \.offset) { index, imageUrl in
                    AsyncImage(url: URL(string: imageUrl)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(Color(.systemGray5))
                            .overlay(ProgressView())
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .aspectRatio(16/9, contentMode: .fill)
        }
    }
}

// MARK: - Listing Type Badge

struct ListingTypeBadge: View {
    let type: ListingType

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: type.icon)
                .font(.caption2)
            Text(type.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.accentColor.opacity(0.15))
        .foregroundColor(.accentColor)
        .clipShape(Capsule())
    }
}

// MARK: - Listing Status Badge

struct ListingStatusBadge: View {
    let status: ListingStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch status {
        case .active: return .green
        case .sold: return .blue
        case .expired: return .gray
        case .removed: return .red
        }
    }
}

// MARK: - Flow Layout (for tags)

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)

        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth, currentX > 0 {
                currentY += lineHeight + spacing
                currentX = 0
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            maxX = max(maxX, currentX)
        }

        return (
            CGSize(width: maxX, height: currentY + lineHeight),
            positions
        )
    }
}

// MARK: - Contact Seller Sheet

struct ContactSellerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let listing: Listing

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "envelope.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.accentColor)

                Text("marketplace_contactTitle".localized)
                    .font(.headline)

                Text("marketplace_contactDescription".localized)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)

                VStack(spacing: 12) {
                    Button {
                        // Send DM via Nostr NIP-17
                        dismiss()
                    } label: {
                        Label("marketplace_sendDM".localized, systemImage: "message.fill")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentColor)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                }

                Spacer()
            }
            .padding()
            .navigationTitle("marketplace_contact".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("common_done".localized) { dismiss() }
                }
            }
        }
    }
}
