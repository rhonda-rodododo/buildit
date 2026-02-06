/**
 * Media Processor
 * Handles image/video processing for the post composer.
 * Strips EXIF data, compresses images, generates thumbnails,
 * and enforces size limits.
 *
 * PRIVACY: All processing happens client-side. EXIF data (especially GPS)
 * is ALWAYS stripped before any upload or display to protect activists.
 *
 * Epic 78: Media & File Upload System
 */

import { stripExif, isExifCapable } from './exifStripper';
import { DEFAULT_MEDIA_CONFIG } from '@/types/media';
import type { MediaAttachment } from '@/types/media';
import { createLogger } from '@/lib/logger';

const log = createLogger('media');

/** Maximum image file size after compression (2MB) */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/** Maximum image dimension */
const MAX_IMAGE_DIMENSION = 2048;

/** Maximum video file size (50MB) */
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

/** Maximum number of media attachments per post */
export const MAX_MEDIA_PER_POST = 4;

/** Supported image MIME types */
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** Supported video MIME types */
const SUPPORTED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
]);

export interface ProcessedMedia {
  /** Unique ID for this media item */
  id: string;
  /** Original file name */
  fileName: string;
  /** Processed file (EXIF stripped, compressed) */
  file: File;
  /** Object URL for preview display */
  previewUrl: string;
  /** Thumbnail URL for videos */
  thumbnailUrl?: string;
  /** Media type */
  type: 'image' | 'video';
  /** MIME type */
  mimeType: string;
  /** Size in bytes after processing */
  size: number;
  /** Original size before processing */
  originalSize: number;
  /** Whether EXIF was stripped */
  exifStripped: boolean;
  /** Image dimensions */
  width?: number;
  height?: number;
  /** Video duration in seconds */
  duration?: number;
}

export interface MediaValidationError {
  file: File;
  error: string;
  code: 'too_large' | 'unsupported_type' | 'too_many' | 'processing_failed';
}

/**
 * Validate files before processing.
 * Returns errors for any files that cannot be processed.
 */
export function validateMediaFiles(
  files: File[],
  currentCount: number = 0
): MediaValidationError[] {
  const errors: MediaValidationError[] = [];

  // Check total count limit
  if (currentCount + files.length > MAX_MEDIA_PER_POST) {
    files.slice(MAX_MEDIA_PER_POST - currentCount).forEach((file) => {
      errors.push({
        file,
        error: `Maximum ${MAX_MEDIA_PER_POST} media items per post`,
        code: 'too_many',
      });
    });
  }

  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    // Check supported types
    if (isImage && !SUPPORTED_IMAGE_TYPES.has(file.type)) {
      errors.push({
        file,
        error: `Unsupported image format: ${file.type}`,
        code: 'unsupported_type',
      });
      continue;
    }

    if (isVideo && !SUPPORTED_VIDEO_TYPES.has(file.type)) {
      errors.push({
        file,
        error: `Unsupported video format: ${file.type}`,
        code: 'unsupported_type',
      });
      continue;
    }

    if (!isImage && !isVideo) {
      errors.push({
        file,
        error: `Unsupported file type: ${file.type}`,
        code: 'unsupported_type',
      });
      continue;
    }

    // Check size limits (before processing - images will be compressed)
    if (isImage && file.size > DEFAULT_MEDIA_CONFIG.maxFileSize.image) {
      errors.push({
        file,
        error: `Image too large: ${formatFileSize(file.size)} (max ${formatFileSize(DEFAULT_MEDIA_CONFIG.maxFileSize.image)})`,
        code: 'too_large',
      });
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      errors.push({
        file,
        error: `Video too large: ${formatFileSize(file.size)} (max ${formatFileSize(MAX_VIDEO_SIZE)})`,
        code: 'too_large',
      });
    }
  }

  return errors;
}

/**
 * Process a single image file:
 * 1. Strip EXIF metadata (GPS, camera info, etc.)
 * 2. Resize if larger than MAX_IMAGE_DIMENSION
 * 3. Compress to keep under MAX_IMAGE_SIZE
 *
 * Returns a ProcessedMedia object with a blob URL for preview.
 */
export async function processImage(file: File): Promise<ProcessedMedia> {
  const id = `media-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  log.info(`Processing image: ${file.name} (${formatFileSize(file.size)})`);

  let processedFile: File;
  let exifStripped = false;

  // Always strip EXIF for supported types (privacy-critical for activists)
  if (isExifCapable(file)) {
    const result = await stripExif(file, {
      maxWidth: MAX_IMAGE_DIMENSION,
      maxHeight: MAX_IMAGE_DIMENSION,
      quality: 0.85,
      outputFormat: 'image/jpeg',
    });
    processedFile = result.file;
    exifStripped = true;

    if (result.exifData.gpsLatitude || result.exifData.gpsLongitude) {
      log.info('GPS data stripped from image (privacy protection)');
    }
  } else if (file.type === 'image/png' || file.type === 'image/gif') {
    // For PNG/GIF, still redraw on canvas to strip any metadata
    processedFile = await redrawOnCanvas(file);
    exifStripped = true;
  } else {
    processedFile = file;
  }

  // If still too large after initial processing, try further compression
  if (processedFile.size > MAX_IMAGE_SIZE) {
    processedFile = await compressImageIteratively(processedFile, MAX_IMAGE_SIZE);
  }

  // Get dimensions
  const dimensions = await getImageDimensions(processedFile);

  // Create object URL for preview
  const previewUrl = URL.createObjectURL(processedFile);

  log.info(
    `Image processed: ${file.name} ${formatFileSize(file.size)} -> ${formatFileSize(processedFile.size)} (EXIF stripped: ${exifStripped})`
  );

  return {
    id,
    fileName: file.name,
    file: processedFile,
    previewUrl,
    type: 'image',
    mimeType: processedFile.type,
    size: processedFile.size,
    originalSize: file.size,
    exifStripped,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Process a video file:
 * 1. Validate size constraints
 * 2. Generate thumbnail from first frame
 * 3. Extract duration
 *
 * Note: Video compression requires WebCodecs or ffmpeg.wasm which are heavy.
 * We enforce size limits instead.
 */
export async function processVideo(file: File): Promise<ProcessedMedia> {
  const id = `media-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  log.info(`Processing video: ${file.name} (${formatFileSize(file.size)})`);

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      `Video too large: ${formatFileSize(file.size)}. Maximum size is ${formatFileSize(MAX_VIDEO_SIZE)}.`
    );
  }

  // Create object URL for preview and thumbnail generation
  const previewUrl = URL.createObjectURL(file);

  // Generate thumbnail from first frame
  const { thumbnailUrl, width, height, duration } =
    await generateVideoThumbnail(previewUrl);

  log.info(
    `Video processed: ${file.name} (${formatFileSize(file.size)}, ${Math.round(duration || 0)}s)`
  );

  return {
    id,
    fileName: file.name,
    file,
    previewUrl,
    thumbnailUrl,
    type: 'video',
    mimeType: file.type,
    size: file.size,
    originalSize: file.size,
    exifStripped: false,
    width,
    height,
    duration,
  };
}

/**
 * Process multiple files (images and videos).
 * Returns processed media and any errors encountered.
 */
export async function processMediaFiles(
  files: File[],
  currentCount: number = 0
): Promise<{
  processed: ProcessedMedia[];
  errors: MediaValidationError[];
}> {
  const validationErrors = validateMediaFiles(files, currentCount);
  const errorFiles = new Set(validationErrors.map((e) => e.file));

  const processed: ProcessedMedia[] = [];
  const errors = [...validationErrors];

  const validFiles = files
    .filter((f) => !errorFiles.has(f))
    .slice(0, MAX_MEDIA_PER_POST - currentCount);

  for (const file of validFiles) {
    try {
      if (file.type.startsWith('image/')) {
        const result = await processImage(file);
        processed.push(result);
      } else if (file.type.startsWith('video/')) {
        const result = await processVideo(file);
        processed.push(result);
      }
    } catch (error) {
      log.error(`Failed to process ${file.name}:`, error);
      errors.push({
        file,
        error: error instanceof Error ? error.message : 'Processing failed',
        code: 'processing_failed',
      });
    }
  }

  return { processed, errors };
}

/**
 * Convert ProcessedMedia to MediaAttachment for post creation.
 */
export function toMediaAttachment(media: ProcessedMedia): MediaAttachment {
  return {
    id: media.id,
    type: media.type,
    url: media.previewUrl,
    thumbnailUrl: media.thumbnailUrl,
    filename: media.fileName,
    mimeType: media.mimeType,
    size: media.size,
    encrypted: false,
    alt: undefined,
  };
}

/**
 * Clean up object URLs when media is removed.
 */
export function revokeMediaUrls(media: ProcessedMedia): void {
  try {
    URL.revokeObjectURL(media.previewUrl);
    if (media.thumbnailUrl) {
      URL.revokeObjectURL(media.thumbnailUrl);
    }
  } catch {
    // Ignore revocation errors
  }
}

// --- Internal helpers ---

/**
 * Redraw an image on canvas to strip any embedded metadata.
 * Used for PNG/GIF files that don't have EXIF but may have other metadata.
 */
function redrawOnCanvas(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Resize if needed
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(
          MAX_IMAGE_DIMENSION / width,
          MAX_IMAGE_DIMENSION / height
        );
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Keep original format for PNG/GIF to preserve transparency/animation
      // But GIF animation is lost through canvas - that's acceptable for privacy
      const outputType =
        file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = file.type === 'image/png' ? undefined : 0.85;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }
          resolve(
            new File([blob], file.name, {
              type: outputType,
            })
          );
        },
        outputType,
        quality
      );

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Iteratively compress an image until it's under the target size.
 * Reduces quality progressively, then reduces dimensions if needed.
 */
async function compressImageIteratively(
  file: File,
  targetSize: number
): Promise<File> {
  let quality = 0.8;
  let scaleFactor = 1.0;
  let currentFile = file;

  // Try reducing quality first
  while (currentFile.size > targetSize && quality > 0.3) {
    currentFile = await compressWithQuality(
      file,
      quality,
      scaleFactor
    );
    quality -= 0.1;
  }

  // If quality reduction wasn't enough, reduce dimensions
  while (currentFile.size > targetSize && scaleFactor > 0.3) {
    scaleFactor -= 0.15;
    currentFile = await compressWithQuality(
      file,
      0.7,
      scaleFactor
    );
  }

  return currentFile;
}

function compressWithQuality(
  file: File,
  quality: number,
  scaleFactor: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      const width = Math.floor(img.width * scaleFactor);
      const height = Math.floor(img.height * scaleFactor);

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            })
          );
        },
        'image/jpeg',
        quality
      );

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get image dimensions from a file.
 */
function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to get image dimensions'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate a thumbnail from a video's first frame.
 * Also extracts video dimensions and duration.
 */
function generateVideoThumbnail(videoUrl: string): Promise<{
  thumbnailUrl: string;
  width: number;
  height: number;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const timeout = setTimeout(() => {
      video.src = '';
      reject(new Error('Video thumbnail generation timed out'));
    }, 15000);

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration (whichever is smaller)
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context for video thumbnail'));
        return;
      }

      // Use thumbnail dimensions from config
      const { width: thumbWidth, height: thumbHeight } =
        DEFAULT_MEDIA_CONFIG.thumbnailSize;
      const ratio = Math.min(
        thumbWidth / video.videoWidth,
        thumbHeight / video.videoHeight
      );
      canvas.width = Math.floor(video.videoWidth * ratio);
      canvas.height = Math.floor(video.videoHeight * ratio);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create video thumbnail'));
            return;
          }
          const thumbnailUrl = URL.createObjectURL(blob);
          resolve({
            thumbnailUrl,
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
        },
        'image/jpeg',
        0.8
      );
    };

    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load video for thumbnail'));
    };

    video.src = videoUrl;
  });
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
