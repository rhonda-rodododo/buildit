/**
 * BookmarksView Component
 * Display and manage bookmarked posts with collections/folders
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePostsStore } from '../postsStore';
import { PostCard } from './PostCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bookmark,
  Search,
  Folder,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  // Get unique collections from bookmarks
  const collections = Array.from(
    new Set(
      bookmarks
        .filter((b) => b.collectionId)
        .map((b) => b.collectionId!)
    )
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
      if (!bookmark || bookmark.collectionId !== selectedCollection) {
        return false;
      }
    }

    return true;
  });

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      // Collection creation deferred to Phase 2
      setNewCollectionName('');
      setShowNewCollectionDialog(false);
    }
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
              {collections.map((collection) => (
                <SelectItem key={collection} value={collection}>
                  {collection}
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

      {/* New Collection Dialog */}
      <Dialog open={showNewCollectionDialog} onOpenChange={setShowNewCollectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bookmarksView.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('bookmarksView.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('bookmarksView.dialog.nameLabel')}
              </label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder={t('bookmarksView.dialog.namePlaceholder')}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCollection();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
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
                {t('bookmarksView.dialog.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
