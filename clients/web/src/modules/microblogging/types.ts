/**
 * Microblogging Module - Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (feed filters, form inputs, stories, moderation, user lists, trending) are defined here.
 */

// Re-export all generated Zod schemas and types from microblogging
export {
  PostPrivacySchema,
  type PostPrivacy,
  PostContentTypeSchema,
  type PostContentType,
  ReactionTypeSchema,
  type ReactionType,
  PostVisibilitySchema,
  type PostVisibility,
  MediaAttachmentSchema,
  type MediaAttachment,
  PostLinkPreviewSchema,
  type PostLinkPreview,
  PostLocationSchema,
  type PostLocation,
  PostSchema,
  type Post,
  CommentSchema,
  type Comment,
  ReactionSchema,
  type Reaction,
  RepostSchema,
  type Repost,
  BookmarkSchema,
  type Bookmark,
  MICROBLOGGING_SCHEMA_VERSION,
} from '@/generated/validation/microblogging.zod';

// Re-export all generated Zod schemas and types from polls
export {
  PollTypeSchema,
  type PollType,
  PollStatusSchema,
  type PollStatus,
  PollOptionSchema,
  type PollOption,
  PollSchema,
  type Poll,
  PollVoteSchema,
  type PollVote,
  POLLS_SCHEMA_VERSION,
} from '@/generated/validation/polls.zod';

// ── Nostr Event Kind Constants ───────────────────────────────────

import type { PostContentType, PostPrivacy, PostVisibility, MediaAttachment, PostLinkPreview } from '@/generated/validation/microblogging.zod';
import type { PollType } from '@/generated/validation/polls.zod';

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

// ── UI-Only Types ────────────────────────────────────────────────

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
  linkPreviews?: PostLinkPreview[];

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
 * Create poll input
 */
export interface CreatePollInput {
  question: string;
  options: string[]; // Option texts
  pollType: PollType;
  durationHours: number; // How long the poll runs
  hideResultsUntilEnded?: boolean;
  allowAnonymousVotes?: boolean;
  visibility: PostVisibility;
  contentWarning?: string;
}

// ========================================
// STORIES
// ========================================

/**
 * Story content type
 */
export type StoryContentType = 'image' | 'video' | 'text';

/**
 * Story interface - ephemeral content (24h)
 */
export interface Story {
  id: string;
  authorId: string;

  // Content
  contentType: StoryContentType;
  content: string; // Text content or caption
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;

  // Styling for text stories
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;

  // Privacy
  visibility: PostVisibility;

  // Engagement
  viewCount: number;
  replyCount: number;

  // Expiration
  createdAt: number;
  expiresAt: number; // 24 hours after creation

  // Nostr
  nostrEventId?: string;
}

/**
 * Story view record
 */
export interface StoryView {
  id: string;
  storyId: string;
  viewerId: string;
  viewedAt: number;
}

/**
 * Story reply (DM to author)
 */
export interface StoryReply {
  id: string;
  storyId: string;
  authorId: string; // Person replying
  content: string;
  createdAt: number;
}

/**
 * Create story input
 */
export interface CreateStoryInput {
  contentType: StoryContentType;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  visibility: PostVisibility;
}

// ========================================
// MODERATION
// ========================================

/**
 * Muted user interface
 */
export interface MutedUser {
  id: string;
  userId: string; // Who is muting
  mutedUserId: string; // Who is muted
  reason?: string;
  expiresAt?: number; // Optional expiration (temporary mute)
  createdAt: number;
}

/**
 * Report reason types
 */
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'illegal_content'
  | 'misinformation'
  | 'impersonation'
  | 'copyright'
  | 'other';

/**
 * Report status
 */
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

/**
 * Content report interface
 */
export interface ContentReport {
  id: string;
  reporterId: string;

  // What is being reported
  contentType: 'post' | 'comment' | 'user' | 'message' | 'story';
  contentId: string;
  contentAuthorId: string;

  // Report details
  reason: ReportReason;
  description?: string;
  screenshots?: string[]; // URLs to screenshot evidence

  // Status
  status: ReportStatus;
  reviewedBy?: string; // Moderator who reviewed
  reviewedAt?: number;
  actionTaken?: string; // Description of action taken

  // Timestamps
  createdAt: number;
  updatedAt?: number;
}

/**
 * Auto-moderation rule types
 */
export type AutoModRuleType = 'keyword' | 'regex' | 'spam_detection' | 'link_filter';

/**
 * Auto-moderation action
 */
export type AutoModAction = 'flag' | 'hide' | 'block' | 'notify_admins';

/**
 * Auto-moderation rule interface
 */
export interface AutoModRule {
  id: string;
  groupId?: string; // Optional - group-specific rule
  name: string;
  description?: string;
  ruleType: AutoModRuleType;

  // Rule configuration
  pattern: string; // Keyword or regex pattern
  caseSensitive: boolean;

  // Actions to take
  actions: AutoModAction[];

  // Stats
  triggerCount: number;

  // Status
  isEnabled: boolean;

  // Timestamps
  createdAt: number;
  updatedAt?: number;
  createdBy: string;
}

/**
 * Moderation log entry
 */
export interface ModerationLog {
  id: string;
  moderatorId: string;
  action: 'mute' | 'unmute' | 'block' | 'unblock' | 'delete_content' | 'hide_content' | 'warn_user' | 'ban_user';

  // Target
  targetUserId?: string;
  targetContentType?: 'post' | 'comment' | 'message' | 'story';
  targetContentId?: string;

  // Details
  reason?: string;
  notes?: string;

  // Related report (if any)
  reportId?: string;

  // Timestamps
  createdAt: number;
}

// ========================================
// USER LISTS
// ========================================

/**
 * User list (like Twitter lists)
 */
export interface UserList {
  id: string;
  ownerId: string;
  name: string;
  description?: string;

  // Members
  memberIds: string[];
  memberCount: number;

  // Privacy
  isPrivate: boolean;

  // Following (other users can follow public lists)
  followerCount: number;

  // Timestamps
  createdAt: number;
  updatedAt?: number;

  // Nostr
  nostrEventId?: string;
}

/**
 * Create list input
 */
export interface CreateUserListInput {
  name: string;
  description?: string;
  isPrivate: boolean;
  initialMemberIds?: string[];
}

// ========================================
// TRENDING
// ========================================

/**
 * Trending topic/hashtag
 */
export interface TrendingTopic {
  tag: string;
  postCount: number;
  recentPostCount: number; // Posts in last 24h
  trend: 'rising' | 'stable' | 'falling';
  rank: number;
  lastUpdated: number;
}

/**
 * Suggested user to follow
 */
export interface SuggestedUser {
  userId: string;
  reason: 'mutual_friends' | 'similar_interests' | 'popular' | 'new_user' | 'same_group';
  mutualFriendCount?: number;
  score: number; // Relevance score
}
