/**
 * Global Teardown for Tauri E2E Tests (Tauri Driver Mode)
 *
 * This teardown runs after all tests when TAURI_MODE=true.
 * It ensures the tauri-driver process is properly cleaned up.
 */

async function globalTeardown(): Promise<void> {
  console.log('[Tauri E2E] Executing global teardown...');

  // Additional cleanup can be added here if needed
  // The main cleanup is handled by the setup's returned teardown function

  console.log('[Tauri E2E] Global teardown complete');
}

export default globalTeardown;
