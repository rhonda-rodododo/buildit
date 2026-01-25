import ExifReader from 'exifreader';

/**
 * EXIF Stripping Utility for Privacy
 *
 * Removes EXIF metadata from images using canvas-based approach
 * This prevents location data, camera info, and other sensitive metadata from leaking
 */

export interface ExifData {
  hasExif: boolean;
  orientation?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  cameraMake?: string;
  cameraModel?: string;
  dateTaken?: string;
  [key: string]: unknown;
}

/**
 * Read EXIF data from an image file
 */
export async function readExif(file: File): Promise<ExifData> {
  try {
    const tags = await ExifReader.load(file);

    const exifData: ExifData = {
      hasExif: Object.keys(tags).length > 0,
    };

    // Extract common EXIF fields
    if (tags.Orientation) {
      exifData.orientation = tags.Orientation.value as number;
    }

    if (tags.GPSLatitude && tags.GPSLongitude) {
      exifData.gpsLatitude = tags.GPSLatitude.description as unknown as number;
      exifData.gpsLongitude = tags.GPSLongitude.description as unknown as number;
    }

    if (tags.Make) {
      exifData.cameraMake = tags.Make.description as string;
    }

    if (tags.Model) {
      exifData.cameraModel = tags.Model.description as string;
    }

    if (tags.DateTime || tags.DateTimeOriginal) {
      exifData.dateTaken = (tags.DateTime?.description || tags.DateTimeOriginal?.description) as string;
    }

    return exifData;
  } catch (error) {
    // File might not have EXIF data
    return { hasExif: false };
  }
}

/**
 * Strip EXIF data from an image by redrawing it on a canvas
 * This removes all metadata while preserving the visual image
 */
export async function stripExif(file: File, options?: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<{ file: File; exifData: ExifData }> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85,
    outputFormat = 'image/jpeg'
  } = options || {};

  // Read EXIF data before stripping (for logging/audit)
  const exifData = await readExif(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate dimensions while maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // Handle orientation from EXIF
      const orientation = exifData.orientation || 1;

      // Set canvas dimensions
      if (orientation >= 5 && orientation <= 8) {
        // Rotated 90 or 270 degrees
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      // Apply orientation transformations
      switch (orientation) {
        case 2:
          ctx.transform(-1, 0, 0, 1, width, 0);
          break;
        case 3:
          ctx.transform(-1, 0, 0, -1, width, height);
          break;
        case 4:
          ctx.transform(1, 0, 0, -1, 0, height);
          break;
        case 5:
          ctx.transform(0, 1, 1, 0, 0, 0);
          break;
        case 6:
          ctx.transform(0, 1, -1, 0, height, 0);
          break;
        case 7:
          ctx.transform(0, -1, -1, 0, height, width);
          break;
        case 8:
          ctx.transform(0, -1, 1, 0, 0, width);
          break;
      }

      // Draw image on canvas (this strips all EXIF data)
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          // Create new file from blob
          const strippedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${outputFormat.split('/')[1]}`),
            { type: outputFormat }
          );

          resolve({ file: strippedFile, exifData });
        },
        outputFormat,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Check if a file is an image that might contain EXIF data
 */
export function isExifCapable(file: File): boolean {
  const exifCapableTypes = ['image/jpeg', 'image/jpg', 'image/tiff', 'image/webp'];
  return exifCapableTypes.includes(file.type.toLowerCase());
}

/**
 * Generate a thumbnail from an image
 */
export async function generateThumbnail(
  file: File,
  width: number = 400,
  height: number = 400,
  quality: number = 0.8
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
      // Calculate dimensions maintaining aspect ratio
      const ratio = Math.min(width / img.width, height / img.height);
      const thumbnailWidth = Math.floor(img.width * ratio);
      const thumbnailHeight = Math.floor(img.height * ratio);

      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;

      ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create thumbnail blob'));
            return;
          }

          const thumbnailFile = new File(
            [blob],
            `thumb_${file.name}`,
            { type: 'image/jpeg' }
          );

          resolve(thumbnailFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail'));
    };

    img.src = URL.createObjectURL(file);
  });
}
