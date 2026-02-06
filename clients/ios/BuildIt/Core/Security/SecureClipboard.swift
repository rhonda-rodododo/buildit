// SecureClipboard.swift
// BuildIt - Decentralized Mesh Communication
//
// Provides a secure clipboard helper that sets pasteboard content with
// an expiration date so sensitive data does not persist indefinitely.

import UIKit
import UniformTypeIdentifiers

/// Secure clipboard utilities for BuildIt.
///
/// All clipboard writes should go through this helper so that sensitive
/// content (keys, addresses, etc.) is automatically purged after a short
/// window. iOS enforces the expiration server-side once the date is set
/// via `UIPasteboard.setItems(_:options:)`.
enum SecureClipboard {
    /// Default expiration interval for pasteboard content (60 seconds).
    static let defaultExpiration: TimeInterval = 60

    /// Copy `text` to the system pasteboard with an expiration date.
    ///
    /// After `expiration` seconds the system will automatically remove the
    /// item from the pasteboard. This prevents sensitive strings such as
    /// private keys, crypto addresses, or campaign links from lingering
    /// indefinitely.
    ///
    /// - Parameters:
    ///   - text: The string to place on the pasteboard.
    ///   - expiration: Seconds until the pasteboard entry expires.
    ///     Defaults to ``defaultExpiration`` (60 s).
    static func copy(_ text: String, expiration: TimeInterval = defaultExpiration) {
        let item: [String: Any] = [UTType.plainText.identifier: text]
        let options: [UIPasteboard.OptionsKey: Any] = [
            .expirationDate: Date().addingTimeInterval(expiration)
        ]
        UIPasteboard.general.setItems([item], options: options)
    }
}
