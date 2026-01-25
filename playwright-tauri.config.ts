import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Tauri desktop E2E tests
 *
 * This configuration supports two modes:
 * 1. Mock mode (default): Tests run against dev server with mocked Tauri APIs
 * 2. Tauri mode: Tests run against the actual Tauri application using tauri-driver
 *
 * @see https://playwright.dev/docs/test-configuration
 * @see https://tauri.app/develop/tests/webdriver/
 */
export default defineConfig({
  testDir: './tests/e2e/tauri',

  /* Run tests in files in parallel */
  fullyParallel: false, // Tauri tests should run sequentially

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,

  /* Opt out of parallel tests for Tauri */
  workers: 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report-tauri' }], ['github']]
    : [['html', { outputFolder: 'playwright-report-tauri' }], ['list']],

  /* Test timeout */
  timeout: 60000, // 60 seconds per test

  /* Global setup/teardown for Tauri driver */
  globalSetup: process.env.TAURI_MODE === 'true'
    ? './tests/e2e/tauri/utils/global-setup.ts'
    : undefined,
  globalTeardown: process.env.TAURI_MODE === 'true'
    ? './tests/e2e/tauri/utils/global-teardown.ts'
    : undefined,

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL for mock mode (dev server) */
    baseURL: process.env.TAURI_MODE === 'true'
      ? undefined
      : 'http://localhost:5173',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* BLE is mocked in tests, no browser permissions needed */
  },

  /* Configure projects */
  projects: [
    {
      name: 'tauri-mock',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Force viewport to match Tauri window defaults
        viewport: { width: 1200, height: 800 },
      },
    },
  ],

  /* Output folder for test artifacts */
  outputDir: 'test-results/tauri',

  /* Run your local dev server before starting the tests (mock mode only) */
  webServer: process.env.TAURI_MODE === 'true'
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
