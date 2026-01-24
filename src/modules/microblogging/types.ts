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

// ========================================
// POLLS
// ========================================

/**
 * Poll option interface
 */
export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

/**
 * Poll type - single or multiple choice
 */
export type PollType = 'single' | 'multiple';

/**
 * Poll interface
 */
export interface Poll {
  id: string;
  postId: string; // Associated post ID
  authorId: string;
  question: string;
  options: PollOption[];
  pollType: PollType;

  // Duration
  endsAt: number; // Unix timestamp when poll closes
  isEnded: boolean;

  // Stats
  totalVotes: number;
  voterCount: number;

  // Settings
  hideResultsUntilEnded?: boolean;
  allowAnonymousVotes?: boolean;

  // Timestamps
  createdAt: number;
  updatedAt?: number;

  // Nostr
  nostrEventId?: string;
}

/**
 * Poll vote interface
 */
export interface PollVote {
  id: string;
  pollId: string;
  optionIds: string[]; // Array for multiple choice
  voterId: string;
  createdAt: number;

  // Nostr
  nostrEventId?: string;
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
