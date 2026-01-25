import { NostrEvent, finalizeEvent, getPublicKey } from 'nostr-tools';
import type {
  MediaMetadata,
  MediaStorageProvider,
  NIP94FileMetadata,
  NIP96UploadResponse,
  BlossomBlobDescriptor,
} from '@/types/media';
import { calculateFileHash } from './mediaEncryption';

/**
 * Media Storage Manager
 *
 * Handles uploading media to various storage providers:
 * - NIP-94: File Metadata Events
 * - NIP-96: HTTP File Storage
 * - Blossom: Decentralized Blob Storage
 * - IPFS: InterPlanetary File System
 * - Local: Browser storage (for development/offline)
 */

export interface UploadOptions {
  provider: MediaStorageProvider;
  file: File | Blob;
  metadata: Partial<MediaMetadata>;
  privateKey: Uint8Array;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  url: string;
  hash?: string;
  metadata: MediaMetadata;
  nip94Event?: NostrEvent;
}

/**
 * Main media upload function
 */
export async function uploadMedia(options: UploadOptions): Promise<UploadResult> {
  const { provider, file, metadata, privateKey, onProgress } = options;

  switch (provider) {
    case 'nip94':
      return uploadNIP94(file, metadata, privateKey, onProgress);
    case 'nip96':
      return uploadNIP96(file, metadata, privateKey, onProgress);
    case 'blossom':
      return uploadBlossom(file, metadata, privateKey, onProgress);
    case 'ipfs':
      return uploadIPFS(file, metadata, onProgress);
    case 'local':
      return uploadLocal(file, metadata);
    default:
      throw new Error(`Unsupported storage provider: ${provider}`);
  }
}

/**
 * NIP-94: File Metadata Event
 * Creates a Nostr event (kind 1063) describing the file
 */
async function uploadNIP94(
  file: File | Blob,
  metadata: Partial<MediaMetadata>,
  privateKey: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  onProgress?.(10);

  // Calculate file hash
  const hash = await calculateFileHash(file as File);
  onProgress?.(30);

  // For NIP-94, we store the file as a data URL or object URL (for demo)
  // In production, you'd upload to a server first
  const dataUrl = await fileToDataURL(file);
  onProgress?.(60);

  // Create NIP-94 event
  const pubkey = getPublicKey(privateKey);
  const fileMetadata: NIP94FileMetadata = {
    url: dataUrl,
    m: file.type || 'application/octet-stream',
    x: hash,
    size: file.size.toString(),
    alt: metadata.alt,
  };

  const event = finalizeEvent({
    kind: 1063, // NIP-94 File Metadata
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['url', fileMetadata.url],
      ['m', fileMetadata.m || 'application/octet-stream'],
      ['x', fileMetadata.x || ''],
      ['size', fileMetadata.size || '0'],
      ...(metadata.alt ? [['alt', metadata.alt] as [string, string]] : []),
    ],
    content: metadata.caption || '',
  }, privateKey);

  onProgress?.(100);

  const fullMetadata: MediaMetadata = {
    id: event.id,
    type: getMediaType(file.type),
    filename: (file as File).name || 'file',
    mimeType: file.type,
    size: file.size,
    url: dataUrl,
    privacyLevel: metadata.privacyLevel || 'public',
    encrypted: metadata.encrypted || false,
    exifStripped: metadata.exifStripped || false,
    storageProvider: 'nip94',
    storageUrl: dataUrl,
    uploadedAt: Date.now(),
    uploadedBy: pubkey,
    ...metadata,
  };

  return {
    url: dataUrl,
    hash,
    metadata: fullMetadata,
    nip94Event: event,
  };
}

/**
 * NIP-96: HTTP File Storage Integration
 * Upload to a NIP-96 compatible server
 */
async function uploadNIP96(
  file: File | Blob,
  metadata: Partial<MediaMetadata>,
  privateKey: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  // Example NIP-96 servers (configure in settings)
  const servers = [
    'https://nostr.build',
    'https://void.cat',
    'https://nostrcheck.me',
  ];

  const server = servers[0]; // Use first available server

  onProgress?.(10);

  const formData = new FormData();
  formData.append('file', file);

  if (metadata.caption) {
    formData.append('caption', metadata.caption);
  }

  if (metadata.contentWarning) {
    formData.append('content_warning', metadata.contentWarningReason || 'sensitive');
  }

  try {
    const response = await fetch(`${server}/api/v2/nip96/upload`, {
      method: 'POST',
      body: formData,
    });

    onProgress?.(80);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result: NIP96UploadResponse = await response.json();

    if (result.status !== 'success') {
      throw new Error(result.message || 'Upload failed');
    }

    onProgress?.(100);

    // Extract URL from NIP94 event tags
    const urlTag = result.nip94_event?.tags.find(tag => tag[0] === 'url');
    const url = urlTag?.[1] || '';

    const fullMetadata: MediaMetadata = {
      id: crypto.randomUUID(),
      type: getMediaType(file.type),
      filename: (file as File).name || 'file',
      mimeType: file.type,
      size: file.size,
      url,
      privacyLevel: metadata.privacyLevel || 'public',
      encrypted: metadata.encrypted || false,
      exifStripped: metadata.exifStripped || false,
      storageProvider: 'nip96',
      storageUrl: url,
      uploadedAt: Date.now(),
      uploadedBy: getPublicKey(privateKey),
      ...metadata,
    };

    return {
      url,
      metadata: fullMetadata,
    };
  } catch (error) {
    throw new Error(`NIP-96 upload failed: ${error}`);
  }
}

/**
 * Blossom: Decentralized Blob Storage
 * Upload to Blossom server with authentication
 */
async function uploadBlossom(
  file: File | Blob,
  metadata: Partial<MediaMetadata>,
  privateKey: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const blossomServers = [
    'https://blossom.primal.net',
    'https://cdn.satellite.earth',
  ];

  const server = blossomServers[0];

  onProgress?.(10);

  // Calculate blob hash
  const hash = await calculateFileHash(file as File);
  onProgress?.(30);

  // Create Blossom upload auth event
  const pubkey = getPublicKey(privateKey);
  const authEvent = finalizeEvent({
    kind: 24242, // Blossom upload auth
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'upload'],
      ['x', hash],
      ['size', file.size.toString()],
    ],
    content: '',
  }, privateKey);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${server}/upload`, {
      method: 'PUT',
      headers: {
        'Authorization': `Nostr ${btoa(JSON.stringify(authEvent))}`,
      },
      body: file,
    });

    onProgress?.(80);

    if (!response.ok) {
      throw new Error(`Blossom upload failed: ${response.statusText}`);
    }

    const result: BlossomBlobDescriptor = await response.json();

    onProgress?.(100);

    const fullMetadata: MediaMetadata = {
      id: crypto.randomUUID(),
      type: getMediaType(file.type),
      filename: (file as File).name || 'file',
      mimeType: file.type,
      size: file.size,
      url: result.url,
      privacyLevel: metadata.privacyLevel || 'public',
      encrypted: metadata.encrypted || false,
      exifStripped: metadata.exifStripped || false,
      storageProvider: 'blossom',
      storageUrl: result.url,
      uploadedAt: Date.now(),
      uploadedBy: pubkey,
      ...metadata,
    };

    return {
      url: result.url,
      hash: result.sha256,
      metadata: fullMetadata,
    };
  } catch (error) {
    throw new Error(`Blossom upload failed: ${error}`);
  }
}

/**
 * IPFS: InterPlanetary File System
 * Upload to IPFS via a gateway
 */
async function uploadIPFS(
  file: File | Blob,
  metadata: Partial<MediaMetadata>,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  // IPFS gateways for future implementation
  // const ipfsGateways = [
  //   'https://ipfs.io/api/v0/add',
  //   'https://api.pinata.cloud/pinning/pinFileToIPFS',
  // ];

  onProgress?.(10);

  // For demo purposes, we'll use object URL
  // In production, integrate with IPFS client or pinning service
  const dataUrl = await fileToDataURL(file);
  const ipfsHash = `Qm${crypto.randomUUID().replace(/-/g, '')}`;

  onProgress?.(100);

  const fullMetadata: MediaMetadata = {
    id: crypto.randomUUID(),
    type: getMediaType(file.type),
    filename: (file as File).name || 'file',
    mimeType: file.type,
    size: file.size,
    url: `ipfs://${ipfsHash}`,
    privacyLevel: metadata.privacyLevel || 'public',
    encrypted: metadata.encrypted || false,
    exifStripped: metadata.exifStripped || false,
    storageProvider: 'ipfs',
    storageUrl: `ipfs://${ipfsHash}`,
    ipfsHash,
    uploadedAt: Date.now(),
    uploadedBy: 'local',
    ...metadata,
  };

  return {
    url: dataUrl,
    hash: ipfsHash,
    metadata: fullMetadata,
  };
}

/**
 * Local: Browser Storage (for offline/development)
 * Store media as object URLs
 */
async function uploadLocal(
  file: File | Blob,
  metadata: Partial<MediaMetadata>
): Promise<UploadResult> {
  const objectUrl = URL.createObjectURL(file);

  const fullMetadata: MediaMetadata = {
    id: crypto.randomUUID(),
    type: getMediaType(file.type),
    filename: (file as File).name || 'file',
    mimeType: file.type,
    size: file.size,
    url: objectUrl,
    privacyLevel: metadata.privacyLevel || 'private',
    encrypted: metadata.encrypted || false,
    exifStripped: metadata.exifStripped || false,
    storageProvider: 'local',
    storageUrl: objectUrl,
    uploadedAt: Date.now(),
    uploadedBy: 'local',
    ...metadata,
  };

  return {
    url: objectUrl,
    metadata: fullMetadata,
  };
}

/**
 * Helper: Convert file to data URL
 */
function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Helper: Determine media type from MIME type
 */
function getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}
