/**
 * Debug test to capture initialization console logs
 */
import { test, expect } from '@playwright/test';

test('debug initialization', async ({ page }) => {
  // Capture all console messages
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', (err) => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  // Navigate to the app
  await page.goto('/');

  // Wait for either success (login page) or error (initialization error)
  await page.waitForTimeout(10000); // Wait 10 seconds for initialization

  // Log all console messages
  console.log('\n=== BROWSER CONSOLE LOGS ===');
  for (const log of consoleLogs) {
    console.log(log);
  }
  console.log('=== END CONSOLE LOGS ===\n');

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-init-screenshot.png' });

  // Check what's visible
  const pageContent = await page.content();
  console.log('\n=== PAGE CONTENT (first 2000 chars) ===');
  console.log(pageContent.substring(0, 2000));
  console.log('=== END PAGE CONTENT ===\n');

  // Check if error screen or login screen is visible
  const hasError = await page.locator('text=Initialization Error').isVisible();
  const hasLogin = await page.locator('text=/buildIt network/i').isVisible();
  const hasLoading = await page.locator('text=Initializing').isVisible();

  console.log(`\n=== VISIBILITY CHECK ===`);
  console.log(`Has Error Screen: ${hasError}`);
  console.log(`Has Login Screen: ${hasLogin}`);
  console.log(`Has Loading Screen: ${hasLoading}`);
  console.log('=== END VISIBILITY CHECK ===\n');

  // Fail the test if we see the error screen (to see the logs)
  if (hasError) {
    console.log('ERROR: Initialization failed! Check console logs above.');
  }

  // This test is just for debugging, so we expect to see either login or error
  expect(hasError || hasLogin || hasLoading).toBe(true);
});
