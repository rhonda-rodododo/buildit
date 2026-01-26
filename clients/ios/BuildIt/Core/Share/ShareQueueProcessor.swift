// ShareQueueProcessor.swift
// BuildIt - Decentralized Mesh Communication
//
// Processes pending shared content from the Share Extension.
// Runs in the main app to send queued messages with full network access.

import Foundation
import Combine
import os.log

/// Processes the pending share queue from the Share Extension
@MainActor
class ShareQueueProcessor: ObservableObject {
    // MARK: - Singleton

    static let shared = ShareQueueProcessor()

    // MARK: - Published Properties

    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var isProcessing: Bool = false
    @Published private(set) var lastProcessedAt: Date?
    @Published private(set) var lastError: String?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "ShareQueueProcessor")
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        setupObservers()
        updatePendingCount()
    }

    private func setupObservers() {
        // Listen for new shares queued by the extension
        NotificationCenter.default.publisher(for: ShareConfig.newShareQueuedNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updatePendingCount()
                // Auto-process when new shares arrive
                Task {
                    await self?.processQueue()
                }
            }
            .store(in: &cancellables)

        // Process queue when app becomes active
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task {
                    await self?.processQueue()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Update the pending count from the queue
    func updatePendingCount() {
        pendingCount = PendingShareQueue.shared.pendingCount()
    }

    /// Process all pending shares in the queue
    func processQueue() async {
        guard !isProcessing else {
            logger.debug("Already processing share queue")
            return
        }

        let pending = PendingShareQueue.shared.getPending()
        guard !pending.isEmpty else {
            logger.debug("No pending shares to process")
            return
        }

        isProcessing = true
        logger.info("Processing \(pending.count) pending shares")

        var successCount = 0
        var failureCount = 0

        for share in pending {
            PendingShareQueue.shared.markProcessing(id: share.id)

            do {
                switch share.destinationType {
                case .contact:
                    try await sendDirectMessage(share)
                case .group:
                    try await sendGroupMessage(share)
                }

                PendingShareQueue.shared.markSent(id: share.id)
                PendingShareQueue.shared.removeImage(for: share.id)
                successCount += 1
                logger.info("Successfully sent share \(share.id)")

            } catch {
                PendingShareQueue.shared.markFailed(id: share.id, error: error.localizedDescription)
                failureCount += 1
                lastError = error.localizedDescription
                logger.error("Failed to send share \(share.id): \(error.localizedDescription)")
            }
        }

        // Clean up sent shares
        PendingShareQueue.shared.removeSent()
        PendingShareQueue.shared.cleanupOrphanedImages()

        lastProcessedAt = Date()
        isProcessing = false
        updatePendingCount()

        logger.info("Finished processing shares: \(successCount) sent, \(failureCount) failed")
    }

    /// Retry failed shares
    func retryFailed() async {
        let allShares = PendingShareQueue.shared.loadAll()
        let failed = allShares.filter { $0.status == .failed }

        for share in failed {
            PendingShareQueue.shared.updateStatus(id: share.id, status: .pending)
        }

        updatePendingCount()
        await processQueue()
    }

    /// Clear all pending shares
    func clearAll() {
        PendingShareQueue.shared.clearAll()
        updatePendingCount()
        logger.info("Cleared all pending shares")
    }

    // MARK: - Private Methods

    private func sendDirectMessage(_ share: PendingShare) async throws {
        let recipientPublicKey = share.destinationId
        var messageText = share.messageText

        // Handle image content
        if share.content.type == .image,
           let imageData = PendingShareQueue.shared.loadImage(for: share.id) {
            // Upload image and get URL
            let imageURL = try await uploadImage(imageData, fileName: share.content.fileName ?? "shared_image.jpg")
            messageText = share.additionalText ?? ""
            if !messageText.isEmpty {
                messageText += "\n\n"
            }
            messageText += imageURL
        }

        // Send via transport router
        try await TransportRouter.shared.sendMessage(
            content: messageText,
            to: recipientPublicKey,
            priority: .normal
        )
    }

    private func sendGroupMessage(_ share: PendingShare) async throws {
        let groupId = share.destinationId
        var messageText = share.messageText

        // Handle image content
        if share.content.type == .image,
           let imageData = PendingShareQueue.shared.loadImage(for: share.id) {
            // Upload image and get URL
            let imageURL = try await uploadImage(imageData, fileName: share.content.fileName ?? "shared_image.jpg")
            messageText = share.additionalText ?? ""
            if !messageText.isEmpty {
                messageText += "\n\n"
            }
            messageText += imageURL
        }

        // Get group and send to all members
        guard let group = Database.shared.getGroup(id: groupId) else {
            throw ShareProcessingError.groupNotFound
        }

        guard let myPublicKey = await CryptoManager.shared.getPublicKeyHex() else {
            throw ShareProcessingError.noKeyPair
        }

        // Send to each member
        for memberKey in group.memberPublicKeys where memberKey != myPublicKey {
            try await TransportRouter.shared.sendMessage(
                content: messageText,
                to: memberKey,
                priority: .normal
            )
        }

        // Also publish via Nostr for group
        _ = try await NostrClient.shared.publishEvent(
            kind: .groupMessage,
            content: messageText,
            tags: [["e", groupId]] + group.memberPublicKeys.map { ["p", $0] }
        )
    }

    private func uploadImage(_ data: Data, fileName: String) async throws -> String {
        // Use the file upload service to upload the image
        do {
            let result = await FileUploadService.shared.uploadFile(
                data: data,
                filename: fileName,
                mimeType: "image/jpeg"
            )
            return result.url
        } catch {
            logger.error("Image upload failed: \(error.localizedDescription)")
            throw ShareProcessingError.imageUploadFailed(error.localizedDescription)
        }
    }
}

// MARK: - Errors

enum ShareProcessingError: LocalizedError {
    case groupNotFound
    case noKeyPair
    case imageUploadFailed(String)
    case sendFailed(String)

    var errorDescription: String? {
        switch self {
        case .groupNotFound:
            return "Group not found"
        case .noKeyPair:
            return "No key pair available"
        case .imageUploadFailed(let reason):
            return "Image upload failed: \(reason)"
        case .sendFailed(let reason):
            return "Send failed: \(reason)"
        }
    }
}

// MARK: - App Group Data Synchronization

/// Extension to sync data to App Group for Share Extension access
extension Database {
    /// Sync contacts to App Group shared storage for Share Extension
    func syncContactsToAppGroup() {
        guard let containerURL = ShareConfig.sharedContainerURL else { return }

        let contacts = getAllContacts()
        var shareableContacts: [String: ShareableContact] = [:]

        for contact in contacts where !contact.isBlocked {
            shareableContacts[contact.publicKey] = ShareableContact(
                name: contact.name,
                avatarURL: contact.avatarURL
            )
        }

        let contactsURL = containerURL.appendingPathComponent("contacts.json")
        if let data = try? JSONEncoder().encode(shareableContacts) {
            try? data.write(to: contactsURL)
        }
    }

    /// Sync groups to App Group shared storage for Share Extension
    func syncGroupsToAppGroup() {
        guard let containerURL = ShareConfig.sharedContainerURL else { return }

        let groups = getAllGroups()
        var shareableGroups: [String: ShareableGroup] = [:]

        for group in groups {
            shareableGroups[group.id] = ShareableGroup(
                name: group.name,
                avatarURL: group.avatarURL
            )
        }

        let groupsURL = containerURL.appendingPathComponent("groups.json")
        if let data = try? JSONEncoder().encode(shareableGroups) {
            try? data.write(to: groupsURL)
        }
    }

    /// Sync all data to App Group
    func syncAllToAppGroup() {
        syncContactsToAppGroup()
        syncGroupsToAppGroup()
    }
}

/// Extension to sync user identity to App Group
extension CryptoManager {
    /// Sync user identity to App Group for Share Extension
    func syncIdentityToAppGroup() async {
        guard let publicKey = await getPublicKeyHex() else { return }

        let identity = SharedUserIdentity(
            publicKey: publicKey,
            npub: await getNpub(),
            displayName: nil // Could be loaded from profile
        )

        identity.save()
    }

    /// Clear user identity from App Group (on logout)
    func clearIdentityFromAppGroup() {
        SharedUserIdentity.clear()
    }
}

/// Extension to sync relay config to App Group
extension NostrClient {
    /// Sync relay configuration to App Group for Share Extension
    func syncRelaysToAppGroup() {
        let relays = Database.shared.getEnabledRelays()

        let sharedRelays = relays.map { relay in
            SharedRelayConfig(
                url: relay.url,
                isEnabled: relay.isEnabled,
                isWritable: relay.isWritable
            )
        }

        SharedRelayConfig.saveAll(sharedRelays)
    }
}
