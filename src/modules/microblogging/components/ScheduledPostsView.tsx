/**
 * ScheduledPostsView Component
 * View and manage scheduled posts
 */

import { FC, useEffect, useState } from 'react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { usePostsStore } from '../postsStore';
import type { ScheduledPost } from '../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Loader2,
  CalendarClock,
} from 'lucide-react';

interface ScheduledPostsViewProps {
  className?: string;
}

export const ScheduledPostsView: FC<ScheduledPostsViewProps> = ({ className }) => {
  const {
    loadScheduledPosts,
    getScheduledPosts,
    updateScheduledPost,
    cancelScheduledPost,
    publishScheduledPost,
  } = usePostsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<ScheduledPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editScheduledFor, setEditScheduledFor] = useState('');
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadScheduledPosts();
      setIsLoading(false);
    };
    load();
  }, [loadScheduledPosts]);

  const pendingPosts = getScheduledPosts();

  const handleEdit = (post: ScheduledPost) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditScheduledFor(new Date(post.scheduledFor).toISOString().slice(0, 16));
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;

    await updateScheduledPost(editingPost.id, {
      content: editContent,
      scheduledFor: new Date(editScheduledFor).getTime(),
    });

    setEditingPost(null);
    setEditContent('');
    setEditScheduledFor('');
  };

  const handleCancel = async (post: ScheduledPost) => {
    await cancelScheduledPost(post.id);
    setDeleteConfirmPost(null);
  };

  const handlePublishNow = async (post: ScheduledPost) => {
    setIsPublishing(post.id);
    try {
      await publishScheduledPost(post.id);
    } catch (error) {
      console.error('Failed to publish scheduled post:', error);
    } finally {
      setIsPublishing(null);
    }
  };

  const getStatusBadge = (post: ScheduledPost) => {
    if (post.status === 'published') {
      return <Badge variant="default">Published</Badge>;
    }
    if (post.status === 'cancelled') {
      return <Badge variant="secondary">Cancelled</Badge>;
    }
    if (post.status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (isPast(new Date(post.scheduledFor))) {
      return <Badge variant="outline" className="text-orange-500 border-orange-500">Due</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  if (isLoading) {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading scheduled posts...</span>
        </div>
      </Card>
    );
  }

  if (pendingPosts.length === 0) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <CalendarClock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No scheduled posts</h3>
        <p className="text-sm text-muted-foreground">
          Schedule posts to be published at a specific time by using the schedule option in the post composer.
        </p>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {pendingPosts.map((post) => (
        <Card key={post.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Status and scheduled time */}
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(post)}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(post.scheduledFor), 'MMM d, yyyy')}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(post.scheduledFor), 'h:mm a')}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({formatDistanceToNow(new Date(post.scheduledFor), { addSuffix: true })})
                </span>
              </div>

              {/* Content preview */}
              <p className="text-sm line-clamp-3">{post.content}</p>

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {post.hashtags.map((tag) => (
                    <span key={tag} className="text-xs text-primary">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {post.status === 'pending' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handlePublishNow(post)}
                    disabled={isPublishing === post.id}
                  >
                    {isPublishing === post.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Publish now
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(post)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteConfirmPost(post)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Card>
      ))}

      {/* Edit Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Post</DialogTitle>
            <DialogDescription>
              Update the content or reschedule this post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                placeholder="What's on your mind?"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Scheduled for</label>
              <Input
                type="datetime-local"
                value={editScheduledFor}
                onChange={(e) => setEditScheduledFor(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPost(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editContent.trim()}>
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmPost} onOpenChange={(open) => !open && setDeleteConfirmPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled post. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep post</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmPost && handleCancel(deleteConfirmPost)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
