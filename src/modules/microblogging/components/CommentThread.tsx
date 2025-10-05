/**
 * CommentThread Component
 * Displays a threaded list of comments with nested replies
 */

import { FC, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { usePostsStore } from '../postsStore';
import type { Comment } from '../types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Trash2 } from 'lucide-react';
import { CommentInput } from './CommentInput';

interface CommentThreadProps {
  postId: string;
  comments: Comment[];
  maxDepth?: number;
}

interface CommentItemProps {
  comment: Comment;
  postId: string;
  depth: number;
  maxDepth: number;
}

const CommentItem: FC<CommentItemProps> = ({ comment, postId, depth, maxDepth }) => {
  const { currentIdentity } = useAuthStore();
  const { deleteComment, getPostComments } = usePostsStore();
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = currentIdentity?.id === comment.authorId;
  const canReply = depth < maxDepth;

  // Get replies to this comment
  const replies = getPostComments(postId).filter(
    (c) => c.parentCommentId === comment.id
  );

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;

    setIsDeleting(true);
    try {
      await deleteComment(comment.id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReplyAdded = () => {
    setIsReplying(false);
  };

  return (
    <div className="group">
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`} />
          <AvatarFallback>{comment.authorId.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{comment.authorId}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
          </div>

          {/* Content */}
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => setIsReplying(!isReplying)}
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Reply
              </Button>
            )}
            {isAuthor && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}
          </div>

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-3">
              <CommentInput
                postId={postId}
                parentCommentId={comment.id}
                placeholder={`Reply to ${comment.authorId}...`}
                onCommentAdded={handleReplyAdded}
                onCancel={() => setIsReplying(false)}
                autoFocus
              />
            </div>
          )}

          {/* Nested Replies */}
          {replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-muted pl-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CommentThread: FC<CommentThreadProps> = ({
  postId,
  comments,
  maxDepth = 5,
}) => {
  // Get top-level comments (no parent)
  const topLevelComments = comments.filter((c) => !c.parentCommentId);

  if (topLevelComments.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No comments yet. Be the first to comment!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topLevelComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          depth={0}
          maxDepth={maxDepth}
        />
      ))}
    </div>
  );
};
