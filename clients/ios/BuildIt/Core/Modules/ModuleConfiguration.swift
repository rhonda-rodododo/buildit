// ModuleConfiguration.swift
// BuildIt - Decentralized Mesh Communication
//
// Per-group module configuration management.
// Allows groups to enable/disable modules independently.

import Foundation
import os.log

/// Configuration for modules per group
public struct ModuleConfiguration: Codable, Identifiable {
    public let id: String  // groupId or "global" for app-wide
    public var enabledModules: Set<String>
    public var moduleSettings: [String: [String: AnyCodable]]
    public var updatedAt: Date

    public init(id: String, enabledModules: Set<String> = []) {
        self.id = id
        self.enabledModules = enabledModules
        self.moduleSettings = [:]
        self.updatedAt = Date()
    }

    /// Check if a module is enabled
    public func isModuleEnabled(_ moduleId: String) -> Bool {
        enabledModules.contains(moduleId)
    }

    /// Get settings for a specific module
    public func getSettings(for moduleId: String) -> [String: AnyCodable]? {
        moduleSettings[moduleId]
    }

    /// Update settings for a module
    public mutating func updateSettings(for moduleId: String, settings: [String: AnyCodable]) {
        moduleSettings[moduleId] = settings
        updatedAt = Date()
    }
}

/// Manages module configurations across groups
@MainActor
public class ModuleConfigurationManager: ObservableObject {
    // MARK: - Singleton

    public static let shared = ModuleConfigurationManager()

    // MARK: - Published Properties

    @Published public private(set) var configurations: [String: ModuleConfiguration] = [:]

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "ModuleConfiguration")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let fileManager = FileManager.default

    // MARK: - Initialization

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        loadConfigurations()
    }

    // MARK: - Public Methods

    /// Get configuration for a group (or global if nil)
    public func getConfiguration(for groupId: String?) -> ModuleConfiguration {
        let id = groupId ?? "global"
        return configurations[id] ?? ModuleConfiguration(id: id)
    }

    /// Enable a module for a group
    public func enableModule(_ moduleId: String, for groupId: String?) {
        let id = groupId ?? "global"
        var config = configurations[id] ?? ModuleConfiguration(id: id)
        config.enabledModules.insert(moduleId)
        config.updatedAt = Date()
        configurations[id] = config
        saveConfigurations()

        logger.info("Enabled module \(moduleId) for \(id)")
    }

    /// Disable a module for a group
    public func disableModule(_ moduleId: String, for groupId: String?) {
        let id = groupId ?? "global"
        var config = configurations[id] ?? ModuleConfiguration(id: id)
        config.enabledModules.remove(moduleId)
        config.updatedAt = Date()
        configurations[id] = config
        saveConfigurations()

        logger.info("Disabled module \(moduleId) for \(id)")
    }

    /// Check if module is enabled for a group
    public func isModuleEnabled(_ moduleId: String, for groupId: String?) -> Bool {
        let id = groupId ?? "global"
        return configurations[id]?.isModuleEnabled(moduleId) ?? false
    }

    /// Update settings for a module in a group
    public func updateSettings(
        for moduleId: String,
        in groupId: String?,
        settings: [String: AnyCodable]
    ) {
        let id = groupId ?? "global"
        var config = configurations[id] ?? ModuleConfiguration(id: id)
        config.updateSettings(for: moduleId, settings: settings)
        configurations[id] = config
        saveConfigurations()
    }

    /// Get settings for a module in a group
    public func getSettings(for moduleId: String, in groupId: String?) -> [String: AnyCodable]? {
        let id = groupId ?? "global"
        return configurations[id]?.getSettings(for: moduleId)
    }

    // MARK: - Persistence

    private func saveConfigurations() {
        let url = getDocumentsDirectory().appendingPathComponent("module_configurations.json")
        do {
            let data = try encoder.encode(configurations)
            try data.write(to: url, options: .atomic)
        } catch {
            logger.error("Failed to save configurations: \(error.localizedDescription)")
        }
    }

    private func loadConfigurations() {
        let url = getDocumentsDirectory().appendingPathComponent("module_configurations.json")
        guard let data = try? Data(contentsOf: url) else { return }
        do {
            configurations = try decoder.decode([String: ModuleConfiguration].self, from: data)
            logger.info("Loaded module configurations")
        } catch {
            logger.error("Failed to load configurations: \(error.localizedDescription)")
        }
    }

    private func getDocumentsDirectory() -> URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}

/// Type-erased codable for dynamic settings
public struct AnyCodable: Codable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else if let arrayValue = try? container.decode([AnyCodable].self) {
            value = arrayValue.map { $0.value }
        } else if let dictValue = try? container.decode([String: AnyCodable].self) {
            value = dictValue.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported type"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let intValue as Int:
            try container.encode(intValue)
        case let doubleValue as Double:
            try container.encode(doubleValue)
        case let stringValue as String:
            try container.encode(stringValue)
        case let boolValue as Bool:
            try container.encode(boolValue)
        case let arrayValue as [Any]:
            try container.encode(arrayValue.map { AnyCodable($0) })
        case let dictValue as [String: Any]:
            try container.encode(dictValue.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(
                value,
                EncodingError.Context(
                    codingPath: container.codingPath,
                    debugDescription: "Unsupported type"
                )
            )
        }
    }
}
