// FeedView.swift
// BuildIt - Decentralized Mesh Communication
//
// Social feed view showing posts from followed contacts.

import SwiftUI

/// Main social feed view
struct FeedView: View {
    @StateObject private var viewModel = SocialViewModel()
    @State private var showComposer = false
    @State private var selectedPost: SocialPost?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.posts.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    feedList
                }
            }
            .navigationTitle("Feed")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showComposer = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .refreshable {
                viewModel.refresh()
            }
            .sheet(isPresented: $showComposer) {
                PostComposerView(viewModel: viewModel)
            }
            .sheet(item: $selectedPost) { post in
                ThreadView(post: post, viewModel: viewModel)
            }
            .alert("Error", isPresented: .constant(viewModel.error != nil)) {
                Button("OK") {
                    viewModel.clearError()
                }
            } message: {
                if let error = viewModel.error {
                    Text(error)
                }
            }
        }
    }

    private var feedList: some View {
        List {
            ForEach(viewModel.posts) { post in
                PostRow(
                    post: post,
                    onTap: { selectedPost = post },
                    onReact: { viewModel.reactToPost(postId: post.id) },
                    onReply: { selectedPost = post }
                )
            }
        }
        .listStyle(.plain)
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Posts", systemImage: "text.bubble")
        } description: {
            Text("Follow people or create your first post")
        } actions: {
            Button("Create Post") {
                showComposer = true
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

/// Row view for a single post
struct PostRow: View {
    let post: SocialPost
    let onTap: () -> Void
    let onReact: () -> Void
    let onReply: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 12) {
                // Author row
                HStack(spacing: 10) {
                    CachedAvatarImage(
                        url: post.authorAvatar,
                        fallbackText: post.authorName ?? post.authorPubkey,
                        size: 40
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(post.authorName ?? String(post.authorPubkey.prefix(12)) + "...")
                            .font(.headline)
                            .lineLimit(1)

                        Text(post.createdAt.relativeFormatted())
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()
                }

                // Content
                Text(post.content)
                    .font(.body)
                    .multilineTextAlignment(.leading)
                    .lineLimit(10)

                // Actions
                HStack(spacing: 24) {
                    // Reply button
                    Button(action: onReply) {
                        HStack(spacing: 4) {
                            Image(systemName: "bubble.left")
                            if post.replyCount > 0 {
                                Text("\(post.replyCount)")
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)

                    // Repost button (placeholder)
                    Button {} label: {
                        Image(systemName: "arrow.2.squarepath")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)

                    // React button
                    Button(action: onReact) {
                        HStack(spacing: 4) {
                            Image(systemName: post.userReacted ? "heart.fill" : "heart")
                            if post.reactionCount > 0 {
                                Text("\(post.reactionCount)")
                            }
                        }
                        .font(.caption)
                        .foregroundColor(post.userReacted ? .red : .secondary)
                    }
                    .buttonStyle(.plain)

                    Spacer()
                }
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}

/// Extension for relative date formatting
extension Date {
    func relativeFormatted() -> String {
        let now = Date()
        let diff = now.timeIntervalSince(self)

        switch diff {
        case ..<60:
            return "now"
        case ..<3600:
            return "\(Int(diff / 60))m"
        case ..<86400:
            return "\(Int(diff / 3600))h"
        case ..<604800:
            return "\(Int(diff / 86400))d"
        default:
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: self)
        }
    }
}

#Preview {
    FeedView()
}
