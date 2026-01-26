// AvatarImageLoader.swift
// BuildIt - Decentralized Mesh Communication
//
// Handles avatar image loading with caching for efficient display.

import Foundation
import SwiftUI
import os.log

/// Service for loading and caching avatar images
actor AvatarImageLoader {
    // MARK: - Singleton

    static let shared = AvatarImageLoader()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "AvatarImageLoader")
    private var memoryCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 100  // Max 100 images in memory
        cache.totalCostLimit = 50 * 1024 * 1024  // 50 MB max
        return cache
    }()

    private let diskCacheURL: URL
    private var downloadTasks: [URL: Task<UIImage?, Error>] = [:]

    // MARK: - Initialization

    private init() {
        let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        diskCacheURL = cacheDirectory.appendingPathComponent("avatars")

        // Create cache directory if needed
        try? FileManager.default.createDirectory(at: diskCacheURL, withIntermediateDirectories: true)

        // Clear old cache entries on init
        Task {
            await cleanupOldCache()
        }
    }

    // MARK: - Public Methods

    /// Loads an avatar image from URL with caching
    func loadAvatar(from url: URL) async -> UIImage? {
        let cacheKey = url.absoluteString as NSString

        // Check memory cache first
        if let cached = memoryCache.object(forKey: cacheKey) {
            return cached
        }

        // Check disk cache
        if let diskCached = loadFromDiskCache(url: url) {
            // Store in memory cache for faster access
            memoryCache.setObject(diskCached, forKey: cacheKey)
            return diskCached
        }

        // Check if we're already downloading this image
        if let existingTask = downloadTasks[url] {
            return try? await existingTask.value
        }

        // Download the image
        let downloadTask = Task<UIImage?, Error> {
            do {
                let (data, response) = try await URLSession.shared.data(from: url)

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    logger.warning("Failed to load avatar: Invalid response")
                    return nil
                }

                guard let image = UIImage(data: data) else {
                    logger.warning("Failed to decode avatar image")
                    return nil
                }

                // Resize if too large
                let resized = resizeImage(image, maxSize: 200)

                // Cache in memory
                memoryCache.setObject(resized, forKey: cacheKey)

                // Cache on disk
                saveToDiskCache(image: resized, url: url)

                logger.debug("Loaded and cached avatar from \(url.absoluteString)")
                return resized

            } catch {
                logger.error("Failed to download avatar: \(error.localizedDescription)")
                return nil
            }
        }

        downloadTasks[url] = downloadTask
        defer { downloadTasks.removeValue(forKey: url) }

        return try? await downloadTask.value
    }

    /// Loads an avatar image from a URL string
    func loadAvatar(from urlString: String) async -> UIImage? {
        guard let url = URL(string: urlString) else {
            return nil
        }
        return await loadAvatar(from: url)
    }

    /// Preloads avatars for multiple URLs
    func preloadAvatars(urls: [URL]) {
        for url in urls {
            Task {
                _ = await loadAvatar(from: url)
            }
        }
    }

    /// Clears all cached avatars
    func clearCache() {
        memoryCache.removeAllObjects()
        try? FileManager.default.removeItem(at: diskCacheURL)
        try? FileManager.default.createDirectory(at: diskCacheURL, withIntermediateDirectories: true)
        logger.info("Cleared avatar cache")
    }

    // MARK: - Private Methods

    private func diskCachePath(for url: URL) -> URL {
        let filename = url.absoluteString.data(using: .utf8)?.base64EncodedString() ?? UUID().uuidString
        return diskCacheURL.appendingPathComponent(filename)
    }

    private func loadFromDiskCache(url: URL) -> UIImage? {
        let path = diskCachePath(for: url)
        guard FileManager.default.fileExists(atPath: path.path),
              let data = try? Data(contentsOf: path),
              let image = UIImage(data: data) else {
            return nil
        }
        return image
    }

    private func saveToDiskCache(image: UIImage, url: URL) {
        let path = diskCachePath(for: url)
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        try? data.write(to: path)
    }

    private func resizeImage(_ image: UIImage, maxSize: CGFloat) -> UIImage {
        let size = image.size
        guard size.width > maxSize || size.height > maxSize else {
            return image
        }

        let scale = min(maxSize / size.width, maxSize / size.height)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resized = UIGraphicsGetImageFromCurrentImageContext() ?? image
        UIGraphicsEndImageContext()

        return resized
    }

    private func cleanupOldCache() async {
        let maxAge: TimeInterval = 7 * 24 * 60 * 60  // 7 days

        do {
            let files = try FileManager.default.contentsOfDirectory(at: diskCacheURL, includingPropertiesForKeys: [.creationDateKey])

            for file in files {
                let attributes = try file.resourceValues(forKeys: [.creationDateKey])
                if let creationDate = attributes.creationDate,
                   Date().timeIntervalSince(creationDate) > maxAge {
                    try FileManager.default.removeItem(at: file)
                }
            }
        } catch {
            logger.warning("Failed to cleanup cache: \(error.localizedDescription)")
        }
    }
}

// MARK: - SwiftUI Integration

/// A SwiftUI view that displays a cached avatar image
struct CachedAvatarImage: View {
    let url: String?
    let fallbackText: String
    let size: CGFloat

    @State private var image: UIImage?
    @State private var isLoading = false

    init(url: String?, fallbackText: String, size: CGFloat = 50) {
        self.url = url
        self.fallbackText = fallbackText
        self.size = size
    }

    var body: some View {
        ZStack {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: size, height: size)
                    .overlay {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                        } else {
                            Text(fallbackText.prefix(1).uppercased())
                                .font(.system(size: size * 0.4))
                                .foregroundColor(.blue)
                        }
                    }
            }
        }
        .task {
            await loadImage()
        }
    }

    private func loadImage() async {
        guard let urlString = url, !urlString.isEmpty else { return }

        isLoading = true
        image = await AvatarImageLoader.shared.loadAvatar(from: urlString)
        isLoading = false
    }
}

// MARK: - UIImage Extension

extension UIImage: @unchecked Sendable {}
