import { z } from 'zod';

/**
 * Media Types and Validation for BuildIt Network
 *
 * Supports images, videos, audio, documents with encryption and privacy controls
 */

// Media Types
export type MediaType = 'image' | 'video' | 'audio' | 'document';

export type MediaPrivacyLevel = 'public' | 'group' | 'private' | 'encrypted';

export type MediaStorageProvider = 'nip94' | 'nip96' | 'blossom' | 'ipfs' | 'local';

// Media Metadata Schema
export const MediaMetadataSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(), // bytes
  url: z.string().optional(), // URL after upload
  thumbnailUrl: z.string().optional(),

  // Dimensions (for images/videos)
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(), // seconds (for audio/video)

  // Privacy and Security
  privacyLevel: z.enum(['public', 'group', 'private', 'encrypted']),
  encrypted: z.boolean(),
  encryptionKey: z.string().optional(), // Base64 encoded encryption key

  // EXIF and Privacy
  exifStripped: z.boolean(),
  contentWarning: z.boolean().optional(),
  contentWarningReason: z.string().optional(),
  blurOnLoad: z.boolean().optional(),

  // Storage
  storageProvider: z.enum(['nip94', 'nip96', 'blossom', 'ipfs', 'local']),
  storageUrl: z.string().optional(),
  ipfsHash: z.string().optional(),

  // Metadata
  uploadedAt: z.number(), // Unix timestamp
  uploadedBy: z.string(), // npub
  groupId: z.string().optional(),

  // Additional metadata
  alt: z.string().optional(), // Alt text for accessibility
  caption: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type MediaMetadata = z.infer<typeof MediaMetadataSchema>;

// Upload Progress
export interface MediaUploadProgress {
  id: string;
  filename: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'encrypting' | 'complete' | 'error';
  error?: string;
}

// Media Attachment (for messages, posts, etc)
export const MediaAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),

  // For encrypted media
  encrypted: z.boolean(),
  encryptionKey: z.string().optional(),

  // Privacy
  contentWarning: z.boolean().optional(),
  blurOnLoad: z.boolean().optional(),

  // Accessibility
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

// NIP-94 File Metadata Event (kind 1063)
export interface NIP94FileMetadata {
  url: string;
  m?: string; // MIME type
  x?: string; // SHA-256 hash (hex)
  ox?: string; // Original file hash
  size?: string; // File size in bytes
  dim?: string; // Dimensions (e.g., "1920x1080")
  magnet?: string; // Magnet URI
  i?: string; // Torrent infohash
  blurhash?: string;
  thumb?: string; // Thumbnail URL
  image?: string; // Full-size image URL
  summary?: string;
  alt?: string;
}

// NIP-96 HTTP File Storage
export interface NIP96UploadRequest {
  file: File;
  caption?: string;
  media_type?: string;
  content_warning?: string;
  expiration?: number; // Unix timestamp
}

export interface NIP96UploadResponse {
  status: 'success' | 'error' | 'processing';
  message?: string;
  processing_url?: string;
  nip94_event?: {
    tags: string[][];
    content: string;
  };
}

// Blossom Protocol (BUD-01)
export interface BlossomUploadAuth {
  type: 'blossom-upload-auth';
  blob_hash: string; // SHA-256 hash
  uploaded_at: number;
  size: number;
  sig: string;
}

export interface BlossomBlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

// Media Configuration
export interface MediaConfig {
  maxFileSize: {
    image: number; // bytes
    video: number;
    audio: number;
    document: number;
  };
  allowedMimeTypes: {
    image: string[];
    video: string[];
    audio: string[];
    document: string[];
  };
  imageCompression: {
    maxWidth: number;
    maxHeight: number;
    quality: number; // 0-1
  };
  videoCompression: {
    maxWidth: number;
    maxHeight: number;
    maxBitrate: number; // kbps
  };
  thumbnailSize: {
    width: number;
    height: number;
  };
  stripExif: boolean;
  defaultPrivacyLevel: MediaPrivacyLevel;
  defaultStorageProvider: MediaStorageProvider;
}

// Default Configuration
export const DEFAULT_MEDIA_CONFIG: MediaConfig = {
  maxFileSize: {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
    audio: 50 * 1024 * 1024, // 50MB
    document: 25 * 1024 * 1024, // 25MB
  },
  allowedMimeTypes: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/webm', 'video/ogg'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
    document: [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  imageCompression: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.85,
  },
  videoCompression: {
    maxWidth: 1920,
    maxHeight: 1080,
    maxBitrate: 5000, // 5 Mbps
  },
  thumbnailSize: {
    width: 400,
    height: 400,
  },
  stripExif: true,
  defaultPrivacyLevel: 'group',
  defaultStorageProvider: 'nip96',
};
