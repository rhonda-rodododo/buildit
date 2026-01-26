// ThreadView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for displaying a post thread with replies.

import SwiftUI

/// View showing a post and its replies
struct ThreadView: View {
    let post: SocialPost
    @ObservedObject var viewModel: SocialViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var showReplyComposer = false
    @State private var isLoadingReplies = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Main post
                    mainPostView

                    Divider()
                        .padding(.vertical)

                    // Replies header
                    HStack {
                        Text("\(post.replies.count) \(post.replies.count == 1 ? "Reply" : "Replies")")
                            .font(.headline)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 12)

                    // Replies list
                    if isLoadingReplies {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                        .padding()
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(post.replies) { reply in
                                ReplyRow(reply: reply)
                            }
                        }
                        .padding(.horizontal)
                    }

                    Spacer(minLength: 100)
                }
            }
            .navigationTitle("Thread")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    showReplyComposer = true
                } label: {
                    Label("Reply", systemImage: "arrowshape.turn.up.left.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding()
                .background(.ultraThinMaterial)
            }
            .sheet(isPresented: $showReplyComposer) {
                PostComposerView(viewModel: viewModel, replyToPost: post)
            }
            .task {
                await loadReplies()
            }
        }
    }

    private var mainPostView: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Author row
            HStack(spacing: 12) {
                CachedAvatarImage(
                    url: post.authorAvatar,
                    fallbackText: post.authorName ?? post.authorPubkey,
                    size: 48
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text(post.authorName ?? String(post.authorPubkey.prefix(12)) + "...")
                        .font(.headline)

                    Text(post.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Content
            Text(post.content)
                .font(.body)

            // Stats
            HStack(spacing: 24) {
                // Replies
                HStack(spacing: 4) {
                    Image(systemName: "bubble.left")
                    Text("\(post.replyCount)")
                }
                .foregroundColor(.secondary)

                // Reactions
                Button {
                    viewModel.reactToPost(postId: post.id)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: post.userReacted ? "heart.fill" : "heart")
                        Text("\(post.reactionCount)")
                    }
                    .foregroundColor(post.userReacted ? .red : .secondary)
                }
                .buttonStyle(.plain)

                Spacer()
            }
            .font(.subheadline)
        }
        .padding()
    }

    private func loadReplies() async {
        isLoadingReplies = true
        await viewModel.loadReplies(postId: post.id)
        isLoadingReplies = false
    }
}

/// Row view for a reply
struct ReplyRow: View {
    let reply: SocialPost

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            CachedAvatarImage(
                url: reply.authorAvatar,
                fallbackText: reply.authorName ?? reply.authorPubkey,
                size: 32
            )

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(reply.authorName ?? String(reply.authorPubkey.prefix(8)) + "...")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Text(reply.createdAt.relativeFormatted())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text(reply.content)
                    .font(.body)
            }

            Spacer()
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

#Preview {
    ThreadView(
        post: SocialPost(
            id: "1",
            content: "This is a sample post with some interesting content.",
            authorPubkey: "abc123",
            authorName: "Alice",
            authorAvatar: nil,
            createdAt: Date(),
            replyToId: nil,
            reactionCount: 5,
            replyCount: 2,
            userReacted: false,
            replies: []
        ),
        viewModel: SocialViewModel()
    )
}
