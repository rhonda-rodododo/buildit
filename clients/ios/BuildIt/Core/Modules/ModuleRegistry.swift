// ModuleRegistry.swift
// BuildIt - Decentralized Mesh Communication
//
// Central registry for all BuildIt modules.
// Manages module lifecycle, dependencies, and event routing.

import Foundation
import Combine
import os.log

/// Central registry for all modules in the application
@MainActor
public class ModuleRegistry: ObservableObject {
    // MARK: - Singleton

    public static let shared = ModuleRegistry()

    // MARK: - Published Properties

    @Published public private(set) var modules: [String: any BuildItModule] = [:]
    @Published public private(set) var initializedModules: Set<String> = []
    @Published public private(set) var isInitializing: Bool = false

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "ModuleRegistry")
    private let configManager = ModuleConfigurationManager.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        logger.info("Module registry initialized")
    }

    // MARK: - Module Registration

    /// Register a module in the registry
    public func register(_ module: any BuildItModule) {
        let identifier = type(of: module).identifier
        modules[identifier] = module
        logger.info("Registered module: \(identifier)")
    }

    /// Register multiple modules
    public func registerModules(_ modules: [any BuildItModule]) {
        for module in modules {
            register(module)
        }
    }

    /// Unregister a module
    public func unregister(_ moduleId: String) {
        if let module = modules[moduleId] {
            Task {
                await module.cleanup()
            }
        }
        modules.removeValue(forKey: moduleId)
        initializedModules.remove(moduleId)
        logger.info("Unregistered module: \(moduleId)")
    }

    // MARK: - Module Initialization

    /// Initialize all registered modules
    public func initializeAll() async throws {
        isInitializing = true
        defer { isInitializing = false }

        // Sort modules by dependencies
        let sortedModules = try topologicalSort(modules: Array(modules.values))

        for module in sortedModules {
            let identifier = type(of: module).identifier
            do {
                try await module.initialize()
                initializedModules.insert(identifier)
                logger.info("Initialized module: \(identifier)")
            } catch {
                logger.error("Failed to initialize module \(identifier): \(error.localizedDescription)")
                throw ModuleError.initializationFailed(error.localizedDescription)
            }
        }

        logger.info("All modules initialized successfully")
    }

    /// Initialize a specific module
    public func initialize(_ moduleId: String) async throws {
        guard let module = modules[moduleId] else {
            throw ModuleError.initializationFailed("Module not found")
        }

        // Check dependencies
        let dependencies = type(of: module).dependencies
        for dependency in dependencies {
            guard initializedModules.contains(dependency) else {
                throw ModuleError.dependencyMissing(dependency)
            }
        }

        try await module.initialize()
        initializedModules.insert(moduleId)
        logger.info("Initialized module: \(moduleId)")
    }

    // MARK: - Module Control

    /// Enable a module for a specific group
    public func enable(_ moduleId: String, for groupId: String?) async throws {
        guard let module = modules[moduleId] else {
            throw ModuleError.notInitialized
        }

        // Initialize if not already initialized
        if !initializedModules.contains(moduleId) {
            try await initialize(moduleId)
        }

        try await module.enable(for: groupId)
        configManager.enableModule(moduleId, for: groupId)
        logger.info("Enabled module \(moduleId) for group: \(groupId ?? "global")")
    }

    /// Disable a module for a specific group
    public func disable(_ moduleId: String, for groupId: String?) async {
        guard let module = modules[moduleId] else { return }

        await module.disable(for: groupId)
        configManager.disableModule(moduleId, for: groupId)
        logger.info("Disabled module \(moduleId) for group: \(groupId ?? "global")")
    }

    /// Check if a module is enabled for a specific group
    public func isEnabled(_ moduleId: String, for groupId: String?) -> Bool {
        guard let module = modules[moduleId] else { return false }
        return module.isEnabled(for: groupId) && configManager.isModuleEnabled(moduleId, for: groupId)
    }

    // MARK: - Event Handling

    /// Route an event to all interested modules
    public func routeEvent(_ event: NostrEvent) async {
        for (identifier, module) in modules {
            // Only route to initialized and enabled modules
            guard initializedModules.contains(identifier) else { continue }

            await module.handleEvent(event)
        }
    }

    /// Route an event to a specific module
    public func routeEvent(_ event: NostrEvent, to moduleId: String) async {
        guard let module = modules[moduleId],
              initializedModules.contains(moduleId) else {
            logger.warning("Cannot route event to uninitialized module: \(moduleId)")
            return
        }

        await module.handleEvent(event)
    }

    // MARK: - Module Queries

    /// Get a specific module
    public func getModule<T: BuildItModule>(_ type: T.Type) -> T? {
        modules[T.identifier] as? T
    }

    /// Get all views from enabled modules
    public func getViews(for groupId: String? = nil) -> [ModuleView] {
        modules.values
            .filter { module in
                let identifier = type(of: module).identifier
                return initializedModules.contains(identifier) &&
                       module.isEnabled(for: groupId)
            }
            .flatMap { $0.getViews() }
            .sorted { $0.order < $1.order }
    }

    /// Get views from a specific module
    public func getViews(from moduleId: String) -> [ModuleView] {
        guard let module = modules[moduleId],
              initializedModules.contains(moduleId) else {
            return []
        }
        return module.getViews()
    }

    /// Get all registered module identifiers
    public func getAllModuleIdentifiers() -> [String] {
        Array(modules.keys).sorted()
    }

    /// Get all initialized module identifiers
    public func getInitializedModuleIdentifiers() -> [String] {
        Array(initializedModules).sorted()
    }

    // MARK: - Cleanup

    /// Clean up all modules
    public func cleanupAll() async {
        for (identifier, module) in modules {
            await module.cleanup()
            logger.info("Cleaned up module: \(identifier)")
        }
        initializedModules.removeAll()
    }

    // MARK: - Private Methods

    /// Topological sort of modules based on dependencies
    private func topologicalSort(modules: [any BuildItModule]) throws -> [any BuildItModule] {
        var sorted: [any BuildItModule] = []
        var visited = Set<String>()
        var visiting = Set<String>()

        func visit(_ module: any BuildItModule) throws {
            let identifier = type(of: module).identifier

            if visiting.contains(identifier) {
                throw ModuleError.initializationFailed("Circular dependency detected: \(identifier)")
            }

            if visited.contains(identifier) {
                return
            }

            visiting.insert(identifier)

            // Visit dependencies first
            let dependencies = type(of: module).dependencies
            for dependency in dependencies {
                guard let dependencyModule = self.modules[dependency] else {
                    throw ModuleError.dependencyMissing(dependency)
                }
                try visit(dependencyModule)
            }

            visiting.remove(identifier)
            visited.insert(identifier)
            sorted.append(module)
        }

        for module in modules {
            try visit(module)
        }

        return sorted
    }
}
