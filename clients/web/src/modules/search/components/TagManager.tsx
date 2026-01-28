/**
 * Tag Manager Component
 * UI for creating, editing, and organizing tags
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  FolderTree,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Tag as TagType, TagWithChildren } from '../types';
import { getTagManager } from '../services';

// ============================================================================
// Types
// ============================================================================

interface TagManagerProps {
  /** Group ID to manage tags for */
  groupId: string;
  /** Current user's pubkey */
  userPubkey: string;
  /** Callback when a tag is selected (for tag picker mode) */
  onTagSelect?: (tag: TagType) => void;
  /** Whether this is in picker mode (simplified UI) */
  pickerMode?: boolean;
  /** Currently selected tag IDs (for picker mode) */
  selectedTagIds?: string[];
  /** Additional className */
  className?: string;
}

interface TagFormData {
  name: string;
  color?: string;
  parentTagId?: string;
}

// ============================================================================
// Color Options
// ============================================================================

const TAG_COLORS = [
  { name: 'Default', value: undefined },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

// ============================================================================
// Tag Item Component
// ============================================================================

function TagItem({
  tag,
  level = 0,
  onEdit,
  onDelete,
  onSelect,
  isSelected,
  pickerMode,
}: {
  tag: TagWithChildren;
  level?: number;
  onEdit: (tag: TagType) => void;
  onDelete: (tag: TagType) => void;
  onSelect?: (tag: TagType) => void;
  isSelected?: boolean;
  pickerMode?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = tag.children && tag.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md group',
          'hover:bg-accent/50 transition-colors',
          isSelected && 'bg-accent',
          pickerMode && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => pickerMode && onSelect?.(tag)}
      >
        {/* Expand/collapse for hierarchy */}
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Tag badge */}
        <Badge
          variant="outline"
          className="h-6"
          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
        >
          <Tag className="h-3 w-3 mr-1" />
          {tag.name}
        </Badge>

        {/* Usage count */}
        <span className="text-xs text-muted-foreground ml-auto mr-2">
          {tag.usageCount}
        </span>

        {/* Actions (not in picker mode) */}
        {!pickerMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(tag)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(tag)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {tag.children.map((child) => (
            <TagItem
              key={child.id}
              tag={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelect={onSelect}
              isSelected={isSelected}
              pickerMode={pickerMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tag Form Dialog
// ============================================================================

function TagFormDialog({
  open,
  onOpenChange,
  tag,
  parentTags,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: TagType;
  parentTags: TagType[];
  onSubmit: (data: TagFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const isEditing = !!tag;

  const [formData, setFormData] = useState<TagFormData>({
    name: tag?.name || '',
    color: tag?.color,
    parentTagId: tag?.parentTagId,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: tag?.name || '',
        color: tag?.color,
        parentTagId: tag?.parentTagId,
      });
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t('search:tags.errors.nameRequired', 'Tag name is required'));
      return;
    }
    await onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('search:tags.edit', 'Edit Tag')
              : t('search:tags.create', 'Create Tag')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('search:tags.editDescription', 'Update the tag details')
              : t('search:tags.createDescription', 'Create a new tag to organize your content')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="tag-name">{t('search:tags.name', 'Name')}</Label>
            <Input
              id="tag-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('search:tags.namePlaceholder', 'Enter tag name')}
              autoFocus
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>{t('search:tags.color', 'Color')}</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    formData.color === color.value
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{
                    backgroundColor: color.value || 'var(--muted)',
                  }}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Parent Tag (for hierarchy) */}
          <div className="space-y-2">
            <Label>{t('search:tags.parent', 'Parent Tag (optional)')}</Label>
            <Select
              value={formData.parentTagId || 'none'}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  parentTagId: value === 'none' ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('search:tags.noParent', 'No parent')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('search:tags.noParent', 'No parent (top level)')}
                </SelectItem>
                {parentTags
                  .filter((t) => t.id !== tag?.id && !t.parentTagId)
                  .map((parentTag) => (
                    <SelectItem key={parentTag.id} value={parentTag.id}>
                      {parentTag.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common:cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? t('common:saving', 'Saving...')
                : isEditing
                  ? t('common:save', 'Save')
                  : t('common:create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Tag Manager Component
// ============================================================================

export function TagManager({
  groupId,
  userPubkey,
  onTagSelect,
  pickerMode = false,
  selectedTagIds = [],
  className,
}: TagManagerProps) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagWithChildren[]>([]);
  const [flatTags, setFlatTags] = useState<TagType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<TagType | undefined>();

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      setIsLoading(true);
      const tagManager = getTagManager();
      const [hierarchy, all] = await Promise.all([
        tagManager.getTagHierarchy(groupId),
        tagManager.getGroupTags(groupId),
      ]);
      setTags(hierarchy);
      setFlatTags(all);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error(t('search:tags.errors.loadFailed', 'Failed to load tags'));
    } finally {
      setIsLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Create tag
  const handleCreate = useCallback(async (data: TagFormData) => {
    try {
      setIsSubmitting(true);
      const tagManager = getTagManager();
      await tagManager.createTag({
        groupId,
        name: data.name,
        color: data.color,
        parentTagId: data.parentTagId,
        createdBy: userPubkey,
      });
      toast.success(t('search:tags.created', 'Tag created'));
      setFormDialogOpen(false);
      await loadTags();
    } catch (error: unknown) {
      console.error('Failed to create tag:', error);
      toast.error(error instanceof Error ? error.message : t('search:tags.errors.createFailed', 'Failed to create tag'));
    } finally {
      setIsSubmitting(false);
    }
  }, [groupId, userPubkey, t, loadTags]);

  // Update tag
  const handleUpdate = useCallback(async (data: TagFormData) => {
    if (!editingTag) return;

    try {
      setIsSubmitting(true);
      const tagManager = getTagManager();
      await tagManager.updateTag(editingTag.id, {
        name: data.name,
        color: data.color,
        parentTagId: data.parentTagId === undefined ? null : data.parentTagId,
      });
      toast.success(t('search:tags.updated', 'Tag updated'));
      setFormDialogOpen(false);
      setEditingTag(undefined);
      await loadTags();
    } catch (error: unknown) {
      console.error('Failed to update tag:', error);
      toast.error(error instanceof Error ? error.message : t('search:tags.errors.updateFailed', 'Failed to update tag'));
    } finally {
      setIsSubmitting(false);
    }
  }, [editingTag, t, loadTags]);

  // Delete tag
  const handleDelete = useCallback(async () => {
    if (!deletingTag) return;

    try {
      const tagManager = getTagManager();
      await tagManager.deleteTag(deletingTag.id);
      toast.success(t('search:tags.deleted', 'Tag deleted'));
      setDeleteDialogOpen(false);
      setDeletingTag(undefined);
      await loadTags();
    } catch (error: unknown) {
      console.error('Failed to delete tag:', error);
      toast.error(error instanceof Error ? error.message : t('search:tags.errors.deleteFailed', 'Failed to delete tag'));
    }
  }, [deletingTag, t, loadTags]);

  // Open edit dialog
  const openEdit = useCallback((tag: TagType) => {
    setEditingTag(tag);
    setFormDialogOpen(true);
  }, []);

  // Open delete dialog
  const openDelete = useCallback((tag: TagType) => {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  }, []);

  // Handle form submit
  const handleFormSubmit = useCallback(
    async (data: TagFormData) => {
      if (editingTag) {
        await handleUpdate(data);
      } else {
        await handleCreate(data);
      }
    },
    [editingTag, handleCreate, handleUpdate]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {!pickerMode && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            {t('search:tags.title', 'Tags')}
          </h3>
          <Button
            size="sm"
            onClick={() => {
              setEditingTag(undefined);
              setFormDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('search:tags.add', 'Add Tag')}
          </Button>
        </div>
      )}

      {/* Tag List */}
      <ScrollArea className="h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-muted-foreground">
              {t('common:loading', 'Loading...')}
            </span>
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Tag className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('search:tags.empty', 'No tags yet')}
            </p>
            {!pickerMode && (
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setEditingTag(undefined);
                  setFormDialogOpen(true);
                }}
              >
                {t('search:tags.createFirst', 'Create your first tag')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                onEdit={openEdit}
                onDelete={openDelete}
                onSelect={onTagSelect}
                isSelected={selectedTagIds.includes(tag.id)}
                pickerMode={pickerMode}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <TagFormDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          setFormDialogOpen(open);
          if (!open) setEditingTag(undefined);
        }}
        tag={editingTag}
        parentTags={flatTags}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('search:tags.deleteConfirm.title', 'Delete Tag')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'search:tags.deleteConfirm.description',
                'Are you sure you want to delete "{{name}}"? This will remove the tag from all associated items.',
                { name: deletingTag?.name }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common:cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common:delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TagManager;
