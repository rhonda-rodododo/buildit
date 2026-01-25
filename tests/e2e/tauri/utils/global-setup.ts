/**
 * Global Setup for Tauri E2E Tests (Tauri Driver Mode)
 *
 * This setup runs before all tests when TAURI_MODE=true.
 * It builds the Tauri app and starts the tauri-driver process.
 */

import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

let tauriDriverProcess: ChildProcess | null = null;

async function globalSetup(): Promise<() => Promise<void>> {
  console.log('[Tauri E2E] Starting global setup...');

  // Build the Tauri application in debug mode
  console.log('[Tauri E2E] Building Tauri application...');
  const buildResult = spawnSync('bun', ['run', 'tauri', 'build', '--debug', '--no-bundle'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    timeout: 300000, // 5 minute timeout for build
  });

  if (buildResult.error || buildResult.status !== 0) {
    console.error('[Tauri E2E] Failed to build Tauri application');
    throw new Error('Tauri build failed');
  }

  // Start tauri-driver
  console.log('[Tauri E2E] Starting tauri-driver...');
  const tauriDriverPath = path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver');

  tauriDriverProcess = spawn(tauriDriverPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Handle tauri-driver output
  tauriDriverProcess.stdout?.on('data', (data) => {
    console.log(`[tauri-driver] ${data.toString().trim()}`);
  });

  tauriDriverProcess.stderr?.on('data', (data) => {
    console.error(`[tauri-driver] ${data.toString().trim()}`);
  });

  tauriDriverProcess.on('error', (error) => {
    console.error('[Tauri E2E] tauri-driver error:', error);
  });

  tauriDriverProcess.on('exit', (code, signal) => {
    console.log(`[Tauri E2E] tauri-driver exited (code: ${code}, signal: ${signal})`);
  });

  // Wait for tauri-driver to be ready
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  console.log('[Tauri E2E] Global setup complete');

  // Return teardown function
  return async () => {
    console.log('[Tauri E2E] Running global teardown...');
    if (tauriDriverProcess) {
      tauriDriverProcess.kill('SIGTERM');
      tauriDriverProcess = null;
    }
    console.log('[Tauri E2E] Global teardown complete');
  };
}

export default globalSetup;
