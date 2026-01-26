// SocialViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// ViewModel for social features (feed, posts, reactions).

import Foundation
import Combine
import os.log

/// Post model representing a kind 1 Nostr event
struct SocialPost: Identifiable, Equatable {
    let id: String
    let content: String
    let authorPubkey: String
    var authorName: String?
    var authorAvatar: String?
    let createdAt: Date
    let replyToId: String?
    var reactionCount: Int
    var replyCount: Int
    var userReacted: Bool
    var replies: [SocialPost]

    static func == (lhs: SocialPost, rhs: SocialPost) -> Bool {
        lhs.id == rhs.id
    }
}

/// ViewModel for social features
@MainActor
class SocialViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var posts: [SocialPost] = []
    @Published var isLoading = false
    @Published var isPosting = false
    @Published var error: String?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "SocialViewModel")
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        loadFeed()
    }

    // MARK: - Public Methods

    /// Loads the activity feed from followed contacts
    func loadFeed() {
        Task {
            isLoading = true
            defer { isLoading = false }

            do {
                // Get followed contacts
                let contacts = Database.shared.getAllContacts()
                let pubkeys = contacts.map { $0.publicKey }

                // Subscribe to kind 1 events from contacts
                let events = try await NostrClient.shared.subscribeToKind1(authors: pubkeys)

                // Convert events to posts
                var newPosts: [SocialPost] = []
                for event in events {
                    if let post = await eventToPost(event) {
                        newPosts.append(post)
                    }
                }

                // Sort by date descending
                newPosts.sort { $0.createdAt > $1.createdAt }

                // Keep last 100 posts
                posts = Array(newPosts.prefix(100))

                logger.info("Loaded \(self.posts.count) posts")
            } catch {
                self.error = error.localizedDescription
                logger.error("Failed to load feed: \(error.localizedDescription)")
            }
        }
    }

    /// Creates a new post (NIP-01 kind 1 event)
    func createPost(content: String) {
        Task {
            isPosting = true
            defer { isPosting = false }

            do {
                let event = try await NostrClient.shared.createKind1Event(content: content)
                try await NostrClient.shared.publishEvent(event)

                // Add to local feed
                if let post = await eventToPost(event) {
                    posts.insert(post, at: 0)
                }

                logger.info("Created new post")
            } catch {
                self.error = error.localizedDescription
                logger.error("Failed to create post: \(error.localizedDescription)")
            }
        }
    }

    /// Creates a reply to a post
    func replyToPost(parentId: String, content: String) {
        Task {
            isPosting = true
            defer { isPosting = false }

            do {
                let event = try await NostrClient.shared.createReplyEvent(
                    content: content,
                    replyTo: parentId
                )
                try await NostrClient.shared.publishEvent(event)

                // Reload replies
                await loadReplies(postId: parentId)

                logger.info("Created reply to post \(parentId)")
            } catch {
                self.error = error.localizedDescription
                logger.error("Failed to create reply: \(error.localizedDescription)")
            }
        }
    }

    /// Reacts to a post (NIP-25 kind 7 event)
    func reactToPost(postId: String, emoji: String = "+") {
        Task {
            do {
                let event = try await NostrClient.shared.createReactionEvent(
                    postId: postId,
                    emoji: emoji
                )
                try await NostrClient.shared.publishEvent(event)

                // Update local reaction count
                if let index = posts.firstIndex(where: { $0.id == postId }) {
                    posts[index].reactionCount += 1
                    posts[index].userReacted = true
                }

                logger.info("Reacted to post \(postId)")
            } catch {
                self.error = error.localizedDescription
                logger.error("Failed to react: \(error.localizedDescription)")
            }
        }
    }

    /// Loads replies to a specific post
    func loadReplies(postId: String) async {
        do {
            let replyEvents = try await NostrClient.shared.subscribeToReplies(eventId: postId)

            var replies: [SocialPost] = []
            for event in replyEvents {
                if let reply = await eventToPost(event) {
                    replies.append(reply)
                }
            }

            // Sort by date ascending (oldest first)
            replies.sort { $0.createdAt < $1.createdAt }

            // Update the post's replies
            if let index = posts.firstIndex(where: { $0.id == postId }) {
                posts[index].replies = replies
                posts[index].replyCount = replies.count
            }

            logger.info("Loaded \(replies.count) replies for post \(postId)")
        } catch {
            self.error = error.localizedDescription
            logger.error("Failed to load replies: \(error.localizedDescription)")
        }
    }

    /// Refreshes the feed
    func refresh() {
        posts.removeAll()
        loadFeed()
    }

    /// Clears error state
    func clearError() {
        error = nil
    }

    // MARK: - Private Methods

    /// Converts a Nostr event to a SocialPost
    private func eventToPost(_ event: NostrEvent) async -> SocialPost? {
        guard event.kind == 1 else { return nil }

        let contact = Database.shared.getContact(publicKey: event.pubkey)

        return SocialPost(
            id: event.id,
            content: event.content,
            authorPubkey: event.pubkey,
            authorName: contact?.name,
            authorAvatar: contact?.avatarURL,
            createdAt: Date(timeIntervalSince1970: Double(event.createdAt)),
            replyToId: event.tags.first { $0.first == "e" }?[safe: 1],
            reactionCount: 0,
            replyCount: 0,
            userReacted: false,
            replies: []
        )
    }
}

// MARK: - Array Extension

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Nostr Event Type (placeholder - should use actual implementation)

struct NostrEvent: Codable {
    let id: String
    let pubkey: String
    let createdAt: Int64
    let kind: Int
    let content: String
    let tags: [[String]]
    let sig: String
}
