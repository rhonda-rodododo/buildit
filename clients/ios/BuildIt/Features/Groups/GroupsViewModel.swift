// GroupsViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// View model for group chat functionality.

import Foundation
import Combine
import os.log

/// View model for group-related operations
@MainActor
class GroupsViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var groups: [Group] = []
    @Published var contacts: [Contact] = []
    @Published var isLoading: Bool = false
    @Published var error: String?

    // MARK: - Private Properties

    private var groupMessages: [String: [GroupMessage]] = [:]
    private let logger = Logger(subsystem: "com.buildit", category: "GroupsViewModel")
    private var cancellables = Set<AnyCancellable>()
    private var myPublicKey: String?

    // MARK: - Initialization

    init() {
        Task {
            myPublicKey = await CryptoManager.shared.getPublicKeyHex()
        }
        loadContacts()
    }

    // MARK: - Public Methods

    /// Load all groups
    func loadGroups() {
        groups = Database.shared.getAllGroups()
    }

    /// Load all contacts for member selection
    func loadContacts() {
        contacts = Database.shared.getAllContacts()
    }

    /// Create a new group
    func createGroup(
        name: String,
        description: String?,
        isPrivate: Bool,
        members: [String]
    ) async {
        guard let myPublicKey = myPublicKey else {
            error = "No key pair available"
            return
        }

        var group = Group(name: name, createdBy: myPublicKey)
        group.description = description
        group.isPrivate = isPrivate

        // Add selected members
        for member in members {
            if !group.memberPublicKeys.contains(member) {
                group.memberPublicKeys.append(member)
            }
        }

        // Save to database
        Database.shared.saveGroup(group)

        // Broadcast group creation to members via Nostr
        do {
            let content = try encodeGroupEvent(group)
            _ = try await NostrClient.shared.publishEvent(
                kind: .groupMessage,
                content: content,
                tags: members.map { ["p", $0] }
            )
        } catch {
            logger.error("Failed to broadcast group creation: \(error.localizedDescription)")
        }

        loadGroups()
        logger.info("Created group: \(name)")
    }

    /// Delete groups at indices
    func deleteGroups(at indexSet: IndexSet) {
        for index in indexSet {
            let group = groups[index]
            Database.shared.deleteGroup(id: group.id)
        }
        groups.remove(atOffsets: indexSet)
    }

    /// Leave a group
    func leaveGroup(_ group: Group) {
        guard let myPublicKey = myPublicKey else { return }

        Database.shared.removeMemberFromGroup(groupId: group.id, memberPublicKey: myPublicKey)

        // Notify other members
        Task {
            do {
                let content = """
                {"type":"leave","group":"\(group.id)","member":"\(myPublicKey)"}
                """
                _ = try await NostrClient.shared.publishEvent(
                    kind: .groupMessage,
                    content: content,
                    tags: group.memberPublicKeys.map { ["p", $0] }
                )
            } catch {
                logger.error("Failed to broadcast leave: \(error.localizedDescription)")
            }
        }

        loadGroups()
    }

    /// Send a message to a group
    func sendGroupMessage(_ content: String, to group: Group) async {
        guard let myPublicKey = myPublicKey else {
            error = "No key pair available"
            return
        }

        // Create message
        let message = GroupMessage(
            id: UUID().uuidString,
            content: content,
            senderPublicKey: myPublicKey,
            senderName: nil,
            timestamp: Date()
        )

        // Add to local storage
        if groupMessages[group.id] == nil {
            groupMessages[group.id] = []
        }
        groupMessages[group.id]?.append(message)

        // Broadcast via BLE mesh
        do {
            let messageContent = try encodeGroupMessage(message, groupId: group.id)

            // Send to each member via transport router
            for memberKey in group.memberPublicKeys where memberKey != myPublicKey {
                try await TransportRouter.shared.sendMessage(
                    content: messageContent,
                    to: memberKey,
                    priority: .normal
                )
            }
        } catch {
            logger.error("Failed to send group message: \(error.localizedDescription)")
            self.error = error.localizedDescription
        }

        // Also broadcast via Nostr
        do {
            let nostrContent = try encodeGroupMessage(message, groupId: group.id)
            _ = try await NostrClient.shared.publishEvent(
                kind: .groupMessage,
                content: nostrContent,
                tags: [["e", group.id]] + group.memberPublicKeys.map { ["p", $0] }
            )
        } catch {
            logger.error("Failed to broadcast via Nostr: \(error.localizedDescription)")
        }
    }

    /// Get messages for a group
    func getMessages(for groupId: String) -> [GroupMessage] {
        groupMessages[groupId] ?? []
    }

    /// Check if a message is from the current user
    func isMessageFromMe(_ message: GroupMessage) -> Bool {
        message.senderPublicKey == myPublicKey
    }

    /// Get member name from contacts
    func getMemberName(_ publicKey: String) -> String? {
        contacts.first { $0.publicKey == publicKey }?.displayName
    }

    /// Add a member to a group
    func addMember(_ publicKey: String, to group: Group) {
        Database.shared.addMemberToGroup(groupId: group.id, memberPublicKey: publicKey)

        // Notify the new member
        Task {
            do {
                let content = try encodeGroupEvent(group)
                _ = try await NostrClient.shared.publishEvent(
                    kind: .groupMessage,
                    content: content,
                    tags: [["p", publicKey]]
                )
            } catch {
                logger.error("Failed to notify new member: \(error.localizedDescription)")
            }
        }

        loadGroups()
    }

    /// Remove a member from a group (admin only)
    func removeMember(_ publicKey: String, from group: Group) {
        guard let myPublicKey = myPublicKey,
              group.adminPublicKeys.contains(myPublicKey) else {
            error = "Only admins can remove members"
            return
        }

        Database.shared.removeMemberFromGroup(groupId: group.id, memberPublicKey: publicKey)
        loadGroups()
    }

    // MARK: - Private Methods

    private func encodeGroupEvent(_ group: Group) throws -> String {
        let event: [String: Any] = [
            "type": "group",
            "id": group.id,
            "name": group.name,
            "description": group.description ?? "",
            "members": group.memberPublicKeys,
            "admins": group.adminPublicKeys,
            "private": group.isPrivate
        ]
        let data = try JSONSerialization.data(withJSONObject: event)
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func encodeGroupMessage(_ message: GroupMessage, groupId: String) throws -> String {
        let event: [String: Any] = [
            "type": "message",
            "id": message.id,
            "group": groupId,
            "content": message.content,
            "sender": message.senderPublicKey,
            "timestamp": Int(message.timestamp.timeIntervalSince1970)
        ]
        let data = try JSONSerialization.data(withJSONObject: event)
        return String(data: data, encoding: .utf8) ?? ""
    }
}
