// MessageQueueTests.swift
// BuildItTests
//
// Unit tests for message queue persistence and operations

import XCTest
@testable import BuildIt

final class MessageQueueTests: XCTestCase {

    // MARK: - QueuedMessage Tests

    func testQueuedMessageCreation() {
        // Given: Message parameters
        let id = UUID().uuidString
        let content = TestFixtures.testMessageContent
        let sender = TestFixtures.testPublicKeyHex
        let recipient = TestFixtures.testPublicKeyHex2

        // When: Creating queued message
        let message = QueuedMessage(
            id: id,
            content: content,
            senderPublicKey: sender,
            recipientPublicKey: recipient,
            timestamp: Date(),
            eventId: TestFixtures.testEventId
        )

        // Then: Properties should be set
        XCTAssertEqual(message.id, id)
        XCTAssertEqual(message.content, content)
        XCTAssertEqual(message.senderPublicKey, sender)
        XCTAssertEqual(message.recipientPublicKey, recipient)
        XCTAssertEqual(message.eventId, TestFixtures.testEventId)
        XCTAssertFalse(message.isRead)
        XCTAssertFalse(message.isDelivered)
    }

    func testQueuedMessageWithNilRecipient() {
        // Given: A broadcast message (no recipient)
        let message = QueuedMessage(
            id: UUID().uuidString,
            content: "Broadcast",
            senderPublicKey: TestFixtures.testPublicKeyHex,
            recipientPublicKey: nil,
            timestamp: Date(),
            eventId: nil
        )

        // Then: Recipient and event ID should be nil
        XCTAssertNil(message.recipientPublicKey)
        XCTAssertNil(message.eventId)
    }

    func testQueuedMessageCodable() throws {
        // Given: A queued message
        var message = TestFixtures.createTestQueuedMessage()
        message.isRead = true
        message.isDelivered = true
        message.deliveredAt = Date()

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(QueuedMessage.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.id, message.id)
        XCTAssertEqual(decoded.content, message.content)
        XCTAssertEqual(decoded.isRead, message.isRead)
        XCTAssertEqual(decoded.isDelivered, message.isDelivered)
    }

    // MARK: - Conversation Tests

    func testConversationCreation() {
        // Given: Conversation parameters
        let participantPublicKey = TestFixtures.testPublicKeyHex

        // When: Creating conversation
        let conversation = Conversation(
            id: participantPublicKey,
            participantPublicKey: participantPublicKey,
            participantName: "Test User"
        )

        // Then: Properties should be set
        XCTAssertEqual(conversation.id, participantPublicKey)
        XCTAssertEqual(conversation.participantPublicKey, participantPublicKey)
        XCTAssertEqual(conversation.participantName, "Test User")
        XCTAssertEqual(conversation.unreadCount, 0)
        XCTAssertTrue(conversation.messages.isEmpty)
    }

    func testConversationIdentifiable() {
        // Given: A conversation
        let conversation = Conversation(
            id: TestFixtures.testPublicKeyHex,
            participantPublicKey: TestFixtures.testPublicKeyHex
        )

        // Then: Should conform to Identifiable
        XCTAssertEqual(conversation.id, TestFixtures.testPublicKeyHex)
    }

    // MARK: - In-Memory Queue Operations Tests

    func testIncomingMessageEnqueue() {
        // Given: In-memory incoming queue
        var incomingMessages: [QueuedMessage] = []

        // When: Enqueuing message
        let message = TestFixtures.createTestQueuedMessage()
        incomingMessages.append(message)

        // Then: Should be in queue
        XCTAssertEqual(incomingMessages.count, 1)
        XCTAssertEqual(incomingMessages.first?.id, message.id)
    }

    func testIncomingMessagesOrdering() {
        // Given: Messages added at different times
        var incomingMessages: [QueuedMessage] = []

        for i in 1...5 {
            let message = QueuedMessage(
                id: "msg\(i)",
                content: "Message \(i)",
                senderPublicKey: TestFixtures.testPublicKeyHex,
                recipientPublicKey: nil,
                timestamp: Date().addingTimeInterval(TimeInterval(i)),
                eventId: nil
            )
            incomingMessages.append(message)
        }

        // When: Sorting by timestamp
        let sorted = incomingMessages.sorted { $0.timestamp < $1.timestamp }

        // Then: Should be in chronological order
        XCTAssertEqual(sorted.first?.id, "msg1")
        XCTAssertEqual(sorted.last?.id, "msg5")
    }

    func testGetUnreadMessages() {
        // Given: Mix of read and unread messages
        var incomingMessages: [QueuedMessage] = []

        for i in 1...5 {
            var message = TestFixtures.createTestQueuedMessage(id: "msg\(i)")
            message.isRead = i % 2 == 0
            incomingMessages.append(message)
        }

        // When: Filtering unread
        let unread = incomingMessages.filter { !$0.isRead }

        // Then: Should only return unread
        XCTAssertEqual(unread.count, 3) // 1, 3, 5 are unread
    }

    func testMarkAsRead() {
        // Given: An unread message
        var incomingMessages: [QueuedMessage] = []
        var message = TestFixtures.createTestQueuedMessage()
        incomingMessages.append(message)

        // When: Marking as read
        if let index = incomingMessages.firstIndex(where: { $0.id == message.id }) {
            incomingMessages[index].isRead = true
        }

        // Then: Should be marked
        XCTAssertTrue(incomingMessages.first?.isRead == true)
    }

    func testMarkAllAsReadFromSender() {
        // Given: Multiple messages from same sender
        var incomingMessages: [QueuedMessage] = []
        let sender = TestFixtures.testPublicKeyHex

        for i in 1...5 {
            let message = TestFixtures.createTestQueuedMessage(
                id: "msg\(i)",
                senderPublicKey: sender
            )
            incomingMessages.append(message)
        }

        // When: Marking all as read from sender
        for index in incomingMessages.indices {
            if incomingMessages[index].senderPublicKey == sender {
                incomingMessages[index].isRead = true
            }
        }

        // Then: All should be read
        let unread = incomingMessages.filter { !$0.isRead && $0.senderPublicKey == sender }
        XCTAssertEqual(unread.count, 0)
    }

    // MARK: - Outgoing Queue Tests

    func testOutgoingMessageAdd() {
        // Given: In-memory outgoing queue
        var outgoingMessages: [RoutableMessage] = []

        // When: Adding message
        let message = TestFixtures.createTestRoutableMessage()
        outgoingMessages.append(message)

        // Then: Should be in queue
        XCTAssertEqual(outgoingMessages.count, 1)
    }

    func testOutgoingMessageDelivered() {
        // Given: An outgoing message
        var outgoingMessages: [RoutableMessage] = []
        var message = TestFixtures.createTestRoutableMessage()
        outgoingMessages.append(message)

        // When: Marking as delivered
        if let index = outgoingMessages.firstIndex(where: { $0.id == message.id }) {
            outgoingMessages[index].delivered = true
        }

        // Then: Should be marked
        XCTAssertTrue(outgoingMessages.first?.delivered == true)
    }

    func testGetPendingOutgoing() {
        // Given: Mix of delivered and pending messages
        var outgoingMessages: [RoutableMessage] = []

        for i in 1...5 {
            var message = TestFixtures.createTestRoutableMessage(id: "msg\(i)")
            message.delivered = i % 2 == 0
            outgoingMessages.append(message)
        }

        // When: Filtering pending
        let pending = outgoingMessages.filter { !$0.delivered }

        // Then: Should only return pending
        XCTAssertEqual(pending.count, 3)
    }

    func testPendingCount() {
        // Given: Outgoing messages with some delivered
        var outgoingMessages: [RoutableMessage] = []

        for i in 1...10 {
            var message = TestFixtures.createTestRoutableMessage(id: "msg\(i)")
            message.delivered = i <= 6 // First 6 delivered
            outgoingMessages.append(message)
        }

        // When: Counting pending
        let pendingCount = outgoingMessages.filter { !$0.delivered }.count

        // Then: Should be 4
        XCTAssertEqual(pendingCount, 4)
    }

    // MARK: - Conversation Management Tests

    func testConversationCreationOrUpdate() {
        // Given: In-memory conversations
        var conversations: [String: Conversation] = [:]
        let publicKey = TestFixtures.testPublicKeyHex

        // When: Creating new conversation
        if conversations[publicKey] == nil {
            conversations[publicKey] = Conversation(
                id: publicKey,
                participantPublicKey: publicKey,
                participantName: "New User"
            )
        }

        // Then: Should exist
        XCTAssertNotNil(conversations[publicKey])
        XCTAssertEqual(conversations[publicKey]?.participantName, "New User")

        // When: Updating name
        conversations[publicKey]?.participantName = "Updated User"

        // Then: Should be updated
        XCTAssertEqual(conversations[publicKey]?.participantName, "Updated User")
    }

    func testConversationUnreadCount() {
        // Given: A conversation with messages
        var conversations: [String: Conversation] = [:]
        let publicKey = TestFixtures.testPublicKeyHex

        conversations[publicKey] = Conversation(
            id: publicKey,
            participantPublicKey: publicKey,
            unreadCount: 0
        )

        // When: Receiving messages
        for _ in 1...5 {
            conversations[publicKey]?.unreadCount += 1
        }

        // Then: Unread count should be 5
        XCTAssertEqual(conversations[publicKey]?.unreadCount, 5)

        // When: Marking all as read
        conversations[publicKey]?.unreadCount = 0

        // Then: Should be 0
        XCTAssertEqual(conversations[publicKey]?.unreadCount, 0)
    }

    func testGetConversationsSortedByLastMessage() {
        // Given: Conversations with different last message times
        var conversations: [String: Conversation] = [:]
        let now = Date()

        for i in 1...3 {
            var conversation = Conversation(
                id: "user\(i)",
                participantPublicKey: "pubkey\(i)"
            )
            let message = QueuedMessage(
                id: "msg\(i)",
                content: "Message \(i)",
                senderPublicKey: "pubkey\(i)",
                recipientPublicKey: nil,
                timestamp: now.addingTimeInterval(TimeInterval(i * 60)),
                eventId: nil
            )
            conversation.lastMessage = message
            conversations["user\(i)"] = conversation
        }

        // When: Sorting by last message timestamp
        let sorted = Array(conversations.values).sorted {
            ($0.lastMessage?.timestamp ?? .distantPast) > ($1.lastMessage?.timestamp ?? .distantPast)
        }

        // Then: Most recent should be first
        XCTAssertEqual(sorted.first?.id, "user3")
        XCTAssertEqual(sorted.last?.id, "user1")
    }

    func testGetMessagesForConversation() {
        // Given: Messages from multiple senders
        var incomingMessages: [QueuedMessage] = []
        let targetSender = TestFixtures.testPublicKeyHex

        // Add messages from target sender
        for i in 1...3 {
            let message = TestFixtures.createTestQueuedMessage(
                id: "target\(i)",
                senderPublicKey: targetSender
            )
            incomingMessages.append(message)
        }

        // Add messages from other sender
        for i in 1...2 {
            let message = TestFixtures.createTestQueuedMessage(
                id: "other\(i)",
                senderPublicKey: TestFixtures.testPublicKeyHex2
            )
            incomingMessages.append(message)
        }

        // When: Filtering for conversation
        let conversationMessages = incomingMessages.filter {
            $0.senderPublicKey == targetSender || $0.recipientPublicKey == targetSender
        }

        // Then: Should only include target sender's messages
        XCTAssertEqual(conversationMessages.count, 3)
    }

    // MARK: - Delivery Confirmation Tests

    func testDeliveryConfirmation() {
        // Given: An outgoing message with callback
        var outgoingMessages: [RoutableMessage] = []
        var deliveryCallbacks: [String: (Bool) -> Void] = [:]
        var deliveryConfirmed = false

        let message = TestFixtures.createTestRoutableMessage()
        outgoingMessages.append(message)
        deliveryCallbacks[message.id] = { success in
            deliveryConfirmed = success
        }

        // When: Confirming delivery
        if let index = outgoingMessages.firstIndex(where: { $0.id == message.id }) {
            outgoingMessages[index].delivered = true
            deliveryCallbacks[message.id]?(true)
            deliveryCallbacks.removeValue(forKey: message.id)
        }

        // Then: Callback should be invoked
        XCTAssertTrue(deliveryConfirmed)
        XCTAssertNil(deliveryCallbacks[message.id])
    }

    // MARK: - RoutableMessage Tests

    func testRoutableMessageCreation() {
        // Given: Message parameters
        let message = RoutableMessage(
            id: UUID().uuidString,
            content: TestFixtures.testMessageData,
            recipientPublicKey: TestFixtures.testPublicKeyHex,
            senderPublicKey: TestFixtures.testPublicKeyHex2,
            timestamp: Date(),
            priority: .high,
            preferredTransport: .nostr
        )

        // Then: Properties should be set
        XCTAssertEqual(message.priority, .high)
        XCTAssertEqual(message.preferredTransport, .nostr)
        XCTAssertFalse(message.delivered)
        XCTAssertEqual(message.attempts, 0)
    }

    func testRoutableMessagePriority() {
        // Test priority comparison
        XCTAssertTrue(MessagePriority.low < MessagePriority.normal)
        XCTAssertTrue(MessagePriority.normal < MessagePriority.high)
        XCTAssertTrue(MessagePriority.high < MessagePriority.urgent)
    }

    func testRoutableMessageAttemptTracking() {
        // Given: An outgoing message
        var message = TestFixtures.createTestRoutableMessage()
        XCTAssertEqual(message.attempts, 0)

        // When: Recording attempts
        message.attempts += 1
        message.lastAttempt = Date()

        // Then: Should track attempts
        XCTAssertEqual(message.attempts, 1)
        XCTAssertNotNil(message.lastAttempt)
    }

    // MARK: - Notification Name Tests

    func testNotificationNames() {
        // Verify notification names are defined
        XCTAssertEqual(Notification.Name.newMessageReceived.rawValue, "newMessageReceived")
        XCTAssertEqual(Notification.Name.messageDelivered.rawValue, "messageDelivered")
    }

    // MARK: - TransportType Tests

    func testTransportTypeValues() {
        XCTAssertEqual(TransportType.ble.rawValue, "BLE Mesh")
        XCTAssertEqual(TransportType.nostr.rawValue, "Nostr")
        XCTAssertEqual(TransportType.both.rawValue, "Both")
    }

    func testTransportTypeCaseIterable() {
        let allCases = TransportType.allCases
        XCTAssertEqual(allCases.count, 3)
        XCTAssertTrue(allCases.contains(.ble))
        XCTAssertTrue(allCases.contains(.nostr))
        XCTAssertTrue(allCases.contains(.both))
    }

    // MARK: - MessagePriority Tests

    func testMessagePriorityRawValues() {
        XCTAssertEqual(MessagePriority.low.rawValue, 0)
        XCTAssertEqual(MessagePriority.normal.rawValue, 1)
        XCTAssertEqual(MessagePriority.high.rawValue, 2)
        XCTAssertEqual(MessagePriority.urgent.rawValue, 3)
    }

    func testMessagePriorityComparable() {
        // Test Comparable conformance
        let priorities: [MessagePriority] = [.urgent, .low, .high, .normal]
        let sorted = priorities.sorted()

        XCTAssertEqual(sorted, [.low, .normal, .high, .urgent])
    }

    // MARK: - DeliveryStatus Tests

    func testDeliveryStatusCases() {
        // Test all delivery status cases
        let pending: DeliveryStatus = .pending
        let sending: DeliveryStatus = .sending(transport: .nostr)
        let delivered: DeliveryStatus = .delivered(transport: .ble)
        let failed: DeliveryStatus = .failed(error: TransportError.peerNotFound)

        // Verify cases can be created
        if case .pending = pending { } else { XCTFail("Should be pending") }
        if case .sending(let transport) = sending { XCTAssertEqual(transport, .nostr) } else { XCTFail("Should be sending") }
        if case .delivered(let transport) = delivered { XCTAssertEqual(transport, .ble) } else { XCTFail("Should be delivered") }
        if case .failed = failed { } else { XCTFail("Should be failed") }
    }

    // MARK: - TransportError Tests

    func testTransportErrorDescriptions() {
        let errors: [TransportError] = [
            .noKeyPair,
            .bleNotAvailable,
            .nostrNotAvailable,
            .peerNotFound,
            .invalidContent,
            .allTransportsFailed
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }
}
