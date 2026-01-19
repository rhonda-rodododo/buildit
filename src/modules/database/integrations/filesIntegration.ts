/**
 * Files Integration for Database Module
 * Provides utilities for attaching files to database records
 */

import { databaseManager } from '../databaseManager';
import type { RecordAttachment } from '../types';
import { logger } from '@/lib/logger';

// Type for file info (minimal interface to avoid tight coupling)
export interface FileInfo {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
}

/**
 * Attach a file to a database record
 * Creates the attachment record and logs activity
 */
export async function attachFileToRecord(
  recordId: string,
  tableId: string,
  groupId: string,
  file: FileInfo,
  userPubkey: string
): Promise<RecordAttachment | null> {
  try {
    const attachment = await databaseManager.attachFileToRecord(
      recordId,
      tableId,
      groupId,
      file.id,
      userPubkey,
      {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }
    );
    return attachment;
  } catch (error) {
    logger.error('Failed to attach file to record:', error);
    return null;
  }
}

/**
 * Attach multiple files to a record
 */
export async function attachFilesToRecord(
  recordId: string,
  tableId: string,
  groupId: string,
  files: FileInfo[],
  userPubkey: string
): Promise<RecordAttachment[]> {
  const attachments: RecordAttachment[] = [];

  for (const file of files) {
    const attachment = await attachFileToRecord(
      recordId,
      tableId,
      groupId,
      file,
      userPubkey
    );
    if (attachment) {
      attachments.push(attachment);
    }
  }

  return attachments;
}

/**
 * Detach a file from a database record
 */
export async function detachFileFromRecord(
  attachmentId: string,
  recordId: string,
  tableId: string,
  groupId: string,
  userPubkey: string
): Promise<boolean> {
  return databaseManager.detachFileFromRecord(
    attachmentId,
    recordId,
    tableId,
    groupId,
    userPubkey
  );
}

/**
 * Get all attachments for a record
 */
export async function getRecordAttachments(
  recordId: string,
  tableId: string
): Promise<RecordAttachment[]> {
  return databaseManager.getRecordAttachments(recordId, tableId);
}

/**
 * Get file type category from mime type
 */
export function getFileTypeCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return 'spreadsheet';
  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType === 'text/plain'
  )
    return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return 'presentation';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z')
  )
    return 'archive';
  return 'other';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file icon name based on type
 */
export function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Music';
    case 'pdf':
      return 'FileText';
    case 'spreadsheet':
      return 'Table';
    case 'document':
      return 'FileText';
    case 'presentation':
      return 'Presentation';
    case 'archive':
      return 'Archive';
    default:
      return 'File';
  }
}
