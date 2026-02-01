// LinkPreviewView.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI component for displaying link previews.
// Supports compact (in-composer) and full (in-message) layouts.

import SwiftUI

/// Renders a link preview card with image, title, description, and domain.
struct LinkPreviewView: View {
    let preview: LinkPreview
    var compact: Bool = false
    var showRemove: Bool = false
    var onRemove: (() -> Void)?

    private var domain: String {
        guard let url = URL(string: preview.url) else { return preview.url }
        return url.host?.replacingOccurrences(of: "www.", with: "") ?? preview.url
    }

    var body: some View {
        if compact {
            compactLayout
        } else {
            fullLayout
        }
    }

    // MARK: - Compact Layout (for composers)

    private var compactLayout: some View {
        HStack(spacing: 12) {
            thumbnailImage(size: 64)

            VStack(alignment: .leading, spacing: 4) {
                if let title = preview.title {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)
                }

                if let description = preview.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                domainLabel
            }

            Spacer()

            if showRemove {
                Button(action: { onRemove?() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .accessibilityLabel("Remove preview")
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture { openURL() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(.isLink)
    }

    // MARK: - Full Layout (for message bubbles)

    private var fullLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image
            if let imageData = preview.imageData,
               let data = Data(base64Encoded: imageData),
               let uiImage = UIImage(data: data) {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxHeight: 200)
                        .clipped()

                    if showRemove {
                        Button(action: { onRemove?() }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundColor(.white)
                                .shadow(radius: 2)
                        }
                        .padding(8)
                        .accessibilityLabel("Remove preview")
                    }
                }
            }

            // Text content
            VStack(alignment: .leading, spacing: 8) {
                if let title = preview.title {
                    Text(title)
                        .font(.headline)
                        .lineLimit(2)
                }

                if let description = preview.description {
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                domainLabel
            }
            .padding()
        }
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separator), lineWidth: 0.5)
        )
        .onTapGesture { openURL() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(.isLink)
    }

    // MARK: - Shared Subviews

    @ViewBuilder
    private func thumbnailImage(size: CGFloat) -> some View {
        if let imageData = preview.imageData,
           let data = Data(base64Encoded: imageData),
           let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private var domainLabel: some View {
        HStack(spacing: 4) {
            if let faviconData = preview.faviconData,
               let data = Data(base64Encoded: faviconData),
               let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .frame(width: 12, height: 12)
            } else {
                Image(systemName: "globe")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text(preview.siteName ?? domain)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private var accessibilityDescription: String {
        var parts: [String] = ["Link preview"]
        if let title = preview.title { parts.append(title) }
        if let description = preview.description { parts.append(description) }
        parts.append("from \(preview.siteName ?? domain)")
        return parts.joined(separator: ". ")
    }

    private func openURL() {
        if let url = URL(string: preview.url) {
            UIApplication.shared.open(url)
        }
    }
}

/// Loading skeleton for link previews
struct LinkPreviewSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(width: 64, height: 64)

            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(height: 14)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(width: 120, height: 10)
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/// Horizontal scroll of link preview cards for composers
struct LinkPreviewStrip: View {
    let previews: [LinkPreview]
    var isLoading: Bool = false
    var onRemove: ((String) -> Void)?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                if isLoading {
                    LinkPreviewSkeleton()
                        .frame(width: 280)
                }

                ForEach(previews, id: \.url) { preview in
                    LinkPreviewView(
                        preview: preview,
                        compact: true,
                        showRemove: true,
                        onRemove: { onRemove?(preview.url) }
                    )
                    .frame(width: 280)
                }
            }
            .padding(.horizontal)
        }
    }
}

#Preview("Full") {
    LinkPreviewView(
        preview: LinkPreview(
            description: "A comprehensive guide to building effective grassroots movements",
            faviconData: nil,
            faviconType: nil,
            fetchedAt: Int(Date().timeIntervalSince1970),
            fetchedBy: .sender,
            imageData: nil,
            imageHeight: nil,
            imageType: nil,
            imageWidth: nil,
            siteName: "Example",
            title: "Community Organizing 101",
            url: "https://example.com"
        )
    )
    .padding()
}

#Preview("Compact") {
    LinkPreviewView(
        preview: LinkPreview(
            description: "A comprehensive guide to building effective grassroots movements",
            faviconData: nil,
            faviconType: nil,
            fetchedAt: Int(Date().timeIntervalSince1970),
            fetchedBy: .sender,
            imageData: nil,
            imageHeight: nil,
            imageType: nil,
            imageWidth: nil,
            siteName: "Example",
            title: "Community Organizing 101",
            url: "https://example.com"
        ),
        compact: true,
        showRemove: true
    )
    .padding()
}
