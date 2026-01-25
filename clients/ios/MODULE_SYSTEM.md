# iOS Module System Implementation

## Overview

The iOS client now has a complete module system architecture that allows for modular, extensible features. Two core modules have been implemented: **Events** and **Messaging**.

## Architecture

### Core Module System

Located in `BuildIt/Core/Modules/`:

1. **ModuleProtocol.swift**
   - Defines the `BuildItModule` protocol that all modules must implement
   - Provides `ModuleView` for UI integration
   - Includes `ModuleError` for error handling

2. **ModuleConfiguration.swift**
   - Per-group module configuration management
   - Allows modules to be enabled/disabled per group or globally
   - Persists settings using JSON encoding

3. **ModuleRegistry.swift**
   - Central registry for all modules
   - Manages module lifecycle (registration, initialization, cleanup)
   - Handles dependency resolution using topological sort
   - Routes Nostr events to appropriate modules

### Module Structure

Each module follows this structure:
```
BuildIt/Modules/{ModuleName}/
├── Models/
│   └── {ModuleName}Entity.swift    # SwiftData models
├── {ModuleName}Store.swift          # State management
├── {ModuleName}Service.swift        # Business logic
├── {ModuleName}Module.swift         # Module definition
└── Views/
    ├── {ModuleName}ListView.swift
    ├── {ModuleName}DetailView.swift
    └── Create{ModuleName}View.swift
```

## Events Module

**Location**: `BuildIt/Modules/Events/`

### Features

- Create and manage events with date/time, location, and RSVP tracking
- Support for virtual events (with meeting URLs)
- All-day events and timezone support
- Maximum attendee limits and RSVP deadlines
- Rich event details (descriptions, locations, attachments)
- RSVP management (Going/Maybe/Can't Go)
- Guest count tracking
- Event recurrence (future support)

### Key Components

1. **EventEntity** & **RsvpEntity** (SwiftData)
   - Persist events and RSVPs locally
   - Convert to/from generated schema types

2. **EventsStore**
   - SwiftData-based state management
   - CRUD operations for events and RSVPs
   - Search and filtering capabilities
   - RSVP count aggregation

3. **EventsService**
   - Business logic for event operations
   - Nostr event publishing (NIP-52 calendar events)
   - Event validation (deadlines, capacity)
   - Processes incoming Nostr events

4. **EventsModule**
   - Module interface implementation
   - Public API for event operations
   - View provisioning

5. **Views**
   - `EventsListView`: Browse upcoming and past events
   - `EventDetailView`: View event details and RSVP status
   - `CreateEventView`: Form for creating new events
   - `RSVPView`: Submit or update RSVP

### Schema Integration

Uses generated types from `Sources/Generated/Schemas/events.swift`:
- `Event` - Event data structure
- `Rsvp` - RSVP response
- `Location` - Physical location
- `RecurrenceRule` - Recurrence patterns
- `Attachment` - Event attachments

### Nostr Event Kinds

- **31922**: Calendar event (NIP-52)
- **31925**: Calendar event RSVP (NIP-52)
- **5**: Event deletion

## Messaging Module

**Location**: `BuildIt/Modules/Messaging/`

### Features

- Direct messages using NIP-17 gift wrap encryption
- Group messages
- Message threading
- Reactions (emoji)
- Read receipts
- Typing indicators
- Message mentions
- Media attachments (images, audio, video, files)

### Key Components

1. **Message Entities** (SwiftData)
   - `DirectMessageEntity`: DM storage
   - `GroupMessageEntity`: Group message storage
   - `ReactionEntity`: Message reactions
   - `ReadReceiptEntity`: Read status tracking

2. **MessagingStore**
   - SwiftData-based persistence
   - Message CRUD operations
   - Reaction and read receipt management
   - Conversation aggregation

3. **MessagingService**
   - Message sending with NIP-17 encryption
   - Reaction handling
   - Read receipt management
   - Typing indicator broadcasting
   - Processes incoming Nostr events

4. **MessagingModule**
   - Module interface implementation
   - Public API for messaging operations
   - Integrates with existing ChatView

### Schema Integration

Uses generated types from `Sources/Generated/Schemas/messaging.swift`:
- `DirectMessage` - DM content
- `GroupMessage` - Group message content
- `Reaction` - Message reaction
- `ReadReceipt` - Read status
- `TypingIndicator` - Typing status
- `Attachment` - Media attachments

### Nostr Event Kinds

- **1059**: Gift wrap (NIP-17)
- **30001**: Group message (custom)
- **7**: Reaction
- **15**: Read receipt (ephemeral)
- **16**: Typing indicator (ephemeral)

## Integration

### App Initialization

In `BuildItApp.swift`:

```swift
// Register modules
let eventsModule = try EventsModule()
let messagingModule = try MessagingModule()

moduleRegistry.registerModules([
    eventsModule,
    messagingModule
])

// Initialize all modules
try await moduleRegistry.initializeAll()

// Route Nostr events to modules
nostrClient.onEvent { event in
    Task {
        await moduleRegistry.routeEvent(event)
    }
}
```

### UI Integration

Events module provides a tab in the main interface:

```swift
// In ContentView
if let eventsModule = moduleRegistry.getModule(EventsModule.self),
   let eventsView = eventsModule.getViews().first {
    eventsView.view
        .tabItem {
            Label("Events", systemImage: "calendar")
        }
}
```

Messaging module enhances the existing ChatView without requiring UI changes.

## Testing

### Test Coverage

Located in `BuildItTests/ModuleTests/`:

1. **ModuleRegistryTests.swift**
   - Module registration/unregistration
   - Initialization lifecycle
   - Dependency resolution
   - Enable/disable functionality

2. **EventsModuleTests.swift**
   - Event creation and updates
   - RSVP submission
   - RSVP counts
   - Event deletion
   - Search and filtering

3. **MessagingModuleTests.swift**
   - Direct message sending
   - Group message sending
   - Reactions
   - Read receipts
   - Typing indicators

### Running Tests

```bash
# Swift Package Manager
swift test

# Xcode
xcodebuild test -scheme BuildItCore -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Usage Examples

### Creating an Event

```swift
let eventsModule = ModuleRegistry.shared.getModule(EventsModule.self)

let event = try await eventsModule?.createEvent(
    title: "Team Meeting",
    description: "Quarterly planning session",
    startAt: Date().addingTimeInterval(86400),
    endAt: Date().addingTimeInterval(90000),
    location: LocationClass(
        address: "123 Main St",
        coordinates: [37.7749, -122.4194],
        instructions: "Conference room A",
        name: "Office"
    ),
    visibility: .group,
    maxAttendees: 20,
    rsvpDeadline: Date().addingTimeInterval(43200)
)
```

### Submitting an RSVP

```swift
let rsvp = try await eventsModule?.rsvp(
    eventId: eventId,
    status: .going,
    guestCount: 2,
    note: "Bringing a colleague"
)
```

### Sending a Message with Reaction

```swift
let messagingModule = ModuleRegistry.shared.getModule(MessagingModule.self)

// Send message
try await messagingModule?.sendDirectMessage(
    content: "Hello!",
    to: recipientPubkey,
    mentions: ["@alice"]
)

// Add reaction
try await messagingModule?.addReaction(
    emoji: "👍",
    to: messageId
)
```

### Marking Messages as Read

```swift
try await messagingModule?.markAsRead(
    conversationId: conversationId,
    lastMessageId: lastMessageId
)
```

## Benefits

1. **Modularity**: Features are self-contained and can be enabled/disabled
2. **Type Safety**: Uses generated schema types for consistency
3. **Testability**: Each module is independently testable
4. **Extensibility**: Easy to add new modules following the established pattern
5. **Persistence**: SwiftData provides robust local storage
6. **Sync**: Nostr events keep data synchronized across devices
7. **Per-Group Configuration**: Modules can be enabled for specific groups
8. **Dependency Management**: Automatic resolution of module dependencies

## Future Modules

The architecture supports easy addition of new modules:

- Tasks/Todos
- File Sharing
- Polls/Voting
- Location Sharing
- Voice/Video Calls
- Custom Fields
- Wiki/Documentation
- Calendar Sync

## Notes

- All modules use async/await for concurrency
- SwiftData handles persistence automatically
- Nostr events provide cross-device synchronization
- NIP-17 encryption protects direct messages
- Module configuration is persisted per group
- Event routing is automatic through the registry
