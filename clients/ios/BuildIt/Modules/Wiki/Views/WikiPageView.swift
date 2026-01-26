// WikiPageView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for displaying a wiki page with markdown content.

import SwiftUI

// Import localization
private typealias Strings = L10n.Wiki

struct WikiPageView: View {
    let page: WikiPage
    let service: WikiService
    @State private var tableOfContents: [TableOfContentsEntry] = []
    @State private var showToc = false
    @State private var showHistory = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                headerSection

                Divider()

                // Table of contents (if has headings)
                if !tableOfContents.isEmpty {
                    tocSection
                }

                // Content
                MarkdownView(content: page.content)
                    .padding(.horizontal)

                Divider()

                // Footer info
                footerSection
            }
            .padding(.vertical)
        }
        .navigationTitle(page.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button(action: { showToc.toggle() }) {
                        Label("wiki_tableOfContents".localized, systemImage: "list.bullet")
                    }

                    Button(action: { showHistory = true }) {
                        Label("wiki_viewHistory".localized, systemImage: "clock.arrow.circlepath")
                    }

                    ShareLink(item: "[\(page.title)](\(page.slug))") {
                        Label("wiki_share".localized, systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showHistory) {
            RevisionHistoryView(pageId: page.id, pageTitle: page.title, service: service)
        }
        .task {
            tableOfContents = service.extractTableOfContents(from: page.content)
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title
            Text(page.title)
                .font(.title)
                .fontWeight(.bold)
                .padding(.horizontal)

            // Summary
            if let summary = page.summary {
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
            }

            // Tags
            if !page.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(page.tags, id: \.self) { tag in
                            TagView(tag: tag)
                        }
                    }
                    .padding(.horizontal)
                }
            }

            // Meta info
            HStack {
                Label("v\(page.version)", systemImage: "doc.badge.gearshape")
                Spacer()
                Label("\(page.readingTime) min read", systemImage: "clock")
                Spacer()
                Label("\(page.wordCount) words", systemImage: "text.alignleft")
            }
            .font(.caption)
            .foregroundColor(.secondary)
            .padding(.horizontal)
        }
    }

    private var tocSection: some View {
        DisclosureGroup(isExpanded: $showToc) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(tableOfContents) { entry in
                    TocEntryView(entry: entry)
                }
            }
            .padding(.vertical, 8)
        } label: {
            Label("wiki_tableOfContents".localized, systemImage: "list.bullet")
                .font(.headline)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal)
    }

    private var footerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Contributors
            if !page.contributors.isEmpty {
                HStack {
                    Text("wiki_contributors".localized(page.contributors.count))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Dates
            VStack(alignment: .leading, spacing: 4) {
                if let updated = page.updatedAt {
                    HStack {
                        Text("wiki_lastUpdated".localized)
                            .foregroundColor(.secondary)
                        Text(formatDate(updated))
                    }
                    .font(.caption)
                }

                HStack {
                    Text("wiki_created".localized)
                        .foregroundColor(.secondary)
                    Text(formatDate(page.createdAt))
                }
                .font(.caption)
            }
        }
        .padding(.horizontal)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Tag View

struct TagView: View {
    let tag: String

    var body: some View {
        Text(tag)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.accentColor.opacity(0.2))
            .foregroundColor(.accentColor)
            .clipShape(Capsule())
    }
}

// MARK: - TOC Entry View

struct TocEntryView: View {
    let entry: TableOfContentsEntry

    var body: some View {
        HStack {
            // Indentation based on level
            ForEach(0..<(entry.level - 1), id: \.self) { _ in
                Rectangle()
                    .fill(Color.clear)
                    .frame(width: 16)
            }

            Circle()
                .fill(Color.accentColor.opacity(0.5))
                .frame(width: 6, height: 6)

            Text(entry.title)
                .font(entry.level == 1 ? .subheadline.weight(.semibold) : .subheadline)
                .foregroundColor(entry.level == 1 ? .primary : .secondary)
        }
    }
}

// MARK: - Markdown View (Simple Implementation)

struct MarkdownView: View {
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(parseMarkdown().enumerated()), id: \.offset) { _, element in
                element
            }
        }
    }

    private func parseMarkdown() -> [AnyView] {
        var views: [AnyView] = []
        let lines = content.components(separatedBy: .newlines)

        var currentParagraph = ""
        var inCodeBlock = false
        var codeBlockContent = ""

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Code block handling
            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    views.append(AnyView(codeBlock(codeBlockContent)))
                    codeBlockContent = ""
                }
                inCodeBlock.toggle()
                continue
            }

            if inCodeBlock {
                codeBlockContent += (codeBlockContent.isEmpty ? "" : "\n") + line
                continue
            }

            // Headers
            if trimmed.hasPrefix("#") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }

                var level = 0
                var title = trimmed
                while title.hasPrefix("#") {
                    level += 1
                    title = String(title.dropFirst())
                }
                title = title.trimmingCharacters(in: .whitespaces)

                views.append(AnyView(header(title, level: level)))
                continue
            }

            // Bullet points
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }

                let bullet = String(trimmed.dropFirst(2))
                views.append(AnyView(bulletPoint(bullet)))
                continue
            }

            // Numbered lists
            if let _ = trimmed.range(of: #"^\d+\. "#, options: .regularExpression) {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }

                if let dotIndex = trimmed.firstIndex(of: ".") {
                    let content = String(trimmed[trimmed.index(after: dotIndex)...]).trimmingCharacters(in: .whitespaces)
                    views.append(AnyView(bulletPoint(content)))
                }
                continue
            }

            // Empty line = paragraph break
            if trimmed.isEmpty {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }
                continue
            }

            // Regular text
            currentParagraph += (currentParagraph.isEmpty ? "" : " ") + trimmed
        }

        // Remaining paragraph
        if !currentParagraph.isEmpty {
            views.append(AnyView(paragraph(currentParagraph)))
        }

        return views
    }

    private func header(_ text: String, level: Int) -> some View {
        Text(text)
            .font(level == 1 ? .title2 : level == 2 ? .title3 : .headline)
            .fontWeight(.bold)
            .padding(.top, level == 1 ? 16 : 8)
    }

    private func paragraph(_ text: String) -> some View {
        Text(processInlineMarkdown(text))
            .font(.body)
    }

    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
                .foregroundColor(.secondary)
            Text(processInlineMarkdown(text))
        }
        .font(.body)
    }

    private func codeBlock(_ code: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Text(code)
                .font(.system(.body, design: .monospaced))
                .padding()
        }
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func processInlineMarkdown(_ text: String) -> AttributedString {
        var result = AttributedString(text)

        // Bold: **text**
        if let range = result.range(of: #"\*\*(.+?)\*\*"#, options: .regularExpression) {
            var substring = result[range]
            substring.font = .body.bold()
            result.replaceSubrange(range, with: substring)
        }

        // Italic: *text*
        if let range = result.range(of: #"\*(.+?)\*"#, options: .regularExpression) {
            var substring = result[range]
            substring.font = .body.italic()
            result.replaceSubrange(range, with: substring)
        }

        // Code: `text`
        if let range = result.range(of: #"`(.+?)`"#, options: .regularExpression) {
            var substring = result[range]
            substring.font = .system(.body, design: .monospaced)
            substring.backgroundColor = .gray.opacity(0.2)
            result.replaceSubrange(range, with: substring)
        }

        return result
    }
}

// MARK: - Revision History View

struct RevisionHistoryView: View {
    let pageId: String
    let pageTitle: String
    let service: WikiService
    @Environment(\.dismiss) private var dismiss
    @State private var revisions: [PageRevision] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("wiki_loadingHistory".localized)
                } else if revisions.isEmpty {
                    Text("wiki_noRevisionHistory".localized)
                        .foregroundColor(.secondary)
                } else {
                    List(revisions) { revision in
                        RevisionRow(revision: revision)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("wiki_revisionHistory".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L10n.Common.done) { dismiss() }
                }
            }
            .task {
                do {
                    revisions = try await service.getRevisions(pageId: pageId)
                } catch {
                    // Handle error
                }
                isLoading = false
            }
        }
    }
}

struct RevisionRow: View {
    let revision: PageRevision

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Version \(revision.version)")
                    .font(.headline)

                Spacer()

                Text(revision.editType.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.2))
                    .clipShape(Capsule())
            }

            if let summary = revision.summary {
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Text(formatDate(revision.createdAt))
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
