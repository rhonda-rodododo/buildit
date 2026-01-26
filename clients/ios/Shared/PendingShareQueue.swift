// PendingShareQueue.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages pending shared content that needs to be sent by the main app.
// Share extensions have limited runtime so we queue messages for later processing.

import Foundation

/// A pending share message waiting to be sent
struct PendingShare: Codable, Identifiable {
    let id: String
    let destinationId: String
    let destinationType: ShareDestination.DestinationType
    let content: SharedContent
    let additionalText: String?
    let createdAt: Date

    /// Status of the pending share
    enum Status: String, Codable {
        case pending
        case processing
        case sent
        case failed
    }

    var status: Status

    /// Error message if status is failed
    var errorMessage: String?

    init(
        destination: ShareDestination,
        content: SharedContent,
        additionalText: String? = nil
    ) {
        self.id = UUID().uuidString
        self.destinationId = destination.id
        self.destinationType = destination.type
        self.content = content
        self.additionalText = additionalText
        self.createdAt = Date()
        self.status = .pending
        self.errorMessage = nil
    }

    /// The full message text to send
    var messageText: String {
        var text = content.displayText

        if let additional = additionalText, !additional.isEmpty {
            text = additional + "\n\n" + text
        }

        return text
    }
}

/// Manages the queue of pending shares in App Group storage
class PendingShareQueue {
    /// Shared instance
    static let shared = PendingShareQueue()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    /// File URL for the pending shares queue
    private var queueFileURL: URL? {
        ShareConfig.sharedContainerURL?.appendingPathComponent("pending_shares.json")
    }

    // MARK: - Queue Operations

    /// Add a new pending share to the queue
    func enqueue(_ share: PendingShare) throws {
        var shares = loadAll()
        shares.append(share)
        try save(shares)

        // Post notification for main app
        NotificationCenter.default.post(
            name: ShareConfig.newShareQueuedNotification,
            object: nil,
            userInfo: ["shareId": share.id]
        )
    }

    /// Add multiple pending shares
    func enqueueAll(_ newShares: [PendingShare]) throws {
        var shares = loadAll()
        shares.append(contentsOf: newShares)
        try save(shares)

        NotificationCenter.default.post(
            name: ShareConfig.newShareQueuedNotification,
            object: nil
        )
    }

    /// Load all pending shares
    func loadAll() -> [PendingShare] {
        guard let url = queueFileURL,
              FileManager.default.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url),
              let shares = try? decoder.decode([PendingShare].self, from: data) else {
            return []
        }
        return shares
    }

    /// Get only pending (not yet processed) shares
    func getPending() -> [PendingShare] {
        loadAll().filter { $0.status == .pending }
    }

    /// Get count of pending shares
    func pendingCount() -> Int {
        getPending().count
    }

    /// Update a share's status
    func updateStatus(id: String, status: PendingShare.Status, errorMessage: String? = nil) {
        var shares = loadAll()

        if let index = shares.firstIndex(where: { $0.id == id }) {
            shares[index].status = status
            shares[index].errorMessage = errorMessage
            try? save(shares)
        }
    }

    /// Mark a share as processing
    func markProcessing(id: String) {
        updateStatus(id: id, status: .processing)
    }

    /// Mark a share as sent
    func markSent(id: String) {
        updateStatus(id: id, status: .sent)
    }

    /// Mark a share as failed
    func markFailed(id: String, error: String) {
        updateStatus(id: id, status: .failed, errorMessage: error)
    }

    /// Remove a share from the queue
    func remove(id: String) {
        var shares = loadAll()
        shares.removeAll { $0.id == id }
        try? save(shares)
    }

    /// Remove all sent shares (cleanup)
    func removeSent() {
        var shares = loadAll()
        shares.removeAll { $0.status == .sent }
        try? save(shares)
    }

    /// Remove shares older than a given date
    func removeOlderThan(_ date: Date) {
        var shares = loadAll()
        shares.removeAll { $0.createdAt < date }
        try? save(shares)
    }

    /// Clear all pending shares
    func clearAll() {
        guard let url = queueFileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - Image Storage

    /// Store image data for a pending share (images are stored separately due to size)
    func storeImage(for shareId: String, imageData: Data) throws {
        guard let containerURL = ShareConfig.sharedContainerURL else {
            throw ShareQueueError.noContainerAccess
        }

        let imagesDir = containerURL.appendingPathComponent("share_images")
        try FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)

        let imageURL = imagesDir.appendingPathComponent("\(shareId).jpg")
        try imageData.write(to: imageURL)
    }

    /// Load image data for a pending share
    func loadImage(for shareId: String) -> Data? {
        guard let containerURL = ShareConfig.sharedContainerURL else {
            return nil
        }

        let imageURL = containerURL.appendingPathComponent("share_images/\(shareId).jpg")
        return try? Data(contentsOf: imageURL)
    }

    /// Remove image for a share
    func removeImage(for shareId: String) {
        guard let containerURL = ShareConfig.sharedContainerURL else { return }

        let imageURL = containerURL.appendingPathComponent("share_images/\(shareId).jpg")
        try? FileManager.default.removeItem(at: imageURL)
    }

    /// Clean up orphaned images (no matching share)
    func cleanupOrphanedImages() {
        guard let containerURL = ShareConfig.sharedContainerURL else { return }

        let imagesDir = containerURL.appendingPathComponent("share_images")
        guard let imageFiles = try? FileManager.default.contentsOfDirectory(atPath: imagesDir.path) else {
            return
        }

        let shareIds = Set(loadAll().map { $0.id })

        for file in imageFiles {
            let shareId = (file as NSString).deletingPathExtension
            if !shareIds.contains(shareId) {
                let fileURL = imagesDir.appendingPathComponent(file)
                try? FileManager.default.removeItem(at: fileURL)
            }
        }
    }

    // MARK: - Private Methods

    private func save(_ shares: [PendingShare]) throws {
        guard let url = queueFileURL else {
            throw ShareQueueError.noContainerAccess
        }

        // Ensure parent directory exists
        let dir = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let data = try encoder.encode(shares)
        try data.write(to: url, options: .atomic)
    }
}

// MARK: - Errors

enum ShareQueueError: LocalizedError {
    case noContainerAccess
    case encodingFailed
    case saveFailed(String)

    var errorDescription: String? {
        switch self {
        case .noContainerAccess:
            return "Cannot access shared container"
        case .encodingFailed:
            return "Failed to encode share data"
        case .saveFailed(let reason):
            return "Failed to save: \(reason)"
        }
    }
}

// MARK: - Main App Processing

/// Extension for main app to process pending shares
extension PendingShareQueue {
    /// Process all pending shares (called by main app)
    /// Returns the number of shares processed
    @discardableResult
    func processAllPending(
        sendDM: @escaping (String, String) async throws -> Void,
        sendGroupMessage: @escaping (String, String) async throws -> Void
    ) async -> Int {
        let pending = getPending()
        var processed = 0

        for share in pending {
            markProcessing(id: share.id)

            do {
                switch share.destinationType {
                case .contact:
                    try await sendDM(share.messageText, share.destinationId)
                case .group:
                    try await sendGroupMessage(share.messageText, share.destinationId)
                }

                markSent(id: share.id)
                removeImage(for: share.id)
                processed += 1

            } catch {
                markFailed(id: share.id, error: error.localizedDescription)
            }
        }

        // Clean up sent shares after a delay
        removeSent()

        return processed
    }
}
