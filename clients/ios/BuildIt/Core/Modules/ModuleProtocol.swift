// ModuleProtocol.swift
// BuildIt - Decentralized Mesh Communication
//
// Core protocol that all modules must implement.
// Provides a standard interface for module lifecycle and event handling.

import Foundation
import SwiftUI

/// A view that a module can provide
public struct ModuleView: Identifiable {
    public let id: String
    public let title: String
    public let icon: String
    public let view: AnyView
    public let order: Int

    public init<V: View>(
        id: String,
        title: String,
        icon: String,
        order: Int = 0,
        @ViewBuilder view: () -> V
    ) {
        self.id = id
        self.title = title
        self.icon = icon
        self.order = order
        self.view = AnyView(view())
    }
}

/// Protocol that all BuildIt modules must conform to
@MainActor
public protocol BuildItModule: AnyObject {
    /// Unique identifier for the module
    static var identifier: String { get }

    /// Module version (semantic versioning)
    static var version: String { get }

    /// List of module identifiers this module depends on
    static var dependencies: [String] { get }

    /// Initialize the module
    func initialize() async throws

    /// Handle incoming Nostr event
    func handleEvent(_ event: NostrEvent) async

    /// Get views this module provides
    func getViews() -> [ModuleView]

    /// Clean up module resources
    func cleanup() async

    /// Check if module is enabled for a specific group
    func isEnabled(for groupId: String?) -> Bool

    /// Enable module for a specific group
    func enable(for groupId: String?) async throws

    /// Disable module for a specific group
    func disable(for groupId: String?) async
}

/// Default implementations
public extension BuildItModule {
    static var dependencies: [String] { [] }

    func cleanup() async { }

    func isEnabled(for groupId: String?) -> Bool { true }

    func enable(for groupId: String?) async throws { }

    func disable(for groupId: String?) async { }
}

/// Error types for module operations
public enum ModuleError: LocalizedError {
    case notInitialized
    case dependencyMissing(String)
    case initializationFailed(String)
    case notEnabled
    case invalidConfiguration

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Module not initialized"
        case .dependencyMissing(let moduleId):
            return "Dependency missing: \(moduleId)"
        case .initializationFailed(let reason):
            return "Module initialization failed: \(reason)"
        case .notEnabled:
            return "Module not enabled"
        case .invalidConfiguration:
            return "Invalid module configuration"
        }
    }
}
