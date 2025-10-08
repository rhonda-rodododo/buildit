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
import { MessageCircle, Trash2, ChevronDown, ChevronUp, BellOff, Bell } from 'lucide-react';
import { CommentInput } from './CommentInput';
import { UserHandle } from '@/components/user/UserHandle';

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const isAuthor = currentIdentity?.publicKey === comment.authorId;
  const canReply = depth < maxDepth;

  // Get replies to this comment
  const replies = getPostComments(postId).filter(
    (c) => c.parentCommentId === comment.id
  );

  // Count total replies in thread (including nested)
  const countReplies = (commentId: string): number => {
    const directReplies = getPostComments(postId).filter(
      (c) => c.parentCommentId === commentId
    );
    return directReplies.reduce(
      (sum, reply) => sum + 1 + countReplies(reply.id),
      0
    );
  };

  const totalReplies = countReplies(comment.id);

  // Visual indicator colors by depth
  const depthColors = [
    'border-blue-500/30',
    'border-green-500/30',
    'border-purple-500/30',
    'border-orange-500/30',
    'border-pink-500/30',
  ];
  const borderColor = depthColors[depth % depthColors.length];

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
        {/* Collapse/Expand button */}
        {replies.length > 0 && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-shrink-0 w-8 h-8 hover:bg-muted rounded flex items-center justify-center"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Avatar */}
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`} />
          <AvatarFallback>{comment.authorId.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <UserHandle
              pubkey={comment.authorId}
              format="display-name"
              showBadge={true}
              className="text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
            {totalReplies > 0 && (
              <span className="text-xs text-muted-foreground">
                · {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>

          {/* Content */}
          {!isCollapsed && (
            <>
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <>
                      <BellOff className="w-3 h-3 mr-1" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Bell className="w-3 h-3 mr-1" />
                      Mute
                    </>
                  )}
                </Button>
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
            </>
          )}

          {isCollapsed && (
            <p className="text-sm mt-1 text-muted-foreground italic">
              Thread collapsed ({totalReplies} {totalReplies === 1 ? 'reply' : 'replies'})
            </p>
          )}

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
          {!isCollapsed && replies.length > 0 && (
            <div className={`mt-3 space-y-3 border-l-2 ${borderColor} pl-3`}>
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
