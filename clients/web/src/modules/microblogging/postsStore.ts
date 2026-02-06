/**
 * Microblogging Module - Posts Store
 * Zustand store for managing posts, reactions, and social interactions
 */

import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { dal } from '@/core/storage/dal';
import { secureRandomString } from '@/lib/utils';
import type {
  Post,
  Reaction,
  Comment,
  Repost,
  Bookmark,
  ScheduledPost,
  CreatePostInput,
  UpdatePostInput,
  PostFeedFilter,
  ReactionType,
} from './types';
import { useFriendsStore } from '@/modules/friends/friendsStore';
import { extractUrlsFromText } from '@/lib/embed';

interface PostsState {
  // Posts
  posts: Post[];
  currentPost: Post | null;

  // Reactions
  reactions: Reaction[];
  myReactions: Map<string, ReactionType>; // postId -> reaction type

  // Comments
  comments: Comment[];

  // Reposts
  reposts: Repost[];
  myReposts: Set<string>; // postIds I've reposted

  // Bookmarks
  bookmarks: Bookmark[];
  myBookmarks: Set<string>; // postIds I've bookmarked

  // Scheduled Posts
  scheduledPosts: ScheduledPost[];

  // Feed state
  feedFilter: PostFeedFilter;
  isLoadingFeed: boolean;
  hasMorePosts: boolean;

  // Actions - Posts
  createPost: (input: CreatePostInput) => Promise<Post>;
  updatePost: (input: UpdatePostInput) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  getPost: (postId: string) => Post | undefined;
  getPosts: (filter?: PostFeedFilter) => Post[];
  loadMorePosts: () => Promise<void>;

  // Actions - Reactions
  addReaction: (postId: string, type: ReactionType) => Promise<void>;
  removeReaction: (postId: string) => Promise<void>;
  getPostReactions: (postId: string) => Reaction[];
  getMyReaction: (postId: string) => ReactionType | undefined;

  // Actions - Comments
  addComment: (postId: string, content: string, parentCommentId?: string) => Promise<Comment>;
  deleteComment: (commentId: string) => Promise<void>;
  getPostComments: (postId: string) => Comment[];

  // Actions - Reposts
  repost: (postId: string) => Promise<void>;
  quotePost: (postId: string, content: string) => Promise<void>;
  unrepost: (postId: string) => Promise<void>;
  hasReposted: (postId: string) => boolean;

  // Actions - Bookmarks
  bookmarkPost: (postId: string) => Promise<void>;
  unbookmarkPost: (postId: string) => Promise<void>;
  hasBookmarked: (postId: string) => boolean;
  getBookmarkedPosts: () => Post[];

  // Actions - Scheduled Posts
  schedulePost: (input: CreatePostInput, scheduledFor: number) => Promise<ScheduledPost>;
  updateScheduledPost: (id: string, updates: Partial<Pick<ScheduledPost, 'content' | 'scheduledFor' | 'contentWarning' | 'isSensitive'>>) => Promise<void>;
  cancelScheduledPost: (id: string) => Promise<void>;
  publishScheduledPost: (id: string) => Promise<Post>;
  getScheduledPosts: () => ScheduledPost[];
  getDueScheduledPosts: () => ScheduledPost[];
  loadScheduledPosts: () => Promise<void>;

  // Actions - Pinning
  pinPost: (postId: string) => Promise<void>;
  unpinPost: (postId: string) => Promise<void>;
  isPinned: (postId: string) => boolean;
  getPinnedPosts: () => Post[];

  // Actions - Feed
  setFeedFilter: (filter: Partial<PostFeedFilter>) => void;
  refreshFeed: () => Promise<void>;

  // Utility
  clearCache: () => void;
}

export const usePostsStore = create<PostsState>()(
  (set, get) => ({
      // Initial state
      posts: [],
      currentPost: null,
      reactions: [],
      myReactions: new Map(),
      comments: [],
      reposts: [],
      myReposts: new Set(),
      bookmarks: [],
      myBookmarks: new Set(),
      scheduledPosts: [],
      feedFilter: {
        type: 'all',
        limit: 20,
      },
      isLoadingFeed: false,
      hasMorePosts: true,

      // Create post
      createPost: async (input: CreatePostInput): Promise<Post> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;

        // Extract URLs from content for link previews/embeds
        const extractedUrls = extractUrlsFromText(input.content);
        const links = extractedUrls.map((u) => u.url);

        const newPost: Post = {
          _v: '1.0.0',
          id: `post-${Date.now()}-${secureRandomString(9)}`,
          authorId: currentIdentity?.publicKey || '',
          content: input.content,
          contentType: input.contentType || 'text',
          media: input.media,
          visibility: input.visibility,
          reactionCount: 0,
          commentCount: 0,
          repostCount: 0,
          bookmarkCount: 0,
          mentions: input.mentions || [],
          hashtags: input.hashtags || [],
          links,
          // Signal-style encrypted link previews
          // Sender has already fetched Open Graph metadata and thumbnails
          // These are stored encrypted with the post using NIP-17
          linkPreviews: input.linkPreviews,
          createdAt: Date.now(),
          isRepost: !!input.repostedPostId,
          repostedPostId: input.repostedPostId,
          isQuote: input.isQuote || false,
          quotedPostId: input.repostedPostId,
          quotedContent: input.quotedContent,
          contentWarning: input.contentWarning,
          isSensitive: input.isSensitive,
        };

        // Persist to database
        try {
          await dal.add<Post>('posts', newPost);
        } catch (error) {
          console.error('Failed to save post to database:', error);
        }

        set((state) => ({
          posts: [newPost, ...state.posts],
        }));

        return newPost;
      },

      // Update post
      updatePost: async (input: UpdatePostInput): Promise<void> => {
        const updatedAt = Date.now();

        // Update in database
        try {
          await dal.update('posts', input.postId, {
            content: input.content,
            contentWarning: input.contentWarning,
            isSensitive: input.isSensitive,
            updatedAt,
          });
        } catch (error) {
          console.error('Failed to update post in database:', error);
        }

        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === input.postId
              ? {
                  ...post,
                  content: input.content ?? post.content,
                  contentWarning: input.contentWarning ?? post.contentWarning,
                  isSensitive: input.isSensitive ?? post.isSensitive,
                  updatedAt,
                }
              : post
          ),
        }));
      },

      // Delete post
      deletePost: async (postId: string): Promise<void> => {
        // Delete from database
        try {
          await dal.delete('posts', postId);
          // Delete related records using queryCustom for WHERE...DELETE patterns
          await dal.queryCustom<never>({
            sql: 'DELETE FROM reactions WHERE post_id = ?1',
            params: [postId],
            dexieFallback: async (db: unknown) => {
              const dexieDb = db as { reactions: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
              await dexieDb.reactions.where('postId').equals(postId).delete();
              return [];
            },
          });
          await dal.queryCustom<never>({
            sql: 'DELETE FROM comments WHERE post_id = ?1',
            params: [postId],
            dexieFallback: async (db: unknown) => {
              const dexieDb = db as { comments: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
              await dexieDb.comments.where('postId').equals(postId).delete();
              return [];
            },
          });
          await dal.queryCustom<never>({
            sql: 'DELETE FROM reposts WHERE post_id = ?1',
            params: [postId],
            dexieFallback: async (db: unknown) => {
              const dexieDb = db as { reposts: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
              await dexieDb.reposts.where('postId').equals(postId).delete();
              return [];
            },
          });
          await dal.queryCustom<never>({
            sql: 'DELETE FROM bookmarks WHERE post_id = ?1',
            params: [postId],
            dexieFallback: async (db: unknown) => {
              const dexieDb = db as { bookmarks: { where: (key: string) => { equals: (val: string) => { delete: () => Promise<void> } } } };
              await dexieDb.bookmarks.where('postId').equals(postId).delete();
              return [];
            },
          });
        } catch (error) {
          console.error('Failed to delete post from database:', error);
        }

        set((state) => ({
          posts: state.posts.filter((post) => post.id !== postId),
          reactions: state.reactions.filter((r) => r.postId !== postId),
          comments: state.comments.filter((c) => c.postId !== postId),
          reposts: state.reposts.filter((r) => r.postId !== postId),
          bookmarks: state.bookmarks.filter((b) => b.postId !== postId),
        }));
      },

      // Get single post
      getPost: (postId: string): Post | undefined => {
        return get().posts.find((p) => p.id === postId);
      },

      // Get posts with filter
      getPosts: (filter?: PostFeedFilter): Post[] => {
        const { posts, myBookmarks } = get();
        const activeFilter = filter || get().feedFilter;

        let filteredPosts = [...posts];

        // Filter by type
        if (activeFilter.type === 'following') {
          // Get followed users from friends store
          const friends = useFriendsStore.getState().getFriends({ status: ['accepted'] });
          const followedPubkeys = new Set(friends.map((f) => f.friendPubkey));
          filteredPosts = filteredPosts.filter((p) => followedPubkeys.has(p.authorId));
        } else if (activeFilter.type === 'group' && activeFilter.groupIds) {
          filteredPosts = filteredPosts.filter(
            (p) =>
              p.visibility.groupIds?.some((gid) => activeFilter.groupIds?.includes(gid))
          );
        } else if (activeFilter.type === 'mentions') {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (currentIdentity) {
            filteredPosts = filteredPosts.filter((p) =>
              p.mentions?.includes(currentIdentity.publicKey)
            );
          }
        } else if (activeFilter.type === 'bookmarks') {
          filteredPosts = filteredPosts.filter((p) => myBookmarks.has(p.id));
        } else if (activeFilter.type === 'pinned') {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (currentIdentity) {
            filteredPosts = filteredPosts.filter(
              (p) => p.isPinned && p.authorId === currentIdentity.publicKey
            );
          }
        }

        // Filter by author
        if (activeFilter.authorId) {
          filteredPosts = filteredPosts.filter((p) => p.authorId === activeFilter.authorId);
        }

        // Filter by date range
        if (activeFilter.dateFrom) {
          filteredPosts = filteredPosts.filter((p) => p.createdAt >= activeFilter.dateFrom!);
        }
        if (activeFilter.dateTo) {
          filteredPosts = filteredPosts.filter((p) => p.createdAt <= activeFilter.dateTo!);
        }

        // Filter by content type
        if (activeFilter.contentTypes?.length) {
          filteredPosts = filteredPosts.filter((p) =>
            activeFilter.contentTypes?.includes(p.contentType)
          );
        }

        // Filter by hashtags
        if (activeFilter.hashtags?.length) {
          filteredPosts = filteredPosts.filter((p) =>
            p.hashtags?.some((tag) => activeFilter.hashtags?.includes(tag))
          );
        }

        // Filter by search query (full-text search)
        if (activeFilter.searchQuery) {
          const query = activeFilter.searchQuery.toLowerCase();
          filteredPosts = filteredPosts.filter(
            (p) =>
              p.content.toLowerCase().includes(query) ||
              (p.hashtags?.some((tag) => tag.toLowerCase().includes(query)) ?? false) ||
              p.authorId.toLowerCase().includes(query)
          );
        }

        // Sort: pinned posts first, then by creation time (newest first)
        filteredPosts.sort((a, b) => {
          // Pinned posts from the same author come first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.createdAt - a.createdAt;
        });

        // Apply pagination
        const limit = activeFilter.limit || 20;
        const offset = activeFilter.offset || 0;
        return filteredPosts.slice(offset, offset + limit);
      },

      // Load more posts (pagination)
      loadMorePosts: async (): Promise<void> => {
        const { feedFilter } = get();
        const currentOffset = feedFilter.offset || 0;
        const limit = feedFilter.limit || 20;

        set({ isLoadingFeed: true });

        try {
          // Fetch posts from database
          const dbPosts = await dal.query<Post>('posts', {
            orderBy: 'createdAt',
            orderDir: 'desc',
            offset: currentOffset,
            limit,
          });

          set((state) => ({
            posts: [...state.posts, ...dbPosts],
            feedFilter: {
              ...feedFilter,
              offset: currentOffset + limit,
            },
            hasMorePosts: dbPosts.length === limit,
            isLoadingFeed: false,
          }));
        } catch (error) {
          console.error('Failed to load more posts:', error);
          set({ isLoadingFeed: false });
        }
      },

      // Add reaction
      addReaction: async (postId: string, type: ReactionType): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';

        // Check if user already has a reaction on this post
        const existingReaction = get().myReactions.get(postId);
        const hasExistingReaction = existingReaction !== undefined;

        const newReaction: Reaction = {
          _v: '1.0.0',
          id: `reaction-${Date.now()}-${secureRandomString(9)}`,
          postId,
          userId,
          type,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          if (hasExistingReaction) {
            // Remove old reaction first
            await dal.queryCustom<never>({
              sql: 'DELETE FROM reactions WHERE post_id = ?1 AND user_id = ?2',
              params: [postId, userId],
              dexieFallback: async (db: unknown) => {
                const dexieDb = db as { reactions: { where: (key: string) => { equals: (val: unknown) => { delete: () => Promise<void> } } } };
                await dexieDb.reactions
                  .where('[postId+userId]')
                  .equals([postId, userId])
                  .delete();
                return [];
              },
            });
          }
          await dal.add<Reaction>('reactions', newReaction);

          // Only increment count if this is a new reaction (not a change)
          if (!hasExistingReaction) {
            const post = await dal.get<Post>('posts', postId);
            if (post) {
              await dal.update('posts', postId, {
                reactionCount: (post.reactionCount || 0) + 1,
              });
            }
          }
        } catch (error) {
          console.error('Failed to save reaction to database:', error);
        }

        set((state) => {
          const myReactions = new Map(state.myReactions);
          myReactions.set(postId, type);

          // Remove old reaction from array if it exists
          const filteredReactions = hasExistingReaction
            ? state.reactions.filter((r) => !(r.postId === postId && r.userId === userId))
            : state.reactions;

          return {
            reactions: [...filteredReactions, newReaction],
            myReactions,
            posts: state.posts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    // Only increment if this is a new reaction (not a change)
                    reactionCount: hasExistingReaction
                      ? post.reactionCount
                      : post.reactionCount + 1,
                  }
                : post
            ),
          };
        });
      },

      // Remove reaction
      removeReaction: async (postId: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';

        set((state) => {
          const myReactions = new Map(state.myReactions);
          myReactions.delete(postId);

          return {
            reactions: state.reactions.filter(
              (r) => !(r.postId === postId && r.userId === userId)
            ),
            myReactions,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, reactionCount: Math.max(0, post.reactionCount - 1) }
                : post
            ),
          };
        });
      },

      // Get reactions for a post
      getPostReactions: (postId: string): Reaction[] => {
        return get().reactions.filter((r) => r.postId === postId);
      },

      // Get my reaction for a post
      getMyReaction: (postId: string): ReactionType | undefined => {
        return get().myReactions.get(postId);
      },

      // Add comment
      addComment: async (
        postId: string,
        content: string,
        parentCommentId?: string
      ): Promise<Comment> => {
        const authorId = useAuthStore.getState().currentIdentity?.publicKey || '';
        const parentComment = parentCommentId
          ? get().comments.find((c) => c.id === parentCommentId)
          : undefined;

        const newComment: Comment = {
          _v: '1.0.0',
          id: `comment-${Date.now()}-${secureRandomString(9)}`,
          postId,
          authorId,
          content,
          parentCommentId,
          depth: parentComment ? Math.min(parentComment.depth + 1, 3) : 0,
          reactionCount: 0,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await dal.add<Comment>('comments', newComment);
          const post = await dal.get<Post>('posts', postId);
          if (post) {
            await dal.update('posts', postId, {
              commentCount: (post.commentCount || 0) + 1,
            });
          }
        } catch (error) {
          console.error('Failed to save comment to database:', error);
        }

        set((state) => ({
          comments: [...state.comments, newComment],
          posts: state.posts.map((post) =>
            post.id === postId
              ? { ...post, commentCount: post.commentCount + 1 }
              : post
          ),
        }));

        return newComment;
      },

      // Delete comment
      deleteComment: async (commentId: string): Promise<void> => {
        const comment = get().comments.find((c) => c.id === commentId);
        if (!comment) return;

        set((state) => ({
          comments: state.comments.filter((c) => c.id !== commentId),
          posts: state.posts.map((post) =>
            post.id === comment.postId
              ? { ...post, commentCount: Math.max(0, post.commentCount - 1) }
              : post
          ),
        }));
      },

      // Get comments for a post
      getPostComments: (postId: string): Comment[] => {
        return get().comments.filter((c) => c.postId === postId);
      },

      // Repost
      repost: async (postId: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';
        const newRepost: Repost = {
          _v: '1.0.0',
          id: `repost-${Date.now()}-${secureRandomString(9)}`,
          postId,
          userId,
          isQuote: false,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await dal.add<Repost>('reposts', newRepost);
          const post = await dal.get<Post>('posts', postId);
          if (post) {
            await dal.update('posts', postId, {
              repostCount: (post.repostCount || 0) + 1,
            });
          }
        } catch (error) {
          console.error('Failed to save repost to database:', error);
        }

        set((state) => {
          const myReposts = new Set(state.myReposts);
          myReposts.add(postId);

          return {
            reposts: [...state.reposts, newRepost],
            myReposts,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, repostCount: post.repostCount + 1 }
                : post
            ),
          };
        });
      },

      // Quote post (repost with comment)
      quotePost: async (postId: string, content: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';
        const newRepost: Repost = {
          _v: '1.0.0',
          id: `repost-${Date.now()}-${secureRandomString(9)}`,
          postId,
          userId,
          isQuote: true,
          quoteContent: content,
          createdAt: Date.now(),
        };

        set((state) => {
          const myReposts = new Set(state.myReposts);
          myReposts.add(postId);

          return {
            reposts: [...state.reposts, newRepost],
            myReposts,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, repostCount: post.repostCount + 1 }
                : post
            ),
          };
        });
      },

      // Unrepost
      unrepost: async (postId: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';

        set((state) => {
          const myReposts = new Set(state.myReposts);
          myReposts.delete(postId);

          return {
            reposts: state.reposts.filter(
              (r) => !(r.postId === postId && r.userId === userId)
            ),
            myReposts,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, repostCount: Math.max(0, post.repostCount - 1) }
                : post
            ),
          };
        });
      },

      // Has reposted
      hasReposted: (postId: string): boolean => {
        return get().myReposts.has(postId);
      },

      // Bookmark post
      bookmarkPost: async (postId: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';
        const newBookmark: Bookmark = {
          _v: '1.0.0',
          id: `bookmark-${Date.now()}-${secureRandomString(9)}`,
          postId,
          userId,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await dal.add<Bookmark>('bookmarks', newBookmark);
          const post = await dal.get<Post>('posts', postId);
          if (post) {
            await dal.update('posts', postId, {
              bookmarkCount: (post.bookmarkCount || 0) + 1,
            });
          }
        } catch (error) {
          console.error('Failed to save bookmark to database:', error);
        }

        set((state) => {
          const myBookmarks = new Set(state.myBookmarks);
          myBookmarks.add(postId);

          return {
            bookmarks: [...state.bookmarks, newBookmark],
            myBookmarks,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, bookmarkCount: post.bookmarkCount + 1 }
                : post
            ),
          };
        });
      },

      // Unbookmark post
      unbookmarkPost: async (postId: string): Promise<void> => {
        const userId = useAuthStore.getState().currentIdentity?.publicKey || '';

        set((state) => {
          const myBookmarks = new Set(state.myBookmarks);
          myBookmarks.delete(postId);

          return {
            bookmarks: state.bookmarks.filter(
              (b) => !(b.postId === postId && b.userId === userId)
            ),
            myBookmarks,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, bookmarkCount: Math.max(0, post.bookmarkCount - 1) }
                : post
            ),
          };
        });
      },

      // Has bookmarked
      hasBookmarked: (postId: string): boolean => {
        return get().myBookmarks.has(postId);
      },

      // Get bookmarked posts
      getBookmarkedPosts: (): Post[] => {
        const { posts, myBookmarks } = get();
        return posts.filter((p) => myBookmarks.has(p.id));
      },

      // Set feed filter
      setFeedFilter: (filter: Partial<PostFeedFilter>): void => {
        set((state) => ({
          feedFilter: { ...state.feedFilter, ...filter },
        }));
      },

      // Refresh feed
      refreshFeed: async (): Promise<void> => {
        set({ isLoadingFeed: true });

        try {
          // Fetch latest posts from database
          // Note: Nostr sync will be added in future iteration
          const limit = get().feedFilter.limit || 20;
          const dbPosts = await dal.query<Post>('posts', {
            orderBy: 'createdAt',
            orderDir: 'desc',
            limit,
          });

          set({
            posts: dbPosts,
            feedFilter: { ...get().feedFilter, offset: 0 },
            hasMorePosts: dbPosts.length === limit,
            isLoadingFeed: false,
          });
        } catch (error) {
          console.error('Failed to refresh feed:', error);
          set({ isLoadingFeed: false });
        }
      },

      // Clear cache
      clearCache: (): void => {
        set({
          posts: [],
          reactions: [],
          comments: [],
          reposts: [],
          bookmarks: [],
          scheduledPosts: [],
          myReactions: new Map(),
          myReposts: new Set(),
          myBookmarks: new Set(),
        });
      },

      // === Scheduled Posts Actions ===

      // Schedule a post for future publishing
      schedulePost: async (input: CreatePostInput, scheduledFor: number): Promise<ScheduledPost> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        const scheduledPost: ScheduledPost = {
          id: `scheduled-${Date.now()}-${secureRandomString(9)}`,
          authorId: currentIdentity?.publicKey || '',
          content: input.content,
          contentType: input.contentType || 'text',
          media: input.media,
          visibility: input.visibility,
          mentions: input.mentions,
          hashtags: input.hashtags,
          contentWarning: input.contentWarning,
          isSensitive: input.isSensitive,
          scheduledFor,
          status: 'pending',
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await dal.add<ScheduledPost>('scheduledPosts', scheduledPost);
        } catch (error) {
          console.error('Failed to save scheduled post:', error);
        }

        set((state) => ({
          scheduledPosts: [...state.scheduledPosts, scheduledPost],
        }));

        return scheduledPost;
      },

      // Update a scheduled post
      updateScheduledPost: async (
        id: string,
        updates: Partial<Pick<ScheduledPost, 'content' | 'scheduledFor' | 'contentWarning' | 'isSensitive'>>
      ): Promise<void> => {
        const updatedAt = Date.now();

        try {
          await dal.update('scheduledPosts', id, { ...updates, updatedAt });
        } catch (error) {
          console.error('Failed to update scheduled post:', error);
        }

        set((state) => ({
          scheduledPosts: state.scheduledPosts.map((sp) =>
            sp.id === id ? { ...sp, ...updates, updatedAt } : sp
          ),
        }));
      },

      // Cancel a scheduled post
      cancelScheduledPost: async (id: string): Promise<void> => {
        try {
          await dal.update('scheduledPosts', id, { status: 'cancelled', updatedAt: Date.now() });
        } catch (error) {
          console.error('Failed to cancel scheduled post:', error);
        }

        set((state) => ({
          scheduledPosts: state.scheduledPosts.map((sp) =>
            sp.id === id ? { ...sp, status: 'cancelled', updatedAt: Date.now() } : sp
          ),
        }));
      },

      // Publish a scheduled post immediately
      publishScheduledPost: async (id: string): Promise<Post> => {
        const scheduledPost = get().scheduledPosts.find((sp) => sp.id === id);
        if (!scheduledPost) {
          throw new Error('Scheduled post not found');
        }

        // Create the actual post
        const post = await get().createPost({
          content: scheduledPost.content,
          contentType: scheduledPost.contentType,
          media: scheduledPost.media,
          visibility: scheduledPost.visibility,
          mentions: scheduledPost.mentions,
          hashtags: scheduledPost.hashtags,
          contentWarning: scheduledPost.contentWarning,
          isSensitive: scheduledPost.isSensitive,
        });

        // Update the scheduled post status
        const updatedAt = Date.now();
        try {
          await dal.update('scheduledPosts', id, {
            status: 'published',
            publishedAt: updatedAt,
            publishedPostId: post.id,
            updatedAt,
          });
        } catch (error) {
          console.error('Failed to update scheduled post status:', error);
        }

        set((state) => ({
          scheduledPosts: state.scheduledPosts.map((sp) =>
            sp.id === id
              ? { ...sp, status: 'published', publishedAt: updatedAt, publishedPostId: post.id, updatedAt }
              : sp
          ),
        }));

        return post;
      },

      // Get all scheduled posts for current user
      getScheduledPosts: (): ScheduledPost[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        return get()
          .scheduledPosts.filter(
            (sp) => sp.authorId === currentIdentity.publicKey && sp.status === 'pending'
          )
          .sort((a, b) => a.scheduledFor - b.scheduledFor);
      },

      // Get scheduled posts that are due to be published
      getDueScheduledPosts: (): ScheduledPost[] => {
        const now = Date.now();
        return get().scheduledPosts.filter(
          (sp) => sp.status === 'pending' && sp.scheduledFor <= now
        );
      },

      // Load scheduled posts from database
      loadScheduledPosts: async (): Promise<void> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return;

        try {
          const scheduledPosts = await dal.query<ScheduledPost>('scheduledPosts', {
            whereClause: { authorId: currentIdentity.publicKey },
          });

          set({ scheduledPosts });
        } catch (error) {
          console.error('Failed to load scheduled posts:', error);
        }
      },

      // === Post Pinning Actions ===

      // Pin a post to your profile
      pinPost: async (postId: string): Promise<void> => {
        const pinnedAt = Date.now();

        try {
          await dal.update('posts', postId, { isPinned: true, pinnedAt });
        } catch (error) {
          console.error('Failed to pin post:', error);
        }

        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId ? { ...p, isPinned: true, pinnedAt } : p
          ),
        }));
      },

      // Unpin a post
      unpinPost: async (postId: string): Promise<void> => {
        try {
          await dal.update('posts', postId, { isPinned: false, pinnedAt: undefined });
        } catch (error) {
          console.error('Failed to unpin post:', error);
        }

        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId ? { ...p, isPinned: false, pinnedAt: undefined } : p
          ),
        }));
      },

      // Check if a post is pinned
      isPinned: (postId: string): boolean => {
        const post = get().posts.find((p) => p.id === postId);
        return post?.isPinned || false;
      },

      // Get all pinned posts for current user
      getPinnedPosts: (): Post[] => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        if (!currentIdentity) return [];

        return get()
          .posts.filter((p) => p.isPinned && p.authorId === currentIdentity.publicKey)
          .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
      },
    })
);
