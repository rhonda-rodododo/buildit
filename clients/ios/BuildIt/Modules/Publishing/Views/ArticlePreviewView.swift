// ArticlePreviewView.swift
// BuildIt - Decentralized Mesh Communication
//
// Preview view for articles before publishing.

import SwiftUI

private typealias Strings = L10n.Publishing

struct ArticlePreviewView: View {
    let title: String
    let subtitle: String?
    let content: String
    let coverImage: String?
    let tags: [String]
    let authorName: String?

    @Environment(\.dismiss) private var dismiss
    @State private var previewMode: PreviewMode = .mobile

    enum PreviewMode: String, CaseIterable {
        case mobile = "Mobile"
        case tablet = "Tablet"
        case desktop = "Desktop"

        var width: CGFloat? {
            switch self {
            case .mobile: return 375
            case .tablet: return 768
            case .desktop: return nil // Full width
            }
        }

        var icon: String {
            switch self {
            case .mobile: return "iphone"
            case .tablet: return "ipad"
            case .desktop: return "desktopcomputer"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Preview mode selector
                Picker("Preview Mode", selection: $previewMode) {
                    ForEach(PreviewMode.allCases, id: \.self) { mode in
                        Label(mode.rawValue, systemImage: mode.icon)
                            .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                // Preview content
                GeometryReader { geometry in
                    ScrollView {
                        previewContent
                            .frame(width: previewMode.width ?? geometry.size.width)
                            .frame(maxWidth: .infinity)
                    }
                    .background(Color(.systemGray6))
                }
            }
            .navigationTitle("publishing_preview".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("publishing_done".localized) {
                        dismiss()
                    }
                }
            }
        }
    }

    private var previewContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Cover image
            if let coverImage = coverImage, !coverImage.isEmpty {
                AsyncImage(url: URL(string: coverImage)) { phase in
                    switch phase {
                    case .empty:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .overlay {
                                ProgressView()
                            }
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .overlay {
                                VStack {
                                    Image(systemName: "photo")
                                        .font(.largeTitle)
                                    Text("publishing_failedToLoadImage".localized)
                                        .font(.caption)
                                }
                                .foregroundColor(.secondary)
                            }
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(height: previewMode == .mobile ? 200 : 300)
                .clipped()
            }

            VStack(alignment: .leading, spacing: 16) {
                // Title
                Text(title.isEmpty ? "publishing_untitledArticle".localized : title)
                    .font(previewMode == .mobile ? .title2 : .largeTitle)
                    .fontWeight(.bold)
                    .fixedSize(horizontal: false, vertical: true)

                // Subtitle
                if let subtitle = subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(previewMode == .mobile ? .subheadline : .title3)
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Author and date
                HStack {
                    if let authorName = authorName {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.accentColor.opacity(0.3))
                                .frame(width: 32, height: 32)
                                .overlay {
                                    Text(String(authorName.prefix(1)).uppercased())
                                        .font(.caption.bold())
                                        .foregroundColor(.accentColor)
                                }

                            Text(authorName)
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                    }

                    Spacer()

                    Text(formatDate(Date()))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                // Tags
                if !tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color.accentColor.opacity(0.15))
                                    .foregroundColor(.accentColor)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                // Reading time
                HStack {
                    Image(systemName: "clock")
                    Text("\(readingTime) min read")
                    Text("-")
                    Text("\(wordCount) words")
                }
                .font(.caption)
                .foregroundColor(.secondary)

                Divider()
                    .padding(.vertical, 8)

                // Content
                ArticleContentView(content: content, fontSize: previewMode == .mobile ? 16 : 18)
            }
            .padding(previewMode == .mobile ? 16 : 24)
        }
        .background(Color(.systemBackground))
    }

    private var wordCount: Int {
        content.split(whereSeparator: { $0.isWhitespace }).count
    }

    private var readingTime: Int {
        max(1, wordCount / 200)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        return formatter.string(from: date)
    }
}

// MARK: - Article Content View

struct ArticleContentView: View {
    let content: String
    let fontSize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(parseContent().enumerated()), id: \.offset) { _, element in
                element
            }
        }
    }

    private func parseContent() -> [AnyView] {
        var views: [AnyView] = []
        let lines = content.components(separatedBy: .newlines)

        var currentParagraph = ""
        var inCodeBlock = false
        var codeBlockContent = ""
        var codeBlockLanguage: String?

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Code block handling
            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    views.append(AnyView(CodeBlockView(code: codeBlockContent, language: codeBlockLanguage)))
                    codeBlockContent = ""
                    codeBlockLanguage = nil
                } else {
                    // Extract language if specified
                    let lang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    codeBlockLanguage = lang.isEmpty ? nil : lang
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
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }

                var level = 0
                var title = trimmed
                while title.hasPrefix("#") {
                    level += 1
                    title = String(title.dropFirst())
                }
                title = title.trimmingCharacters(in: .whitespaces)

                views.append(AnyView(HeaderView(text: title, level: level, baseFontSize: fontSize)))
                continue
            }

            // Horizontal rule
            if trimmed == "---" || trimmed == "***" || trimmed == "___" {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }
                views.append(AnyView(Divider().padding(.vertical, 8)))
                continue
            }

            // Blockquote
            if trimmed.hasPrefix("> ") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }

                let quote = String(trimmed.dropFirst(2))
                views.append(AnyView(BlockquoteView(text: quote, fontSize: fontSize)))
                continue
            }

            // Bullet points
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }

                let bullet = String(trimmed.dropFirst(2))
                views.append(AnyView(BulletPointView(text: bullet, fontSize: fontSize)))
                continue
            }

            // Numbered lists
            if let _ = trimmed.range(of: #"^\d+\. "#, options: .regularExpression) {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }

                if let dotIndex = trimmed.firstIndex(of: ".") {
                    let number = String(trimmed[..<dotIndex])
                    let content = String(trimmed[trimmed.index(after: dotIndex)...]).trimmingCharacters(in: .whitespaces)
                    views.append(AnyView(NumberedPointView(number: number, text: content, fontSize: fontSize)))
                }
                continue
            }

            // Empty line = paragraph break
            if trimmed.isEmpty {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
                    currentParagraph = ""
                }
                continue
            }

            // Regular text
            currentParagraph += (currentParagraph.isEmpty ? "" : " ") + trimmed
        }

        // Remaining paragraph
        if !currentParagraph.isEmpty {
            views.append(AnyView(ParagraphView(text: currentParagraph, fontSize: fontSize)))
        }

        return views
    }
}

// MARK: - Content Components

struct HeaderView: View {
    let text: String
    let level: Int
    let baseFontSize: CGFloat

    var body: some View {
        Text(text)
            .font(.system(size: fontSize, weight: .bold))
            .padding(.top, level == 1 ? 24 : level == 2 ? 20 : 16)
    }

    private var fontSize: CGFloat {
        switch level {
        case 1: return baseFontSize * 1.75
        case 2: return baseFontSize * 1.5
        case 3: return baseFontSize * 1.25
        default: return baseFontSize * 1.1
        }
    }
}

struct ParagraphView: View {
    let text: String
    let fontSize: CGFloat

    var body: some View {
        Text(processInlineMarkdown(text))
            .font(.system(size: fontSize))
            .lineSpacing(6)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func processInlineMarkdown(_ text: String) -> AttributedString {
        var result = AttributedString(text)

        // Bold: **text** or __text__
        let boldPattern = #"\*\*(.+?)\*\*|__(.+?)__"#
        if let regex = try? NSRegularExpression(pattern: boldPattern) {
            let nsString = text as NSString
            let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsString.length))

            for match in matches.reversed() {
                if let range = Range(match.range, in: text),
                   let attrRange = result.range(of: String(text[range])) {
                    let content = match.range(at: 1).location != NSNotFound ?
                        nsString.substring(with: match.range(at: 1)) :
                        nsString.substring(with: match.range(at: 2))

                    var replacement = AttributedString(content)
                    replacement.font = .system(size: fontSize, weight: .bold)
                    result.replaceSubrange(attrRange, with: replacement)
                }
            }
        }

        // Italic: *text* or _text_
        let italicPattern = #"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)"#
        if let regex = try? NSRegularExpression(pattern: italicPattern) {
            let nsString = String(result.characters) as NSString
            let matches = regex.matches(in: String(result.characters), range: NSRange(location: 0, length: nsString.length))

            for match in matches.reversed() {
                let fullMatch = nsString.substring(with: match.range)
                if let attrRange = result.range(of: fullMatch) {
                    let content = match.range(at: 1).location != NSNotFound ?
                        nsString.substring(with: match.range(at: 1)) :
                        nsString.substring(with: match.range(at: 2))

                    var replacement = AttributedString(content)
                    replacement.font = .system(size: fontSize).italic()
                    result.replaceSubrange(attrRange, with: replacement)
                }
            }
        }

        // Inline code: `text`
        let codePattern = #"`(.+?)`"#
        if let regex = try? NSRegularExpression(pattern: codePattern) {
            let nsString = String(result.characters) as NSString
            let matches = regex.matches(in: String(result.characters), range: NSRange(location: 0, length: nsString.length))

            for match in matches.reversed() {
                let fullMatch = nsString.substring(with: match.range)
                if let attrRange = result.range(of: fullMatch) {
                    let content = nsString.substring(with: match.range(at: 1))

                    var replacement = AttributedString(content)
                    replacement.font = .system(size: fontSize * 0.9, design: .monospaced)
                    replacement.backgroundColor = .gray.opacity(0.2)
                    result.replaceSubrange(attrRange, with: replacement)
                }
            }
        }

        // Links: [text](url)
        let linkPattern = #"\[(.+?)\]\((.+?)\)"#
        if let regex = try? NSRegularExpression(pattern: linkPattern) {
            let nsString = String(result.characters) as NSString
            let matches = regex.matches(in: String(result.characters), range: NSRange(location: 0, length: nsString.length))

            for match in matches.reversed() {
                let fullMatch = nsString.substring(with: match.range)
                if let attrRange = result.range(of: fullMatch) {
                    let linkText = nsString.substring(with: match.range(at: 1))
                    let url = nsString.substring(with: match.range(at: 2))

                    var replacement = AttributedString(linkText)
                    replacement.foregroundColor = .accentColor
                    replacement.underlineStyle = .single
                    if let linkUrl = URL(string: url) {
                        replacement.link = linkUrl
                    }
                    result.replaceSubrange(attrRange, with: replacement)
                }
            }
        }

        return result
    }
}

struct BlockquoteView: View {
    let text: String
    let fontSize: CGFloat

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(Color.accentColor)
                .frame(width: 4)

            Text(text)
                .font(.system(size: fontSize))
                .italic()
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

struct BulletPointView: View {
    let text: String
    let fontSize: CGFloat

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("-")
                .font(.system(size: fontSize))
                .foregroundColor(.secondary)

            Text(text)
                .font(.system(size: fontSize))
        }
    }
}

struct NumberedPointView: View {
    let number: String
    let text: String
    let fontSize: CGFloat

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(number).")
                .font(.system(size: fontSize))
                .foregroundColor(.secondary)
                .frame(minWidth: 24, alignment: .trailing)

            Text(text)
                .font(.system(size: fontSize))
        }
    }
}

struct CodeBlockView: View {
    let code: String
    let language: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let language = language {
                Text(language)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.systemGray5))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(.body, design: .monospaced))
                    .padding()
            }
            .background(Color(.systemGray6))
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
