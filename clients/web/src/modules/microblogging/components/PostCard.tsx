/**
 * PostCard Component
 * Display a single post with reactions, comments, and engagement actions
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { LazyMarkdown } from '@/components/markdown/LazyMarkdown';
import { usePostsStore } from '../postsStore';
import type { Post, ReactionType } from '../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmbedCard, isEmbeddableUrl } from '@/lib/embed';
import { LinkPreviewCard } from '@/lib/linkPreview';
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
  Quote,
  Pin,
  PinOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CommentThread } from './CommentThread';
import { CommentInput } from './CommentInput';
import { UserHandle } from '@/components/user/UserHandle';

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
  const { t } = useTranslation();
  const {
    addReaction,
    removeReaction,
    getMyReaction,
    getPostReactions,
    hasReposted,
    repost,
    unrepost,
    quotePost,
    hasBookmarked,
    bookmarkPost,
    unbookmarkPost,
    getPostComments,
    pinPost,
    unpinPost,
    isPinned: checkIsPinned,
  } = usePostsStore();

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(showThread);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [quoteContent, setQuoteContent] = useState('');

  const myReaction = getMyReaction(post.id);
  const postReactions = getPostReactions(post.id);
  const isReposted = hasReposted(post.id);
  const isBookmarked = hasBookmarked(post.id);
  const isPinned = post.isPinned || checkIsPinned(post.id);

  // Find the first embeddable URL from post links (like Twitter/Bluesky behavior)
  const firstEmbeddableUrl = useMemo(() => {
    if (post.links && post.links.length > 0) {
      return post.links.find((url) => isEmbeddableUrl(url)) || null;
    }
    return null;
  }, [post.links]);

  const handlePinToggle = async () => {
    if (isPinned) {
      await unpinPost(post.id);
    } else {
      await pinPost(post.id);
    }
  };

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

  const handleQuotePost = async () => {
    if (quoteContent.trim()) {
      await quotePost(post.id, quoteContent);
      setQuoteContent('');
      setShowQuoteDialog(false);
    }
  };

  // Group reactions by type for "who reacted" display
  const reactionsByType = postReactions.reduce((acc, reaction) => {
    if (!acc[reaction.type]) {
      acc[reaction.type] = [];
    }
    acc[reaction.type].push(reaction.userId);
    return acc;
  }, {} as Record<ReactionType, string[]>);

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
      {/* Pinned Badge */}
      {isPinned && (
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Pin className="w-3 h-3" />
          <span>{t('postCard.pinnedPost')}</span>
        </div>
      )}

      {/* Content Warning */}
      {post.contentWarning && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-medium">{t('postCard.contentWarning')}</span> {post.contentWarning}
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
              <UserHandle
                pubkey={post.authorId}
                format="display-name"
                showBadge={true}
                className="text-sm"
              />
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
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t('postCard.moreOptions')}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handlePinToggle}>
              {isPinned ? (
                <>
                  <PinOff className="w-4 h-4 mr-2" />
                  {t('postCard.unpinFromProfile')}
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 mr-2" />
                  {t('postCard.pinToProfile')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem>{t('postCard.copyLink')}</DropdownMenuItem>
            <DropdownMenuItem>{t('postCard.editPost')}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">{t('postCard.deletePost')}</DropdownMenuItem>
            <DropdownMenuItem>{t('postCard.reportPost')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="mb-3">
        <LazyMarkdown
          content={post.content}
          className="text-sm prose prose-sm dark:prose-invert max-w-none"
        />

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

      {/* Link Previews (Signal-style encrypted) or Embedded Content */}
      {/* For private posts: Use encrypted link previews (no third-party requests) */}
      {/* For public posts: Can use EmbedCard iframes as fallback */}
      {post.linkPreviews && post.linkPreviews.length > 0 ? (
        <div className="mb-3 space-y-2">
          {post.linkPreviews.map((preview) => (
            <LinkPreviewCard
              key={preview.url}
              preview={preview}
              compact={post.linkPreviews!.length > 1}
            />
          ))}
        </div>
      ) : (
        /* Fallback to EmbedCard for public posts or old posts without linkPreviews */
        firstEmbeddableUrl && post.visibility.privacy === 'public' && (
          <div className="mb-3">
            <EmbedCard url={firstEmbeddableUrl} className="max-w-full" />
          </div>
        )
      )}

      {/* Engagement stats */}
      <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
        {post.reactionCount > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="hover:underline cursor-pointer">
                {t('postCard.reactionCount', { count: post.reactionCount })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">{t('postCard.reactions')}</h4>
                {Object.entries(reactionsByType).map(([type, userIds]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{type}</span>
                      <span className="text-sm text-muted-foreground">{userIds.length}</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {userIds.map((userId) => (
                        <div key={userId} className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} />
                            <AvatarFallback>{userId.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <UserHandle pubkey={userId} format="display-name" className="text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {post.commentCount > 0 && (
          <span>{t('postCard.commentCount', { count: post.commentCount })}</span>
        )}
        {post.repostCount > 0 && (
          <span>{t('postCard.repostCount', { count: post.repostCount })}</span>
        )}
      </div>

      {/* Action buttons - icons only on mobile, icons + text on sm and up */}
      <div className="flex items-center gap-1 pt-2 border-t">
        {/* Reaction button with picker */}
        <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
          <PopoverTrigger asChild>
            <Button
              variant={myReaction ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 justify-center min-h-[44px] px-2 sm:px-3"
              aria-label={myReaction ? `Current reaction: ${myReaction}. Click to change` : 'Add reaction'}
            >
              {myReaction ? myReaction : <Heart className="w-4 h-4 sm:mr-2 shrink-0" />}
              <span className="hidden sm:inline">{t('postCard.react')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="start">
            <div className="flex items-center gap-1" role="group" aria-label="Reaction options">
              {REACTION_EMOJIS.map(({ type, emoji }) => (
                <Button
                  key={type}
                  variant={myReaction === type ? 'default' : 'ghost'}
                  size="sm"
                  className="h-11 w-11 p-0 text-lg"
                  onClick={() => handleReaction(type)}
                  aria-label={`React with ${emoji}`}
                  aria-pressed={myReaction === type}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Comment button */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-center min-h-[44px] px-2 sm:px-3"
          onClick={() => {
            setShowComments(!showComments);
            onCommentClick?.();
          }}
          aria-label={t('postCard.comment')}
        >
          <MessageCircle className="w-4 h-4 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">{t('postCard.comment')}</span>
        </Button>

        {/* Repost button with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isReposted ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 justify-center min-h-[44px] px-2 sm:px-3"
              aria-label="Repost options"
            >
              <Repeat2 className="w-4 h-4 sm:mr-2 shrink-0" />
              <span className="hidden sm:inline">{t('postCard.repost')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleRepost}>
              <Repeat2 className="w-4 h-4 mr-2" />
              {isReposted ? t('postCard.undoRepost') : t('postCard.repost')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowQuoteDialog(true)}>
              <Quote className="w-4 h-4 mr-2" />
              {t('postCard.quotePost')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bookmark button */}
        <Button
          variant={isBookmarked ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 justify-center min-h-[44px] px-2 sm:px-3"
          onClick={handleBookmark}
          aria-label={isBookmarked ? t('postCard.removeBookmark') : t('postCard.bookmark')}
        >
          <Bookmark className={`w-4 h-4 shrink-0 ${isBookmarked ? 'fill-current' : ''}`} />
        </Button>

        {/* Share button */}
        <Button variant="ghost" size="sm" className="flex-1 justify-center min-h-[44px] px-2 sm:px-3" aria-label={t('postCard.share')}>
          <Share2 className="w-4 h-4 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">{t('postCard.share')}</span>
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

      {/* Quote Post Dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('postCard.quoteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('postCard.quoteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Quote content input */}
            <div>
              <label htmlFor="quote-content" className="text-sm font-medium mb-2 block">
                {t('postCard.quoteDialog.yourComment')}
              </label>
              <textarea
                id="quote-content"
                value={quoteContent}
                onChange={(e) => setQuoteContent(e.target.value)}
                placeholder={t('postCard.quoteDialog.placeholder')}
                className="w-full min-h-[100px] p-3 border rounded-md resize-y"
              />
            </div>

            {/* Original post preview */}
            <div className="p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} />
                  <AvatarFallback>{post.authorId.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <UserHandle pubkey={post.authorId} format="display-name" className="text-sm" />
              </div>
              <div className="text-sm text-muted-foreground line-clamp-3">
                {post.content}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowQuoteDialog(false)}>
                {t('postCard.quoteDialog.cancel')}
              </Button>
              <Button
                onClick={handleQuotePost}
                disabled={!quoteContent.trim()}
              >
                {t('postCard.quoteDialog.submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
