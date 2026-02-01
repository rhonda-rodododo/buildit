// LinkPreviewDetector.swift
// BuildIt - Decentralized Mesh Communication
//
// Observable state manager for detecting URLs in text and auto-generating
// link previews with debouncing. Used by PostComposerView and ConversationView.

import SwiftUI
import Combine

/// Observable class that detects URLs in text and generates link previews.
/// Debounces input to avoid excessive API calls.
@MainActor
final class LinkPreviewDetector: ObservableObject {
    @Published private(set) var previews: [LinkPreview] = []
    @Published private(set) var isLoading = false

    private var debounceTask: Task<Void, Never>?
    private var removedURLs: Set<String> = []
    private let debounceInterval: Duration = .milliseconds(500)

    /// Call this whenever the text content changes.
    /// Automatically detects URLs and generates previews with debounce.
    func textDidChange(_ text: String) {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            guard let self else { return }

            // Debounce
            try? await Task.sleep(for: debounceInterval)
            guard !Task.isCancelled else { return }

            let urls = LinkPreviewService.extractURLs(from: text)
                .filter { !self.removedURLs.contains($0) }

            if urls.isEmpty {
                self.previews = []
                return
            }

            // Don't re-fetch URLs that already have previews
            let existingURLs = Set(self.previews.map(\.url))
            let newURLs = urls.filter { !existingURLs.contains($0) }

            if newURLs.isEmpty { return }

            self.isLoading = true

            let newPreviews = await LinkPreviewService.shared.generatePreviews(urls: newURLs)

            guard !Task.isCancelled else { return }

            // Merge new previews with existing, maintaining URL order
            var merged = self.previews
            for preview in newPreviews {
                if !merged.contains(where: { $0.url == preview.url }) {
                    merged.append(preview)
                }
            }

            // Remove previews for URLs no longer in the text
            let currentURLs = Set(urls)
            merged = merged.filter { currentURLs.contains($0.url) }

            self.previews = merged
            self.isLoading = false
        }
    }

    /// Remove a specific preview by URL
    func removePreview(url: String) {
        previews.removeAll { $0.url == url }
        removedURLs.insert(url)
    }

    /// Clear all previews and reset state
    func clearPreviews() {
        previews = []
        removedURLs = []
        debounceTask?.cancel()
        isLoading = false
    }
}
