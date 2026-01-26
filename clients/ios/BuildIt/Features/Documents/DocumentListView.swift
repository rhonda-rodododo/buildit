// DocumentListView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for browsing and searching documents.

import SwiftUI

/// Main view for document browsing
struct DocumentListView: View {
    @StateObject private var viewModel = DocumentsViewModel()
    @State private var selectedDocument: Document?
    @State private var showingDocumentViewer = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                SearchBar(text: $viewModel.searchQuery, onSearchChanged: {
                    viewModel.search()
                })
                .padding(.horizontal)
                .padding(.vertical, 8)

                // Document list
                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if viewModel.documents.isEmpty {
                    EmptyDocumentsView()
                } else {
                    DocumentsList(
                        documents: viewModel.documents,
                        onDocumentTap: { document in
                            selectedDocument = document
                            showingDocumentViewer = true
                        }
                    )
                }
            }
            .navigationTitle("Documents")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.refresh()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $showingDocumentViewer) {
                if let document = selectedDocument {
                    DocumentViewer(document: document)
                }
            }
            .refreshable {
                viewModel.refresh()
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.error != nil },
                set: { if !$0 { viewModel.clearError() } }
            )) {
                Button("OK") { viewModel.clearError() }
            } message: {
                Text(viewModel.error ?? "")
            }
        }
    }
}

/// Search bar component
struct SearchBar: View {
    @Binding var text: String
    var onSearchChanged: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)

            TextField("Search documents", text: $text)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .onChange(of: text) { _, _ in
                    onSearchChanged()
                }

            if !text.isEmpty {
                Button {
                    text = ""
                    onSearchChanged()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(10)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

/// List of documents
struct DocumentsList: View {
    let documents: [Document]
    let onDocumentTap: (Document) -> Void

    var body: some View {
        List(documents) { document in
            DocumentRow(document: document)
                .contentShape(Rectangle())
                .onTapGesture {
                    onDocumentTap(document)
                }
        }
        .listStyle(.plain)
    }
}

/// Single document row
struct DocumentRow: View {
    let document: Document

    var body: some View {
        HStack(spacing: 12) {
            // Document icon
            Image(systemName: documentIcon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 40, height: 40)
                .background(Color.accentColor.opacity(0.1))
                .cornerRadius(8)

            VStack(alignment: .leading, spacing: 4) {
                Text(document.title)
                    .font(.headline)
                    .lineLimit(1)

                Text(contentPreview)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                HStack {
                    Text("Updated \(document.updatedAt.relativeFormatted())")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if document.groupId != nil {
                        Label("Shared", systemImage: "person.2.fill")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var documentIcon: String {
        switch document.type {
        case .markdown:
            return "doc.text"
        case .plainText:
            return "doc.plaintext"
        case .richText:
            return "doc.richtext"
        }
    }

    private var contentPreview: String {
        let preview = document.content
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: "`", with: "")
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if preview.count > 100 {
            return String(preview.prefix(100)) + "..."
        }
        return preview
    }
}

/// Empty state view
struct EmptyDocumentsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "doc.text")
                .font(.system(size: 64))
                .foregroundColor(.accentColor)

            Text("No Documents")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Documents shared in your groups will appear here")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Spacer()
        }
    }
}

/// Date relative formatting extension
extension Date {
    func relativeFormatted() -> String {
        let now = Date()
        let diff = now.timeIntervalSince(self)

        if diff < 86400 {
            return "today"
        } else if diff < 172800 {
            return "yesterday"
        } else if diff < 604800 {
            return "\(Int(diff / 86400)) days ago"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: self)
        }
    }
}

#Preview {
    DocumentListView()
}
