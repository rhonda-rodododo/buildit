/**
 * Attachment Field Renderer
 * Displays file attachments for a database record
 */

import { useState, useEffect } from 'react';
import { useDatabaseStore } from '../databaseStore';
import { databaseManager } from '../databaseManager';
import { formatFileSize, getFileTypeCategory } from '../integrations/filesIntegration';
import type { RecordAttachment } from '../types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Paperclip,
  Download,
  Eye,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Table,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface AttachmentFieldRendererProps {
  recordId: string;
  tableId: string;
  className?: string;
  onPreview?: (attachment: RecordAttachment) => void;
  onDownload?: (attachment: RecordAttachment) => void;
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

export function AttachmentFieldRenderer({
  recordId,
  tableId,
  className,
  onPreview,
  onDownload,
}: AttachmentFieldRendererProps) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  const attachmentsByRecord = useDatabaseStore((s) => s.attachmentsByRecord);

  useEffect(() => {
    const loadAttachments = async () => {
      setLoading(true);
      // First check store
      const cachedAttachments = attachmentsByRecord.get(recordId);
      if (cachedAttachments) {
        setAttachments(cachedAttachments);
        setLoading(false);
        return;
      }

      // Load from database
      try {
        const loaded = await databaseManager.getRecordAttachments(recordId, tableId);
        setAttachments(loaded);
        useDatabaseStore.getState().setAttachmentsForRecord(recordId, loaded);
      } catch (error) {
        console.error('Failed to load attachments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttachments();
  }, [recordId, tableId, attachmentsByRecord]);

  if (loading) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <span className={cn('text-muted-foreground italic text-sm', className)}>
        {t('common.noAttachments', 'No attachments')}
      </span>
    );
  }

  if (attachments.length === 1) {
    const attachment = attachments[0];
    const fileType = attachment.fileType
      ? getFileTypeCategory(attachment.fileType)
      : 'other';
    const IconComponent = FILE_ICONS[fileType] || File;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
              'bg-muted hover:bg-muted/80 transition-colors cursor-pointer text-sm',
              className
            )}
          >
            <IconComponent className="h-3 w-3" />
            <span className="truncate max-w-[150px]">
              {attachment.fileName || t('common.attachment', 'Attachment')}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <AttachmentPreview
            attachment={attachment}
            onPreview={onPreview}
            onDownload={onDownload}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Multiple attachments
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
            'bg-muted hover:bg-muted/80 transition-colors cursor-pointer text-sm',
            className
          )}
        >
          <Paperclip className="h-3 w-3" />
          <span>
            {t('common.attachmentsCount', '{{count}} attachments', {
              count: attachments.length,
            })}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <h4 className="font-medium text-sm">
            {t('common.attachments', 'Attachments')} ({attachments.length})
          </h4>
        </div>
        <div className="max-h-[300px] overflow-auto">
          {attachments.map((attachment) => {
            const fileType = attachment.fileType
              ? getFileTypeCategory(attachment.fileType)
              : 'other';
            const IconComponent = FILE_ICONS[fileType] || File;

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2 p-2 hover:bg-muted/50 border-b last:border-b-0"
              >
                <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {attachment.fileName || t('common.attachment', 'Attachment')}
                  </div>
                  {attachment.fileSize && (
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {onPreview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onPreview(attachment)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDownload(attachment)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AttachmentPreviewProps {
  attachment: RecordAttachment;
  onPreview?: (attachment: RecordAttachment) => void;
  onDownload?: (attachment: RecordAttachment) => void;
}

function AttachmentPreview({
  attachment,
  onPreview,
  onDownload,
}: AttachmentPreviewProps) {
  const { t } = useTranslation();
  const fileType = attachment.fileType
    ? getFileTypeCategory(attachment.fileType)
    : 'other';
  const IconComponent = FILE_ICONS[fileType] || File;

  return (
    <div className="flex flex-col gap-3">
      {/* File info */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-muted rounded">
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {attachment.fileName || t('common.attachment', 'Attachment')}
          </div>
          <div className="text-xs text-muted-foreground">
            {attachment.fileSize && formatFileSize(attachment.fileSize)}
            {attachment.fileType && (
              <>
                {' '}
                &middot; {attachment.fileType.split('/')[1]?.toUpperCase()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onPreview && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onPreview(attachment)}
          >
            <Eye className="h-4 w-4 mr-1" />
            {t('common.preview', 'Preview')}
          </Button>
        )}
        {onDownload && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onDownload(attachment)}
          >
            <Download className="h-4 w-4 mr-1" />
            {t('common.download', 'Download')}
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground pt-1 border-t">
        {t('common.addedAt', 'Added')}: {new Date(attachment.addedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

export default AttachmentFieldRenderer;
