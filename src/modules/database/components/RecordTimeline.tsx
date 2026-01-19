/**
 * Record Timeline Component
 * Chronological activity feed with comments, field changes, and attachments
 */

import { useState, useEffect } from 'react';
import { databaseManager } from '../databaseManager';
import type {
  RecordActivity,
  RecordComment,
  RecordAttachment,
  FieldChangeActivityData,
  StatusChangeActivityData,
  AssignmentActivityData,
  LinkActivityData,
  AttachmentActivityData,
} from '../types';
import { PubkeyFieldRenderer } from './PubkeyFieldRenderer';
import { formatFileSize } from '../integrations/filesIntegration';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Clock,
  Edit,
  Paperclip,
  Link2,
  User,
  Plus,
  ArrowRight,
  Trash2,
  Reply,
  Send,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface RecordTimelineProps {
  recordId: string;
  tableId: string;
  groupId: string;
  userPubkey: string;
  className?: string;
  onStartDM?: (pubkey: string) => void;
  onViewProfile?: (pubkey: string) => void;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
  onPreviewAttachment?: (attachment: RecordAttachment) => void;
}

type TimelineItem = {
  id: string;
  type: 'activity' | 'comment' | 'attachment';
  timestamp: number;
  data: RecordActivity | RecordComment | RecordAttachment;
};

type FilterType = 'all' | 'comments' | 'changes' | 'attachments';

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  updated: Edit,
  field_changed: Edit,
  comment: MessageSquare,
  attachment_added: Paperclip,
  attachment_removed: Trash2,
  status_changed: ArrowRight,
  assigned: User,
  linked: Link2,
  unlinked: Link2,
};

export function RecordTimeline({
  recordId,
  tableId,
  groupId,
  userPubkey,
  className,
  onStartDM,
  onViewProfile,
  onNavigateToRecord,
  onPreviewAttachment,
}: RecordTimelineProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecordActivity[]>([]);
  const [comments, setComments] = useState<RecordComment[]>([]);
  // Attachments state is loaded for future use (attachment previews in timeline)
  const [_attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOlderActivities, setShowOlderActivities] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [loadedActivities, loadedComments, loadedAttachments] =
          await Promise.all([
            databaseManager.getRecordActivities(recordId, tableId),
            databaseManager.getRecordComments(recordId, tableId),
            databaseManager.getRecordAttachments(recordId, tableId),
          ]);
        setActivities(loadedActivities);
        setComments(loadedComments);
        setAttachments(loadedAttachments);
      } catch (error) {
        console.error('Failed to load timeline data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [recordId, tableId]);

  // Build timeline items
  const timelineItems: TimelineItem[] = [];

  // Add comments (already flat, threaded in display)
  const flatComments = flattenComments(comments);
  for (const comment of flatComments) {
    if (filter === 'all' || filter === 'comments') {
      timelineItems.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: comment.createdAt,
        data: comment,
      });
    }
  }

  // Add activities (filter out comment activities as we show comments directly)
  for (const activity of activities) {
    if (activity.type === 'comment') continue; // Skip, we show comments directly

    if (filter === 'all') {
      timelineItems.push({
        id: `activity-${activity.id}`,
        type: 'activity',
        timestamp: activity.createdAt,
        data: activity,
      });
    } else if (filter === 'changes' && ['field_changed', 'status_changed', 'updated'].includes(activity.type)) {
      timelineItems.push({
        id: `activity-${activity.id}`,
        type: 'activity',
        timestamp: activity.createdAt,
        data: activity,
      });
    } else if (filter === 'attachments' && ['attachment_added', 'attachment_removed'].includes(activity.type)) {
      timelineItems.push({
        id: `activity-${activity.id}`,
        type: 'activity',
        timestamp: activity.createdAt,
        data: activity,
      });
    }
  }

  // Sort by timestamp (newest first)
  timelineItems.sort((a, b) => b.timestamp - a.timestamp);

  // Split into recent and older
  const recentItems = timelineItems.slice(0, 10);
  const olderItems = timelineItems.slice(10);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const comment = await databaseManager.addRecordComment(
        recordId,
        tableId,
        groupId,
        newComment.trim(),
        userPubkey,
        replyingTo || undefined
      );
      if (comment) {
        setComments((prev) => [...prev, comment]);
        setNewComment('');
        setReplyingTo(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          {t('common.loading', 'Loading...')}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t('common.timeline', 'Timeline')}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              {filter === 'all' && t('common.all', 'All')}
              {filter === 'comments' && t('common.comments', 'Comments')}
              {filter === 'changes' && t('common.changes', 'Changes')}
              {filter === 'attachments' && t('common.attachments', 'Attachments')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={filter === 'all'}
              onCheckedChange={() => setFilter('all')}
            >
              {t('common.all', 'All')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === 'comments'}
              onCheckedChange={() => setFilter('comments')}
            >
              {t('common.comments', 'Comments')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === 'changes'}
              onCheckedChange={() => setFilter('changes')}
            >
              {t('common.changes', 'Changes')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === 'attachments'}
              onCheckedChange={() => setFilter('attachments')}
            >
              {t('common.attachments', 'Attachments')}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New comment input */}
      <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
        {replyingTo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Reply className="h-4 w-4" />
            <span>{t('common.replyingToComment', 'Replying to comment')}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1"
              onClick={() => setReplyingTo(null)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('common.addComment', 'Add a comment...')}
            className="min-h-[60px] resize-none"
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline items */}
      <div className="flex flex-col gap-2">
        {recentItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('common.noActivityYet', 'No activity yet')}
          </div>
        ) : (
          recentItems.map((item) => (
            <TimelineItemComponent
              key={item.id}
              item={item}
              onReply={
                item.type === 'comment'
                  ? () => setReplyingTo((item.data as RecordComment).id)
                  : undefined
              }
              onStartDM={onStartDM}
              onViewProfile={onViewProfile}
              onNavigateToRecord={onNavigateToRecord}
              onPreviewAttachment={onPreviewAttachment}
            />
          ))
        )}

        {/* Older items */}
        {olderItems.length > 0 && (
          <Collapsible open={showOlderActivities} onOpenChange={setShowOlderActivities}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                {showOlderActivities ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    {t('common.hideOlder', 'Hide older activity')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    {t('common.showOlder', 'Show {{count}} older items', {
                      count: olderItems.length,
                    })}
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 mt-2">
              {olderItems.map((item) => (
                <TimelineItemComponent
                  key={item.id}
                  item={item}
                  onReply={
                    item.type === 'comment'
                      ? () => setReplyingTo((item.data as RecordComment).id)
                      : undefined
                  }
                  onStartDM={onStartDM}
                  onViewProfile={onViewProfile}
                  onNavigateToRecord={onNavigateToRecord}
                  onPreviewAttachment={onPreviewAttachment}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

interface TimelineItemComponentProps {
  item: TimelineItem;
  onReply?: () => void;
  onStartDM?: (pubkey: string) => void;
  onViewProfile?: (pubkey: string) => void;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
  onPreviewAttachment?: (attachment: RecordAttachment) => void;
}

function TimelineItemComponent({
  item,
  onReply,
  onStartDM,
  onViewProfile,
  onNavigateToRecord,
  onPreviewAttachment: _onPreviewAttachment,
}: TimelineItemComponentProps) {
  const { t } = useTranslation();
  // Reserved for future use (clickable attachment preview in timeline)
  void _onPreviewAttachment;

  if (item.type === 'comment') {
    const comment = item.data as RecordComment;
    return (
      <div className="flex gap-3 p-3 bg-card rounded-lg border">
        <PubkeyFieldRenderer
          pubkey={comment.authorPubkey}
          displayFormat="avatar_only"
          showActions={false}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PubkeyFieldRenderer
              pubkey={comment.authorPubkey}
              displayFormat="name"
              onStartDM={onStartDM}
              onViewProfile={onViewProfile}
              className="font-medium text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
            {comment.updatedAt > comment.createdAt && (
              <span className="text-xs text-muted-foreground">
                ({t('common.edited', 'edited')})
              </span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          {onReply && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 -ml-2 h-7 text-muted-foreground"
              onClick={onReply}
            >
              <Reply className="h-3 w-3 mr-1" />
              {t('common.reply', 'Reply')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Activity item
  const activity = item.data as RecordActivity;
  const IconComponent = ACTIVITY_ICONS[activity.type] || Clock;

  return (
    <div className="flex gap-3 p-2 text-sm">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
        <IconComponent className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PubkeyFieldRenderer
            pubkey={activity.actorPubkey}
            displayFormat="name"
            showActions={false}
            className="font-medium"
          />
          <span className="text-muted-foreground">
            {getActivityDescription(activity, t, onNavigateToRecord)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(activity.createdAt)}
          </span>
        </div>
        {renderActivityDetails(activity, t)}
      </div>
    </div>
  );
}

function getActivityDescription(
  activity: RecordActivity,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string,
  onNavigateToRecord?: (recordId: string, tableId: string) => void
): React.ReactNode {
  switch (activity.type) {
    case 'created':
      return t('activity.createdRecord', 'created this record');
    case 'updated':
      return t('activity.updatedRecord', 'updated this record');
    case 'field_changed': {
      const data = activity.data as FieldChangeActivityData;
      return t('activity.changedField', 'changed {{field}}', {
        field: data.fieldLabel || data.fieldName,
      });
    }
    case 'status_changed': {
      const data = activity.data as StatusChangeActivityData;
      return (
        <>
          {t('activity.changedStatus', 'changed status from')}{' '}
          <Badge variant="outline" className="mx-1">
            {data.oldStatus}
          </Badge>
          {t('activity.to', 'to')}{' '}
          <Badge variant="outline" className="mx-1">
            {data.newStatus}
          </Badge>
        </>
      );
    }
    case 'assigned': {
      const data = activity.data as AssignmentActivityData;
      return (
        <>
          {t('activity.assigned', 'assigned')}{' '}
          <PubkeyFieldRenderer
            pubkey={data.assigneePubkey}
            displayFormat="name"
            showActions={false}
            className="inline"
          />
        </>
      );
    }
    case 'linked': {
      const data = activity.data as LinkActivityData;
      return (
        <>
          {t('activity.linkedTo', 'linked to')}{' '}
          {onNavigateToRecord ? (
            <button
              onClick={() =>
                onNavigateToRecord(data.linkedRecordId, data.linkedTableId)
              }
              className="text-primary hover:underline"
            >
              {data.linkedRecordDisplayValue || data.linkedTableName || 'record'}
            </button>
          ) : (
            <span>{data.linkedRecordDisplayValue || data.linkedTableName || 'record'}</span>
          )}
        </>
      );
    }
    case 'unlinked': {
      const data = activity.data as LinkActivityData;
      return t('activity.unlinkedFrom', 'unlinked from {{record}}', {
        record: data.linkedRecordDisplayValue || data.linkedTableName || 'record',
      });
    }
    case 'attachment_added': {
      const data = activity.data as AttachmentActivityData;
      return t('activity.addedAttachment', 'added attachment "{{file}}"', {
        file: data.fileName,
      });
    }
    case 'attachment_removed': {
      const data = activity.data as AttachmentActivityData;
      return t('activity.removedAttachment', 'removed attachment "{{file}}"', {
        file: data.fileName,
      });
    }
    default:
      return activity.type;
  }
}

function renderActivityDetails(
  activity: RecordActivity,
  _t: (key: string, fallback: string) => string
): React.ReactNode {
  // _t reserved for future localization of activity details
  void _t;
  if (activity.type === 'field_changed') {
    const data = activity.data as FieldChangeActivityData;
    return (
      <div className="mt-1 p-2 bg-muted rounded text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground line-through">
            {formatValue(data.oldValue)}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{formatValue(data.newValue)}</span>
        </div>
      </div>
    );
  }

  if (activity.type === 'attachment_added') {
    const data = activity.data as AttachmentActivityData;
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        {data.fileSize && formatFileSize(data.fileSize)}
        {data.fileType && ` • ${data.fileType}`}
      </div>
    );
  }

  return null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function flattenComments(comments: RecordComment[]): RecordComment[] {
  const flat: RecordComment[] = [];
  const addWithReplies = (comment: RecordComment) => {
    flat.push(comment);
    if (comment.replies) {
      for (const reply of comment.replies) {
        addWithReplies(reply);
      }
    }
  };
  for (const comment of comments) {
    addWithReplies(comment);
  }
  return flat;
}

export default RecordTimeline;
