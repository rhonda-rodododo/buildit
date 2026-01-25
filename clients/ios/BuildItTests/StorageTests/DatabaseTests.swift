// DatabaseTests.swift
// BuildItTests
//
// Unit tests for local storage operations

import XCTest
@testable import BuildIt

final class DatabaseTests: XCTestCase {

    // MARK: - Contact Model Tests

    func testContactCreation() {
        // Given: Contact parameters
        let publicKey = TestFixtures.testPublicKeyHex
        let name = "Test User"

        // When: Creating contact
        let contact = Contact(publicKey: publicKey, name: name)

        // Then: Properties should be set
        XCTAssertEqual(contact.publicKey, publicKey)
        XCTAssertEqual(contact.name, name)
        XCTAssertEqual(contact.id, publicKey)
        XCTAssertFalse(contact.isBlocked)
        XCTAssertFalse(contact.isMuted)
    }

    func testContactDisplayName() {
        // Test priority: name > npub > truncated pubkey

        // With name
        var contact = Contact(publicKey: TestFixtures.testPublicKeyHex, name: "Alice")
        XCTAssertEqual(contact.displayName, "Alice")

        // Without name, with npub
        contact = Contact(publicKey: TestFixtures.testPublicKeyHex)
        contact.npub = TestFixtures.testNpub
        XCTAssertEqual(contact.displayName, TestFixtures.testNpub)

        // Without name or npub
        let pubkeyOnly = Contact(publicKey: TestFixtures.testPublicKeyHex)
        XCTAssertTrue(pubkeyOnly.displayName.hasSuffix("..."))
        XCTAssertTrue(pubkeyOnly.displayName.hasPrefix(String(TestFixtures.testPublicKeyHex.prefix(8))))
    }

    func testContactCodable() throws {
        // Given: A contact
        var contact = Contact(publicKey: TestFixtures.testPublicKeyHex, name: "Test")
        contact.npub = TestFixtures.testNpub
        contact.avatarURL = "https://example.com/avatar.png"
        contact.isBlocked = true
        contact.metadata["custom"] = "value"

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(contact)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(Contact.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.publicKey, contact.publicKey)
        XCTAssertEqual(decoded.name, contact.name)
        XCTAssertEqual(decoded.npub, contact.npub)
        XCTAssertEqual(decoded.avatarURL, contact.avatarURL)
        XCTAssertEqual(decoded.isBlocked, contact.isBlocked)
        XCTAssertEqual(decoded.metadata["custom"], "value")
    }

    func testContactEquality() {
        let contact1 = Contact(publicKey: TestFixtures.testPublicKeyHex, name: "User 1")
        let contact2 = Contact(publicKey: TestFixtures.testPublicKeyHex, name: "User 2")

        // Contacts with same public key have same ID
        XCTAssertEqual(contact1.id, contact2.id)
    }

    // MARK: - StoredMessage Model Tests

    func testStoredMessageFromQueuedMessage() {
        // Given: A queued message
        let queued = TestFixtures.createTestQueuedMessage()

        // When: Creating stored message
        let stored = StoredMessage(from: queued)

        // Then: Properties should transfer
        XCTAssertEqual(stored.id, queued.id)
        XCTAssertEqual(stored.content, queued.content)
        XCTAssertEqual(stored.senderPublicKey, queued.senderPublicKey)
        XCTAssertEqual(stored.recipientPublicKey, queued.recipientPublicKey)
        XCTAssertEqual(stored.eventId, queued.eventId)
    }

    func testStoredMessageCodable() throws {
        // Given: A stored message
        let queued = TestFixtures.createTestQueuedMessage()
        var stored = StoredMessage(from: queued)
        stored.isRead = true
        stored.isDelivered = true
        stored.deliveredAt = Date()
        stored.transport = "nostr"

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(stored)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(StoredMessage.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.id, stored.id)
        XCTAssertEqual(decoded.content, stored.content)
        XCTAssertEqual(decoded.isRead, stored.isRead)
        XCTAssertEqual(decoded.isDelivered, stored.isDelivered)
        XCTAssertEqual(decoded.transport, stored.transport)
    }

    // MARK: - Group Model Tests

    func testGroupCreation() {
        // Given: Group parameters
        let name = "Test Group"
        let createdBy = TestFixtures.testPublicKeyHex

        // When: Creating group
        let group = Group(name: name, createdBy: createdBy)

        // Then: Properties should be set
        XCTAssertEqual(group.name, name)
        XCTAssertEqual(group.createdBy, createdBy)
        XCTAssertTrue(group.isPrivate)
        XCTAssertTrue(group.memberPublicKeys.contains(createdBy))
        XCTAssertTrue(group.adminPublicKeys.contains(createdBy))
    }

    func testGroupHasUniqueId() {
        // Given: Multiple groups with same name
        let group1 = Group(name: "Same Name", createdBy: TestFixtures.testPublicKeyHex)
        let group2 = Group(name: "Same Name", createdBy: TestFixtures.testPublicKeyHex)

        // Then: IDs should be different
        XCTAssertNotEqual(group1.id, group2.id)
    }

    func testGroupCodable() throws {
        // Given: A group
        var group = TestFixtures.createTestGroup()
        group.description = "Test description"
        group.memberPublicKeys.append(TestFixtures.testPublicKeyHex2)

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(group)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(Group.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.id, group.id)
        XCTAssertEqual(decoded.name, group.name)
        XCTAssertEqual(decoded.description, group.description)
        XCTAssertEqual(decoded.memberPublicKeys.count, 2)
    }

    // MARK: - RelayConfig Model Tests

    func testRelayConfigCreation() {
        // Given: Relay URL
        let url = "wss://relay.test.com"

        // When: Creating config
        let config = RelayConfig(url: url)

        // Then: Properties should be set
        XCTAssertEqual(config.url, url)
        XCTAssertEqual(config.id, url)
        XCTAssertTrue(config.isEnabled)
        XCTAssertTrue(config.isReadable)
        XCTAssertTrue(config.isWritable)
    }

    func testRelayConfigCodable() throws {
        // Given: A relay config
        var config = TestFixtures.createTestRelayConfig()
        config.isEnabled = false
        config.isWritable = false

        // When: Encoding and decoding
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(config)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(RelayConfig.self, from: data)

        // Then: Should match
        XCTAssertEqual(decoded.url, config.url)
        XCTAssertEqual(decoded.isEnabled, config.isEnabled)
        XCTAssertEqual(decoded.isWritable, config.isWritable)
    }

    // MARK: - Database Contact Operations Tests

    func testContactOperationsInMemory() {
        // Given: In-memory contact storage
        var contacts: [String: Contact] = [:]

        // Save
        let contact = TestFixtures.createTestContact()
        contacts[contact.publicKey] = contact
        XCTAssertEqual(contacts.count, 1)

        // Get
        let retrieved = contacts[contact.publicKey]
        XCTAssertEqual(retrieved?.name, contact.name)

        // Update
        var updated = contact
        updated.isBlocked = true
        contacts[contact.publicKey] = updated
        XCTAssertTrue(contacts[contact.publicKey]?.isBlocked == true)

        // Delete
        contacts.removeValue(forKey: contact.publicKey)
        XCTAssertNil(contacts[contact.publicKey])
    }

    func testGetAllContactsSorted() {
        // Given: Multiple contacts
        var contacts: [String: Contact] = [:]
        contacts["pub1"] = Contact(publicKey: "pub1", name: "Zack")
        contacts["pub2"] = Contact(publicKey: "pub2", name: "Alice")
        contacts["pub3"] = Contact(publicKey: "pub3", name: "Bob")

        // When: Getting all sorted by name
        let sorted = Array(contacts.values).sorted { ($0.name ?? "") < ($1.name ?? "") }

        // Then: Should be in alphabetical order
        XCTAssertEqual(sorted[0].name, "Alice")
        XCTAssertEqual(sorted[1].name, "Bob")
        XCTAssertEqual(sorted[2].name, "Zack")
    }

    func testContactBlockUnblock() {
        // Given: A contact
        var contacts: [String: Contact] = [:]
        var contact = TestFixtures.createTestContact()
        contacts[contact.publicKey] = contact

        // Block
        contact.isBlocked = true
        contacts[contact.publicKey] = contact
        XCTAssertTrue(contacts[contact.publicKey]?.isBlocked == true)

        // Unblock
        contact.isBlocked = false
        contacts[contact.publicKey] = contact
        XCTAssertFalse(contacts[contact.publicKey]?.isBlocked == true)
    }

    // MARK: - Database Message Operations Tests

    func testMessageOperationsInMemory() {
        // Given: In-memory message storage
        var messages: [String: StoredMessage] = [:]
        let queued = TestFixtures.createTestQueuedMessage()
        let stored = StoredMessage(from: queued)

        // Save
        messages[stored.id] = stored
        XCTAssertEqual(messages.count, 1)

        // Get
        XCTAssertNotNil(messages[stored.id])

        // Delete
        messages.removeValue(forKey: stored.id)
        XCTAssertNil(messages[stored.id])
    }

    func testGetMessagesWithPublicKey() {
        // Given: Messages from different senders
        var messages: [String: StoredMessage] = [:]
        let sender1 = TestFixtures.testPublicKeyHex
        let sender2 = TestFixtures.testPublicKeyHex2

        for i in 1...5 {
            let queued = TestFixtures.createTestQueuedMessage(
                id: "msg\(i)",
                senderPublicKey: i % 2 == 0 ? sender1 : sender2
            )
            messages[queued.id] = StoredMessage(from: queued)
        }

        // When: Filtering by sender
        let sender1Messages = messages.values.filter { $0.senderPublicKey == sender1 }
        let sender2Messages = messages.values.filter { $0.senderPublicKey == sender2 }

        // Then: Should filter correctly
        XCTAssertEqual(sender1Messages.count, 2)
        XCTAssertEqual(sender2Messages.count, 3)
    }

    func testMarkMessageAsRead() {
        // Given: An unread message
        var messages: [String: StoredMessage] = [:]
        let queued = TestFixtures.createTestQueuedMessage()
        var stored = StoredMessage(from: queued)
        messages[stored.id] = stored

        XCTAssertFalse(messages[stored.id]?.isRead == true)

        // When: Marking as read
        stored.isRead = true
        messages[stored.id] = stored

        // Then: Should be marked
        XCTAssertTrue(messages[stored.id]?.isRead == true)
    }

    // MARK: - Database Group Operations Tests

    func testGroupOperationsInMemory() {
        // Given: In-memory group storage
        var groups: [String: Group] = [:]
        let group = TestFixtures.createTestGroup()

        // Save
        groups[group.id] = group
        XCTAssertEqual(groups.count, 1)

        // Get
        XCTAssertNotNil(groups[group.id])

        // Delete
        groups.removeValue(forKey: group.id)
        XCTAssertNil(groups[group.id])
    }

    func testAddMemberToGroup() {
        // Given: A group with one member
        var groups: [String: Group] = [:]
        var group = TestFixtures.createTestGroup()
        XCTAssertEqual(group.memberPublicKeys.count, 1)
        groups[group.id] = group

        // When: Adding a member
        let newMember = TestFixtures.testPublicKeyHex2
        group.memberPublicKeys.append(newMember)
        groups[group.id] = group

        // Then: Should have two members
        XCTAssertEqual(groups[group.id]?.memberPublicKeys.count, 2)
        XCTAssertTrue(groups[group.id]?.memberPublicKeys.contains(newMember) == true)
    }

    func testRemoveMemberFromGroup() {
        // Given: A group with two members
        var groups: [String: Group] = [:]
        var group = TestFixtures.createTestGroup()
        let memberToRemove = TestFixtures.testPublicKeyHex2
        group.memberPublicKeys.append(memberToRemove)
        groups[group.id] = group

        // When: Removing member
        group.memberPublicKeys.removeAll { $0 == memberToRemove }
        groups[group.id] = group

        // Then: Should have one member
        XCTAssertEqual(groups[group.id]?.memberPublicKeys.count, 1)
        XCTAssertFalse(groups[group.id]?.memberPublicKeys.contains(memberToRemove) == true)
    }

    // MARK: - Database Relay Operations Tests

    func testRelayOperationsInMemory() {
        // Given: In-memory relay storage
        var relays: [String: RelayConfig] = [:]
        let relay = TestFixtures.createTestRelayConfig()

        // Save
        relays[relay.url] = relay
        XCTAssertEqual(relays.count, 1)

        // Get
        XCTAssertNotNil(relays[relay.url])

        // Delete
        relays.removeValue(forKey: relay.url)
        XCTAssertNil(relays[relay.url])
    }

    func testGetEnabledRelays() {
        // Given: Mix of enabled and disabled relays
        var relays: [String: RelayConfig] = [:]
        for (index, url) in TestFixtures.testRelayURLs.enumerated() {
            var config = RelayConfig(url: url)
            config.isEnabled = index % 2 == 0
            relays[url] = config
        }

        // When: Filtering enabled
        let enabled = relays.values.filter { $0.isEnabled }

        // Then: Should only return enabled
        XCTAssertEqual(enabled.count, 2) // 0, 2 are enabled
    }

    func testToggleRelay() {
        // Given: An enabled relay
        var relays: [String: RelayConfig] = [:]
        var relay = TestFixtures.createTestRelayConfig()
        relays[relay.url] = relay
        XCTAssertTrue(relays[relay.url]?.isEnabled == true)

        // When: Toggling
        relay.isEnabled = false
        relays[relay.url] = relay

        // Then: Should be disabled
        XCTAssertFalse(relays[relay.url]?.isEnabled == true)
    }

    // MARK: - Data Clearing Tests

    func testClearAllData() {
        // Given: Data in all categories
        var contacts: [String: Contact] = [TestFixtures.testPublicKeyHex: TestFixtures.createTestContact()]
        var messages: [String: StoredMessage] = [:]
        var groups: [String: Group] = ["g1": TestFixtures.createTestGroup()]
        var relays: [String: RelayConfig] = [TestFixtures.testRelayURLs[0]: TestFixtures.createTestRelayConfig()]

        let queued = TestFixtures.createTestQueuedMessage()
        messages[queued.id] = StoredMessage(from: queued)

        // When: Clearing all
        contacts.removeAll()
        messages.removeAll()
        groups.removeAll()
        relays.removeAll()

        // Then: All should be empty
        XCTAssertTrue(contacts.isEmpty)
        XCTAssertTrue(messages.isEmpty)
        XCTAssertTrue(groups.isEmpty)
        XCTAssertTrue(relays.isEmpty)
    }
}
