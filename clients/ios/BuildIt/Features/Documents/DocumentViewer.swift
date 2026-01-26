// DocumentViewer.swift
// BuildIt - Decentralized Mesh Communication
//
// View for displaying document content with markdown rendering.

import SwiftUI

/// Full-screen document viewer with markdown rendering
struct DocumentViewer: View {
    let document: Document

    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Document metadata
                    HStack {
                        Text("Last updated \(document.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        if document.groupId != nil {
                            Label("Shared", systemImage: "person.2.fill")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Divider()

                    // Rendered content
                    switch document.type {
                    case .markdown:
                        MarkdownView(content: document.content)
                    case .plainText, .richText:
                        PlainTextView(content: document.content)
                    }
                }
                .padding()
            }
            .navigationTitle(document.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(document: document)
            }
        }
    }
}

/// Markdown renderer
struct MarkdownView: View {
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(content.split(separator: "\n", omittingEmptySubsequences: false).enumerated()), id: \.offset) { _, line in
                MarkdownLine(line: String(line))
            }
        }
    }
}

/// Single markdown line renderer
struct MarkdownLine: View {
    let line: String

    var body: some View {
        Group {
            if line.hasPrefix("# ") {
                // H1
                Text(String(line.dropFirst(2)))
                    .font(.title)
                    .fontWeight(.bold)
                    .padding(.vertical, 8)
            } else if line.hasPrefix("## ") {
                // H2
                Text(String(line.dropFirst(3)))
                    .font(.title2)
                    .fontWeight(.bold)
                    .padding(.vertical, 6)
            } else if line.hasPrefix("### ") {
                // H3
                Text(String(line.dropFirst(4)))
                    .font(.title3)
                    .fontWeight(.semibold)
                    .padding(.vertical, 4)
            } else if line.hasPrefix("```") || line.hasPrefix("    ") {
                // Code block
                let code = line.hasPrefix("```") ? String(line.dropFirst(3)) : String(line.dropFirst(4))
                Text(code)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding(.vertical, 2)
            } else if line.hasPrefix("- [ ] ") {
                // Unchecked checkbox
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "square")
                        .foregroundColor(.secondary)
                    parseInlineMarkdown(String(line.dropFirst(6)))
                }
                .padding(.leading, 8)
                .padding(.vertical, 2)
            } else if line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ") {
                // Checked checkbox
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "checkmark.square.fill")
                        .foregroundColor(.accentColor)
                    parseInlineMarkdown(String(line.dropFirst(6)))
                }
                .padding(.leading, 8)
                .padding(.vertical, 2)
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                // Bullet list
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .foregroundColor(.secondary)
                    parseInlineMarkdown(String(line.dropFirst(2)))
                }
                .padding(.leading, 8)
                .padding(.vertical, 2)
            } else if line.range(of: #"^\d+\.\s"#, options: .regularExpression) != nil {
                // Numbered list
                parseInlineMarkdown(line)
                    .padding(.leading, 8)
                    .padding(.vertical, 2)
            } else if line.trimmingCharacters(in: .whitespaces).isEmpty {
                // Empty line
                Spacer()
                    .frame(height: 8)
            } else if line == "---" || line == "***" {
                // Horizontal rule
                Divider()
                    .padding(.vertical, 8)
            } else {
                // Regular text with inline formatting
                parseInlineMarkdown(line)
                    .padding(.vertical, 2)
            }
        }
    }

    @ViewBuilder
    private func parseInlineMarkdown(_ text: String) -> some View {
        Text(parseMarkdownAttributed(text))
            .font(.body)
    }

    private func parseMarkdownAttributed(_ text: String) -> AttributedString {
        var result = AttributedString()
        var current = text[...]

        while !current.isEmpty {
            // Bold: **text**
            if current.hasPrefix("**") {
                let afterStart = current.dropFirst(2)
                if let endIndex = afterStart.range(of: "**") {
                    var boldPart = AttributedString(afterStart[..<endIndex.lowerBound])
                    boldPart.font = .body.bold()
                    result.append(boldPart)
                    current = afterStart[endIndex.upperBound...]
                    continue
                }
            }

            // Italic: *text*
            if current.hasPrefix("*") && !current.hasPrefix("**") {
                let afterStart = current.dropFirst(1)
                if let endIndex = afterStart.range(of: "*") {
                    var italicPart = AttributedString(afterStart[..<endIndex.lowerBound])
                    italicPart.font = .body.italic()
                    result.append(italicPart)
                    current = afterStart[endIndex.upperBound...]
                    continue
                }
            }

            // Inline code: `code`
            if current.hasPrefix("`") {
                let afterStart = current.dropFirst(1)
                if let endIndex = afterStart.range(of: "`") {
                    var codePart = AttributedString(afterStart[..<endIndex.lowerBound])
                    codePart.font = .system(.body, design: .monospaced)
                    codePart.backgroundColor = .gray.opacity(0.2)
                    result.append(codePart)
                    current = afterStart[endIndex.upperBound...]
                    continue
                }
            }

            // Regular character
            result.append(AttributedString(String(current.first!)))
            current = current.dropFirst()
        }

        return result
    }
}

/// Plain text view
struct PlainTextView: View {
    let content: String

    var body: some View {
        Text(content)
            .font(.body)
    }
}

/// Share sheet for sharing document content
struct ShareSheet: UIViewControllerRepresentable {
    let document: Document

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let items: [Any] = [
            document.title,
            document.content
        ]

        let controller = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )

        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    DocumentViewer(document: Document(
        id: "1",
        title: "Sample Document",
        content: """
        # Getting Started

        Welcome to **BuildIt**, a *privacy-first* organizing platform.

        ## Features

        - End-to-end encryption
        - BLE mesh networking
        - Decentralized

        ### Quick Start

        1. Create your identity
        2. Connect with nearby devices
        3. Start organizing!

        `inline code` example

        - [ ] Unchecked task
        - [x] Checked task

        ---

        Regular paragraph text here.
        """,
        type: .markdown,
        createdAt: Date(),
        updatedAt: Date(),
        groupId: nil
    ))
}
