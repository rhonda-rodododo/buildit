// FileUploadService.swift
// BuildIt - Decentralized Mesh Communication
//
// Service for uploading files to file hosting services.

import Foundation
import os.log
import UniformTypeIdentifiers

/// Service for uploading files to file hosts
actor FileUploadService {
    // MARK: - Singleton

    static let shared = FileUploadService()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "FileUploadService")
    private let session: URLSession

    // MARK: - Initialization

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        session = URLSession(configuration: config)
    }

    // MARK: - Public Methods

    /// Uploads a file to the configured file host
    /// - Parameters:
    ///   - data: The file data to upload
    ///   - filename: The filename for the upload
    ///   - mimeType: The MIME type of the file
    /// - Returns: Upload result containing the remote URL
    func uploadFile(data: Data, filename: String, mimeType: String) async throws -> UploadResult {
        // Try nostr.build first
        do {
            return try await uploadToNostrBuild(data: data, filename: filename, mimeType: mimeType)
        } catch {
            logger.warning("nostr.build failed, trying void.cat: \(error.localizedDescription)")
            return try await uploadToVoidCat(data: data, filename: filename, mimeType: mimeType)
        }
    }

    /// Uploads an image from the photo library
    func uploadImage(imageData: Data, quality: CGFloat = 0.8) async throws -> UploadResult {
        // Compress if it's a JPEG
        let mimeType = "image/jpeg"
        let filename = "image_\(Int(Date().timeIntervalSince1970)).jpg"

        return try await uploadFile(data: imageData, filename: filename, mimeType: mimeType)
    }

    /// Uploads a file from a local URL
    func uploadFile(from fileURL: URL) async throws -> UploadResult {
        let data = try Data(contentsOf: fileURL)
        let filename = fileURL.lastPathComponent

        // Determine MIME type
        let mimeType: String
        if let uti = UTType(filenameExtension: fileURL.pathExtension) {
            mimeType = uti.preferredMIMEType ?? "application/octet-stream"
        } else {
            mimeType = "application/octet-stream"
        }

        return try await uploadFile(data: data, filename: filename, mimeType: mimeType)
    }

    // MARK: - Private Methods

    private func uploadToNostrBuild(data: Data, filename: String, mimeType: String) async throws -> UploadResult {
        let url = URL(string: "https://nostr.build/api/v2/upload/files")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (responseData, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw FileUploadError.uploadFailed("Invalid response status")
        }

        // Parse nostr.build response
        let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        guard let status = json?["status"] as? String, status == "success",
              let dataArray = json?["data"] as? [[String: Any]],
              let firstFile = dataArray.first,
              let uploadedUrl = firstFile["url"] as? String else {
            throw FileUploadError.uploadFailed("Invalid response format")
        }

        let dimensions = firstFile["dimensions"] as? [String: Int]
        let width = dimensions?["width"]
        let height = dimensions?["height"]

        logger.info("Uploaded to nostr.build: \(uploadedUrl)")

        return UploadResult(
            url: uploadedUrl,
            width: width,
            height: height,
            mimeType: mimeType,
            fileSize: data.count
        )
    }

    private func uploadToVoidCat(data: Data, filename: String, mimeType: String) async throws -> UploadResult {
        let url = URL(string: "https://void.cat/upload")!

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "V-Content-Type")
        request.setValue(filename, forHTTPHeaderField: "V-Filename")
        request.httpBody = data

        let (responseData, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw FileUploadError.uploadFailed("Invalid response status")
        }

        // Parse void.cat response
        let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        guard let fileId = json?["id"] as? String else {
            throw FileUploadError.uploadFailed("Invalid response format")
        }

        let uploadedUrl = "https://void.cat/d/\(fileId)"
        logger.info("Uploaded to void.cat: \(uploadedUrl)")

        return UploadResult(
            url: uploadedUrl,
            width: nil,
            height: nil,
            mimeType: mimeType,
            fileSize: data.count
        )
    }
}

// MARK: - Supporting Types

/// Result of a successful file upload
struct UploadResult: Sendable {
    let url: String
    let width: Int?
    let height: Int?
    let mimeType: String
    let fileSize: Int
}

/// Errors that can occur during file upload
enum FileUploadError: Error, LocalizedError {
    case uploadFailed(String)
    case invalidFile
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .uploadFailed(let message):
            return "Upload failed: \(message)"
        case .invalidFile:
            return "Invalid file"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}
