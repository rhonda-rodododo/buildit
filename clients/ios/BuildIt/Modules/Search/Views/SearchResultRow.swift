// SearchResultRow.swift
// BuildIt - Decentralized Mesh Communication
//
// Individual search result row with highlight and metadata.

import SwiftUI

// MARK: - SearchResultRow

/// Row view for a single search result
public struct SearchResultRow: View {
    let result: FormattedSearchResult

    @State private var isPressed = false

    public init(result: FormattedSearchResult) {
        self.result = result
    }

    public var body: some View {
        NavigationLink(value: result) {
            HStack(alignment: .top, spacing: 12) {
                // Module icon
                moduleIcon

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    // Title
                    Text(result.title)
                        .font(.headline)
                        .lineLimit(2)

                    // Excerpt with highlights
                    highlightedExcerpt
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(3)

                    // Metadata row
                    metadataRow
                }

                Spacer()
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Module Icon

    private var moduleIcon: some View {
        ZStack {
            Circle()
                .fill(moduleColor.opacity(0.1))
                .frame(width: 40, height: 40)

            Image(systemName: result.moduleIcon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(moduleColor)
        }
    }

    private var moduleColor: Color {
        switch result.moduleType {
        case "events":
            return .blue
        case "messaging", "messages":
            return .green
        case "documents":
            return .orange
        case "wiki":
            return .purple
        case "governance":
            return .indigo
        case "mutual-aid", "mutualaid":
            return .pink
        case "fundraising":
            return .yellow
        case "forms":
            return .teal
        case "contacts", "crm":
            return .cyan
        default:
            return .gray
        }
    }

    // MARK: - Highlighted Excerpt

    private var highlightedExcerpt: some View {
        // Parse markdown-style highlights (**term**)
        Text(parseHighlights(result.excerpt))
    }

    private func parseHighlights(_ text: String) -> AttributedString {
        var attributed = AttributedString(text)

        // Find **highlighted** terms and apply styling
        let pattern = "\\*\\*([^*]+)\\*\\*"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return attributed
        }

        let nsString = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsString.length))

        // Process matches in reverse to maintain correct ranges
        for match in matches.reversed() {
            guard let swiftRange = Range(match.range, in: text),
                  let termRange = Range(match.range(at: 1), in: text) else {
                continue
            }

            // Get the highlighted term
            let term = String(text[termRange])

            // Create attributed version of just the term
            var highlightedTerm = AttributedString(term)
            highlightedTerm.backgroundColor = .yellow.opacity(0.3)
            highlightedTerm.font = .subheadline.bold()

            // Replace in attributed string
            if let attrRange = Range(match.range, in: attributed) {
                attributed.replaceSubrange(attrRange, with: highlightedTerm)
            }
        }

        return attributed
    }

    // MARK: - Metadata Row

    private var metadataRow: some View {
        HStack(spacing: 8) {
            // Module type badge
            Text(result.moduleType.capitalized)
                .font(.caption2)
                .fontWeight(.medium)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(moduleColor.opacity(0.1))
                .foregroundColor(moduleColor)
                .cornerRadius(4)

            // Group name if available
            if let groupName = result.groupName {
                HStack(spacing: 2) {
                    Image(systemName: "person.2")
                        .font(.caption2)
                    Text(groupName)
                        .font(.caption)
                }
                .foregroundColor(.secondary)
            }

            Spacer()

            // Date
            Text(result.createdAt.formatted(.relative(presentation: .named)))
                .font(.caption)
                .foregroundColor(.secondary)

            // Relevance indicator
            relevanceIndicator
        }
    }

    private var relevanceIndicator: some View {
        // Show relevance as dots
        HStack(spacing: 2) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(index < relevanceLevel ? Color.accentColor : Color.gray.opacity(0.3))
                    .frame(width: 4, height: 4)
            }
        }
    }

    private var relevanceLevel: Int {
        if result.score > 0.8 { return 3 }
        if result.score > 0.5 { return 2 }
        return 1
    }
}

// MARK: - Compact Result Row

/// Compact version for smaller spaces
public struct CompactSearchResultRow: View {
    let result: FormattedSearchResult

    public init(result: FormattedSearchResult) {
        self.result = result
    }

    public var body: some View {
        HStack(spacing: 10) {
            Image(systemName: result.moduleIcon)
                .font(.system(size: 14))
                .foregroundColor(.secondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(result.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(result.moduleType.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Result Card

/// Card-style result for grid layouts
public struct SearchResultCard: View {
    let result: FormattedSearchResult

    public init(result: FormattedSearchResult) {
        self.result = result
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: result.moduleIcon)
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)

                Text(result.moduleType.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text(result.createdAt.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // Title
            Text(result.title)
                .font(.headline)
                .lineLimit(2)

            // Excerpt
            Text(result.excerpt)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(3)

            Spacer()

            // Matched terms
            if !result.matchedTerms.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(result.matchedTerms.prefix(3), id: \.self) { term in
                            Text(term)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.yellow.opacity(0.2))
                                .cornerRadius(4)
                        }
                    }
                }
            }
        }
        .padding()
        .frame(minHeight: 140)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }
}

// MARK: - Preview

#Preview {
    List {
        SearchResultRow(
            result: FormattedSearchResult(
                id: "events:1",
                title: "Community Meeting",
                excerpt: "Monthly gathering to discuss **community** issues and **organizing** efforts.",
                moduleType: "events",
                moduleIcon: "calendar",
                groupId: "group-1",
                groupName: "Local Chapter",
                score: 0.85,
                matchedTerms: ["community", "organizing"],
                createdAt: Date(),
                entityId: "1"
            )
        )

        CompactSearchResultRow(
            result: FormattedSearchResult(
                id: "documents:2",
                title: "Organizing Manual",
                excerpt: "A guide to effective organizing.",
                moduleType: "documents",
                moduleIcon: "doc.text",
                groupId: "group-1",
                score: 0.65,
                matchedTerms: ["organizing"],
                createdAt: Date().addingTimeInterval(-86400),
                entityId: "2"
            )
        )
    }
    .listStyle(.plain)
}
