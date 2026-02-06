/**
 * BookmarksView Component
 * Display and manage bookmarked posts with collections/folders
 */

import { FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePostsStore } from '../postsStore';
import { PostCard } from './PostCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bookmark,
  Search,
  Folder,
  FolderPlus,
  Trash2,
  Edit2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface BookmarkCollection {
  id: string;
  name: string;
  createdAt: number;
}

// Persist collections to localStorage
const COLLECTIONS_STORAGE_KEY = 'buildit-bookmark-collections';

function loadCollections(): BookmarkCollection[] {
  try {
    const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCollections(collections: BookmarkCollection[]): void {
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
}

interface BookmarksViewProps {
  className?: string;
}

export const BookmarksView: FC<BookmarksViewProps> = ({ className }) => {
  const { t } = useTranslation();
  const { getBookmarkedPosts, bookmarks } = usePostsStore();
  const bookmarkedPosts = getBookmarkedPosts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collections, setCollections] = useState<BookmarkCollection[]>(loadCollections);
  const [editingCollection, setEditingCollection] = useState<BookmarkCollection | null>(null);
  const [editName, setEditName] = useState('');

  // Get collection names from both stored collections and bookmark collectionIds
  const allCollectionIds = Array.from(
    new Set([
      ...collections.map((c) => c.id),
      ...bookmarks.filter((b) => b.collectionId).map((b) => b.collectionId!),
    ])
  );

  const getCollectionName = useCallback(
    (collectionId: string): string => {
      const collection = collections.find((c) => c.id === collectionId);
      return collection?.name || collectionId;
    },
    [collections]
  );

  // Filter posts by search and collection
  const filteredPosts = bookmarkedPosts.filter((post) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !post.content.toLowerCase().includes(query) &&
        !post.hashtags.some((tag) => tag.toLowerCase().includes(query))
      ) {
        return false;
      }
    }

    // Collection filter
    if (selectedCollection !== 'all') {
      const bookmark = bookmarks.find((b) => b.postId === post.id);
      if (selectedCollection === 'uncategorized') {
        if (bookmark?.collectionId) return false;
      } else if (!bookmark || bookmark.collectionId !== selectedCollection) {
        return false;
      }
    }

    return true;
  });

  const handleCreateCollection = () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) return;

    // Check for duplicates
    if (collections.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(t('bookmarksView.collectionExists', 'A collection with this name already exists'));
      return;
    }

    const newCollection: BookmarkCollection = {
      id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      createdAt: Date.now(),
    };

    const updated = [...collections, newCollection];
    setCollections(updated);
    saveCollections(updated);

    setNewCollectionName('');
    setShowNewCollectionDialog(false);
    toast.success(t('bookmarksView.collectionCreated', 'Collection created'));
  };

  const handleRenameCollection = () => {
    if (!editingCollection || !editName.trim()) return;

    const updated = collections.map((c) =>
      c.id === editingCollection.id ? { ...c, name: editName.trim() } : c
    );
    setCollections(updated);
    saveCollections(updated);
    setEditingCollection(null);
    setEditName('');
    toast.success(t('bookmarksView.collectionRenamed', 'Collection renamed'));
  };

  const handleDeleteCollection = (collectionId: string) => {
    const updated = collections.filter((c) => c.id !== collectionId);
    setCollections(updated);
    saveCollections(updated);

    if (selectedCollection === collectionId) {
      setSelectedCollection('all');
    }
    toast.success(t('bookmarksView.collectionDeleted', 'Collection deleted'));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          <h2 className="text-xl font-semibold">{t('bookmarksView.title')}</h2>
          <span className="text-sm text-muted-foreground">
            ({bookmarkedPosts.length})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNewCollectionDialog(true)}
        >
          <Folder className="w-4 h-4 mr-2" />
          {t('bookmarksView.newCollection')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('bookmarksView.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Collection filter */}
          <Select value={selectedCollection} onValueChange={setSelectedCollection}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('bookmarksView.filter.allCollections')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bookmarksView.filter.allCollections')}</SelectItem>
              <SelectItem value="uncategorized">{t('bookmarksView.filter.uncategorized')}</SelectItem>
              {allCollectionIds.map((collectionId) => (
                <SelectItem key={collectionId} value={collectionId}>
                  <div className="flex items-center gap-2">
                    <Folder className="w-3 h-3" />
                    {getCollectionName(collectionId)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bookmarked posts */}
      {filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Bookmark className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">{t('bookmarksView.empty.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || selectedCollection !== 'all'
              ? t('bookmarksView.empty.adjustFilters')
              : t('bookmarksView.empty.description')}
          </p>
        </Card>
      )}

      {/* Collections Management */}
      {collections.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Folder className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('bookmarksView.collections', 'Collections')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => (
              <div key={collection.id} className="flex items-center gap-1">
                <Button
                  variant={selectedCollection === collection.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setSelectedCollection(
                      selectedCollection === collection.id ? 'all' : collection.id
                    )
                  }
                >
                  <Folder className="w-3 h-3 mr-1" />
                  {collection.name}
                  <span className="ml-1 text-xs opacity-70">
                    ({bookmarks.filter((b) => b.collectionId === collection.id).length})
                  </span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingCollection(collection);
                        setEditName(collection.name);
                      }}
                    >
                      <Edit2 className="w-3 h-3 mr-2" />
                      {t('bookmarksView.renameCollection', 'Rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteCollection(collection.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      {t('bookmarksView.deleteCollection', 'Delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* New Collection Dialog */}
      <Dialog open={showNewCollectionDialog} onOpenChange={setShowNewCollectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bookmarksView.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('bookmarksView.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('bookmarksView.dialog.nameLabel')}</Label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder={t('bookmarksView.dialog.namePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCollection();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCollectionDialog(false)}
            >
              {t('bookmarksView.dialog.cancel')}
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              {t('bookmarksView.dialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Collection Dialog */}
      <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bookmarksView.renameTitle', 'Rename Collection')}</DialogTitle>
            <DialogDescription>
              {t('bookmarksView.renameDesc', 'Enter a new name for this collection.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('bookmarksView.dialog.nameLabel')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameCollection();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCollection(null)}>
              {t('bookmarksView.dialog.cancel')}
            </Button>
            <Button onClick={handleRenameCollection} disabled={!editName.trim()}>
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
