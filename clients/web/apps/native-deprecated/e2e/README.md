# Native App E2E Tests

This directory contains end-to-end tests for the BuildIt Network native app.

## Test Framework

We use [Detox](https://wix.github.io/Detox/) for E2E testing on iOS and Android.

## Prerequisites

- Xcode (for iOS testing)
- Android Studio with emulator (for Android testing)
- Node.js 18+
- Bun package manager

## Setup

1. Install Detox CLI:
   ```bash
   npm install -g detox-cli
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the app for testing:
   ```bash
   # iOS
   detox build --configuration ios.sim.debug

   # Android
   detox build --configuration android.emu.debug
   ```

## Running Tests

```bash
# iOS
detox test --configuration ios.sim.debug

# Android
detox test --configuration android.emu.debug
```

## Test Structure

```
e2e/
├── README.md           # This file
├── jest.config.js      # Jest configuration for Detox
├── init.ts             # Test initialization
├── auth/               # Authentication flow tests
│   ├── login.test.ts
│   ├── import.test.ts
│   └── biometric.test.ts
├── messaging/          # Messaging tests
│   ├── compose.test.ts
│   └── chat.test.ts
├── groups/             # Group tests
│   └── groups.test.ts
└── settings/           # Settings tests
    └── settings.test.ts
```

## Writing Tests

Tests use Detox's element matching and actions:

```typescript
import { device, element, by, expect } from 'detox';

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should show login screen', async () => {
    await expect(element(by.text('Welcome to BuildIt'))).toBeVisible();
  });

  it('should create new identity', async () => {
    await element(by.text('Create Identity')).tap();
    await element(by.id('display-name-input')).typeText('Test User');
    await element(by.text('Create')).tap();
    await expect(element(by.text('Test User'))).toBeVisible();
  });
});
```

## CI/CD Integration

For continuous integration, use the following GitHub Actions workflow:

```yaml
- name: Run E2E Tests (iOS)
  run: |
    detox build --configuration ios.sim.release
    detox test --configuration ios.sim.release --cleanup
```

## Troubleshooting

### iOS Simulator Issues
- Reset simulator: `xcrun simctl shutdown all && xcrun simctl erase all`
- Clean build: `detox clean-framework-cache && detox build-framework-cache`

### Android Emulator Issues
- Start emulator manually: `emulator -avd Pixel_4_API_30`
- Restart ADB: `adb kill-server && adb start-server`
