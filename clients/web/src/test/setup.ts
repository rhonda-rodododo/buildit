import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { setupTestDatabase, teardownTestDatabase } from './test-utils';

// Initialize database once before all tests
beforeAll(async () => {
  await setupTestDatabase();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Close database after all tests
afterAll(async () => {
  await teardownTestDatabase();
});
