// LinkPreviewService.swift
// BuildIt - Decentralized Mesh Communication
//
// Signal-style privacy-preserving link preview service.
// Sender fetches OG metadata + compressed thumbnails via our API proxy,
// encodes as base64, encrypts with content. Recipients see static previews.

import Foundation
import UIKit

/// Service for fetching and generating privacy-preserving link previews.
/// Uses the BuildIt API Worker for OG metadata and image proxying.
actor LinkPreviewService {
    static let shared = LinkPreviewService()

    private let session: URLSession
    private var cache: [String: CachedPreview] = [:]
    private let cacheTTL: TimeInterval = 15 * 60 // 15 minutes
    private let maxCacheSize = 100

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 5.0
        config.timeoutIntervalForResource = 10.0
        self.session = URLSession(configuration: config)
    }

    /// Get base URL for API calls (shared BuildIt API Worker)
    private var apiBaseURL: String {
        ProcessInfo.processInfo.environment["API_URL"]
            ?? "https://buildit-api.rikki-schulte.workers.dev"
    }

    // MARK: - Public API

    /// Generate a link preview for a single URL
    func generatePreview(
        url: String,
        options: LinkPreviewOptions = .default
    ) async throws -> LinkPreview {
        // Check cache
        let normalized = normalizeURL(url)
        if let cached = cache[normalized], Date().timeIntervalSince(cached.cachedAt) < cacheTTL {
            return cached.preview
        }

        guard isSecureURL(url) else {
            throw LinkPreviewError.insecureURL
        }

        // Fetch Open Graph metadata via API
        let ogData = try await fetchOpenGraphData(url: url)

        // Build preview using generated protocol type
        var preview = LinkPreview(
            description: ogData.description.map { String($0.prefix(300)) },
            faviconData: nil,
            faviconType: nil,
            fetchedAt: Int(Date().timeIntervalSince1970),
            fetchedBy: .sender,
            imageData: nil,
            imageHeight: nil,
            imageType: nil,
            imageWidth: nil,
            siteName: ogData.siteName,
            title: ogData.title,
            url: url
        )

        // Fetch and compress thumbnail if available
        if let imageURL = ogData.imageURL {
            if let imageResult = try? await fetchAndCompressImage(
                url: imageURL,
                maxWidth: options.maxWidth,
                maxHeight: options.maxHeight,
                maxBytes: options.maxImageBytes,
                quality: options.imageQuality
            ) {
                preview = LinkPreview(
                    description: preview.description,
                    faviconData: preview.faviconData,
                    faviconType: preview.faviconType,
                    fetchedAt: preview.fetchedAt,
                    fetchedBy: preview.fetchedBy,
                    imageData: imageResult.data,
                    imageHeight: imageResult.height,
                    imageType: imageResult.mimeType,
                    imageWidth: imageResult.width,
                    siteName: preview.siteName,
                    title: preview.title,
                    url: preview.url
                )
            }
        }

        // Fetch favicon if enabled
        if options.fetchFavicon, let faviconURL = ogData.faviconURL {
            if let favicon = try? await fetchFavicon(url: faviconURL) {
                preview = LinkPreview(
                    description: preview.description,
                    faviconData: favicon.data,
                    faviconType: favicon.mimeType,
                    fetchedAt: preview.fetchedAt,
                    fetchedBy: preview.fetchedBy,
                    imageData: preview.imageData,
                    imageHeight: preview.imageHeight,
                    imageType: preview.imageType,
                    imageWidth: preview.imageWidth,
                    siteName: preview.siteName,
                    title: preview.title,
                    url: preview.url
                )
            }
        }

        // Cache the result
        storeInCache(url: normalized, preview: preview)

        return preview
    }

    /// Generate previews for multiple URLs (max 3, HTTPS only, deduplicated)
    func generatePreviews(
        urls: [String],
        options: LinkPreviewOptions = .default
    ) async -> [LinkPreview] {
        let uniqueURLs = Array(Set(urls.filter { isSecureURL($0) })).prefix(3)

        return await withTaskGroup(of: LinkPreview?.self) { group in
            for url in uniqueURLs {
                group.addTask {
                    try? await self.generatePreview(url: url, options: options)
                }
            }

            var previews: [LinkPreview] = []
            for await preview in group {
                if let preview {
                    previews.append(preview)
                }
            }
            return previews
        }
    }

    /// Clear the entire cache
    func clearCache() {
        cache.removeAll()
    }

    // MARK: - URL Utilities

    /// Extract URLs from text content
    static func extractURLs(from text: String) -> [String] {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        let matches = detector?.matches(in: text, options: [], range: range) ?? []

        return matches.compactMap { match -> String? in
            guard let range = Range(match.range, in: text) else { return nil }
            let urlString = String(text[range])
            guard isSecureURLStatic(urlString) else { return nil }
            return urlString
        }
    }

    // MARK: - Private Helpers

    private func isSecureURL(_ url: String) -> Bool {
        Self.isSecureURLStatic(url)
    }

    private static func isSecureURLStatic(_ url: String) -> Bool {
        guard let parsed = URL(string: url) else { return false }
        return parsed.scheme == "https"
    }

    private func normalizeURL(_ url: String) -> String {
        guard var components = URLComponents(string: url) else { return url }
        let trackingParams: Set<String> = [
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "ref", "fbclid", "gclid"
        ]
        components.queryItems = components.queryItems?.filter {
            !trackingParams.contains($0.name.lowercased())
        }
        if components.queryItems?.isEmpty == true {
            components.queryItems = nil
        }
        return components.string ?? url
    }

    private func storeInCache(url: String, preview: LinkPreview) {
        cache[url] = CachedPreview(preview: preview, cachedAt: Date())

        // Evict oldest entries if cache is too large
        if cache.count > maxCacheSize {
            let sorted = cache.sorted { $0.value.cachedAt < $1.value.cachedAt }
            for (key, _) in sorted.prefix(cache.count - maxCacheSize) {
                cache.removeValue(forKey: key)
            }
        }
    }

    // MARK: - Network Calls

    private func fetchOpenGraphData(url: String) async throws -> OpenGraphData {
        guard let apiURL = URL(string: "\(apiBaseURL)/api/link-preview?url=\(url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url)") else {
            throw LinkPreviewError.invalidURL
        }

        var request = URLRequest(url: apiURL)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw LinkPreviewError.fetchFailed
        }

        let result = try JSONDecoder().decode(LinkPreviewAPIResponse.self, from: data)

        guard result.success, let ogData = result.data else {
            throw LinkPreviewError.fetchFailed
        }

        return OpenGraphData(
            title: ogData.title,
            description: ogData.description,
            imageURL: ogData.imageUrl,
            siteName: ogData.siteName,
            faviconURL: ogData.faviconUrl
        )
    }

    private func fetchAndCompressImage(
        url: String,
        maxWidth: Int,
        maxHeight: Int,
        maxBytes: Int,
        quality: CGFloat
    ) async throws -> CompressedImage? {
        guard isSecureURL(url) else { return nil }

        guard let apiURL = URL(string: "\(apiBaseURL)/api/image-proxy?url=\(url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url)") else {
            return nil
        }

        let (data, response) = try await session.data(from: apiURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let mimeType = httpResponse.value(forHTTPHeaderField: "Content-Type"),
              mimeType.hasPrefix("image/") else {
            return nil
        }

        guard let image = UIImage(data: data) else { return nil }

        // Scale down if needed
        var width = Int(image.size.width)
        var height = Int(image.size.height)

        if width > maxWidth || height > maxHeight {
            let widthRatio = CGFloat(maxWidth) / CGFloat(width)
            let heightRatio = CGFloat(maxHeight) / CGFloat(height)
            let ratio = min(widthRatio, heightRatio)
            width = Int(CGFloat(width) * ratio)
            height = Int(CGFloat(height) * ratio)
        }

        // Render at target size
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: CGSize(width: width, height: height)))
        }

        // Compress to JPEG, reducing quality until under maxBytes
        var currentQuality = quality
        var jpegData = resized.jpegData(compressionQuality: currentQuality)

        while let data = jpegData, data.count > maxBytes, currentQuality > 0.3 {
            currentQuality -= 0.1
            jpegData = resized.jpegData(compressionQuality: currentQuality)
        }

        guard let finalData = jpegData else { return nil }

        return CompressedImage(
            data: finalData.base64EncodedString(),
            mimeType: "image/jpeg",
            width: width,
            height: height
        )
    }

    private func fetchFavicon(url: String) async throws -> FaviconResult? {
        guard isSecureURL(url) else { return nil }

        guard let apiURL = URL(string: "\(apiBaseURL)/api/image-proxy?url=\(url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url)") else {
            return nil
        }

        let (data, response) = try await session.data(from: apiURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let mimeType = httpResponse.value(forHTTPHeaderField: "Content-Type"),
              mimeType.hasPrefix("image/"),
              data.count <= 10 * 1024 else { // Max 10KB for favicon
            return nil
        }

        return FaviconResult(
            data: data.base64EncodedString(),
            mimeType: mimeType
        )
    }
}

// MARK: - Supporting Types

/// Options for generating link previews
struct LinkPreviewOptions: Sendable {
    var maxWidth: Int = 400
    var maxHeight: Int = 400
    var maxImageBytes: Int = 50_000
    var imageQuality: CGFloat = 0.8
    var fetchFavicon: Bool = true

    static let `default` = LinkPreviewOptions()
}

/// Open Graph metadata from the API
private struct OpenGraphData {
    var title: String?
    var description: String?
    var imageURL: String?
    var siteName: String?
    var faviconURL: String?
}

/// Compressed image result
private struct CompressedImage {
    var data: String // base64
    var mimeType: String
    var width: Int
    var height: Int
}

/// Favicon fetch result
private struct FaviconResult {
    var data: String // base64
    var mimeType: String
}

/// Cache entry
private struct CachedPreview {
    let preview: LinkPreview
    let cachedAt: Date
}

/// Link preview API response shape
private struct LinkPreviewAPIResponse: Decodable {
    let success: Bool
    let data: LinkPreviewAPIData?
    let error: String?
}

private struct LinkPreviewAPIData: Decodable {
    let url: String?
    let title: String?
    let description: String?
    let imageUrl: String?
    let siteName: String?
    let faviconUrl: String?
}

/// Errors specific to link preview generation
enum LinkPreviewError: Error, LocalizedError {
    case insecureURL
    case invalidURL
    case fetchFailed
    case imageTooLarge

    var errorDescription: String? {
        switch self {
        case .insecureURL: return "Only HTTPS URLs are supported"
        case .invalidURL: return "Invalid URL"
        case .fetchFailed: return "Failed to fetch preview"
        case .imageTooLarge: return "Image exceeds size limit"
        }
    }
}
