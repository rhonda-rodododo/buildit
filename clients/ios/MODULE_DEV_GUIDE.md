# Module Development Guide

Quick reference for creating new modules in the iOS client.

## Creating a New Module

### 1. Create Directory Structure

```
BuildIt/Modules/YourModule/
├── Models/
│   └── YourModuleEntity.swift
├── Views/
│   ├── YourModuleListView.swift
│   └── YourModuleDetailView.swift
├── YourModuleStore.swift
├── YourModuleService.swift
└── YourModuleModule.swift
```

### 2. Create SwiftData Models

```swift
// Models/YourModuleEntity.swift
import Foundation
import SwiftData

@Model
public final class YourModuleEntity {
    @Attribute(.unique) public var id: String
    public var schemaVersion: String
    // ... your fields

    // Convert from generated schema type
    public static func from(_ item: GeneratedType) -> YourModuleEntity {
        // conversion logic
    }

    // Convert to generated schema type
    public func toGeneratedType() -> GeneratedType {
        // conversion logic
    }
}
```

### 3. Create Store

```swift
// YourModuleStore.swift
import Foundation
import SwiftData
import os.log

@MainActor
public class YourModuleStore: ObservableObject {
    @Published public private(set) var items: [YourModuleEntity] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public var lastError: String?

    private let modelContainer: ModelContainer
    private let modelContext: ModelContext
    private let logger = Logger(subsystem: "com.buildit", category: "YourModuleStore")

    public init() throws {
        let schema = Schema([YourModuleEntity.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(for: schema, configurations: [configuration])
        self.modelContext = ModelContext(modelContainer)
        loadItems()
    }

    public func loadItems() {
        // SwiftData fetch logic
    }

    public func save(_ item: YourModuleEntity) throws {
        modelContext.insert(item)
        try modelContext.save()
        loadItems()
    }
}
```

### 4. Create Service

```swift
// YourModuleService.swift
import Foundation
import os.log

@MainActor
public class YourModuleService {
    private let store: YourModuleStore
    private let nostrClient: NostrClient
    private let cryptoManager: CryptoManager
    private let logger = Logger(subsystem: "com.buildit", category: "YourModuleService")

    public init(store: YourModuleStore) {
        self.store = store
        self.nostrClient = NostrClient.shared
        self.cryptoManager = CryptoManager.shared
    }

    public func createItem(/* params */) async throws -> GeneratedType {
        // Business logic
        // Publish to Nostr
        // Save to store
    }

    public func processNostrEvent(_ event: NostrEvent) async {
        // Handle incoming Nostr events
    }
}
```

### 5. Create Module

```swift
// YourModuleModule.swift
import Foundation
import SwiftUI
import os.log

@MainActor
public final class YourModuleModule: BuildItModule {
    // MARK: - Module Metadata
    public static let identifier = "your-module"
    public static let version = "1.0.0"
    public static let dependencies: [String] = [] // or ["other-module"]

    private let store: YourModuleStore
    private let service: YourModuleService
    private let configManager = ModuleConfigurationManager.shared
    private let logger = Logger(subsystem: "com.buildit", category: "YourModuleModule")

    public init() throws {
        self.store = try YourModuleStore()
        self.service = YourModuleService(store: store)
    }

    // MARK: - BuildItModule Implementation
    public func initialize() async throws {
        logger.info("Initializing YourModule")
        try await enable(for: nil)
    }

    public func handleEvent(_ event: NostrEvent) async {
        await service.processNostrEvent(event)
    }

    public func getViews() -> [ModuleView] {
        [
            ModuleView(
                id: "your-module-list",
                title: "Your Module",
                icon: "star.fill",
                order: 30
            ) {
                YourModuleListView(store: store, service: service)
            }
        ]
    }

    public func cleanup() async {
        logger.info("Cleaning up YourModule")
    }

    public func isEnabled(for groupId: String?) -> Bool {
        configManager.isModuleEnabled(Self.identifier, for: groupId)
    }

    public func enable(for groupId: String?) async throws {
        configManager.enableModule(Self.identifier, for: groupId)
    }

    public func disable(for groupId: String?) async {
        configManager.disableModule(Self.identifier, for: groupId)
    }

    // MARK: - Public API
    public func publicMethod(/* params */) async throws -> ReturnType {
        try await service.createItem(/* params */)
    }
}
```

### 6. Create Views

```swift
// Views/YourModuleListView.swift
import SwiftUI

public struct YourModuleListView: View {
    @ObservedObject var store: YourModuleStore
    let service: YourModuleService

    public var body: some View {
        NavigationStack {
            List(store.items) { item in
                // Row view
            }
            .navigationTitle("Your Module")
        }
    }
}
```

### 7. Register Module

In `BuildItApp.swift`:

```swift
let yourModule = try YourModuleModule()
moduleRegistry.registerModules([
    eventsModule,
    messagingModule,
    yourModule  // Add here
])
```

### 8. Create Tests

```swift
// BuildItTests/ModuleTests/YourModuleTests.swift
import XCTest
@testable import BuildIt

@MainActor
final class YourModuleTests: XCTestCase {
    var module: YourModuleModule!

    override func setUp() async throws {
        module = try YourModuleModule()
        try await module.initialize()
    }

    func testCreateItem() async throws {
        // Test logic
    }
}
```

## Best Practices

### DO
- ✅ Use `@MainActor` for stores and modules
- ✅ Use async/await for all async operations
- ✅ Use SwiftData for persistence
- ✅ Convert to/from generated schema types
- ✅ Publish to Nostr for sync
- ✅ Use structured logging
- ✅ Handle errors gracefully
- ✅ Write comprehensive tests
- ✅ Document public APIs
- ✅ Follow existing patterns

### DON'T
- ❌ Block the main thread
- ❌ Use `Any` except in AnyCodable
- ❌ Store sensitive data unencrypted
- ❌ Skip error handling
- ❌ Forget to clean up resources
- ❌ Hardcode strings (use localization)
- ❌ Create circular dependencies
- ❌ Skip input validation

## Common Patterns

### Error Handling

```swift
public enum YourModuleError: LocalizedError {
    case itemNotFound
    case invalidData

    public var errorDescription: String? {
        switch self {
        case .itemNotFound:
            return "Item not found"
        case .invalidData:
            return "Invalid data"
        }
    }
}
```

### Nostr Publishing

```swift
let encoder = JSONEncoder()
let data = try encoder.encode(item)
let content = String(data: data, encoding: .utf8) ?? ""

let tags: [[String]] = [
    ["d", item.id],
    ["group", groupId]
]

_ = try await nostrClient.publishEvent(
    kind: NostrEventKind(rawValue: customKind) ?? .textNote,
    content: content,
    tags: tags
)
```

### SwiftData Queries

```swift
let descriptor = FetchDescriptor<YourModuleEntity>(
    predicate: #Predicate { $0.someField == someValue },
    sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
)
let items = try modelContext.fetch(descriptor)
```

### View Navigation

```swift
NavigationStack {
    List {
        ForEach(items) { item in
            NavigationLink(value: item) {
                ItemRow(item: item)
            }
        }
    }
    .navigationDestination(for: YourModuleEntity.self) { item in
        DetailView(item: item)
    }
}
```

## Troubleshooting

### Module Not Appearing
- Check module is registered in `BuildItApp.swift`
- Verify `initialize()` was called
- Check module is enabled: `moduleRegistry.isEnabled(identifier, for: nil)`

### Events Not Processing
- Verify Nostr event kind is handled in `processNostrEvent()`
- Check event routing is set up in app initialization
- Verify event content can be decoded

### SwiftData Issues
- Check model is in schema
- Verify unique constraints
- Check relationships are properly defined
- Ensure ModelContext is saved after changes

### View Not Showing
- Check `getViews()` returns the view
- Verify view is added to UI in `ContentView`
- Check module is initialized

## Resources

- [SwiftData Documentation](https://developer.apple.com/documentation/swiftdata)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Nostr Protocol](https://github.com/nostr-protocol/nips)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-52: Calendar Events](https://github.com/nostr-protocol/nips/blob/master/52.md)

## Examples

See existing modules:
- `BuildIt/Modules/Events/` - Full CRUD with relationships
- `BuildIt/Modules/Messaging/` - Real-time updates, ephemeral events
