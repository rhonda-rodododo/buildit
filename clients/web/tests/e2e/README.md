# End-to-End Testing Guide

This directory contains E2E tests for BuildIt Network using Playwright.

## Running Tests

### Run all E2E tests
```bash
bun run test:e2e
```

### Run specific test file
```bash
bun run test:e2e tests/e2e/auth.spec.ts
```

### Run tests in headed mode (see browser)
```bash
bunx playwright test --headed
```

### Run tests in debug mode
```bash
bunx playwright test --debug
```

### Run tests in UI mode (interactive)
```bash
bunx playwright test --ui
```

## Test Coverage

### Authentication (auth.spec.ts)
- ✅ Create new identity
- ✅ Import existing identity (nsec)
- ✅ Switch between identities
- ✅ Export private key

### Group Management (groups.spec.ts)
- ✅ Create a new group
- ✅ View group dashboard
- ✅ Enable/disable modules for a group
- ✅ Invite member to group
- ✅ Update group settings
- ✅ Delete group

### Messaging (messaging.spec.ts)
- ✅ Send and view direct message
- ✅ Send group message
- ✅ View unread message indicator

### Events Module (events.spec.ts)
- ✅ Create a new event
- ✅ RSVP to an event
- ✅ View event calendar
- ✅ Export event to iCal
- ✅ Filter events by date range

### Governance Module (governance.spec.ts)
- ✅ Create proposal with simple voting
- ✅ Create proposal with ranked-choice voting
- ✅ Vote on a proposal
- ✅ View proposal results
- ✅ View proposal history

### Mutual Aid Module (mutual-aid.spec.ts)
- ✅ Create a resource request
- ✅ Create a resource offer
- ✅ Match offer to request
- ✅ Fulfill a request
- ✅ Filter requests by type
- ✅ Search requests by location

### Visual Regression (visual-regression.spec.ts)
- ✅ Homepage snapshot
- ✅ Dashboard snapshot
- ✅ Groups list snapshot
- ✅ Create group dialog snapshot
- ✅ Group dashboard snapshot
- ✅ Events module snapshot
- ✅ Governance module snapshot
- ✅ Mobile viewport snapshot
- ✅ Dark mode snapshot

## Visual Regression Testing

Visual regression tests capture screenshots and compare them against baseline images.

### Update baseline screenshots
```bash
bun run test:e2e --update-snapshots
```

### View visual diff reports
After a test fails due to visual differences, view the report:
```bash
bunx playwright show-report
```

## Cross-Browser Testing

Tests run on multiple browsers in CI:
- Chrome (Desktop)
- Firefox (Desktop)
- Safari (Desktop - WebKit)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

To run tests on specific browser locally:
```bash
# Chrome only
bunx playwright test --project=chromium

# Firefox only
bunx playwright test --project=firefox

# Mobile Chrome only
bunx playwright test --project="Mobile Chrome"
```

## CI/CD Integration

E2E tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

GitHub Actions workflow: `.github/workflows/e2e-tests.yml`

Test reports and artifacts are uploaded to GitHub Actions for 30 days.

## Writing New Tests

### Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: login, navigate, etc.
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/some-page');

    // Act
    await page.getByRole('button', { name: /click me/i }).click();

    // Assert
    await expect(page.getByText('Success!')).toBeVisible();
  });
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for elements**: Use `expect().toBeVisible()` instead of hard waits
3. **Test user flows**: Test complete user journeys, not just individual actions
4. **Keep tests independent**: Each test should be able to run in isolation
5. **Use descriptive names**: Test names should clearly describe what they test
6. **Handle dynamic content**: Use conditional logic for elements that may not exist
7. **Test accessibility**: Use ARIA roles and labels to verify accessibility

### Example: Testing a Form
```typescript
test('should create a new event', async ({ page }) => {
  // Navigate to events
  await page.getByRole('tab', { name: /events/i }).click();

  // Open create dialog
  await page.getByRole('button', { name: /create event/i }).click();

  // Fill form
  await page.getByLabel(/title/i).fill('Test Event');
  await page.getByLabel(/description/i).fill('Event description');
  await page.getByLabel(/date/i).fill('2025-12-31');

  // Submit
  await page.getByRole('button', { name: /create|save/i }).click();

  // Verify
  await expect(page.getByText('Test Event')).toBeVisible();
});
```

## Debugging Failed Tests

### View test traces
```bash
bunx playwright show-trace test-results/path-to-trace.zip
```

### Run specific test with video
```bash
bunx playwright test tests/e2e/auth.spec.ts --headed --video=on
```

### Use Playwright Inspector
```bash
bunx playwright test --debug
```

## Configuration

Configuration file: `playwright.config.ts`

Key settings:
- **Base URL**: `http://localhost:5173`
- **Retries**: 0 locally, 2 in CI
- **Timeout**: 30 seconds per test
- **Workers**: Parallel locally, sequential in CI
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

## Troubleshooting

### Tests fail locally but pass in CI
- Check for timing issues (add proper waits)
- Verify your local environment matches CI (Node version, dependencies)

### Visual regression tests fail
- Run `--update-snapshots` to update baselines
- Check if UI changes were intentional
- Review pixel difference threshold in test

### Flaky tests
- Add explicit waits for dynamic content
- Use `waitForLoadState('networkidle')` for page loads
- Increase timeout for slow operations

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
