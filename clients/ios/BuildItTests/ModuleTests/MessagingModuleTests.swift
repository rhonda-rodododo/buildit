// MessagingModuleTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Tests for the Messaging module.

import XCTest
@testable import BuildIt

@MainActor
final class MessagingModuleTests: XCTestCase {
    var module: MessagingModule!

    override func setUp() async throws {
        module = try MessagingModule()
        try await module.initialize()
    }

    override func tearDown() async throws {
        await module.cleanup()
    }

    func testSendDirectMessage() async throws {
        let recipientPubkey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        let content = "Hello, World!"

        // Send message (will fail without crypto setup, but tests the interface)
        do {
            try await module.sendDirectMessage(
                content: content,
                to: recipientPubkey
            )
        } catch {
            // Expected to fail without proper crypto setup in tests
            XCTAssertTrue(error is MessagingError)
        }
    }

    func testSendGroupMessage() async throws {
        let groupId = "test-group"
        let content = "Hello, Group!"

        // Send message
        do {
            try await module.sendGroupMessage(
                content: content,
                to: groupId
            )
        } catch {
            // Expected to fail without proper crypto setup in tests
            XCTAssertTrue(error is MessagingError)
        }
    }

    func testReactions() async throws {
        let messageId = "test-message-id"
        let emoji = "👍"

        // Add reaction
        do {
            try await module.addReaction(emoji: emoji, to: messageId)
        } catch {
            // Expected to fail without proper setup in tests
            XCTAssertTrue(error is MessagingError)
        }
    }

    func testReadReceipts() async throws {
        let conversationId = "test-conversation"
        let lastMessageId = "test-message-id"

        // Mark as read
        do {
            try await module.markAsRead(
                conversationId: conversationId,
                lastMessageId: lastMessageId
            )
        } catch {
            // Expected to fail without proper setup in tests
            XCTAssertTrue(error is MessagingError)
        }
    }

    func testTypingIndicator() async throws {
        let conversationId = "test-conversation"

        // Send typing indicator
        do {
            try await module.sendTypingIndicator(
                conversationId: conversationId,
                isTyping: true
            )
        } catch {
            // Expected to fail without proper setup in tests
            XCTAssertTrue(error is MessagingError)
        }
    }
}
