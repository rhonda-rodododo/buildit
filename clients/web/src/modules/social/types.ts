/**
 * Advanced Social Features Module - Types
 * Polls, Stories, Moderation, Lists, Trending, Suggested Follows
 */

import type { MediaAttachment } from '@/types/media';

// ============================================================================
// POLLS
// ============================================================================

/**
 * Poll choice type
 */
export type PollChoiceType = 'single' | 'multiple';

/**
 * Poll status
 */
export type PollStatus = 'active' | 'ended' | 'cancelled';

/**
 * Poll option
 */
export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

/**
 * Poll vote
 */
export interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  voterId: string; // Public key of voter
  createdAt: number;
  // For anonymous voting
  isAnonymous?: boolean;
}

/**
 * Poll interface
 */
export interface Poll {
  id: string;
  authorId: string; // Creator's public key
  question: string;
  options: PollOption[];
  choiceType: PollChoiceType;

  // Duration and status
  status: PollStatus;
  endsAt: number; // Unix timestamp when poll ends
  createdAt: number;

  // Vote tracking
  totalVotes: number;
  voterPubkeys: string[]; // Track who has voted (for preventing duplicates)

  // Privacy settings
  isAnonymous: boolean; // Whether votes are anonymous
  showResultsBeforeEnd: boolean; // Show results before poll ends

  // Nostr integration
  nostrEventId?: string;

  // Analytics
  analytics?: PollAnalytics;
}

/**
 * Poll analytics
 */
export interface PollAnalytics {
  totalViews: number;
  uniqueViewers: number;
  participationRate: number; // voters / viewers
  voteTrendByHour: { hour: number; votes: number }[];
}

/**
 * Create poll input
 */
export interface CreatePollInput {
  question: string;
  options: string[]; // Option texts
  choiceType?: PollChoiceType;
  durationMinutes?: number; // Default 24 hours = 1440 minutes
  isAnonymous?: boolean;
  showResultsBeforeEnd?: boolean;
}

// ============================================================================
// STORIES
// ============================================================================

/**
 * Story content type
 */
export type StoryContentType = 'text' | 'image' | 'video';

/**
 * Story background style for text stories
 */
export interface StoryTextStyle {
  backgroundColor: string;
  gradientStart?: string;
  gradientEnd?: string;
  textColor: string;
  fontSize: 'small' | 'medium' | 'large';
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

/**
 * Story interface
 */
export interface Story {
  id: string;
  authorId: string;
  contentType: StoryContentType;

  // Content based on type
  text?: string;
  media?: MediaAttachment;

  // Text styling
  textStyle?: StoryTextStyle;

  // Metadata
  createdAt: number;
  expiresAt: number; // 24 hours from creation

  // Analytics
  viewCount: number;
  viewerPubkeys: string[];
  replyCount: number;

  // Privacy
  privacy: StoryPrivacy;

  // Nostr integration
  nostrEventId?: string;
}

/**
 * Story privacy settings
 */
export interface StoryPrivacy {
  visibility: 'public' | 'friends' | 'close-friends' | 'custom';
  allowedPubkeys?: string[]; // For custom visibility
  hideFromPubkeys?: string[]; // Hidden from specific people
  allowReplies: boolean;
}

/**
 * Story reply
 */
export interface StoryReply {
  id: string;
  storyId: string;
  authorId: string;
  content: string;
  createdAt: number;

  // Emoji reaction or text
  isEmoji: boolean;
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
 * Create story input
 */
export interface CreateStoryInput {
  contentType: StoryContentType;
  text?: string;
  media?: MediaAttachment;
  textStyle?: StoryTextStyle;
  privacy?: Partial<StoryPrivacy>;
}

/**
 * Story group (all stories from a user)
 */
export interface StoryGroup {
  authorId: string;
  stories: Story[];
  hasUnviewed: boolean;
  latestStoryAt: number;
}

// ============================================================================
// MODERATION
// ============================================================================

/**
 * Mute record
 */
export interface MuteRecord {
  id: string;
  userPubkey: string; // Who is muting
  mutedPubkey: string; // Who is muted
  reason?: string;
  createdAt: number;
  expiresAt?: number; // For temporary mutes
  muteScope: 'all' | 'posts' | 'comments' | 'dms';
}

/**
 * Block record
 */
export interface BlockRecord {
  id: string;
  userPubkey: string; // Who is blocking
  blockedPubkey: string; // Who is blocked
  reason?: string;
  createdAt: number;
}

/**
 * Report reason categories
 */
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate-speech'
  | 'violence'
  | 'misinformation'
  | 'illegal-content'
  | 'impersonation'
  | 'self-harm'
  | 'other';

/**
 * Report status
 */
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

/**
 * Content report
 */
export interface ContentReport {
  id: string;
  reporterPubkey: string;
  reportedContentType: 'post' | 'comment' | 'story' | 'user' | 'message';
  reportedContentId: string;
  reportedPubkey: string; // Author of reported content
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string; // Admin who reviewed
  actionTaken?: string;
}

/**
 * Auto-moderation rule
 */
export interface AutoModerationRule {
  id: string;
  groupId?: string; // If group-specific, otherwise global
  createdBy: string;
  name: string;
  isEnabled: boolean;

  // Rule type
  ruleType: 'keyword' | 'regex' | 'spam-detection' | 'link-filter';

  // Pattern (for keyword/regex)
  patterns?: string[];

  // Action to take
  action: 'flag' | 'hide' | 'delete' | 'warn';

  // Notification
  notifyModerators: boolean;

  createdAt: number;
  updatedAt: number;

  // Stats
  triggerCount: number;
}

/**
 * Moderation log entry
 */
export interface ModerationLogEntry {
  id: string;
  moderatorPubkey: string;
  action: 'mute' | 'unmute' | 'block' | 'unblock' | 'warn' | 'delete-content' | 'ban' | 'unban' | 'rule-trigger';
  targetPubkey?: string;
  targetContentId?: string;
  reason?: string;
  ruleId?: string; // If triggered by auto-mod rule
  createdAt: number;
  groupId?: string; // If group-specific action
}

// ============================================================================
// USER LISTS
// ============================================================================

/**
 * User list type
 */
export type UserListType = 'custom' | 'close-friends' | 'muted' | 'blocked';

/**
 * User list
 */
export interface UserList {
  id: string;
  ownerPubkey: string;
  name: string;
  description?: string;
  type: UserListType;
  members: string[]; // Public keys
  isPrivate: boolean; // Whether list is visible to others
  createdAt: number;
  updatedAt: number;
}

/**
 * Create user list input
 */
export interface CreateUserListInput {
  name: string;
  description?: string;
  type?: UserListType;
  members?: string[];
  isPrivate?: boolean;
}

// ============================================================================
// TRENDING & DISCOVERY
// ============================================================================

/**
 * Trending topic
 */
export interface TrendingTopic {
  hashtag: string;
  postCount: number;
  uniqueAuthors: number;
  trend: 'rising' | 'stable' | 'declining';
  trendPercentage: number; // % change from last period
  firstSeen: number;
  lastSeen: number;
  samplePostIds: string[];
}

/**
 * Suggested follow with reason
 */
export interface SuggestedFollow {
  pubkey: string;
  displayName?: string;
  username?: string;
  reason: SuggestFollowReason;
  mutualFriendsCount?: number;
  mutualFriendPubkeys?: string[];
  commonInterests?: string[];
  score: number; // Recommendation strength 0-100
}

/**
 * Reason for suggesting a follow
 */
export type SuggestFollowReason =
  | 'mutual-friends'
  | 'similar-interests'
  | 'same-groups'
  | 'popular-in-network'
  | 'recently-active'
  | 'follows-you';

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Notification type
 */
export type NotificationType =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'repost'
  | 'follow'
  | 'poll-ended'
  | 'story-reply'
  | 'story-view'
  | 'group-invite';

/**
 * Notification
 */
export interface Notification {
  id: string;
  userPubkey: string; // Who receives the notification
  type: NotificationType;
  actorPubkey: string; // Who triggered the notification
  targetId?: string; // Post ID, story ID, etc.
  content?: string; // Preview content
  isRead: boolean;
  createdAt: number;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  mentions: boolean;
  replies: boolean;
  reactions: boolean;
  reposts: boolean;
  follows: boolean;
  pollResults: boolean;
  storyReplies: boolean;
  storyViews: boolean;
  groupInvites: boolean;
}

// ============================================================================
// BOOKMARKS (Enhanced)
// ============================================================================

/**
 * Bookmark collection
 */
export interface BookmarkCollection {
  id: string;
  ownerPubkey: string;
  name: string;
  description?: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Create bookmark collection input
 */
export interface CreateBookmarkCollectionInput {
  name: string;
  description?: string;
}
