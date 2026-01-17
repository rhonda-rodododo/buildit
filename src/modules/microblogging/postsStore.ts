/**
 * Microblogging Module - Posts Store
 * Zustand store for managing posts, reactions, and social interactions
 */

import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/core/storage/db';
import type {
  Post,
  Reaction,
  Comment,
  Repost,
  Bookmark,
  CreatePostInput,
  UpdatePostInput,
  PostFeedFilter,
  ReactionType,
} from './types';

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
      feedFilter: {
        type: 'all',
        limit: 20,
      },
      isLoadingFeed: false,
      hasMorePosts: true,

      // Create post
      createPost: async (input: CreatePostInput): Promise<Post> => {
        const currentIdentity = useAuthStore.getState().currentIdentity;
        const newPost: Post = {
          id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          links: [],
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
          await db.posts.add(newPost);
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
          await db.posts.update(input.postId, {
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
          await db.posts.delete(postId);
          await db.reactions.where('postId').equals(postId).delete();
          await db.comments.where('postId').equals(postId).delete();
          await db.reposts.where('postId').equals(postId).delete();
          await db.bookmarks.where('postId').equals(postId).delete();
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
        const { posts } = get();
        const activeFilter = filter || get().feedFilter;

        let filteredPosts = [...posts];

        // Filter by type
        if (activeFilter.type === 'following') {
          // TODO: Filter by followed users
        } else if (activeFilter.type === 'group' && activeFilter.groupIds) {
          filteredPosts = filteredPosts.filter(
            (p) =>
              p.visibility.groupIds?.some((gid) => activeFilter.groupIds?.includes(gid))
          );
        } else if (activeFilter.type === 'mentions') {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (currentIdentity) {
            filteredPosts = filteredPosts.filter((p) =>
              p.mentions.includes(currentIdentity.publicKey)
            );
          }
        } else if (activeFilter.type === 'bookmarks') {
          const { myBookmarks } = get();
          filteredPosts = filteredPosts.filter((p) => myBookmarks.has(p.id));
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
            p.hashtags.some((tag) => activeFilter.hashtags?.includes(tag))
          );
        }

        // Filter by search query
        if (activeFilter.searchQuery) {
          const query = activeFilter.searchQuery.toLowerCase();
          filteredPosts = filteredPosts.filter(
            (p) =>
              p.content.toLowerCase().includes(query) ||
              p.hashtags.some((tag) => tag.toLowerCase().includes(query))
          );
        }

        // Sort by creation time (newest first)
        filteredPosts.sort((a, b) => b.createdAt - a.createdAt);

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
          const dbPosts = await db.posts
            .orderBy('createdAt')
            .reverse()
            .offset(currentOffset)
            .limit(limit)
            .toArray();

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
        const newReaction: Reaction = {
          id: `reaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          postId,
          userId,
          type,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await db.reactions.add(newReaction);
          const post = await db.posts.get(postId);
          if (post) {
            await db.posts.update(postId, {
              reactionCount: (post.reactionCount || 0) + 1,
            });
          }
        } catch (error) {
          console.error('Failed to save reaction to database:', error);
        }

        set((state) => {
          const myReactions = new Map(state.myReactions);
          myReactions.set(postId, type);

          return {
            reactions: [...state.reactions, newReaction],
            myReactions,
            posts: state.posts.map((post) =>
              post.id === postId
                ? { ...post, reactionCount: post.reactionCount + 1 }
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
          id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          await db.comments.add(newComment);
          const post = await db.posts.get(postId);
          if (post) {
            await db.posts.update(postId, {
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
          id: `repost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          postId,
          userId,
          isQuote: false,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await db.reposts.add(newRepost);
          const post = await db.posts.get(postId);
          if (post) {
            await db.posts.update(postId, {
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
          id: `repost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          postId,
          userId,
          createdAt: Date.now(),
        };

        // Persist to database
        try {
          await db.bookmarks.add(newBookmark);
          const post = await db.posts.get(postId);
          if (post) {
            await db.posts.update(postId, {
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
          const dbPosts = await db.posts
            .orderBy('createdAt')
            .reverse()
            .limit(limit)
            .toArray();

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
          myReactions: new Map(),
          myReposts: new Set(),
          myBookmarks: new Set(),
        });
      },
    })
);
