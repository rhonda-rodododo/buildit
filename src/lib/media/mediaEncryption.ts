/**
 * Media Encryption Utilities
 *
 * Encrypts media files before upload using AES-GCM
 * Encryption keys are stored with the message/post for authorized decryption
 */

/**
 * Generate a random encryption key
 */
export async function generateMediaKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const exportedKeyBuffer = new Uint8Array(exported);
  const keyArray = Array.from(exportedKeyBuffer);
  const keyHex = keyArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(keyHex);
}

/**
 * Import a base64 key string to CryptoKey
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyHex = atob(keyString);
  const keyArray = keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16));
  const keyBuffer = new Uint8Array(keyArray);

  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a file
 */
export async function encryptFile(file: File, key?: CryptoKey): Promise<{
  encryptedBlob: Blob;
  key: CryptoKey;
  keyString: string;
  iv: string;
}> {
  // Generate key if not provided
  const encryptionKey = key || await generateMediaKey();

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    encryptionKey,
    fileBuffer
  );

  // Create blob from encrypted data
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

  // Export key to string
  const keyString = await exportKey(encryptionKey);

  // Convert IV to base64
  const ivString = btoa(String.fromCharCode(...iv));

  return {
    encryptedBlob,
    key: encryptionKey,
    keyString,
    iv: ivString,
  };
}

/**
 * Decrypt a file
 */
export async function decryptFile(
  encryptedBlob: Blob,
  keyString: string,
  ivString: string,
  originalMimeType: string
): Promise<Blob> {
  // Import key
  const key = await importKey(keyString);

  // Convert IV from base64
  const ivArray = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));

  // Read encrypted data
  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivArray,
    },
    key,
    encryptedBuffer
  );

  // Return blob with original MIME type
  return new Blob([decryptedBuffer], { type: originalMimeType });
}

/**
 * Encrypt media with thumbnail
 * Returns both encrypted files with a single shared key
 */
export async function encryptMediaWithThumbnail(
  file: File,
  thumbnail?: File
): Promise<{
  encryptedFile: Blob;
  encryptedThumbnail?: Blob;
  keyString: string;
  iv: string;
  thumbnailIv?: string;
}> {
  // Generate a single key for both file and thumbnail
  const key = await generateMediaKey();

  // Encrypt main file
  const { encryptedBlob: encryptedFile, iv } = await encryptFile(file, key);

  let encryptedThumbnail: Blob | undefined;
  let thumbnailIv: string | undefined;

  // Encrypt thumbnail if provided
  if (thumbnail) {
    const thumbResult = await encryptFile(thumbnail, key);
    encryptedThumbnail = thumbResult.encryptedBlob;
    thumbnailIv = thumbResult.iv;
  }

  const keyString = await exportKey(key);

  return {
    encryptedFile,
    encryptedThumbnail,
    keyString,
    iv,
    thumbnailIv,
  };
}

/**
 * Create an encrypted thumbnail URL (object URL for local preview)
 */
export function createEncryptedObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke an object URL
 */
export function revokeEncryptedObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Calculate file hash for integrity verification
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
