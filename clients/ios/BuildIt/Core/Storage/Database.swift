// Database.swift
// BuildIt - Decentralized Mesh Communication
//
// Local database for storing messages, contacts, and app data.
// Uses encrypted JSON storage with AES-256-GCM for data at rest.

import Foundation
import SwiftUI
import os.log

// MARK: - Database Models

/// Contact stored in the database
struct Contact: Codable, Identifiable {
    let id: String
    let publicKey: String
    var name: String?
    var npub: String?
    var avatarURL: String?
    var isBlocked: Bool = false
    var isMuted: Bool = false
    var lastSeen: Date?
    var createdAt: Date
    var metadata: [String: String] = [:]

    init(publicKey: String, name: String? = nil) {
        self.id = publicKey
        self.publicKey = publicKey
        self.name = name
        self.createdAt = Date()
    }

    var displayName: String {
        name ?? npub ?? String(publicKey.prefix(8)) + "..."
    }
}

/// Message stored in the database
struct StoredMessage: Codable, Identifiable {
    let id: String
    let content: String
    let senderPublicKey: String
    let recipientPublicKey: String?
    let timestamp: Date
    let eventId: String?
    var isRead: Bool = false
    var isDelivered: Bool = false
    var deliveredAt: Date?
    var transport: String?

    init(from queuedMessage: QueuedMessage) {
        self.id = queuedMessage.id
        self.content = queuedMessage.content
        self.senderPublicKey = queuedMessage.senderPublicKey
        self.recipientPublicKey = queuedMessage.recipientPublicKey
        self.timestamp = queuedMessage.timestamp
        self.eventId = queuedMessage.eventId
        self.isRead = queuedMessage.isRead
        self.isDelivered = queuedMessage.isDelivered
        self.deliveredAt = queuedMessage.deliveredAt
    }
}

/// Group stored in the database
struct Group: Codable, Identifiable {
    let id: String
    var name: String
    var description: String?
    var avatarURL: String?
    var memberPublicKeys: [String]
    var adminPublicKeys: [String]
    var createdAt: Date
    var createdBy: String
    var isPrivate: Bool
    var metadata: [String: String] = [:]

    init(name: String, createdBy: String) {
        self.id = UUID().uuidString
        self.name = name
        self.createdBy = createdBy
        self.createdAt = Date()
        self.memberPublicKeys = [createdBy]
        self.adminPublicKeys = [createdBy]
        self.isPrivate = true
    }
}

/// Relay configuration
struct RelayConfig: Codable, Identifiable {
    let id: String
    let url: String
    var isEnabled: Bool = true
    var isReadable: Bool = true
    var isWritable: Bool = true
    var addedAt: Date

    init(url: String) {
        self.id = url
        self.url = url
        self.addedAt = Date()
    }
}

// MARK: - Database

/// Main database class for local storage
/// All data is encrypted at rest using AES-256-GCM with NSFileProtectionComplete
class Database {
    // MARK: - Singleton

    static let shared = Database()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "Database")
    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let encryption = DatabaseEncryption.shared

    private var contacts: [String: Contact] = [:]
    private var messages: [String: StoredMessage] = [:]
    private var groups: [String: Group] = [:]
    private var relays: [String: RelayConfig] = [:]

    /// Tracks whether migration from unencrypted to encrypted has been completed
    private var migrationCompleted: Bool {
        get { UserDefaults.standard.bool(forKey: "database.migrationCompleted") }
        set { UserDefaults.standard.set(newValue, forKey: "database.migrationCompleted") }
    }

    // MARK: - Initialization

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        loadAllData()

        // Subscribe to background notification for memory protection
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func applicationDidEnterBackground() {
        // Clear sensitive data caches when backgrounded
        // The actual data is persisted to encrypted storage
        logger.debug("App backgrounded - encryption key will be cleared by DatabaseEncryption")
    }

    // MARK: - Contact Operations

    func saveContact(_ contact: Contact) {
        contacts[contact.publicKey] = contact
        saveContacts()
        logger.info("Saved contact: \(contact.displayName)")
    }

    func getContact(publicKey: String) -> Contact? {
        contacts[publicKey]
    }

    func getAllContacts() -> [Contact] {
        Array(contacts.values).sorted { ($0.name ?? "") < ($1.name ?? "") }
    }

    func deleteContact(publicKey: String) {
        contacts.removeValue(forKey: publicKey)
        saveContacts()
        logger.info("Deleted contact: \(publicKey.prefix(8))")
    }

    func updateContactLastSeen(publicKey: String, date: Date = Date()) {
        if var contact = contacts[publicKey] {
            contact.lastSeen = date
            contacts[publicKey] = contact
            saveContacts()
        }
    }

    func blockContact(publicKey: String) {
        if var contact = contacts[publicKey] {
            contact.isBlocked = true
            contacts[publicKey] = contact
            saveContacts()
        }
    }

    func unblockContact(publicKey: String) {
        if var contact = contacts[publicKey] {
            contact.isBlocked = false
            contacts[publicKey] = contact
            saveContacts()
        }
    }

    // MARK: - Message Operations

    func saveMessage(_ message: StoredMessage) {
        messages[message.id] = message
        saveMessages()
    }

    func saveMessage(from queuedMessage: QueuedMessage) {
        let stored = StoredMessage(from: queuedMessage)
        saveMessage(stored)
    }

    func getMessage(id: String) -> StoredMessage? {
        messages[id]
    }

    func getMessages(with publicKey: String, limit: Int = 100) -> [StoredMessage] {
        messages.values
            .filter { $0.senderPublicKey == publicKey || $0.recipientPublicKey == publicKey }
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(limit)
            .reversed()
            .map { $0 }
    }

    func getAllMessages(limit: Int = 1000) -> [StoredMessage] {
        Array(messages.values)
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(limit)
            .map { $0 }
    }

    func deleteMessage(id: String) {
        messages.removeValue(forKey: id)
        saveMessages()
    }

    func deleteMessages(with publicKey: String) {
        let toDelete = messages.values.filter {
            $0.senderPublicKey == publicKey || $0.recipientPublicKey == publicKey
        }
        for message in toDelete {
            messages.removeValue(forKey: message.id)
        }
        saveMessages()
    }

    func markMessageAsRead(id: String) {
        if var message = messages[id] {
            message.isRead = true
            messages[id] = message
            saveMessages()
        }
    }

    // MARK: - Group Operations

    func saveGroup(_ group: Group) {
        groups[group.id] = group
        saveGroups()
        logger.info("Saved group: \(group.name)")
    }

    func getGroup(id: String) -> Group? {
        groups[id]
    }

    func getAllGroups() -> [Group] {
        Array(groups.values).sorted { $0.name < $1.name }
    }

    func deleteGroup(id: String) {
        groups.removeValue(forKey: id)
        saveGroups()
    }

    func addMemberToGroup(groupId: String, memberPublicKey: String) {
        if var group = groups[groupId] {
            if !group.memberPublicKeys.contains(memberPublicKey) {
                group.memberPublicKeys.append(memberPublicKey)
                groups[groupId] = group
                saveGroups()
            }
        }
    }

    func removeMemberFromGroup(groupId: String, memberPublicKey: String) {
        if var group = groups[groupId] {
            group.memberPublicKeys.removeAll { $0 == memberPublicKey }
            groups[groupId] = group
            saveGroups()
        }
    }

    // MARK: - Relay Operations

    func saveRelay(_ relay: RelayConfig) {
        relays[relay.url] = relay
        saveRelays()
        logger.info("Saved relay: \(relay.url)")
    }

    func getRelay(url: String) -> RelayConfig? {
        relays[url]
    }

    func getAllRelays() -> [RelayConfig] {
        Array(relays.values).sorted { $0.addedAt < $1.addedAt }
    }

    func getEnabledRelays() -> [RelayConfig] {
        relays.values.filter { $0.isEnabled }
    }

    func deleteRelay(url: String) {
        relays.removeValue(forKey: url)
        saveRelays()
    }

    func toggleRelay(url: String, enabled: Bool) {
        if var relay = relays[url] {
            relay.isEnabled = enabled
            relays[url] = relay
            saveRelays()
        }
    }

    // MARK: - Context Management

    func saveContext() {
        saveContacts()
        saveMessages()
        saveGroups()
        saveRelays()
        logger.info("Saved all database context")
    }

    func clearAllData() {
        contacts.removeAll()
        messages.removeAll()
        groups.removeAll()
        relays.removeAll()

        saveContext()

        // Also delete the encryption key for complete wipe
        do {
            try encryption.deleteMasterKey()
        } catch {
            logger.error("Failed to delete encryption key: \(error.localizedDescription)")
        }

        // Reset migration flag so new data will be encrypted fresh
        migrationCompleted = false

        logger.warning("Cleared all database data and encryption keys")
    }

    // MARK: - Private Methods

    private func loadAllData() {
        loadContacts()
        loadMessages()
        loadGroups()
        loadRelays()

        // Perform migration if needed (re-save all data encrypted)
        if !migrationCompleted {
            performMigrationToEncrypted()
        }

        logger.info("Loaded all database data (encrypted)")
    }

    /// Migrates unencrypted data to encrypted format
    private func performMigrationToEncrypted() {
        logger.info("Performing migration to encrypted storage...")

        // Re-save all data with encryption
        saveContacts()
        saveMessages()
        saveGroups()
        saveRelays()

        migrationCompleted = true
        logger.info("Migration to encrypted storage completed")
    }

    private func getDocumentsDirectory() -> URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    // MARK: - Contacts

    private func saveContacts() {
        let url = getDocumentsDirectory().appendingPathComponent("contacts.db")
        do {
            let data = try encoder.encode(contacts)
            try encryption.writeEncrypted(data, to: url)
            logger.debug("Saved encrypted contacts")
        } catch {
            logger.error("Failed to save contacts: \(error.localizedDescription)")
        }
    }

    private func loadContacts() {
        let url = getDocumentsDirectory().appendingPathComponent("contacts.db")

        // Also check legacy unencrypted location for migration
        let legacyUrl = getDocumentsDirectory().appendingPathComponent("contacts.json")

        do {
            // Try new encrypted location first
            if let data = try encryption.readEncrypted(from: url) {
                contacts = try decoder.decode([String: Contact].self, from: data)
                return
            }

            // Fall back to legacy unencrypted file for migration
            if fileManager.fileExists(atPath: legacyUrl.path),
               let data = try? Data(contentsOf: legacyUrl) {
                contacts = try decoder.decode([String: Contact].self, from: data)
                logger.info("Loaded contacts from legacy unencrypted file (will be migrated)")

                // Delete legacy file after successful load
                try? fileManager.removeItem(at: legacyUrl)
            }
        } catch {
            logger.error("Failed to load contacts: \(error.localizedDescription)")
        }
    }

    // MARK: - Messages

    private func saveMessages() {
        let url = getDocumentsDirectory().appendingPathComponent("messages.db")
        do {
            let data = try encoder.encode(messages)
            try encryption.writeEncrypted(data, to: url)
            logger.debug("Saved encrypted messages")
        } catch {
            logger.error("Failed to save messages: \(error.localizedDescription)")
        }
    }

    private func loadMessages() {
        let url = getDocumentsDirectory().appendingPathComponent("messages.db")
        let legacyUrl = getDocumentsDirectory().appendingPathComponent("messages.json")

        do {
            if let data = try encryption.readEncrypted(from: url) {
                messages = try decoder.decode([String: StoredMessage].self, from: data)
                return
            }

            if fileManager.fileExists(atPath: legacyUrl.path),
               let data = try? Data(contentsOf: legacyUrl) {
                messages = try decoder.decode([String: StoredMessage].self, from: data)
                logger.info("Loaded messages from legacy unencrypted file (will be migrated)")
                try? fileManager.removeItem(at: legacyUrl)
            }
        } catch {
            logger.error("Failed to load messages: \(error.localizedDescription)")
        }
    }

    // MARK: - Groups

    private func saveGroups() {
        let url = getDocumentsDirectory().appendingPathComponent("groups.db")
        do {
            let data = try encoder.encode(groups)
            try encryption.writeEncrypted(data, to: url)
            logger.debug("Saved encrypted groups")
        } catch {
            logger.error("Failed to save groups: \(error.localizedDescription)")
        }
    }

    private func loadGroups() {
        let url = getDocumentsDirectory().appendingPathComponent("groups.db")
        let legacyUrl = getDocumentsDirectory().appendingPathComponent("groups.json")

        do {
            if let data = try encryption.readEncrypted(from: url) {
                groups = try decoder.decode([String: Group].self, from: data)
                return
            }

            if fileManager.fileExists(atPath: legacyUrl.path),
               let data = try? Data(contentsOf: legacyUrl) {
                groups = try decoder.decode([String: Group].self, from: data)
                logger.info("Loaded groups from legacy unencrypted file (will be migrated)")
                try? fileManager.removeItem(at: legacyUrl)
            }
        } catch {
            logger.error("Failed to load groups: \(error.localizedDescription)")
        }
    }

    // MARK: - Relays

    private func saveRelays() {
        let url = getDocumentsDirectory().appendingPathComponent("relays.db")
        do {
            let data = try encoder.encode(relays)
            try encryption.writeEncrypted(data, to: url)
            logger.debug("Saved encrypted relays")
        } catch {
            logger.error("Failed to save relays: \(error.localizedDescription)")
        }
    }

    private func loadRelays() {
        let url = getDocumentsDirectory().appendingPathComponent("relays.db")
        let legacyUrl = getDocumentsDirectory().appendingPathComponent("relays.json")

        do {
            if let data = try encryption.readEncrypted(from: url) {
                relays = try decoder.decode([String: RelayConfig].self, from: data)
                return
            }

            if fileManager.fileExists(atPath: legacyUrl.path),
               let data = try? Data(contentsOf: legacyUrl) {
                relays = try decoder.decode([String: RelayConfig].self, from: data)
                logger.info("Loaded relays from legacy unencrypted file (will be migrated)")
                try? fileManager.removeItem(at: legacyUrl)
            }
        } catch {
            logger.error("Failed to load relays: \(error.localizedDescription)")
        }
    }
}
