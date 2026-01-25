/**
 * Tauri App E2E Tests - Keyring / Secure Storage
 *
 * Tests secure credential storage operations using mocked Tauri commands.
 */

import { test, expect } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
  getTauriMockState,
} from './utils/tauri-mocks';
import {
  waitForAppReady,
  clearStorageAndReload,
  createIdentity,
} from './utils/helpers';
import {
  TEST_KEYPAIR,
  MOCK_KEYRING_SECRETS,
  TIMEOUTS,
} from './utils/fixtures';

test.describe('Tauri Keyring - Store Secrets', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Keyring Store User', 'keyringstore12');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should store Nostr private key', async ({ page }) => {
    const result = await page.evaluate(
      async ({ user, secretType, value }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('store_secret', {
          user,
          secret_type: secretType,
          value,
          label: 'Test Nostr Key',
        });
      },
      {
        user: 'testuser',
        secretType: 'nostr_private_key',
        value: TEST_KEYPAIR.private_key,
      }
    );

    expect(result.success).toBe(true);

    // Verify stored in mock state
    const mockState = await getTauriMockState(page);
    const stored = mockState?.keyring.secrets;
    expect(stored).toBeDefined();
  });

  test('should store master key', async ({ page }) => {
    const masterKey = 'deadbeef'.repeat(8); // 32 bytes hex

    const result = await page.evaluate(
      async ({ user, value }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('store_secret', {
          user,
          secret_type: 'master_key',
          value,
        });
      },
      { user: 'testuser', value: masterKey }
    );

    expect(result.success).toBe(true);
  });

  test('should store database key', async ({ page }) => {
    const dbKey = 'cafebabe'.repeat(8);

    const result = await page.evaluate(
      async ({ user, value }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('store_secret', {
          user,
          secret_type: 'database_key',
          value,
        });
      },
      { user: 'testuser', value: dbKey }
    );

    expect(result.success).toBe(true);
  });

  test('should store API token', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('store_secret', {
        user: 'testuser',
        secret_type: 'api_token',
        value: 'test-api-token-12345',
        label: 'Test API Token',
      });
    });

    expect(result.success).toBe(true);
  });

  test('should store custom secret', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('store_secret', {
        user: 'testuser',
        secret_type: { custom: 'my_custom_secret' },
        value: 'custom-secret-value',
      });
    });

    expect(result.success).toBe(true);
  });

  test('should overwrite existing secret', async ({ page }) => {
    // Store initial value
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('store_secret', {
        user: 'testuser',
        secret_type: 'api_token',
        value: 'original-value',
      });
    });

    // Overwrite
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('store_secret', {
        user: 'testuser',
        secret_type: 'api_token',
        value: 'new-value',
      });
    });

    expect(result.success).toBe(true);

    // Retrieve to verify
    const retrieved = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'testuser',
        secret_type: 'api_token',
      });
    });

    expect(retrieved.data).toBe('new-value');
  });
});

test.describe('Tauri Keyring - Retrieve Secrets', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await createIdentity(page, 'Keyring Retrieve User', 'keyringretriev');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should retrieve stored secret', async ({ page }) => {
    // Re-setup with the mock secrets
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });

    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'testuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(TEST_KEYPAIR.private_key);
  });

  test('should handle non-existent secret', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'nonexistent',
        secret_type: 'nostr_private_key',
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should retrieve custom secret type', async ({ page }) => {
    // Store custom secret first
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('store_secret', {
        user: 'testuser',
        secret_type: { custom: 'special_key' },
        value: 'special-value',
      });
    });

    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'testuser',
        secret_type: { custom: 'special_key' },
      });
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('special-value');
  });
});

test.describe('Tauri Keyring - Delete Secrets', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await createIdentity(page, 'Keyring Delete User', 'keyringdelete1');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should delete secret', async ({ page }) => {
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });

    // Verify secret exists
    const existsBefore = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'testuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(existsBefore.data).toBe(true);

    // Delete
    const deleteResult = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('delete_secret', {
        user: 'testuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(deleteResult.success).toBe(true);

    // Verify deleted
    const existsAfter = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'testuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(existsAfter.data).toBe(false);
  });

  test('should handle delete of non-existent secret', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('delete_secret', {
        user: 'nonexistent',
        secret_type: 'api_token',
      });
    });

    // Should succeed (no-op or return success)
    expect(result.success).toBe(true);
  });
});

test.describe('Tauri Keyring - Check Secret Existence', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await createIdentity(page, 'Keyring Check User', 'keyringcheckpa');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should return true for existing secret', async ({ page }) => {
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });

    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'testuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  test('should return false for non-existing secret', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'unknown_user',
        secret_type: 'nostr_private_key',
      });
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(false);
  });

  test('should check different secret types independently', async ({ page }) => {
    // Store only one type
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('store_secret', {
        user: 'newuser',
        secret_type: 'api_token',
        value: 'token-value',
      });
    });

    // Check api_token exists
    const hasToken = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'newuser',
        secret_type: 'api_token',
      });
    });

    expect(hasToken.data).toBe(true);

    // Check nostr_private_key doesn't exist for same user
    const hasKey = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('has_secret', {
        user: 'newuser',
        secret_type: 'nostr_private_key',
      });
    });

    expect(hasKey.data).toBe(false);
  });
});

test.describe('Tauri Keyring - Crypto Operations', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Crypto Ops User', 'cryptoopspassw');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should generate keypair', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: { private_key: string; public_key: string } }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('generate_keypair');
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('private_key');
    expect(result.data).toHaveProperty('public_key');
    expect(result.data.private_key.length).toBe(64); // 32 bytes hex
    expect(result.data.public_key.length).toBe(64);
  });

  test('should encrypt with NIP-44', async ({ page }) => {
    const conversationKey = 'c'.repeat(64);
    const plaintext = 'Secret message to encrypt';

    const result = await page.evaluate(
      async ({ key, text }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: string }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('encrypt_nip44', {
          conversation_key_hex: key,
          plaintext: text,
        });
      },
      { key: conversationKey, text: plaintext }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data).not.toBe(plaintext); // Should be encrypted
  });

  test('should decrypt with NIP-44', async ({ page }) => {
    const conversationKey = 'c'.repeat(64);
    const plaintext = 'Original message';
    const ciphertext = btoa(plaintext); // Mock encryption is base64

    const result = await page.evaluate(
      async ({ key, cipher }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: string }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('decrypt_nip44', {
          conversation_key_hex: key,
          ciphertext: cipher,
        });
      },
      { key: conversationKey, cipher: ciphertext }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe(plaintext);
  });

  test('should derive conversation key', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('derive_conversation_key', {
        private_key_hex: 'a'.repeat(64),
        recipient_pubkey_hex: 'b'.repeat(64),
      });
    });

    expect(result.success).toBe(true);
    expect(result.data.length).toBe(64); // 32 bytes hex
  });

  test('should handle invalid conversation key length', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('encrypt_nip44', {
        conversation_key_hex: 'short', // Invalid length
        plaintext: 'test',
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  test('should round-trip encrypt/decrypt', async ({ page }) => {
    const conversationKey = 'c'.repeat(64);
    const originalMessage = 'This is a test message for round-trip';

    // Encrypt
    const encrypted = await page.evaluate(
      async ({ key, text }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: string }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('encrypt_nip44', {
          conversation_key_hex: key,
          plaintext: text,
        });
      },
      { key: conversationKey, text: originalMessage }
    );

    // Decrypt
    const decrypted = await page.evaluate(
      async ({ key, cipher }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: string }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('decrypt_nip44', {
          conversation_key_hex: key,
          ciphertext: cipher,
        });
      },
      { key: conversationKey, cipher: encrypted.data }
    );

    expect(decrypted.data).toBe(originalMessage);
  });
});

test.describe('Tauri Keyring - User Isolation', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Isolation Test User', 'isolationtpass');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should isolate secrets by user', async ({ page }) => {
    // Store secrets for two users
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('store_secret', {
        user: 'alice',
        secret_type: 'api_token',
        value: 'alice-token',
      });
      await internals.invoke('store_secret', {
        user: 'bob',
        secret_type: 'api_token',
        value: 'bob-token',
      });
    });

    // Retrieve Alice's secret
    const aliceSecret = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'alice',
        secret_type: 'api_token',
      });
    });

    // Retrieve Bob's secret
    const bobSecret = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: string }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'bob',
        secret_type: 'api_token',
      });
    });

    expect(aliceSecret.data).toBe('alice-token');
    expect(bobSecret.data).toBe('bob-token');
    expect(aliceSecret.data).not.toBe(bobSecret.data);
  });

  test('should not leak secrets across users', async ({ page }) => {
    // Store Alice's secret
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('store_secret', {
        user: 'alice',
        secret_type: 'nostr_private_key',
        value: 'alice-private-key',
      });
    });

    // Try to retrieve as different user
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('retrieve_secret', {
        user: 'eve', // Different user
        secret_type: 'nostr_private_key',
      });
    });

    expect(result.success).toBe(false);
  });
});
