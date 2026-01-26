# BuildIt Widgets

iOS Home Screen Widgets for BuildIt.

## Widget Types

### 1. UnreadMessagesWidget
- **Sizes**: Small, Medium
- **Small**: Shows unread count with icon
- **Medium**: Shows unread count + last 2 message previews
- **Deep Link**: Opens messages tab, or specific conversation

### 2. UpcomingEventsWidget
- **Sizes**: Small, Medium, Large
- **Small**: Shows next upcoming event
- **Medium**: Shows next 3 events in compact view
- **Large**: Shows next 3 events with full details
- **Deep Link**: Opens events tab, or specific event detail

### 3. QuickActionsWidget
- **Sizes**: Small, Medium
- **Actions**:
  - New Message (`buildit://action/new-message`)
  - Scan QR (`buildit://action/scan-qr`)
  - Check In (`buildit://action/check-in`)
  - New Event (`buildit://action/new-event`)
  - View Groups (`buildit://action/view-groups`)
  - Settings (`buildit://action/settings`)

## Setup in Xcode

### 1. Add Widget Extension Target

1. File > New > Target
2. Select "Widget Extension"
3. Product Name: BuildItWidgets
4. Bundle Identifier: `com.buildit.widgets`
5. Uncheck "Include Configuration Intent" (we use StaticConfiguration)

### 2. Configure App Group

Both main app and widget extension must share an App Group:

**App Group Identifier**: `group.com.buildit.shared`

1. Select main app target > Signing & Capabilities
2. Add "App Groups" capability
3. Add `group.com.buildit.shared`
4. Repeat for widget extension target

### 3. Add Files to Widget Target

Add these files to the BuildItWidgets target:
- `BuildItWidgets.swift`
- `UnreadMessagesWidget.swift`
- `UpcomingEventsWidget.swift`
- `QuickActionsWidget.swift`
- `SharedDataManager.swift`

### 4. Info.plist Configuration

The widget extension's Info.plist is already configured with:
- `NSExtensionPointIdentifier`: `com.apple.widgetkit-extension`

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Main App                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  MessagingStore │───>│  WidgetDataUpdater              │ │
│  │  EventsStore    │    │  - syncFromMessagingStore()     │ │
│  └─────────────────┘    │  - syncFromEventsStore()        │ │
│                         └─────────────────────────────────┘ │
│                                      │                       │
│                                      ▼                       │
│                         ┌─────────────────────────────────┐ │
│                         │  SharedDataManager              │ │
│                         │  (UserDefaults App Group)       │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                       │
                    App Group: group.com.buildit.shared
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Widget Extension                           │
│                         ┌─────────────────────────────────┐ │
│                         │  SharedDataManager              │ │
│                         │  (reads from App Group)         │ │
│                         └─────────────────────────────────┘ │
│                                      │                       │
│                                      ▼                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  TimelineProviders                                       ││
│  │  - UnreadMessagesProvider                               ││
│  │  - UpcomingEventsProvider                               ││
│  │  - QuickActionsProvider                                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Updating Widget Data

From the main app, use `WidgetDataUpdater`:

```swift
// Update message data
WidgetDataUpdater.shared.updateMessageData(
    unreadCount: 5,
    recentMessages: messages
)

// Sync from stores
WidgetDataUpdater.shared.syncFromMessagingStore(messagingStore, userPublicKey: "...")
WidgetDataUpdater.shared.syncFromEventsStore(eventsStore)

// Reload all widgets
WidgetDataUpdater.shared.reloadAllWidgets()
```

## Deep Link URLs

| URL Pattern | Destination |
|-------------|-------------|
| `buildit://messages` | Messages list |
| `buildit://messages/direct/{pubkey}` | Direct message conversation |
| `buildit://messages/group/{id}?group={name}` | Group message |
| `buildit://events` | Events list |
| `buildit://events/{id}` | Event detail |
| `buildit://groups` | Groups list |
| `buildit://action/{action}` | Quick action |

## Timeline Updates

- **UnreadMessages**: Updates every 15 minutes or on `reloadTimelines()`
- **UpcomingEvents**: Updates when next event starts or every 30 minutes
- **QuickActions**: Never auto-updates (static content)

## Accessibility

All widgets include:
- Accessibility labels for all interactive elements
- VoiceOver support
- Dynamic Type support (uses system fonts)

## Testing

Run widget tests:
```bash
xcodebuild test -scheme BuildIt -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:BuildItTests/WidgetTests
```
