// MessageQueue.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages message queue for outgoing and incoming messages.
// Handles persistence, ordering, and delivery tracking.

import Foundation
import Combine
import os.log

/// A queued message for storage and tracking
struct QueuedMessage: Codable, Identifiable {
    let id: String
    let content: String
    let senderPublicKey: String
    let recipientPublicKey: String?
    let timestamp: Date
    let eventId: String?  // Nostr event ID if applicable

    var isRead: Bool = false
    var isDelivered: Bool = false
    var deliveredAt: Date?
}

/// Conversation for grouping messages
struct Conversation: Identifiable {
    let id: String
    let participantPublicKey: String
    var participantName: String?
    var lastMessage: QueuedMessage?
    var unreadCount: Int = 0
    var messages: [QueuedMessage] = []
}

/// MessageQueue manages the message queue and conversation state
actor MessageQueue {
    // MARK: - Singleton

    static let shared = MessageQueue()

    // MARK: - Properties

    private var incomingMessages: [QueuedMessage] = []
    private var outgoingMessages: [RoutableMessage] = []
    private var conversations: [String: Conversation] = [:]
    private var deliveryCallbacks: [String: (Bool) -> Void] = [:]

    private let logger = Logger(subsystem: "com.buildit", category: "MessageQueue")

    /// Number of pending outgoing messages
    var pendingCount: Int {
        outgoingMessages.filter { !$0.delivered }.count
    }

    /// Total unread message count
    var unreadCount: Int {
        incomingMessages.filter { !$0.isRead }.count
    }

    // MARK: - Initialization

    private init() {
        Task {
            await loadFromDisk()
        }
    }

    // MARK: - Incoming Messages

    /// Enqueue an incoming message
    func enqueue(content: String, from senderPublicKey: String, eventId: String? = nil) {
        let message = QueuedMessage(
            id: UUID().uuidString,
            content: content,
            senderPublicKey: senderPublicKey,
            recipientPublicKey: nil,
            timestamp: Date(),
            eventId: eventId
        )

        incomingMessages.append(message)

        // Update conversation
        updateConversation(with: message, from: senderPublicKey)

        // Persist
        saveToDisk()

        // Post notification
        NotificationCenter.default.post(
            name: .newMessageReceived,
            object: nil,
            userInfo: ["message": message]
        )

        logger.info("Enqueued incoming message from: \(senderPublicKey.prefix(8))")
    }

    /// Get all incoming messages
    func getIncomingMessages() -> [QueuedMessage] {
        incomingMessages
    }

    /// Get unread messages
    func getUnreadMessages() -> [QueuedMessage] {
        incomingMessages.filter { !$0.isRead }
    }

    /// Mark a message as read
    func markAsRead(_ messageId: String) {
        if let index = incomingMessages.firstIndex(where: { $0.id == messageId }) {
            incomingMessages[index].isRead = true
            saveToDisk()
        }
    }

    /// Mark all messages from a sender as read
    func markAllAsRead(from senderPublicKey: String) {
        for index in incomingMessages.indices {
            if incomingMessages[index].senderPublicKey == senderPublicKey {
                incomingMessages[index].isRead = true
            }
        }

        if var conversation = conversations[senderPublicKey] {
            conversation.unreadCount = 0
            conversations[senderPublicKey] = conversation
        }

        saveToDisk()
    }

    // MARK: - Outgoing Messages

    /// Add an outgoing message to the queue
    func addOutgoing(_ message: RoutableMessage) {
        outgoingMessages.append(message)
        saveToDisk()
    }

    /// Mark an outgoing message as delivered
    func markDelivered(_ messageId: String) {
        if let index = outgoingMessages.firstIndex(where: { $0.id == messageId }) {
            outgoingMessages[index].delivered = true

            // Notify callback
            deliveryCallbacks[messageId]?(true)
            deliveryCallbacks.removeValue(forKey: messageId)

            saveToDisk()
        }
    }

    /// Confirm delivery (called by mesh router on ACK)
    func confirmDelivery(messageId: String) {
        markDelivered(messageId)
    }

    /// Get pending outgoing messages
    func getPendingOutgoing() -> [RoutableMessage] {
        outgoingMessages.filter { !$0.delivered }
    }

    /// Register a callback for delivery confirmation
    func onDelivery(_ messageId: String, callback: @escaping (Bool) -> Void) {
        deliveryCallbacks[messageId] = callback
    }

    // MARK: - Conversations

    /// Get all conversations
    func getConversations() -> [Conversation] {
        Array(conversations.values).sorted { ($0.lastMessage?.timestamp ?? .distantPast) > ($1.lastMessage?.timestamp ?? .distantPast) }
    }

    /// Get a specific conversation
    func getConversation(with publicKey: String) -> Conversation? {
        conversations[publicKey]
    }

    /// Get messages for a conversation
    func getMessages(for publicKey: String) -> [QueuedMessage] {
        incomingMessages.filter {
            $0.senderPublicKey == publicKey || $0.recipientPublicKey == publicKey
        }.sorted { $0.timestamp < $1.timestamp }
    }

    /// Create or update a conversation
    func createConversation(with publicKey: String, name: String? = nil) {
        if conversations[publicKey] == nil {
            conversations[publicKey] = Conversation(
                id: publicKey,
                participantPublicKey: publicKey,
                participantName: name
            )
        } else if let name = name {
            conversations[publicKey]?.participantName = name
        }
        saveToDisk()
    }

    // MARK: - Private Methods

    private func updateConversation(with message: QueuedMessage, from senderPublicKey: String) {
        var conversation = conversations[senderPublicKey] ?? Conversation(
            id: senderPublicKey,
            participantPublicKey: senderPublicKey
        )

        conversation.lastMessage = message
        conversation.unreadCount += 1
        conversation.messages.append(message)

        conversations[senderPublicKey] = conversation
    }

    // MARK: - Persistence

    private func saveToDisk() {
        // Save incoming messages
        if let incomingData = try? JSONEncoder().encode(incomingMessages) {
            let incomingURL = getDocumentsDirectory().appendingPathComponent("incoming_messages.json")
            try? incomingData.write(to: incomingURL)
        }

        // Save conversations (simplified, without messages)
        let conversationData = conversations.mapValues { ConversationMetadata(conversation: $0) }
        if let data = try? JSONEncoder().encode(conversationData) {
            let url = getDocumentsDirectory().appendingPathComponent("conversations.json")
            try? data.write(to: url)
        }
    }

    private func loadFromDisk() {
        // Load incoming messages
        let incomingURL = getDocumentsDirectory().appendingPathComponent("incoming_messages.json")
        if let data = try? Data(contentsOf: incomingURL),
           let messages = try? JSONDecoder().decode([QueuedMessage].self, from: data) {
            incomingMessages = messages
        }

        // Load conversations
        let conversationsURL = getDocumentsDirectory().appendingPathComponent("conversations.json")
        if let data = try? Data(contentsOf: conversationsURL),
           let metadata = try? JSONDecoder().decode([String: ConversationMetadata].self, from: data) {
            conversations = metadata.mapValues { $0.toConversation() }
        }

        // Rebuild conversation messages
        for message in incomingMessages {
            if var conversation = conversations[message.senderPublicKey] {
                conversation.messages.append(message)
                conversations[message.senderPublicKey] = conversation
            }
        }
    }

    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let newMessageReceived = Notification.Name("newMessageReceived")
    static let messageDelivered = Notification.Name("messageDelivered")
}

// MARK: - Conversation Metadata for Persistence

private struct ConversationMetadata: Codable {
    let id: String
    let participantPublicKey: String
    let participantName: String?
    let unreadCount: Int

    init(conversation: Conversation) {
        self.id = conversation.id
        self.participantPublicKey = conversation.participantPublicKey
        self.participantName = conversation.participantName
        self.unreadCount = conversation.unreadCount
    }

    func toConversation() -> Conversation {
        Conversation(
            id: id,
            participantPublicKey: participantPublicKey,
            participantName: participantName,
            unreadCount: unreadCount
        )
    }
}
