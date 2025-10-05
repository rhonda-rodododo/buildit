/**
 * WikiUpdateFeedCard Component
 * Displays a wiki page update in the activity feed
 */

import { FC } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { WikiUpdateFeedItem } from './types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileText, FolderOpen, Tag, Edit3 } from 'lucide-react';

interface WikiUpdateFeedCardProps {
  item: WikiUpdateFeedItem;
  className?: string;
}

export const WikiUpdateFeedCard: FC<WikiUpdateFeedCardProps> = ({ item, className }) => {
  const { data: page } = item;

  const getActionLabel = () => {
    return page.version === 1 ? 'created a wiki page' : 'updated a wiki page';
  };

  const getPreview = (content: string, maxLength: number = 200) => {
    // Strip markdown formatting for preview
    const stripped = content
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
      .replace(/`(.+?)`/g, '$1') // Remove code
      .trim();

    return stripped.length > maxLength
      ? stripped.substring(0, maxLength) + '...'
      : stripped;
  };

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${page.updatedBy}`}
            />
            <AvatarFallback>{page.updatedBy.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Editor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{page.updatedBy}</span>
              <span className="text-xs text-muted-foreground">{getActionLabel()}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(page.updated, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Version badge */}
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
          <Edit3 className="w-3 h-3" />
          v{page.version}
        </span>
      </div>

      {/* Wiki content */}
      <div className="space-y-3">
        {/* Type indicator */}
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Wiki Page
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold">{page.title}</h3>

        {/* Content preview */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {getPreview(page.content)}
        </p>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {/* Category */}
          {page.category && (
            <div className="flex items-center gap-1">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{page.category}</span>
            </div>
          )}

          {/* Tags */}
          {page.tags && page.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {page.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded"
                >
                  {tag}
                </span>
              ))}
              {page.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{page.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button className="flex-1">Read Page</Button>
          <Button variant="outline" className="flex-1">
            Edit
          </Button>
          {page.version > 1 && (
            <Button variant="ghost" className="flex-1">
              History
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
