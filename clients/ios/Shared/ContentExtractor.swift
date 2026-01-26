// ContentExtractor.swift
// BuildIt - Decentralized Mesh Communication
//
// Extracts shared content from NSExtensionContext.
// Supports text, URLs, and images.

import Foundation
import UIKit
import UniformTypeIdentifiers

/// Types of content that can be shared
enum SharedContentType: String, Codable {
    case text
    case url
    case image
    case file
}

/// Represents extracted shared content
struct SharedContent: Codable {
    let type: SharedContentType
    let text: String?
    let url: String?
    let imageData: Data?
    let fileName: String?
    let mimeType: String?

    var displayText: String {
        switch type {
        case .text:
            return text ?? ""
        case .url:
            return url ?? ""
        case .image:
            return "[Image]"
        case .file:
            return "[File: \(fileName ?? "unknown")]"
        }
    }

    var previewText: String {
        let maxLength = 100
        let display = displayText
        if display.count > maxLength {
            return String(display.prefix(maxLength)) + "..."
        }
        return display
    }
}

/// Extracts content from share extension input items
class ContentExtractor {
    /// Errors that can occur during content extraction
    enum ExtractionError: LocalizedError {
        case noInputItems
        case noAttachments
        case unsupportedType
        case loadFailed(String)

        var errorDescription: String? {
            switch self {
            case .noInputItems:
                return "No input items provided"
            case .noAttachments:
                return "No attachments found"
            case .unsupportedType:
                return "Unsupported content type"
            case .loadFailed(let reason):
                return "Failed to load content: \(reason)"
            }
        }
    }

    /// Type identifiers we support
    private static let supportedTextTypes = [
        UTType.plainText.identifier,
        UTType.text.identifier,
        "public.text"
    ]

    private static let supportedURLTypes = [
        UTType.url.identifier,
        "public.url"
    ]

    private static let supportedImageTypes = [
        UTType.image.identifier,
        UTType.jpeg.identifier,
        UTType.png.identifier,
        UTType.gif.identifier,
        UTType.webP.identifier,
        "public.image"
    ]

    /// Extract all shared content from an extension context
    static func extractContent(from context: NSExtensionContext) async throws -> [SharedContent] {
        guard let inputItems = context.inputItems as? [NSExtensionItem],
              !inputItems.isEmpty else {
            throw ExtractionError.noInputItems
        }

        var contents: [SharedContent] = []

        for item in inputItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                if let content = try? await extractFromAttachment(attachment) {
                    contents.append(content)
                }
            }
        }

        if contents.isEmpty {
            throw ExtractionError.noAttachments
        }

        return contents
    }

    /// Extract content from a single attachment
    private static func extractFromAttachment(_ attachment: NSItemProvider) async throws -> SharedContent {
        // Try text first
        for typeIdentifier in supportedTextTypes {
            if attachment.hasItemConformingToTypeIdentifier(typeIdentifier) {
                return try await extractText(from: attachment, typeIdentifier: typeIdentifier)
            }
        }

        // Try URL
        for typeIdentifier in supportedURLTypes {
            if attachment.hasItemConformingToTypeIdentifier(typeIdentifier) {
                return try await extractURL(from: attachment, typeIdentifier: typeIdentifier)
            }
        }

        // Try image
        for typeIdentifier in supportedImageTypes {
            if attachment.hasItemConformingToTypeIdentifier(typeIdentifier) {
                return try await extractImage(from: attachment, typeIdentifier: typeIdentifier)
            }
        }

        throw ExtractionError.unsupportedType
    }

    /// Extract plain text content
    private static func extractText(from attachment: NSItemProvider, typeIdentifier: String) async throws -> SharedContent {
        return try await withCheckedThrowingContinuation { continuation in
            attachment.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error = error {
                    continuation.resume(throwing: ExtractionError.loadFailed(error.localizedDescription))
                    return
                }

                var text: String?

                if let string = item as? String {
                    text = string
                } else if let data = item as? Data {
                    text = String(data: data, encoding: .utf8)
                } else if let url = item as? URL {
                    // Handle file URLs containing text
                    text = try? String(contentsOf: url, encoding: .utf8)
                }

                if let text = text {
                    continuation.resume(returning: SharedContent(
                        type: .text,
                        text: text,
                        url: nil,
                        imageData: nil,
                        fileName: nil,
                        mimeType: "text/plain"
                    ))
                } else {
                    continuation.resume(throwing: ExtractionError.loadFailed("Could not convert to text"))
                }
            }
        }
    }

    /// Extract URL content
    private static func extractURL(from attachment: NSItemProvider, typeIdentifier: String) async throws -> SharedContent {
        return try await withCheckedThrowingContinuation { continuation in
            attachment.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error = error {
                    continuation.resume(throwing: ExtractionError.loadFailed(error.localizedDescription))
                    return
                }

                var urlString: String?

                if let url = item as? URL {
                    urlString = url.absoluteString
                } else if let string = item as? String {
                    urlString = string
                } else if let data = item as? Data {
                    urlString = String(data: data, encoding: .utf8)
                }

                if let urlString = urlString {
                    continuation.resume(returning: SharedContent(
                        type: .url,
                        text: nil,
                        url: urlString,
                        imageData: nil,
                        fileName: nil,
                        mimeType: "text/uri-list"
                    ))
                } else {
                    continuation.resume(throwing: ExtractionError.loadFailed("Could not extract URL"))
                }
            }
        }
    }

    /// Extract image content
    private static func extractImage(from attachment: NSItemProvider, typeIdentifier: String) async throws -> SharedContent {
        return try await withCheckedThrowingContinuation { continuation in
            attachment.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error = error {
                    continuation.resume(throwing: ExtractionError.loadFailed(error.localizedDescription))
                    return
                }

                var imageData: Data?
                var fileName: String?
                var mimeType: String = "image/jpeg"

                if let image = item as? UIImage {
                    // Compress to JPEG for smaller size
                    imageData = image.jpegData(compressionQuality: 0.8)
                    fileName = "shared_image.jpg"
                } else if let url = item as? URL {
                    imageData = try? Data(contentsOf: url)
                    fileName = url.lastPathComponent

                    // Determine MIME type from extension
                    let ext = url.pathExtension.lowercased()
                    switch ext {
                    case "png":
                        mimeType = "image/png"
                    case "gif":
                        mimeType = "image/gif"
                    case "webp":
                        mimeType = "image/webp"
                    default:
                        mimeType = "image/jpeg"
                    }
                } else if let data = item as? Data {
                    imageData = data
                    fileName = "shared_image"

                    // Try to detect image type from data
                    if let detectedType = detectImageType(from: data) {
                        mimeType = detectedType
                    }
                }

                if let imageData = imageData {
                    // Resize if too large (max 2MB for sharing)
                    let maxSize = 2 * 1024 * 1024
                    var finalData = imageData

                    if imageData.count > maxSize, let image = UIImage(data: imageData) {
                        // Reduce quality or size
                        var quality: CGFloat = 0.7
                        while finalData.count > maxSize && quality > 0.1 {
                            if let compressed = image.jpegData(compressionQuality: quality) {
                                finalData = compressed
                            }
                            quality -= 0.1
                        }
                    }

                    continuation.resume(returning: SharedContent(
                        type: .image,
                        text: nil,
                        url: nil,
                        imageData: finalData,
                        fileName: fileName,
                        mimeType: mimeType
                    ))
                } else {
                    continuation.resume(throwing: ExtractionError.loadFailed("Could not load image data"))
                }
            }
        }
    }

    /// Detect image type from data magic bytes
    private static func detectImageType(from data: Data) -> String? {
        guard data.count >= 4 else { return nil }

        let bytes = [UInt8](data.prefix(4))

        // PNG: 89 50 4E 47
        if bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 {
            return "image/png"
        }

        // JPEG: FF D8 FF
        if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
            return "image/jpeg"
        }

        // GIF: 47 49 46 38
        if bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38 {
            return "image/gif"
        }

        // WebP: 52 49 46 46 ... 57 45 42 50
        if bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46,
           data.count >= 12 {
            let webpBytes = [UInt8](data[8..<12])
            if webpBytes == [0x57, 0x45, 0x42, 0x50] {
                return "image/webp"
            }
        }

        return nil
    }

    /// Create a combined text representation of multiple shared contents
    static func combineContents(_ contents: [SharedContent]) -> String {
        var parts: [String] = []

        for content in contents {
            switch content.type {
            case .text:
                if let text = content.text {
                    parts.append(text)
                }
            case .url:
                if let url = content.url {
                    parts.append(url)
                }
            case .image:
                parts.append("[Image attached]")
            case .file:
                parts.append("[File: \(content.fileName ?? "attached")]")
            }
        }

        return parts.joined(separator: "\n\n")
    }
}
