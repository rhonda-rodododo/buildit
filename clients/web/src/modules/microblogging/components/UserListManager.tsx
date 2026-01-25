/**
 * User List Manager Component
 * Epic 61: Create and manage user lists (like Twitter lists)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  List,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Lock,
  Globe,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import type { UserList } from '../types';
import { cn } from '@/lib/utils';

interface UserListManagerProps {
  className?: string;
}

export function UserListManager({ className }: UserListManagerProps) {
  const { t } = useTranslation();
  const lists = useSocialFeaturesStore((s) => s.getMyLists());
  const createList = useSocialFeaturesStore((s) => s.createList);
  const updateList = useSocialFeaturesStore((s) => s.updateList);
  const deleteList = useSocialFeaturesStore((s) => s.deleteList);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedList, setSelectedList] = useState<UserList | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPrivate(false);
    setSelectedList(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createList({
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
      });
      resetForm();
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Failed to create list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedList || !name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateList(selectedList.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
      });
      resetForm();
      setShowEditDialog(false);
    } catch (error) {
      console.error('Failed to update list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedList || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await deleteList(selectedList.id);
      resetForm();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (list: UserList) => {
    setSelectedList(list);
    setName(list.name);
    setDescription(list.description || '');
    setIsPrivate(list.isPrivate);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (list: UserList) => {
    setSelectedList(list);
    setShowDeleteDialog(true);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <List className="h-5 w-5" />
          {t('lists.title', 'Your Lists')}
        </h2>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('lists.create', 'New List')}
        </Button>
      </div>

      {/* Lists grid */}
      {lists.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <List className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('lists.empty', 'No lists yet')}</p>
          <p className="text-sm mt-1">
            {t('lists.emptyHint', 'Create a list to organize users into groups')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <Card key={list.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {list.isPrivate ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                  {list.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(list)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t('common.edit', 'Edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(list)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete', 'Delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {list.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {list.memberCount} {t('lists.members', 'members')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('lists.createTitle', 'Create a new list')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">{t('lists.name', 'Name')}</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('lists.namePlaceholder', 'My List')}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-description">
                {t('lists.description', 'Description (optional)')}
              </Label>
              <Textarea
                id="list-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('lists.descriptionPlaceholder', 'What is this list about?')}
                maxLength={200}
                className="resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="list-private">{t('lists.private', 'Private')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('lists.privateHint', 'Only you can see this list')}
                </p>
              </div>
              <Switch
                id="list-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isSubmitting}>
              {isSubmitting
                ? t('common.creating', 'Creating...')
                : t('lists.create', 'Create List')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('lists.editTitle', 'Edit list')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">{t('lists.name', 'Name')}</Label>
              <Input
                id="edit-list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-list-description">
                {t('lists.description', 'Description (optional)')}
              </Label>
              <Textarea
                id="edit-list-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                className="resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-list-private">{t('lists.private', 'Private')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('lists.privateHint', 'Only you can see this list')}
                </p>
              </div>
              <Switch
                id="edit-list-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || isSubmitting}>
              {isSubmitting
                ? t('common.saving', 'Saving...')
                : t('common.save', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('lists.deleteTitle', 'Delete list?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'lists.deleteDescription',
                'This will permanently delete "{{name}}" and remove all members. This action cannot be undone.',
                { name: selectedList?.name }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting
                ? t('common.deleting', 'Deleting...')
                : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
