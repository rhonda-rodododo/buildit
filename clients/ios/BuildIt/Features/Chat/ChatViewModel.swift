// ChatViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// View model for chat functionality handling conversations and messages.

import Foundation
import Combine
import os.log

/// View model for chat-related operations
@MainActor
class ChatViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var conversations: [Conversation] = []
    @Published var nearbyPeers: [MeshPeer] = []
    @Published var isLoading: Bool = false
    @Published var error: String?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "ChatViewModel")
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        setupObservers()
    }

    private func setupObservers() {
        // Listen for new messages
        NotificationCenter.default.publisher(for: .newMessageReceived)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.loadConversations()
            }
            .store(in: &cancellables)

        // Update nearby peers periodically
        Task {
            await updateNearbyPeers()
        }
    }

    // MARK: - Public Methods

    /// Load all conversations
    func loadConversations() {
        Task {
            isLoading = true
            conversations = await MessageQueue.shared.getConversations()
            isLoading = false
        }
    }

    /// Refresh conversations and check for new messages
    func refresh() async {
        loadConversations()
        await updateNearbyPeers()
    }

    /// Start a new conversation with a public key
    func startConversation(with publicKey: String) {
        let normalizedKey = normalizePublicKey(publicKey)

        Task {
            // Create conversation if doesn't exist
            await MessageQueue.shared.createConversation(with: normalizedKey)
            loadConversations()

            // Also add as contact
            let contact = Contact(publicKey: normalizedKey)
            Database.shared.saveContact(contact)
        }
    }

    /// Send a message to a recipient
    func sendMessage(_ content: String, to recipientPublicKey: String) async {
        do {
            try await TransportRouter.shared.sendMessage(
                content: content,
                to: recipientPublicKey,
                priority: .normal
            ) { [weak self] status in
                self?.handleDeliveryStatus(status, for: recipientPublicKey)
            }

            // Create local message for UI
            if let myPublicKey = await CryptoManager.shared.getPublicKeyHex() {
                let message = QueuedMessage(
                    id: UUID().uuidString,
                    content: content,
                    senderPublicKey: myPublicKey,
                    recipientPublicKey: recipientPublicKey,
                    timestamp: Date(),
                    eventId: nil
                )

                await MessageQueue.shared.enqueue(
                    content: content,
                    from: myPublicKey,
                    eventId: nil
                )
            }

            logger.info("Sent message to \(recipientPublicKey.prefix(8))")
        } catch {
            self.error = error.localizedDescription
            logger.error("Failed to send message: \(error.localizedDescription)")
        }
    }

    /// Mark a conversation as read
    func markAsRead(conversation: Conversation) {
        Task {
            await MessageQueue.shared.markAllAsRead(from: conversation.participantPublicKey)
            loadConversations()
        }
    }

    /// Delete conversations at indices
    func deleteConversations(at indexSet: IndexSet) {
        for index in indexSet {
            let conversation = conversations[index]
            // Delete messages for this conversation
            Database.shared.deleteMessages(with: conversation.participantPublicKey)
        }
        conversations.remove(atOffsets: indexSet)
    }

    /// Get messages for a specific conversation
    func getMessages(for publicKey: String) async -> [QueuedMessage] {
        await MessageQueue.shared.getMessages(for: publicKey)
    }

    // MARK: - Private Methods

    private func normalizePublicKey(_ input: String) -> String {
        // Handle npub format
        if input.hasPrefix("npub") {
            if let (hrp, data) = Bech32.decode(input), hrp == "npub" {
                return data.hexString
            }
        }

        // Already hex format
        return input.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func updateNearbyPeers() async {
        nearbyPeers = await MeshRouter.shared.getAllPeers()
    }

    private func handleDeliveryStatus(_ status: DeliveryStatus, for recipientPublicKey: String) {
        switch status {
        case .pending:
            logger.debug("Message pending for \(recipientPublicKey.prefix(8))")
        case .sending(let transport):
            logger.debug("Sending via \(transport.rawValue)")
        case .delivered(let transport):
            logger.info("Delivered via \(transport.rawValue)")
        case .failed(let error):
            logger.error("Delivery failed: \(error.localizedDescription)")
            self.error = "Message delivery failed: \(error.localizedDescription)"
        }
    }
}
