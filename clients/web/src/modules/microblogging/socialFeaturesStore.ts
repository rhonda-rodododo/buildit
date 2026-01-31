/**
 * Social Features Store
 * Epic 61: Handles polls, stories, moderation, and user lists
 */

import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { dal } from '@/core/storage/dal';
import { secureRandomString } from '@/lib/utils';
import { usePostsStore } from './postsStore';
import type {
  Poll,
  PollOption,
  PollVote,
  CreatePollInput,
  Story,
  StoryView,
  StoryReply,
  CreateStoryInput,
  MutedUser,
  ContentReport,
  ReportReason,
  ReportStatus,
  AutoModRule,
  AutoModRuleType,
  AutoModAction,
  ModerationLog,
  UserList,
  CreateUserListInput,
  TrendingTopic,
  SuggestedUser,
} from './types';

// ========================================
// POLLS STATE
// ========================================

interface PollsState {
  polls: Poll[];
  pollVotes: Map<string, PollVote>; // pollId -> my vote
  isLoading: boolean;

  // Actions
  createPoll: (input: CreatePollInput) => Promise<Poll>;
  votePoll: (pollId: string, optionIds: string[]) => Promise<void>;
  getPoll: (pollId: string) => Poll | undefined;
  getPollByPostId: (postId: string) => Poll | undefined;
  getMyVote: (pollId: string) => PollVote | undefined;
  hasVoted: (pollId: string) => boolean;
  closePoll: (pollId: string) => Promise<void>;
  loadPolls: () => Promise<void>;
}

// ========================================
// STORIES STATE
// ========================================

interface StoriesState {
  stories: Story[];
  viewedStories: Set<string>; // story IDs I've viewed
  isLoading: boolean;

  // Actions
  createStory: (input: CreateStoryInput) => Promise<Story>;
  viewStory: (storyId: string) => Promise<void>;
  replyToStory: (storyId: string, content: string) => Promise<StoryReply>;
  getStory: (storyId: string) => Story | undefined;
  getUserStories: (userId: string) => Story[];
  getActiveStories: () => Story[]; // Non-expired stories
  getFeedStories: () => Map<string, Story[]>; // Grouped by author
  deleteStory: (storyId: string) => Promise<void>;
  cleanupExpiredStories: () => Promise<void>;
  loadStories: () => Promise<void>;
}

// ========================================
// MODERATION STATE
// ========================================

interface ModerationState {
  mutedUsers: Set<string>; // user IDs I've muted
  pendingReports: ContentReport[];
  autoModRules: AutoModRule[];
  moderationLogs: ModerationLog[];

  // Mute actions
  muteUser: (userId: string, reason?: string, expiresAt?: number) => Promise<void>;
  unmuteUser: (userId: string) => Promise<void>;
  isMuted: (userId: string) => boolean;
  getMutedUsers: () => MutedUser[];

  // Report actions
  reportContent: (
    contentType: 'post' | 'comment' | 'user' | 'message' | 'story',
    contentId: string,
    contentAuthorId: string,
    reason: ReportReason,
    description?: string
  ) => Promise<ContentReport>;
  reviewReport: (reportId: string, status: ReportStatus, actionTaken?: string) => Promise<void>;
  getPendingReports: () => ContentReport[];

  // Auto-mod actions
  createAutoModRule: (
    name: string,
    ruleType: AutoModRuleType,
    pattern: string,
    actions: AutoModAction[],
    groupId?: string
  ) => Promise<AutoModRule>;
  updateAutoModRule: (ruleId: string, updates: Partial<AutoModRule>) => Promise<void>;
  deleteAutoModRule: (ruleId: string) => Promise<void>;
  checkAutoMod: (content: string, groupId?: string) => { triggered: boolean; actions: AutoModAction[] };

  // Load
  loadModeration: () => Promise<void>;

  // Helper for logging
  logModerationAction: (
    action: ModerationLog['action'],
    targetUserId?: string,
    targetContentType?: 'post' | 'comment' | 'message' | 'story',
    targetContentId?: string,
    reason?: string,
    reportId?: string
  ) => Promise<void>;
}

// ========================================
// LISTS STATE
// ========================================

interface ListsState {
  lists: UserList[];

  // Actions
  createList: (input: CreateUserListInput) => Promise<UserList>;
  updateList: (listId: string, updates: Partial<Pick<UserList, 'name' | 'description' | 'isPrivate'>>) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  addToList: (listId: string, userId: string) => Promise<void>;
  removeFromList: (listId: string, userId: string) => Promise<void>;
  getList: (listId: string) => UserList | undefined;
  getMyLists: () => UserList[];
  getListMembers: (listId: string) => string[];
  loadLists: () => Promise<void>;
}

// ========================================
// TRENDING STATE
// ========================================

interface TrendingState {
  trendingTopics: TrendingTopic[];
  suggestedUsers: SuggestedUser[];

  // Actions
  refreshTrending: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

// ========================================
// COMBINED STORE
// ========================================

type SocialFeaturesState = PollsState & StoriesState & ModerationState & ListsState & TrendingState;

export const useSocialFeaturesStore = create<SocialFeaturesState>()((set, get) => ({
  // ========================================
  // INITIAL STATE
  // ========================================

  // Polls
  polls: [],
  pollVotes: new Map(),
  isLoading: false,

  // Stories
  stories: [],
  viewedStories: new Set(),

  // Moderation
  mutedUsers: new Set(),
  pendingReports: [],
  autoModRules: [],
  moderationLogs: [],

  // Lists
  lists: [],

  // Trending
  trendingTopics: [],
  suggestedUsers: [],

  // ========================================
  // POLL ACTIONS
  // ========================================

  createPoll: async (input: CreatePollInput): Promise<Poll> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const pollId = `poll-${Date.now()}-${secureRandomString(9)}`;
    const postId = `post-${Date.now()}-${secureRandomString(9)}`;

    // Create poll options
    const options: PollOption[] = input.options.map((text, index) => ({
      id: `option-${pollId}-${index}`,
      text,
      voteCount: 0,
    }));

    const endsAt = Date.now() + input.durationHours * 60 * 60 * 1000;

    const poll: Poll = {
      id: pollId,
      postId,
      authorId: currentIdentity.publicKey,
      question: input.question,
      options,
      pollType: input.pollType,
      endsAt,
      isEnded: false,
      totalVotes: 0,
      voterCount: 0,
      hideResultsUntilEnded: input.hideResultsUntilEnded,
      allowAnonymousVotes: input.allowAnonymousVotes,
      createdAt: Date.now(),
    };

    // Create associated post
    await usePostsStore.getState().createPost({
      content: input.question,
      contentType: 'poll',
      visibility: input.visibility,
      contentWarning: input.contentWarning,
    });

    // Persist poll
    try {
      await dal.add<Poll>('polls', poll);
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
    if (poll.isEnded || Date.now() > poll.endsAt) throw new Error('Poll has ended');

    // Check if already voted
    if (get().hasVoted(pollId)) {
      throw new Error('Already voted on this poll');
    }

    // Validate options
    if (poll.pollType === 'single' && optionIds.length !== 1) {
      throw new Error('Single choice poll requires exactly one option');
    }

    const vote: PollVote = {
      id: `vote-${Date.now()}-${secureRandomString(9)}`,
      pollId,
      optionIds,
      voterId: currentIdentity.publicKey,
      createdAt: Date.now(),
    };

    // Persist vote
    try {
      await dal.add<PollVote>('pollVotes', vote);

      // Update poll vote counts
      const updatedOptions = poll.options.map((opt) => ({
        ...opt,
        voteCount: optionIds.includes(opt.id) ? opt.voteCount + 1 : opt.voteCount,
      }));

      await dal.update('polls', pollId, {
        options: updatedOptions,
        totalVotes: poll.totalVotes + optionIds.length,
        voterCount: poll.voterCount + 1,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to save vote:', error);
    }

    set((state) => {
      const pollVotes = new Map(state.pollVotes);
      pollVotes.set(pollId, vote);

      return {
        pollVotes,
        polls: state.polls.map((p) =>
          p.id === pollId
            ? {
                ...p,
                options: p.options.map((opt) => ({
                  ...opt,
                  voteCount: optionIds.includes(opt.id) ? opt.voteCount + 1 : opt.voteCount,
                })),
                totalVotes: p.totalVotes + optionIds.length,
                voterCount: p.voterCount + 1,
              }
            : p
        ),
      };
    });
  },

  getPoll: (pollId: string): Poll | undefined => {
    return get().polls.find((p) => p.id === pollId);
  },

  getPollByPostId: (postId: string): Poll | undefined => {
    return get().polls.find((p) => p.postId === postId);
  },

  getMyVote: (pollId: string): PollVote | undefined => {
    return get().pollVotes.get(pollId);
  },

  hasVoted: (pollId: string): boolean => {
    return get().pollVotes.has(pollId);
  },

  closePoll: async (pollId: string): Promise<void> => {
    try {
      await dal.update('polls', pollId, { isEnded: true, updatedAt: Date.now() });
    } catch (error) {
      console.error('Failed to close poll:', error);
    }

    set((state) => ({
      polls: state.polls.map((p) =>
        p.id === pollId ? { ...p, isEnded: true, updatedAt: Date.now() } : p
      ),
    }));
  },

  loadPolls: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    set({ isLoading: true });

    try {
      const polls = await dal.query<Poll>('polls', {
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 100,
      });

      // Load my votes
      const myVotes = await dal.query<PollVote>('pollVotes', {
        whereClause: { voterId: currentIdentity.publicKey },
      });

      const pollVotes = new Map<string, PollVote>();
      myVotes.forEach((v: PollVote) => pollVotes.set(v.pollId, v));

      set({ polls, pollVotes, isLoading: false });
    } catch (error) {
      console.error('Failed to load polls:', error);
      set({ isLoading: false });
    }
  },

  // ========================================
  // STORY ACTIONS
  // ========================================

  createStory: async (input: CreateStoryInput): Promise<Story> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const story: Story = {
      id: `story-${Date.now()}-${secureRandomString(9)}`,
      authorId: currentIdentity.publicKey,
      contentType: input.contentType,
      content: input.content,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      thumbnailUrl: input.thumbnailUrl,
      backgroundColor: input.backgroundColor,
      textColor: input.textColor,
      fontFamily: input.fontFamily,
      visibility: input.visibility,
      viewCount: 0,
      replyCount: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Persist story
    try {
      await dal.add<Story>('stories', story);
    } catch (error) {
      console.error('Failed to save story:', error);
    }

    set((state) => ({
      stories: [story, ...state.stories],
    }));

    return story;
  },

  viewStory: async (storyId: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    // Check if already viewed
    if (get().viewedStories.has(storyId)) return;

    const storyView: StoryView = {
      id: `view-${Date.now()}-${secureRandomString(9)}`,
      storyId,
      viewerId: currentIdentity.publicKey,
      viewedAt: Date.now(),
    };

    try {
      await dal.add<StoryView>('storyViews', storyView);

      // Update view count
      const story = await dal.get<Story>('stories', storyId);
      if (story) {
        await dal.update('stories', storyId, { viewCount: story.viewCount + 1 });
      }
    } catch (error) {
      console.error('Failed to record story view:', error);
    }

    set((state) => {
      const viewedStories = new Set(state.viewedStories);
      viewedStories.add(storyId);

      return {
        viewedStories,
        stories: state.stories.map((s) =>
          s.id === storyId ? { ...s, viewCount: s.viewCount + 1 } : s
        ),
      };
    });
  },

  replyToStory: async (storyId: string, content: string): Promise<StoryReply> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const reply: StoryReply = {
      id: `reply-${Date.now()}-${secureRandomString(9)}`,
      storyId,
      authorId: currentIdentity.publicKey,
      content,
      createdAt: Date.now(),
    };

    try {
      await dal.add<StoryReply>('storyReplies', reply);

      // Update reply count
      const story = await dal.get<Story>('stories', storyId);
      if (story) {
        await dal.update('stories', storyId, { replyCount: story.replyCount + 1 });
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

  getUserStories: (userId: string): Story[] => {
    const now = Date.now();
    return get()
      .stories.filter((s) => s.authorId === userId && s.expiresAt > now)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  getActiveStories: (): Story[] => {
    const now = Date.now();
    return get()
      .stories.filter((s) => s.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getFeedStories: (): Map<string, Story[]> => {
    const activeStories = get().getActiveStories();
    const grouped = new Map<string, Story[]>();

    activeStories.forEach((story) => {
      const existing = grouped.get(story.authorId) || [];
      grouped.set(story.authorId, [...existing, story]);
    });

    return grouped;
  },

  deleteStory: async (storyId: string): Promise<void> => {
    try {
      await dal.delete('stories', storyId);
      await dal.queryCustom<never>({
        sql: 'DELETE FROM story_views WHERE story_id = ?1',
        params: [storyId],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { storyViews: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
          await dexieDb.storyViews.where('storyId').equals(storyId).delete();
          return [];
        },
      });
      await dal.queryCustom<never>({
        sql: 'DELETE FROM story_replies WHERE story_id = ?1',
        params: [storyId],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { storyReplies: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
          await dexieDb.storyReplies.where('storyId').equals(storyId).delete();
          return [];
        },
      });
    } catch (error) {
      console.error('Failed to delete story:', error);
    }

    set((state) => ({
      stories: state.stories.filter((s) => s.id !== storyId),
    }));
  },

  cleanupExpiredStories: async (): Promise<void> => {
    const now = Date.now();

    try {
      const expiredStories = await dal.queryCustom<Story>({
        sql: 'SELECT * FROM stories WHERE expires_at < ?1',
        params: [now],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { stories: { where: (key: string) => { below: (val: number) => { toArray: () => Promise<Story[]> } } } };
          return dexieDb.stories.where('expiresAt').below(now).toArray();
        },
      });

      for (const story of expiredStories) {
        await dal.delete('stories', story.id);
        await dal.queryCustom<never>({
          sql: 'DELETE FROM story_views WHERE story_id = ?1',
          params: [story.id],
          dexieFallback: async (db: unknown) => {
            const dexieDb = db as { storyViews: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
            await dexieDb.storyViews.where('storyId').equals(story.id).delete();
            return [];
          },
        });
        await dal.queryCustom<never>({
          sql: 'DELETE FROM story_replies WHERE story_id = ?1',
          params: [story.id],
          dexieFallback: async (db: unknown) => {
            const dexieDb = db as { storyReplies: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
            await dexieDb.storyReplies.where('storyId').equals(story.id).delete();
            return [];
          },
        });
      }

      set((state) => ({
        stories: state.stories.filter((s) => s.expiresAt > now),
      }));
    } catch (error) {
      console.error('Failed to cleanup expired stories:', error);
    }
  },

  loadStories: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    set({ isLoading: true });

    try {
      const now = Date.now();

      // Load non-expired stories
      const stories = await dal.queryCustom<Story>({
        sql: 'SELECT * FROM stories WHERE expires_at > ?1',
        params: [now],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { stories: { where: (key: string) => { above: (val: number) => { toArray: () => Promise<Story[]> } } } };
          return dexieDb.stories.where('expiresAt').above(now).toArray();
        },
      });

      // Load my viewed stories
      const myViews = await dal.query<StoryView>('storyViews', {
        whereClause: { viewerId: currentIdentity.publicKey },
      });

      const viewedStories = new Set<string>(myViews.map((v: StoryView) => v.storyId));

      set({ stories, viewedStories, isLoading: false });
    } catch (error) {
      console.error('Failed to load stories:', error);
      set({ isLoading: false });
    }
  },

  // ========================================
  // MODERATION ACTIONS
  // ========================================

  muteUser: async (userId: string, reason?: string, expiresAt?: number): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const mute: MutedUser = {
      id: `mute-${Date.now()}-${secureRandomString(9)}`,
      userId: currentIdentity.publicKey,
      mutedUserId: userId,
      reason,
      expiresAt,
      createdAt: Date.now(),
    };

    try {
      await dal.add<MutedUser>('mutedUsers', mute);
    } catch (error) {
      console.error('Failed to mute user:', error);
    }

    set((state) => {
      const mutedUsers = new Set(state.mutedUsers);
      mutedUsers.add(userId);
      return { mutedUsers };
    });

    // Log the action
    await get().logModerationAction('mute', userId, undefined, undefined, reason);
  },

  unmuteUser: async (userId: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      await dal.queryCustom<never>({
        sql: 'DELETE FROM muted_users WHERE user_id = ?1 AND muted_user_id = ?2',
        params: [currentIdentity.publicKey, userId],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { mutedUsers: { where: (key: string) => { equals: (val: unknown) => { delete: () => Promise<void> } } } };
          await dexieDb.mutedUsers
            .where('[userId+mutedUserId]')
            .equals([currentIdentity.publicKey, userId])
            .delete();
          return [];
        },
      });
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }

    set((state) => {
      const mutedUsers = new Set(state.mutedUsers);
      mutedUsers.delete(userId);
      return { mutedUsers };
    });

    await get().logModerationAction('unmute', userId);
  },

  isMuted: (userId: string): boolean => {
    return get().mutedUsers.has(userId);
  },

  getMutedUsers: (): MutedUser[] => {
    // This would need to be loaded from DB
    return [];
  },

  reportContent: async (
    contentType: 'post' | 'comment' | 'user' | 'message' | 'story',
    contentId: string,
    contentAuthorId: string,
    reason: ReportReason,
    description?: string
  ): Promise<ContentReport> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const report: ContentReport = {
      id: `report-${Date.now()}-${secureRandomString(9)}`,
      reporterId: currentIdentity.publicKey,
      contentType,
      contentId,
      contentAuthorId,
      reason,
      description,
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      await dal.add<ContentReport>('contentReports', report);
    } catch (error) {
      console.error('Failed to save report:', error);
    }

    set((state) => ({
      pendingReports: [...state.pendingReports, report],
    }));

    return report;
  },

  reviewReport: async (reportId: string, status: ReportStatus, actionTaken?: string): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    const reviewedAt = Date.now();

    try {
      await dal.update('contentReports', reportId, {
        status,
        reviewedBy: currentIdentity.publicKey,
        reviewedAt,
        actionTaken,
        updatedAt: reviewedAt,
      });
    } catch (error) {
      console.error('Failed to update report:', error);
    }

    set((state) => ({
      pendingReports: state.pendingReports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status,
              reviewedBy: currentIdentity.publicKey,
              reviewedAt,
              actionTaken,
              updatedAt: reviewedAt,
            }
          : r
      ),
    }));
  },

  getPendingReports: (): ContentReport[] => {
    return get().pendingReports.filter((r) => r.status === 'pending');
  },

  createAutoModRule: async (
    name: string,
    ruleType: AutoModRuleType,
    pattern: string,
    actions: AutoModAction[],
    groupId?: string
  ): Promise<AutoModRule> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const rule: AutoModRule = {
      id: `rule-${Date.now()}-${secureRandomString(9)}`,
      groupId,
      name,
      ruleType,
      pattern,
      caseSensitive: false,
      actions,
      triggerCount: 0,
      isEnabled: true,
      createdAt: Date.now(),
      createdBy: currentIdentity.publicKey,
    };

    try {
      await dal.add<AutoModRule>('autoModRules', rule);
    } catch (error) {
      console.error('Failed to save auto-mod rule:', error);
    }

    set((state) => ({
      autoModRules: [...state.autoModRules, rule],
    }));

    return rule;
  },

  updateAutoModRule: async (ruleId: string, updates: Partial<AutoModRule>): Promise<void> => {
    try {
      await dal.update('autoModRules', ruleId, { ...updates, updatedAt: Date.now() });
    } catch (error) {
      console.error('Failed to update auto-mod rule:', error);
    }

    set((state) => ({
      autoModRules: state.autoModRules.map((r) =>
        r.id === ruleId ? { ...r, ...updates, updatedAt: Date.now() } : r
      ),
    }));
  },

  deleteAutoModRule: async (ruleId: string): Promise<void> => {
    try {
      await dal.delete('autoModRules', ruleId);
    } catch (error) {
      console.error('Failed to delete auto-mod rule:', error);
    }

    set((state) => ({
      autoModRules: state.autoModRules.filter((r) => r.id !== ruleId),
    }));
  },

  checkAutoMod: (content: string, groupId?: string): { triggered: boolean; actions: AutoModAction[] } => {
    const rules = get().autoModRules.filter(
      (r) => r.isEnabled && (!r.groupId || r.groupId === groupId)
    );

    const triggeredActions: AutoModAction[] = [];

    for (const rule of rules) {
      let matches = false;

      if (rule.ruleType === 'keyword') {
        const checkContent = rule.caseSensitive ? content : content.toLowerCase();
        const checkPattern = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
        matches = checkContent.includes(checkPattern);
      } else if (rule.ruleType === 'regex') {
        try {
          const regex = new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i');
          matches = regex.test(content);
        } catch {
          // Invalid regex, skip
        }
      }

      if (matches) {
        triggeredActions.push(...rule.actions);
      }
    }

    return {
      triggered: triggeredActions.length > 0,
      actions: [...new Set(triggeredActions)], // Dedupe
    };
  },

  loadModeration: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      // Load muted users
      const mutes = await dal.query<MutedUser>('mutedUsers', {
        whereClause: { userId: currentIdentity.publicKey },
      });

      const mutedUsers = new Set<string>(mutes.map((m: MutedUser) => m.mutedUserId));

      // Load pending reports (for admins)
      const pendingReports = await dal.query<ContentReport>('contentReports', {
        whereClause: { status: 'pending' },
      });

      // Load auto-mod rules
      const autoModRules = await dal.query<AutoModRule>('autoModRules', {
        whereClause: { isEnabled: 1 },
      });

      set({ mutedUsers, pendingReports, autoModRules });
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    }
  },

  // Helper for logging moderation actions
  logModerationAction: async (
    action: ModerationLog['action'],
    targetUserId?: string,
    targetContentType?: 'post' | 'comment' | 'message' | 'story',
    targetContentId?: string,
    reason?: string,
    reportId?: string
  ): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    const log: ModerationLog = {
      id: `log-${Date.now()}-${secureRandomString(9)}`,
      moderatorId: currentIdentity.publicKey,
      action,
      targetUserId,
      targetContentType,
      targetContentId,
      reason,
      reportId,
      createdAt: Date.now(),
    };

    try {
      await dal.add<ModerationLog>('moderationLogs', log);
    } catch (error) {
      console.error('Failed to save moderation log:', error);
    }

    set((state) => ({
      moderationLogs: [log, ...state.moderationLogs],
    }));
  },

  // ========================================
  // LIST ACTIONS
  // ========================================

  createList: async (input: CreateUserListInput): Promise<UserList> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) throw new Error('Not authenticated');

    const list: UserList = {
      id: `list-${Date.now()}-${secureRandomString(9)}`,
      ownerId: currentIdentity.publicKey,
      name: input.name,
      description: input.description,
      memberIds: input.initialMemberIds || [],
      memberCount: input.initialMemberIds?.length || 0,
      isPrivate: input.isPrivate,
      followerCount: 0,
      createdAt: Date.now(),
    };

    try {
      await dal.add<UserList>('userLists', list);
    } catch (error) {
      console.error('Failed to save list:', error);
    }

    set((state) => ({
      lists: [list, ...state.lists],
    }));

    return list;
  },

  updateList: async (
    listId: string,
    updates: Partial<Pick<UserList, 'name' | 'description' | 'isPrivate'>>
  ): Promise<void> => {
    try {
      await dal.update('userLists', listId, { ...updates, updatedAt: Date.now() });
    } catch (error) {
      console.error('Failed to update list:', error);
    }

    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === listId ? { ...l, ...updates, updatedAt: Date.now() } : l
      ),
    }));
  },

  deleteList: async (listId: string): Promise<void> => {
    try {
      await dal.delete('userLists', listId);
    } catch (error) {
      console.error('Failed to delete list:', error);
    }

    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
    }));
  },

  addToList: async (listId: string, userId: string): Promise<void> => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.memberIds.includes(userId)) return;

    const updatedMembers = [...list.memberIds, userId];

    try {
      await dal.update('userLists', listId, {
        memberIds: updatedMembers,
        memberCount: updatedMembers.length,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to add to list:', error);
    }

    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === listId
          ? { ...l, memberIds: updatedMembers, memberCount: updatedMembers.length, updatedAt: Date.now() }
          : l
      ),
    }));
  },

  removeFromList: async (listId: string, userId: string): Promise<void> => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list) return;

    const updatedMembers = list.memberIds.filter((id) => id !== userId);

    try {
      await dal.update('userLists', listId, {
        memberIds: updatedMembers,
        memberCount: updatedMembers.length,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to remove from list:', error);
    }

    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === listId
          ? { ...l, memberIds: updatedMembers, memberCount: updatedMembers.length, updatedAt: Date.now() }
          : l
      ),
    }));
  },

  getList: (listId: string): UserList | undefined => {
    return get().lists.find((l) => l.id === listId);
  },

  getMyLists: (): UserList[] => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return [];

    return get()
      .lists.filter((l) => l.ownerId === currentIdentity.publicKey)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getListMembers: (listId: string): string[] => {
    const list = get().lists.find((l) => l.id === listId);
    return list?.memberIds || [];
  },

  loadLists: async (): Promise<void> => {
    const currentIdentity = useAuthStore.getState().currentIdentity;
    if (!currentIdentity) return;

    try {
      const lists = await dal.query<UserList>('userLists', {
        whereClause: { ownerId: currentIdentity.publicKey },
      });
      set({ lists });
    } catch (error) {
      console.error('Failed to load lists:', error);
    }
  },

  // ========================================
  // TRENDING ACTIONS
  // ========================================

  refreshTrending: async (): Promise<void> => {
    try {
      // Calculate trending topics from recent posts
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentPosts = await dal.queryCustom<{ hashtags?: string[] }>({
        sql: 'SELECT * FROM posts WHERE created_at > ?1',
        params: [oneDayAgo],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { posts: { where: (key: string) => { above: (val: number) => { toArray: () => Promise<{ hashtags?: string[] }[]> } } } };
          return dexieDb.posts.where('createdAt').above(oneDayAgo).toArray();
        },
      });

      // Count hashtag occurrences
      const tagCounts = new Map<string, number>();
      recentPosts.forEach((post: { hashtags?: string[] }) => {
        post.hashtags?.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      // Sort by count and create trending topics
      const trendingTopics: TrendingTopic[] = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count], index) => ({
          tag,
          postCount: count,
          recentPostCount: count,
          trend: 'stable' as const,
          rank: index + 1,
          lastUpdated: Date.now(),
        }));

      set({ trendingTopics });
    } catch (error) {
      console.error('Failed to refresh trending:', error);
    }
  },

  refreshSuggestions: async (): Promise<void> => {
    // This would integrate with friends/followers to suggest users
    // For now, we'll return empty - could be expanded with recommendation algorithm
    set({ suggestedUsers: [] });
  },
}));
