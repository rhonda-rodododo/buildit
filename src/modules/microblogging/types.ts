/**
 * Microblogging Module - Types
 * Core types for posts, reactions, and social features
 */

import type { MediaAttachment } from '@/types/media';
import type { LinkPreview } from '@/lib/linkPreview';

/**
 * Privacy levels for posts
 */
export type PostPrivacy = 'public' | 'followers' | 'group' | 'encrypted';

/**
 * Post visibility settings
 */
export interface PostVisibility {
  privacy: PostPrivacy;
  groupIds?: string[]; // For group-only posts
  allowedUsers?: string[]; // For encrypted posts
}

/**
 * Post content types
 */
export type PostContentType = 'text' | 'image' | 'video' | 'poll' | 'event-share' | 'document-share';

/**
 * Core post interface
 */
export interface Post {
  id: string;
  authorId: string; // npub or identity ID
  content: string; // Rich text content
  contentType: PostContentType;

  // Media
  media?: MediaAttachment[];

  // Privacy & Visibility
  visibility: PostVisibility;

  // Social engagement
  reactionCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;

  // Metadata
  mentions: string[]; // npubs mentioned
  hashtags: string[];
  links: string[];

  // Encrypted link previews (Signal-style)
  // Sender fetches Open Graph metadata and thumbnails
  // Preview data is encrypted with the post using NIP-17
  linkPreviews?: LinkPreview[];

  // Timestamps
  createdAt: number; // Unix timestamp
  updatedAt?: number;

  // Nostr
  nostrEventId?: string;
  relayUrls?: string[];

  // Flags
  isRepost?: boolean;
  repostedPostId?: string;
  isQuote?: boolean;
  quotedPostId?: string;
  quotedContent?: string;

  // Moderation
  contentWarning?: string;
  isSensitive?: boolean;
  isReported?: boolean;

  // Pinning
  isPinned?: boolean;
  pinnedAt?: number;
}

/**
 * Reaction types
 */
export type ReactionType = '❤️' | '✊' | '🔥' | '👀' | '😂' | '👍';

/**
 * Reaction interface
 */
export interface Reaction {
  id: string;
  postId: string;
  userId: string; // npub
  type: ReactionType;
  createdAt: number;

  // Nostr
  nostrEventId?: string;
}

/**
 * Comment interface (threads in Epic 21.3)
 */
export interface Comment {
  id: string;
  postId: string;
  authorId: string; // npub
  content: string;

  // Threading
  parentCommentId?: string;
  depth: number; // Max 3 levels

  // Social
  reactionCount: number;

  // Timestamps
  createdAt: number;
  updatedAt?: number;

  // Nostr
  nostrEventId?: string;

  // Moderation
  isReported?: boolean;
}

/**
 * Repost interface
 */
export interface Repost {
  id: string;
  postId: string;
  userId: string; // npub who reposted

  // Quote repost
  isQuote: boolean;
  quoteContent?: string;

  // Timestamps
  createdAt: number;

  // Nostr
  nostrEventId?: string;
}

/**
 * Bookmark interface
 */
export interface Bookmark {
  id: string;
  postId: string;
  userId: string; // npub
  createdAt: number;

  // Optional organization
  collectionId?: string;
  tags?: string[];
  notes?: string;
}

/**
 * Post feed filters
 */
export interface PostFeedFilter {
  // Feed type
  type: 'all' | 'following' | 'group' | 'mentions' | 'bookmarks' | 'scheduled' | 'pinned';

  // Group filtering
  groupIds?: string[];

  // Content filtering
  contentTypes?: PostContentType[];
  hasMedia?: boolean;

  // Privacy filtering
  privacyLevels?: PostPrivacy[];

  // Search
  searchQuery?: string;
  hashtags?: string[];

  // Author filter
  authorId?: string;

  // Date range filter
  dateFrom?: number; // Unix timestamp
  dateTo?: number; // Unix timestamp

  // Pagination
  limit?: number;
  offset?: number;
  beforeTimestamp?: number;
  afterTimestamp?: number;
}

/**
 * Post creation input
 */
export interface CreatePostInput {
  content: string;
  contentType?: PostContentType;
  media?: MediaAttachment[];
  visibility: PostVisibility;

  // Optional
  mentions?: string[];
  hashtags?: string[];
  contentWarning?: string;
  isSensitive?: boolean;

  // Encrypted link previews (Signal-style)
  // These are fetched by the sender and encrypted with the post
  linkPreviews?: LinkPreview[];

  // For reposts/quotes
  repostedPostId?: string;
  isQuote?: boolean;
  quotedContent?: string;
}

/**
 * Post update input
 */
export interface UpdatePostInput {
  postId: string;
  content?: string;
  contentWarning?: string;
  isSensitive?: boolean;
}

/**
 * Scheduled post interface
 */
export interface ScheduledPost {
  id: string;
  authorId: string;
  content: string;
  contentType: PostContentType;
  media?: MediaAttachment[];
  visibility: PostVisibility;
  mentions?: string[];
  hashtags?: string[];
  contentWarning?: string;
  isSensitive?: boolean;

  // Schedule info
  scheduledFor: number; // Unix timestamp when to publish
  timezone?: string; // User's timezone
  status: 'pending' | 'published' | 'failed' | 'cancelled';

  // Timestamps
  createdAt: number;
  updatedAt?: number;
  publishedAt?: number;

  // If published, reference to the actual post
  publishedPostId?: string;

  // Error info if failed
  errorMessage?: string;
}

/**
 * Post statistics
 */
export interface PostStats {
  totalPosts: number;
  totalReactions: number;
  totalComments: number;
  totalReposts: number;
  totalBookmarks: number;

  // By time period
  postsToday: number;
  postsThisWeek: number;
  postsThisMonth: number;

  // Engagement rate
  avgReactionsPerPost: number;
  avgCommentsPerPost: number;
  avgRepostsPerPost: number;
}

/**
 * Nostr event kind for posts
 * Using NIP-23 (long-form content) kind: 30023
 * For short posts, can also use kind: 1 (text note)
 */
export const POST_NOSTR_KIND = 1; // Short text note
export const LONG_POST_NOSTR_KIND = 30023; // Long-form content

/**
 * Nostr event kind for reactions
 * Using NIP-25: kind 7 (reaction)
 */
export const REACTION_NOSTR_KIND = 7;

/**
 * Nostr event kind for comments
 * Using NIP-10: kind 1 with 'e' and 'p' tags
 */
export const COMMENT_NOSTR_KIND = 1;

/**
 * Nostr event kind for reposts
 * Using NIP-18: kind 6 (repost) or kind 16 (generic repost)
 */
export const REPOST_NOSTR_KIND = 6;
