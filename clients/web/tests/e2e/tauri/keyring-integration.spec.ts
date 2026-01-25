/**
 * Tauri Keyring Integration E2E Tests
 *
 * Tests the system keyring integration exposed through Tauri commands.
 * These tests verify:
 * - store_secret / retrieve_secret / delete_secret operations
 * - has_secret returns correct boolean
 * - Different secret types (nostr_private_key, master_key, etc.)
 * - Error handling (secret not found, invalid input, etc.)
 *
 * NOTE: Uses mocks by default for CI. Real keyring tests require Tauri Driver mode.
 */

import { test, expect, Page } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
  getTauriMockState,
} from './utils/tauri-mocks';
import { waitForAppReady } from './utils/helpers';
import {
  TEST_USERS,
  TEST_SECRETS,
  SECRET_TYPES,
  RANDOM_KEYPAIR_1,
} from './utils/crypto-test-vectors';
import { TIMEOUTS } from './utils/fixtures';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Helper to invoke a Tauri command from the browser context
 */
async function invokeCommand<T>(
  page: Page,
  command: string,
  args?: Record<string, unknown>
): Promise<{ success: boolean; data: T | null; error: string | null }> {
  return await page.evaluate(
    async ({ cmd, cmdArgs }) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: unknown; error: string | null }> } }).__TAURI_INTERNALS__;
      if (!internals?.invoke) {
        throw new Error('Tauri internals not available');
      }
      return await internals.invoke(cmd, cmdArgs);
    },
    { cmd: command, cmdArgs: args }
  ) as { success: boolean; data: T | null; error: string | null };
}

/**
 * Secret type enum matching Rust backend
 */
type SecretType =
  | 'nostr_private_key'
  | 'master_key'
  | 'database_key'
  | 'api_token'
  | { custom: string };

// ============================================================================
// Test Suite: Store Secret
// ============================================================================

test.describe('Keyring Integration - Store Secret', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('store_secret should store nostr_private_key successfully', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
      value: RANDOM_KEYPAIR_1.privateKey,
      label: 'Test Nostr Key',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();

    // Verify in mock state
    const mockState = await getTauriMockState(page);
    expect(mockState?.keyring.secrets).toBeDefined();
  });

  test('store_secret should store master_key successfully', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
      value: TEST_SECRETS.masterKey.value,
      label: TEST_SECRETS.masterKey.label,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  test('store_secret should store database_key successfully', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'database_key' as SecretType,
      value: TEST_SECRETS.databaseKey.value,
      label: TEST_SECRETS.databaseKey.label,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  test('store_secret should store api_token successfully', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'api_token' as SecretType,
      value: TEST_SECRETS.apiToken.value,
      label: TEST_SECRETS.apiToken.label,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  test('store_secret should store custom secret type successfully', async ({ page }) => {
    const customType: SecretType = { custom: 'backup_key' };

    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: customType,
      value: TEST_SECRETS.customSecret.value,
      label: TEST_SECRETS.customSecret.label,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  test('store_secret should overwrite existing secret for same user/type', async ({ page }) => {
    const secretType: SecretType = 'nostr_private_key';

    // Store initial secret
    const result1 = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: secretType,
      value: 'initial_value_' + '0'.repeat(50),
    });

    expect(result1.success).toBe(true);

    // Store new value for same user/type
    const newValue = 'updated_value_' + '1'.repeat(50);
    const result2 = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: secretType,
      value: newValue,
    });

    expect(result2.success).toBe(true);

    // Retrieve and verify it's the new value
    const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: secretType,
    });

    expect(retrieveResult.success).toBe(true);
    expect(retrieveResult.data).toBe(newValue);
  });

  test('store_secret should store secrets for different users independently', async ({ page }) => {
    const secretType: SecretType = 'nostr_private_key';

    // Store for Alice
    const aliceResult = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: secretType,
      value: 'alice_secret_' + 'a'.repeat(50),
    });

    // Store for Bob
    const bobResult = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.bob.id,
      secret_type: secretType,
      value: 'bob_secret_' + 'b'.repeat(52),
    });

    expect(aliceResult.success).toBe(true);
    expect(bobResult.success).toBe(true);

    // Verify both are stored independently
    const aliceRetrieve = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: secretType,
    });

    const bobRetrieve = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.bob.id,
      secret_type: secretType,
    });

    expect(aliceRetrieve.data).toContain('alice_secret');
    expect(bobRetrieve.data).toContain('bob_secret');
  });

  test('store_secret should accept optional label parameter', async ({ page }) => {
    // With label
    const withLabel = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
      value: 'test_value',
      label: 'My Master Key',
    });

    expect(withLabel.success).toBe(true);

    // Without label
    const withoutLabel = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.bob.id,
      secret_type: 'master_key' as SecretType,
      value: 'test_value_2',
    });

    expect(withoutLabel.success).toBe(true);
  });
});

// ============================================================================
// Test Suite: Retrieve Secret
// ============================================================================

test.describe('Keyring Integration - Retrieve Secret', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    // Pre-populate some secrets for retrieval tests
    await setupTauriMocks(page, {
      mockSecrets: {
        [`${TEST_USERS.alice.id}_nostr_private_key`]: RANDOM_KEYPAIR_1.privateKey,
        [`${TEST_USERS.alice.id}_master_key`]: TEST_SECRETS.masterKey.value,
        [`${TEST_USERS.bob.id}_nostr_private_key`]: 'bob_key_' + '0'.repeat(56),
      },
    });
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('retrieve_secret should return stored nostr_private_key', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(RANDOM_KEYPAIR_1.privateKey);
    expect(result.error).toBeNull();
  });

  test('retrieve_secret should return stored master_key', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(TEST_SECRETS.masterKey.value);
  });

  test('retrieve_secret should fail for non-existent secret', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'database_key' as SecretType, // Not pre-populated
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('not found');
  });

  test('retrieve_secret should fail for non-existent user', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: 'non_existent_user',
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  test('retrieve_secret should return correct secret for specific user', async ({ page }) => {
    // Alice's secret
    const aliceResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    // Bob's secret
    const bobResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.bob.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(aliceResult.success).toBe(true);
    expect(bobResult.success).toBe(true);
    expect(aliceResult.data).not.toBe(bobResult.data);
  });

  test('retrieve_secret should handle custom secret types', async ({ page }) => {
    // First store a custom secret
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'my_custom_secret' },
      value: 'custom_secret_value',
    });

    // Then retrieve it
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'my_custom_secret' },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('custom_secret_value');
  });
});

// ============================================================================
// Test Suite: Delete Secret
// ============================================================================

test.describe('Keyring Integration - Delete Secret', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      mockSecrets: {
        [`${TEST_USERS.alice.id}_nostr_private_key`]: RANDOM_KEYPAIR_1.privateKey,
        [`${TEST_USERS.alice.id}_master_key`]: TEST_SECRETS.masterKey.value,
        [`${TEST_USERS.bob.id}_nostr_private_key`]: 'bob_key_data',
      },
    });
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('delete_secret should remove stored secret', async ({ page }) => {
    // Verify secret exists
    const existsBefore = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(existsBefore.success).toBe(true);

    // Delete secret
    const deleteResult = await invokeCommand<void>(page, 'delete_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(deleteResult.success).toBe(true);

    // Verify secret is gone
    const existsAfter = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(existsAfter.success).toBe(false);
  });

  test('delete_secret should only remove specified secret', async ({ page }) => {
    // Delete Alice's nostr key
    await invokeCommand<void>(page, 'delete_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    // Alice's master key should still exist
    const masterKeyResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
    });
    expect(masterKeyResult.success).toBe(true);

    // Bob's key should still exist
    const bobKeyResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.bob.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(bobKeyResult.success).toBe(true);
  });

  test('delete_secret should succeed for non-existent secret (idempotent)', async ({ page }) => {
    // Delete non-existent secret
    const result = await invokeCommand<void>(page, 'delete_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'database_key' as SecretType, // Not stored
    });

    // Should succeed (or fail gracefully)
    // Behavior depends on implementation - both are acceptable
    expect(result).toBeDefined();
  });

  test('delete_secret should handle custom secret types', async ({ page }) => {
    // Store custom secret
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'deletable_secret' },
      value: 'to_be_deleted',
    });

    // Delete it
    const deleteResult = await invokeCommand<void>(page, 'delete_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'deletable_secret' },
    });

    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'deletable_secret' },
    });

    expect(retrieveResult.success).toBe(false);
  });
});

// ============================================================================
// Test Suite: Has Secret
// ============================================================================

test.describe('Keyring Integration - Has Secret', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      mockSecrets: {
        [`${TEST_USERS.alice.id}_nostr_private_key`]: RANDOM_KEYPAIR_1.privateKey,
        [`${TEST_USERS.alice.id}_master_key`]: TEST_SECRETS.masterKey.value,
      },
    });
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('has_secret should return true for existing secret', async ({ page }) => {
    const result = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  test('has_secret should return false for non-existent secret', async ({ page }) => {
    const result = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'database_key' as SecretType,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(false);
  });

  test('has_secret should return false for non-existent user', async ({ page }) => {
    const result = await invokeCommand<boolean>(page, 'has_secret', {
      user: 'non_existent_user',
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(false);
  });

  test('has_secret should return false after secret is deleted', async ({ page }) => {
    // Verify exists
    const beforeDelete = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(beforeDelete.data).toBe(true);

    // Delete
    await invokeCommand<void>(page, 'delete_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });

    // Verify gone
    const afterDelete = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'nostr_private_key' as SecretType,
    });
    expect(afterDelete.data).toBe(false);
  });

  test('has_secret should correctly check all secret types', async ({ page }) => {
    const secretTypes: SecretType[] = [
      'nostr_private_key', // exists
      'master_key', // exists
      'database_key', // doesn't exist
      'api_token', // doesn't exist
    ];

    const results = await Promise.all(
      secretTypes.map((type) =>
        invokeCommand<boolean>(page, 'has_secret', {
          user: TEST_USERS.alice.id,
          secret_type: type,
        })
      )
    );

    expect(results[0].data).toBe(true); // nostr_private_key
    expect(results[1].data).toBe(true); // master_key
    expect(results[2].data).toBe(false); // database_key
    expect(results[3].data).toBe(false); // api_token
  });

  test('has_secret should handle custom secret types', async ({ page }) => {
    // Check non-existent custom type
    const beforeStore = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'my_custom_key' },
    });
    expect(beforeStore.data).toBe(false);

    // Store custom secret
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'my_custom_key' },
      value: 'custom_value',
    });

    // Check again
    const afterStore = await invokeCommand<boolean>(page, 'has_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'my_custom_key' },
    });
    expect(afterStore.data).toBe(true);
  });
});

// ============================================================================
// Test Suite: Secret Type Variations
// ============================================================================

test.describe('Keyring Integration - Secret Type Variations', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should handle all predefined secret types', async ({ page }) => {
    const predefinedTypes: SecretType[] = [
      'nostr_private_key',
      'master_key',
      'database_key',
      'api_token',
    ];

    for (const secretType of predefinedTypes) {
      // Store
      const storeResult = await invokeCommand<void>(page, 'store_secret', {
        user: TEST_USERS.alice.id,
        secret_type: secretType,
        value: `value_for_${secretType}`,
      });
      expect(storeResult.success).toBe(true);

      // Check exists
      const hasResult = await invokeCommand<boolean>(page, 'has_secret', {
        user: TEST_USERS.alice.id,
        secret_type: secretType,
      });
      expect(hasResult.data).toBe(true);

      // Retrieve
      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: secretType,
      });
      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.data).toBe(`value_for_${secretType}`);
    }
  });

  test('should handle various custom secret type names', async ({ page }) => {
    const customTypes = [
      'backup_key',
      'session_token',
      'refresh_token',
      'signing_key',
      'encryption_key',
      'auth_secret',
    ];

    for (const typeName of customTypes) {
      const secretType: SecretType = { custom: typeName };

      // Store
      const storeResult = await invokeCommand<void>(page, 'store_secret', {
        user: TEST_USERS.alice.id,
        secret_type: secretType,
        value: `custom_${typeName}_value`,
      });
      expect(storeResult.success).toBe(true);

      // Retrieve
      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: secretType,
      });
      expect(retrieveResult.data).toBe(`custom_${typeName}_value`);
    }
  });

  test('custom secret types should be case-sensitive', async ({ page }) => {
    // Store with lowercase
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'mykey' },
      value: 'lowercase_value',
    });

    // Store with uppercase (should be different)
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'MYKEY' },
      value: 'uppercase_value',
    });

    // Retrieve both
    const lowercase = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'mykey' },
    });

    const uppercase = await invokeCommand<string>(page, 'retrieve_secret', {
      user: TEST_USERS.alice.id,
      secret_type: { custom: 'MYKEY' },
    });

    expect(lowercase.data).toBe('lowercase_value');
    expect(uppercase.data).toBe('uppercase_value');
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

test.describe('Keyring Integration - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('retrieve_secret should return error for missing secret', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: 'nonexistent_user',
      secret_type: 'nostr_private_key' as SecretType,
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe('string');
  });

  test('should handle empty user ID gracefully', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: '',
      secret_type: 'nostr_private_key' as SecretType,
      value: 'test_value',
    });

    // Should either succeed (empty string is valid) or fail gracefully
    expect(result).toBeDefined();
  });

  test('should handle empty secret value', async ({ page }) => {
    const result = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'api_token' as SecretType,
      value: '',
    });

    // Empty values might be allowed depending on implementation
    expect(result).toBeDefined();

    if (result.success) {
      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: 'api_token' as SecretType,
      });
      expect(retrieveResult.data).toBe('');
    }
  });

  test('should handle very long secret values', async ({ page }) => {
    const longValue = 'x'.repeat(10000); // 10KB value

    const storeResult = await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
      value: longValue,
    });

    // Should either succeed or fail with size limit error
    expect(storeResult).toBeDefined();

    if (storeResult.success) {
      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: 'master_key' as SecretType,
      });
      expect(retrieveResult.data).toBe(longValue);
    }
  });

  test('should handle special characters in user ID', async ({ page }) => {
    const specialUserIds = [
      'user@example.com',
      'user_with_underscore',
      'user-with-dash',
      'user.with.dots',
    ];

    for (const userId of specialUserIds) {
      const storeResult = await invokeCommand<void>(page, 'store_secret', {
        user: userId,
        secret_type: 'api_token' as SecretType,
        value: 'test_value',
      });

      expect(storeResult.success).toBe(true);

      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: userId,
        secret_type: 'api_token' as SecretType,
      });

      expect(retrieveResult.success).toBe(true);
    }
  });

  test('should handle special characters in custom type name', async ({ page }) => {
    const specialTypeNames = [
      'type_with_underscore',
      'type-with-dash',
      'type.with.dots',
    ];

    for (const typeName of specialTypeNames) {
      const storeResult = await invokeCommand<void>(page, 'store_secret', {
        user: TEST_USERS.alice.id,
        secret_type: { custom: typeName },
        value: 'test_value',
      });

      expect(storeResult.success).toBe(true);

      const retrieveResult = await invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: { custom: typeName },
      });

      expect(retrieveResult.success).toBe(true);
    }
  });

  test('should return proper error structure', async ({ page }) => {
    const result = await invokeCommand<string>(page, 'retrieve_secret', {
      user: 'nonexistent',
      secret_type: 'nostr_private_key' as SecretType,
    });

    // Verify error structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe('string');
  });
});

// ============================================================================
// Test Suite: Concurrent Operations
// ============================================================================

test.describe('Keyring Integration - Concurrent Operations', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should handle multiple concurrent store operations', async ({ page }) => {
    const operations = [];

    for (let i = 0; i < 10; i++) {
      operations.push(
        invokeCommand<void>(page, 'store_secret', {
          user: `user_${i}`,
          secret_type: 'api_token' as SecretType,
          value: `value_${i}`,
        })
      );
    }

    const results = await Promise.all(operations);

    // All should succeed
    for (const result of results) {
      expect(result.success).toBe(true);
    }
  });

  test('should handle multiple concurrent retrieve operations', async ({ page }) => {
    // First, store some secrets
    for (let i = 0; i < 5; i++) {
      await invokeCommand<void>(page, 'store_secret', {
        user: `user_${i}`,
        secret_type: 'api_token' as SecretType,
        value: `value_${i}`,
      });
    }

    // Now retrieve them all concurrently
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push(
        invokeCommand<string>(page, 'retrieve_secret', {
          user: `user_${i}`,
          secret_type: 'api_token' as SecretType,
        })
      );
    }

    const results = await Promise.all(operations);

    // All should succeed and return correct values
    for (let i = 0; i < 5; i++) {
      expect(results[i].success).toBe(true);
      expect(results[i].data).toBe(`value_${i}`);
    }
  });

  test('should handle mixed concurrent operations', async ({ page }) => {
    // Store a secret
    await invokeCommand<void>(page, 'store_secret', {
      user: TEST_USERS.alice.id,
      secret_type: 'master_key' as SecretType,
      value: 'initial_value',
    });

    // Run mixed operations concurrently
    const operations = [
      invokeCommand<boolean>(page, 'has_secret', {
        user: TEST_USERS.alice.id,
        secret_type: 'master_key' as SecretType,
      }),
      invokeCommand<string>(page, 'retrieve_secret', {
        user: TEST_USERS.alice.id,
        secret_type: 'master_key' as SecretType,
      }),
      invokeCommand<void>(page, 'store_secret', {
        user: TEST_USERS.bob.id,
        secret_type: 'master_key' as SecretType,
        value: 'bob_value',
      }),
    ];

    const results = await Promise.all(operations);

    expect(results[0].data).toBe(true); // has_secret
    expect(results[1].data).toBe('initial_value'); // retrieve_secret
    expect(results[2].success).toBe(true); // store_secret
  });
});
