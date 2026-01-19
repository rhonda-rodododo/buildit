/**
 * Attachment Field Editor
 * Upload and manage file attachments for database records
 */

import { useState, useRef, useCallback } from 'react';
import { formatFileSize, getFileTypeCategory } from '../integrations/filesIntegration';
import type { RecordAttachment } from '../types';
import { Button } from '@/components/ui/button';
import {
  Paperclip,
  Upload,
  X,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Table,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface AttachmentFieldEditorProps {
  recordId: string;
  tableId: string;
  groupId: string;
  userPubkey: string;
  attachments: RecordAttachment[];
  onUpload?: (file: File) => Promise<{ id: string; name: string; type: string; size: number } | null>;
  onAttach?: (fileId: string, fileName: string, fileType: string, fileSize: number) => Promise<void>;
  onDetach?: (attachmentId: string) => Promise<void>;
  onSelectExisting?: () => void;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
  acceptedTypes?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  audio: Music,
  pdf: FileText,
  spreadsheet: Table,
  document: FileText,
  archive: Archive,
  other: File,
};

export function AttachmentFieldEditor({
  recordId: _recordId,
  tableId: _tableId,
  groupId: _groupId,
  userPubkey: _userPubkey,
  attachments,
  onUpload,
  onAttach,
  onDetach,
  onSelectExisting,
  disabled,
  className,
  maxFiles = 10,
  acceptedTypes,
}: AttachmentFieldEditorProps) {
  // These props are reserved for future use (direct file operations)
  void _recordId;
  void _tableId;
  void _groupId;
  void _userPubkey;
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = attachments.length < maxFiles;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled || !canAddMore || !onUpload) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      await uploadFiles(files.slice(0, maxFiles - attachments.length));
    },
    [disabled, canAddMore, onUpload, attachments.length, maxFiles]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !canAddMore || !onUpload) return;

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await uploadFiles(files.slice(0, maxFiles - attachments.length));

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!onUpload || !onAttach) return;

    setUploading(true);
    try {
      for (const file of files) {
        const result = await onUpload(file);
        if (result) {
          await onAttach(result.id, result.name, result.type, result.size);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!onDetach) return;

    setRemovingId(attachmentId);
    try {
      await onDetach(attachmentId);
    } finally {
      setRemovingId(null);
    }
  };

  if (disabled) {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        {attachments.length > 0 ? (
          attachments.map((attachment) => {
            const fileType = attachment.fileType
              ? getFileTypeCategory(attachment.fileType)
              : 'other';
            const IconComponent = FILE_ICONS[fileType] || File;

            return (
              <div
                key={attachment.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-sm"
              >
                <IconComponent className="h-3 w-3" />
                <span className="truncate max-w-[120px]">
                  {attachment.fileName || t('common.attachment', 'Attachment')}
                </span>
              </div>
            );
          })
        ) : (
          <span className="text-muted-foreground italic">
            {t('common.noAttachments', 'No attachments')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((attachment) => {
            const fileType = attachment.fileType
              ? getFileTypeCategory(attachment.fileType)
              : 'other';
            const IconComponent = FILE_ICONS[fileType] || File;
            const isRemoving = removingId === attachment.id;

            return (
              <div
                key={attachment.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-sm group"
              >
                <IconComponent className="h-3 w-3" />
                <span className="truncate max-w-[120px]">
                  {attachment.fileName || t('common.attachment', 'Attachment')}
                </span>
                {attachment.fileSize && (
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(attachment.fileSize)})
                  </span>
                )}
                <button
                  onClick={() => handleRemove(attachment.id)}
                  disabled={isRemoving}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isRemoving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            uploading && 'opacity-50 pointer-events-none'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes}
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('common.uploading', 'Uploading...')}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                {t('common.dropFilesHere', 'Drop files here or')}{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline"
                >
                  {t('common.browse', 'browse')}
                </button>
              </div>
              {maxFiles > 1 && (
                <div className="text-xs text-muted-foreground">
                  {t('common.maxFilesRemaining', 'Up to {{count}} more files', {
                    count: maxFiles - attachments.length,
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {onSelectExisting && canAddMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectExisting}
            disabled={uploading}
          >
            <Paperclip className="h-4 w-4 mr-1" />
            {t('common.selectExisting', 'Select existing')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default AttachmentFieldEditor;
