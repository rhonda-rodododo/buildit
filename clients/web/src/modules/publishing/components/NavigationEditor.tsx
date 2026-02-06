/**
 * NavigationEditor Component
 * Drag-and-drop navigation menu editor for publications
 */

import { FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Menu,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Edit,
  ExternalLink,
  FileText,
  Tag,
  Eye,
  Save,
  ChevronRight,
} from 'lucide-react';
import type { NavigationItem } from '../types';
import { toast } from 'sonner';

/** Extended navigation item supporting nested children */
interface NavigationItemWithChildren extends NavigationItem {
  children?: NavigationItemWithChildren[];
  parentId?: string;
}

interface NavigationEditorProps {
  items: NavigationItem[];
  onSave: (items: NavigationItem[]) => void;
  className?: string;
}

export const NavigationEditor: FC<NavigationEditorProps> = ({
  items: initialItems,
  onSave,
  className,
}) => {
  const { t } = useTranslation();

  // Convert flat items to tree structure
  const buildTree = (flatItems: NavigationItem[]): NavigationItemWithChildren[] => {
    return flatItems
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ ...item, children: [] }));
  };

  // Flatten tree back to flat items for saving
  const flattenTree = (treeItems: NavigationItemWithChildren[]): NavigationItem[] => {
    const flat: NavigationItem[] = [];
    let order = 0;

    const recurse = (items: NavigationItemWithChildren[]) => {
      for (const item of items) {
        flat.push({
          id: item.id,
          label: item.label,
          url: item.url,
          type: item.type,
          order: order++,
        });
        if (item.children && item.children.length > 0) {
          recurse(item.children);
        }
      }
    };

    recurse(treeItems);
    return flat;
  };

  const [navItems, setNavItems] = useState<NavigationItemWithChildren[]>(buildTree(initialItems));
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<NavigationItemWithChildren | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // New item form state
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<NavigationItem['type']>('link');
  const [newParentId, setNewParentId] = useState<string | null>(null);

  // Reset form
  const resetForm = useCallback(() => {
    setNewLabel('');
    setNewUrl('');
    setNewType('link');
    setNewParentId(null);
    setEditingItem(null);
  }, []);

  // Add a new navigation item
  const handleAddItem = useCallback(() => {
    if (!newLabel.trim()) {
      toast.error(t('navigationEditor.enterLabel'));
      return;
    }

    if (newType !== 'category' && !newUrl.trim()) {
      toast.error(t('navigationEditor.enterUrl'));
      return;
    }

    const newItem: NavigationItemWithChildren = {
      id: uuid(),
      label: newLabel.trim(),
      url: newType === 'category' ? `/category/${newLabel.trim().toLowerCase().replace(/\s+/g, '-')}` : newUrl.trim(),
      type: newType,
      order: navItems.length,
      children: [],
    };

    if (newParentId) {
      // Add as child of parent
      setNavItems((prev) =>
        prev.map((item) => {
          if (item.id === newParentId) {
            return {
              ...item,
              children: [...(item.children || []), newItem],
            };
          }
          return item;
        })
      );
    } else {
      setNavItems((prev) => [...prev, newItem]);
    }

    setHasChanges(true);
    setShowAddDialog(false);
    resetForm();
    toast.success(t('navigationEditor.itemAdded'));
  }, [newLabel, newUrl, newType, newParentId, navItems.length, resetForm, t]);

  // Update an existing item
  const handleUpdateItem = useCallback(() => {
    if (!editingItem) return;
    if (!newLabel.trim()) {
      toast.error(t('navigationEditor.enterLabel'));
      return;
    }

    const updateInList = (items: NavigationItemWithChildren[]): NavigationItemWithChildren[] => {
      return items.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            label: newLabel.trim(),
            url: newType === 'category'
              ? `/category/${newLabel.trim().toLowerCase().replace(/\s+/g, '-')}`
              : newUrl.trim(),
            type: newType,
          };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: updateInList(item.children) };
        }
        return item;
      });
    };

    setNavItems(updateInList);
    setHasChanges(true);
    setShowAddDialog(false);
    resetForm();
    toast.success(t('navigationEditor.itemUpdated'));
  }, [editingItem, newLabel, newUrl, newType, resetForm, t]);

  // Remove a navigation item
  const handleRemoveItem = useCallback((itemId: string) => {
    const removeFromList = (items: NavigationItemWithChildren[]): NavigationItemWithChildren[] => {
      return items
        .filter((item) => item.id !== itemId)
        .map((item) => ({
          ...item,
          children: item.children ? removeFromList(item.children) : [],
        }));
    };

    setNavItems(removeFromList);
    setHasChanges(true);
    toast.success(t('navigationEditor.itemRemoved'));
  }, [t]);

  // Move item up in the list
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setNavItems((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Move item down in the list
  const handleMoveDown = useCallback((index: number) => {
    setNavItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Open edit dialog
  const handleEditItem = useCallback((item: NavigationItemWithChildren) => {
    setEditingItem(item);
    setNewLabel(item.label);
    setNewUrl(item.url);
    setNewType(item.type);
    setShowAddDialog(true);
  }, []);

  // Save all changes
  const handleSave = useCallback(() => {
    const flatItems = flattenTree(navItems);
    onSave(flatItems);
    setHasChanges(false);
    toast.success(t('navigationEditor.saved'));
  }, [navItems, onSave, t]);

  // Get icon for item type
  const getTypeIcon = (type: NavigationItem['type']) => {
    switch (type) {
      case 'page':
        return <FileText className="h-4 w-4" />;
      case 'category':
        return <Tag className="h-4 w-4" />;
      case 'link':
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  // Get type label
  const getTypeLabel = (type: NavigationItem['type']) => {
    switch (type) {
      case 'page':
        return t('navigationEditor.types.page');
      case 'category':
        return t('navigationEditor.types.category');
      case 'link':
      default:
        return t('navigationEditor.types.link');
    }
  };

  // Render a navigation item row
  const renderNavItem = (item: NavigationItemWithChildren, index: number, depth: number = 0) => (
    <div key={item.id}>
      <div
        className={`flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
          depth > 0 ? 'ml-8' : ''
        }`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getTypeIcon(item.type)}
            <span className="font-medium truncate">{item.label}</span>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {getTypeLabel(item.type)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.url}</p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {depth === 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                title={t('navigationEditor.moveUp')}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveDown(index)}
                disabled={index >= navItems.length - 1}
                title={t('navigationEditor.moveDown')}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditItem(item)}
            title={t('navigationEditor.edit')}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveItem(item.id)}
            className="text-destructive hover:text-destructive"
            title={t('navigationEditor.remove')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Render children */}
      {item.children && item.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {item.children.map((child, childIndex) =>
            renderNavItem(child, childIndex, depth + 1)
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Menu className="h-5 w-5" />
            <CardTitle>{t('navigationEditor.title')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? t('navigationEditor.hidePreview') : t('navigationEditor.showPreview')}
            </Button>
            {hasChanges && (
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {t('navigationEditor.save')}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {t('navigationEditor.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live Navigation Preview */}
        {showPreview && navItems.length > 0 && (
          <>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                {t('navigationEditor.previewLabel')}
              </p>
              <nav className="flex items-center gap-1 flex-wrap">
                {navItems.map((item) => (
                  <div key={item.id} className="relative group">
                    <button className="px-3 py-1.5 text-sm rounded-md hover:bg-background transition-colors flex items-center gap-1">
                      {item.label}
                      {item.children && item.children.length > 0 && (
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      )}
                    </button>
                    {/* Dropdown preview for items with children */}
                    {item.children && item.children.length > 0 && (
                      <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-background border rounded-md shadow-md py-1 min-w-[150px] z-10">
                        {item.children.map((child) => (
                          <div
                            key={child.id}
                            className="px-3 py-1.5 text-sm hover:bg-muted cursor-default"
                          >
                            {child.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
            <Separator />
          </>
        )}

        {/* Navigation Items List */}
        {navItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Menu className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              {t('navigationEditor.noItems')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {navItems.map((item, index) => renderNavItem(item, index))}
          </div>
        )}

        {/* Add Item Button */}
        <Button
          variant="outline"
          onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('navigationEditor.addItem')}
        </Button>

        {/* Add/Edit Item Dialog */}
        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            if (!open) {
              resetForm();
            }
            setShowAddDialog(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem
                  ? t('navigationEditor.editItem')
                  : t('navigationEditor.addMenuItem')}
              </DialogTitle>
              <DialogDescription>
                {t('navigationEditor.addMenuItemDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Item Type */}
              <div>
                <Label>{t('navigationEditor.itemType')}</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as NavigationItem['type'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        {t('navigationEditor.types.link')}
                      </div>
                    </SelectItem>
                    <SelectItem value="page">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t('navigationEditor.types.page')}
                      </div>
                    </SelectItem>
                    <SelectItem value="category">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        {t('navigationEditor.types.category')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Label */}
              <div>
                <Label htmlFor="navLabel">{t('navigationEditor.label')}</Label>
                <Input
                  id="navLabel"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={t('navigationEditor.labelPlaceholder')}
                />
              </div>

              {/* URL (not shown for category type) */}
              {newType !== 'category' && (
                <div>
                  <Label htmlFor="navUrl">{t('navigationEditor.url')}</Label>
                  <Input
                    id="navUrl"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder={
                      newType === 'page'
                        ? '/about'
                        : 'https://example.com'
                    }
                  />
                </div>
              )}

              {/* Parent (for nested items) */}
              {!editingItem && navItems.length > 0 && (
                <div>
                  <Label>{t('navigationEditor.parentItem')}</Label>
                  <Select
                    value={newParentId || 'none'}
                    onValueChange={(v) => setNewParentId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('navigationEditor.topLevel')}</SelectItem>
                      {navItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('navigationEditor.parentHint')}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
              >
                {t('navigationEditor.cancel')}
              </Button>
              <Button onClick={editingItem ? handleUpdateItem : handleAddItem}>
                {editingItem
                  ? t('navigationEditor.updateItem')
                  : t('navigationEditor.addItem')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
