import { describe, it, expect } from 'vitest';
import {
  generateMediaKey,
  exportKey,
  importKey,
  encryptFile,
  decryptFile,
  encryptMediaWithThumbnail,
  calculateFileHash,
} from '../mediaEncryption';

describe('Media Encryption', () => {
  describe('Key Management', () => {
    it('should generate a valid AES-GCM key', async () => {
      const key = await generateMediaKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should export and import a key correctly', async () => {
      const originalKey = await generateMediaKey();
      const exported = await exportKey(originalKey);
      const imported = await importKey(exported);

      expect(exported).toBeTypeOf('string');
      expect(imported.type).toBe('secret');
      expect(imported.algorithm.name).toBe('AES-GCM');
    });

    it('should produce consistent key exports', async () => {
      const key = await generateMediaKey();
      const export1 = await exportKey(key);
      const export2 = await exportKey(key);

      expect(export1).toBe(export2);
    });
  });

  describe('File Encryption', () => {
    it('should encrypt a file successfully', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await encryptFile(testFile);

      expect(result.encryptedBlob).toBeInstanceOf(Blob);
      expect(result.key).toBeDefined();
      expect(result.keyString).toBeTypeOf('string');
      expect(result.iv).toBeTypeOf('string');
      expect(result.encryptedBlob.size).toBeGreaterThan(0);
    });

    it('should use provided key for encryption', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const key = await generateMediaKey();
      const result = await encryptFile(testFile, key);

      expect(result.key).toBe(key);
    });

    it('should produce different IV for each encryption', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const key = await generateMediaKey();

      const result1 = await encryptFile(testFile, key);
      const result2 = await encryptFile(testFile, key);

      expect(result1.iv).not.toBe(result2.iv);
    });
  });

  describe('File Decryption', () => {
    it('should decrypt a file successfully', async () => {
      const originalContent = 'test content for decryption';
      const testFile = new File([originalContent], 'test.txt', { type: 'text/plain' });

      const { encryptedBlob, keyString, iv } = await encryptFile(testFile);
      const decryptedBlob = await decryptFile(encryptedBlob, keyString, iv, 'text/plain');

      const decryptedText = await decryptedBlob.text();
      expect(decryptedText).toBe(originalContent);
    });

    it('should preserve file type after decryption', async () => {
      const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const { encryptedBlob, keyString, iv } = await encryptFile(testFile);
      const decryptedBlob = await decryptFile(encryptedBlob, keyString, iv, 'image/jpeg');

      expect(decryptedBlob.type).toBe('image/jpeg');
    });

    it('should handle binary data correctly', async () => {
      const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5, 255, 254, 253]);
      const testFile = new File([binaryData], 'binary.bin', { type: 'application/octet-stream' });

      const { encryptedBlob, keyString, iv } = await encryptFile(testFile);
      const decryptedBlob = await decryptFile(encryptedBlob, keyString, iv, 'application/octet-stream');

      const decryptedArray = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(Array.from(decryptedArray)).toEqual(Array.from(binaryData));
    });

    it('should fail with wrong key', async () => {
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const { encryptedBlob, iv } = await encryptFile(testFile);

      const wrongKey = await generateMediaKey();
      const wrongKeyString = await exportKey(wrongKey);

      await expect(decryptFile(encryptedBlob, wrongKeyString, iv, 'text/plain')).rejects.toThrow();
    });

    it('should fail with wrong IV', async () => {
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const { encryptedBlob, keyString } = await encryptFile(testFile);

      const wrongIv = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));

      await expect(decryptFile(encryptedBlob, keyString, wrongIv, 'text/plain')).rejects.toThrow();
    });
  });

  describe('Media with Thumbnail Encryption', () => {
    it('should encrypt both file and thumbnail with same key', async () => {
      const file = new File(['main content'], 'main.jpg', { type: 'image/jpeg' });
      const thumbnail = new File(['thumb content'], 'thumb.jpg', { type: 'image/jpeg' });

      const result = await encryptMediaWithThumbnail(file, thumbnail);

      expect(result.encryptedFile).toBeInstanceOf(Blob);
      expect(result.encryptedThumbnail).toBeInstanceOf(Blob);
      expect(result.keyString).toBeTypeOf('string');
      expect(result.iv).toBeTypeOf('string');
      expect(result.thumbnailIv).toBeTypeOf('string');
    });

    it('should work without thumbnail', async () => {
      const file = new File(['main content'], 'main.jpg', { type: 'image/jpeg' });

      const result = await encryptMediaWithThumbnail(file);

      expect(result.encryptedFile).toBeInstanceOf(Blob);
      expect(result.encryptedThumbnail).toBeUndefined();
      expect(result.thumbnailIv).toBeUndefined();
    });

    it('should use different IVs for file and thumbnail', async () => {
      const file = new File(['main'], 'main.jpg', { type: 'image/jpeg' });
      const thumbnail = new File(['thumb'], 'thumb.jpg', { type: 'image/jpeg' });

      const result = await encryptMediaWithThumbnail(file, thumbnail);

      expect(result.iv).not.toBe(result.thumbnailIv);
    });

    it('should decrypt both file and thumbnail with same key', async () => {
      const mainContent = 'main image content';
      const thumbContent = 'thumbnail content';
      const file = new File([mainContent], 'main.jpg', { type: 'image/jpeg' });
      const thumbnail = new File([thumbContent], 'thumb.jpg', { type: 'image/jpeg' });

      const { encryptedFile, encryptedThumbnail, keyString, iv, thumbnailIv } =
        await encryptMediaWithThumbnail(file, thumbnail);

      const decryptedMain = await decryptFile(encryptedFile, keyString, iv, 'image/jpeg');
      const decryptedThumb = await decryptFile(encryptedThumbnail!, keyString, thumbnailIv!, 'image/jpeg');

      expect(await decryptedMain.text()).toBe(mainContent);
      expect(await decryptedThumb.text()).toBe(thumbContent);
    });
  });

  describe('File Hash', () => {
    it('should calculate consistent SHA-256 hash', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

      const hash1 = await calculateFileHash(testFile);
      const hash2 = await calculateFileHash(testFile);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
    });

    it('should produce different hashes for different content', async () => {
      const file1 = new File(['content 1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content 2'], 'test2.txt', { type: 'text/plain' });

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty files', async () => {
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      const hash = await calculateFileHash(emptyFile);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      // SHA-256 of empty string
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large files', async () => {
      const largeContent = new Uint8Array(1024 * 1024); // 1MB
      crypto.getRandomValues(largeContent);
      const largeFile = new File([largeContent], 'large.bin', { type: 'application/octet-stream' });

      const { encryptedBlob, keyString, iv } = await encryptFile(largeFile);
      const decryptedBlob = await decryptFile(encryptedBlob, keyString, iv, 'application/octet-stream');

      const decryptedArray = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedArray.length).toBe(largeContent.length);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Hello 世界 🌍 \n\t\r Special: ©®™';
      const file = new File([specialContent], 'special.txt', { type: 'text/plain' });

      const { encryptedBlob, keyString, iv } = await encryptFile(file);
      const decryptedBlob = await decryptFile(encryptedBlob, keyString, iv, 'text/plain');

      expect(await decryptedBlob.text()).toBe(specialContent);
    });
  });
});
