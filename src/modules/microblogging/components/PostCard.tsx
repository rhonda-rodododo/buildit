/**
 * PostCard Component
 * Display a single post with reactions, comments, and engagement actions
 */

import { FC, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { usePostsStore } from '../postsStore';
import type { Post, ReactionType } from '../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  Lock,
  Globe,
  Users,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommentThread } from './CommentThread';
import { CommentInput } from './CommentInput';

interface PostCardProps {
  post: Post;
  showThread?: boolean;
  onCommentClick?: () => void;
  className?: string;
}

const REACTION_EMOJIS: { type: ReactionType; emoji: string }[] = [
  { type: '❤️', emoji: '❤️' },
  { type: '✊', emoji: '✊' },
  { type: '🔥', emoji: '🔥' },
  { type: '👀', emoji: '👀' },
  { type: '😂', emoji: '😂' },
  { type: '👍', emoji: '👍' },
];

export const PostCard: FC<PostCardProps> = ({
  post,
  showThread = false,
  onCommentClick,
  className,
}) => {
  const {
    addReaction,
    removeReaction,
    getMyReaction,
    hasReposted,
    repost,
    unrepost,
    hasBookmarked,
    bookmarkPost,
    unbookmarkPost,
    getPostComments,
  } = usePostsStore();

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(showThread);

  const myReaction = getMyReaction(post.id);
  const isReposted = hasReposted(post.id);
  const isBookmarked = hasBookmarked(post.id);

  const handleReaction = async (type: ReactionType) => {
    if (myReaction === type) {
      await removeReaction(post.id);
    } else {
      if (myReaction) {
        await removeReaction(post.id);
      }
      await addReaction(post.id, type);
    }
    setShowReactionPicker(false);
  };

  const handleRepost = async () => {
    if (isReposted) {
      await unrepost(post.id);
    } else {
      await repost(post.id);
    }
  };

  const handleBookmark = async () => {
    if (isBookmarked) {
      await unbookmarkPost(post.id);
    } else {
      await bookmarkPost(post.id);
    }
  };

  const getPrivacyIcon = () => {
    switch (post.visibility.privacy) {
      case 'public':
        return <Globe className="w-3 h-3" />;
      case 'followers':
        return <Users className="w-3 h-3" />;
      case 'group':
        return <Lock className="w-3 h-3" />;
      case 'encrypted':
        return <Shield className="w-3 h-3" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  return (
    <Card className={`p-4 ${className}`}>
      {/* Content Warning */}
      {post.contentWarning && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-medium">Content Warning:</span> {post.contentWarning}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} />
            <AvatarFallback>{post.authorId.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Author info and timestamp */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">
                {post.authorId}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {getPrivacyIcon()}
                {formatTimestamp(post.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuItem>Edit post</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete post</DropdownMenuItem>
            <DropdownMenuItem>Report post</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {post.hashtags.map((tag) => (
              <Button
                key={tag}
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary text-sm"
              >
                #{tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Media (if any) */}
      {post.media && post.media.length > 0 && (
        <div className="mb-3 rounded-lg overflow-hidden border">
          <img
            src={post.media[0].url}
            alt={post.media[0].alt || 'Post image'}
            className="w-full max-h-96 object-cover"
          />
        </div>
      )}

      {/* Engagement stats */}
      <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
        {post.reactionCount > 0 && (
          <span>{post.reactionCount} reaction{post.reactionCount !== 1 ? 's' : ''}</span>
        )}
        {post.commentCount > 0 && (
          <span>{post.commentCount} comment{post.commentCount !== 1 ? 's' : ''}</span>
        )}
        {post.repostCount > 0 && (
          <span>{post.repostCount} repost{post.repostCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 pt-2 border-t">
        {/* Reaction button with picker */}
        <div className="relative flex-1">
          <Button
            variant={myReaction ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-center"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
          >
            {myReaction ? myReaction : <Heart className="w-4 h-4 mr-2" />}
            <span>React</span>
          </Button>

          {showReactionPicker && (
            <div className="absolute left-0 bottom-full mb-2 p-2 bg-popover border rounded-lg shadow-lg z-10">
              <div className="flex items-center gap-1">
                {REACTION_EMOJIS.map(({ type, emoji }) => (
                  <Button
                    key={type}
                    variant={myReaction === type ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0 text-lg"
                    onClick={() => handleReaction(type)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comment button */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-center"
          onClick={() => {
            setShowComments(!showComments);
            onCommentClick?.();
          }}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Comment
        </Button>

        {/* Repost button */}
        <Button
          variant={isReposted ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 justify-center"
          onClick={handleRepost}
        >
          <Repeat2 className="w-4 h-4 mr-2" />
          Repost
        </Button>

        {/* Bookmark button */}
        <Button
          variant={isBookmarked ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 justify-center"
          onClick={handleBookmark}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </Button>

        {/* Share button */}
        <Button variant="ghost" size="sm" className="flex-1 justify-center">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Comment input */}
          <CommentInput postId={post.id} />

          {/* Comments thread */}
          {post.commentCount > 0 && (
            <div className="pt-2">
              <CommentThread postId={post.id} comments={getPostComments(post.id)} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
