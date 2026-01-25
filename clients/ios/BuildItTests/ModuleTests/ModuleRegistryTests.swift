// ModuleRegistryTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Tests for the module registry system.

import XCTest
@testable import BuildIt

@MainActor
final class ModuleRegistryTests: XCTestCase {
    var registry: ModuleRegistry!

    override func setUp() async throws {
        registry = ModuleRegistry.shared
        await registry.cleanupAll()
    }

    override func tearDown() async throws {
        await registry.cleanupAll()
    }

    func testModuleRegistration() throws {
        // Create mock module
        let module = try MockModule()

        // Register module
        registry.register(module)

        // Verify registration
        XCTAssertTrue(registry.getAllModuleIdentifiers().contains(MockModule.identifier))
        XCTAssertNotNil(registry.getModule(MockModule.self))
    }

    func testModuleInitialization() async throws {
        let module = try MockModule()
        registry.register(module)

        // Initialize module
        try await registry.initialize(MockModule.identifier)

        // Verify initialization
        XCTAssertTrue(registry.getInitializedModuleIdentifiers().contains(MockModule.identifier))
        XCTAssertTrue(module.wasInitialized)
    }

    func testModuleUnregistration() throws {
        let module = try MockModule()
        registry.register(module)

        // Unregister
        registry.unregister(MockModule.identifier)

        // Verify unregistration
        XCTAssertFalse(registry.getAllModuleIdentifiers().contains(MockModule.identifier))
        XCTAssertNil(registry.getModule(MockModule.self))
    }

    func testDependencyResolution() async throws {
        let baseModule = try MockModule()
        let dependentModule = try DependentMockModule()

        registry.registerModules([baseModule, dependentModule])

        // Initialize should work in correct order
        try await registry.initializeAll()

        // Both should be initialized
        XCTAssertTrue(registry.getInitializedModuleIdentifiers().contains(MockModule.identifier))
        XCTAssertTrue(registry.getInitializedModuleIdentifiers().contains(DependentMockModule.identifier))
    }

    func testModuleEnableDisable() async throws {
        let module = try MockModule()
        registry.register(module)
        try await registry.initialize(MockModule.identifier)

        // Enable for nil group
        try await registry.enable(MockModule.identifier, for: nil)
        XCTAssertTrue(registry.isEnabled(MockModule.identifier, for: nil))

        // Disable
        await registry.disable(MockModule.identifier, for: nil)
        XCTAssertFalse(registry.isEnabled(MockModule.identifier, for: nil))
    }
}

// MARK: - Mock Module

@MainActor
class MockModule: BuildItModule {
    static let identifier = "mock"
    static let version = "1.0.0"

    var wasInitialized = false
    var wasCleanedUp = false

    func initialize() async throws {
        wasInitialized = true
    }

    func handleEvent(_ event: NostrEvent) async {
        // Mock implementation
    }

    func getViews() -> [ModuleView] {
        []
    }

    func cleanup() async {
        wasCleanedUp = true
    }
}

// MARK: - Dependent Mock Module

@MainActor
class DependentMockModule: BuildItModule {
    static let identifier = "dependent-mock"
    static let version = "1.0.0"
    static let dependencies = ["mock"]

    var wasInitialized = false

    func initialize() async throws {
        wasInitialized = true
    }

    func handleEvent(_ event: NostrEvent) async {
        // Mock implementation
    }

    func getViews() -> [ModuleView] {
        []
    }
}
