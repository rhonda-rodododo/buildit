/**
 * Advanced Social Features Module - Store
 * Zustand store for polls, stories, moderation, lists, trending, notifications
 */

import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import { secureRandomString } from '@/lib/utils';
import type {
  // Polls
  Poll,
  PollVote,
  CreatePollInput,
  // Stories
  Story,
  StoryReply,
  StoryView,
  StoryGroup,
  CreateStoryInput,
  // Moderation
  MuteRecord,
  BlockRecord,
  ContentReport,
  ReportReason,
  AutoModerationRule,
  ModerationLogEntry,
  // Lists
  UserList,
  CreateUserListInput,
  // Trending & Discovery
  TrendingTopic,
  SuggestedFollow,
  // Notifications
  Notification,
  NotificationType,
  NotificationPreferences,
  // Bookmarks
  BookmarkCollection,
  CreateBookmarkCollectionInput,
} from './types';

// ============================================================================
// Store State Interface
// ============================================================================

interface SocialState {
  // === Polls ===
  polls: Poll[];
  myVotes: Map<string, string[]>; // pollId -> optionIds

  // Poll Actions
  createPoll: (input: CreatePollInput) => Promise<Poll>;
  votePoll: (pollId: string, optionIds: string[]) => Promise<void>;
  endPoll: (pollId: string) => Promise<void>;
  getPoll: (pollId: string) => Poll | undefined;
  getActivePolls: () => Poll[];
  getMyPolls: () => Poll[];
  hasVoted: (pollId: string) => boolean;
  loadPolls: () => Promise<void>;

  // === Stories ===
  stories: Story[];
  storyGroups: StoryGroup[];
  myStoryViews: Set<string>; // storyIds I've viewed

  // Story Actions
  createStory: (input: CreateStoryInput) => Promise<Story>;
  deleteStory: (storyId: string) => Promise<void>;
  viewStory: (storyId: string) => Promise<void>;
  replyToStory: (storyId: string, content: string, isEmoji?: boolean) => Promise<StoryReply>;
  getStory: (storyId: string) => Story | undefined;
  getStoryGroups: () => StoryGroup[];
  getMyStories: () => Story[];
  getStoryReplies: (storyId: string) => Promise<StoryReply[]>;
  getStoryViewers: (storyId: string) => Promise<StoryView[]>;
  loadStories: () => Promise<void>;
  cleanupExpiredStories: () => Promise<void>;

  // === Moderation ===
  mutedUsers: MuteRecord[];
  blockedUsers: BlockRecord[];
  reports: ContentReport[];
  moderationRules: AutoModerationRule[];
  moderationLogs: ModerationLogEntry[];

  // Moderation Actions
  muteUser: (pubkey: string, reason?: string, durationMinutes?: number, scope?: MuteRecord['muteScope']) => Promise<void>;
  unmuteUser: (pubkey: string) => Promise<void>;
  blockUser: (pubkey: string, reason?: string) => Promise<void>;
  unblockUser: (pubkey: string) => Promise<void>;
  reportContent: (contentType: ContentReport['reportedContentType'], contentId: string, authorPubkey: string, reason: ReportReason, description?: string) => Promise<void>;
  reviewReport: (reportId: string, status: ContentReport['status'], actionTaken?: string) => Promise<void>;
  isMuted: (pubkey: string) => boolean;
  isBlocked: (pubkey: string) => boolean;
  getMutedUsers: () => MuteRecord[];
  getBlockedUsers: () => BlockRecord[];
  getPendingReports: () => ContentReport[];
  loadModerationData: () => Promise<void>;

  // Auto-moderation
  createAutoModRule: (rule: Omit<AutoModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>) => Promise<void>;
  updateAutoModRule: (ruleId: string, updates: Partial<AutoModerationRule>) => Promise<void>;
  deleteAutoModRule: (ruleId: string) => Promise<void>;
  checkContent: (content: string) => { shouldFlag: boolean; matchedRules: AutoModerationRule[] };

  // === User Lists ===
  userLists: UserList[];

  // List Actions
  createUserList: (input: CreateUserListInput) => Promise<UserList>;
  updateUserList: (listId: string, updates: Partial<UserList>) => Promise<void>;
  deleteUserList: (listId: string) => Promise<void>;
  addToList: (listId: string, pubkey: string) => Promise<void>;
  removeFromList: (listId: string, pubkey: string) => Promise<void>;
  getUserLists: () => UserList[];
  getListMembers: (listId: string) => string[];
  isInList: (listId: string, pubkey: string) => boolean;
  loadUserLists: () => Promise<void>;

  // === Trending & Discovery ===
  trendingTopics: TrendingTopic[];
  suggestedFollows: SuggestedFollow[];

  // Trending Actions
  refreshTrendingTopics: () => Promise<void>;
  refreshSuggestedFollows: () => Promise<void>;
  dismissSuggestion: (pubkey: string) => void;

  // === Notifications ===
  notifications: Notification[];
  unreadCount: number;
  notificationPreferences: NotificationPreferences;

  // Notification Actions
  createNotification: (type: NotificationType, actorPubkey: string, targetId?: string, content?: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  getUnreadNotifications: () => Notification[];
  loadNotifications: () => Promise<void>;
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;

  // === Bookmark Collections ===
  bookmarkCollections: BookmarkCollection[];

  // Bookmark Collection Actions
  createBookmarkCollection: (input: CreateBookmarkCollectionInput) => Promise<BookmarkCollection>;
  deleteBookmarkCollection: (collectionId: string) => Promise<void>;
  getBookmarkCollections: () => BookmarkCollection[];
  loadBookmarkCollections: () => Promise<void>;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSocialStore = create<SocialState>()((set, get) => ({
  // === Initial State ===
  polls: [],
  myVotes: new Map(),
  stories: [],
  storyGroups: [],
  myStoryViews: new Set(),
  mutedUsers: [],
  blockedUsers: [],
  reports: [],
  moderationRules: [],
  moderationLogs: [],
  userLists: [],
  trendingTopics: [],
  suggestedFollows: [],
  notifications: [],
  unreadCount: 0,
  notificationPreferences: {
    mentions: true,
    replies: true,
    reactions: true,
    reposts: true,
    follows: true,
    pollResults: true,
    storyReplies: true,
    storyViews: false,
    groupInvites: true,
  },
  bookmarkCollections: [],

  // ============================================================================
  // POLLS
  // ============================================================================

  createPoll: async (input: CreatePollInput): Promise<Poll> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const durationMs = (input.durationMinutes || 1440) * 60 * 1000; // Default 24 hours

    const poll: Poll = {
      id: `poll-${Date.now()}-${secureRandomString(9)}`,
      authorId: currentIdentity.publicKey,
      question: input.question,
      options: input.options.map((text, index) => ({
        id: `opt-${index}-${secureRandomString(6)}`,
        text,
        voteCount: 0,
      })),
      choiceType: input.choiceType || 'single',
      status: 'active',
      endsAt: Date.now() + durationMs,
      createdAt: Date.now(),
      totalVotes: 0,
      voterPubkeys: [],
      isAnonymous: input.isAnonymous ?? true,
      showResultsBeforeEnd: input.showResultsBeforeEnd ?? true,
    };

    try {
      await db.table('polls').add(poll);
    } catch (error) {
      console.error('Failed to save poll:', error);
    }

    set((state) => ({
      polls: [poll, ...state.polls],
    }));

    return poll;
  },

  votePoll: async (pollId: string, optionIds: string[]): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const poll = get().polls.find((p) => p.id === pollId);
    if (!poll) throw new Error('Poll not found');
    if (poll.status !== 'active') throw new Error('Poll is no longer active');
    if (poll.voterPubkeys.includes(currentIdentity.publicKey)) {
      throw new Error('Already voted');
    }

    // Validate choice type
    if (poll.choiceType === 'single' && optionIds.length > 1) {
      throw new Error('This poll allows only one choice');
    }

    // Create vote records
    const votes: PollVote[] = optionIds.map((optionId) => ({
      id: `vote-${Date.now()}-${secureRandomString(9)}`,
      pollId,
      optionId,
      voterId: currentIdentity.publicKey,
      createdAt: Date.now(),
      isAnonymous: poll.isAnonymous,
    }));

    try {
      await db.table('pollVotes').bulkAdd(votes);

      // Update poll vote counts
      const updatedOptions = poll.options.map((opt) => ({
        ...opt,
        voteCount: optionIds.includes(opt.id) ? opt.voteCount + 1 : opt.voteCount,
      }));

      await db.table('polls').update(pollId, {
        options: updatedOptions,
        totalVotes: poll.totalVotes + 1,
        voterPubkeys: [...poll.voterPubkeys, currentIdentity.publicKey],
      });
    } catch (error) {
      console.error('Failed to save vote:', error);
    }

    set((state) => {
      const myVotes = new Map(state.myVotes);
      myVotes.set(pollId, optionIds);

      return {
        myVotes,
        polls: state.polls.map((p) =>
          p.id === pollId
            ? {
                ...p,
                options: p.options.map((opt) => ({
                  ...opt,
                  voteCount: optionIds.includes(opt.id) ? opt.voteCount + 1 : opt.voteCount,
                })),
                totalVotes: p.totalVotes + 1,
                voterPubkeys: [...p.voterPubkeys, currentIdentity.publicKey],
              }
            : p
        ),
      };
    });
  },

  endPoll: async (pollId: string): Promise<void> => {
    try {
      await db.table('polls').update(pollId, { status: 'ended' });
    } catch (error) {
      console.error('Failed to end poll:', error);
    }

    set((state) => ({
      polls: state.polls.map((p) =>
        p.id === pollId ? { ...p, status: 'ended' } : p
      ),
    }));
  },

  getPoll: (pollId: string): Poll | undefined => {
    return get().polls.find((p) => p.id === pollId);
  },

  getActivePolls: (): Poll[] => {
    const now = Date.now();
    return get().polls.filter((p) => p.status === 'active' && p.endsAt > now);
  },

  getMyPolls: (): Poll[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];
    return get().polls.filter((p) => p.authorId === currentIdentity.publicKey);
  },

  hasVoted: (pollId: string): boolean => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return false;
    const poll = get().polls.find((p) => p.id === pollId);
    return poll?.voterPubkeys.includes(currentIdentity.publicKey) || false;
  },

  loadPolls: async (): Promise<void> => {
    try {
      const polls = await db.table('polls').orderBy('createdAt').reverse().toArray();

      // Check for expired polls and update their status
      const now = Date.now();
      const expiredPolls = polls.filter((p: Poll) => p.status === 'active' && p.endsAt <= now);
      for (const poll of expiredPolls) {
        await db.table('polls').update(poll.id, { status: 'ended' });
        poll.status = 'ended';
      }

      // Load user's votes
      const currentIdentity = useAuthStore.getState().currentIdentity;
      const myVotes = new Map<string, string[]>();
      if (currentIdentity) {
        const votes = await db.table('pollVotes')
          .where('voterId')
          .equals(currentIdentity.publicKey)
          .toArray();

        for (const vote of votes) {
          const existing = myVotes.get(vote.pollId) || [];
          myVotes.set(vote.pollId, [...existing, vote.optionId]);
        }
      }

      set({ polls, myVotes });
    } catch (error) {
      console.error('Failed to load polls:', error);
    }
  },

  // ============================================================================
  // STORIES
  // ============================================================================

  createStory: async (input: CreateStoryInput): Promise<Story> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const story: Story = {
      id: `story-${Date.now()}-${secureRandomString(9)}`,
      authorId: currentIdentity.publicKey,
      contentType: input.contentType,
      text: input.text,
      media: input.media,
      textStyle: input.textStyle,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      viewCount: 0,
      viewerPubkeys: [],
      replyCount: 0,
      privacy: {
        visibility: input.privacy?.visibility || 'friends',
        allowedPubkeys: input.privacy?.allowedPubkeys,
        hideFromPubkeys: input.privacy?.hideFromPubkeys,
        allowReplies: input.privacy?.allowReplies ?? true,
      },
    };

    try {
      await db.table('stories').add(story);
    } catch (error) {
      console.error('Failed to save story:', error);
    }

    set((state) => ({
      stories: [story, ...state.stories],
    }));

    // Rebuild story groups
    get().loadStories();

    return story;
  },

  deleteStory: async (storyId: string): Promise<void> => {
    try {
      await db.table('stories').delete(storyId);
      await db.table('storyReplies').where('storyId').equals(storyId).delete();
      await db.table('storyViews').where('storyId').equals(storyId).delete();
    } catch (error) {
      console.error('Failed to delete story:', error);
    }

    set((state) => ({
      stories: state.stories.filter((s) => s.id !== storyId),
    }));
  },

  viewStory: async (storyId: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    const story = get().stories.find((s) => s.id === storyId);
    if (!story) return;

    // Don't count own views
    if (story.authorId === currentIdentity.publicKey) return;

    // Check if already viewed
    if (story.viewerPubkeys.includes(currentIdentity.publicKey)) return;

    const view: StoryView = {
      id: `view-${Date.now()}-${secureRandomString(9)}`,
      storyId,
      viewerId: currentIdentity.publicKey,
      viewedAt: Date.now(),
    };

    try {
      await db.table('storyViews').add(view);
      await db.table('stories').update(storyId, {
        viewCount: story.viewCount + 1,
        viewerPubkeys: [...story.viewerPubkeys, currentIdentity.publicKey],
      });
    } catch (error) {
      console.error('Failed to record story view:', error);
    }

    set((state) => {
      const myStoryViews = new Set(state.myStoryViews);
      myStoryViews.add(storyId);

      return {
        myStoryViews,
        stories: state.stories.map((s) =>
          s.id === storyId
            ? {
                ...s,
                viewCount: s.viewCount + 1,
                viewerPubkeys: [...s.viewerPubkeys, currentIdentity.publicKey],
              }
            : s
        ),
      };
    });
  },

  replyToStory: async (storyId: string, content: string, isEmoji = false): Promise<StoryReply> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const reply: StoryReply = {
      id: `reply-${Date.now()}-${secureRandomString(9)}`,
      storyId,
      authorId: currentIdentity.publicKey,
      content,
      createdAt: Date.now(),
      isEmoji,
    };

    try {
      await db.table('storyReplies').add(reply);
      const story = get().stories.find((s) => s.id === storyId);
      if (story) {
        await db.table('stories').update(storyId, {
          replyCount: story.replyCount + 1,
        });
      }
    } catch (error) {
      console.error('Failed to save story reply:', error);
    }

    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, replyCount: s.replyCount + 1 } : s
      ),
    }));

    return reply;
  },

  getStory: (storyId: string): Story | undefined => {
    return get().stories.find((s) => s.id === storyId);
  },

  getStoryGroups: (): StoryGroup[] => {
    return get().storyGroups;
  },

  getMyStories: (): Story[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];
    return get().stories.filter((s) => s.authorId === currentIdentity.publicKey);
  },

  getStoryReplies: async (storyId: string): Promise<StoryReply[]> => {
    try {
      return await db.table('storyReplies')
        .where('storyId')
        .equals(storyId)
        .toArray();
    } catch (error) {
      console.error('Failed to load story replies:', error);
      return [];
    }
  },

  getStoryViewers: async (storyId: string): Promise<StoryView[]> => {
    try {
      return await db.table('storyViews')
        .where('storyId')
        .equals(storyId)
        .toArray();
    } catch (error) {
      console.error('Failed to load story viewers:', error);
      return [];
    }
  },

  loadStories: async (): Promise<void> => {
    try {
      const now = Date.now();
      // Only load non-expired stories
      const stories = await db.table('stories')
        .where('expiresAt')
        .above(now)
        .toArray();

      // Build story groups
      const groupMap = new Map<string, Story[]>();
      for (const story of stories) {
        const existing = groupMap.get(story.authorId) || [];
        groupMap.set(story.authorId, [...existing, story]);
      }

      const currentIdentity = useAuthStore.getState().currentIdentity;
      const myStoryViews = new Set<string>();

      if (currentIdentity) {
        const views = await db.table('storyViews')
          .where('viewerId')
          .equals(currentIdentity.publicKey)
          .toArray();
        for (const view of views) {
          myStoryViews.add(view.storyId);
        }
      }

      const storyGroups: StoryGroup[] = Array.from(groupMap.entries()).map(
        ([authorId, authorStories]) => ({
          authorId,
          stories: authorStories.sort((a, b) => b.createdAt - a.createdAt),
          hasUnviewed: authorStories.some((s) => !myStoryViews.has(s.id)),
          latestStoryAt: Math.max(...authorStories.map((s) => s.createdAt)),
        })
      );

      // Sort groups: unviewed first, then by latest story
      storyGroups.sort((a, b) => {
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return b.latestStoryAt - a.latestStoryAt;
      });

      set({ stories, storyGroups, myStoryViews });
    } catch (error) {
      console.error('Failed to load stories:', error);
    }
  },

  cleanupExpiredStories: async (): Promise<void> => {
    try {
      const now = Date.now();
      const expired = await db.table('stories')
        .where('expiresAt')
        .below(now)
        .toArray();

      for (const story of expired) {
        await db.table('stories').delete(story.id);
        await db.table('storyReplies').where('storyId').equals(story.id).delete();
        await db.table('storyViews').where('storyId').equals(story.id).delete();
      }

      // Reload stories
      await get().loadStories();
    } catch (error) {
      console.error('Failed to cleanup expired stories:', error);
    }
  },

  // ============================================================================
  // MODERATION
  // ============================================================================

  muteUser: async (
    pubkey: string,
    reason?: string,
    durationMinutes?: number,
    scope: MuteRecord['muteScope'] = 'all'
  ): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const mute: MuteRecord = {
      id: `mute-${Date.now()}-${secureRandomString(9)}`,
      userPubkey: currentIdentity.publicKey,
      mutedPubkey: pubkey,
      reason,
      createdAt: Date.now(),
      expiresAt: durationMinutes ? Date.now() + durationMinutes * 60 * 1000 : undefined,
      muteScope: scope,
    };

    try {
      // Check if already muted
      const existing = await db.table('muteRecords')
        .where('[userPubkey+mutedPubkey]')
        .equals([currentIdentity.publicKey, pubkey])
        .first();

      if (existing) {
        await db.table('muteRecords').update(existing.id, mute);
      } else {
        await db.table('muteRecords').add(mute);
      }

      // Log the action
      const logEntry: ModerationLogEntry = {
        id: `log-${Date.now()}-${secureRandomString(9)}`,
        moderatorPubkey: currentIdentity.publicKey,
        action: 'mute',
        targetPubkey: pubkey,
        reason,
        createdAt: Date.now(),
      };
      await db.table('moderationLogs').add(logEntry);
    } catch (error) {
      console.error('Failed to mute user:', error);
    }

    set((state) => ({
      mutedUsers: state.mutedUsers.some((m) => m.mutedPubkey === pubkey)
        ? state.mutedUsers.map((m) => (m.mutedPubkey === pubkey ? mute : m))
        : [...state.mutedUsers, mute],
    }));
  },

  unmuteUser: async (pubkey: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    try {
      await db.table('muteRecords')
        .where('[userPubkey+mutedPubkey]')
        .equals([currentIdentity.publicKey, pubkey])
        .delete();

      // Log the action
      const logEntry: ModerationLogEntry = {
        id: `log-${Date.now()}-${secureRandomString(9)}`,
        moderatorPubkey: currentIdentity.publicKey,
        action: 'unmute',
        targetPubkey: pubkey,
        createdAt: Date.now(),
      };
      await db.table('moderationLogs').add(logEntry);
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }

    set((state) => ({
      mutedUsers: state.mutedUsers.filter((m) => m.mutedPubkey !== pubkey),
    }));
  },

  blockUser: async (pubkey: string, reason?: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const block: BlockRecord = {
      id: `block-${Date.now()}-${secureRandomString(9)}`,
      userPubkey: currentIdentity.publicKey,
      blockedPubkey: pubkey,
      reason,
      createdAt: Date.now(),
    };

    try {
      // Check if already blocked
      const existing = await db.table('blockRecords')
        .where('[userPubkey+blockedPubkey]')
        .equals([currentIdentity.publicKey, pubkey])
        .first();

      if (!existing) {
        await db.table('blockRecords').add(block);
      }

      // Log the action
      const logEntry: ModerationLogEntry = {
        id: `log-${Date.now()}-${secureRandomString(9)}`,
        moderatorPubkey: currentIdentity.publicKey,
        action: 'block',
        targetPubkey: pubkey,
        reason,
        createdAt: Date.now(),
      };
      await db.table('moderationLogs').add(logEntry);
    } catch (error) {
      console.error('Failed to block user:', error);
    }

    set((state) => ({
      blockedUsers: state.blockedUsers.some((b) => b.blockedPubkey === pubkey)
        ? state.blockedUsers
        : [...state.blockedUsers, block],
    }));
  },

  unblockUser: async (pubkey: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    try {
      await db.table('blockRecords')
        .where('[userPubkey+blockedPubkey]')
        .equals([currentIdentity.publicKey, pubkey])
        .delete();

      // Log the action
      const logEntry: ModerationLogEntry = {
        id: `log-${Date.now()}-${secureRandomString(9)}`,
        moderatorPubkey: currentIdentity.publicKey,
        action: 'unblock',
        targetPubkey: pubkey,
        createdAt: Date.now(),
      };
      await db.table('moderationLogs').add(logEntry);
    } catch (error) {
      console.error('Failed to unblock user:', error);
    }

    set((state) => ({
      blockedUsers: state.blockedUsers.filter((b) => b.blockedPubkey !== pubkey),
    }));
  },

  reportContent: async (
    contentType: ContentReport['reportedContentType'],
    contentId: string,
    authorPubkey: string,
    reason: ReportReason,
    description?: string
  ): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const report: ContentReport = {
      id: `report-${Date.now()}-${secureRandomString(9)}`,
      reporterPubkey: currentIdentity.publicKey,
      reportedContentType: contentType,
      reportedContentId: contentId,
      reportedPubkey: authorPubkey,
      reason,
      description,
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      await db.table('contentReports').add(report);
    } catch (error) {
      console.error('Failed to submit report:', error);
    }

    set((state) => ({
      reports: [...state.reports, report],
    }));
  },

  reviewReport: async (
    reportId: string,
    status: ContentReport['status'],
    actionTaken?: string
  ): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    try {
      await db.table('contentReports').update(reportId, {
        status,
        reviewedAt: Date.now(),
        reviewedBy: currentIdentity.publicKey,
        actionTaken,
      });
    } catch (error) {
      console.error('Failed to review report:', error);
    }

    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status,
              reviewedAt: Date.now(),
              reviewedBy: currentIdentity.publicKey,
              actionTaken,
            }
          : r
      ),
    }));
  },

  isMuted: (pubkey: string): boolean => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return false;

    const mute = get().mutedUsers.find(
      (m) => m.userPubkey === currentIdentity.publicKey && m.mutedPubkey === pubkey
    );

    if (!mute) return false;
    if (mute.expiresAt && mute.expiresAt < Date.now()) return false;

    return true;
  },

  isBlocked: (pubkey: string): boolean => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return false;

    return get().blockedUsers.some(
      (b) => b.userPubkey === currentIdentity.publicKey && b.blockedPubkey === pubkey
    );
  },

  getMutedUsers: (): MuteRecord[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];

    const now = Date.now();
    return get().mutedUsers.filter(
      (m) =>
        m.userPubkey === currentIdentity.publicKey &&
        (!m.expiresAt || m.expiresAt > now)
    );
  },

  getBlockedUsers: (): BlockRecord[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];

    return get().blockedUsers.filter(
      (b) => b.userPubkey === currentIdentity.publicKey
    );
  },

  getPendingReports: (): ContentReport[] => {
    return get().reports.filter((r) => r.status === 'pending');
  },

  loadModerationData: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      const [mutedUsers, blockedUsers, reports, rules, logs] = await Promise.all([
        db.table('muteRecords').where('userPubkey').equals(currentIdentity.publicKey).toArray(),
        db.table('blockRecords').where('userPubkey').equals(currentIdentity.publicKey).toArray(),
        db.table('contentReports').toArray(),
        db.table('autoModerationRules').toArray(),
        db.table('moderationLogs').orderBy('createdAt').reverse().limit(100).toArray(),
      ]);

      set({
        mutedUsers,
        blockedUsers,
        reports,
        moderationRules: rules,
        moderationLogs: logs,
      });
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    }
  },

  // Auto-moderation
  createAutoModRule: async (
    rule: Omit<AutoModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>
  ): Promise<void> => {
    const fullRule: AutoModerationRule = {
      ...rule,
      id: `rule-${Date.now()}-${secureRandomString(9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      triggerCount: 0,
    };

    try {
      await db.table('autoModerationRules').add(fullRule);
    } catch (error) {
      console.error('Failed to create auto-mod rule:', error);
    }

    set((state) => ({
      moderationRules: [...state.moderationRules, fullRule],
    }));
  },

  updateAutoModRule: async (
    ruleId: string,
    updates: Partial<AutoModerationRule>
  ): Promise<void> => {
    try {
      await db.table('autoModerationRules').update(ruleId, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to update auto-mod rule:', error);
    }

    set((state) => ({
      moderationRules: state.moderationRules.map((r) =>
        r.id === ruleId ? { ...r, ...updates, updatedAt: Date.now() } : r
      ),
    }));
  },

  deleteAutoModRule: async (ruleId: string): Promise<void> => {
    try {
      await db.table('autoModerationRules').delete(ruleId);
    } catch (error) {
      console.error('Failed to delete auto-mod rule:', error);
    }

    set((state) => ({
      moderationRules: state.moderationRules.filter((r) => r.id !== ruleId),
    }));
  },

  checkContent: (content: string): { shouldFlag: boolean; matchedRules: AutoModerationRule[] } => {
    const rules = get().moderationRules.filter((r) => r.isEnabled);
    const matchedRules: AutoModerationRule[] = [];

    for (const rule of rules) {
      if (rule.ruleType === 'keyword' && rule.patterns) {
        const lowerContent = content.toLowerCase();
        if (rule.patterns.some((p) => lowerContent.includes(p.toLowerCase()))) {
          matchedRules.push(rule);
        }
      } else if (rule.ruleType === 'regex' && rule.patterns) {
        for (const pattern of rule.patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(content)) {
              matchedRules.push(rule);
              break;
            }
          } catch {
            // Invalid regex, skip
          }
        }
      }
    }

    return {
      shouldFlag: matchedRules.length > 0,
      matchedRules,
    };
  },

  // ============================================================================
  // USER LISTS
  // ============================================================================

  createUserList: async (input: CreateUserListInput): Promise<UserList> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const list: UserList = {
      id: `list-${Date.now()}-${secureRandomString(9)}`,
      ownerPubkey: currentIdentity.publicKey,
      name: input.name,
      description: input.description,
      type: input.type || 'custom',
      members: input.members || [],
      isPrivate: input.isPrivate ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await db.table('userLists').add(list);
    } catch (error) {
      console.error('Failed to create user list:', error);
    }

    set((state) => ({
      userLists: [...state.userLists, list],
    }));

    return list;
  },

  updateUserList: async (listId: string, updates: Partial<UserList>): Promise<void> => {
    try {
      await db.table('userLists').update(listId, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to update user list:', error);
    }

    set((state) => ({
      userLists: state.userLists.map((l) =>
        l.id === listId ? { ...l, ...updates, updatedAt: Date.now() } : l
      ),
    }));
  },

  deleteUserList: async (listId: string): Promise<void> => {
    try {
      await db.table('userLists').delete(listId);
    } catch (error) {
      console.error('Failed to delete user list:', error);
    }

    set((state) => ({
      userLists: state.userLists.filter((l) => l.id !== listId),
    }));
  },

  addToList: async (listId: string, pubkey: string): Promise<void> => {
    const list = get().userLists.find((l) => l.id === listId);
    if (!list || list.members.includes(pubkey)) return;

    const updatedMembers = [...list.members, pubkey];

    try {
      await db.table('userLists').update(listId, {
        members: updatedMembers,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to add to list:', error);
    }

    set((state) => ({
      userLists: state.userLists.map((l) =>
        l.id === listId
          ? { ...l, members: updatedMembers, updatedAt: Date.now() }
          : l
      ),
    }));
  },

  removeFromList: async (listId: string, pubkey: string): Promise<void> => {
    const list = get().userLists.find((l) => l.id === listId);
    if (!list) return;

    const updatedMembers = list.members.filter((m) => m !== pubkey);

    try {
      await db.table('userLists').update(listId, {
        members: updatedMembers,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to remove from list:', error);
    }

    set((state) => ({
      userLists: state.userLists.map((l) =>
        l.id === listId
          ? { ...l, members: updatedMembers, updatedAt: Date.now() }
          : l
      ),
    }));
  },

  getUserLists: (): UserList[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];
    return get().userLists.filter((l) => l.ownerPubkey === currentIdentity.publicKey);
  },

  getListMembers: (listId: string): string[] => {
    const list = get().userLists.find((l) => l.id === listId);
    return list?.members || [];
  },

  isInList: (listId: string, pubkey: string): boolean => {
    const list = get().userLists.find((l) => l.id === listId);
    return list?.members.includes(pubkey) || false;
  },

  loadUserLists: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      const lists = await db.table('userLists')
        .where('ownerPubkey')
        .equals(currentIdentity.publicKey)
        .toArray();
      set({ userLists: lists });
    } catch (error) {
      console.error('Failed to load user lists:', error);
    }
  },

  // ============================================================================
  // TRENDING & DISCOVERY
  // ============================================================================

  refreshTrendingTopics: async (): Promise<void> => {
    try {
      // Get posts from last 24 hours
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const posts = await db.table('posts')
        .where('createdAt')
        .above(since)
        .toArray();

      // Count hashtags
      const hashtagCounts = new Map<string, { count: number; authors: Set<string>; postIds: string[] }>();

      for (const post of posts) {
        const hashtags = post.hashtags || [];
        for (const tag of hashtags) {
          const existing = hashtagCounts.get(tag) || { count: 0, authors: new Set(), postIds: [] };
          existing.count++;
          existing.authors.add(post.authorId);
          if (existing.postIds.length < 5) existing.postIds.push(post.id);
          hashtagCounts.set(tag, existing);
        }
      }

      // Convert to trending topics
      const trendingTopics: TrendingTopic[] = Array.from(hashtagCounts.entries())
        .map(([hashtag, data]) => ({
          hashtag,
          postCount: data.count,
          uniqueAuthors: data.authors.size,
          trend: 'stable' as const,
          trendPercentage: 0,
          firstSeen: Date.now() - 24 * 60 * 60 * 1000,
          lastSeen: Date.now(),
          samplePostIds: data.postIds,
        }))
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, 20);

      set({ trendingTopics });
    } catch (error) {
      console.error('Failed to refresh trending topics:', error);
    }
  },

  refreshSuggestedFollows: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      // Get friends
      const friends = await db.table('friends')
        .where('userPubkey')
        .equals(currentIdentity.publicKey)
        .toArray();
      const friendPubkeys = new Set(friends.map((f: { friendPubkey: string }) => f.friendPubkey));

      // Get friends of friends (mutual connections)
      const suggestions: SuggestedFollow[] = [];

      for (const friend of friends) {
        const friendsOfFriend = await db.table('friends')
          .where('userPubkey')
          .equals(friend.friendPubkey)
          .toArray();

        for (const fof of friendsOfFriend) {
          // Skip if already friends or self
          if (
            fof.friendPubkey === currentIdentity.publicKey ||
            friendPubkeys.has(fof.friendPubkey)
          ) {
            continue;
          }

          // Check if already in suggestions
          const existing = suggestions.find((s) => s.pubkey === fof.friendPubkey);
          if (existing) {
            existing.mutualFriendsCount = (existing.mutualFriendsCount || 0) + 1;
            existing.mutualFriendPubkeys?.push(friend.friendPubkey);
            existing.score += 10;
          } else {
            suggestions.push({
              pubkey: fof.friendPubkey,
              reason: 'mutual-friends',
              mutualFriendsCount: 1,
              mutualFriendPubkeys: [friend.friendPubkey],
              score: 50,
            });
          }
        }
      }

      // Sort by score
      suggestions.sort((a, b) => b.score - a.score);

      set({ suggestedFollows: suggestions.slice(0, 10) });
    } catch (error) {
      console.error('Failed to refresh suggested follows:', error);
    }
  },

  dismissSuggestion: (pubkey: string): void => {
    set((state) => ({
      suggestedFollows: state.suggestedFollows.filter((s) => s.pubkey !== pubkey),
    }));
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  createNotification: async (
    type: NotificationType,
    actorPubkey: string,
    targetId?: string,
    content?: string
  ): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    const notification: Notification = {
      id: `notif-${Date.now()}-${secureRandomString(9)}`,
      userPubkey: currentIdentity.publicKey,
      type,
      actorPubkey,
      targetId,
      content,
      isRead: false,
      createdAt: Date.now(),
    };

    try {
      await db.table('notifications').add(notification);
    } catch (error) {
      console.error('Failed to create notification:', error);
    }

    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      await db.table('notifications').update(notificationId, { isRead: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      await db.table('notifications')
        .where('userPubkey')
        .equals(currentIdentity.publicKey)
        .modify({ isRead: true });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (notificationId: string): Promise<void> => {
    const notification = get().notifications.find((n) => n.id === notificationId);

    try {
      await db.table('notifications').delete(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }

    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
      unreadCount: notification && !notification.isRead
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
  },

  getUnreadNotifications: (): Notification[] => {
    return get().notifications.filter((n) => !n.isRead);
  },

  loadNotifications: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      const notifications = await db.table('notifications')
        .where('userPubkey')
        .equals(currentIdentity.publicKey)
        .reverse()
        .sortBy('createdAt');

      const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

      set({ notifications, unreadCount });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  },

  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>): void => {
    set((state) => ({
      notificationPreferences: { ...state.notificationPreferences, ...prefs },
    }));
  },

  // ============================================================================
  // BOOKMARK COLLECTIONS
  // ============================================================================

  createBookmarkCollection: async (
    input: CreateBookmarkCollectionInput
  ): Promise<BookmarkCollection> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const collection: BookmarkCollection = {
      id: `collection-${Date.now()}-${secureRandomString(9)}`,
      ownerPubkey: currentIdentity.publicKey,
      name: input.name,
      description: input.description,
      isDefault: false,
      itemCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await db.table('bookmarkCollections').add(collection);
    } catch (error) {
      console.error('Failed to create bookmark collection:', error);
    }

    set((state) => ({
      bookmarkCollections: [...state.bookmarkCollections, collection],
    }));

    return collection;
  },

  deleteBookmarkCollection: async (collectionId: string): Promise<void> => {
    try {
      await db.table('bookmarkCollections').delete(collectionId);
      // Move bookmarks from this collection to default
      await db.table('bookmarks')
        .where('collectionId')
        .equals(collectionId)
        .modify({ collectionId: undefined });
    } catch (error) {
      console.error('Failed to delete bookmark collection:', error);
    }

    set((state) => ({
      bookmarkCollections: state.bookmarkCollections.filter((c) => c.id !== collectionId),
    }));
  },

  getBookmarkCollections: (): BookmarkCollection[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];
    return get().bookmarkCollections.filter(
      (c) => c.ownerPubkey === currentIdentity.publicKey
    );
  },

  loadBookmarkCollections: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      const collections = await db.table('bookmarkCollections')
        .where('ownerPubkey')
        .equals(currentIdentity.publicKey)
        .toArray();
      set({ bookmarkCollections: collections });
    } catch (error) {
      console.error('Failed to load bookmark collections:', error);
    }
  },
}));
