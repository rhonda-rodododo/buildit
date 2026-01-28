/**
 * Record Detail View Component
 * Renders a single database record according to detail view configuration
 * Supports sectioned layouts, related records, timeline, and attachments
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDatabaseStore } from '../databaseStore';
import { databaseManager } from '../databaseManager';
import type {
  DatabaseRecord,
  DatabaseTable,
  DetailViewSection,
  RecordActivity,
  RecordComment,
  RecordAttachment,
} from '../types';
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types';
import { evaluateFieldVisibility } from '@/modules/custom-fields/visibilityUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Loader2,
  MessageSquare,
  Paperclip,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';

interface RecordDetailViewProps {
  record: DatabaseRecord;
  table: DatabaseTable;
  className?: string;
  onEdit?: () => void;
  showHeader?: boolean;
  showRelatedRecords?: boolean;
  showTimeline?: boolean;
  showAttachments?: boolean;
}

export function RecordDetailView({
  record,
  table,
  className,
  onEdit,
  showHeader = true,
  showRelatedRecords = true,
  showTimeline = true,
  showAttachments = true,
}: RecordDetailViewProps) {
  const { t } = useTranslation();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<RecordActivity[]>([]);
  const [comments, setComments] = useState<RecordComment[]>([]);
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const tables = useDatabaseStore((s) => s.tables);
  const relationships = useDatabaseStore((s) => s.relationships);

  // Get detail configuration
  const detailConfig = table.detailConfig;

  // Build field lookup
  const fieldsByName = useMemo(() => {
    const map = new Map<string, CustomField>();
    for (const field of table.fields) {
      map.set(field.name, field);
    }
    return map;
  }, [table.fields]);

  // Get header field values
  const headerValue = useMemo(() => {
    const fieldName = detailConfig?.headerField || table.fields[0]?.name || 'id';
    return String(record.customFields[fieldName] || record.id);
  }, [record, detailConfig, table.fields]);

  const subtitleValue = useMemo(() => {
    if (!detailConfig?.subtitleField) return undefined;
    const value = record.customFields[detailConfig.subtitleField];
    return value ? String(value) : undefined;
  }, [record, detailConfig]);

  const avatarValue = useMemo(() => {
    if (!detailConfig?.avatarField) return undefined;
    const value = record.customFields[detailConfig.avatarField];
    return value ? String(value) : undefined;
  }, [record, detailConfig]);

  // Get sections configuration
  const sections = useMemo((): DetailViewSection[] => {
    if (detailConfig?.sections && detailConfig.sections.length > 0) {
      return detailConfig.sections;
    }

    // Default: single section with all fields
    return [
      {
        id: 'default',
        label: t('database.fields', 'Fields'),
        type: 'fields',
        fields: table.fields.map((f) => f.name),
        columns: 2,
      },
    ];
  }, [detailConfig, table.fields, t]);

  // Load timeline data
  useEffect(() => {
    const loadTimelineData = async () => {
      if (!showTimeline && !showAttachments) return;

      setLoadingActivities(true);
      try {
        const [activitiesData, commentsData, attachmentsData] = await Promise.all([
          showTimeline
            ? databaseManager.getRecordActivities(record.id, table.id)
            : Promise.resolve([]),
          showTimeline
            ? databaseManager.getRecordComments(record.id, table.id)
            : Promise.resolve([]),
          showAttachments
            ? databaseManager.getRecordAttachments(record.id, table.id)
            : Promise.resolve([]),
        ]);

        setActivities(activitiesData);
        setComments(commentsData);
        setAttachments(attachmentsData);
      } catch (error) {
        console.error('Failed to load timeline data:', error);
      } finally {
        setLoadingActivities(false);
      }
    };

    loadTimelineData();
  }, [record.id, table.id, showTimeline, showAttachments]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Initialize collapsed sections
  useEffect(() => {
    const initialCollapsed = new Set<string>();
    for (const section of sections) {
      if (section.defaultCollapsed) {
        initialCollapsed.add(section.id);
      }
    }
    setCollapsedSections(initialCollapsed);
  }, [sections]);

  // Render field value
  const renderFieldValue = (field: CustomField, value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-muted-foreground italic">{t('common.notSet', 'Not set')}</span>;
    }

    const widgetType = field.widget.widget;

    // Handle arrays (multi-select)
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge key={i} variant="secondary">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }

    // Handle booleans
    if (typeof value === 'boolean' || widgetType === 'checkbox') {
      return value ? (
        <Badge variant="default">{t('common.yes', 'Yes')}</Badge>
      ) : (
        <Badge variant="outline">{t('common.no', 'No')}</Badge>
      );
    }

    // Handle dates
    if (widgetType === 'date' || widgetType === 'datetime') {
      const date = new Date(String(value));
      if (!isNaN(date.getTime())) {
        return (
          <span>
            {widgetType === 'datetime'
              ? date.toLocaleString()
              : date.toLocaleDateString()}
          </span>
        );
      }
    }

    // Handle select options - find label
    if ((widgetType === 'select' || widgetType === 'radio') && field.widget.options) {
      const option = field.widget.options.find(
        (opt) => (typeof opt === 'object' ? opt.value : opt) === value
      );
      if (option && typeof option === 'object') {
        return <Badge variant="outline">{option.label}</Badge>;
      }
    }

    // Handle relationships
    if (widgetType === 'relationship') {
      const targetTableId = field.widget.relationshipTargetTable;
      const targetTable = targetTableId ? tables.get(targetTableId) : undefined;

      return (
        <Button variant="link" size="sm" className="h-auto p-0">
          {String(value)}
          {targetTable && <ExternalLink className="h-3 w-3 ml-1" />}
        </Button>
      );
    }

    // Handle pubkey (Nostr profile link)
    if (widgetType === 'pubkey') {
      return (
        <Button variant="link" size="sm" className="h-auto p-0">
          {String(value).slice(0, 8)}...
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      );
    }

    // Default: show as text
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  };

  // Render fields section (with visibility filtering)
  const renderFieldsSection = (section: DetailViewSection) => {
    const sectionFields = (section.fields || [])
      .map((fieldName) => fieldsByName.get(fieldName))
      .filter((f): f is CustomField => f !== undefined)
      // Filter out fields that should be hidden based on visibility rules
      .filter((f) => evaluateFieldVisibility(f, record.customFields as CustomFieldValues));

    // Don't render section if all fields are hidden
    if (sectionFields.length === 0) {
      return null;
    }

    const columns = section.columns || 1;
    const gridClass =
      columns === 3
        ? 'grid-cols-1 md:grid-cols-3'
        : columns === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1';

    return (
      <div className={cn('grid gap-4', gridClass)}>
        {sectionFields.map((field) => (
          <div key={field.id} className="space-y-1">
            <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
            <dd className="text-sm">{renderFieldValue(field, record.customFields[field.name])}</dd>
          </div>
        ))}
      </div>
    );
  };

  // Render related records section
  const renderRelatedSection = (section: DetailViewSection) => {
    if (!section.relatedTableKey) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('database.noRelatedTable', 'No related table configured')}
        </p>
      );
    }

    // Find related table
    const relatedRelationships = Array.from(relationships.values()).filter(
      (r) => r.sourceTableId === table.id || r.targetTableId === table.id
    );

    if (relatedRelationships.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('database.noRelatedRecords', 'No related records')}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {relatedRelationships.map((rel) => {
          const relatedTableId =
            rel.sourceTableId === table.id ? rel.targetTableId : rel.sourceTableId;
          const relatedTable = tables.get(relatedTableId);

          return (
            <div key={rel.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                {relatedTable?.icon && <span>{relatedTable.icon}</span>}
                <span className="text-sm">{relatedTable?.name || relatedTableId}</span>
              </div>
              <Button variant="ghost" size="sm">
                {t('common.view', 'View')}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  // Render timeline section
  const renderTimelineSection = () => {
    if (loadingActivities) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

    if (activities.length === 0 && comments.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('database.noActivity', 'No activity yet')}
        </p>
      );
    }

    // Combine and sort by time
    const timelineItems = [
      ...activities.map((a) => ({ type: 'activity' as const, data: a, time: a.createdAt })),
      ...comments.map((c) => ({ type: 'comment' as const, data: c, time: c.createdAt })),
    ].sort((a, b) => b.time - a.time);

    return (
      <ScrollArea className="max-h-64">
        <div className="space-y-3">
          {timelineItems.map((item) => (
            <div key={`${item.type}-${item.type === 'activity' ? item.data.id : item.data.id}`} className="flex gap-3">
              <div className="flex-shrink-0 mt-1">
                {item.type === 'comment' ? (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {item.type === 'comment' ? (
                  <>
                    <p className="text-sm">{(item.data as RecordComment).content}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(item.time, { addSuffix: true })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t(`database.activity.${(item.data as RecordActivity).type}`, (item.data as RecordActivity).type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(item.time, { addSuffix: true })}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  // Render attachments section
  const renderAttachmentsSection = () => {
    if (loadingActivities) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

    if (attachments.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('database.noAttachments', 'No attachments')}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 border rounded"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{attachment.fileName || attachment.fileId}</span>
              {attachment.fileSize && (
                <span className="text-xs text-muted-foreground">
                  ({t('database:fileSizeKb', { size: Math.round(attachment.fileSize / 1024) })})
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm">
              {t('common.download', 'Download')}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  // Render a single section
  const renderSection = (section: DetailViewSection) => {
    switch (section.type) {
      case 'fields':
        return renderFieldsSection(section);
      case 'related':
        return showRelatedRecords ? renderRelatedSection(section) : null;
      case 'timeline':
        return showTimeline ? renderTimelineSection() : null;
      case 'attachments':
        return showAttachments ? renderAttachmentsSection() : null;
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {avatarValue ? (
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarValue} />
                  <AvatarFallback>
                    {headerValue.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : table.icon ? (
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-muted text-xl">
                  {table.icon}
                </div>
              ) : null}
              <div>
                <CardTitle className="text-xl">{headerValue}</CardTitle>
                {subtitleValue && <CardDescription>{subtitleValue}</CardDescription>}
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                {t('common.edit', 'Edit')}
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-6">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);

          // Skip sections based on visibility settings
          if (section.type === 'related' && !showRelatedRecords) return null;
          if (section.type === 'timeline' && !showTimeline) return null;
          if (section.type === 'attachments' && !showAttachments) return null;

          if (section.collapsible) {
            return (
              <Collapsible
                key={section.id}
                open={!isCollapsed}
                onOpenChange={() => toggleSection(section.id)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span className="font-medium">{section.label}</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">{renderSection(section)}</div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          }

          // Non-collapsible section
          return (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{section.label}</h3>
                <Separator className="flex-1" />
              </div>
              {renderSection(section)}
            </div>
          );
        })}

        {/* Metadata footer */}
        <div className="pt-4 border-t">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <div>
              <dt className="font-medium">{t('common.created', 'Created')}</dt>
              <dd>
                {new Date(record.created).toLocaleDateString()}{' '}
                {new Date(record.created).toLocaleTimeString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">{t('common.lastUpdated', 'Last Updated')}</dt>
              <dd>
                {new Date(record.updated).toLocaleDateString()}{' '}
                {new Date(record.updated).toLocaleTimeString()}
              </dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export default RecordDetailView;
