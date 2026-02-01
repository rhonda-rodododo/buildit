// PostComposerView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for composing new posts and replies.

import SwiftUI

/// View for composing a new post or reply
struct PostComposerView: View {
    @ObservedObject var viewModel: SocialViewModel
    var replyToPost: SocialPost? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var content = ""
    @FocusState private var isFocused: Bool
    @StateObject private var linkDetector = LinkPreviewDetector()

    private let maxLength = 1000

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Reply context
                if let replyTo = replyToPost {
                    replyContext(replyTo)
                }

                // Text editor
                TextEditor(text: $content)
                    .focused($isFocused)
                    .font(.body)
                    .padding()
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text(replyToPost != nil ? "Write your reply..." : "What's happening?")
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 24)
                                .allowsHitTesting(false)
                        }
                    }

                // Link previews
                if !linkDetector.previews.isEmpty || linkDetector.isLoading {
                    LinkPreviewStrip(
                        previews: linkDetector.previews,
                        isLoading: linkDetector.isLoading,
                        onRemove: { url in linkDetector.removePreview(url: url) }
                    )
                    .padding(.vertical, 8)
                }

                Divider()

                // Bottom toolbar
                HStack {
                    Button {
                        // Add image
                    } label: {
                        Image(systemName: "photo")
                    }

                    Spacer()

                    // Character count
                    Text("\(content.count)/\(maxLength)")
                        .font(.caption)
                        .foregroundColor(content.count > Int(Double(maxLength) * 0.9) ? .red : .secondary)
                }
                .padding()
            }
            .navigationTitle(replyToPost != nil ? "Reply" : "New Post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(viewModel.isPosting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        post()
                    } label: {
                        if viewModel.isPosting {
                            ProgressView()
                        } else {
                            Text(replyToPost != nil ? "Reply" : "Post")
                        }
                    }
                    .disabled(content.isEmpty || content.count > maxLength || viewModel.isPosting)
                }
            }
            .onAppear {
                isFocused = true
            }
            .onChange(of: content) { _, newValue in
                linkDetector.textDidChange(newValue)
            }
        }
    }

    private func replyContext(_ post: SocialPost) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Replying to")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("@\(post.authorName ?? String(post.authorPubkey.prefix(8)))")
                    .font(.caption)
                    .foregroundColor(.blue)
            }

            Text(post.content)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
    }

    private func post() {
        let previews = linkDetector.previews
        if let replyTo = replyToPost {
            viewModel.replyToPost(parentId: replyTo.id, content: content, linkPreviews: previews)
        } else {
            viewModel.createPost(content: content, linkPreviews: previews)
        }
        dismiss()
    }
}

#Preview {
    PostComposerView(viewModel: SocialViewModel())
}
