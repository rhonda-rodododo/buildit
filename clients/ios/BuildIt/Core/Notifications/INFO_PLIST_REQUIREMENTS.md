# Info.plist Requirements for Push Notifications

This document lists the required Info.plist entries for the BuildIt iOS app's notification and background processing features.

## Background Modes

Add the following to your Info.plist under `UIBackgroundModes`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-central</string>
    <string>bluetooth-peripheral</string>
    <string>fetch</string>
    <string>processing</string>
    <string>remote-notification</string>
</array>
```

### Explanation:
- `bluetooth-central`: Required for BLE mesh networking in background
- `bluetooth-peripheral`: Required for BLE advertising in background
- `fetch`: Required for background fetch of new content
- `processing`: Required for BGProcessingTask (database maintenance)
- `remote-notification`: Required for silent push notifications

## Background Task Identifiers

Add the following permitted background task identifiers:

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.buildit.meshSync</string>
    <string>com.buildit.nostrSync</string>
    <string>com.buildit.messageSync</string>
    <string>com.buildit.eventSync</string>
    <string>com.buildit.contentRefresh</string>
    <string>com.buildit.databaseMaintenance</string>
</array>
```

## Push Notification Entitlements

Ensure your app has the Push Notifications capability enabled in your entitlements file:

```xml
<key>aps-environment</key>
<string>development</string> <!-- or "production" for App Store builds -->
```

## URL Schemes for Deep Linking

Add the following URL schemes for notification deep linking:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.buildit.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>buildit</string>
            <string>nostr</string>
        </array>
    </dict>
</array>
```

## User Notification Usage Description (Optional)

If you want to provide a custom message when requesting notification permissions:

```xml
<key>NSUserNotificationUsageDescription</key>
<string>BuildIt uses notifications to alert you about new messages, events, and important updates from your communities.</string>
```

## Complete Info.plist Additions

Here's a complete block you can add to your Info.plist:

```xml
<!-- Background Modes -->
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-central</string>
    <string>bluetooth-peripheral</string>
    <string>fetch</string>
    <string>processing</string>
    <string>remote-notification</string>
</array>

<!-- Background Task Identifiers -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.buildit.meshSync</string>
    <string>com.buildit.nostrSync</string>
    <string>com.buildit.messageSync</string>
    <string>com.buildit.eventSync</string>
    <string>com.buildit.contentRefresh</string>
    <string>com.buildit.databaseMaintenance</string>
</array>

<!-- URL Schemes -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.buildit.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>buildit</string>
            <string>nostr</string>
        </array>
    </dict>
</array>
```

## Xcode Project Settings

In addition to Info.plist, ensure the following capabilities are enabled in your Xcode project:

1. **Signing & Capabilities** tab:
   - Push Notifications
   - Background Modes (with all modes listed above checked)
   - App Groups (for sharing data with extensions)

2. **Build Settings**:
   - Ensure `CODE_SIGN_ENTITLEMENTS` points to your entitlements file

## Testing Background Tasks

To test background tasks in the simulator, use these LLDB commands:

```lldb
# Simulate background fetch
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.buildit.nostrSync"]

# Simulate expiration
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateExpirationForTaskWithIdentifier:@"com.buildit.nostrSync"]
```

Or use the Debug menu in Xcode: Debug > Simulate Background Fetch
